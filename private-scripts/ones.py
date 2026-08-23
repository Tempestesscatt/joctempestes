"""
mar_final_blindado.py — MFWAM0025 · COSTA CATALANA · 48H · JSON WEB
═══════════════════════════════════════════════════════════════════════════════
 Font: meteofetch MFWAM0025, paquet SP1 (totes les variables d'onatge/vent
       marí disponibles: alçada, període i direcció d'onada, mar de vent,
       swell, i vent a 10m).
 Regió: costa catalana + Delta de l'Ebre (mateix extent que l'script de mapes
        original): lon 0.10–3.60E, lat 40.40–42.95N.
 Sortida: un fitxer JSON per hora de previsió (mar_00.json ... mar_47.json)
          a la carpeta public/web_data_mar, amb totes les variables SP1
          retallades a la graella de la regió.

 Aquest script reutilitza el mateix nivell de robustesa que
 t_final_blindado.py (AROME):
   · reintents amb backoff exponencial
   · log complet a fitxer (Tee stdout/stderr)
   · gestió neta de Ctrl+C / SIGTERM (SHUTDOWN_REQUESTED)
   · escriptura atòmica de JSON
   · informe d'integritat + status.json final
   · neteja de temporals

 A diferència de l'script AROME, MFWAM0025 no té una capa WCS separada:
 tot surt del mateix GRIB (paquet SP1) via meteofetch, així que no calen
 els mecanismes de "run WCS vs run meteofetch" ni el fallback de servidor
 lent/ràpid — però es manté el mateix esperit de "run intel·ligent":
 es determina el run més recent realment disponible abans de baixar-ho tot.

 ─────────────────────────────────────────────────────────────────────────
 FIX (2026-07-26): la detecció de run_dt es feia amb
 np.datetime64(attrs.get("GRIB_dataDate", None)), que amb valor None no
 llança excepció sinó que retorna NaT — per tant el fallback mai
 s'activava i el NaT arribava fins a generar_json, provocant:
   TypeError: unsupported operand type(s) for +: 'NoneType' and
   'datetime.timedelta'
 Ara es comprova explícitament amb np.isnat() i es prova primer la
 coordenada "time" del propi dataset, després l'atribut GRIB (parsejat
 correctament amb data+hora), i per últim el primer valid_time o l'hora
 actual. generar_json també queda blindat per si tot i així arriba un
 NaT o un None.
 ─────────────────────────────────────────────────────────────────────────
═══════════════════════════════════════════════════════════════════════════════
"""

import atexit
import json
import os
import signal
import sys
import time
import traceback
import warnings
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np

warnings.filterwarnings("ignore", category=FutureWarning)

# ═══════════════════ CONFIG ═══════════════════

# Mateix extent que l'script de mapes original (costa catalana + Delta de l'Ebre)
LON_MIN, LON_MAX = 0.50, 3.40
LAT_MIN, LAT_MAX = 40.50, 42.50

TOTAL_HORES = 51                  # màxim disponible a MFWAM0025 (~47h reals)
MAX_REINTENTS_DESCARREGA = 5
MAX_INTENTS_RUN = 5                   # reintents per trobar/confirmar el run més recent
PAUSA_ENTRE_INTENTS = 3.0

# Carpeta de sortida: meu-mapa/public/webdata_waves, germana de la carpeta
# on viu aquest script (private-scripts) dins del repo joctempestes.
# S'usa .parent perquè és relatiu al fitxer, no depèn de l'usuari/màquina.
d = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = Path(d).parent / "meu-mapa" / "public" / "webdata_waves"

SHUTDOWN_REQUESTED = False


def _signal_handler(signum, frame):
    global SHUTDOWN_REQUESTED
    if not SHUTDOWN_REQUESTED:
        print("\n\n  ⚠️  Ctrl+C. Acabant petició en curs i desant...")
        SHUTDOWN_REQUESTED = True
    else:
        print("\n  ❌ Sortida forçada.")
        os._exit(1)


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


class Tee:
    def __init__(self, *streams):
        self.streams = streams

    def write(self, data):
        for s in self.streams:
            try:
                s.write(data)
                s.flush()
            except Exception:
                pass

    def flush(self):
        for s in self.streams:
            try:
                s.flush()
            except Exception:
                pass


def configurar_log():
    log_dir = OUTPUT_DIR / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = log_dir / f"run_{ts}.log"
    fitxer_log = open(log_path, "a", encoding="utf-8")
    sys.stdout = Tee(sys.__stdout__, fitxer_log)
    sys.stderr = Tee(sys.__stderr__, fitxer_log)
    return log_path, fitxer_log


def avisar(msg):
    print(f"    ⚠️  {msg}")


def format_time(s):
    if s < 60:
        return f"{s:.0f}s"
    elif s < 3600:
        return f"{int(s // 60)}m {int(s % 60)}s"
    else:
        return f"{int(s // 3600)}h {int((s % 3600) // 60)}m"


def format_size(b):
    if b < 1024:
        return f"{b} B"
    elif b < 1024 * 1024:
        return f"{b / 1024:.1f} KB"
    elif b < 1024 * 1024 * 1024:
        return f"{b / (1024 * 1024):.1f} MB"
    else:
        return f"{b / (1024 * 1024 * 1024):.2f} GB"


def barra(pct, ample=20):
    fet = int(ample * pct / 100)
    return f"[{'█' * fet}{'░' * (ample - fet)}] {pct:5.1f}%"


def escriure_json_atomic(path: Path, data):
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def _backoff(intent, base=2.0, cap=30.0):
    import random
    return min(cap, base * (2 ** (intent - 1))) + random.uniform(0, 1)


# ═══════════════════ VARIABLES MFWAM0025 SP1 ═══════════════════
# clau -> (nom, unitat, és_direccional)
VARS_MAR = {
    "si10":   ("Velocitat vent 10m", "m/s", False),
    "wdir10": ("Direcció vent 10m", "°", True),
    "swh":    ("Alçada significativa (onada+swell)", "m", False),
    "mwd":    ("Direcció mitjana de l'onada", "°", True),
    "pp1d":   ("Període de pic de l'onada", "s", False),
    "mwp":    ("Període mitjà de l'onada", "s", False),
    "shww":   ("Alçada significativa mar de vent", "m", False),
    "mpww":   ("Període mitjà mar de vent", "s", False),
    "shts":   ("Alçada significativa swell total", "m", False),
    "mpts":   ("Període mitjà swell total", "s", False),
    "swdir":  ("Direcció del swell", "°", True),
    "wvdir":  ("Direcció mar de vent", "°", True),
}

VARS_CRITIQUES = ["swh", "mwd", "si10", "wdir10"]

ORDRE_VARS = [
    "swh", "mwd", "pp1d", "mwp",
    "shww", "mpww", "wvdir",
    "shts", "mpts", "swdir",
    "si10", "wdir10",
]


# ═══════════════════ CONNEXIÓ / RUN ═══════════════════

def comprovar_connexio():
    import requests
    print("  Comprovant connexió...", end=" ", flush=True)
    try:
        requests.head("https://meteo.data.gouv.fr", timeout=15)
        print("✓")
        return True
    except requests.exceptions.RequestException as e:
        print("❌")
        print(f"  No es pot connectar: {e}")
        return False


def borrar_antics():
    if not OUTPUT_DIR.exists():
        return
    n = pes = 0
    for f in OUTPUT_DIR.glob("mar_*.json"):
        try:
            pes += f.stat().st_size
            f.unlink()
            n += 1
        except Exception:
            pass
    if n:
        print(f"  ✓ Borrats {n} fitxers ({format_size(pes)} alliberats)")


def descarregar_amb_reintents(fn_descarrega, max_intents=MAX_INTENTS_RUN, descripcio="descàrrega"):
    """
    Embolcall genèric de reintents amb backoff, seguint el mateix esperit
    que obtenir_capabilities_amb_run() de l'script AROME: si la crida
    falla (xarxa, run encara no publicat, GRIB incomplet...), es reintenta
    amb pausa creixent en comptes de fallar a la primera.
    """
    ultim_error = None
    for intent in range(1, max_intents + 1):
        if SHUTDOWN_REQUESTED:
            return None
        print(f"\n  {descripcio} (intent {intent}/{max_intents})...", end=" ", flush=True)
        try:
            resultat = fn_descarrega()
            if resultat is not None:
                print("✓")
                return resultat
            print("❌ (resultat buit)")
        except Exception as e:
            ultim_error = e
            print(f"❌ ({e})")
        if intent < max_intents:
            espera = _backoff(intent, base=PAUSA_ENTRE_INTENTS, cap=30.0)
            time.sleep(espera)
    if ultim_error:
        avisar(f"{descripcio}: tots els intents fallits. Últim error: {ultim_error}")
    else:
        avisar(f"{descripcio}: tots els intents fallits.")
    return None


# ═══════════════════ DESCÀRREGA MFWAM0025 ═══════════════════

def descarregar_mfwam():
    """
    Descarrega el darrer run disponible de MFWAM0025 (paquet SP1, totes les
    variables) via meteofetch, amb reintents. Retorna el dict de DataArrays
    (una clau per variable) o None si falla després de tots els intents.
    """
    from meteofetch import MFWAM0025

    def _intent():
        datasets = MFWAM0025.get_latest_forecast(paquet="SP1")
        if not datasets:
            return None
        return datasets

    return descarregar_amb_reintents(_intent, max_intents=MAX_INTENTS_RUN,
                                      descripcio="Descàrrega MFWAM0025 SP1")


def retallar_a_extent(da, lon_min, lon_max, lat_min, lat_max):
    lat_vals = da.latitude.values
    lat_slice = (
        slice(lat_min, lat_max) if lat_vals[0] < lat_vals[-1] else slice(lat_max, lat_min)
    )
    da_r = da.sel(longitude=slice(lon_min, lon_max), latitude=lat_slice)
    if da_r.sizes.get("latitude", 0) == 0 or da_r.sizes.get("longitude", 0) == 0:
        raise ValueError(f"Retall buit per extent=({lon_min},{lon_max},{lat_min},{lat_max})")
    return da_r


def _es_nat(x):
    """Comprova de forma segura si un valor és NaT/None, sense assumir el tipus."""
    try:
        return bool(np.isnat(np.asarray(x).flatten()[0]))
    except Exception:
        return x is None


def _detectar_run_dt(da_ref, time_dim):
    """
    Determina el run (temps d'inici / reference time) d'una manera robusta:
      1) coordenada "time" del propi dataset, si existeix i és vàlida
      2) atributs GRIB_dataDate + GRIB_dataTime, parsejats correctament
      3) primer valid_time de l'eix temporal
      4) últim recurs: ara mateix (UTC)
    Mai retorna None ni NaT.
    """
    run_dt = None

    # 1) Coordenada "time" (reference time)
    if "time" in da_ref.coords:
        try:
            tval = np.asarray(da_ref.coords["time"].values).flatten()[0]
            if not _es_nat(tval):
                run_dt = tval
        except Exception:
            run_dt = None

    # 2) Atributs GRIB (data + hora), si l'anterior no ha funcionat
    if run_dt is None or _es_nat(run_dt):
        try:
            data_str = str(da_ref.attrs.get("GRIB_dataDate"))
            hora_str = str(da_ref.attrs.get("GRIB_dataTime", 0)).zfill(4)
            run_dt = np.datetime64(datetime.strptime(data_str + hora_str, "%Y%m%d%H%M"))
        except Exception:
            run_dt = None

    # 3) Primer valid_time de l'eix temporal
    if run_dt is None or _es_nat(run_dt):
        try:
            t0 = da_ref[time_dim].values[0]
            if not _es_nat(t0):
                run_dt = t0
            else:
                run_dt = None
        except Exception:
            run_dt = None

    # 4) Últim recurs: ara mateix
    if run_dt is None or _es_nat(run_dt):
        run_dt = np.datetime64(datetime.now(ZoneInfo("UTC")).replace(tzinfo=None))

    return run_dt


def processar_datasets(datasets):
    """
    Retalla totes les variables a l'extent de la costa catalana i les
    reorganitza per hora: {step: {var: {"nombre","unidades","datos"}}}.
    Retorna (resultats_per_step, lats, lons, run_dt, n_steps_disponibles).
    """
    print("\n  ╔══════════════════════════════════════╗")
    print(f"  ║  🌊 Retallant a costa catalana ({len(datasets)} vars)  ║")
    print("  ╚══════════════════════════════════════╝")

    cropped = {}
    time_dim = None
    lats = lons = None
    flip_lat = False
    variables_absents = []

    for var_key in VARS_MAR:
        if var_key not in datasets:
            variables_absents.append(var_key)
            continue
        try:
            da_c = retallar_a_extent(datasets[var_key], LON_MIN, LON_MAX, LAT_MIN, LAT_MAX)
        except ValueError as e:
            avisar(f"{var_key}: {e}")
            continue
        cropped[var_key] = da_c
        if time_dim is None:
            time_dim = "time" if "time" in da_c.dims else "step"
        if lats is None:
            lat_vals = da_c.latitude.values
            lon_vals = da_c.longitude.values
            # Ordenem sempre de nord a sud per consistència amb l'script AROME
            if lat_vals[0] < lat_vals[-1]:
                lats = lat_vals[::-1]
                flip_lat = True
            else:
                lats = lat_vals
                flip_lat = False
            lons = lon_vals

    if variables_absents:
        avisar(f"variables no trobades al SP1: {', '.join(variables_absents)}")

    if not cropped:
        avisar("cap variable s'ha pogut retallar")
        return {}, None, None, None, 0

    # Determinem el run (temps d'inici) de forma robusta (fix NaT/None)
    da_ref = next(iter(cropped.values()))
    run_dt = _detectar_run_dt(da_ref, time_dim)

    # Agafem el MÀXIM de passos disponibles entre totes les variables, no el
    # de la primera: algunes variables (p.ex. si10/wdir10, sovint camps
    # instantanis) poden tenir menys passos que les variables d'onatge
    # pròpies (swh, mwd...), que solen cobrir les 48h senceres. Si
    # agaféssim la primera variable a l'atzar, ens quedaríem limitats al
    # seu nombre de passos encara que la resta en tinguin molts més.
    passos_per_var = {k: da_c.sizes[time_dim] for k, da_c in cropped.items()}
    n_disponibles = max(passos_per_var.values())
    n_steps = min(TOTAL_HORES, n_disponibles)
    print(f"  Hores disponibles: {n_disponibles}. Processant les primeres {n_steps}.")
    vars_curtes = {k: v for k, v in passos_per_var.items() if v < n_disponibles}
    if vars_curtes:
        avisar(f"variables amb menys passos que el màxim: {vars_curtes} "
               f"(quedaran absents a les hores que no cobreixen)")

    nlat, nlon = len(lats), len(lons)
    resultats = {}

    for h in range(n_steps):
        if SHUTDOWN_REQUESTED:
            break
        pas = {}
        for var_key, da_c in cropped.items():
            try:
                da_h = da_c.isel({time_dim: h})
                vals = da_h.values
                if flip_lat:
                    vals = np.flipud(vals)
                if vals.shape != (nlat, nlon):
                    continue
                dades = [round(float(v), 2) if not np.isnan(v) else None for v in vals.flatten()]
                nom, unitat, _ = VARS_MAR[var_key]
                pas[var_key] = {"nombre": nom, "unidades": unitat, "datos": dades}
            except Exception as e:
                avisar(f"{var_key} +{h:02d}h: {e}")
        resultats[h] = pas
        if (h + 1) % 10 == 0 or h == n_steps - 1:
            print(f"    +{h + 1:02d}/{n_steps}h processades")

    lats_r = [round(float(x), 4) for x in lats]
    lons_r = [round(float(x), 4) for x in lons]
    print(f"  ✅ Graella: {nlat}×{nlon} = {nlat * nlon} punts")

    return resultats, lats_r, lons_r, run_dt, n_steps


# ═══════════════════ JSON ═══════════════════

def generar_json(step, variables, run_dt, lats, lons, total_steps):
    if not variables:
        return None
    n = len(lats) * len(lons)
    v_ok = {k: v for k, v in variables.items() if len(v.get("datos", [])) == n}
    if not v_ok:
        return None

    # Conversió robusta de run_dt a datetime "de Python" (fix NaT/None)
    try:
        if isinstance(run_dt, np.datetime64):
            if np.isnat(run_dt):
                raise ValueError("run_dt és NaT")
            run_dt_py = run_dt.astype("datetime64[s]").astype(datetime)
        else:
            run_dt_py = run_dt
        if run_dt_py is None:
            raise ValueError("run_dt_py és None")
    except Exception:
        run_dt_py = datetime.now(ZoneInfo("UTC")).replace(tzinfo=None)

    valid_dt = run_dt_py + timedelta(hours=step)
    madrid = valid_dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Madrid"))

    # Reordenem les variables segons ORDRE_VARS per consistència
    vo = {}
    for k in ORDRE_VARS:
        if k in v_ok:
            vo[k] = v_ok[k]
    for k, v in v_ok.items():
        if k not in vo:
            vo[k] = v

    data = {
        "hora_utc": valid_dt.strftime("%Y-%m-%dT%H:%M"),
        "hora_madrid": madrid.strftime("%Y-%m-%d %H:%M %Z"),
        "run_utc": run_dt_py.strftime("%Y-%m-%dT%H:%M"),
        "step": step,
        "total_steps": total_steps,
        "modelo": "MFWAM0025",
        "coordenadas": {"lat": lats, "lon": lons},
        "variables": vo,
    }
    path = OUTPUT_DIR / f"mar_{step:02d}.json"
    try:
        escriure_json_atomic(path, data)
    except OSError as e:
        avisar(f"no s'ha pogut escriure {path.name}: {e}")
        return None
    kb = os.path.getsize(path) / 1024
    print(f"  mar_{step:02d}.json: {kb:.0f} KB ({len(vo)} vars) | +{step:02d}h | {data['hora_madrid']}")
    return str(path), os.path.getsize(path)


def informe_integritat(steps, resultats):
    print("\n  ╔══════════════════════════════════════╗")
    print("  ║  🔎 INFORME D'INTEGRITAT              ║")
    print("  ╚══════════════════════════════════════╝")
    hores_incompletes = []
    for step in steps:
        d = resultats.get(step, {})
        falten = [v for v in VARS_CRITIQUES if v not in d]
        if falten:
            hores_incompletes.append((step, falten))
    if not hores_incompletes:
        print(f"  ✅ Totes les {len(steps)} hores tenen variables crítiques")
    else:
        print(f"  ⚠️  {len(hores_incompletes)}/{len(steps)} hores amb variables crítiques absents")
        for step, falten in hores_incompletes[:10]:
            print(f"       +{step:02d}h: falten {falten}")
    return [s for s, _ in hores_incompletes]


def generar_status_json(run_dt, steps, resultats, t_inici, fitxers, pes_total, hores_incompletes):
    vars_totals = set()
    for d in resultats.values():
        vars_totals.update(d.keys())

    try:
        if isinstance(run_dt, np.datetime64):
            if np.isnat(run_dt):
                raise ValueError("run_dt és NaT")
            run_dt_py = run_dt.astype("datetime64[s]").astype(datetime)
        else:
            run_dt_py = run_dt
        run_str = run_dt_py.strftime("%Y-%m-%dT%H:%M") if run_dt_py else None
    except Exception:
        run_str = None

    status = {
        "generat": datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "run_utc": run_str,
        "total_hores": len(steps),
        "fitxers": len(fitxers),
        "pes_total_mb": round(pes_total / (1024 * 1024), 2),
        "temps_total_segons": round(time.time() - t_inici),
        "interromput": SHUTDOWN_REQUESTED,
        "variables_totals": len(vars_totals),
        "variables": sorted(vars_totals),
        "integritat": {"hores_amb_variables_critiques_absents": hores_incompletes or []},
        "fonts": {"model": "MFWAM0025", "paquet": "SP1", "origen": "meteofetch"},
        "extent": {"lon_min": LON_MIN, "lon_max": LON_MAX, "lat_min": LAT_MIN, "lat_max": LAT_MAX},
    }
    path = OUTPUT_DIR / "status.json"
    try:
        escriure_json_atomic(path, status)
        print(f"\n  📊 status.json: {format_size(os.path.getsize(path))}")
    except OSError as e:
        print(f"\n  ⚠️  No s'ha pogut escriure status.json: {e}")


# ═══════════════════ MAIN ═══════════════════

def main():
    t0 = time.time()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log_path, fitxer_log = configurar_log()
    exit_code = 0
    resultats = {}
    steps = []
    run_dt = None
    fitxers, pes_total = [], 0

    try:
        print("=" * 65)
        print("  MFWAM0025 48h: onatge + vent marí · costa catalana")
        print("=" * 65)

        try:
            import meteofetch  # noqa: F401
        except ImportError:
            sys.exit("❌ Falta meteofetch (pip install meteofetch)")

        if not comprovar_connexio():
            sys.exit(1)

        borrar_antics()

        datasets = descarregar_mfwam()
        if not datasets:
            sys.exit("❌ Descàrrega MFWAM0025 fallida després de tots els intents")

        print(f"  Variables descarregades: {list(datasets.keys())}")

        resultats, lats, lons, run_dt, n_steps = processar_datasets(datasets)
        if not resultats or lats is None:
            sys.exit("❌ No s'ha pogut processar cap variable")

        steps = list(range(n_steps))

        print("\n  ╔══════════════════════════════════════╗")
        print("  ║  📦 GENERANT JSONs                    ║")
        print("  ╚══════════════════════════════════════╝")

        for step in steps:
            if SHUTDOWN_REQUESTED:
                break
            if step in resultats and resultats[step]:
                res = generar_json(step, resultats[step], run_dt, lats, lons, n_steps)
                if res:
                    fitxers.append(res[0])
                    pes_total += res[1]

        hores_incompletes = informe_integritat(steps, resultats)
        generar_status_json(run_dt, steps, resultats, t0, fitxers, pes_total, hores_incompletes)

        print("\n  ╔══════════════════════════════════════╗")
        estat = "⚠️  INTERROMPUT" if SHUTDOWN_REQUESTED else "✅ FINALITZAT"
        print(f"  ║  {estat}")
        print("  ╠══════════════════════════════════════╣")
        print(f"  ║  Fitxers: {len(fitxers)} (hores: {len(resultats)}/{len(steps)})")
        print(f"  ║  Pes total: {format_size(pes_total)}")
        print(f"  ║  Temps: {format_time(time.time() - t0)}")
        print("  ╚══════════════════════════════════════╝")

        if SHUTDOWN_REQUESTED:
            exit_code = 130
        elif hores_incompletes:
            exit_code = 2

    except SystemExit as e:
        exit_code = e.code if isinstance(e.code, int) else 1
        if steps:
            try:
                hores_incompletes = informe_integritat(steps, resultats)
                generar_status_json(run_dt, steps, resultats, t0, fitxers, pes_total, hores_incompletes)
            except Exception:
                pass
    except Exception as e:
        print(f"\n  ❌ ERROR INESPERAT: {e}")
        traceback.print_exc()
        exit_code = 1
        if steps:
            try:
                hores_incompletes = informe_integritat(steps, resultats)
                generar_status_json(run_dt, steps, resultats, t0, fitxers, pes_total, hores_incompletes)
            except Exception:
                pass
    finally:
        print(f"\n  📝 Log: {log_path}")
        try:
            fitxer_log.close()
        except Exception:
            pass

    sys.exit(exit_code)


if __name__ == "__main__":
    main()