#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
td_3d.py — 3D + SRH/SHEAR + CONVECTIU + SCP + CALAMARSA (part lenta)
═══════════════════════════════════════════════════════════════════════════════════
 3D: meteofetch IP1+IP3 (t, u, v, r, w, dpt, pv per nivells de pressió)
 SRH + SHEAR: SRH 0-1km, 0-3km, Shear 0-3km, Shear 0-6km
 CONVECTIU: LCL, LFC, LI, EL
 🌪️ SCP (Supercell Composite Parameter) + Calamarsa (SHIP ajustat amb w i LFC)
═══════════════════════════════════════════════════════════════════════════════════
 Aquest script és la meitat "lenta" del pipeline original (t_final_blindado.py).
 La part ràpida (SFC meteofetch + WCS) viu a sfc_wcs.py, que es fa córrer com a
 job separat en paral·lel a GitHub Actions perquè IP1+IP3 són GBs de GRIB i
 triguen molt (aquest era el motiu del timeout del runner amb el script únic).

 Genera: 3d_XX.json.gz (XX = step horari, amb variables 3D + convectiu/SCP/calamarsa
 afegits com a variables 2D de superfície dins del mateix fitxer) + status_3d.json.gz

 NOTA: el convectiu/SCP/calamarsa necessiten st/sd/sp/cape de superfície. Com que
 aquest script no descarrega SFC (això ho fa sfc_wcs.py), es demanen aquestes 4
 variables via meteofetch SP1/SP2 només per als steps necessaris (cost petit,
 molt inferior al de IP1/IP3, i evita dependència d'ordre entre els dos scripts).
═══════════════════════════════════════════════════════════════════════════════════
"""

import argparse
import atexit, io, json, logging, os, random, shutil, signal, sys, time, traceback, warnings
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
import requests
import gzip
import xarray as xr
import cfgrib
from requests.adapters import HTTPAdapter

logging.getLogger("cfgrib").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", category=FutureWarning)

def carregar_config():
    d = os.path.dirname(os.path.abspath(__file__))
    path_cfg = os.path.join(d, "configNE.json")
    if not os.path.exists(path_cfg):
        sys.exit(f"❌ No es troba configNE.json a: {path_cfg}")
    try:
        with open(path_cfg, encoding="utf-8-sig") as f:
            cfg = json.load(f)
    except json.JSONDecodeError as e:
        sys.exit(f"❌ config.json té un error de sintaxi JSON: {e}")

    class C: pass
    c = C()
    c.key = cfg.get("api_key", "")
    c.to = cfg.get("http", {}).get("timeout_seconds", 90)
    r = cfg.get("region", {})
    c.la0 = r.get("lat_min", 36.5)
    c.la1 = r.get("lat_max", 44.0)
    c.lo0 = r.get("lon_min", -4.0)
    c.lo1 = r.get("lon_max", 4.5)
    out = cfg.get("output_dir", "../meu-mapa/public/web_data_NE")
    if not os.path.isabs(out):
        out = os.path.join(d, out)
    c.out = out
    return c

CFG = carregar_config()
# Nota: el 3D no crida al WCS, però mantenim la comprovació per si en el futur
# calgués i per detectar secrets mal configurats abans de començar.
if not CFG.key or not CFG.key.strip():
    print("  ⚠️  api_key buida a configNE.json (no es fa servir en aquest script, però es recomana revisar-la).")

JSON_DIR = Path(CFG.out)
LOG_DIR = Path(CFG.out) / "logs"
TMP_DIR = Path(os.environ.get("TEMP", "/tmp")) / "arome_3d"

JSON_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

MAX_REINTENTS = 3
ESPERA_ENTRE_REINTENTS = 2
MAX_REINTENTS_GRIB = 51
MAGIC_GRIB = (b"GRIB",)

def _parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--total-hores", type=int, default=48)
    return p.parse_args()

_ARGS = _parse_args()
TOTAL_HORES = _ARGS.total_hores

SHUTDOWN_REQUESTED = False

def _signal_handler(signum, frame):
    global SHUTDOWN_REQUESTED
    if not SHUTDOWN_REQUESTED:
        print("\n\n  ⚠️  Ctrl+C. Acabant...")
        SHUTDOWN_REQUESTED = True
    else:
        print("\n  ❌ Sortida forçada.")
        os._exit(1)

signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)

def netejar_tmp():
    try:
        if TMP_DIR.exists():
            shutil.rmtree(TMP_DIR, ignore_errors=True)
    except:
        pass

atexit.register(netejar_tmp)


# ═══════════════ VARIABLES METEOFETCH ═══════════════

# Variables SFC mínimes necessàries pel càlcul convectiu (LCL/LFC/LI/EL/SHIP)
SFC_MINIM_CONVECTIU = {
    "st": ("SP1", "2t", "K->C", "Temperatura 2m", "°C"),
    "sd": ("SP2", "2d", "K->C", "Punt rosada 2m", "°C"),
    "cape": ("SP2", "CAPE_INS", 1.0, "CAPE", "J/kg"),
    "sp": ("SP2", "sp", 0.01, "Pressió superf.", "hPa"),
}

NIVELLS_PRESSIO = {1000, 950, 925, 900, 875, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100}
NIVELLS_W = {925, 850, 700, 500, 300}
NIVELLS_PV = {925, 850, 700, 500, 300, 200}

VARS_3D = {
    "t": (NIVELLS_PRESSIO, lambda v: v - 273.15, "Temperatura", "°C"),
    "u": (NIVELLS_PRESSIO, lambda v: v, "Vent U", "m/s"),
    "v": (NIVELLS_PRESSIO, lambda v: v, "Vent V", "m/s"),
    "r": (NIVELLS_PRESSIO, lambda v: v, "Humitat relativa", "%"),
    "w": (NIVELLS_W, lambda v: v, "Velocitat vertical", "Pa/s"),
    "dpt": (NIVELLS_PRESSIO, lambda v: v - 273.15, "Punt rosada", "°C"),
    "pv": (NIVELLS_PV, lambda v: v * 1e6, "Vorticitat potencial", "PVU"),
}

# ═══════════════ UTILITATS ═══════════════

def format_time(s):
    if s < 60: return f"{s:.0f}s"
    elif s < 3600: return f"{int(s // 60)}m {int(s % 60)}s"
    else: return f"{int(s // 3600)}h {int((s % 3600) // 60)}m"

def format_size(b):
    if b < 1024: return f"{b} B"
    elif b < 1024*1024: return f"{b/1024:.1f} KB"
    elif b < 1024*1024*1024: return f"{b/(1024*1024):.1f} MB"
    else: return f"{b/(1024*1024*1024):.2f} GB"

def barra(pct, ample=20):
    fet = int(ample * pct / 100)
    return f"[{'█' * fet}{'░' * (ample - fet)}] {pct:5.1f}%"

def _backoff(intent, base=2.0, cap=30.0):
    return min(cap, base * (2 ** (intent - 1))) + random.uniform(0, 1)

def escriure_json_atomic(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not str(path).endswith('.gz'):
        path = path.with_suffix(path.suffix + '.gz')
    tmp = path.with_name(path.name + ".tmp")
    try:
        with gzip.open(tmp, "wt", encoding="utf-8", compresslevel=9) as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, path)
        return path
    except Exception as e:
        if tmp.exists():
            tmp.unlink()
        raise e

def aplicar_factor(vals, factor):
    return vals - 273.15 if factor == "K->C" else vals * factor

def calcular_steps(run_utc, total_hores):
    return list(range(0, min(total_hores, 52)))

def comprovar_connexio():
    print("  Comprovant connexió...", end=" ", flush=True)
    try:
        requests.head("https://meteofrance-pnt.s3.rbx.io.cloud.ovh.net", timeout=15)
        print("✓")
        return True
    except:
        print("❌")
        print("  No es pot connectar")
        return False

# ═══════════════ DESCÀRREGA GRIB ═══════════════

def descarregar_fitxer_robust(session, url, desti: Path, timeout=(15, 180),
                               max_intents=MAX_REINTENTS_GRIB, min_bytes=1000,
                               magic_bytes=None, acceptar_404=True):
    tmp_path = desti.with_name(desti.name + ".part")
    for intent in range(1, max_intents + 1):
        if SHUTDOWN_REQUESTED:
            return False
        try:
            r = session.get(url, stream=True, timeout=timeout)
            if r.status_code == 404:
                if acceptar_404:
                    return None
                if intent < max_intents:
                    time.sleep(_backoff(intent))
                    continue
                return False
            if r.status_code == 429:
                time.sleep(_backoff(intent, base=8, cap=60))
                continue
            r.raise_for_status()
            bytes_escrits = 0
            desti.parent.mkdir(parents=True, exist_ok=True)
            with open(tmp_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=2*1024*1024):
                    if chunk:
                        f.write(chunk)
                        bytes_escrits += len(chunk)
            if bytes_escrits < min_bytes:
                tmp_path.unlink(missing_ok=True)
                if intent < max_intents:
                    time.sleep(_backoff(intent))
                    continue
                return False
            if magic_bytes is not None:
                with open(tmp_path, "rb") as f:
                    if not any(f.read(8).startswith(m) for m in magic_bytes):
                        tmp_path.unlink(missing_ok=True)
                        if intent < max_intents:
                            time.sleep(_backoff(intent))
                            continue
                        return False
            os.replace(tmp_path, desti)
            return True
        except:
            tmp_path.unlink(missing_ok=True)
            if intent < max_intents:
                time.sleep(_backoff(intent))
            else:
                return False
    return False

# ═══════════════ SELECCIÓ DEL MILLOR RUN ═══════════════

def trobar_millor_run():
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    print("\n  🔍 Buscant el millor run disponible (51 hores)...")
    ara = datetime.utcnow()
    runs_a_provar = []
    for h in range(0, 48, 6):
        dt = ara - timedelta(hours=h)
        dt = dt.replace(minute=0, second=0, microsecond=0)
        hora_run = (dt.hour // 6) * 6
        dt = dt.replace(hour=hora_run)
        runs_a_provar.append(dt)
    runs_a_provar = sorted(set(runs_a_provar), reverse=True)

    for dt in runs_a_provar:
        run_str = dt.strftime("%Y-%m-%dT%H")
        url_test = f"{base_url}/{run_str}:00:00Z/arome/0025/SP1/arome__0025__SP1__49H51H__{run_str}:00:00Z.grib2"
        try:
            resp = requests.head(url_test, timeout=10)
            if resp.status_code == 200:
                print(f"    ✅ Run {run_str}Z: 51 hores OK\n    📌 Seleccionat: {run_str}Z\n")
                return run_str
            else:
                print(f"    ❌ Run {run_str}Z: 49H51H no disponible")
        except:
            print(f"    ⚠️  Run {run_str}Z: error comprovant")

    print(f"    ⚠️  Cap run té 51 hores. Agafant el més recent...")
    for dt in runs_a_provar:
        run_str = dt.strftime("%Y-%m-%dT%H")
        try:
            url_test = f"{base_url}/{run_str}:00:00Z/arome/0025/SP1/arome__0025__SP1__00H06H__{run_str}:00:00Z.grib2"
            if requests.head(url_test, timeout=10).status_code == 200:
                print(f"    ⚠️  Run {run_str}Z seleccionat\n")
                return run_str
        except:
            pass
    sys.exit("❌ Cap run disponible.")

# ═══════════════ SFC MÍNIM (només per al convectiu) ═══════════════

def descarregar_sfc_minim(steps_bloc, run_dt):
    """Descarrega només st/sd/cape/sp (necessàries pel convectiu), no tota la resta de SFC."""
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    date_str = run_dt.strftime("%Y-%m-%dT%H")
    groups = Arome0025.groups_

    print(f"\n  ╔══════════════════════════════════════╗")
    print(f"  ║  📡 SFC mínim per convectiu (4 vars)  ║")
    print("  ╚══════════════════════════════════════╝")

    s_min, s_max = min(steps_bloc), max(steps_bloc)
    grups_ok = []
    for g in groups:
        parts = g.split("H")
        ini = int(parts[0])
        fi = int(parts[1]) if len(parts) > 1 and parts[1] else ini + 6
        if ini <= s_max and fi >= s_min:
            grups_ok.append(g)

    session = requests.Session()
    session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=4))
    resultats = {}
    lats = lons = None
    t0 = time.time()
    total_fitxers = len(grups_ok) * 2
    fitxer_actual = 0

    for grup in grups_ok:
        if SHUTDOWN_REQUESTED:
            break
        for paquet in ["SP1", "SP2"]:
            if SHUTDOWN_REQUESTED:
                break
            fitxer_actual += 1
            pct = fitxer_actual / total_fitxers * 100
            url = f"{base_url}/{date_str}:00:00Z/arome/0025/{paquet}/arome__0025__{paquet}__{grup}__{date_str}:00:00Z.grib2"
            desti = TMP_DIR / f"sfcmin_{paquet}_{grup}.grib2"

            ok = descarregar_fitxer_robust(session, url, desti, timeout=(15, 120), magic_bytes=MAGIC_GRIB, acceptar_404=True)
            if not ok:
                print(f"  [{barra(pct)}] [{grup}] {paquet}: {'404' if ok is None else '❌'}")
                continue

            mb = desti.stat().st_size / (1024 * 1024)
            print(f"  [{barra(pct)}] [{grup}] {paquet}: {mb:.0f}MB", end=" ", flush=True)

            try:
                datasets = cfgrib.open_datasets(str(desti))
            except:
                print("❌")
                desti.unlink(missing_ok=True)
                continue

            vars_trobades = 0
            for ds in datasets:
                for var_name, da in ds.data_vars.items():
                    sn = da.attrs.get("GRIB_shortName", var_name)
                    claus_match = [k for k, (p_ok, sn_cfg, *_) in SFC_MINIM_CONVECTIU.items() if p_ok == paquet and sn_cfg == sn]
                    if not claus_match:
                        continue

                    lat_dim = next((d for d in da.dims if 'lat' in d.lower()), None)
                    lon_dim = next((d for d in da.dims if 'lon' in d.lower()), None)
                    time_dim = next((d for d in da.dims if d.lower() in ("time", "step", "valid_time")), None)
                    if not lat_dim or not lon_dim:
                        continue

                    if lats is None:
                        lats_raw = da[lat_dim].values
                        lons_raw = da[lon_dim].values
                        lat_mask = (lats_raw >= CFG.la0) & (lats_raw <= CFG.la1)
                        lon_mask = (lons_raw >= CFG.lo0) & (lons_raw <= CFG.lo1)
                        lats = lats_raw[lat_mask][::-1]
                        lons = lons_raw[lon_mask]

                    nl, nlo = len(lats), len(lons)

                    for so in range(da.sizes.get(time_dim, 1) if time_dim else 1):
                        da_step = da.isel({time_dim: so}) if (time_dim and time_dim in da.dims) else da
                        try:
                            sr = int(da_step.get('step', so))
                        except:
                            sr = so
                        sa = int(grup.split("H")[0]) + sr
                        if sa not in steps_bloc:
                            continue
                        if sa not in resultats:
                            resultats[sa] = {}

                        da_step_c = da_step.where(
                            (da_step[lat_dim] >= CFG.la0) & (da_step[lat_dim] <= CFG.la1) &
                            (da_step[lon_dim] >= CFG.lo0) & (da_step[lon_dim] <= CFG.lo1), drop=True)
                        vals = np.flipud(da_step_c.values)
                        if vals.shape != (nl, nlo):
                            continue
                        vals = vals.flatten()

                        for clau in claus_match:
                            _, _, factor, nom, unitat = SFC_MINIM_CONVECTIU[clau]
                            vals_conv = aplicar_factor(vals, factor)
                            dades = [round(float(v), 1) if not np.isnan(v) else None for v in vals_conv]
                            resultats[sa][clau] = {"nombre": nom, "unidades": unitat, "datos": dades}
                            vars_trobades += 1
                ds.close()

            desti.unlink(missing_ok=True)
            print(f"✓ ({vars_trobades} vars)", flush=True)

    print(f"  ✅ SFC mínim: {len(resultats)}/{len(steps_bloc)}h en {format_time(time.time() - t0)}")
    return resultats, lats, lons

# ═══════════════ 3D: METEOFETCH ═══════════════

def descarregar_3d(steps_bloc, run_dt):
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    date_str = run_dt.strftime("%Y-%m-%dT%H")
    groups = Arome0025.groups_

    print("\n  ╔══════════════════════════════════════╗")
    print("  ║  📡 3D: IP1+IP3 (meteofetch)        ║")
    print("  ╚══════════════════════════════════════╝")

    s_min, s_max = min(steps_bloc), max(steps_bloc)
    grups_ok = []
    for g in groups:
        parts = g.split("H")
        ini = int(parts[0])
        fi = int(parts[1]) if len(parts) > 1 and parts[1] else ini + 6
        if ini <= s_max and fi >= s_min:
            grups_ok.append(g)

    session = requests.Session()
    session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=4))
    resultats = {}
    lats = lons = None
    total_vars = 0
    t0 = time.time()
    pes_grib = 0
    fallits = []
    total_fitxers = len(grups_ok) * 2
    fitxer_actual = 0

    for paquet in ["IP1", "IP3"]:
        if SHUTDOWN_REQUESTED:
            break
        for grup in grups_ok:
            if SHUTDOWN_REQUESTED:
                break
            fitxer_actual += 1
            pct = fitxer_actual / total_fitxers * 100
            url = f"{base_url}/{date_str}:00:00Z/arome/0025/{paquet}/arome__0025__{paquet}__{grup}__{date_str}:00:00Z.grib2"
            desti = TMP_DIR / f"3d_{paquet}_{grup}.grib2"

            print(f"  [{barra(pct)}] [{paquet}][{grup}] Descarregant...", end=" ", flush=True)

            ok = descarregar_fitxer_robust(session, url, desti, timeout=(15, 180), magic_bytes=MAGIC_GRIB, acceptar_404=True)
            if ok is None:
                print("404")
                continue
            if not ok:
                print("❌")
                fallits.append(f"{paquet}/{grup}")
                continue

            mb = desti.stat().st_size / (1024 * 1024)
            pes_grib += desti.stat().st_size
            print(f"{mb:.0f}MB | Processant...", end=" ", flush=True)

            vars_en_grib = 0
            for var_name, (nivells_set, conv, nom, unitat) in VARS_3D.items():
                try:
                    ds = xr.open_dataset(desti, engine="cfgrib", backend_kwargs={"filter_by_keys": {"shortName": var_name}})
                except:
                    continue
                if var_name not in ds.data_vars:
                    ds.close()
                    continue

                da = ds[var_name]
                lat_dim = next((d for d in da.dims if 'lat' in d.lower()), None)
                lon_dim = next((d for d in da.dims if 'lon' in d.lower()), None)
                time_dim = next((d for d in da.dims if d.lower() in ("time", "step", "valid_time")), None)
                if not lat_dim or not lon_dim:
                    ds.close()
                    continue

                dims_extra = [d for d in da.dims if d not in (lat_dim, lon_dim, time_dim or '')]
                dim_niv = next((d for d in dims_extra if 'isobaric' in d.lower() or 'pressure' in d.lower()), None)
                if dim_niv is None and dims_extra:
                    dim_niv = dims_extra[0]
                if dim_niv is None:
                    ds.close()
                    continue

                if lats is None:
                    lats_raw = da[lat_dim].values
                    lons_raw = da[lon_dim].values
                    lat_mask = (lats_raw >= CFG.la0) & (lats_raw <= CFG.la1)
                    lon_mask = (lons_raw >= CFG.lo0) & (lons_raw <= CFG.lo1)
                    lats = lats_raw[lat_mask][::-1]
                    lons = lons_raw[lon_mask]

                nl, nlo = len(lats), len(lons)

                for so in range(da.sizes.get(time_dim, 1) if time_dim else 1):
                    da_step = da.isel({time_dim: so}) if (time_dim and time_dim in da.dims) else da
                    try:
                        sr = int(da_step.get('step', so))
                    except:
                        sr = so
                    sa = int(grup.split("H")[0]) + sr
                    if sa not in steps_bloc:
                        continue
                    if sa not in resultats:
                        resultats[sa] = {}

                    da_step = da_step.where(
                        (da_step[lat_dim] >= CFG.la0) & (da_step[lat_dim] <= CFG.la1) &
                        (da_step[lon_dim] >= CFG.lo0) & (da_step[lon_dim] <= CFG.lo1), drop=True)

                    for nivell in da_step[dim_niv].values:
                        ni = int(round(float(nivell)))
                        if ni not in nivells_set:
                            continue
                        try:
                            da_niv = da_step.sel({dim_niv: nivell})
                            vals = np.flipud(da_niv.values)
                            if vals.shape != (nl, nlo):
                                continue
                            dades = [round(float(conv(v)), 1) if not np.isnan(v) else None for v in vals.flatten()]
                            resultats[sa][f"{var_name}_{ni}"] = {"nombre": f"{nom} @ {ni}hPa", "unidades": unitat, "datos": dades}
                            total_vars += 1
                            vars_en_grib += 1
                        except:
                            pass
                ds.close()

            desti.unlink(missing_ok=True)
            print(f"✓ ({vars_en_grib} vars)", flush=True)

    print(f"  ✅ 3D: {total_vars} vars en {format_time(time.time() - t0)}")
    print(f"     Pes GRIB: {format_size(pes_grib)}")
    if lats is not None:
        lats = [round(float(x), 4) for x in lats]
        lons = [round(float(x), 4) for x in lons]
        print(f"     Graella: {len(lats)}×{len(lons)} = {len(lats) * len(lons)} punts")
    else:
        print("     ⚠️  No s'ha pogut construir graella 3D")
    if fallits:
        print(f"     ⚠️  Grups fallits: {', '.join(fallits)}")

    return resultats, lats, lons

# ═══════════════ SRH + SHEAR ═══════════════

def pressio_a_alcada_shear(p_hpa):
    T0, p0, lapse, R, g = 288.15, 1013.25, 0.0065, 287.05, 9.80665
    return (T0 / lapse) * (1.0 - (p_hpa / p0) ** (R * lapse / g))

def calcular_srh_i_shear(steps_bloc, td_data, lats_3d, lons_3d):
    print("\n  ╔══════════════════════════════════════╗")
    print("  ║  🌪️  SRH + SHEAR (0-1km, 0-3km, 0-6km) ║")
    print("  ╚══════════════════════════════════════╝")

    shear_data_per_hora = {}
    if not lats_3d or not lons_3d:
        print("  ❌ No hi ha graella 3D")
        return shear_data_per_hora

    nlat, nlon = len(lats_3d), len(lons_3d)
    n_esperat = nlat * nlon
    pressions_disponibles = sorted(NIVELLS_PRESSIO, reverse=True)
    alcades = {p: pressio_a_alcada_shear(p) for p in pressions_disponibles}

    t0 = time.time()
    total_steps = len(steps_bloc)

    for i, step in enumerate(steps_bloc):
        if SHUTDOWN_REQUESTED:
            break
        pct = (i + 1) / total_steps * 100
        sys.stdout.write(f"\r  [{barra(pct)}] Calculant SRH/Shear +{step:02d}h...")
        sys.stdout.flush()

        dades_step = td_data.get(step, {})
        if not dades_step:
            continue

        srh_01 = np.full(n_esperat, np.nan)
        srh_03 = np.full(n_esperat, np.nan)
        shear_03 = np.full(n_esperat, np.nan)
        shear_06 = np.full(n_esperat, np.nan)

        for idx in range(n_esperat):
            nivells_vent = []
            for p in pressions_disponibles:
                ku, kv = f"u_{p}", f"v_{p}"
                if ku in dades_step and kv in dades_step:
                    u_val = dades_step[ku]["datos"][idx]
                    v_val = dades_step[kv]["datos"][idx]
                    if u_val is not None and v_val is not None and not np.isnan(u_val) and not np.isnan(v_val):
                        nivells_vent.append({"z": alcades[p], "u": u_val, "v": v_val, "p": p})

            if len(nivells_vent) < 3:
                continue

            nivells_vent.sort(key=lambda n: n["z"])
            sfc = nivells_vent[0]

            def vent_a_z(z_target):
                for j in range(len(nivells_vent) - 1):
                    a, b = nivells_vent[j], nivells_vent[j + 1]
                    if a["z"] <= z_target <= b["z"]:
                        f = (z_target - a["z"]) / (b["z"] - a["z"]) if b["z"] != a["z"] else 0
                        return {"u": a["u"] + f * (b["u"] - a["u"]), "v": a["v"] + f * (b["v"] - a["v"])}
                return nivells_vent[-1]

            v0 = sfc
            v3km = vent_a_z(3000)
            v6km = vent_a_z(6000)

            def bulk_shear(va, vb):
                du = vb["u"] - va["u"]
                dv = vb["v"] - va["v"]
                return np.sqrt(du * du + dv * dv)

            shear_03[idx] = round(bulk_shear(v0, v3km), 1)
            shear_06[idx] = round(bulk_shear(v0, v6km), 1)

            def vent_mitja(z_bot, z_top):
                su = sv = sw = 0
                for j in range(len(nivells_vent) - 1):
                    a, b = nivells_vent[j], nivells_vent[j + 1]
                    z0, z1 = max(a["z"], z_bot), min(b["z"], z_top)
                    if z1 <= z0:
                        continue
                    f0 = (z0 - a["z"]) / (b["z"] - a["z"]) if b["z"] != a["z"] else 0
                    f1 = (z1 - a["z"]) / (b["z"] - a["z"]) if b["z"] != a["z"] else 0
                    u0, v0_w = a["u"] + f0 * (b["u"] - a["u"]), a["v"] + f0 * (b["v"] - a["v"])
                    u1, v1_w = a["u"] + f1 * (b["u"] - a["u"]), a["v"] + f1 * (b["v"] - a["v"])
                    w = z1 - z0
                    su += 0.5 * (u0 + u1) * w
                    sv += 0.5 * (v0_w + v1_w) * w
                    sw += w
                return v0 if sw == 0 else {"u": su / sw, "v": sv / sw}

            vm06 = vent_mitja(0, 6000)
            du06, dv06 = v6km["u"] - v0["u"], v6km["v"] - v0["v"]
            shear_mag = np.sqrt(du06 * du06 + dv06 * dv06)
            D = 7.5

            if shear_mag > 0.1:
                storm_u = vm06["u"] + D * (dv06 / shear_mag)
                storm_v = vm06["v"] + D * (-du06 / shear_mag)
            else:
                storm_u = vm06["u"]
                storm_v = vm06["v"]

            def calc_srh(z_top, su, sv):
                srh = 0
                for j in range(len(nivells_vent) - 1):
                    a, b = nivells_vent[j], nivells_vent[j + 1]
                    z0, z1 = max(a["z"], 0), min(b["z"], z_top)
                    if z1 <= z0:
                        continue
                    f0 = (z0 - a["z"]) / (b["z"] - a["z"]) if b["z"] != a["z"] else 0
                    f1 = (z1 - a["z"]) / (b["z"] - a["z"]) if b["z"] != a["z"] else 0
                    u0, v0_w = a["u"] + f0 * (b["u"] - a["u"]), a["v"] + f0 * (b["v"] - a["v"])
                    u1, v1_w = a["u"] + f1 * (b["u"] - a["u"]), a["v"] + f1 * (b["v"] - a["v"])
                    srh += (u0 - su) * (v1_w - sv) - (u1 - su) * (v0_w - sv)
                return srh

            srh_01[idx] = round(calc_srh(1000, storm_u, storm_v), 1)
            srh_03[idx] = round(calc_srh(3000, storm_u, storm_v), 1)

        shear_data_per_hora[step] = {
            "srh_01": srh_01, "srh_03": srh_03, "shear_03": shear_03, "shear_06": shear_06
        }

    print()
    print(f"  ✅ SRH + Shear calculats en {format_time(time.time() - t0)}")
    return shear_data_per_hora

# ═══════════════ CONVECTIU ═══════════════

RD, CP, RD_CP, G0, EPS = 287.05, 1004.6, 287.05 / 1004.6, 9.80665, 0.6219707
PLEVS_PERFIL = sorted(NIVELLS_PRESSIO, reverse=True)

def _pressio_a_alcada_estandard(p_hpa):
    T0, p0, lapse = 288.15, 1013.25, 0.0065
    return (T0 / lapse) * (1.0 - (p_hpa / p0) ** (RD * lapse / G0))

def _lcl_bolton(t_c, td_c, p_hpa):
    t_k, td_k = t_c + 273.15, td_c + 273.15
    with np.errstate(invalid="ignore", divide="ignore"):
        t_lcl_k = 1.0 / (1.0 / (td_k - 56.0) + np.log(t_k / td_k) / 800.0) + 56.0
        p_lcl = p_hpa * (t_lcl_k / t_k) ** (1.0 / RD_CP)
    return p_lcl, t_lcl_k - 273.15

def _gradient_humit_aprox(t_c, p_hpa):
    t_k = t_c + 273.15
    es = 6.112 * np.exp(17.67 * t_c / (t_c + 243.5))
    ws = EPS * es / np.maximum(p_hpa - es, 0.1)
    num = 1.0 + (2.5e6 * ws) / (RD * t_k)
    den = 1.0 + (0.622 * (2.5e6 ** 2) * ws) / (CP * RD * t_k ** 2)
    return (RD * t_k) / (CP * p_hpa) * (num / den)

def _perfil_parcela_a_nivell(t_sfc, td_sfc, p_sfc, p_dest):
    p_lcl, t_lcl = _lcl_bolton(t_sfc, td_sfc, p_sfc)
    t_sec = (t_sfc + 273.15) * (p_dest / p_sfc) ** RD_CP - 273.15
    gamma_mig = _gradient_humit_aprox((t_lcl + t_sec) / 2.0, (p_lcl + p_dest) / 2.0)
    t_humit = t_lcl - gamma_mig * (p_lcl - p_dest)
    return np.where(p_dest >= p_lcl, t_sec, t_humit), p_lcl, t_lcl

def interpolar_graelles(arr, n_origen, n_desti):
    if n_origen == n_desti:
        return arr
    factor = n_desti / n_origen
    idx = np.clip(np.floor(np.arange(n_desti) / factor).astype(int), 0, n_origen - 1)
    return arr[idx]

def _mixing_ratio(td_c, p_hpa):
    es = 6.112 * np.exp(17.67 * td_c / (td_c + 243.5))
    w = EPS * es / np.maximum(p_hpa - es, 0.1)
    return w * 1000.0

def calcular_scp(cape_sfc, srh_01, shear_06):
    cape = np.where(np.isnan(cape_sfc), 0.0, np.maximum(cape_sfc, 0.0))
    srh = np.where(np.isnan(srh_01), 0.0, srh_01)
    shear = np.where(np.isnan(shear_06), 0.0, shear_06)
    shear_lim = np.clip(shear, 10.0, 20.0)
    scp = (cape / 1000.0) * (srh / 50.0) * (shear_lim / 20.0)
    scp = np.where(shear < 10.0, scp * (shear / 10.0), scp)
    return np.clip(scp, 0.0, None)

def calcular_ship_ajustat(cape_sfc, T, TD, pl, shear_06, w_dict, lfc_m, n_punts, t_sfc=None, td_sfc=None, p_sfc=None):
    mucape = np.where(np.isnan(cape_sfc), 0.0, np.maximum(cape_sfc, 0.0))
    mucape_ship = np.minimum(mucape, 2000.0)

    i700 = pl.index(700) if 700 in pl else None
    i500 = pl.index(500) if 500 in pl else None

    if i700 is not None:
        mixr_700 = _mixing_ratio(TD[i700], 700.0)
        mixr_700_ship = np.clip(mixr_700, 11.0, 13.6)
    else:
        mixr_700_ship = np.full(n_punts, 12.0)

    if i700 is not None and i500 is not None:
        lapse_700_500 = T[i700] - T[i500]
        lapse_700_500_ship = np.maximum(lapse_700_500, 5.8)
        t_500_ship = np.minimum(T[i500], -5.5)
    else:
        lapse_700_500 = np.full(n_punts, 6.5)
        lapse_700_500_ship = np.full(n_punts, 6.5)
        t_500_ship = np.full(n_punts, -10.0)

    shear_ship = np.clip(np.where(np.isnan(shear_06), 7.0, shear_06), 7.0, 27.0)

    ship = (mucape_ship * mixr_700_ship * lapse_700_500_ship * (-t_500_ship) * shear_ship) / 42_000_000.0
    ship = np.clip(ship, 0.0, None)
    ship = np.where(mucape < 250.0, 0.0, ship)
    ship = np.where(lapse_700_500 < 5.8, ship * 0.2, ship)

    w_vals = [w_dict[f"w_{niv}"] for niv in (500, 300) if f"w_{niv}" in w_dict]
    if w_vals:
        w_mig = np.nanmean(np.array(w_vals), axis=0)
        w_mig = np.where(np.isnan(w_mig), 0.0, w_mig)
        w_asc = np.clip(-w_mig, 0.0, None)
        w_factor = 0.3 + 0.7 * np.clip(w_asc / 6.0, 0.0, 1.0)
    else:
        w_factor = np.full(n_punts, 0.6)

    lfc_safe = np.where(np.isnan(lfc_m), 3500.0, lfc_m)
    lfc_factor = np.interp(lfc_safe, [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000],
                                    [1.5, 1.3, 1.0, 0.7, 0.4, 0.2, 0.08, 0.03, 0.01])

    cin_factor = np.full(n_punts, 0.8)

    if t_sfc is not None and td_sfc is not None and p_sfc is not None:
        try:
            # Versió vectoritzada: en lloc d'un bucle Python punt-a-punt cridant
            # _perfil_parcela_a_nivell amb arrays d'1 element (centenars de milions
            # d'operacions minúscules -> molt lent), calculem la temperatura de la
            # parcel·la per a TOTS els punts alhora, per a cada nivell de pressió
            # de la llista pl (com a molt ~20 crides en lloc de milions).
            t_sfc_flat = np.asarray(t_sfc, dtype=np.float64).reshape(-1)
            td_sfc_flat = np.asarray(td_sfc, dtype=np.float64).reshape(-1)
            p_sfc_flat = np.asarray(p_sfc, dtype=np.float64).reshape(-1)
            lfc_m_flat = np.asarray(lfc_m, dtype=np.float64).reshape(-1)

            vàlid = ~(np.isnan(t_sfc_flat) | np.isnan(td_sfc_flat) | np.isnan(p_sfc_flat)
                      | np.isnan(lfc_m_flat)) & (lfc_m_flat > 0)

            cin_arr = np.full(n_punts, np.nan)

            if np.any(vàlid):
                p_lfc = np.where(vàlid, p_sfc_flat * np.exp(-lfc_m_flat / 8000.0), np.nan)

                pl_arr = np.array(pl, dtype=np.float64)  # nivells de pressió disponibles
                # Temperatura de la parcel·la a cada nivell de pl, per a tots els punts:
                # forma (len(pl), n_punts)
                t_parc_niv = np.full((len(pl), n_punts), np.nan)
                for k, p_niv in enumerate(pl):
                    tp, _, _ = _perfil_parcela_a_nivell(
                        t_sfc_flat, td_sfc_flat, p_sfc_flat, np.full(n_punts, float(p_niv))
                    )
                    t_parc_niv[k] = tp

                # Temperatura ambient ja la tenim a T (forma (len(pl), n_punts))
                delta_t = t_parc_niv - T  # positiu = parcel·la més freda que l'ambient (CIN)

                # Màscara: nivell dins el rang [p_lfc, p_sfc] per a cada punt
                P_col = pl_arr[:, None] * np.ones((1, n_punts))
                dins_rang = (P_col >= p_lfc[None, :]) & (P_col <= p_sfc_flat[None, :]) & vàlid[None, :]

                cin_acum = np.zeros(n_punts)
                compte_valid = np.zeros(n_punts, dtype=np.int64)
                for k in range(len(pl) - 1):
                    p1, p2 = pl_arr[k], pl_arr[k + 1]
                    actiu = dins_rang[k] & dins_rang[k + 1]
                    if not np.any(actiu):
                        continue
                    delta_t_1 = delta_t[k]
                    delta_t_2 = delta_t[k + 1]
                    parells_ok = actiu & ~np.isnan(delta_t_1) & ~np.isnan(delta_t_2)
                    negatiu = parells_ok & ((delta_t_1 < 0) | (delta_t_2 < 0))
                    if not np.any(negatiu):
                        continue
                    delta_t_mitja = (np.minimum(delta_t_1, 0) + np.minimum(delta_t_2, 0)) / 2.0
                    dp = p1 - p2
                    contrib = -RD * delta_t_mitja * (dp / ((p1 + p2) / 2.0))
                    cin_acum = np.where(negatiu, cin_acum + contrib, cin_acum)
                    compte_valid = np.where(parells_ok, compte_valid + 1, compte_valid)

                te_dades = vàlid & (compte_valid >= 1) & (cin_acum > 0)
                cin_arr = np.where(te_dades, cin_acum, np.nan)

            if np.any(~np.isnan(cin_arr)):
                cin_safe = np.where(np.isnan(cin_arr), 50.0, cin_arr)
                cin_safe = np.clip(cin_safe, 0.0, 500.0)
                cin_factor = np.interp(cin_safe, [0, 25, 50, 100, 150, 200, 300, 400, 500],
                                                [1.0, 0.95, 0.85, 0.65, 0.45, 0.3, 0.15, 0.05, 0.01])
        except:
            cin_factor = np.full(n_punts, 0.7)

    ship_ajustat = ship * w_factor * lfc_factor * cin_factor
    mida_cm = np.clip(ship_ajustat * 2.5, 0.0, 10.0)
    return mida_cm

def calcular_convectiu(step, td_data, sfc_step, n_punts_sfc, srh_shear_step):
    if step not in td_data:
        return {}
    d = td_data[step]
    if not all(k in sfc_step for k in ["st", "sd", "sp"]):
        return {}

    t_sfc = np.where(np.isfinite(np.array(sfc_step["st"]["datos"], dtype=np.float64)),
                     np.array(sfc_step["st"]["datos"], dtype=np.float64), np.nan)
    td_sfc = np.where(np.isfinite(np.array(sfc_step["sd"]["datos"], dtype=np.float64)),
                      np.array(sfc_step["sd"]["datos"], dtype=np.float64), np.nan)
    p_sfc = np.where(np.isfinite(np.array(sfc_step["sp"]["datos"], dtype=np.float64)),
                     np.array(sfc_step["sp"]["datos"], dtype=np.float64), np.nan)
    mask = ~(np.isnan(t_sfc) | np.isnan(td_sfc) | np.isnan(p_sfc))

    if not np.any(mask):
        return {}

    pt, ptd, pl = [], [], []
    for n in PLEVS_PERFIL:
        kt, kd = f"t_{n}", f"dpt_{n}"
        if kt in d and kd in d:
            pt.append(np.array(d[kt]["datos"], dtype=np.float64))
            ptd.append(np.array(d[kd]["datos"], dtype=np.float64))
            pl.append(n)

    if len(pl) < 3:
        return {}

    T = np.array(pt)
    TD = np.array(ptd)
    n3 = T.shape[1]

    if n_punts_sfc != n3:
        t_sfc = interpolar_graelles(t_sfc, n_punts_sfc, n3)
        td_sfc = interpolar_graelles(td_sfc, n_punts_sfc, n3)
        p_sfc = interpolar_graelles(p_sfc, n_punts_sfc, n3)
        mask = ~(np.isnan(t_sfc) | np.isnan(td_sfc) | np.isnan(p_sfc))
        n_punts = n3
    else:
        n_punts = n_punts_sfc

    P = np.array(pl, dtype=np.float64)[:, None] * np.ones((1, n_punts))
    T = np.where(P >= p_sfc[None, :], np.nan, T)

    p_lcl, _ = _lcl_bolton(t_sfc, td_sfc, p_sfc)
    p_lcl = np.where(mask, p_lcl, np.nan)
    lcl_m = _pressio_a_alcada_estandard(p_lcl)

    li = np.full(n_punts, np.nan)
    if 500 in pl:
        i500 = pl.index(500)
        tp, _, _ = _perfil_parcela_a_nivell(t_sfc, td_sfc, p_sfc, np.full(n_punts, 500.0))
        li = np.where(mask & ~np.isnan(T[i500]), T[i500] - tp, np.nan)

    tpn = np.full((len(pl), n_punts), np.nan)
    for k, n in enumerate(pl):
        tpn[k], _, _ = _perfil_parcela_a_nivell(t_sfc, td_sfc, p_sfc, np.full(n_punts, float(n)))

    psl = P < p_lcl[None, :]
    dv = np.where(psl & ~np.isnan(T), tpn - T, np.nan)
    an = _pressio_a_alcada_estandard(P[:, 0])

    lfc_m = np.full(n_punts, np.nan)
    el_m = np.full(n_punts, np.nan)

    for i in range(n_punts):
        if not bool(mask[i]):
            continue
        ix = np.where(psl[:, i] & ~np.isnan(dv[:, i]))[0]
        if len(ix) < 2:
            continue
        ds = dv[ix, i]
        al = an[ix]
        ps = np.where(ds > 0)[0]
        if len(ps) == 0:
            continue
        tr = []
        for j in range(int(ps[0]), len(ds)):
            if float(ds[j]) > 0:
                tr.append(float(al[j]))
            else:
                break
        if len(tr) < 2 or (tr[-1] - tr[0]) < 1000:
            continue
        lfc_m[i] = tr[0]
        el_m[i] = tr[-1]

    scp_arr = None
    hail_arr = None

    if srh_shear_step is not None:
        w_dict = {}
        for niv in (500, 300):
            k = f"w_{niv}"
            if k in d:
                w_dict[k] = np.array(d[k]["datos"], dtype=np.float64)

        cape_arr = np.array(sfc_step["cape"]["datos"], dtype=np.float64) if "cape" in sfc_step else np.full(n_punts_sfc, np.nan)
        cape_arr_n3 = interpolar_graelles(cape_arr, n_punts_sfc, n3) if n_punts_sfc != n3 else cape_arr
        srh_01_n3 = srh_shear_step["srh_01"]
        shear_06_n3 = srh_shear_step["shear_06"]
        lfc_m_n3 = lfc_m

        scp_arr = calcular_scp(cape_arr_n3, srh_01_n3, shear_06_n3)
        hail_arr = calcular_ship_ajustat(cape_arr_n3, T, TD, pl, shear_06_n3, w_dict, lfc_m_n3, n3, t_sfc, td_sfc, p_sfc)

        if n_punts_sfc != n3:
            scp_arr = interpolar_graelles(scp_arr, n3, n_punts_sfc)
            hail_arr = interpolar_graelles(hail_arr, n3, n_punts_sfc)

    lcl_m_out = interpolar_graelles(lcl_m, n3, n_punts_sfc) if n_punts_sfc != n3 else lcl_m
    lfc_m_out = interpolar_graelles(lfc_m, n3, n_punts_sfc) if n_punts_sfc != n3 else lfc_m
    li_out = interpolar_graelles(li, n3, n_punts_sfc) if n_punts_sfc != n3 else li
    el_m_out = interpolar_graelles(el_m, n3, n_punts_sfc) if n_punts_sfc != n3 else el_m

    r = {}
    if np.any(~np.isnan(lcl_m_out)):
        r["lcl_m"] = {"nombre": "LCL (alçada)", "unidades": "m",
                      "datos": [round(float(v), 0) if not np.isnan(v) else None for v in lcl_m_out]}
    if np.any(~np.isnan(lfc_m_out)):
        r["lfc_m"] = {"nombre": "LFC (alçada)", "unidades": "m",
                      "datos": [round(float(v), 0) if not np.isnan(v) else None for v in lfc_m_out]}
    if np.any(~np.isnan(li_out)):
        r["lifted_index"] = {"nombre": "Lifted Index", "unidades": "°C",
                             "datos": [round(float(v), 1) if not np.isnan(v) else None for v in li_out]}
    if np.any(~np.isnan(el_m_out)):
        r["el_m"] = {"nombre": "Equilibrium Level", "unidades": "m",
                     "datos": [round(float(v), 0) if not np.isnan(v) else None for v in el_m_out]}
    if scp_arr is not None and np.any(~np.isnan(scp_arr)):
        r["scp"] = {"nombre": "Risc supercèl·lula (Nostre)", "unidades": "adim.",
                    "datos": [round(float(v), 2) if not np.isnan(v) else None for v in scp_arr]}
    if hail_arr is not None and np.any(~np.isnan(hail_arr)):
        r["hail_cm"] = {"nombre": "Mida potencial de Calamarsa", "unidades": "cm",
                        "datos": [round(float(v), 2) if not np.isnan(v) else None for v in hail_arr]}

    return r

# ═══════════════ JSON ═══════════════

def generar_json(step, variables, run_date, lats, lons, prefix, total_steps):
    if not variables:
        return None
    n = len(lats) * len(lons)
    v_ok = {k: v for k, v in variables.items() if len(v.get("datos", [])) == n}
    if not v_ok:
        return None

    run_dt = datetime.fromisoformat(str(run_date).replace('+00:00', ''))
    valid_dt = run_dt + timedelta(hours=step)
    madrid = valid_dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Madrid"))

    data = {
        "hora_utc": valid_dt.strftime("%Y-%m-%dT%H:%M"),
        "hora_madrid": madrid.strftime("%Y-%m-%d %H:%M %Z"),
        "run_utc": run_dt.strftime("%Y-%m-%dT%H:%M"),
        "step": step,
        "total_steps": total_steps,
        "modelo": "AROME0025",
        "coordenadas": {"lat": lats, "lon": lons},
        "variables": v_ok
    }

    path = JSON_DIR / f"{prefix}_{step:02d}.json.gz"
    try:
        path_escrit = escriure_json_atomic(path, data)
        if path_escrit is None:
            return None
        kb = os.path.getsize(path_escrit) / 1024
        print(f"  {prefix}_{step:02d}.json.gz: {kb:.0f} KB ({len(v_ok)} vars) | +{step:02d}h | {data['hora_madrid']}")
        return str(path_escrit), os.path.getsize(path_escrit)
    except Exception as e:
        print(f"    ⚠️  No s'ha pogut escriure {path.name}: {e}")
        return None

def informe_integritat(steps_bloc, td_data):
    print("\n  ╔══════════════════════════════════════╗")
    print("  ║  🔎 INFORME D'INTEGRITAT              ║")
    print("  ╚══════════════════════════════════════╝")

    hores_3d_faltants = [s for s in steps_bloc if not td_data.get(s)]

    if not hores_3d_faltants:
        print(f"  ✅ Totes les {len(steps_bloc)} hores 3D generades")
    else:
        print(f"  ⚠️  {len(hores_3d_faltants)}/{len(steps_bloc)} hores 3D absents")

    return hores_3d_faltants

def generar_status_json(run_mf, steps_bloc, td_data, t_inici, fitxers, pes_total, hores_3d_faltants=None):
    status = {
        "generat": datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "run_meteofetch": run_mf,
        "total_hores": len(steps_bloc),
        "fitxers": len(fitxers),
        "3d_fitxers": len(td_data),
        "pes_total_mb": round(pes_total / (1024 * 1024), 1),
        "temps_total_segons": round(time.time() - t_inici),
        "interromput": SHUTDOWN_REQUESTED,
        "integritat": {
            "hores_3d_absents": hores_3d_faltants or []
        },
        "fonts": {
            "3d": "meteofetch",
            "convectiu": "calculat_local",
            "shear": "calculat_local",
            "supercelula_scp": "calculat_local_SCP_estandard",
            "calamarsa_ship": "calculat_local_SHIP_ajustat_w_lfc",
        },
        "nota": "SFC complet + WCS es generen a sfc_wcs.py (script separat)."
    }

    path = JSON_DIR / "status_3d.json.gz"
    try:
        path_escrit = escriure_json_atomic(path, status)
        if path_escrit:
            print(f"\n  📊 status_3d.json.gz: {format_size(os.path.getsize(path_escrit))}")
    except OSError as e:
        print(f"\n  ⚠️  No s'ha pogut escriure status_3d.json: {e}")

# ═══════════════ MAIN ═══════════════
def main():
    global SHUTDOWN_REQUESTED
    t0 = time.time()

    JSON_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    try:
        print("=" * 70)
        print("  AROME 51h: 3D + SRH/SHEAR + Convectiu + SCP/STP + Calamarsa")
        print(f"  JSONs: {JSON_DIR}")
        print("=" * 70)

        

        try:
            import meteofetch
        except ImportError:
            sys.exit("❌ Falta meteofetch")

        if not comprovar_connexio():
            sys.exit(1)

        run_mf = trobar_millor_run()
        run_dt_mf = datetime.strptime(run_mf + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
        steps_bloc = calcular_steps(run_dt_mf, TOTAL_HORES)

        madrid_mf = run_dt_mf.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Madrid"))
        print(f"  ✅ Run: {run_mf}Z = {madrid_mf.strftime('%d/%m %H:%M %Z')}")
        print(f"  Steps: +{steps_bloc[0]}h a +{steps_bloc[-1]}h ({len(steps_bloc)} hores)")

        # ═══ 3D METEOFETCH (part pesada) ═══
        td_data, lats_3d, lons_3d = descarregar_3d(steps_bloc, run_dt_mf)

        if SHUTDOWN_REQUESTED:
            print("\n  ⚠️  Interromput.")
            sys.exit(130)

        # ═══ SRH + SHEAR ═══
        shear_data_per_hora = calcular_srh_i_shear(steps_bloc, td_data, lats_3d, lons_3d)

        # ═══ SFC mínim per al convectiu (petit, ràpid) ═══
        sfc_min, lats_sfc, lons_sfc = descarregar_sfc_minim(steps_bloc, run_dt_mf)
        # Normalitzem a llistes Python (descarregar_sfc_minim retorna arrays de numpy,
        # i "if array:" amb més d'un element peta amb ValueError d'ambigüitat).
        if lats_sfc is not None:
            lats_sfc = [round(float(x), 4) for x in lats_sfc]
        if lons_sfc is not None:
            lons_sfc = [round(float(x), 4) for x in lons_sfc]

        # ═══ CONVECTIU + SCP + STP + CALAMARSA ═══
        extra_per_step = {}
        if lats_sfc is not None and len(lats_sfc) > 0 and td_data:
            print("\n  ╔══════════════════════════════════════╗")
            print("  ║  🌡️  Convectiu + SCP + STP + Calamarsa ║")
            print("  ╚══════════════════════════════════════╝")
            n_punts_sfc = len(lats_sfc) * len(lons_sfc)
            n_ok = 0
            for step in steps_bloc:
                if step not in sfc_min or step not in td_data:
                    continue
                try:
                    srh_shear_step = shear_data_per_hora.get(step)
                    cv = calcular_convectiu(step, td_data, sfc_min[step], n_punts_sfc, srh_shear_step)
                    if cv:
                        extra_per_step[step] = cv
                        n_ok += 1
                except Exception as e:
                    print(f"    ⚠️  convectiu +{step:02d}h: {e}")
            print(f"  ✅ {n_ok}/{len(steps_bloc)} hores")
        else:
            print("\n  ⚠️  Sense SFC mínim o sense 3D: es descarta el convectiu/SCP/calamarsa d'aquesta execució.")

        # ═══ COMBINAR: 3D + SRH/Shear (com a variables addicionals a la graella 3D) + convectiu ═══
        # Nota: SRH/Shear i el convectiu es calculen sobre la graella SFC (lats_sfc/lons_sfc),
        # que pot no coincidir en mida amb la graella 3D. Es desen com a bloc apart dins
        # del mateix fitxer 3d_XX.json.gz, sota "variables", interpolats/alineats a n_punts_sfc
        # quan calgui (calcular_convectiu ja retorna a mida n_punts_sfc).
        for step in steps_bloc:
            if step not in td_data:
                td_data[step] = {}

            if step in shear_data_per_hora and lats_sfc is not None and len(lats_sfc) > 0:
                shear = shear_data_per_hora[step]
                n_punts_sfc = len(lats_sfc) * len(lons_sfc)
                for k, nom, u in [("srh_01", "SRH 0-1km", "m²/s²"),
                                  ("srh_03", "SRH 0-3km", "m²/s²"),
                                  ("shear_03", "Shear 0-3km", "m/s"),
                                  ("shear_06", "Shear 0-6km", "m/s")]:
                    arr = shear.get(k)
                    if arr is None:
                        continue
                    arr = np.asarray(arr, dtype=np.float64).reshape(-1)
                    if int(np.sum(~np.isnan(arr))) > 100 and len(arr) == n_punts_sfc:
                        td_data[step][f"_sfcgrid_{k}"] = {
                            "nombre": nom, "unidades": u,
                            "datos": [round(float(v), 1) if not np.isnan(v) else None for v in arr]
                        }

            if step in extra_per_step:
                for k, v in extra_per_step[step].items():
                    td_data[step][f"_sfcgrid_{k}"] = v

        # ═══ GENERAR JSONs ═══
        print("\n  ╔══════════════════════════════════════╗")
        print("  ║  📦 GENERANT JSONs                   ║")
        print("  ╚══════════════════════════════════════╝")

        ts = len(steps_bloc)
        fitxers = []
        pes_total = 0

        for step in steps_bloc:
            if step in td_data and td_data[step] and lats_3d:
                res = generar_json(step, td_data[step], run_dt_mf, lats_3d, lons_3d, "3d", ts)
                if res:
                    fitxers.append(res[0])
                    pes_total += res[1]

        # ═══ INFORME FINAL ═══
        hores_3d_faltants = informe_integritat(steps_bloc, td_data)
        generar_status_json(run_mf, steps_bloc, td_data, t0, fitxers, pes_total, hores_3d_faltants)

        print("\n  ╔══════════════════════════════════════╗")
        estat = "⚠️  INTERROMPUT" if SHUTDOWN_REQUESTED else "✅ FINALITZAT"
        print(f"  ║  {estat}")
        print(f"  ║  Fitxers: {len(fitxers)} | 3D: {len(td_data)}/{ts}")
        print(f"  ║  Temps: {format_time(time.time() - t0)}")
        print("  ╚══════════════════════════════════════╝")

        if SHUTDOWN_REQUESTED:
            sys.exit(130)
        elif hores_3d_faltants:
            sys.exit(2)

    except SystemExit as e:
        sys.exit(e.code if isinstance(e.code, int) else 1)
    except KeyboardInterrupt:
        print("\n  ⚠️  Interromput per l'usuari")
        sys.exit(130)
    except Exception as e:
        print(f"\n  ❌ ERROR: {e}")
        traceback.print_exc()
        sys.exit(1)
    finally:
        netejar_tmp()

if __name__ == "__main__":
    main()