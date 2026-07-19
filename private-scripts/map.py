"""
t_final_blindado.py — VERSIÓ FINAL · FRACCIONAT OPTIMITZAT + GEO500 + T500 + SRH + SHEAR
═══════════════════════════════════════════════════════════════════════════════
 SFC: meteofetch SP1+SP2 (19 vars)
 3D: meteofetch IP1+IP3 (pressió, vent, humitat, etc.)
 WCS: 4 vars interpolades a la graella de meteofetch
 Convectiu: LCL, LFC, LI, EL (calculat en local, des de 1000 hPa)
 GEO500 + T500: extrets de dades 3D (z_500, t_500)
 SRH 0-1km, SRH 0-3km, Shear 0-3km, Shear 0-6km: calculats

 ESTRUCTURA FRACCIONADA OPTIMITZADA:
   - Variables individuals: ~3-4 MB/fitxer
   - Nivells 3D agrupats: nivell_1000.js ~17 MB (5-7 vars)
   - GEO500: geopotencial_500.js (~3.5 MB)
   - T500: temperatura_500.js (~3.5 MB)
   - SRH/Shear: srh_01.js, srh_03.js, shear_03.js, shear_06.js (~3.5 MB)

 BLINDATGE: descàrregues verificades, backoff, escriptura atòmica,
 Ctrl+C, log, neteja tmp.

 CORRECCIÓ LFC/EL (aquesta versió):
   - La parcel·la SEMPRE es calcula des de la superfície real (sfc_p).
   - Però el perfil de buoyancy s'avalua des de 1000 hPa fins a 100 hPa
     per no perdre cap part de la CAPE/CIN que quedaria per sota de la
     superfície del model en zones elevades.
   - Si la superfície està per sobre de 1000 hPa (ex: 950 hPa a Madrid),
     els nivells per sota de la superfície s'ignoren al càlcul de CAPE/CIN
     perquè la parcel·la no pot existir sota terra.
   - Si la superfície està per sota de 1000 hPa (ex: 1015 hPa al mar),
     es fan servir tots els nivells disponibles.
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
from scipy.interpolate import RegularGridInterpolator, griddata
from requests.adapters import HTTPAdapter

logging.getLogger("cfgrib").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", category=FutureWarning)

# ═══════════════════ CONFIG ═══════════════════

def carregar_config():
    d = os.path.dirname(os.path.abspath(__file__))
    path_cfg = os.path.join(d, "configarome.json")

    if not os.path.exists(path_cfg):
        sys.exit(f"❌ No es troba config.json a: {path_cfg}")

    try:
        with open(path_cfg, encoding="utf-8") as f:
            cfg = json.load(f)
    except json.JSONDecodeError as e:
        sys.exit(f"❌ config.json té un error de sintaxi JSON: {e}")

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
        sys.exit("❌ Regió invàlida a config.json")
    if not c.key or not isinstance(c.key, str):
        sys.exit("❌ api_key buida o invàlida a config.json")

    c.out = os.path.join(d, cfg["output_dir"])
    return c


CFG = carregar_config()
TOTAL_HORES = 24
PAUSA_WCS = 0.15
PAUSA_CADA_10 = 5.0
MAX_REINTENTS_WCS = 5
MAX_REINTENTS_GRIB = 5
OUTPUT_DIR = Path(CFG.out)
TMP_DIR = Path(os.environ.get("TEMP", "/tmp")) / "arome_final"

URL_GRIB = "{b}/{d}:00:00Z/arome/0025/{p}/arome__0025__{p}__{g}__{d}:00:00Z.grib2"

MAGIC_GRIB = (b"GRIB",)
MAGIC_TIFF = (b"II*\x00", b"MM\x00*")

# ═══════════════════ ESTAT GLOBAL ═══════════════════

SHUTDOWN_REQUESTED = False

def _signal_handler(signum, frame):
    global SHUTDOWN_REQUESTED
    if not SHUTDOWN_REQUESTED:
        print("\n\n  ⚠️  Senyal d'interrupció rebuda (Ctrl+C)...")
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
    except Exception:
        pass

atexit.register(netejar_tmp)

# ═══════════════════ LOG ═══════════════════

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

# ═══════════════════ SFC ═══════════════════

SFC_METEOFETCH = {
    "st": ("SP1", "2t", "K->C", "Temperatura 2m", "°C"),
    "srh": ("SP1", "2r", 1.0, "Humitat 2m", "%"),
    "su": ("SP1", "10u", 1.0, "Vent U 10m", "m/s"),
    "sv": ("SP1", "10v", 1.0, "Vent V 10m", "m/s"),
    "wind_gust": ("SP1", "10fg", 3.6, "Ratxa 10m", "km/h"),
    "pressure_msl": ("SP1", "prmsl", 0.01, "Pressió MSL", "hPa"),
    "tp": ("SP1", "tp", 1.0, "Precip. total acum.", "mm"),
    "tgrp": ("SP1", "tgrp", 1.0, "Calamarsa acum.", "mm"),
    "tsnowp": ("SP1", "tsnowp", 1.0, "Neu acum.", "mm"),
    "sd": ("SP2", "2d", "K->C", "Punt rosada 2m", "°C"),
    "sh2": ("SP2", "2sh", 1.0, "Humitat esp. 2m", "kg/kg"),
    "cape": ("SP2", "CAPE_INS", 1.0, "CAPE", "J/kg"),
    "spbl": ("SP2", "blh", 1.0, "Capa límit", "m"),
    "high_cloud_cover": ("SP2", "hcc", 1.0, "Nuvols alts", "%"),
    "low_cloud_cover": ("SP2", "lcc", 1.0, "Nuvols baixos", "%"),
    "medium_cloud_cover": ("SP2", "mcc", 1.0, "Nuvols mitjans", "%"),
    "temp_min2m": ("SP2", "mn2t", "K->C", "Temp. mín. 2m", "°C"),
    "temp_max2m": ("SP2", "mx2t", "K->C", "Temp. màx. 2m", "°C"),
    "sp": ("SP2", "sp", 0.01, "Pressió superf.", "hPa"),
}

SFC_WCS = {
    "reflectivity_dbz": ("REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE", None, 1.0, None, "Reflectivitat", "dBZ"),
    "rain": ("TOTAL_WATER_PRECIPITATION__GROUND_OR_WATER_SURFACE", None, 1.0, "PT1H", "Pluja 1h", "mm"),
    "lightning": ("LIGHTNING_STRIKE_DENSITY_CUMULATED__GROUND_OR_WATER_SURFACE", None, 1.0, "PT1H", "Llamps 1h", "impactes/m²"),
    "precip_water": ("PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE", None, 1.0, None, "Aigua precipitable", "mm"),
}

# ═══════════════════ 3D ═══════════════════

NIVELLS_PRESSIO = {1000, 950, 925, 900, 875, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100}
NIVELLS_W = {925, 850, 700, 500, 300}
NIVELLS_PV = {925, 850, 700, 500, 300, 200}
NIVELLS_GH = {500}

VARS_3D = {
    "t": (NIVELLS_PRESSIO, lambda v: v - 273.15, "Temperatura", "°C"),
    "u": (NIVELLS_PRESSIO, lambda v: v, "Vent U", "m/s"),
    "v": (NIVELLS_PRESSIO, lambda v: v, "Vent V", "m/s"),
    "r": (NIVELLS_PRESSIO, lambda v: v, "Humitat relativa", "%"),
    "w": (NIVELLS_W, lambda v: v, "Velocitat vertical", "Pa/s"),
    "dpt": (NIVELLS_PRESSIO, lambda v: v - 273.15, "Punt rosada", "°C"),
    "pv": (NIVELLS_PV, lambda v: v * 1e6, "Vorticitat potencial", "PVU"),
    "z": (NIVELLS_GH, lambda v: v, "Geopotencial", "m²/s²"),
}

# ═══════════════════ AGRUPACIÓ ═══════════════════

VARS_INDIVIDUALS_SFC = [
    "st", "sd", "srh", "temp_min2m", "temp_max2m",
    "pressure_msl", "sp", "cape", "spbl", "sh2",
    "reflectivity_dbz", "rain",
    "lcl_m", "lfc_m", "lifted_index", "el_m",
    "geopotencial_500", "temperatura_500",
    "srh_01", "srh_03", "shear_03", "shear_06",
]

GRUPS_SFC = {
    "wind": ["su", "sv", "wind_speed_10m", "wind_gust"],
    "precip": ["tp", "tgrp", "tsnowp"],
    "clouds": ["low_cloud_cover", "medium_cloud_cover", "high_cloud_cover"],
}

VARS_OPCIONALS_SFC = ["lightning", "precip_water"]

# ═══════════════════ UTILITATS ═══════════════════

def format_time(s):
    if s < 60: return f"{s:.0f}s"
    elif s < 3600: return f"{int(s//60)}m {int(s%60)}s"
    else: return f"{int(s//3600)}h {int((s%3600)//60)}m"

def format_size(b):
    if b < 1024: return f"{b} B"
    elif b < 1024*1024: return f"{b/1024:.1f} KB"
    elif b < 1024*1024*1024: return f"{b/(1024*1024):.1f} MB"
    else: return f"{b/(1024*1024*1024):.2f} GB"

def barra(pct, ample=20):
    fet = int(ample * pct / 100)
    return f"[{'█'*fet}{'░'*(ample-fet)}] {pct:5.1f}%"

def calcular_steps(run_utc, total_hores):
    ara = datetime.now(ZoneInfo("Europe/Madrid")).astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    run_naive = run_utc.replace(tzinfo=None) if run_utc.tzinfo else run_utc
    inici = max(0, int((ara - run_naive).total_seconds() / 3600))
    fi = min(inici + total_hores, 52)
    return list(range(inici, fi))

def borrar_antics():
    if not OUTPUT_DIR.exists(): return
    nf, nc, pes = 0, 0, 0
    for carpeta in OUTPUT_DIR.iterdir():
        if carpeta.is_dir() and re.match(r'^\d{2}$', carpeta.name):
            for f in carpeta.glob("*"):
                try:
                    pes += f.stat().st_size
                    f.unlink()
                    nf += 1
                except Exception: pass
            try:
                carpeta.rmdir()
                nc += 1
            except Exception: pass
    if nf > 0:
        print(f"  ✓ Borrades {nc} carpetes d'hores anteriors ({nf} fitxers, {format_size(pes)} alliberats)")

def comprovar_connexio():
    print("  Comprovant connexió...", end=" ", flush=True)
    try:
        requests.head(CFG.base, timeout=15)
        print("✓")
        return True
    except Exception as e:
        print("❌")
        return False

def _backoff(intent, base=2.0, cap=30.0):
    return min(cap, base*(2**(intent-1))) + random.uniform(0, 1)

def escriure_json_atomic(path: Path, data):
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)

def descarregar_fitxer_robust(session, url, desti: Path, timeout=(15,180),
                               max_intents=MAX_REINTENTS_GRIB, min_bytes=1000,
                               magic_bytes=None, acceptar_404=True):
    tmp_path = desti.with_name(desti.name + ".part")
    for intent in range(1, max_intents+1):
        if SHUTDOWN_REQUESTED: return False
        try:
            r = session.get(url, stream=True, timeout=timeout)
            if r.status_code == 404: return None if acceptar_404 else False
            if r.status_code == 429:
                time.sleep(_backoff(intent, base=8, cap=60))
                continue
            r.raise_for_status()
            cl = r.headers.get("Content-Length")
            bw = 0
            desti.parent.mkdir(parents=True, exist_ok=True)
            with open(tmp_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=2*1024*1024):
                    if chunk:
                        f.write(chunk)
                        bw += len(chunk)
            if cl is not None and int(cl) != bw:
                tmp_path.unlink(missing_ok=True)
                if intent < max_intents: time.sleep(_backoff(intent)); continue
                return False
            if bw < min_bytes:
                tmp_path.unlink(missing_ok=True)
                if intent < max_intents: time.sleep(_backoff(intent)); continue
                return False
            if magic_bytes:
                with open(tmp_path, "rb") as f:
                    if not any(f.read(8).startswith(m) for m in magic_bytes):
                        tmp_path.unlink(missing_ok=True)
                        if intent < max_intents: time.sleep(_backoff(intent)); continue
                        return False
            os.replace(tmp_path, desti)
            return True
        except Exception:
            tmp_path.unlink(missing_ok=True)
            if intent < max_intents: time.sleep(_backoff(intent))
            else: return False
    return False

def http_get_wcs(session, url, max_intents=MAX_REINTENTS_WCS):
    for intent in range(1, max_intents+1):
        if SHUTDOWN_REQUESTED: return None
        try:
            r = session.get(url, timeout=(8, 30))
            if r.status_code == 200 and len(r.content) >= 1000:
                if any(r.content.startswith(m) for m in MAGIC_TIFF):
                    return r
            if r.status_code in (400, 404): return None
            if r.status_code == 429: time.sleep(_backoff(intent, base=8, cap=60)); continue
            if intent < max_intents: time.sleep(_backoff(intent))
        except Exception:
            if intent < max_intents: time.sleep(_backoff(intent))
    return None

def find_cov(cov_ids, prefix, run_str, period=None):
    c = [x for x in cov_ids if prefix in x and run_str in x]
    if not c: c = [x for x in cov_ids if prefix in x]
    if not c: return None
    if period:
        cp = [x for x in c if period in x]
        if cp: return cp[-1]
    cnp = [x for x in c if "_PT" not in x]
    return (cnp or c)[-1]

def aplicar_factor(vals, factor):
    return vals - 273.15 if factor == "K->C" else vals * factor

# ═══════════════════ RUNS ═══════════════════

def trobar_millor_run_meteofetch(runs_wcs):
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    print("\n  Analitzant runs per meteofetch...")
    for r in runs_wcs:
        dt_test = datetime.strptime(r + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
        date_str_test = dt_test.strftime("%Y-%m-%dT%H")
        url_test = URL_GRIB.format(b=base_url, d=date_str_test, p="SP1", g="49H51H")
        try:
            if requests.head(url_test, timeout=15).status_code == 200:
                print(f"    ✅ {r}: 51 hores OK")
                return r
        except Exception: pass
    return runs_wcs[0]

def trobar_run_wcs_mes_proper(runs_wcs, run_meteofetch):
    if run_meteofetch in runs_wcs: return run_meteofetch
    dt_mf = datetime.strptime(run_meteofetch + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
    millor_run, millor_diff = None, timedelta(days=365)
    for r in runs_wcs:
        dt_r = datetime.strptime(r + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
        diff = abs(dt_r - dt_mf)
        if diff < millor_diff: millor_diff, millor_run = diff, r
    return millor_run

# ═══════════════════ SFC METEOFETCH ═══════════════════

def descarregar_sfc_meteofetch(steps_bloc, run_dt):
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    date_str = run_dt.strftime("%Y-%m-%dT%H")
    groups = Arome0025.groups_
    s_min, s_max = min(steps_bloc), max(steps_bloc)
    grups_ok = [g for g in groups if int(g.split("H")[0]) <= s_max and (int(g.split("H")[1]) if "H" in g[3:] else int(g.split("H")[0])+6) >= s_min]
    
    session = requests.Session()
    session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=4))
    resultats, lats, lons = {}, None, None
    total_vars, pes_total = 0, 0
    t0 = time.time()
    
    for grup in grups_ok:
        if SHUTDOWN_REQUESTED: break
        for paquet in ["SP1", "SP2"]:
            if SHUTDOWN_REQUESTED: break
            url = URL_GRIB.format(b=base_url, d=date_str, p=paquet, g=grup)
            desti = TMP_DIR / f"sfc_{paquet}_{grup}.grib2"
            ok = descarregar_fitxer_robust(session, url, desti, timeout=(15,120), magic_bytes=MAGIC_GRIB)
            if ok is None: continue
            if not ok: continue
            
            mb = desti.stat().st_size / (1024*1024)
            pes_total += desti.stat().st_size
            print(f"  [{grup}] {paquet}: {mb:.0f}MB", end=" ", flush=True)
            
            try: datasets = cfgrib.open_datasets(str(desti))
            except Exception: desti.unlink(missing_ok=True); print("❌"); continue
            
            vars_trobades = 0
            for ds in datasets:
                for var_name, da in ds.data_vars.items():
                    sn = da.attrs.get("GRIB_shortName", var_name)
                    claus_match = [k for k, (p_ok, sn_cfg, *_) in SFC_METEOFETCH.items() if p_ok == paquet and sn_cfg == sn]
                    if not claus_match: continue
                    
                    lat_dim = next((d for d in da.dims if 'lat' in d.lower()), None)
                    lon_dim = next((d for d in da.dims if 'lon' in d.lower()), None)
                    time_dim = next((d for d in da.dims if d.lower() in ("time","step","valid_time")), None)
                    if not lat_dim or not lon_dim: continue
                    
                    if lats is None:
                        lats_raw, lons_raw = da[lat_dim].values, da[lon_dim].values
                        lat_mask = (lats_raw >= CFG.la0) & (lats_raw <= CFG.la1)
                        lon_mask = (lons_raw >= CFG.lo0) & (lons_raw <= CFG.lo1)
                        lats = lats_raw[lat_mask][::-1]
                        lons = lons_raw[lon_mask]
                    
                    nl, nlo = len(lats), len(lons)
                    
                    for so in range(da.sizes.get(time_dim, 1) if time_dim else 1):
                        da_step = da.isel({time_dim: so}) if (time_dim and time_dim in da.dims) else da
                        try: sr = int(da_step.get('step', so))
                        except: sr = so
                        sa = int(grup.split("H")[0]) + sr
                        if sa not in steps_bloc: continue
                        resultats.setdefault(sa, {})
                        
                        da_step_c = da_step.where((da_step[lat_dim] >= CFG.la0) & (da_step[lat_dim] <= CFG.la1) & (da_step[lon_dim] >= CFG.lo0) & (da_step[lon_dim] <= CFG.lo1), drop=True)
                        vals = np.flipud(da_step_c.values)
                        if vals.shape != (nl, nlo): continue
                        vals = vals.flatten()
                        
                        for clau in claus_match:
                            _, _, factor, nom, unitat = SFC_METEOFETCH[clau]
                            vals_conv = aplicar_factor(vals, factor)
                            dades = [round(float(v), 1) if not np.isnan(v) else None for v in vals_conv]
                            resultats[sa][clau] = {"nombre": nom, "unidades": unitat, "datos": dades}
                            total_vars += 1; vars_trobades += 1
                ds.close()
            desti.unlink(missing_ok=True)
            print(f"✓ ({vars_trobades} vars)", flush=True)
    
    print(f"  ✅ SFC meteofetch: {total_vars} vars | Temps: {format_time(time.time()-t0)}")
    if lats is not None and len(lats) > 0:
        lats = [round(float(x), 4) for x in lats]
        lons = [round(float(x), 4) for x in lons]
    return resultats, lats, lons

# ═══════════════════ SFC WCS ═══════════════════

def descarregar_sfc_wcs(steps_bloc, run_dt, run_str, cov_ids):
    session = requests.Session(); session.headers.update({"apikey": CFG.key})
    session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=4))
    
    RES, SS = 0.025, 2
    w_nom = int((CFG.lo1 - CFG.lo0) / RES) + 1
    h_nom = int((CFG.la1 - CFG.la0) / RES) + 1
    
    resultats, mida = {}, {"h": None, "w": None}
    cov_cache = {}
    for var_name, (prefix, height, factor, period, nom, unitat) in SFC_WCS.items():
        cid = find_cov(cov_ids, prefix, run_str, period)
        if cid: cov_cache[var_name] = (cid, height, factor)
    
    if not cov_cache: return {}, None, None
    
    total, fetes, ok_req = len(steps_bloc)*len(cov_cache), 0, 0
    t0 = time.time()
    
    for step in steps_bloc:
        if SHUTDOWN_REQUESTED: break
        dh = run_dt + timedelta(hours=step); ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")
        for var_name, (cid, height, factor) in cov_cache.items():
            if SHUTDOWN_REQUESTED: break
            fetes += 1
            url = (f"{CFG.base}/wcs/{CFG.svc}/GetCoverage?SERVICE=WCS&VERSION=2.0.1&COVERAGEID={cid}&FORMAT=image/tiff&SUBSET=long({CFG.lo0},{CFG.lo1})&SUBSET=lat({CFG.la0},{CFG.la1})&SUBSET=time({ts})")
            if height: url += f"&SUBSET=height({height})"
            url += f"&SCALESIZE=long({w_nom})&SCALESIZE=lat({h_nom})"
            
            r = http_get_wcs(session, url)
            if r is not None:
                try:
                    arr = tifffile.imread(io.BytesIO(r.content))
                    if arr.ndim == 3: arr = arr[0]
                    arr = arr.astype(np.float32) * factor
                    arr = arr[::SS, ::SS]
                    if mida["h"] is None: mida["h"], mida["w"] = arr.shape
                    if arr.shape == (mida["h"], mida["w"]):
                        arr = np.flipud(arr)
                        dades = [round(float(v),1) if not np.isnan(v) else None for v in arr.flatten()]
                        resultats.setdefault(step, {})[var_name] = {"nombre": SFC_WCS[var_name][4], "unidades": SFC_WCS[var_name][5], "datos": dades}
                        ok_req += 1
                except: pass
            
            if fetes % 10 == 0 or fetes == total:
                pct = fetes/total*100; elapsed = time.time()-t0
                rps = fetes/elapsed if elapsed>0 else 0
                eta = (total-fetes)/rps if rps>0 else 0
                sys.stdout.write(f"\r  {barra(pct)} {fetes}/{total} | {rps:.1f} req/s | ✓{ok_req} | ETA {format_time(eta)} | +{step:02d}h  ")
                sys.stdout.flush()
            time.sleep(PAUSA_CADA_10 if fetes%10==0 else PAUSA_WCS)
    
    print()
    h_fin, w_fin = mida["h"] or h_nom, mida["w"] or w_nom
    lats_wcs = [round(float(x),4) for x in np.linspace(CFG.la1, CFG.la0, h_fin)]
    lons_wcs = [round(float(x),4) for x in np.linspace(CFG.lo0, CFG.lo1, w_fin)]
    print(f"  ✅ WCS: {ok_req} vars OK en {format_time(time.time()-t0)}")
    return resultats, lats_wcs, lons_wcs

# ═══════════════════ 3D ═══════════════════

def descarregar_3d(steps_bloc, run_dt):
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    date_str = run_dt.strftime("%Y-%m-%dT%H")
    groups = Arome0025.groups_
    s_min, s_max = min(steps_bloc), max(steps_bloc)
    grups_ok = [g for g in groups if int(g.split("H")[0]) <= s_max and (int(g.split("H")[1]) if "H" in g[3:] else int(g.split("H")[0])+6) >= s_min]
    
    session = requests.Session()
    session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=4))
    resultats, lats, lons = {}, None, None
    total_vars, pes_grib = 0, 0
    t0 = time.time()
    
    for paquet in ["IP1", "IP3"]:
        if SHUTDOWN_REQUESTED: break
        for grup in grups_ok:
            if SHUTDOWN_REQUESTED: break
            url = URL_GRIB.format(b=base_url, d=date_str, p=paquet, g=grup)
            desti = TMP_DIR / f"3d_{paquet}_{grup}.grib2"
            ok = descarregar_fitxer_robust(session, url, desti, timeout=(15,180), magic_bytes=MAGIC_GRIB)
            if ok is None: continue
            if not ok: continue
            
            mb = desti.stat().st_size / (1024*1024)
            pes_grib += desti.stat().st_size
            print(f"  [{paquet}][{grup}] {mb:.0f}MB", end=" ", flush=True)
            
            vars_en_grib = 0
            for var_name, (nivells_set, conv, nom, unitat) in VARS_3D.items():
                try:
                    ds = xr.open_dataset(desti, engine="cfgrib", backend_kwargs={"filter_by_keys": {"shortName": var_name}})
                except: continue
                if var_name not in ds.data_vars: ds.close(); continue
                da = ds[var_name]
                lat_dim = next((d for d in da.dims if 'lat' in d.lower()), None)
                lon_dim = next((d for d in da.dims if 'lon' in d.lower()), None)
                time_dim = next((d for d in da.dims if d.lower() in ("time","step","valid_time")), None)
                if not lat_dim or not lon_dim: ds.close(); continue
                
                dims_extra = [d for d in da.dims if d not in (lat_dim, lon_dim, time_dim or '')]
                dim_niv = next((d for d in dims_extra if 'isobaric' in d.lower() or 'pressure' in d.lower()), None)
                if dim_niv is None and dims_extra: dim_niv = dims_extra[0]
                if dim_niv is None: ds.close(); continue
                
                if lats is None:
                    lats_raw, lons_raw = da[lat_dim].values, da[lon_dim].values
                    lat_mask = (lats_raw >= CFG.la0) & (lats_raw <= CFG.la1)
                    lon_mask = (lons_raw >= CFG.lo0) & (lons_raw <= CFG.lo1)
                    lats = lats_raw[lat_mask][::-1]
                    lons = lons_raw[lon_mask]
                
                nl, nlo = len(lats), len(lons)
                
                for so in range(da.sizes.get(time_dim, 1) if time_dim else 1):
                    da_step = da.isel({time_dim: so}) if (time_dim and time_dim in da.dims) else da
                    try: sr = int(da_step.get('step', so))
                    except: sr = so
                    sa = int(grup.split("H")[0]) + sr
                    if sa not in steps_bloc: continue
                    resultats.setdefault(sa, {})
                    
                    da_step = da_step.where((da_step[lat_dim] >= CFG.la0) & (da_step[lat_dim] <= CFG.la1) & (da_step[lon_dim] >= CFG.lo0) & (da_step[lon_dim] <= CFG.lo1), drop=True)
                    
                    for nivell in da_step[dim_niv].values:
                        ni = int(round(float(nivell)))
                        if ni not in nivells_set: continue
                        try:
                            da_niv = da_step.sel({dim_niv: nivell})
                            vals = np.flipud(da_niv.values)
                            if vals.shape != (nl, nlo): continue
                            dades = [round(float(conv(v)),1) if not np.isnan(v) else None for v in vals.flatten()]
                            resultats[sa][f"{var_name}_{ni}"] = {"nombre": f"{nom} @ {ni}hPa", "unidades": unitat, "datos": dades}
                            total_vars += 1; vars_en_grib += 1
                        except: pass
                ds.close()
            desti.unlink(missing_ok=True)
            print(f"✓ ({vars_en_grib} vars)", flush=True)
    
    print(f"  ✅ 3D: {total_vars} vars | Temps: {format_time(time.time()-t0)}")
    if lats is not None and len(lats) > 0:
        lats = [round(float(x),4) for x in lats]
        lons = [round(float(x),4) for x in lons]
    return resultats, lats, lons

# ═══════════════════ CONVECTIU (CORREGIT: 1000 hPa → 100 hPa) ═══════════════════

RD, CP, G0_CONV, EPS = 287.05, 1004.6, 9.80665, 0.6219707
RD_CP = RD / CP
PLEVS_PERFIL = sorted(NIVELLS_PRESSIO, reverse=True)  # 1000, 950, ..., 100

P_MIN_CONV = 100   # hPa - top del perfil
P_MAX_CONV = 1000  # hPa - base del perfil (sempre 1000, independentment de la superfície)

def _pressio_a_alcada_estandard(p_hpa):
    T0, p0, lapse = 288.15, 1013.25, 0.0065
    return (T0/lapse) * (1.0 - (p_hpa/p0)**(RD*lapse/G0_CONV))

def _lcl_bolton(t_c, td_c, p_hpa):
    t_k, td_k = t_c+273.15, td_c+273.15
    with np.errstate(invalid="ignore", divide="ignore"):
        t_lcl_k = 1.0/(1.0/(td_k-56.0) + np.log(t_k/td_k)/800.0) + 56.0
        p_lcl = p_hpa * (t_lcl_k/t_k)**(1.0/RD_CP)
    return p_lcl, t_lcl_k-273.15

def _gradient_humit_aprox(t_c, p_hpa):
    t_k = t_c+273.15
    es = 6.112*np.exp(17.67*t_c/(t_c+243.5))
    ws = EPS*es/np.maximum(p_hpa-es, 0.1)
    num = 1.0+(2.5e6*ws)/(RD*t_k)
    den = 1.0+(0.622*(2.5e6**2)*ws)/(CP*RD*t_k**2)
    return (RD*t_k)/(CP*p_hpa)*(num/den)

def _perfil_parcela_a_nivell(t_sfc, td_sfc, p_sfc, p_dest):
    p_lcl, t_lcl = _lcl_bolton(t_sfc, td_sfc, p_sfc)
    t_sec = (t_sfc+273.15)*(p_dest/p_sfc)**RD_CP-273.15
    gamma_mig = _gradient_humit_aprox((t_lcl+t_sec)/2.0, (p_lcl+p_dest)/2.0)
    t_humit = t_lcl - gamma_mig*(p_lcl-p_dest)
    return np.where(p_dest >= p_lcl, t_sec, t_humit), p_lcl, t_lcl

def interpolar_graelles(arr, n_origen, n_desti):
    if n_origen == n_desti: return arr
    factor = n_desti/n_origen
    idx = np.clip(np.floor(np.arange(n_desti)/factor).astype(int), 0, n_origen-1)
    return arr[idx]

def calcular_convectiu(step, td_data, sfc_step, n_punts_sfc):
    """
    Calcula LCL, LFC, LI, EL.
    CORREGIT: El perfil de buoyancy s'avalua des de 1000 hPa fins a 100 hPa,
    independentment de la pressió de superfície. Si la superfície està per
    sota de 1000 hPa (mar), es fan servir tots els nivells. Si està per sobre
    (muntanya), els nivells per sota de la superfície s'ignoren perquè la
    parcel·la no pot existir sota terra.
    """
    if step not in td_data:
        return {}
    d = td_data[step]
    if not all(k in sfc_step for k in ["st","sd","sp"]):
        return {}

    t_sfc = np.where(np.isfinite(np.array(sfc_step["st"]["datos"], dtype=np.float64)), np.array(sfc_step["st"]["datos"], dtype=np.float64), np.nan)
    td_sfc = np.where(np.isfinite(np.array(sfc_step["sd"]["datos"], dtype=np.float64)), np.array(sfc_step["sd"]["datos"], dtype=np.float64), np.nan)
    p_sfc = np.where(np.isfinite(np.array(sfc_step["sp"]["datos"], dtype=np.float64)), np.array(sfc_step["sp"]["datos"], dtype=np.float64), np.nan)
    mask = ~(np.isnan(t_sfc)|np.isnan(td_sfc)|np.isnan(p_sfc))
    if not np.any(mask):
        return {}

    # Construir perfil des de P_MAX_CONV (1000) fins a P_MIN_CONV (100)
    pt, ptd, pl = [], [], []
    for n in PLEVS_PERFIL:
        if n > P_MAX_CONV or n < P_MIN_CONV:
            continue
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
        mask = ~(np.isnan(t_sfc)|np.isnan(td_sfc)|np.isnan(p_sfc))
        n_punts = n3
    else:
        n_punts = n_punts_sfc

    P = np.array(pl, dtype=np.float64)[:,None]*np.ones((1, n_punts))
    
    # Màscara: només avaluar nivells que estan PER SOTA de la superfície
    # (és a dir, pressió més alta que la superfície = més avall)
    T = np.where(P >= p_sfc[None,:], np.nan, T)

    p_lcl, _ = _lcl_bolton(t_sfc, td_sfc, p_sfc)
    p_lcl = np.where(mask, p_lcl, np.nan)
    lcl_m = _pressio_a_alcada_estandard(p_lcl)

    li = np.full(n_punts, np.nan)
    if 500 in pl:
        i500 = pl.index(500)
        tp, _, _ = _perfil_parcela_a_nivell(t_sfc, td_sfc, p_sfc, np.full(n_punts, 500.0))
        li = np.where(mask & ~np.isnan(T[i500]), T[i500]-tp, np.nan)

    tpn = np.full((len(pl), n_punts), np.nan)
    for k, n in enumerate(pl):
        tpn[k], _, _ = _perfil_parcela_a_nivell(t_sfc, td_sfc, p_sfc, np.full(n_punts, float(n)))

    psl = P < p_lcl[None,:]
    dv = np.where(psl & ~np.isnan(T), tpn-T, np.nan)
    an = _pressio_a_alcada_estandard(P[:,0])
    lfc_m, el_m = np.full(n_punts, np.nan), np.full(n_punts, np.nan)

    for i in range(n_punts):
        if not mask[i]:
            continue
        ix = np.where(psl[:,i] & ~np.isnan(dv[:,i]))[0]
        if len(ix) < 2:
            continue
        ds, al = dv[ix,i], an[ix]
        ps = np.where(ds > 0)[0]
        if len(ps) == 0:
            continue
        tr = []
        for j in range(ps[0], len(ds)):
            if ds[j] > 0:
                tr.append(al[j])
            else:
                break
        if len(tr) < 2 or tr[-1]-tr[0] < 1000:
            continue
        lfc_m[i], el_m[i] = tr[0], tr[-1]

    if n_punts_sfc != n3:
        lcl_m = interpolar_graelles(lcl_m, n3, n_punts_sfc)
        lfc_m = interpolar_graelles(lfc_m, n3, n_punts_sfc)
        li = interpolar_graelles(li, n3, n_punts_sfc)
        el_m = interpolar_graelles(el_m, n3, n_punts_sfc)

    r = {}
    for clau, arr, ndec, nom, unitat in [
        ("lcl_m", lcl_m, 0, "LCL (alçada)", "m"),
        ("lfc_m", lfc_m, 0, "LFC (alçada)", "m"),
        ("lifted_index", li, 1, "Lifted Index", "°C"),
        ("el_m", el_m, 0, "Equilibrium Level", "m"),
    ]:
        if np.any(~np.isnan(arr)):
            r[clau] = {"nombre": nom, "unidades": unitat, "datos": [round(float(v), ndec) if not np.isnan(v) else None for v in arr]}
    return r

# ═══════════════════ GEO500 + T500 ═══════════════════

def extreure_geo500_de_3d(steps_bloc, td_data, lats_3d, lons_3d):
    print(f"\n  ╔══════════════════════════════════════╗")
    print("  ║  🌐 GEO500 + T500 (des de meteofetch) ║")
    print("  ╚══════════════════════════════════════╝")

    geo_data_per_hora = {}

    if not lats_3d or not lons_3d:
        print("  ❌ No hi ha graella 3D disponible")
        return geo_data_per_hora

    n_esperat = len(lats_3d) * len(lons_3d)

    for step in steps_bloc:
        if SHUTDOWN_REQUESTED: break
        print(f"    +{step:02d}h...", end=" ", flush=True)

        arr_temp, arr_z = None, None
        dades_step = td_data.get(step, {})

        info_t = dades_step.get("t_500")
        if info_t and len(info_t.get("datos", [])) == n_esperat:
            arr_temp = np.array([v if v is not None else np.nan for v in info_t["datos"]], dtype=np.float64).reshape(len(lats_3d), len(lons_3d))

        info_z = dades_step.get("z_500")
        if info_z and len(info_z.get("datos", [])) == n_esperat:
            arr_z = np.array([v if v is not None else np.nan for v in info_z["datos"]], dtype=np.float64).reshape(len(lats_3d), len(lons_3d))

        geo_data_per_hora[step] = {
            "geopotencial_500_raw": arr_z,
            "temperatura_500_raw": arr_temp,
            "lats_raw": lats_3d,
            "lons_raw": lons_3d,
        }

        parts = []
        parts.append("GEO500 ✓" if (arr_z is not None and np.sum(~np.isnan(arr_z)) > 100) else "GEO500 ✗")
        parts.append("T500 ✓" if (arr_temp is not None and np.sum(~np.isnan(arr_temp)) > 100) else "T500 ✗")
        print(", ".join(parts))

    return geo_data_per_hora

# ═══════════════════ SRH + SHEAR ═══════════════════

G0_SHEAR = 9.80665

def pressio_a_alcada_shear(p_hpa):
    T0, p0, lapse = 288.15, 1013.25, 0.0065
    return (T0/lapse) * (1.0 - (p_hpa/p0)**(RD*lapse/G0_SHEAR))

def calcular_srh_i_shear(steps_bloc, td_data, lats_3d, lons_3d):
    """
    Calcula SRH 0-1km, SRH 0-3km, Shear 0-3km, Shear 0-6km
    a partir de les dades 3D de vent (u, v).
    """
    print(f"\n  ╔══════════════════════════════════════╗")
    print("  ║  🌪️  SRH + SHEAR (0-1km, 0-3km, 0-6km) ║")
    print("  ╚══════════════════════════════════════╝")

    shear_data_per_hora = {}

    if not lats_3d or not lons_3d:
        print("  ❌ No hi ha graella 3D disponible")
        return shear_data_per_hora

    nlat, nlon = len(lats_3d), len(lons_3d)
    n_esperat = nlat * nlon

    # Pressions disponibles i les seves alçades aproximades
    pressions_disponibles = sorted(NIVELLS_PRESSIO, reverse=True)
    alcades = {p: pressio_a_alcada_shear(p) for p in pressions_disponibles}

    for step in steps_bloc:
        if SHUTDOWN_REQUESTED: break
        print(f"    +{step:02d}h...", end=" ", flush=True)

        dades_step = td_data.get(step, {})

        # Extreure perfils de vent per a cada punt de graella
        srh_01 = np.full(nlat * nlon, np.nan)
        srh_03 = np.full(nlat * nlon, np.nan)
        shear_03 = np.full(nlat * nlon, np.nan)
        shear_06 = np.full(nlat * nlon, np.nan)

        # Per a cada punt de graella
        for idx in range(n_esperat):
            # Construir perfil de vent (u, v) per aquest punt
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

            # Ordenar per alçada creixent
            nivells_vent.sort(key=lambda n: n["z"])

            # Vent a superfície (primer nivell disponible)
            sfc = nivells_vent[0]

            # Interpolar vent a alçades específiques
            def vent_a_z(z_target):
                for i in range(len(nivells_vent) - 1):
                    a, b = nivells_vent[i], nivells_vent[i+1]
                    if a["z"] <= z_target <= b["z"]:
                        f = (z_target - a["z"]) / (b["z"] - a["z"]) if b["z"] != a["z"] else 0
                        return {"u": a["u"] + f*(b["u"]-a["u"]), "v": a["v"] + f*(b["v"]-a["v"])}
                return nivells_vent[-1]

            v0 = sfc
            v1km = vent_a_z(1000)
            v3km = vent_a_z(3000)
            v6km = vent_a_z(6000)

            # Bulk shear
            def bulk_shear(va, vb):
                du = vb["u"] - va["u"]
                dv = vb["v"] - va["v"]
                return np.sqrt(du*du + dv*dv)

            shear_03[idx] = round(bulk_shear(v0, v3km), 1)
            shear_06[idx] = round(bulk_shear(v0, v6km), 1)

            # Vent mitjà 0-6km (per SRH)
            def vent_mitja(z_bot, z_top):
                su, sv, sw = 0, 0, 0
                for i in range(len(nivells_vent)-1):
                    a, b = nivells_vent[i], nivells_vent[i+1]
                    z0 = max(a["z"], z_bot)
                    z1 = min(b["z"], z_top)
                    if z1 <= z0: continue
                    f0 = (z0 - a["z"])/(b["z"]-a["z"]) if b["z"]!=a["z"] else 0
                    f1 = (z1 - a["z"])/(b["z"]-a["z"]) if b["z"]!=a["z"] else 0
                    u0 = a["u"] + f0*(b["u"]-a["u"])
                    v0 = a["v"] + f0*(b["v"]-a["v"])
                    u1 = a["u"] + f1*(b["u"]-a["u"])
                    v1 = a["v"] + f1*(b["v"]-a["v"])
                    w = z1 - z0
                    su += 0.5*(u0+u1)*w
                    sv += 0.5*(v0+v1)*w
                    sw += w
                if sw == 0: return v0
                return {"u": su/sw, "v": sv/sw}

            vm06 = vent_mitja(0, 6000)

            # Storm motion (Bunkers simplificat)
            du06 = v6km["u"] - v0["u"]
            dv06 = v6km["v"] - v0["v"]
            shear_mag = np.sqrt(du06*du06 + dv06*dv06)
            if shear_mag > 0.1:
                D = 7.5  # m/s
                storm_u = vm06["u"] + D * (dv06 / shear_mag)
                storm_v = vm06["v"] + D * (-du06 / shear_mag)
            else:
                storm_u = vm06["u"]
                storm_v = vm06["v"]

            # SRH
            def calc_srh(z_top, su, sv):
                srh = 0
                for i in range(len(nivells_vent)-1):
                    a, b = nivells_vent[i], nivells_vent[i+1]
                    z0 = max(a["z"], 0)
                    z1 = min(b["z"], z_top)
                    if z1 <= z0: continue
                    f0 = (z0-a["z"])/(b["z"]-a["z"]) if b["z"]!=a["z"] else 0
                    f1 = (z1-a["z"])/(b["z"]-a["z"]) if b["z"]!=a["z"] else 0
                    u0 = a["u"] + f0*(b["u"]-a["u"])
                    v0 = a["v"] + f0*(b["v"]-a["v"])
                    u1 = a["u"] + f1*(b["u"]-a["u"])
                    v1 = a["v"] + f1*(b["v"]-a["v"])
                    srh += (u0-su)*(v1-sv) - (u1-su)*(v0-sv)
                return srh

            srh_01[idx] = round(calc_srh(1000, storm_u, storm_v), 1)
            srh_03[idx] = round(calc_srh(3000, storm_u, storm_v), 1)

        # Guardar resultats
        shear_data_per_hora[step] = {
            "srh_01": srh_01,
            "srh_03": srh_03,
            "shear_03": shear_03,
            "shear_06": shear_06,
        }

        ok = sum(1 for x in [srh_01, srh_03, shear_03, shear_06] if np.sum(~np.isnan(x)) > 100)
        print(f"{ok}/4 calculats ✓")

    return shear_data_per_hora

# ═══════════════════ GENERAR JSON FRACCIONAT ═══════════════════

def _convertir_temperatura_500_a_celsius(arr):
    if arr is None: return None
    arr = np.asarray(arr, dtype=np.float64)
    amb_valors = arr[~np.isnan(arr)]
    if amb_valors.size == 0: return arr
    if np.nanmedian(amb_valors) > 100: arr = arr - 273.15
    return arr

def _convertir_geopotencial_500_a_dam(arr):
    if arr is None: return None
    arr = np.asarray(arr, dtype=np.float64)
    amb_valors = arr[~np.isnan(arr)]
    if amb_valors.size == 0: return arr
    mediana = np.nanmedian(amb_valors)
    if mediana > 10000: arr = arr / (9.80665 * 10.0)
    elif mediana > 1000: arr = arr / 10.0
    return arr

def generar_js_fraccionat(step, variables, run_date, lats, lons, prefix, total_steps, geo_data=None, shear_data=None):
    if not variables and not geo_data and not shear_data: return []

    n = len(lats)*len(lons)
    fitxers_generats = []

    run_dt = datetime.fromisoformat(str(run_date).replace('+00:00', ''))
    valid_dt = run_dt + timedelta(hours=step)
    madrid = valid_dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Madrid"))

    hora_dir = OUTPUT_DIR / f"{step:02d}"
    hora_dir.mkdir(parents=True, exist_ok=True)

    # ── GEO500 + T500 ──
    if geo_data and step in geo_data:
        lats_dst = np.array(lats)
        lons_dst = np.array(lons)
        lats_src_step = geo_data[step].get("lats_raw")
        lons_src_step = geo_data[step].get("lons_raw")

        mateixa_graella = (
            lats_src_step is not None and lons_src_step is not None and
            len(lats_src_step) == len(lats_dst) and len(lons_src_step) == len(lons_dst) and
            np.allclose(lats_src_step, lats_dst, atol=1e-3) and
            np.allclose(lons_src_step, lons_dst, atol=1e-3)
        )

        lon_mesh_dst, lat_mesh_dst = np.meshgrid(lons_dst, lats_dst)

        for var_nom, clau_raw in [("geopotencial_500", "geopotencial_500_raw"), ("temperatura_500", "temperatura_500_raw")]:
            if geo_data[step].get(clau_raw) is not None:
                try:
                    arr = geo_data[step][clau_raw]
                    if arr is not None and np.sum(~np.isnan(arr)) > 100:
                        if mateixa_graella:
                            arr_interp = arr
                        else:
                            lats_src = np.array(lats_src_step)
                            lons_src = np.array(lons_src_step)
                            lon_src, lat_src = np.meshgrid(lons_src, lats_src)
                            mask = ~np.isnan(arr)
                            punts = np.column_stack((lon_src[mask].ravel(), lat_src[mask].ravel()))
                            vals = arr[mask].ravel()
                            arr_interp = griddata(punts, vals, (lon_mesh_dst, lat_mesh_dst), method='linear', fill_value=np.nan)
                            arr_interp = np.flipud(arr_interp)

                        if var_nom == "geopotencial_500":
                            arr_interp = _convertir_geopotencial_500_a_dam(arr_interp)
                            nom, unitat, ndec, rang_min, rang_max = "Geopotencial 500hPa", "dam", 1, 300, 700
                        else:
                            arr_interp = _convertir_temperatura_500_a_celsius(arr_interp)
                            nom, unitat, ndec, rang_min, rang_max = "Temperatura 500hPa", "°C", 1, -80, 50

                        dades = [round(float(v), ndec) if (not np.isnan(v) and rang_min <= v <= rang_max) else None for v in arr_interp.flatten()]
                        variables[var_nom] = {"nombre": nom, "unidades": unitat, "datos": dades}
                except Exception as e:
                    avisar(f"no s'ha pogut interpolar {var_nom}: {e}")

    # ── SRH + SHEAR ──
    if shear_data and step in shear_data:
        shear_vars = {
            "srh_01": ("SRH 0-1km", "m²/s²", 0),
            "srh_03": ("SRH 0-3km", "m²/s²", 0),
            "shear_03": ("Shear 0-3km", "m/s", 1),
            "shear_06": ("Shear 0-6km", "m/s", 1),
        }
        for var_nom, (nom, unitat, ndec) in shear_vars.items():
            arr = shear_data[step].get(var_nom)
            if arr is not None and np.sum(~np.isnan(arr)) > 100:
                dades = [round(float(v), ndec) if not np.isnan(v) else None for v in arr]
                variables[var_nom] = {"nombre": nom, "unidades": unitat, "datos": dades}

    def escriure_grup(nom_grup, vars_grup, tipus="sfc"):
        if not vars_grup: return
        data = {
            "hora_utc": valid_dt.strftime("%Y-%m-%dT%H:%M"),
            "hora_madrid": madrid.strftime("%Y-%m-%d %H:%M %Z"),
            "run_utc": run_dt.strftime("%Y-%m-%dT%H:%M"),
            "step": step, "total_steps": total_steps, "modelo": "AROME0025",
            "coordenadas": {"lat": lats, "lon": lons},
            "variables": vars_grup, "tipo": tipus, "grupo": nom_grup,
        }
        path = hora_dir / f"{nom_grup}.js"
        try:
            escriure_json_atomic(path, data)
            kb = path.stat().st_size / 1024
            fitxers_generats.append((str(path), path.stat().st_size))
            if kb > 100: print(f"    {step:02d}/{nom_grup}.js: {kb:.0f} KB ({len(vars_grup)} vars)")
        except OSError as e: avisar(f"no s'ha pogut escriure {path.name}: {e}")

    for clau in VARS_INDIVIDUALS_SFC:
        if clau in variables and len(variables[clau].get("datos",[])) == n:
            escriure_grup(clau, {clau: variables[clau]}, "sfc")

    for nom_grup, claus_grup in GRUPS_SFC.items():
        vars_grup = {c: variables[c] for c in claus_grup if c in variables and len(variables[c].get("datos",[])) == n}
        escriure_grup(nom_grup, vars_grup, "sfc")

    for clau in VARS_OPCIONALS_SFC:
        if clau in variables and len(variables[clau].get("datos",[])) == n:
            escriure_grup(clau, {clau: variables[clau]}, "sfc")

    if prefix == "3d":
        nivells_vars = {}
        for clau, info in variables.items():
            if len(info.get("datos",[])) != n: continue
            parts = clau.rsplit("_", 1)
            if len(parts) == 2 and parts[1].isdigit():
                var_base, nivell = parts[0], int(parts[1])
                if var_base in VARS_3D: nivells_vars.setdefault(nivell, {})[clau] = info
        for nivell in sorted(nivells_vars):
            escriure_grup(f"nivell_{nivell}", nivells_vars[nivell], "3d")

    variables_disponibles = sorted([f.stem for f in hora_dir.glob("*.js") if f.stem != "status"])
    status_hora = {
        "hora_utc": valid_dt.strftime("%Y-%m-%dT%H:%M"),
        "hora_madrid": madrid.strftime("%Y-%m-%d %H:%M %Z"),
        "run_utc": run_dt.strftime("%Y-%m-%dT%H:%M"),
        "step": step, "total_steps": total_steps, "modelo": "AROME0025",
        "coordenadas": {"lat": lats, "lon": lons},
        "variables_disponibles": variables_disponibles,
        "num_variables": len(variables_disponibles),
    }
    escriure_json_atomic(hora_dir / "status.json", status_hora)

    return fitxers_generats

# ═══════════════════ MAIN ═══════════════════

def main():
    t0 = time.time()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log_path, fitxer_log = configurar_log()

    netejar_tmp()
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    exit_code = 0
    sfc_data, td_data, steps_bloc = {}, {}, []
    run_mf = run_wcs = None
    fitxers, pes_total = [], 0
    geo_data_per_hora = {}
    shear_data_per_hora = {}

    try:
        print("=" * 65)
        print(f"  AROME {TOTAL_HORES}h: FRACCIONAT + GEO500 + T500 + SRH + SHEAR")
        print("=" * 65)

        try: import meteofetch
        except ImportError: sys.exit("❌ Falta 'meteofetch'")

        if not comprovar_connexio(): sys.exit(1)
        borrar_antics()

        session = requests.Session()
        session.headers.update({"apikey": CFG.key})

        print("\n  GetCapabilities...", end=" ", flush=True)
        url = f"{CFG.base}/wcs/{CFG.svc}/GetCapabilities?SERVICE=WCS&VERSION=2.0.1&LANGUAGE=eng"
        r = None
        for intent in range(1, 8):
            try:
                r = session.get(url, timeout=30)
                if r.status_code == 200 and len(r.content) > 1000: break
                time.sleep(_backoff(intent))
            except: pass

        if not r or r.status_code != 200: sys.exit("❌ GetCapabilities")

        root = ET.fromstring(r.content)
        cov_ids = [e.text.strip() for e in root.iter('{http://www.opengis.net/wcs/2.0}CoverageId')]
        print(f"✓ {len(cov_ids)} coverages")

        runs = sorted({m.group(1) for cid in cov_ids if (m := re.search(r'(\d{4}-\d{2}-\d{2}T\d{2})\.\d{2}\.\d{2}Z', cid))}, reverse=True)
        if not runs: sys.exit("❌ No runs")
        print(f"  Runs WCS: {', '.join(runs[:5])}")

        run_mf = trobar_millor_run_meteofetch(runs)
        run_wcs = trobar_run_wcs_mes_proper(runs, run_mf)

        run_dt_mf = datetime.strptime(run_mf + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
        run_dt_wcs = datetime.strptime(run_wcs + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
        steps_bloc = calcular_steps(run_dt_mf, TOTAL_HORES)

        print(f"\n  ✅ Run meteofetch: {run_mf}Z")
        print(f"  ✅ Run WCS:        {run_wcs}Z")
        print(f"  Steps: +{steps_bloc[0]}h a +{steps_bloc[-1]}h ({len(steps_bloc)} hores)")

        sfc_mf, lats_mf, lons_mf = descarregar_sfc_meteofetch(steps_bloc, run_dt_mf)
        sfc_wcs, lats_wcs, lons_wcs = ({}, None, None) if SHUTDOWN_REQUESTED else descarregar_sfc_wcs(steps_bloc, run_dt_wcs, run_wcs, cov_ids)
        td_data_tmp, lats_3d, lons_3d = ({}, None, None) if SHUTDOWN_REQUESTED else descarregar_3d(steps_bloc, run_dt_mf)
        td_data.update(td_data_tmp)

        geo_data_per_hora = extreure_geo500_de_3d(steps_bloc, td_data, lats_3d, lons_3d)
        shear_data_per_hora = calcular_srh_i_shear(steps_bloc, td_data, lats_3d, lons_3d)

        for step in steps_bloc:
            sfc_data[step] = {}
            if step in sfc_mf: sfc_data[step].update(sfc_mf[step])
            if step in sfc_wcs: sfc_data[step].update(sfc_wcs[step])

        lats_sfc, lons_sfc = lats_mf, lons_mf

        if sfc_wcs and lats_mf and lats_wcs and len(lats_mf) != len(lats_wcs):
            print("\n  ╔══════════════════════════════════════╗")
            print("  ║  🔄 Interpolant WCS → meteofetch    ║")
            print("  ╚══════════════════════════════════════╝")
            n_mf, n_wcs = len(lats_mf), len(lats_wcs)
            y_wcs = np.linspace(CFG.la1, CFG.la0, n_wcs)
            x_wcs = np.linspace(CFG.lo0, CFG.lo1, len(lons_wcs))
            y_mf = np.linspace(CFG.la1, CFG.la0, n_mf)
            x_mf = np.linspace(CFG.lo0, CFG.lo1, len(lons_mf))
            Y_mf, X_mf = np.meshgrid(y_mf, x_mf, indexing='ij')
            pts_mf = np.column_stack([Y_mf.ravel(), X_mf.ravel()])
            for step in steps_bloc:
                if step not in sfc_wcs: continue
                for var_name in list(sfc_wcs[step].keys()):
                    arr_wcs = np.array(sfc_wcs[step][var_name]["datos"], dtype=np.float64).reshape(n_wcs, -1)
                    fn = RegularGridInterpolator((y_wcs, x_wcs), arr_wcs, method='linear', bounds_error=False, fill_value=np.nan)
                    dades = [round(float(v),1) if not np.isnan(v) else None for v in fn(pts_mf)]
                    sfc_data.setdefault(step, {})[var_name] = {"nombre": sfc_wcs[step][var_name]["nombre"], "unidades": sfc_wcs[step][var_name]["unidades"], "datos": dades}
            print(f"  ✅ Interpolació completada")

        if lats_sfc and td_data:
            print("\n  ╔══════════════════════════════════════╗")
            print("  ║  🌡️  Convectiu (LCL, LFC, LI, EL)    ║")
            print("  ╚══════════════════════════════════════╝")
            n_punts = len(lats_sfc)*len(lons_sfc)
            t0c = time.time()
            for step in steps_bloc:
                if step in sfc_data and step in td_data:
                    try:
                        cv = calcular_convectiu(step, td_data, sfc_data[step], n_punts)
                        if cv: sfc_data[step].update(cv)
                    except: pass
            print(f"  ✅ {format_time(time.time()-t0c)}")

        print("\n  ╔══════════════════════════════════════╗")
        print("  ║  📦 GENERANT JSONs FRACCIONATS       ║")
        print("  ╚══════════════════════════════════════╝")

        ts = len(steps_bloc)
        for step in steps_bloc:
            if step in sfc_data and sfc_data[step] and lats_sfc:
                res = generar_js_fraccionat(step, sfc_data[step], run_dt_mf, lats_sfc, lons_sfc, "sfc", ts, geo_data_per_hora, shear_data_per_hora)
                if res:
                    fitxers.extend([r[0] for r in res])
                    pes_total += sum(r[1] for r in res)
            if step in td_data and td_data[step] and lats_3d:
                res = generar_js_fraccionat(step, td_data[step], run_dt_mf, lats_3d, lons_3d, "3d", ts)
                if res:
                    fitxers.extend([r[0] for r in res])
                    pes_total += sum(r[1] for r in res)

        print(f"\n  ✅ Fitxers: {len(fitxers)} | Pes: {format_size(pes_total)}")

        status_general = {
            "generat": datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "run_meteofetch": run_mf, "run_wcs": run_wcs,
            "total_hores": len(steps_bloc), "hores": steps_bloc,
            "fitxers": len(fitxers), "pes_total_mb": round(pes_total/(1024*1024), 1),
            "temps_total_segons": round(time.time()-t0),
            "estructura": "fraccionat_optimitzat_complet",
        }
        escriure_json_atomic(OUTPUT_DIR / "status.json", status_general)

        print(f"\n  {'⚠️  INTERROMPUT' if SHUTDOWN_REQUESTED else '✅ FINALITZAT'}")
        print(f"  Fitxers: {len(fitxers)} | Pes: {format_size(pes_total)} | Temps: {format_time(time.time()-t0)}")

    except SystemExit as e: exit_code = e.code if isinstance(e.code, int) else 1
    except Exception as e:
        print(f"\n  ❌ ERROR: {e}")
        traceback.print_exc()
        exit_code = 1
    finally:
        netejar_tmp()
        print(f"\n  📝 Log: {log_path}")

    sys.exit(exit_code)

if __name__ == "__main__":
    main()