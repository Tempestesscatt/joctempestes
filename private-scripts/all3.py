#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
arpege.py — ARPEGE Downloader
Basat en AROME Downloader ULTRA MEJORADO
- Llegeix config4.json
- Desa a web_data/ARPEGE/
- Totes les hores disponibles del run
- Reintents per variables crítiques
"""

import io, json, logging, os, sys, threading, time, subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
import numpy as np, requests, tifffile, xml.etree.ElementTree as ET
from scipy.interpolate import RegularGridInterpolator
from dotenv import load_dotenv
load_dotenv()

# ─── LOGGING ───────────────────────────────────────────
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(LOG_DIR, "arpege.log"), encoding="utf-8")
    ]
)
log = logging.getLogger("arpege")

# ─── CONFIG ────────────────────────────────────────────
class CFG:
    def __init__(self, f):
        with open(f, encoding="utf-8") as fh:
            c = json.load(fh)
        
        self.key = c["api_key"]
        
        # ARPEGE
        arpege = c["arpege"]
        self.base = arpege["api_base"]
        self.svc_sfc = arpege["service_sfc"]
        self.svc_3d = arpege["service_3d"]
        self.delay = arpege.get("availability_delay_minutes", 360)
        
        # HTTP
        http = c["http"]
        self.timeout = http["timeout_seconds"]
        self.retry = http["max_retries"]
        self.rdelay = http["retry_delay_base"]
        self.rl = http["rate_limit_delay"]
        self.idelay = http["inter_request_delay"]
        
        # Regió
        r = c["region"]
        self.lon0 = r["lon_min"]
        self.lon1 = r["lon_max"]
        self.lat0 = r["lat_min"]
        self.lat1 = r["lat_max"]
        self.name = r["name"]
        
        # Output
        self.out = arpege.get("output_dir", "web_data/ARPEGE")
        
        # Grids
        self.nsfc = c["sfc"]["n_grid"]
        self.wsfc = c["sfc"]["workers"]
        self.n3d = c["3d"]["n_grid"]
        self.w3d = c["3d"]["workers"]
        self.plevs = c["3d"]["pressure_levels"]
        
        # Session HTTP
        self.ses = requests.Session()
        self.ses.headers.update({"apikey": self.key})
        self.lock = threading.Semaphore(6)

cfg = CFG("config4.json")

# ─── VARIABLES CRÍTIQUES ───────────────────────────────
CRITICAL_VARS = ["st", "su", "sv", "srh", "sd", "sp", "pressure_msl"]
TEMPORAL_VARS = ["rain", "snow", "graupel", "hail", "lightning", "lightning_3h"]

# ─── API ───────────────────────────────────────────────
def get_capabilities(service):
    """Obté coverages disponibles"""
    for a in range(30):
        try:
            r = cfg.ses.get(
                f"{cfg.base}/wcs/{service}/GetCapabilities",
                params={"SERVICE": "WCS", "VERSION": "2.0.1", "LANGUAGE": "eng"},
                timeout=cfg.timeout
            )
            if r.status_code == 200:
                covs = [e.text.strip() for e in ET.fromstring(r.content).iter("{http://www.opengis.net/wcs/2.0}CoverageId")]
                if covs:
                    return covs
            elif r.status_code == 429:
                time.sleep(cfg.rl)
        except:
            pass
        time.sleep(min(10 * (a + 1), 120))
    raise RuntimeError("API ARPEGE no disponible")

def get_dates(coverages):
    """Extreu dates disponibles"""
    ds = set()
    for c in coverages:
        p = c.split("___")
        if len(p) >= 2:
            try:
                ds.add(datetime.strptime(p[-1][:10], "%Y-%m-%d").date())
            except:
                pass
    return sorted(ds)

def find_coverage(coverages, prefix, dt, run_date=None, period=None):
    """Troba el coverage correcte"""
    day = dt.strftime("%Y-%m-%d")
    rday = run_date.strftime("%Y-%m-%d") if run_date else None
    RUNS = ["T18.00.00Z", "T12.00.00Z", "T06.00.00Z", "T00.00.00Z"]
    
    def ok(c):
        if not c.startswith(prefix):
            return False
        if period and period not in c:
            return False
        if not period and ("_PT" in c or any(f"_P{n}D" in c for n in range(1, 10))):
            return False
        return day in c or (rday and rday in c)
    
    for rh in RUNS:
        m = sorted(c for c in coverages if ok(c) and day in c and rh in c)
        if m:
            return m[-1]
    
    if rday and rday != day:
        for rh in RUNS:
            m = sorted(c for c in coverages if ok(c) and rday in c and rh in c)
            if m:
                return m[-1]
    
    m = sorted(c for c in coverages if ok(c))
    return m[-1] if m else None

def download_tile(service, coverage_id, t_iso, height=None, pressure=None):
    """Descarrega un tile"""
    if not coverage_id:
        return None
    
    url = (
        f"{cfg.base}/wcs/{service}/GetCoverage"
        f"?SERVICE=WCS&VERSION=2.0.1"
        f"&COVERAGEID={coverage_id}"
        f"&FORMAT=image/tiff"
        f"&SUBSET=long({cfg.lon0},{cfg.lon1})"
        f"&SUBSET=lat({cfg.lat0},{cfg.lat1})"
        f"&SUBSET=time({t_iso})"
    )
    
    if height:
        url += f"&SUBSET=height({height})"
    if pressure:
        url += f"&SUBSET=pressure({pressure})"
    
    for a in range(cfg.retry):
        try:
            with cfg.lock:
                r = cfg.ses.get(url, timeout=cfg.timeout)
                if r.status_code == 200:
                    arr = tifffile.imread(io.BytesIO(r.content)).astype(np.float32)
                    if arr.ndim == 3:
                        arr = arr[0]
                    time.sleep(cfg.idelay)
                    return arr
                if r.status_code == 429:
                    time.sleep(cfg.rl + a * 2)
                if r.status_code in (400, 404):
                    return None
        except Exception as e:
            log.debug(f"Error tile: {e}")
            time.sleep(cfg.rdelay * (a + 1))
    return None

# ─── SPATIAL ───────────────────────────────────────────
def grid(n):
    la = np.linspace(cfg.lat0, cfg.lat1, n)
    lo = np.linspace(cfg.lon0, cfg.lon1, n)
    lon2, lat2 = np.meshgrid(lo, la[::-1])
    return la, lo, lon2, lat2

def interp(raw, la, lo):
    nr, nc = raw.shape
    fn = RegularGridInterpolator(
        (np.linspace(cfg.lat0, cfg.lat1, nr), np.linspace(cfg.lon0, cfg.lon1, nc)),
        raw[::-1, :],
        method="linear",
        bounds_error=False,
        fill_value=np.nan
    )
    pts = np.array([[lt, ln] for lt in la for ln in lo])
    return fn(pts).reshape(len(la), len(lo))

def pack(acc, h0, h1, n):
    nh = h1 - h0 + 1
    res = [[None] * nh for _ in range(n * n)]
    for hidx in range(nh):
        h = h0 + hidx
        if h in acc and acc[h] is not None:
            flat = acc[h][::-1, :].flatten()
            for i, v in enumerate(flat):
                if i < len(res):
                    res[i][hidx] = round(float(v), 1) if not np.isnan(v) else None
    return res

# ─── DOWNLOAD HORES ────────────────────────────────────
def download_sfc_hour(h, run_ref, coverages, rdate, la, lo):
    """Descarrega variables de superfície"""
    dt = run_ref + timedelta(hours=h)
    ts = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    def find_cov(prefix, period=None):
        return find_coverage(coverages, prefix, dt, rdate, period)
    
    def get_data(cov_id, height=None, factor=1.0):
        if not cov_id:
            return None
        raw = download_tile(cfg.svc_sfc, cov_id, ts, height=height)
        return interp(raw, la, lo) * factor if raw is not None else None
    
    def get_surface(cov_id, factor=1.0):
        return get_data(cov_id, factor=factor)
    
    tasks = {
        "st": lambda: get_data(find_cov("TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), height=2),
        "su": lambda: get_data(find_cov("U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), height=10),
        "sv": lambda: get_data(find_cov("V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), height=10),
        "srh": lambda: get_data(find_cov("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), height=2),
        "sd": lambda: get_data(find_cov("DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), height=2),
        "sp": lambda: get_surface(find_cov("PRESSURE__GROUND_OR_WATER_SURFACE"), factor=0.01),
        "spbl": lambda: get_surface(find_cov("PLANETARY_BOUNDARY_LAYER_HEIGHT__GROUND_OR_WATER_SURFACE")),
        "cape": lambda: get_surface(find_cov("CONVECTIVE_AVAILABLE_POTENTIAL_ENERGY__GROUND_OR_WATER_SURFACE")),
        "cin": lambda: get_surface(find_cov("CONVECTIVE_INHIBITION__GROUND_OR_WATER_SURFACE")),
        "cape_ml": lambda: get_surface(find_cov("MEAN_LAYER_CAPE__GROUND_OR_WATER_SURFACE")),
        "precip_water": lambda: get_surface(find_cov("PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE")),
        "rain": lambda: get_surface(find_cov("TOTAL_WATER_PRECIPITATION__GROUND_OR_WATER_SURFACE", "PT1H")),
        "snow": lambda: get_surface(find_cov("TOTAL_SNOW_PRECIPITATION__GROUND_OR_WATER_SURFACE", "PT1H")),
        "graupel": lambda: get_surface(find_cov("GRAUPEL__GROUND_OR_WATER_SURFACE", "PT1H")),
        "hail": lambda: get_surface(find_cov("HAIL__GROUND_OR_WATER_SURFACE", "PT1H")),
        "lightning": lambda: get_surface(find_cov("LIGHTNING_STRIKE_DENSITY_CUMULATED__GROUND_OR_WATER_SURFACE", "PT1H")),
        "lightning_3h": lambda: get_surface(find_cov("LIGHTNING_STRIKE_DENSITY_CUMULATED__GROUND_OR_WATER_SURFACE", "PT3H")),
        "wind_gust": lambda: get_data(find_cov("WIND_SPEED_GUST__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), height=10, factor=3.6),
        "pressure_msl": lambda: get_surface(find_cov("PRESSURE__MEAN_SEA_LEVEL"), factor=0.01),
        "snow_depth": lambda: get_surface(find_cov("SNOW_DEPTH__GROUND_OR_WATER_SURFACE")),
        "low_cloud": lambda: get_surface(find_cov("LOW_CLOUD_COVER__GROUND_OR_WATER_SURFACE")),
        "medium_cloud": lambda: get_surface(find_cov("MEDIUM_CLOUD_COVER__GROUND_OR_WATER_SURFACE")),
        "high_cloud": lambda: get_surface(find_cov("HIGH_CLOUD_COVER__GROUND_OR_WATER_SURFACE")),
        "total_cloud": lambda: get_surface(find_cov("TOTAL_CLOUD_COVER__GROUND_OR_WATER_SURFACE")),
    }
    
    results = {}
    with ThreadPoolExecutor(max_workers=cfg.wsfc) as ex:
        futures = {ex.submit(fn): key for key, fn in tasks.items()}
        for fu in as_completed(futures):
            key = futures[fu]
            try:
                val = fu.result()
                if val is not None:
                    results[key] = val
            except Exception as e:
                log.debug(f"SFC +{h}h {key}: {e}")
    
    return results

def download_3d_hour(h, run_ref, coverages, rdate, la, lo):
    """Descarrega variables 3D"""
    dt = run_ref + timedelta(hours=h)
    ts = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    def find_cov(prefix):
        return find_coverage(coverages, prefix, dt, rdate)
    
    def get_plevel(cov_id, pressure):
        if not cov_id:
            return None
        raw = download_tile(cfg.svc_3d, cov_id, ts, pressure=pressure)
        return interp(raw, la, lo) if raw is not None else None
    
    cid = {
        "temp": find_cov("TEMPERATURE__ISOBARIC_SURFACE"),
        "geo": find_cov("GEOPOTENTIAL__ISOBARIC_SURFACE"),
        "rh": find_cov("RELATIVE_HUMIDITY__ISOBARIC_SURFACE"),
        "u": find_cov("U_COMPONENT_OF_WIND__ISOBARIC_SURFACE"),
        "v": find_cov("V_COMPONENT_OF_WIND__ISOBARIC_SURFACE"),
        "dew": find_cov("DEW_POINT_TEMPERATURE__ISOBARIC_SURFACE"),
    }
    
    results = {}
    for plev in cfg.plevs:
        temp = get_plevel(cid["temp"], plev)
        if temp is None:
            continue
        
        tasks = {
            "t": lambda: temp,
            "geo": lambda: get_plevel(cid["geo"], plev),
            "rh": lambda: get_plevel(cid["rh"], plev),
            "u": lambda: get_plevel(cid["u"], plev),
            "v": lambda: get_plevel(cid["v"], plev),
            "dew": lambda: get_plevel(cid["dew"], plev),
        }
        
        level_data = {}
        with ThreadPoolExecutor(max_workers=cfg.w3d) as ex:
            futures = {ex.submit(fn): key for key, fn in tasks.items()}
            for fu in as_completed(futures):
                key = futures[fu]
                try:
                    val = fu.result()
                    if val is not None:
                        level_data[key] = val / 10.0 if key == "geo" else val
                except Exception as e:
                    log.debug(f"3D +{h}h {plev}hPa {key}: {e}")
        
        if "t" in level_data:
            results[plev] = level_data
    
    return results

# ─── PROCESSAR ─────────────────────────────────────────
def processar(label, h0, h1, run_ref, coverages, adates):
    """Processa un rang d'hores"""
    rdate = max(adates)
    la_s, lo_s, _, _ = grid(cfg.nsfc)
    la_3, lo_3, _, _ = grid(cfg.n3d)
    
    asfc = {}
    atd = {}
    hores = list(range(h0, h1 + 1))
    total = len(hores)
    
    log.info("[%s] +%02dh a +%02dh (%d hores)", label, h0, h1, total)
    
    G = 4
    for i in range(0, total, G):
        gh = hores[i:i+G]
        ng = len(gh)
        gt = (total + G - 1) // G
        print(f"\n  [{label}] Grup {i//G+1}/{gt}: {', '.join(f'+{h:02d}h' for h in gh)}")
        print(f"  └─ {ng*2} blocs (SFC+3D)...")
        
        with ThreadPoolExecutor(max_workers=ng*2) as ex:
            futs = {}
            for h in gh:
                futs[ex.submit(download_sfc_hour, h, run_ref, coverages, rdate, la_s, lo_s)] = ("sfc", h)
                futs[ex.submit(download_3d_hour, h, run_ref, coverages, rdate, la_3, lo_3)] = ("3d", h)
            
            tt = len(futs)
            comp = 0
            for fu in as_completed(futs):
                tp, h = futs[fu]
                try:
                    d = fu.result()
                    if tp == "sfc" and d:
                        asfc[h] = d
                    elif tp == "3d" and d:
                        atd[h] = d
                except Exception as e:
                    log.error("[%s] +%02dh %s: %s", label, h, tp, e)
                
                comp += 1
                pct = comp / tt * 100
                bar_w = 20
                bf = int(bar_w * comp / tt)
                bar = "[" + "#" * bf + "-" * (bar_w - bf) + "]"
                nv = len(asfc.get(h, {}))
                nn = len(atd.get(h, {}))
                sys.stdout.write(f"\r  {bar} {pct:5.1f}% | +{h:02d}h SFC:{nv}v 3D:{nn}n   ")
                sys.stdout.flush()
            print()
    
    # Control qualitat
    hores_ok = sum(1 for h in asfc if sum(1 for v in CRITICAL_VARS if v in asfc[h]) >= len(CRITICAL_VARS) - 1)
    pct_ok = hores_ok / total * 100 if total > 0 else 0
    log.info("[%s] Hores amb críticas: %d/%d (%.0f%%)", label, hores_ok, total, pct_ok)
    
    # Guardar
    files = []
    for block_start in range(h0, h1 + 1, 12):
        block_end = min(block_start + 11, h1)
        block_label = f"{label}_H{block_start:02d}-{block_end:02d}"
        
        sfc_block = {h: asfc[h] for h in asfc if block_start <= h <= block_end}
        td_block = {h: atd[h] for h in atd if block_start <= h <= block_end}
        
        if sfc_block:
            files.append(save_sfc(sfc_block, block_start, block_end, run_ref, block_label))
        if td_block:
            files.append(save_3d(td_block, block_start, block_end, run_ref, block_label))
    
    return files

# ─── SAVE ──────────────────────────────────────────────
def save_sfc(acc, h0, h1, run_ref, label):
    n = cfg.nsfc
    
    spd, wdir = {}, {}
    for h in acc:
        if "su" in acc[h] and "sv" in acc[h]:
            u, v = acc[h]["su"], acc[h]["sv"]
            spd[h] = np.sqrt(u**2 + v**2) * 3.6
            wdir[h] = (270 - np.degrees(np.arctan2(v, u))) % 360
    
    def ts(d):
        return pack(d, h0, h1, n)
    
    surface = {
        "wind_speed": ts(spd),
        "wind_direction": ts(wdir),
        "temperature": ts({h: acc[h]["st"] for h in acc if "st" in acc[h]}),
        "dew_point": ts({h: acc[h]["sd"] for h in acc if "sd" in acc[h]}),
        "relative_humidity": ts({h: acc[h]["srh"] for h in acc if "srh" in acc[h]}),
        "pressure_surface": ts({h: acc[h]["sp"] for h in acc if "sp" in acc[h]}),
        "pressure_msl": ts({h: acc[h]["pressure_msl"] for h in acc if "pressure_msl" in acc[h]}),
        "pbl_height": ts({h: acc[h]["spbl"] for h in acc if "spbl" in acc[h]}),
        "cape": ts({h: acc[h]["cape"] for h in acc if "cape" in acc[h]}),
        "cin": ts({h: acc[h]["cin"] for h in acc if "cin" in acc[h]}),
        "cape_mean_layer": ts({h: acc[h]["cape_ml"] for h in acc if "cape_ml" in acc[h]}),
        "precipitable_water": ts({h: acc[h]["precip_water"] for h in acc if "precip_water" in acc[h]}),
        "rain_1h": ts({h: acc[h]["rain"] for h in acc if "rain" in acc[h]}),
        "snowfall_1h": ts({h: acc[h]["snow"] for h in acc if "snow" in acc[h]}),
        "graupel_1h": ts({h: acc[h]["graupel"] for h in acc if "graupel" in acc[h]}),
        "hail_1h": ts({h: acc[h]["hail"] for h in acc if "hail" in acc[h]}),
        "lightning_1h": ts({h: acc[h]["lightning"] for h in acc if "lightning" in acc[h]}),
        "lightning_3h": ts({h: acc[h]["lightning_3h"] for h in acc if "lightning_3h" in acc[h]}),
        "wind_gust": ts({h: acc[h]["wind_gust"] for h in acc if "wind_gust" in acc[h]}),
        "snow_depth": ts({h: acc[h]["snow_depth"] for h in acc if "snow_depth" in acc[h]}),
        "low_cloud_cover": ts({h: acc[h]["low_cloud"] for h in acc if "low_cloud" in acc[h]}),
        "medium_cloud_cover": ts({h: acc[h]["medium_cloud"] for h in acc if "medium_cloud" in acc[h]}),
        "high_cloud_cover": ts({h: acc[h]["high_cloud"] for h in acc if "high_cloud" in acc[h]}),
        "total_cloud_cover": ts({h: acc[h]["total_cloud"] for h in acc if "total_cloud" in acc[h]}),
    }
    
    hours_utc = [(run_ref + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ") for h in range(h0, h1+1)]
    _, _, lon2, lat2 = grid(n)
    
    meta = {
        "model": "ARPEGE",
        "region": cfg.name,
        "extent": [cfg.lon0, cfg.lon1, cfg.lat0, cfg.lat1],
        "n_grid": n,
        "forecast_hours": h1 - h0 + 1,
        "date": (run_ref + timedelta(hours=h0)).strftime("%Y-%m-%d"),
        "run": run_ref.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "h_start_utc": h0,
        "h_end_utc": h1,
        "hours_utc": hours_utc,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    
    data = {
        "meta": meta,
        "lats": [round(float(x), 4) for x in lat2.flatten()],
        "lons": [round(float(x), 4) for x in lon2.flatten()],
        "hourly": {"surface": surface}
    }
    
    nm = label.lower().replace(" ", "_")
    fp = os.path.join(cfg.out, f"dades_{nm}_sfc.js")
    write_js(data, f"DADES_{label.upper()}_SFC", fp)
    return fp

def save_3d(acc, h0, h1, run_ref, label):
    n = cfg.n3d
    
    def ts(d):
        return pack(d, h0, h1, n)
    
    td_data = {}
    for plev in cfg.plevs:
        t_arr, geo_arr, rh_arr, u_arr, v_arr, dew_arr = {}, {}, {}, {}, {}, {}
        
        for h in acc:
            if plev in acc[h]:
                level = acc[h][plev]
                if "t" in level: t_arr[h] = level["t"]
                if "geo" in level: geo_arr[h] = level["geo"]
                if "rh" in level: rh_arr[h] = level["rh"]
                if "u" in level: u_arr[h] = level["u"]
                if "v" in level: v_arr[h] = level["v"]
                if "dew" in level: dew_arr[h] = level["dew"]
        
        spd2, dir2 = {}, {}
        for h in u_arr:
            if h in v_arr:
                spd2[h] = np.sqrt(u_arr[h]**2 + v_arr[h]**2) * 3.6
                dir2[h] = (270 - np.degrees(np.arctan2(v_arr[h], u_arr[h]))) % 360
        
        td_data[f"{plev}hPa"] = {
            "temperature": ts(t_arr),
            "geopotential": ts(geo_arr),
            "relative_humidity": ts(rh_arr),
            "dew_point": ts(dew_arr),
            "wind_speed": ts(spd2),
            "wind_direction": ts(dir2),
        }
    
    hours_utc = [(run_ref + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ") for h in range(h0, h1+1)]
    _, _, lon2, lat2 = grid(n)
    
    meta = {
        "model": "ARPEGE",
        "region": cfg.name,
        "extent": [cfg.lon0, cfg.lon1, cfg.lat0, cfg.lat1],
        "n_grid": n,
        "forecast_hours": h1 - h0 + 1,
        "pressure_levels": cfg.plevs,
        "date": (run_ref + timedelta(hours=h0)).strftime("%Y-%m-%d"),
        "run": run_ref.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "h_start_utc": h0,
        "h_end_utc": h1,
        "hours_utc": hours_utc,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    
    data = {
        "meta": meta,
        "lats": [round(float(x), 4) for x in lat2.flatten()],
        "lons": [round(float(x), 4) for x in lon2.flatten()],
        "hourly": td_data
    }
    
    nm = label.lower().replace(" ", "_")
    fp = os.path.join(cfg.out, f"dades_{nm}_3d.js")
    write_js(data, f"DADES_{label.upper()}_3D", fp)
    return fp

def write_js(data, varname, filepath):
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    tmp = filepath + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(f"const {varname} = ")
        json.dump(data, f, separators=(',', ':'))
        f.write(";\n")
    for _ in range(10):
        try:
            os.replace(tmp, filepath)
            break
        except PermissionError:
            time.sleep(3)
    mb = os.path.getsize(filepath) / 1024 / 1024
    print(f"  -> {os.path.basename(filepath)} ({mb:.1f} MB)")

# ─── AUTODEPLOY ────────────────────────────────────────
def run_autodeploy():
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "auto.py")
    if not os.path.exists(script_path):
        log.warning("auto.py no trobat")
        return
    log.info("Iniciant autodeploy...")
    try:
        subprocess.run([sys.executable, script_path], timeout=90000)
        log.info("Autodeploy ✅")
    except Exception as e:
        log.exception("Error autodeploy: %s", e)

# ─── MAIN ──────────────────────────────────────────────
def main():
    print("\n" + "="*55)
    print("  ARPEGE DOWNLOADER")
    print("="*55 + "\n")
    
    os.makedirs(cfg.out, exist_ok=True)
    
    print("[*] Obtenint coverages ARPEGE...")
    covs = get_capabilities(cfg.svc_sfc)
    adates = get_dates(covs)
    
    if not adates:
        print("[!] No hi ha dates disponibles")
        return
    
    latest = max(adates)
    now = datetime.now(timezone.utc)
    
    # Trobar millor run
    runs = [18, 12, 6, 0]
    srun = 0
    for rh in runs:
        rt = datetime(latest.year, latest.month, latest.day, rh, 0, tzinfo=timezone.utc)
        if rt > now + timedelta(hours=1):
            continue
        rs = f"T{rh:02d}.00.00Z"
        if any(latest.strftime("%Y-%m-%d") in c and rs in c for c in covs[:500]):
            srun = rh
            break
    
    print(f"[*] Run: {latest} {srun:02d}Z")
    run_ref = datetime(latest.year, latest.month, latest.day, srun, 0, tzinfo=timezone.utc)
    
    # ARPEGE: 102h (runs 00/12) o 72h (runs 06/18)
    max_h = 102 if srun in [0, 12] else 72
    
    print(f"[*] Hores disponibles: 0-{max_h}h")
    print(f"[*] Output: {cfg.out}/\n")
    
    all_files = []
    
    for block_start in range(0, max_h + 1, 24):
        block_end = min(block_start + 23, max_h)
        label = f"ARPEGE_{block_start:02d}-{block_end:02d}h"
        files = processar(label, block_start, block_end, run_ref, covs, adates)
        all_files.extend(files)
    
    print(f"\n[✅] DONE! {len(all_files)} fitxers")
    for f in all_files:
        print(f"    {os.path.basename(f)}")
    
    if all_files:
        run_autodeploy()

if __name__ == "__main__":
    main()