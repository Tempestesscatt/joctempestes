# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════╗
║         GFS → PNG Maps  ·  Europa  ·  v8.2                      ║
║  + Cicle automàtic cada dia a les 01:00 UTC                     ║
║  Mode unic: FULL → hora actual fins 300h (pas 10h)            ║
║  Descarrega paral·lela: sfc + pres + vortex simultanies        ║
║  Hores locals Madrid · Copyright @tempestes.cat                 ║
╚══════════════════════════════════════════════════════════════════╝
"""

import os, sys, time, logging, requests, warnings, json, tempfile, gc
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

warnings.filterwarnings("ignore")
os.environ.setdefault("ECCODES_PYTHON_WARNINGS", "0")

try:
    import cfgrib, xarray as xr
    HAS_CFGRIB = True
except ImportError:
    HAS_CFGRIB = False
    print("ERROR: cfgrib/xarray no instal·lats.")

try:
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.patheffects as pe
    from matplotlib.colors import BoundaryNorm, LinearSegmentedColormap, ListedColormap
    HAS_MPL = True
except ImportError:
    HAS_MPL = False
    print("ERROR: matplotlib no instal·lat.")

try:
    import cartopy.crs as ccrs
    import cartopy.feature as cfeature
    HAS_CARTOPY = True
except ImportError:
    HAS_CARTOPY = False
    print("ERROR: cartopy no instal·lat.")

try:
    from scipy.interpolate import RegularGridInterpolator
    from scipy.ndimage import gaussian_filter, label as scipy_label, distance_transform_edt
    from scipy.signal import argrelextrema
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

# ══════════════════════════════════════════════════════════════════
# CONFIGURACIO
# ══════════════════════════════════════════════════════════════════

LON_MIN, LON_MAX = -18.0, 18.0
LAT_MIN, LAT_MAX = 35.0,  60.0
MARGIN            = 6.0
N_GRID            = 500

TZ_MADRID = ZoneInfo("Europe/Madrid")

def get_forecast_hours(base_dt):
    """
    Retorna les hores de pronòstic a generar.
    Comença des de l'hora actual (arrodonida al múltiple de 10 superior)
    fins a 300 hores, amb un pas de 10 hores.
    """
    now_utc = datetime.now(timezone.utc)
    hours_elapsed = (now_utc - base_dt).total_seconds() / 3600
    
    # Arrodonim cap amunt al múltiple de 10 més proper
    start_h = int(np.ceil(hours_elapsed / 10) * 10)
    start_h = max(0, start_h)  # Mai comencem abans de 0
    
    end_h = 300  # Fins a 300 hores
    
    return list(range(start_h, end_h + 1, 10))

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_NAME = "tempestes-cat"
OUT_DIR = Path(PROJECT_DIR) / "public" / "webdataEU"

FIG_W, FIG_H = 10.8, 10.8
DPI_MAP      = 150

# Streamlines
STREAMLINE_COLOR      = '#3a3a5e'
STREAMLINE_ALPHA      = 0.55
STREAMLINE_LINEWIDTH  = 0.20
STREAMLINE_STEP       = 24
STREAMLINE_DT         = 1.2
STREAMLINE_MAX_STEPS  = 40
STREAMLINE_CELL       = 6
STREAMLINE_MIN_LENGTH = 10
STREAMLINE_ARROW_LEN  = 0.35

NO_BARBS_LEVELS = [1000, 925, 850, 700]

MAX_RETRIES      = 5
RETRY_SLEEP      = 8
DOWNLOAD_TIMEOUT = 240
DL_WORKERS       = 3

C, G, R, Y, GR, W, B, RS = "\033[96m", "\033[92m", "\033[91m", "\033[93m", "\033[90m", "\033[97m", "\033[1m", "\033[0m"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-7s  %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger('GFS')

def ts(): return datetime.now().strftime("%H:%M:%S")
def clog(color, icon, msg): print(f"  {color}{icon} {ts()} | {msg}{RS}", flush=True)

# ══════════════════════════════════════════════════════════════════
# CONVERSIO HORA UTC → MADRID
# ══════════════════════════════════════════════════════════════════

def utc_to_madrid_short(utc_str):
    dt_utc = datetime.strptime(utc_str, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
    dt_mad = dt_utc.astimezone(TZ_MADRID)
    tz_abbr = dt_mad.strftime('%Z')
    return dt_mad.strftime(f'%d/%m/%Y %H:%M {tz_abbr}')

# ══════════════════════════════════════════════════════════════════
# PALETES DE COLOR
# ══════════════════════════════════════════════════════════════════

def _cmap(stops):
    vals = [s['v'] for s in stops]
    lo, hi = min(vals), max(vals)
    span = hi - lo or 1.0
    return LinearSegmentedColormap.from_list('custom', [
        ((s['v'] - lo) / span, (s['r'] / 255, s['g'] / 255, s['b'] / 255))
        for s in stops
    ])

CMAP = {
    'temperature': _cmap([
        {'v':-30,'r':45,'g':0,'b':100},{'v':-18,'r':0,'g':0,'b':220},
        {'v':-6,'r':0,'g':190,'b':255},{'v':0,'r':0,'g':255,'b':200},
        {'v':6,'r':80,'g':235,'b':0},{'v':12,'r':230,'g':255,'b':0},
        {'v':18,'r':255,'g':185,'b':0},{'v':24,'r':255,'g':60,'b':0},
        {'v':30,'r':160,'g':0,'b':0},{'v':38,'r':160,'g':0,'b':160},
        {'v':46,'r':255,'g':180,'b':255}]),
    'wind': _cmap([
        {'v':0,'r':240,'g':248,'b':255},{'v':20,'r':100,'g':190,'b':255},
        {'v':40,'r':0,'g':90,'b':230},{'v':60,'r':200,'g':230,'b':80},
        {'v':80,'r':255,'g':200,'b':0},{'v':100,'r':255,'g':50,'b':0},
        {'v':150,'r':120,'g':0,'b':80},{'v':180,'r':80,'g':0,'b':120}]),
    'rain': _cmap([
        {'v':0,'r':255,'g':255,'b':255},{'v':1,'r':100,'g':210,'b':255},
        {'v':5,'r':0,'g':120,'b':255},{'v':10,'r':0,'g':230,'b':160},
        {'v':20,'r':0,'g':200,'b':60},{'v':40,'r':200,'g':245,'b':0},
        {'v':70,'r':255,'g':170,'b':0},{'v':120,'r':200,'g':0,'b':0},
        {'v':300,'r':200,'g':0,'b':200}]),
    'pressure': _cmap([
        {'v':970,'r':0,'g':0,'b':180},
        {'v':985,'r':0,'g':100,'b':255},
        {'v':1000,'r':100,'g':200,'b':255},
        {'v':1010,'r':200,'g':240,'b':255},
        {'v':1013,'r':255,'g':255,'b':255},
        {'v':1018,'r':255,'g':240,'b':200},
        {'v':1025,'r':255,'g':180,'b':100},
        {'v':1035,'r':255,'g':120,'b':0},
        {'v':1045,'r':255,'g':40,'b':0},
        {'v':1050,'r':180,'g':0,'b':0},
    ]),
    'humidity': _cmap([
        {'v':0,'r':255,'g':240,'b':200},{'v':40,'r':180,'g':230,'b':100},
        {'v':75,'r':0,'g':180,'b':160},{'v':95,'r':0,'g':60,'b':200},
        {'v':100,'r':20,'g':0,'b':120}]),
    'cape': _cmap([
        {'v':0,'r':20,'g':40,'b':120},{'v':100,'r':0,'g':80,'b':200},
        {'v':300,'r':0,'g':160,'b':255},{'v':600,'r':0,'g':240,'b':200},
        {'v':900,'r':100,'g':255,'b':60},{'v':1200,'r':220,'g':255,'b':0},
        {'v':1500,'r':255,'g':220,'b':0},{'v':1800,'r':255,'g':150,'b':0},
        {'v':2200,'r':255,'g':40,'b':0},{'v':2800,'r':200,'g':0,'b':80},
        {'v':3500,'r':180,'g':0,'b':255}]),
    'cin': _cmap([
        {'v':-500,'r':60,'g':0,'b':60},{'v':-300,'r':120,'g':0,'b':200},
        {'v':-150,'r':0,'g':80,'b':255},{'v':-50,'r':80,'g':200,'b':255},
        {'v':-10,'r':200,'g':240,'b':200},{'v':0,'r':255,'g':255,'b':255}]),
    'lifted': _cmap([
        {'v':-8,'r':100,'g':0,'b':0},{'v':-5,'r':200,'g':0,'b':0},
        {'v':-3,'r':255,'g':80,'b':0},{'v':-2,'r':255,'g':180,'b':0},
        {'v':-1,'r':255,'g':255,'b':0},{'v':0,'r':160,'g':255,'b':100},
        {'v':1,'r':60,'g':220,'b':220},{'v':2,'r':20,'g':160,'b':255},
        {'v':4,'r':0,'g':60,'b':220},{'v':8,'r':0,'g':0,'b':160},
        {'v':12,'r':60,'g':0,'b':140}]),
    'dewpoint': _cmap([
        {'v':-20,'r':100,'g':0,'b':80},{'v':-10,'r':0,'g':0,'b':200},
        {'v':0,'r':0,'g':100,'b':255},{'v':10,'r':0,'g':220,'b':220},
        {'v':15,'r':0,'g':200,'b':60},{'v':20,'r':100,'g':255,'b':0},
        {'v':25,'r':255,'g':255,'b':0},{'v':30,'r':255,'g':100,'b':0}]),
    'snow': _cmap([
        {'v':0,'r':255,'g':255,'b':255},{'v':1,'r':200,'g':230,'b':255},
        {'v':5,'r':120,'g':190,'b':255},{'v':10,'r':50,'g':130,'b':255},
        {'v':20,'r':0,'g':60,'b':220},{'v':35,'r':80,'g':0,'b':180},
        {'v':50,'r':160,'g':0,'b':200},{'v':75,'r':220,'g':0,'b':160}]),
    'pwat': _cmap([
        {'v':0,'r':255,'g':255,'b':220},{'v':10,'r':200,'g':240,'b':150},
        {'v':20,'r':80,'g':200,'b':80},{'v':30,'r':0,'g':160,'b':200},
        {'v':40,'r':0,'g':80,'b':255},{'v':50,'r':80,'g':0,'b':200}]),
    'pbl': _cmap([
        {'v':0,'r':240,'g':240,'b':255},{'v':500,'r':150,'g':200,'b':255},
        {'v':1000,'r':0,'g':180,'b':255},{'v':1500,'r':0,'g':230,'b':100},
        {'v':2000,'r':180,'g':255,'b':0},{'v':2500,'r':255,'g':200,'b':0},
        {'v':3000,'r':255,'g':80,'b':0}]),
    'dbz': _cmap([
        {'v':0,'r':200,'g':200,'b':200},{'v':10,'r':100,'g':200,'b':255},
        {'v':20,'r':0,'g':130,'b':255},{'v':30,'r':0,'g':200,'b':0},
        {'v':37,'r':0,'g':255,'b':0},{'v':40,'r':255,'g':255,'b':0},
        {'v':45,'r':255,'g':150,'b':0},{'v':50,'r':255,'g':0,'b':0},
        {'v':55,'r':200,'g':0,'b':0},{'v':60,'r':160,'g':0,'b':160},
        {'v':65,'r':255,'g':0,'b':255},{'v':75,'r':255,'g':200,'b':255}]),
    'cloud': _cmap([
        {'v':0,'r':255,'g':255,'b':255},{'v':20,'r':220,'g':235,'b':255},
        {'v':40,'r':160,'g':200,'b':255},{'v':60,'r':100,'g':150,'b':230},
        {'v':80,'r':60,'g':100,'b':200},{'v':100,'r':20,'g':40,'b':140}]),
    'vortex': _cmap([
        {'v':29000,'r':20,'g':0,'b':80},{'v':29500,'r':0,'g':0,'b':180},
        {'v':29800,'r':0,'g':80,'b':255},{'v':30000,'r':0,'g':200,'b':255},
        {'v':30200,'r':100,'g':255,'b':200},{'v':30500,'r':200,'g':255,'b':50},
        {'v':30800,'r':255,'g':220,'b':0},{'v':31000,'r':255,'g':140,'b':0},
        {'v':31200,'r':255,'g':40,'b':0},{'v':31500,'r':200,'g':0,'b':80},
        {'v':32000,'r':120,'g':0,'b':160}]),
    'temp_10hpa': _cmap([
        {'v':-85,'r':80,'g':0,'b':140},{'v':-80,'r':0,'g':0,'b':220},
        {'v':-75,'r':0,'g':100,'b':255},{'v':-70,'r':0,'g':200,'b':255},
        {'v':-65,'r':100,'g':255,'b':200},{'v':-60,'r':200,'g':255,'b':100},
        {'v':-55,'r':255,'g':255,'b':0},{'v':-50,'r':255,'g':200,'b':0},
        {'v':-45,'r':255,'g':100,'b':0},{'v':-40,'r':220,'g':0,'b':0}]),
    'heat_risk': ListedColormap(['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026']),
    'cold_risk': ListedColormap(['#d4eeff','#a8daff','#6baed6','#3182bd','#08519c']),
    'wind_risk': ListedColormap(['#e5f5e0','#a1d99b','#41ab5d','#238b45','#005a32']),
}

# ══════════════════════════════════════════════════════════════════
# CONFIGURACIO VARIABLES
# ══════════════════════════════════════════════════════════════════

SFC_VARS_CFG = {
    'temperature':        {'title':'Temperatura 2m',            'units':'°C',    'cmap':'temperature','levels':np.arange(-30,48,2),  'extend':'both',    'isobars':True},
    'dew_point':          {'title':'Punt de rosada 2m',         'units':'°C',    'cmap':'dewpoint',   'levels':np.arange(-20,32,2),  'extend':'both',    'isobars':True},
    'relative_humidity':  {'title':'Humitat relativa 2m',       'units':'%',     'cmap':'humidity',   'levels':np.arange(0,105,5),   'extend':'neither', 'isobars':True},
    'wind_speed':         {'title':'Vent 10m',                  'units':'km/h',  'cmap':'wind',       'levels':[0,5,10,15,20,25,30,40,50,60,75,100,130,160,200],'extend':'max','isobars':True},
    'wind_gusts':         {'title':'Ratxes de vent',            'units':'km/h',  'cmap':'wind',       'levels':[0,5,10,15,20,25,30,40,50,60,75,100,130,160,200],'extend':'max','isobars':True},
    'rain':               {'title':'Precipitacio acumulada',    'units':'mm',    'cmap':'rain',       'levels':[0,0.5,1,2,5,10,20,30,40,60,80,100,150,200,300,500],'extend':'max','isobars':True},
    'snow':               {'title':'Neu al sol',                'units':'cm',    'cmap':'snow',       'levels':[0,0.2,0.5,1,2,5,10,20,35,50,75],'extend':'max','isobars':True},
    'cape':               {'title':'CAPE',                      'units':'J/kg',  'cmap':'cape',       'levels':[0,100,300,500,700,900,1200,1500,1800,2200,2800,3500],'extend':'max','isobars':False},
    'cin':                {'title':'CIN',                       'units':'J/kg',  'cmap':'cin',        'levels':[-500,-300,-200,-150,-100,-50,-20,-5,0],'extend':'min','isobars':False},
    'mslp':               {'title':'Pressio nivell del mar',    'units':'hPa',   'cmap':'pressure',   'levels':np.arange(970,1052,2),'extend':'both',    'isobars':False},
    'precipitable_water': {'title':'Aigua precipitable',        'units':'kg/m2', 'cmap':'pwat',       'levels':np.arange(0,55,5),    'extend':'max',     'isobars':True},
    'pbl_height':         {'title':'Alcada capa limit',         'units':'m',     'cmap':'pbl',        'levels':[0,100,300,600,1000,1500,2000,2500,3000],'extend':'max','isobars':True},
    'reflectivity_dbz':   {'title':'Reflectivitat simulada',    'units':'dBZ',   'cmap':'dbz',        'levels':[0,5,10,15,20,25,30,33,37,40,45,50,55,60,65,70,75],'extend':'max','isobars':True},
    'lifted_index':       {'title':'Lifted Index',              'units':'K',     'cmap':'lifted',     'levels':np.arange(-8,13,1),   'extend':'both',    'isobars':False},
    'cloud_cover':        {'title':'Nuvolositat total',         'units':'%',     'cmap':'cloud',      'levels':np.arange(0,105,5),   'extend':'neither', 'isobars':True},
}

PRES_VARS_CFG = {
    'temperature':       {'title':'Temperatura',     'units':'°C',   'cmap':'temperature','levels':np.arange(-70,40,4),'extend':'both'},
    'wind_speed':        {'title':'Vent',             'units':'km/h', 'cmap':'wind',       'levels':[0,10,20,30,40,50,60,75,100,130,160,200,260,320],'extend':'max'},
    'relative_humidity': {'title':'Humitat relativa', 'units':'%',    'cmap':'humidity',   'levels':np.arange(0,105,10),'extend':'neither'},
}

RISK_VARS_CFG = {
    'heat_risk': {'title':'Risc de Calor','units':'Nivell','cmap':'heat_risk','levels':[0.5,1.5,2.5,3.5,4.5],'extend':'neither'},
    'cold_risk': {'title':'Risc de Fred', 'units':'Nivell','cmap':'cold_risk','levels':[0.5,1.5,2.5,3.5,4.5],'extend':'neither'},
    'wind_risk': {'title':'Risc de Vent', 'units':'Nivell','cmap':'wind_risk','levels':[0.5,1.5,2.5,3.5,4.5],'extend':'neither'},
}

VORTEX_VARS_CFG = {
    'vortex_geopot': {'title':'Vortex Polar · Geopotencial 10 hPa','units':'mgp', 'cmap':'vortex',    'levels':np.arange(29000,32200,100),'extend':'both'},
    'vortex_temp':   {'title':'Vortex Polar · Temperatura 10 hPa', 'units':'°C',  'cmap':'temp_10hpa','levels':np.arange(-85,-35,2.5),   'extend':'both'},
    'vortex_wind':   {'title':'Vortex Polar · Vent 10 hPa',        'units':'km/h','cmap':'wind',       'levels':[0,20,40,60,80,100,130,160,200,260,320,400],'extend':'max'},
}

SFC_VARS_DL    = {'var_TMP':'on','var_UGRD':'on','var_VGRD':'on','var_GUST':'on',
                  'var_CAPE':'on','var_CIN':'on','var_APCP':'on','var_DPT':'on',
                  'var_RH':'on','var_PRMSL':'on','var_PWAT':'on','var_HPBL':'on',
                  'var_TCDC':'on','var_REFC':'on','var_SNOD':'on','var_LFTX':'on'}
SFC_LEVELS_DL  = {'lev_2_m_above_ground':'on','lev_10_m_above_ground':'on',
                  'lev_surface':'on','lev_entire_atmosphere':'on',
                  'lev_mean_sea_level':'on','lev_planetary_boundary_layer':'on'}

PRES_VARS_DL   = {'var_TMP':'on','var_UGRD':'on','var_VGRD':'on','var_RH':'on','var_HGT':'on'}
PRES_LEVELS_DL = {'lev_925_mb':'on','lev_850_mb':'on',
                  'lev_500_mb':'on','lev_300_mb':'on'}

VORTEX_VARS_DL   = {'var_TMP':'on','var_UGRD':'on','var_VGRD':'on','var_HGT':'on'}
VORTEX_LEVELS_DL = {'lev_10_mb':'on'}

PRES_LEVELS = [925, 850, 500, 300]

# ══════════════════════════════════════════════════════════════════
# RUN SELECTOR
# ══════════════════════════════════════════════════════════════════

def get_best_run():
    now_utc = datetime.now(timezone.utc)
    candidates = []
    for delta_days in [0, -1]:
        d = now_utc + timedelta(days=delta_days)
        date_str = d.strftime('%Y%m%d')
        for run_h in [18, 12, 6, 0]:
            avail_h  = 5 if run_h == 0 else 4.5
            run_dt   = datetime(d.year, d.month, d.day, run_h, 0, 0, tzinfo=timezone.utc)
            avail_dt = run_dt + timedelta(hours=avail_h)
            if now_utc >= avail_dt:
                candidates.append((date_str, f"{run_h:02d}", run_dt))
    if not candidates:
        yesterday = now_utc - timedelta(days=1)
        date_str  = yesterday.strftime('%Y%m%d')
        run_dt    = datetime(yesterday.year, yesterday.month, yesterday.day, 18, 0, 0, tzinfo=timezone.utc)
        return date_str, '18', run_dt
    date_str, run_str, run_dt = candidates[0]
    clog(G, "✅", f"Run seleccionat: GFS {date_str} {run_str}Z")
    return date_str, run_str, run_dt

# ══════════════════════════════════════════════════════════════════
# DESCARREGA
# ══════════════════════════════════════════════════════════════════

def download_grib_bytes(date_str, run_str, fhour, tipus='sfc'):
    url = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl"
    params = {
        'file':      f'gfs.t{run_str}z.pgrb2.0p25.f{fhour:03d}',
        'dir':       f'/gfs.{date_str}/{run_str}/atmos',
        'subregion': '',
        'leftlon':   str(int(LON_MIN - MARGIN)),
        'rightlon':  str(int(LON_MAX + MARGIN)),
        'toplat':    str(int(LAT_MAX + MARGIN)),
        'bottomlat': str(int(LAT_MIN - MARGIN)),
    }
    if tipus == 'sfc':
        params.update(SFC_LEVELS_DL); params.update(SFC_VARS_DL)
    elif tipus == 'vortex':
        params.update(VORTEX_LEVELS_DL); params.update(VORTEX_VARS_DL)
    else:
        params.update(PRES_LEVELS_DL); params.update(PRES_VARS_DL)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.get(url, params=params, timeout=DOWNLOAD_TIMEOUT)
            if r.status_code == 200 and len(r.content) >= 2000:
                return r.content
            elif r.status_code == 404:
                return None
        except Exception:
            pass
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_SLEEP * attempt)
    return None

def download_all_parallel(date_str, run_str, fhour):
    results = {}
    with ThreadPoolExecutor(max_workers=DL_WORKERS) as ex:
        futures = {
            ex.submit(download_grib_bytes, date_str, run_str, fhour, 'sfc'):    'sfc',
            ex.submit(download_grib_bytes, date_str, run_str, fhour, 'pres'):   'pres',
            ex.submit(download_grib_bytes, date_str, run_str, fhour, 'vortex'): 'vortex',
        }
        for fut in as_completed(futures):
            key = futures[fut]
            try:
                results[key] = fut.result()
            except Exception:
                results[key] = None
    return results.get('sfc'), results.get('pres'), results.get('vortex')

# ══════════════════════════════════════════════════════════════════
# EXTRACCIO / INTERPOLACIO
# ══════════════════════════════════════════════════════════════════

def make_grid():
    return (np.linspace(LON_MIN, LON_MAX, N_GRID),
            np.linspace(LAT_MAX, LAT_MIN, N_GRID))

def extract_from_bytes(grib_bytes, filter_keys, candidates, offset=0.0, scale=1.0):
    if not HAS_CFGRIB or grib_bytes is None:
        return None
    dst_lons, dst_lats = make_grid()
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.grib2', delete=False) as tmp:
            tmp.write(grib_bytes); tmp_path = tmp.name
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            ds = xr.open_dataset(tmp_path, engine='cfgrib',
                filter_by_keys=filter_keys, backend_kwargs={'indexpath': ''})
        name = next((c for c in candidates if c in ds.data_vars), None)
        if name is None:
            name = next((k for k in ds.data_vars for c in candidates if c.lower() in k.lower()), None)
        if name is None:
            ds.close(); return None
        arr  = ds[name].values.astype(float)
        lats = ds['latitude'].values
        lons = ds['longitude'].values
        ds.close()
        while arr.ndim > 2: arr = arr[0]
        if lons.max() > 180:
            lons = np.where(lons > 180, lons - 360, lons)
            idx = np.argsort(lons); lons = lons[idx]; arr = arr[:, idx]
        jm = (lats >= LAT_MIN - MARGIN) & (lats <= LAT_MAX + MARGIN)
        im = (lons >= LON_MIN - MARGIN) & (lons <= LON_MAX + MARGIN)
        arr  = arr[jm][:, im]; lats = lats[jm]; lons = lons[im]
        if not HAS_SCIPY or arr.size == 0:
            return np.full((N_GRID, N_GRID), np.nan)
        if lats[0] > lats[-1]: lats = lats[::-1]; arr = arr[::-1, :]
        fn = RegularGridInterpolator((lats, lons), (arr + offset) * scale,
            method='linear', bounds_error=False, fill_value=np.nan)
        ml, mlo = np.meshgrid(dst_lats, dst_lons, indexing='ij')
        return fn(np.column_stack([ml.ravel(), mlo.ravel()])).reshape(N_GRID, N_GRID)
    except Exception:
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try: os.unlink(tmp_path)
            except: pass

# ══════════════════════════════════════════════════════════════════
# PROCESSAMENT
# ══════════════════════════════════════════════════════════════════

def process_sfc_from_bytes(grib_bytes):
    if not HAS_CFGRIB or grib_bytes is None: return None
    d = {}
    def te(var, fk, cands, offset=0.0, scale=1.0):
        g = extract_from_bytes(grib_bytes, fk, cands, offset, scale)
        if g is not None: d[var] = g
    te('temperature',       {'typeOfLevel':'heightAboveGround','level':2},  ['t2m','TMP','2t'],  offset=-273.15)
    te('dew_point',         {'typeOfLevel':'heightAboveGround','level':2},  ['d2m','DPT','2d'],  offset=-273.15)
    te('relative_humidity', {'typeOfLevel':'heightAboveGround','level':2},  ['r2','RH','2r'])
    u = extract_from_bytes(grib_bytes, {'typeOfLevel':'heightAboveGround','level':10}, ['u10','UGRD','10u'])
    v = extract_from_bytes(grib_bytes, {'typeOfLevel':'heightAboveGround','level':10}, ['v10','VGRD','10v'])
    if u is not None and v is not None:
        d['wind_u'] = u; d['wind_v'] = v; d['wind_speed'] = np.sqrt(u**2 + v**2) * 3.6
    gust = None
    for gf in [{'typeOfLevel':'heightAboveGround','level':10}, {'typeOfLevel':'surface'}]:
        for gn in ['gust','GUST','fg10']:
            g = extract_from_bytes(grib_bytes, gf, [gn], scale=3.6)
            if g is not None: gust = g; break
        if gust is not None: break
    d['wind_gusts'] = gust if gust is not None else d.get('wind_speed', np.zeros((N_GRID, N_GRID))) * 1.5
    for mf in [{'typeOfLevel':'meanSea'}, {'typeOfLevel':'meanSea','level':0}]:
        for mn in ['prmsl','PRMSL','msl','MSL']:
            m = extract_from_bytes(grib_bytes, mf, [mn], scale=0.01)
            if m is not None: d['mslp'] = m; break
        if 'mslp' in d: break
    te('rain',               {'typeOfLevel':'surface'},               ['tp','APCP'])
    te('cape',               {'typeOfLevel':'surface'},               ['cape','CAPE'])
    te('cin',                {'typeOfLevel':'surface'},               ['cin','CIN'])
    te('lifted_index',       {'typeOfLevel':'surface'},               ['lftx','LFTX'])
    te('cloud_cover',        {'typeOfLevel':'atmosphereSingleLayer'}, ['tcc','TCDC'])
    te('precipitable_water', {'typeOfLevel':'entireAtmosphere'},      ['pwat','PWAT'])
    te('pbl_height',         {'typeOfLevel':'planetaryBoundaryLayer'},['hpbl','HPBL'])
    te('reflectivity_dbz',   {'typeOfLevel':'entireAtmosphere'},      ['refc','REFC'])
    te('snow',               {'typeOfLevel':'surface'},               ['sde','SNOD'])
    return d if d else None

def process_pres_from_bytes(grib_bytes, level_hpa):
    if not HAS_CFGRIB or grib_bytes is None: return None
    d = {}; fk = {'typeOfLevel':'isobaricInhPa', 'level':level_hpa}
    def te(var, cands, offset=0.0, scale=1.0):
        g = extract_from_bytes(grib_bytes, fk, cands, offset, scale)
        if g is not None: d[var] = g
    te('temperature',       ['t','TMP'], offset=-273.15)
    te('relative_humidity', ['r','RH'])
    te('geopotential',      ['gh','HGT'])
    u = extract_from_bytes(grib_bytes, fk, ['u','UGRD'])
    v = extract_from_bytes(grib_bytes, fk, ['v','VGRD'])
    if u is not None and v is not None:
        d['wind_u'] = u; d['wind_v'] = v; d['wind_speed'] = np.sqrt(u**2 + v**2) * 3.6
    return d if d else None

def process_vortex_from_bytes(grib_bytes):
    if not HAS_CFGRIB or grib_bytes is None: return None
    d = {}; fk = {'typeOfLevel':'isobaricInhPa', 'level':10}
    g = extract_from_bytes(grib_bytes, fk, ['gh','HGT'])
    if g is not None: d['geopotential'] = g
    g = extract_from_bytes(grib_bytes, fk, ['t','TMP'], offset=-273.15)
    if g is not None: d['temperature'] = g
    u = extract_from_bytes(grib_bytes, fk, ['u','UGRD'])
    v = extract_from_bytes(grib_bytes, fk, ['v','VGRD'])
    if u is not None and v is not None:
        d['wind_u'] = u; d['wind_v'] = v; d['wind_speed'] = np.sqrt(u**2 + v**2) * 3.6
    return d if d else None

# ══════════════════════════════════════════════════════════════════
# DIBUIX
# ══════════════════════════════════════════════════════════════════

PROJ = (ccrs.LambertConformal(
    central_longitude=10.0, central_latitude=50.0,
    standard_parallels=(40.0, 60.0), cutoff=0
) if HAS_CARTOPY else None)

def _base_ax(fig, dark=False):
    ax = fig.add_axes([0.01, 0.06, 0.87, 0.90], projection=PROJ)
    ax.set_extent([LON_MIN, LON_MAX, LAT_MIN, LAT_MAX], crs=ccrs.PlateCarree())
    ocean_col = '#0a0a1e' if dark else '#c8dff0'
    land_col  = '#12122a' if dark else '#f0ece2'
    ax.add_feature(cfeature.OCEAN,     facecolor=ocean_col,  zorder=0)
    ax.add_feature(cfeature.LAND,      facecolor=land_col,   zorder=0)
    ax.add_feature(cfeature.LAKES,     facecolor=ocean_col, edgecolor='#5588aa', linewidth=0.3, zorder=1)
    ax.add_feature(cfeature.COASTLINE, linewidth=0.9, edgecolor='#111111' if not dark else '#aaaacc', zorder=4)
    ax.add_feature(cfeature.BORDERS,   linewidth=0.55, edgecolor='#333333' if not dark else '#8888aa', zorder=4)
    return ax

def _colorbar(fig, cf, cfg):
    cax = fig.add_axes([0.895, 0.10, 0.018, 0.78])
    cb  = fig.colorbar(cf, cax=cax, extend=cfg.get('extend', 'both'))
    cb.set_label(cfg['units'], fontsize=8, labelpad=7)
    cb.ax.tick_params(labelsize=7); cb.outline.set_linewidth(0.5)

def _contourf(ax, lon2d, lat2d, data, cfg):
    lvs  = np.array(cfg['levels'])
    cmap = CMAP.get(cfg['cmap'], plt.get_cmap('viridis'))
    norm = BoundaryNorm(lvs, ncolors=256, clip=False)
    return ax.contourf(lon2d, lat2d, data, levels=lvs, cmap=cmap, norm=norm,
                       extend=cfg.get('extend','both'),
                       transform=ccrs.PlateCarree(), alpha=0.88, zorder=2)

def _barbs(ax, u_ms, v_ms, lon2d, lat2d):
    step = 14
    sp   = np.sqrt(u_ms**2 + v_ms**2) * 3.6
    u_s  = u_ms[::step, ::step]; v_s = v_ms[::step, ::step]
    sp_s = sp[::step, ::step]; ln_s = lon2d[::step, ::step]; lt_s = lat2d[::step, ::step]
    mask = sp_s < 80
    if mask.any():
        ax.barbs(ln_s[mask], lt_s[mask], u_s[mask]*1.944, v_s[mask]*1.944,
                 transform=ccrs.PlateCarree(), length=5.0,
                 barb_increments=dict(half=5, full=10, flag=50),
                 linewidth=0.45, color='#1a1a2e', alpha=0.8, zorder=6)
    mask2 = sp_s >= 80
    if mask2.any():
        ax.barbs(ln_s[mask2], lt_s[mask2], u_s[mask2]*1.944, v_s[mask2]*1.944,
                 transform=ccrs.PlateCarree(), length=5.0,
                 barb_increments=dict(half=5, full=10, flag=50),
                 linewidth=0.6, color='#cc2200', alpha=0.88, zorder=7)

def _find_mslp_centers(mslp, lon2d, lat2d):
    """Troba centres d'altes (A) i baixes (B) pressions."""
    if mslp is None or np.all(np.isnan(mslp)): return [], []
    
    # Suavitzar una mica per evitar soroll
    smoothed = gaussian_filter(mslp, sigma=3)
    
    # Trobar màxims i mínims locals
    from scipy.ndimage import maximum_filter, minimum_filter
    
    # Màxims locals (Altes pressions)
    local_max = maximum_filter(smoothed, size=15) == smoothed
    local_min = minimum_filter(smoothed, size=15) == smoothed
    
    # Filtrar per valors raonables
    max_mask = local_max & (smoothed > 1015)  # Altes > 1015 hPa
    min_mask = local_min & (smoothed < 1010)  # Baixes < 1010 hPa
    
    highs = []
    lows = []
    
    # Extreure coordenades
    if max_mask.any():
        idx = np.where(max_mask)
        for i, j in zip(idx[0], idx[1]):
            highs.append((lon2d[i, j], lat2d[i, j], smoothed[i, j]))
    
    if min_mask.any():
        idx = np.where(min_mask)
        for i, j in zip(idx[0], idx[1]):
            lows.append((lon2d[i, j], lat2d[i, j], smoothed[i, j]))
    
    # Agrupar punts propers
    def cluster_points(points, distance_threshold=2.0):
        if not points:
            return []
        
        clusters = []
        used = set()
        
        for i, p1 in enumerate(points):
            if i in used:
                continue
            cluster = [p1]
            used.add(i)
            
            for j, p2 in enumerate(points):
                if j in used:
                    continue
                # Distància aproximada en graus
                dist = np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)
                if dist < distance_threshold:
                    cluster.append(p2)
                    used.add(j)
            
            # Prendre el centre del cluster (el més extrem)
            if len(cluster) > 1:
                # Per altes, el màxim; per baixes, el mínim
                center = max(cluster, key=lambda x: x[2]) if cluster[0][2] > 1013 else min(cluster, key=lambda x: x[2])
                clusters.append(center)
            else:
                clusters.append(cluster[0])
        
        return clusters
    
    highs = cluster_points(highs)
    lows = cluster_points(lows)
    
    # Limitar nombre de centres
    highs = sorted(highs, key=lambda x: x[2], reverse=True)[:5]  # Top 5 altes
    lows = sorted(lows, key=lambda x: x[2])[:5]  # Top 5 baixes
    
    return highs, lows

def _isobars(ax, lon2d, lat2d, mslp, label=True):
    if mslp is None or np.all(np.isnan(mslp)): return
    cs = ax.contour(lon2d, lat2d, mslp, levels=np.arange(970, 1052, 4),
                    colors='black', linewidths=0.6,
                    transform=ccrs.PlateCarree(), zorder=5, alpha=0.8)
    if label:
        lbls = ax.clabel(cs, inline=True, fontsize=5.5, fmt='%d', colors='black', inline_spacing=4)
        for l in lbls: l.set_path_effects([pe.withStroke(linewidth=1.2, foreground='white')])
    
    # Afegir A i B
    highs, lows = _find_mslp_centers(mslp, lon2d, lat2d)
    
    # Dibuixar Altes (A)
    for lon, lat, val in highs:
        ax.annotate('A', xy=(lon, lat), xytext=(0, 0), textcoords='offset points',
                    fontsize=12, fontweight='bold', color='red',
                    ha='center', va='center',
                    path_effects=[pe.withStroke(linewidth=2.5, foreground='white')],
                    transform=ccrs.PlateCarree(), zorder=10)
        # Cercle al voltant
        circle = plt.Circle((lon, lat), 0.3, fill=False, color='red', 
                           linewidth=1.5, transform=ccrs.PlateCarree(), zorder=9)
        ax.add_patch(circle)
    
    # Dibuixar Baixes (B)
    for lon, lat, val in lows:
        ax.annotate('B', xy=(lon, lat), xytext=(0, 0), textcoords='offset points',
                    fontsize=12, fontweight='bold', color='blue',
                    ha='center', va='center',
                    path_effects=[pe.withStroke(linewidth=2.5, foreground='white')],
                    transform=ccrs.PlateCarree(), zorder=10)
        # Cercle al voltant
        circle = plt.Circle((lon, lat), 0.3, fill=False, color='blue', 
                           linewidth=1.5, transform=ccrs.PlateCarree(), zorder=9)
        ax.add_patch(circle)

def _draw_streamlines(ax, u_ms, v_ms, lon2d, lat2d):
    if u_ms is None or v_ms is None: return
    u = u_ms.copy(); v = v_ms.copy()
    ny, nx = u.shape
    def _get_uv(px, py):
        if px < 0 or px > nx-1 or py < 0 or py > ny-1: return None
        x0 = max(0, min(int(px), nx-2)); y0 = max(0, min(int(py), ny-2))
        x1, y1 = x0+1, y0+1
        tx = max(0, min(px-x0, 1)); ty = max(0, min(py-y0, 1))
        ui = (1-ty)*((1-tx)*u[y0,x0]+tx*u[y0,x1]) + ty*((1-tx)*u[y1,x0]+tx*u[y1,x1])
        vi = (1-ty)*((1-tx)*v[y0,x0]+tx*v[y0,x1]) + ty*((1-tx)*v[y1,x0]+tx*v[y1,x1])
        return ui, vi
    STEP=STREAMLINE_STEP; DT=STREAMLINE_DT; MAX_S=STREAMLINE_MAX_STEPS
    CELL=STREAMLINE_CELL; MIN_L=STREAMLINE_MIN_LENGTH
    mW=int(nx/CELL)+1; mH=int(ny/CELL)+1
    mask_used=np.zeros((mH,mW),dtype=np.uint8); lines_to_draw=[]
    np.random.seed(42)
    for gy in range(0,ny,STEP):
        for gx in range(0,nx,STEP):
            sx=gx+(np.random.random()-.5)*STEP*.5; sy=gy+(np.random.random()-.5)*STEP*.5
            smx=int(sx/CELL); smy=int(sy/CELL)
            if smy<0 or smy>=mH or smx<0 or smx>=mW or mask_used[smy,smx]: continue
            forward=[]; backward=[]; cx,cy=sx,sy
            for _ in range(MAX_S):
                uv=_get_uv(cx,cy)
                if uv is None: break
                ui,vi=uv; s=np.hypot(ui,vi)
                if s<.2: break
                cx+=(ui/s)*DT; cy-=(vi/s)*DT
                mx=int(cx/CELL); my=int(cy/CELL)
                if my<0 or my>=mH or mx<0 or mx>=mW or mask_used[my,mx]: break
                forward.append((cx,cy))
            cx,cy=sx,sy
            for _ in range(MAX_S):
                uv=_get_uv(cx,cy)
                if uv is None: break
                ui,vi=uv; s=np.hypot(ui,vi)
                if s<.2: break
                cx-=(ui/s)*DT; cy+=(vi/s)*DT
                mx=int(cx/CELL); my=int(cy/CELL)
                if my<0 or my>=mH or mx<0 or mx>=mW or mask_used[my,mx]: break
                backward.append((cx,cy))
            line=backward[::-1]+[(sx,sy)]+forward
            if len(line)>MIN_L:
                for i in range(0,len(line),3):
                    mx=int(line[i][0]/CELL); my=int(line[i][1]/CELL)
                    if 0<=my<mH and 0<=mx<mW: mask_used[my,mx]=1
                lines_to_draw.append(line)
    for line in lines_to_draw:
        xs=np.array([p[0] for p in line]); ys=np.array([p[1] for p in line])
        lons_l=LON_MIN+(xs/(nx-1))*(LON_MAX-LON_MIN)
        lats_l=LAT_MAX-(ys/(ny-1))*(LAT_MAX-LAT_MIN)
        ax.plot(lons_l,lats_l,color=STREAMLINE_COLOR,linewidth=STREAMLINE_LINEWIDTH,
                alpha=STREAMLINE_ALPHA,transform=ccrs.PlateCarree(),
                zorder=8,solid_capstyle='round',solid_joinstyle='round')
        if len(line)>28:
            as_=max(len(line)//6,1)
            for a in range(as_,len(line)-3,as_):
                p1,p2=line[a],line[a+2]
                if p1 and p2:
                    dx=p2[0]-p1[0]; dy=p2[1]-p1[1]; ang=np.arctan2(-dy,dx)
                    lon1=LON_MIN+(p1[0]/(nx-1))*(LON_MAX-LON_MIN)
                    lat1=LAT_MAX-(p1[1]/(ny-1))*(LAT_MAX-LAT_MIN)
                    for sign in [-1,1]:
                        ax.plot([lon1,lon1-STREAMLINE_ARROW_LEN*np.cos(ang+sign*.45)],
                                [lat1,lat1-STREAMLINE_ARROW_LEN*np.sin(ang+sign*.45)],
                                color=STREAMLINE_COLOR,linewidth=STREAMLINE_LINEWIDTH*1.2,
                                alpha=STREAMLINE_ALPHA,transform=ccrs.PlateCarree(),
                                zorder=9,solid_capstyle='round')

def _geopotential(ax, lon2d, lat2d, geopot, level_hpa):
    if geopot is None or np.all(np.isnan(geopot)): return
    step={500:40,300:60,850:30,925:20}.get(level_hpa,40)
    lo=np.floor(np.nanmin(geopot)/step)*step; hi=np.ceil(np.nanmax(geopot)/step)*step+step
    cs=ax.contour(lon2d,lat2d,geopot,levels=np.arange(lo,hi,step),
                  colors='black',linewidths=1.6,transform=ccrs.PlateCarree(),zorder=4,alpha=0.8)
    lbls=ax.clabel(cs,inline=True,fontsize=6,fmt='%d',colors='black',inline_spacing=4)
    for l in lbls: l.set_path_effects([pe.withStroke(linewidth=2.0,foreground='white')])

def _add_copyright(fig, dark=False):
    color = '#cccccc' if dark else '#555555'
    fig.text(
        0.895, 0.055,
        '© @tempestes.cat',
        fontsize=6.5,
        color=color,
        ha='right',
        va='bottom',
        alpha=0.85,
        style='italic',
        path_effects=[pe.withStroke(linewidth=1.5, foreground='white' if not dark else '#0a0a1e')]
    )

def _save(fig, fname, out_dir, dark=False):
    _add_copyright(fig, dark=dark)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / fname
    fig.savefig(str(path), bbox_inches='tight', dpi=DPI_MAP,
                facecolor='white' if not dark else '#0a0a1e',
                edgecolor='none', pad_inches=0.03)
    plt.close(fig); gc.collect()

# ══════════════════════════════════════════════════════════════════
# FUNCIONS DE PLOT
# ══════════════════════════════════════════════════════════════════

def plot_sfc(data_grid, var_name, sfc_data, ts_utc, fhour, out_dir):
    if not (HAS_CARTOPY and HAS_MPL): return
    cfg = SFC_VARS_CFG.get(var_name)
    if cfg is None: return
    dst_lons, dst_lats = make_grid()
    lon2d, lat2d = np.meshgrid(dst_lons, dst_lats)
    fig = plt.figure(figsize=(FIG_W, FIG_H), dpi=DPI_MAP)
    ax  = _base_ax(fig)
    cf  = _contourf(ax, lon2d, lat2d, data_grid, cfg)
    if cfg.get('isobars', False) and var_name != 'mslp':
        _isobars(ax, lon2d, lat2d, sfc_data.get('mslp'), label=False)
    if var_name == 'mslp':
        _isobars(ax, lon2d, lat2d, data_grid, label=True)
    u, v = sfc_data.get('wind_u'), sfc_data.get('wind_v')
    if u is not None and v is not None:
        _draw_streamlines(ax, u, v, lon2d, lat2d)
    _colorbar(fig, cf, cfg)
    ts_local = utc_to_madrid_short(ts_utc)
    ax.set_title(f"{cfg['title']}  ·  {ts_local}  ·  +{fhour}h", fontsize=8.5, pad=4, loc='left')
    ax.set_title('GFS 0.25°', fontsize=7.5, pad=4, color='#666666', loc='right')
    _save(fig, f"gfs_{var_name}_sfc_f{fhour:03d}.png", out_dir)

def plot_pres(data_grid, var_name, pres_data, level_hpa, ts_utc, fhour, out_dir):
    if not (HAS_CARTOPY and HAS_MPL): return
    cfg = PRES_VARS_CFG.get(var_name)
    if cfg is None: return
    dst_lons, dst_lats = make_grid()
    lon2d, lat2d = np.meshgrid(dst_lons, dst_lats)
    fig = plt.figure(figsize=(FIG_W, FIG_H), dpi=DPI_MAP)
    ax  = _base_ax(fig)
    cf  = _contourf(ax, lon2d, lat2d, data_grid, cfg)
    if (g := pres_data.get('geopotential')) is not None:
        _geopotential(ax, lon2d, lat2d, g, level_hpa)
    u, v = pres_data.get('wind_u'), pres_data.get('wind_v')
    if level_hpa in NO_BARBS_LEVELS:
        if u is not None and v is not None: _draw_streamlines(ax, u, v, lon2d, lat2d)
    else:
        if u is not None and v is not None: _barbs(ax, u, v, lon2d, lat2d)
    _colorbar(fig, cf, cfg)
    ts_local = utc_to_madrid_short(ts_utc)
    ax.set_title(f"{cfg['title']} {level_hpa}hPa  ·  {ts_local}  ·  +{fhour}h", fontsize=8.5, pad=4, loc='left')
    ax.set_title('GFS 0.25°', fontsize=7.5, pad=4, color='#666666', loc='right')
    _save(fig, f"gfs_{var_name}_{level_hpa}hPa_f{fhour:03d}.png", out_dir)

def plot_vortex(vortex_data, var_name, ts_utc, fhour, out_dir):
    if not (HAS_CARTOPY and HAS_MPL): return
    cfg = VORTEX_VARS_CFG.get(var_name)
    if cfg is None: return
    if var_name == 'vortex_geopot':
        raw = vortex_data.get('geopotential')
        data_grid = raw / 10.0 if raw is not None else None
    elif var_name == 'vortex_temp':
        data_grid = vortex_data.get('temperature')
    else:
        data_grid = vortex_data.get('wind_speed')
    if data_grid is None or np.all(np.isnan(data_grid)): return
    dst_lons, dst_lats = make_grid()
    lon2d, lat2d = np.meshgrid(dst_lons, dst_lats)
    fig = plt.figure(figsize=(FIG_W, FIG_H), dpi=DPI_MAP)
    ax  = _base_ax(fig, dark=True)
    cf  = _contourf(ax, lon2d, lat2d, data_grid, cfg)
    if var_name == 'vortex_geopot':
        cs   = ax.contour(lon2d,lat2d,data_grid,levels=np.arange(29000,32200,100),
                          colors='white',linewidths=1.0,alpha=0.65,
                          transform=ccrs.PlateCarree(),zorder=5)
        lbls = ax.clabel(cs,inline=True,fontsize=5.5,fmt='%d',colors='white')
        for l in lbls: l.set_path_effects([pe.withStroke(linewidth=1.8,foreground='#0a0a1e')])
    u, v = vortex_data.get('wind_u'), vortex_data.get('wind_v')
    if u is not None and v is not None:
        if var_name == 'vortex_wind': _barbs(ax, u, v, lon2d, lat2d)
        else: _draw_streamlines(ax, u, v, lon2d, lat2d)
    _colorbar(fig, cf, cfg)
    ts_local = utc_to_madrid_short(ts_utc)
    ax.set_title(f"{cfg['title']}  ·  {ts_local}  ·  +{fhour}h",
                 fontsize=8.5, pad=4, loc='left', color='white')
    ax.set_title('GFS 0.25°  ·  10 hPa', fontsize=7.5, pad=4, color='#cccccc', loc='right')
    fig.patch.set_facecolor('#0a0a1e')
    _save(fig, f"gfs_{var_name}_f{fhour:03d}.png", out_dir, dark=True)

def _compute_heat_risk(sfc_data):
    temp=sfc_data.get('temperature'); rh=sfc_data.get('relative_humidity')
    if temp is None: return np.zeros((N_GRID,N_GRID))
    risk=np.where(temp>=30,1,0).astype(float)
    if rh is not None:
        risk=np.where((temp>=33)|((temp>=30)&(rh>=60)),2,risk)
        risk=np.where((temp>=36)|((temp>=33)&(rh>=70)),3,risk)
        risk=np.where((temp>=38)|((temp>=36)&(rh>=80)),4,risk)
    else:
        risk=np.where(temp>=33,2,risk); risk=np.where(temp>=36,3,risk); risk=np.where(temp>=40,4,risk)
    if HAS_SCIPY: risk=gaussian_filter(risk,sigma=3)
    return np.clip(risk,0,4)

def _compute_cold_risk(sfc_data):
    temp=sfc_data.get('temperature'); wind=sfc_data.get('wind_speed')
    if temp is None: return np.zeros((N_GRID,N_GRID))
    et=temp-(np.where(wind>20,(wind-20)/30,0)*5 if wind is not None else 0)
    risk=np.where(et<=0,1,0).astype(float)
    risk=np.where(et<=-5,2,risk); risk=np.where(et<=-10,3,risk); risk=np.where(et<=-15,4,risk)
    if HAS_SCIPY: risk=gaussian_filter(risk,sigma=3)
    return np.clip(risk,0,4)

def _compute_wind_risk(sfc_data):
    wind=sfc_data.get('wind_speed'); gusts=sfc_data.get('wind_gusts')
    if wind is None and gusts is None: return np.zeros((N_GRID,N_GRID))
    risk=np.zeros((N_GRID,N_GRID))
    if wind is not None:
        risk=np.where(wind>=50,1,risk); risk=np.where(wind>=65,2,risk)
        risk=np.where(wind>=80,3,risk); risk=np.where(wind>=100,4,risk)
    if gusts is not None:
        risk=np.where(gusts>=80,np.maximum(risk,2),risk)
        risk=np.where(gusts>=100,np.maximum(risk,3),risk)
        risk=np.where(gusts>=130,np.maximum(risk,4),risk)
    if HAS_SCIPY: risk=gaussian_filter(risk,sigma=3)
    return np.clip(risk,0,4)

def plot_risk(data_grid, var_name, sfc_data, ts_utc, fhour, out_dir):
    if not (HAS_CARTOPY and HAS_MPL): return
    cfg=RISK_VARS_CFG.get(var_name)
    if cfg is None: return
    dst_lons,dst_lats=make_grid(); lon2d,lat2d=np.meshgrid(dst_lons,dst_lats)
    fig=plt.figure(figsize=(FIG_W,FIG_H),dpi=DPI_MAP); ax=_base_ax(fig)
    lvs=np.array(cfg['levels']); cmap=CMAP.get(cfg['cmap'],plt.get_cmap('viridis'))
    norm=BoundaryNorm(lvs,ncolors=cmap.N,clip=False)
    cf=ax.contourf(lon2d,lat2d,data_grid,levels=lvs,cmap=cmap,norm=norm,
                   extend='neither',transform=ccrs.PlateCarree(),alpha=0.8,zorder=2)
    _isobars(ax,lon2d,lat2d,sfc_data.get('mslp'),label=False)
    u,v=sfc_data.get('wind_u'),sfc_data.get('wind_v')
    if u is not None and v is not None: _draw_streamlines(ax,u,v,lon2d,lat2d)
    _colorbar(fig,cf,cfg)
    ts_local = utc_to_madrid_short(ts_utc)
    ax.set_title(f"{cfg['title']}  ·  {ts_local}  ·  +{fhour}h",fontsize=8.5,pad=4,loc='left')
    ax.set_title('GFS 0.25°',fontsize=7.5,pad=4,color='#666666',loc='right')
    _save(fig,f"gfs_{var_name}_f{fhour:03d}.png",out_dir)

# ══════════════════════════════════════════════════════════════════
# STATUS JSON
# ══════════════════════════════════════════════════════════════════

def _write_status(date_str, run_str, base_dt, maps=0, forecast_hours=None):
    now_utc = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    run_utc = base_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
    dd, mm  = date_str[6:8], date_str[4:6]
    label   = f"GFS {dd}/{mm} {run_str}Z"
    fh_list = forecast_hours or []
    fh_desc = f"{min(fh_list) if fh_list else 0}-{max(fh_list) if fh_list else 300}h (pas 10h)"
    with open(OUT_DIR / "status_sfc.json", "w") as f:
        json.dump({"last_run_utc": run_utc, "last_run_label": label,
                   "generated_at": now_utc, "maps_count": maps,
                   "forecast_hours": fh_desc}, f, indent=2)
    clog(G, "✅", f"status_sfc.json actualitzat ({maps} mapes)")

# ══════════════════════════════════════════════════════════════════
# PROCESSAMENT PER HORA
# ══════════════════════════════════════════════════════════════════

def _process_hour(date_str, run_str, base_dt, fhour, map_dir):
    ts_utc = (base_dt + timedelta(hours=fhour)).strftime('%Y-%m-%dT%H:%M:%SZ')
    maps  = 0
    try:
        sfc_bytes, pres_bytes, vortex_bytes = download_all_parallel(date_str, run_str, fhour)
    except Exception as e:
        clog(R, "❌", f"download_all_parallel f{fhour:03d}: {e}"); return 0

    sfc_data = {}
    if sfc_bytes:
        try: sfc_data = process_sfc_from_bytes(sfc_bytes) or {}
        except Exception as e: clog(Y, "⚠️", f"process_sfc f{fhour:03d}: {e}")

    if sfc_data:
        for var_name in SFC_VARS_CFG:
            if var_name in sfc_data:
                try: plot_sfc(sfc_data[var_name], var_name, sfc_data, ts_utc, fhour, map_dir); maps += 1
                except Exception as e: clog(Y, "⚠️", f"sfc {var_name} f{fhour:03d}: {e}")
        if 'temperature' in sfc_data:
            for rname, rfn in [('heat_risk', _compute_heat_risk), ('cold_risk', _compute_cold_risk)]:
                try: plot_risk(rfn(sfc_data), rname, sfc_data, ts_utc, fhour, map_dir); maps += 1
                except Exception as e: clog(Y, "⚠️", f"{rname} f{fhour:03d}: {e}")
        if 'wind_speed' in sfc_data:
            try: plot_risk(_compute_wind_risk(sfc_data), 'wind_risk', sfc_data, ts_utc, fhour, map_dir); maps += 1
            except Exception as e: clog(Y, "⚠️", f"wind_risk f{fhour:03d}: {e}")

    if pres_bytes:
        for level_hpa in PRES_LEVELS:
            try:
                pres_data = process_pres_from_bytes(pres_bytes, level_hpa)
                if not pres_data: continue
                for var_name in PRES_VARS_CFG:
                    if var_name in pres_data:
                        try: plot_pres(pres_data[var_name], var_name, pres_data, level_hpa, ts_utc, fhour, map_dir); maps += 1
                        except Exception as e: clog(Y, "⚠️", f"pres {var_name} {level_hpa}hPa f{fhour:03d}: {e}")
            except Exception as e: clog(Y, "⚠️", f"nivell {level_hpa}hPa f{fhour:03d}: {e}")

    if vortex_bytes:
        try:
            vortex_data = process_vortex_from_bytes(vortex_bytes)
            if vortex_data:
                for var_name in VORTEX_VARS_CFG:
                    try: plot_vortex(vortex_data, var_name, ts_utc, fhour, map_dir); maps += 1
                    except Exception as e: clog(Y, "⚠️", f"vortex {var_name} f{fhour:03d}: {e}")
        except Exception as e: clog(Y, "⚠️", f"vortex f{fhour:03d}: {e}")

    del sfc_bytes, pres_bytes, vortex_bytes
    gc.collect()
    return maps

def run_gfs(date_str, run_str, base_dt, map_dir):
    total_maps = 0
    forecast_hours = get_forecast_hours(base_dt)
    n = len(forecast_hours)
    clog(G, "✅", f"Passos a generar: {n}  ({min(forecast_hours) if forecast_hours else 0}h → {max(forecast_hours) if forecast_hours else 300}h)")
    for idx, fhour in enumerate(forecast_hours):
        clog(B, "🗺️", f"[{idx+1}/{n}] f{fhour:03d}h processant…")
        try: maps = _process_hour(date_str, run_str, base_dt, fhour, map_dir)
        except Exception as e: clog(R, "❌", f"Error f{fhour:03d}: {e}"); maps = 0
        total_maps += maps
        clog(G, "✅", f"f{fhour:03d}h → {maps} mapes (total: {total_maps})")
    return total_maps, forecast_hours

# ══════════════════════════════════════════════════════════════════
# CICLE AUTOMÀTIC
# ══════════════════════════════════════════════════════════════════

def segons_fins_proper_01utc():
    now = datetime.now(timezone.utc)
    target = now.replace(hour=1, minute=0, second=0, microsecond=0)
    if now >= target:
        target += timedelta(days=1)
    return (target - now).total_seconds()

def run_cycle():
    clog(C, "🌍", "Iniciant cicle GFS complet (hora actual → 300h, pas 10h)…")

    if not HAS_CFGRIB:
        clog(R, "❌", "cfgrib no disponible"); return
    if not HAS_CARTOPY:
        clog(R, "❌", "cartopy no disponible"); return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    map_dir = OUT_DIR / "maps"

    # Netejar mapes antics
    if map_dir.exists():
        clog(Y, "🗑️", f"Esborrant carpeta maps: {map_dir}")
        try:
            import shutil
            shutil.rmtree(str(map_dir))
            clog(G, "✅", "Carpeta maps esborrada correctament")
        except Exception as e:
            clog(R, "❌", f"Error esborrant maps: {e}")
    map_dir.mkdir(parents=True, exist_ok=True)
    clog(G, "✅", f"Carpeta maps creada de nou: {map_dir}")

    date_str, run_str, base_dt = get_best_run()

    forecast_hours = get_forecast_hours(base_dt)
    clog(G, "✅", f"Run: GFS {date_str} {run_str}Z")
    clog(G, "✅", f"Passos: {len(forecast_hours)} "
         f"(f{min(forecast_hours) if forecast_hours else 0:03d} → "
         f"f{max(forecast_hours) if forecast_hours else 300:03d}, pas 10h)")
    clog(G, "✅", f"Sortida: {map_dir}")

    t0 = time.time()
    total_maps, fh_used = run_gfs(date_str, run_str, base_dt, map_dir)
    elapsed = timedelta(seconds=int(time.time() - t0))

    _write_status(date_str, run_str, base_dt, maps=total_maps, forecast_hours=fh_used)

    clog(G, "🎉", f"GFS completat: {total_maps} mapes en {elapsed}")

def main():
    os.system("cls" if os.name == "nt" else "clear")
    print(f"\n  {C}{B}╔══════════════════════════════════════════════╗")
    print(f"  ║    GFS — EXECUCIO ÚNICA                     ║")
    print(f"  ║    hora actual → 300h · pas 10h           ║")
    print(f"  ║    Hores locals Madrid · @tempestes.cat    ║")
    print(f"  ╚══════════════════════════════════════════════╝{RS}\n")

    clog(G, "✅", f"Projecte: {W}{PROJECT_NAME}{RS}")
    clog(G, "✅", f"Sortida: {W}{OUT_DIR}{RS}")

    now_utc = datetime.now(timezone.utc)
    now_mad = now_utc.astimezone(TZ_MADRID)
    clog(G, "🕐", f"Hora UTC: {now_utc.strftime('%H:%M:%S')}  |  "
         f"Hora Madrid: {now_mad.strftime('%H:%M:%S %Z')}")

    try:
        run_cycle()
    except KeyboardInterrupt:
        print(f"\n\n  {G}👋 GFS aturat.{RS}\n")

if __name__ == '__main__':
    main()