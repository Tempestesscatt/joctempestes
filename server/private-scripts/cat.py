"""
t_final_blindado.py — VERSIÓ FINAL COMPLETA · 51 HORES · WCS INTERPOLAT · RUN INTEL·LIGENT
═══════════════════════════════════════════════════════════════════════════════
 SFC: meteofetch SP1+SP2 (19 vars, ràpid, sense API key)
 3D: meteofetch IP1+IP3 (pressió, vent, humitat, etc.)
 WCS: 4 vars (reflectivity_dbz, rain PT1H, lightning PT1H, precip_water)
      → interpolades a la graella de meteofetch
 Convectiu: LCL, LFC, LI, EL (calculat en local)

 RUN INTEL·LIGENT: millor run per cada font
 STATUS.JSON: metadades dels runs utilitzats + informe d'integritat

 ══════════════ BLINDATGE AFEGIT EN AQUESTA VERSIÓ ══════════════
  • Descàrregues GRIB/TIFF verificades: mida (Content-Length) + capçalera
    binària (magic bytes) abans de donar-les per bones. Res de fitxers
    truncats o corruptes passant per bons.
  • Reintents amb backoff exponencial + jitter (no espera fixa "a cegues").
  • Escriptura ATÒMICA de tots els JSON (escriu a .tmp i fa os.replace):
    si el procés es talla a mitges, mai queda un .json corrupte/parcial.
  • Comprovació de connexió abans de començar (falla ràpid i clar).
  • Validació estricta de config.json (avisa exactament què falta).
  • Gestió de Ctrl+C / SIGTERM: acaba la petició en curs, desa tot el que
    ja s'ha descarregat i genera status.json igualment (mai es perd feina).
  • Log complet a fitxer (a més de consola) per poder auditar què ha passat.
  • Informe d'integritat final: quines hores/variables falten, explícit.
  • Neteja garantida de fitxers temporals (atexit + finally), també si
    l'execució anterior va petar a mitges.
  • Bug corregit: graella 3D podia quedar indefinida si no es baixava cap
    dada (NameError silenciós a l'informe final).
═══════════════════════════════════════════════════════════════════════════════
"""

import atexit
import io
import json
import logging
import os
import random
import re
import shutil
import signal
import sys
import time
import traceback
import warnings
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import requests
import tifffile
import xarray as xr
import cfgrib
import xml.etree.ElementTree as ET
from scipy.interpolate import RegularGridInterpolator
from requests.adapters import HTTPAdapter

logging.getLogger("cfgrib").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", category=FutureWarning)

# ═══════════════════ CONFIG ═══════════════════

def carregar_config():
    d = os.path.dirname(os.path.abspath(__file__))
    path_cfg = os.path.join(d, "config.json")

    if not os.path.exists(path_cfg):
        sys.exit(f"❌ No es troba config.json a: {path_cfg}")

    try:
        with open(path_cfg, encoding="utf-8") as f:
            cfg = json.load(f)
    except json.JSONDecodeError as e:
        sys.exit(f"❌ config.json té un error de sintaxi JSON: {e}")

    requerits = {
        "api_key": None,
        "arome": ["api_base", "service_0025"],
        "http": ["timeout_seconds"],
        "region": ["lat_min", "lat_max", "lon_min", "lon_max"],
        "output_dir": None,
    }
    for clau, subclaus in requerits.items():
        if clau not in cfg:
            sys.exit(f"❌ Falta la clau obligatòria '{clau}' a config.json")
        if subclaus:
            for sc in subclaus:
                if sc not in cfg[clau]:
                    sys.exit(f"❌ Falta la clau obligatòria '{clau}.{sc}' a config.json")

    class C:
        pass

    c = C()
    c.key = cfg["api_key"]
    c.base = cfg["arome"]["api_base"]
    c.svc = cfg["arome"]["service_0025"]
    c.to = cfg["http"]["timeout_seconds"]
    r = cfg["region"]
    c.la0, c.la1, c.lo0, c.lo1 = r["lat_min"], r["lat_max"], r["lon_min"], r["lon_max"]

    if c.la0 >= c.la1 or c.lo0 >= c.lo1:
        sys.exit("❌ Regió invàlida a config.json: lat_min/lon_min han de ser menors que lat_max/lon_max")
    if not c.key or not isinstance(c.key, str):
        sys.exit("❌ api_key buida o invàlida a config.json")

    c.out = os.path.join(d, cfg["output_dir"])
    return c


CFG = carregar_config()
TOTAL_HORES = 51
PAUSA_WCS = 0.15            # pausa entre peticions
PAUSA_CADA_10 = 5.0         # pausa cada 10 peticions (segons)
MAX_REINTENTS_WCS = 5
MAX_REINTENTS_GRIB = 5
OUTPUT_DIR = Path(CFG.out)
TMP_DIR = Path(os.environ.get("TEMP", "/tmp")) / "arome_final"

URL_GRIB = "{b}/{d}:00:00Z/arome/0025/{p}/arome__0025__{p}__{g}__{d}:00:00Z.grib2"

MAGIC_GRIB = (b"GRIB",)
MAGIC_TIFF = (b"II*\x00", b"MM\x00*")

# ═══════════════════ ESTAT GLOBAL PER APAGAT NET ═══════════════════

SHUTDOWN_REQUESTED = False


def _signal_handler(signum, frame):
    global SHUTDOWN_REQUESTED
    if not SHUTDOWN_REQUESTED:
        print("\n\n  ⚠️  Senyal d'interrupció rebuda (Ctrl+C). Acabant la petició en curs i")
        print("      desant tot el que ja s'hagi descarregat... (Ctrl+C un altre cop força sortida)")
        SHUTDOWN_REQUESTED = True
    else:
        print("\n  ❌ Sortida forçada per l'usuari.")
        os._exit(1)


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


def netejar_tmp():
    try:
        if TMP_DIR.exists():
            shutil.rmtree(TMP_DIR, ignore_errors=True)
    except Exception:
        pass


atexit.register(netejar_tmp)

# ═══════════════════ LOG A FITXER + CONSOLA ═══════════════════

class Tee:
    """Duplica l'escriptura cap a diversos streams (consola + fitxer log)."""

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


# ═══════════════════ SFC per meteofetch (SP1+SP2) ═══════════════════

SFC_METEOFETCH = {
    "st":           ("SP1", "2t",       "K->C", "Temperatura 2m", "°C"),
    "srh":          ("SP1", "2r",       1.0,    "Humitat 2m", "%"),
    "su":           ("SP1", "10u",      1.0,    "Vent U 10m", "m/s"),
    "sv":           ("SP1", "10v",      1.0,    "Vent V 10m", "m/s"),
    "wind_gust":    ("SP1", "10fg",     3.6,    "Ratxa 10m", "km/h"),
    "pressure_msl": ("SP1", "prmsl",    0.01,   "Pressió MSL", "hPa"),
    "tp":           ("SP1", "tp",       1.0,    "Precip. total acum.", "mm"),
    "tgrp":         ("SP1", "tgrp",     1.0,    "Calamarsa acum.", "mm"),
    "tsnowp":       ("SP1", "tsnowp",   1.0,    "Neu acum.", "mm"),
    "sd":           ("SP2", "2d",       "K->C", "Punt rosada 2m", "°C"),
    "sh2":          ("SP2", "2sh",      1.0,    "Humitat esp. 2m", "kg/kg"),
    "cape":         ("SP2", "CAPE_INS", 1.0,    "CAPE", "J/kg"),
    "spbl":         ("SP2", "blh",      1.0,    "Capa límit", "m"),
    "high_cloud_cover":   ("SP2", "hcc", 1.0,   "Nuvols alts", "%"),
    "low_cloud_cover":    ("SP2", "lcc", 1.0,   "Nuvols baixos", "%"),
    "medium_cloud_cover": ("SP2", "mcc", 1.0,   "Nuvols mitjans", "%"),
    "temp_min2m":   ("SP2", "mn2t",     "K->C", "Temp. mín. 2m", "°C"),
    "temp_max2m":   ("SP2", "mx2t",     "K->C", "Temp. màx. 2m", "°C"),
    "sp":           ("SP2", "sp",       0.01,   "Pressió superf.", "hPa"),
}

# Variables SFC considerades imprescindibles per donar una hora per "completa"
SFC_VARS_CRITIQUES = ["st", "srh", "su", "sv", "pressure_msl", "cape"]

SFC_WCS = {
    "reflectivity_dbz": ("REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE", None, 1.0, None, "Reflectivitat", "dBZ"),
    "rain":             ("TOTAL_WATER_PRECIPITATION__GROUND_OR_WATER_SURFACE", None, 1.0, "PT1H", "Pluja 1h", "mm"),
    "lightning":        ("LIGHTNING_STRIKE_DENSITY_CUMULATED__GROUND_OR_WATER_SURFACE", None, 1.0, "PT1H", "Llamps 1h", "impactes/m²"),
    "precip_water":     ("PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE", None, 1.0, None, "Aigua precipitable", "mm"),
}

# ═══════════════════ 3D meteofetch ═══════════════════

NIVELLS_PRESSIO = {1000, 950, 925, 900, 875, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100}
NIVELLS_W = {925, 850, 700, 500, 300}
NIVELLS_PV = {925, 850, 700, 500, 300, 200}

VARS_3D = {
    "t":   (NIVELLS_PRESSIO, lambda v: v - 273.15, "Temperatura", "°C"),
    "u":   (NIVELLS_PRESSIO, lambda v: v, "Vent U", "m/s"),
    "v":   (NIVELLS_PRESSIO, lambda v: v, "Vent V", "m/s"),
    "r":   (NIVELLS_PRESSIO, lambda v: v, "Humitat relativa", "%"),
    "w":   (NIVELLS_W, lambda v: v, "Velocitat vertical", "Pa/s"),
    "dpt": (NIVELLS_PRESSIO, lambda v: v - 273.15, "Punt rosada", "°C"),
    "pv":  (NIVELLS_PV, lambda v: v * 1e6, "Vorticitat potencial", "PVU"),
}

# ═══════════════════ UTILITATS ═══════════════════

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


def calcular_steps(run_utc, total_hores):
    ara = datetime.now(ZoneInfo("Europe/Madrid")).astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    run_naive = run_utc.replace(tzinfo=None) if run_utc.tzinfo else run_utc
    inici = max(0, int((ara - run_naive).total_seconds() / 3600))
    # El model només té 52 hores (índexs 0 a 51)
    fi = min(inici + total_hores, 52)
    return list(range(inici, fi))

def borrar_antics():
    if not OUTPUT_DIR.exists():
        return
    n = 0
    pes = 0
    for p in ["sfc_*.json", "3d_*.json"]:
        for f in OUTPUT_DIR.glob(p):
            try:
                pes += f.stat().st_size
                f.unlink()
                n += 1
            except Exception:
                pass
    if n:
        print(f"  ✓ Borrats {n} fitxers ({format_size(pes)} alliberats)")


def comprovar_connexio():
    """Comprova que hi ha connexió a l'API abans de començar res."""
    print("  Comprovant connexió...", end=" ", flush=True)
    try:
        requests.head(CFG.base, timeout=15)
        print("✓")
        return True
    except requests.exceptions.RequestException as e:
        print("❌")
        print(f"  No es pot connectar a {CFG.base}: {e}")
        print("  Comprova la connexió a internet i que l'adreça de l'API sigui correcta.")
        return False


def _backoff(intent, base=2.0, cap=30.0):
    """Backoff exponencial amb jitter perquè els reintents no col·lisionin."""
    return min(cap, base * (2 ** (intent - 1))) + random.uniform(0, 1)


def escriure_json_atomic(path: Path, data):
    """Escriu JSON de forma atòmica: mai deixa un fitxer a mitges si es talla el procés."""
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def descarregar_fitxer_robust(session, url, desti: Path, timeout=(15, 180),
                               max_intents=MAX_REINTENTS_GRIB, min_bytes=1000,
                               magic_bytes=None, acceptar_404=True):
    """
    Descàrrega robusta a fitxer:
      - backoff exponencial + jitter en cada reintent
      - verifica que els bytes escrits coincideixen amb Content-Length
      - verifica la capçalera binària (magic bytes) del fitxer resultant
      - escriu sempre a un .part i només el "publica" si tot quadra
    Retorna: True (ok), False (ha fallat després de tots els intents),
             None (404 i s'ha marcat com a acceptable)
    """
    tmp_path = desti.with_name(desti.name + ".part")
    for intent in range(1, max_intents + 1):
        if SHUTDOWN_REQUESTED:
            return False
        try:
            r = session.get(url, stream=True, timeout=timeout)

            if r.status_code == 404:
                if acceptar_404:
                    return None
                avisar(f"404 (intent {intent}/{max_intents}): {url}")
                if intent < max_intents:
                    time.sleep(_backoff(intent))
                    continue
                return False

            if r.status_code == 429:
                espera = _backoff(intent, base=8, cap=60)
                avisar(f"429 rate-limit, esperant {espera:.0f}s...")
                time.sleep(espera)
                continue

            r.raise_for_status()

            content_length = r.headers.get("Content-Length")
            bytes_escrits = 0
            desti.parent.mkdir(parents=True, exist_ok=True)
            with open(tmp_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=2 * 1024 * 1024):
                    if chunk:
                        f.write(chunk)
                        bytes_escrits += len(chunk)

            if content_length is not None and int(content_length) != bytes_escrits:
                avisar(f"mida incorrecta ({bytes_escrits}/{content_length} B), reintentant...")
                tmp_path.unlink(missing_ok=True)
                if intent < max_intents:
                    time.sleep(_backoff(intent))
                    continue
                return False

            if bytes_escrits < min_bytes:
                avisar(f"fitxer massa petit ({bytes_escrits} B), reintentant...")
                tmp_path.unlink(missing_ok=True)
                if intent < max_intents:
                    time.sleep(_backoff(intent))
                    continue
                return False

            if magic_bytes is not None:
                with open(tmp_path, "rb") as f:
                    capcalera = f.read(8)
                if not any(capcalera.startswith(m) for m in magic_bytes):
                    avisar("capçalera de fitxer invàlida (possible descàrrega corrupta), reintentant...")
                    tmp_path.unlink(missing_ok=True)
                    if intent < max_intents:
                        time.sleep(_backoff(intent))
                        continue
                    return False

            os.replace(tmp_path, desti)
            return True

        except (requests.exceptions.RequestException, OSError) as e:
            avisar(f"error de xarxa (intent {intent}/{max_intents}): {e}")
            tmp_path.unlink(missing_ok=True)
            if intent < max_intents:
                time.sleep(_backoff(intent))
            else:
                return False

    return False


def http_get_wcs(session, url, max_intents=MAX_REINTENTS_WCS):
    for intent in range(1, max_intents + 1):
        if SHUTDOWN_REQUESTED:
            return None
        try:
            r = session.get(url, timeout=(8, 30))
            if r.status_code == 200:
                content = r.content
                cl = r.headers.get("Content-Length")
                mida_ok = cl is None or int(cl) == len(content)
                capcalera_ok = any(content.startswith(m) for m in MAGIC_TIFF)
                if mida_ok and len(content) >= 1000 and capcalera_ok:
                    return r
                if intent < max_intents:
                    time.sleep(_backoff(intent))
                    continue
                return None
            if r.status_code in (400, 404):
                return None
            if r.status_code == 429:
                time.sleep(_backoff(intent, base=8, cap=60))
                continue
            if intent < max_intents:
                time.sleep(_backoff(intent))
        except requests.exceptions.RequestException:
            if intent < max_intents:
                time.sleep(_backoff(intent))
    return None


def find_cov(cov_ids, prefix, run_str, period=None):
    c = [x for x in cov_ids if prefix in x and run_str in x]
    if not c:
        c = [x for x in cov_ids if prefix in x]
    if not c:
        return None
    if period:
        cp = [x for x in c if period in x]
        if cp:
            return cp[-1]
    cnp = [x for x in c if "_PT" not in x]
    return (cnp or c)[-1]


def aplicar_factor(vals, factor):
    return vals - 273.15 if factor == "K->C" else vals * factor


# ═══════════════════ SELECCIÓ INTEL·LIGENT DE RUNS ═══════════════════

def trobar_millor_run_meteofetch(runs_wcs):
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_

    print("\n  Analitzant runs per meteofetch...")
    for r in runs_wcs:
        dt_test = datetime.strptime(r + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
        date_str_test = dt_test.strftime("%Y-%m-%dT%H")
        url_test = URL_GRIB.format(b=base_url, d=date_str_test, p="SP1", g="49H51H")
        try:
            resp = requests.head(url_test, timeout=15)
            if resp.status_code == 200:
                print(f"    ✅ {r}: 51 hores OK")
                return r
            else:
                print(f"    ⚠️  {r}: 49H51H no disponible (HTTP {resp.status_code})")
        except requests.exceptions.RequestException:
            print(f"    ⚠️  {r}: error comprovant")
    print(f"    ⚠️  Agafant el més recent: {runs_wcs[0]}")
    return runs_wcs[0]


def trobar_run_wcs_mes_proper(runs_wcs, run_meteofetch):
    if run_meteofetch in runs_wcs:
        return run_meteofetch
    dt_mf = datetime.strptime(run_meteofetch + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
    millor_run = None
    millor_diff = timedelta(days=365)
    for r in runs_wcs:
        dt_r = datetime.strptime(r + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
        diff = abs(dt_r - dt_mf)
        if diff < millor_diff:
            millor_diff = diff
            millor_run = r
    return millor_run


# ═══════════════════ SFC: METEOFETCH ═══════════════════

def descarregar_sfc_meteofetch(steps_bloc, run_dt):
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    date_str = run_dt.strftime("%Y-%m-%dT%H")
    groups = Arome0025.groups_

    print("\n  ╔══════════════════════════════════════╗")
    print(f"  ║  📡 SFC: meteofetch SP1+SP2 ({len(SFC_METEOFETCH)} vars)   ║")
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
    pes_total = 0
    fallits = []

    for grup in grups_ok:
        if SHUTDOWN_REQUESTED:
            break
        for paquet in ["SP1", "SP2"]:
            if SHUTDOWN_REQUESTED:
                break
            url = URL_GRIB.format(b=base_url, d=date_str, p=paquet, g=grup)
            desti = TMP_DIR / f"sfc_{paquet}_{grup}.grib2"

            ok = descarregar_fitxer_robust(session, url, desti, timeout=(15, 120),
                                            magic_bytes=MAGIC_GRIB, acceptar_404=True)

            if ok is None:
                print(f"  [{grup}] {paquet}: 404 (no existeix)")
                continue
            if not ok:
                print(f"  [{grup}] {paquet}: ❌ ha fallat després de {MAX_REINTENTS_GRIB} intents")
                fallits.append(f"{paquet}/{grup}")
                continue

            mb = desti.stat().st_size / (1024 * 1024)
            pes_total += desti.stat().st_size
            print(f"  [{grup}] {paquet}: {mb:.0f}MB", end=" ", flush=True)

            try:
                datasets = cfgrib.open_datasets(str(desti))
            except Exception as e:
                avisar(f"GRIB no llegible ({paquet}/{grup}): {e}")
                desti.unlink(missing_ok=True)
                fallits.append(f"{paquet}/{grup} (grib il·legible)")
                print("❌")
                continue

            if not datasets:
                avisar(f"GRIB sense missatges vàlids ({paquet}/{grup})")
                desti.unlink(missing_ok=True)
                print("❌")
                continue

            vars_trobades = 0
            for ds in datasets:
                for var_name, da in ds.data_vars.items():
                    sn = da.attrs.get("GRIB_shortName", var_name)
                    claus_match = [k for k, (p_ok, sn_cfg, *_) in SFC_METEOFETCH.items() if p_ok == paquet and sn_cfg == sn]
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
                        except Exception:
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
                            avisar(f"graella inesperada a {var_name} +{sa}h ({vals.shape} != ({nl},{nlo})), s'ignora")
                            continue
                        vals = vals.flatten()

                        for clau in claus_match:
                            _, _, factor, nom, unitat = SFC_METEOFETCH[clau]
                            vals_conv = aplicar_factor(vals, factor)
                            dades = [round(float(v), 1) if not np.isnan(v) else None for v in vals_conv]
                            resultats[sa][clau] = {"nombre": nom, "unidades": unitat, "datos": dades}
                            total_vars += 1
                            vars_trobades += 1
                ds.close()

            desti.unlink(missing_ok=True)
            print(f"✓ ({vars_trobades} vars)", flush=True)

    n_horas = len(resultats)
    print(f"  ✅ SFC meteofetch: {total_vars} vars en {n_horas}/{len(steps_bloc)}h")
    print(f"     Pes GRIB: {format_size(pes_total)}")
    if lats is not None:
        lats = [round(float(x), 4) for x in lats]
        lons = [round(float(x), 4) for x in lons]
        print(f"     Graella: {len(lats)}×{len(lons)} = {len(lats) * len(lons)} punts")
    else:
        avisar("no s'ha pogut construir cap graella SFC (cap dada vàlida)")
    if fallits:
        avisar(f"grups fallits: {', '.join(fallits)}")
    print(f"     Temps: {format_time(time.time() - t0)}")
    return resultats, lats, lons


# ═══════════════════ SFC: WCS ═══════════════════

def descarregar_sfc_wcs(steps_bloc, run_dt, run_str, cov_ids):
    n_vars = len(SFC_WCS)
    n_horas = len(steps_bloc)
    total_req = n_vars * n_horas
    print("\n  ╔══════════════════════════════════════╗")
    print(f"  ║  🌐 WCS: {n_vars} vars × {n_horas}h = {total_req} req        ║")
    print(f"  ║  Pausa: {PAUSA_WCS}s | Descans cada 10: {PAUSA_CADA_10}s ║")
    print("  ╚══════════════════════════════════════╝")

    session = requests.Session()
    session.headers.update({"apikey": CFG.key})
    session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=4))

    RES = 0.025
    w_nom = int((CFG.lo1 - CFG.lo0) / RES) + 1
    h_nom = int((CFG.la1 - CFG.la0) / RES) + 1
    SS = 2

    resultats = {}
    mida = {"h": None, "w": None}

    cov_cache = {}
    for var_name, (prefix, height, factor, period, nom, unitat) in SFC_WCS.items():
        cid = find_cov(cov_ids, prefix, run_str, period)
        if cid:
            cov_cache[var_name] = (cid, height, factor)
            print(f"    ✓ {var_name}")
        else:
            avisar(f"{var_name}: cap coverage trobat per al run {run_str}")

    if not cov_cache:
        avisar("cap coverage WCS trobat, s'omet aquesta font")
        return {}, None, None

    total = len(steps_bloc) * len(cov_cache)
    fetes = 0
    ok_req = 0
    fallades = 0
    fallades_detall = []
    t0 = time.time()

    for step in steps_bloc:
        if SHUTDOWN_REQUESTED:
            break
        dh = run_dt + timedelta(hours=step)
        ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")

        for var_name, (cid, height, factor) in cov_cache.items():
            if SHUTDOWN_REQUESTED:
                break
            fetes += 1

            url = (f"{CFG.base}/wcs/{CFG.svc}/GetCoverage?"
                   f"SERVICE=WCS&VERSION=2.0.1&COVERAGEID={cid}&FORMAT=image/tiff"
                   f"&SUBSET=long({CFG.lo0},{CFG.lo1})&SUBSET=lat({CFG.la0},{CFG.la1})"
                   f"&SUBSET=time({ts})")
            if height:
                url += f"&SUBSET=height({height})"
            url += f"&SCALESIZE=long({w_nom})&SCALESIZE=lat({h_nom})"

            r = http_get_wcs(session, url)
            if r is not None:
                try:
                    arr = tifffile.imread(io.BytesIO(r.content))
                    if arr.ndim == 3:
                        arr = arr[0]
                    arr = arr.astype(np.float32) * factor
                    arr = arr[::SS, ::SS]

                    if mida["h"] is None:
                        mida["h"], mida["w"] = arr.shape
                    if arr.shape == (mida["h"], mida["w"]):
                        arr = np.flipud(arr)
                        dades = [round(float(v), 1) if not np.isnan(v) else None for v in arr.flatten()]
                        if step not in resultats:
                            resultats[step] = {}
                        resultats[step][var_name] = {"nombre": SFC_WCS[var_name][4],
                                                      "unidades": SFC_WCS[var_name][5],
                                                      "datos": dades}
                        ok_req += 1
                    else:
                        fallades += 1
                        fallades_detall.append(f"{var_name}+{step}h (mida canviant)")
                except Exception as e:
                    fallades += 1
                    fallades_detall.append(f"{var_name}+{step}h ({e})")
            else:
                fallades += 1
                fallades_detall.append(f"{var_name}+{step}h (sense resposta)")

            if fetes % 10 == 0 or fetes == total:
                pct = fetes / total * 100
                elapsed = time.time() - t0
                rps = fetes / elapsed if elapsed > 0 else 0
                eta = (total - fetes) / rps if rps > 0 else 0
                sys.stdout.write(f"\r  {barra(pct)} {fetes}/{total} | {rps:.1f} req/s | ✓{ok_req} ✗{fallades} | "
                                  f"ETA {format_time(eta)} | +{step:02d}h  ")
                sys.stdout.flush()

            if fetes % 10 == 0:
                time.sleep(PAUSA_CADA_10)
            else:
                time.sleep(PAUSA_WCS)

    print()

    h_fin = mida["h"] or h_nom
    w_fin = mida["w"] or w_nom
    lats_wcs = [round(float(x), 4) for x in np.linspace(CFG.la1, CFG.la0, h_fin)]
    lons_wcs = [round(float(x), 4) for x in np.linspace(CFG.lo0, CFG.lo1, w_fin)]

    print(f"  ✅ WCS: {ok_req} vars OK en {format_time(time.time() - t0)}")
    if fallades:
        avisar(f"{fallades} peticions WCS fallides d'un total de {total}")
        for d in fallades_detall[:10]:
            print(f"       · {d}")
        if len(fallades_detall) > 10:
            print(f"       ... i {len(fallades_detall) - 10} més (veure log)")
    return resultats, lats_wcs, lons_wcs


# ═══════════════════ 3D: meteofetch ═══════════════════

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

    for paquet in ["IP1", "IP3"]:
        if SHUTDOWN_REQUESTED:
            break
        for grup in grups_ok:
            if SHUTDOWN_REQUESTED:
                break
            url = URL_GRIB.format(b=base_url, d=date_str, p=paquet, g=grup)
            desti = TMP_DIR / f"3d_{paquet}_{grup}.grib2"

            ok = descarregar_fitxer_robust(session, url, desti, timeout=(15, 180),
                                            magic_bytes=MAGIC_GRIB, acceptar_404=True)

            if ok is None:
                print(f"  [{paquet}][{grup}] 404 (no existeix)")
                continue
            if not ok:
                print(f"  [{paquet}][{grup}] ❌ ha fallat després de {MAX_REINTENTS_GRIB} intents")
                fallits.append(f"{paquet}/{grup}")
                continue

            mb = desti.stat().st_size / (1024 * 1024)
            pes_grib += desti.stat().st_size
            print(f"  [{paquet}][{grup}] {mb:.0f}MB", end=" ", flush=True)

            vars_en_grib = 0
            for var_name, (nivells_set, conv, nom, unitat) in VARS_3D.items():
                try:
                    ds = xr.open_dataset(desti, engine="cfgrib",
                                          backend_kwargs={"filter_by_keys": {"shortName": var_name}})
                except Exception:
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
                    except Exception:
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
                        except Exception:
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
        avisar("no s'ha pogut construir cap graella 3D (cap dada vàlida)")
    if fallits:
        avisar(f"grups fallits: {', '.join(fallits)}")
    return resultats, lats, lons


# ═══════════════════ CONVECTIU ═══════════════════

RD = 287.05
CP = 1004.6
RD_CP = RD / CP
G0 = 9.80665
EPS = 0.6219707
PLEVS_PERFIL = sorted(NIVELLS_PRESSIO, reverse=True)


def _pressio_a_alcada_estandard(p_hpa):
    T0 = 288.15
    p0 = 1013.25
    lapse = 0.0065
    return (T0 / lapse) * (1.0 - (p_hpa / p0) ** (RD * lapse / G0))


def _lcl_bolton(t_c, td_c, p_hpa):
    t_k = t_c + 273.15
    td_k = td_c + 273.15
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


def calcular_convectiu(step, td_data, sfc_step, n_punts_sfc):
    if step not in td_data:
        return {}
    d = td_data[step]
    if not all(k in sfc_step for k in ["st", "sd", "sp"]):
        return {}

    t_sfc = np.where(np.isfinite(np.array(sfc_step["st"]["datos"], dtype=np.float64)), np.array(sfc_step["st"]["datos"], dtype=np.float64), np.nan)
    td_sfc = np.where(np.isfinite(np.array(sfc_step["sd"]["datos"], dtype=np.float64)), np.array(sfc_step["sd"]["datos"], dtype=np.float64), np.nan)
    p_sfc = np.where(np.isfinite(np.array(sfc_step["sp"]["datos"], dtype=np.float64)), np.array(sfc_step["sp"]["datos"], dtype=np.float64), np.nan)
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
        if not mask[i]:
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
        for j in range(ps[0], len(ds)):
            if ds[j] > 0:
                tr.append(al[j])
            else:
                break
        if len(tr) < 2 or tr[-1] - tr[0] < 1000:
            continue
        lfc_m[i] = tr[0]
        el_m[i] = tr[-1]

    if n_punts_sfc != n3:
        lcl_m = interpolar_graelles(lcl_m, n3, n_punts_sfc)
        lfc_m = interpolar_graelles(lfc_m, n3, n_punts_sfc)
        li = interpolar_graelles(li, n3, n_punts_sfc)
        el_m = interpolar_graelles(el_m, n3, n_punts_sfc)

    r = {}
    if np.any(~np.isnan(lcl_m)):
        r["lcl_m"] = {"nombre": "LCL (alçada)", "unidades": "m", "datos": [round(float(v), 0) if not np.isnan(v) else None for v in lcl_m]}
    if np.any(~np.isnan(lfc_m)):
        r["lfc_m"] = {"nombre": "LFC (alçada)", "unidades": "m", "datos": [round(float(v), 0) if not np.isnan(v) else None for v in lfc_m]}
    if np.any(~np.isnan(li)):
        r["lifted_index"] = {"nombre": "Lifted Index", "unidades": "°C", "datos": [round(float(v), 1) if not np.isnan(v) else None for v in li]}
    if np.any(~np.isnan(el_m)):
        r["el_m"] = {"nombre": "Equilibrium Level", "unidades": "m", "datos": [round(float(v), 0) if not np.isnan(v) else None for v in el_m]}
    return r


# ═══════════════════ JSON ═══════════════════

def generar_json(step, variables, run_date, lats, lons, prefix, total_steps):
    if not variables:
        return None
    n = len(lats) * len(lons)
    v_ok = {k: v for k, v in variables.items() if len(v.get("datos", [])) == n}
    v_descartades = [k for k in variables if k not in v_ok]
    if v_descartades:
        avisar(f"{prefix}_{step:02d}: variables descartades per mida incorrecta: {v_descartades}")
    if not v_ok:
        return None

    run_dt = datetime.fromisoformat(str(run_date).replace('+00:00', ''))
    valid_dt = run_dt + timedelta(hours=step)
    madrid = valid_dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Madrid"))

    data = {
        "hora_utc": valid_dt.strftime("%Y-%m-%dT%H:%M"),
        "hora_madrid": madrid.strftime("%Y-%m-%d %H:%M %Z"),
        "run_utc": run_dt.strftime("%Y-%m-%dT%H:%M"),
        "step": step, "total_steps": total_steps, "modelo": "AROME0025",
        "coordenadas": {"lat": lats, "lon": lons}, "variables": v_ok,
    }

    path = OUTPUT_DIR / f"{prefix}_{step:02d}.json"
    try:
        escriure_json_atomic(path, data)
    except OSError as e:
        avisar(f"no s'ha pogut escriure {path.name}: {e}")
        return None

    kb = os.path.getsize(path) / 1024
    print(f"  {prefix}_{step:02d}.json: {kb:.0f} KB ({len(v_ok)} vars) | +{step:02d}h | {data['hora_madrid']}")
    return str(path), os.path.getsize(path)


def informe_integritat(steps_bloc, sfc_data, td_data):
    print("\n  ╔══════════════════════════════════════╗")
    print("  ║  🔎 INFORME D'INTEGRITAT              ║")
    print("  ╚══════════════════════════════════════╝")

    hores_incompletes = []
    for step in steps_bloc:
        d = sfc_data.get(step, {})
        falten = [v for v in SFC_VARS_CRITIQUES if v not in d]
        if falten:
            hores_incompletes.append((step, falten))

    hores_3d_faltants = [s for s in steps_bloc if not td_data.get(s)]

    if not hores_incompletes:
        print(f"  ✅ Totes les {len(steps_bloc)} hores SFC tenen les variables crítiques")
    else:
        print(f"  ⚠️  {len(hores_incompletes)}/{len(steps_bloc)} hores SFC amb variables crítiques absents:")
        for step, falten in hores_incompletes[:10]:
            print(f"       +{step:02d}h: falten {falten}")
        if len(hores_incompletes) > 10:
            print(f"       ... i {len(hores_incompletes) - 10} més (veure log)")

    if not hores_3d_faltants:
        print(f"  ✅ Totes les {len(steps_bloc)} hores 3D generades")
    else:
        print(f"  ⚠️  {len(hores_3d_faltants)}/{len(steps_bloc)} hores 3D absents: {hores_3d_faltants[:15]}")

    return [s for s, _ in hores_incompletes], hores_3d_faltants


def generar_status_json(run_mf, run_wcs, steps_bloc, sfc_data, td_data, t_inici, fitxers, pes_total,
                         hores_sfc_incompletes=None, hores_3d_faltants=None):
    n_horas_sfc = len(sfc_data)
    n_horas_3d = len(td_data)

    vars_sfc = set()
    for d in sfc_data.values():
        vars_sfc.update(d.keys())

    vars_wcs = [k for k in vars_sfc if k in SFC_WCS]
    vars_mf = [k for k in vars_sfc if k in SFC_METEOFETCH]
    vars_conv = [k for k in vars_sfc if k in ["lcl_m", "lfc_m", "lifted_index", "el_m"]]

    status = {
        "generat": datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "run_meteofetch": run_mf,
        "run_wcs": run_wcs,
        "runs_diferents": run_mf != run_wcs if (run_mf and run_wcs) else None,
        "total_hores": len(steps_bloc),
        "primera_hora": steps_bloc[0] if steps_bloc else None,
        "ultima_hora": steps_bloc[-1] if steps_bloc else None,
        "fitxers": len(fitxers),
        "sfc_fitxers": n_horas_sfc,
        "3d_fitxers": n_horas_3d,
        "pes_total_mb": round(pes_total / (1024 * 1024), 1),
        "temps_total_segons": round(time.time() - t_inici),
        "interromput": SHUTDOWN_REQUESTED,
        "variables_sfc_totals": len(vars_sfc),
        "variables_meteofetch": len(vars_mf),
        "variables_wcs": len(vars_wcs),
        "variables_convectives": len(vars_conv),
        "integritat": {
            "hores_sfc_amb_variables_critiques_absents": hores_sfc_incompletes or [],
            "hores_3d_absents": hores_3d_faltants or [],
        },
        "fonts": {
            "sfc_majoritari": "meteofetch",
            "3d": "meteofetch",
            "wcs_vars": list(SFC_WCS.keys()),
            "convectiu": "calculat_local",
        },
    }

    path = OUTPUT_DIR / "status.json"
    try:
        escriure_json_atomic(path, status)
        print(f"\n  📊 status.json generat: {format_size(os.path.getsize(path))}")
    except OSError as e:
        print(f"\n  ⚠️  No s'ha pogut escriure status.json: {e}")


# ═══════════════════ MAIN ═══════════════════

def main():
    t0 = time.time()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log_path, fitxer_log = configurar_log()

    # Neteja de restes d'una execució anterior que hagi petat a mitges
    netejar_tmp()
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    exit_code = 0
    sfc_data, td_data, steps_bloc = {}, {}, []
    run_mf = run_wcs = None
    fitxers, pes_total = [], 0

    try:
        print("=" * 65)
        print("  AROME 51h: meteofetch SFC + meteofetch 3D + WCS (blindat)")
        print(f"  Pausa cada 10 req: {PAUSA_CADA_10}s")
        print("=" * 65)

        try:
            import meteofetch  # noqa: F401
        except ImportError:
            sys.exit("❌ Falta el paquet 'meteofetch'. Instal·la'l amb: pip install meteofetch")

        if not comprovar_connexio():
            sys.exit(1)

        borrar_antics()

        session = requests.Session()
        session.headers.update({"apikey": CFG.key})

        print("\n  GetCapabilities...", end=" ", flush=True)
        url = f"{CFG.base}/wcs/{CFG.svc}/GetCapabilities?SERVICE=WCS&VERSION=2.0.1&LANGUAGE=eng"
        r = None
        for intent in range(1, 8):
            try:
                r = session.get(url, timeout=30)
                if r.status_code == 200 and len(r.content) > 1000:
                    break
                if r.status_code == 429:
                    time.sleep(_backoff(intent, base=5, cap=40))
                elif intent < 8:
                    time.sleep(_backoff(intent))
            except requests.exceptions.RequestException:
                if intent < 8:
                    time.sleep(_backoff(intent))

        if not r or r.status_code != 200 or len(r.content) <= 1000:
            print("❌")
            sys.exit("❌ No s'ha pogut obtenir GetCapabilities de l'API WCS després de 8 intents.")

        root = ET.fromstring(r.content)
        cov_ids = [e.text.strip() for e in root.iter('{http://www.opengis.net/wcs/2.0}CoverageId')]
        print(f"✓ {len(cov_ids)} coverages")

        if not cov_ids:
            sys.exit("❌ GetCapabilities no ha retornat cap coverage.")

        runs = set()
        for cid in cov_ids:
            m = re.search(r'(\d{4}-\d{2}-\d{2}T\d{2})\.\d{2}\.\d{2}Z', cid)
            if m:
                runs.add(m.group(1))
        runs = sorted(runs, reverse=True)

        if not runs:
            sys.exit("❌ No s'ha pogut detectar cap run als coverages.")

        print(f"  Runs WCS: {', '.join(runs[:5])}")

        run_mf = trobar_millor_run_meteofetch(runs)
        run_wcs = trobar_run_wcs_mes_proper(runs, run_mf)

        run_dt_mf = datetime.strptime(run_mf + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
        run_dt_wcs = datetime.strptime(run_wcs + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")

        steps_bloc = calcular_steps(run_dt_mf, TOTAL_HORES)

        madrid_mf = run_dt_mf.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Madrid"))
        madrid_wcs = run_dt_wcs.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Madrid"))

        print(f"\n  ✅ Run meteofetch: {run_mf}Z = {madrid_mf.strftime('%d/%m %H:%M %Z')}")
        print(f"  ✅ Run WCS:        {run_wcs}Z = {madrid_wcs.strftime('%d/%m %H:%M %Z')}")
        if run_mf != run_wcs:
            print("  ⚠️  Runs DIFERENTS")
        print(f"  Steps: +{steps_bloc[0]}h a +{steps_bloc[-1]}h ({len(steps_bloc)} hores)")

        sfc_mf, lats_mf, lons_mf = descarregar_sfc_meteofetch(steps_bloc, run_dt_mf)
        sfc_wcs, lats_wcs, lons_wcs = ({}, None, None) if SHUTDOWN_REQUESTED else \
            descarregar_sfc_wcs(steps_bloc, run_dt_wcs, run_wcs, cov_ids)
        td_data_tmp, lats_3d, lons_3d = ({}, None, None) if SHUTDOWN_REQUESTED else \
            descarregar_3d(steps_bloc, run_dt_mf)
        td_data.update(td_data_tmp)

        for step in steps_bloc:
            sfc_data[step] = {}
            if step in sfc_mf:
                sfc_data[step].update(sfc_mf[step])
            if step in sfc_wcs:
                sfc_data[step].update(sfc_wcs[step])

        lats_sfc = lats_mf
        lons_sfc = lons_mf

        if sfc_wcs and lats_mf and lats_wcs:
            n_mf = len(lats_mf)
            n_wcs = len(lats_wcs)
            if n_mf != n_wcs:
                print("\n  ╔══════════════════════════════════════╗")
                print("  ║  🔄 Interpolant WCS → meteofetch    ║")
                print("  ╚══════════════════════════════════════╝")

                y_wcs = np.linspace(CFG.la1, CFG.la0, n_wcs)
                x_wcs = np.linspace(CFG.lo0, CFG.lo1, len(lons_wcs))
                y_mf = np.linspace(CFG.la1, CFG.la0, n_mf)
                x_mf = np.linspace(CFG.lo0, CFG.lo1, len(lons_mf))
                Y_mf, X_mf = np.meshgrid(y_mf, x_mf, indexing='ij')
                pts_mf = np.column_stack([Y_mf.ravel(), X_mf.ravel()])

                n_interp = 0
                for step in steps_bloc:
                    if step not in sfc_wcs:
                        continue
                    for var_name in list(sfc_wcs[step].keys()):
                        arr_wcs = np.array(sfc_wcs[step][var_name]["datos"], dtype=np.float64)
                        arr_wcs_2d = arr_wcs.reshape(n_wcs, -1)
                        fn = RegularGridInterpolator((y_wcs, x_wcs), arr_wcs_2d, method='linear',
                                                      bounds_error=False, fill_value=np.nan)
                        arr_mf = fn(pts_mf)
                        dades = [round(float(v), 1) if not np.isnan(v) else None for v in arr_mf]
                        if step not in sfc_data:
                            sfc_data[step] = {}
                        sfc_data[step][var_name] = {"nombre": sfc_wcs[step][var_name]["nombre"],
                                                     "unidades": sfc_wcs[step][var_name]["unidades"],
                                                     "datos": dades}
                        n_interp += 1
                print(f"  ✅ {n_interp} variables interpolades ({n_wcs}×{len(lons_wcs)} → {n_mf}×{len(lons_mf)})")

        if lats_sfc and td_data:
            print("\n  ╔══════════════════════════════════════╗")
            print("  ║  🌡️  Convectiu (LCL, LFC, LI, EL)    ║")
            print("  ╚══════════════════════════════════════╝")
            n_punts = len(lats_sfc) * len(lons_sfc)
            t0c = time.time()
            n_ok = 0
            for step in steps_bloc:
                if step not in sfc_data or step not in td_data:
                    continue
                try:
                    cv = calcular_convectiu(step, td_data, sfc_data[step], n_punts)
                    if cv:
                        sfc_data[step].update(cv)
                        n_ok += 1
                except Exception as e:
                    avisar(f"convectiu +{step:02d}h: {e}")
            print(f"  ✅ {n_ok}/{len(steps_bloc)} hores ({format_time(time.time() - t0c)})")

        print("\n  ╔══════════════════════════════════════╗")
        print("  ║  📦 GENERANT JSONs                   ║")
        print("  ╚══════════════════════════════════════╝")

        ordre_sfc = [
            "st", "srh", "su", "sv", "wind_gust", "pressure_msl",
            "tp", "tgrp", "tsnowp",
            "sd", "sh2", "cape", "spbl",
            "high_cloud_cover", "low_cloud_cover", "medium_cloud_cover",
            "temp_min2m", "temp_max2m", "sp",
            "reflectivity_dbz", "rain", "lightning", "precip_water",
            "lcl_m", "lfc_m", "lifted_index", "el_m",
        ]

        ts = len(steps_bloc)

        for step in steps_bloc:
            if step in sfc_data and sfc_data[step] and lats_sfc:
                vo = {}
                for k in ordre_sfc:
                    if k in sfc_data[step]:
                        vo[k] = sfc_data[step][k]
                for k, v in sfc_data[step].items():
                    if k not in vo:
                        vo[k] = v
                res = generar_json(step, vo, run_dt_mf, lats_sfc, lons_sfc, "sfc", ts)
                if res:
                    fitxers.append(res[0])
                    pes_total += res[1]

            if step in td_data and td_data[step] and lats_3d:
                res = generar_json(step, td_data[step], run_dt_mf, lats_3d, lons_3d, "3d", ts)
                if res:
                    fitxers.append(res[0])
                    pes_total += res[1]

        hores_sfc_incompletes, hores_3d_faltants = informe_integritat(steps_bloc, sfc_data, td_data)

        generar_status_json(run_mf, run_wcs, steps_bloc, sfc_data, td_data, t0, fitxers, pes_total,
                             hores_sfc_incompletes, hores_3d_faltants)

        print("\n  ╔══════════════════════════════════════╗")
        estat = "⚠️  INTERROMPUT" if SHUTDOWN_REQUESTED else "✅ FINALITZAT"
        print(f"  ║  {estat}")
        print("  ╠══════════════════════════════════════╣")
        print(f"  ║  Fitxers: {len(fitxers)} (SFC: {len(sfc_data)}/{ts}, 3D: {len(td_data)}/{ts})")
        print(f"  ║  Pes total: {format_size(pes_total)}")
        print(f"  ║  Temps: {format_time(time.time() - t0)}")
        print("  ╚══════════════════════════════════════╝")

        if SHUTDOWN_REQUESTED:
            exit_code = 130
        elif hores_sfc_incompletes or hores_3d_faltants:
            exit_code = 2  # dades parcials: avisem però no és un "error" dur

    except SystemExit as e:
        exit_code = e.code if isinstance(e.code, int) else 1
        if steps_bloc:
            try:
                hores_sfc_incompletes, hores_3d_faltants = informe_integritat(steps_bloc, sfc_data, td_data)
                generar_status_json(run_mf, run_wcs, steps_bloc, sfc_data, td_data, t0, fitxers, pes_total,
                                     hores_sfc_incompletes, hores_3d_faltants)
            except Exception:
                pass
    except Exception as e:
        print(f"\n  ❌ ERROR INESPERAT: {e}")
        traceback.print_exc()
        exit_code = 1
        if steps_bloc:
            try:
                hores_sfc_incompletes, hores_3d_faltants = informe_integritat(steps_bloc, sfc_data, td_data)
                generar_status_json(run_mf, run_wcs, steps_bloc, sfc_data, td_data, t0, fitxers, pes_total,
                                     hores_sfc_incompletes, hores_3d_faltants)
            except Exception:
                pass
    finally:
        netejar_tmp()
        print(f"\n  📝 Log complet desat a: {log_path}")
        try:
            fitxer_log.close()
        except Exception:
            pass

    sys.exit(exit_code)


if __name__ == "__main__":
    main()