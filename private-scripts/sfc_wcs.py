#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sfc_wcs.py — SFC + WCS (part ràpida, sense 3D meteofetch)
═══════════════════════════════════════════════════════════════════════════════════
 SFC: meteofetch SP1+SP2 (17 vars)
 WCS: TOTES les variables que funcionen (BT, Cumulonimbus, Precip, Neu, Isotermes,
      Temperatura, Severitat, PV)
 RATXA VENT: Calculada de su+sv

 🔧 FIX GEOREFERENCIACIÓ WCS (2026): el TIFF que retorna el WCS de
    Météo-France NO respecta el SCALESIZE demanat (retorna la resolució
    nativa AROME, 0.025°) i el ModelTiepointTag apunta a la CANTONADA
    del píxel (0,0), no al seu CENTRE (convenció GeoTIFF PixelIsArea).
    Abans es feia servir np.linspace(lon_min, lon_max, w_src) assumint
    que lon_min/lon_max eren els CENTRES dels píxels extrems, cosa que
    introduïa un desquadrament de mig píxel (~0.0125°) molt visible en
    dominis grans (confirmat amb diagnòstic real: shape esperat vs.
    shape real del TIFF no coincidien, i els tags GeoTIFF confirmen
    l'offset de cantonada). Ara es llegeixen ModelTiepointTag +
    ModelPixelScaleTag de CADA TIFF real i es calculen els centres de
    píxel correctament: lon_centre = lon_origen + (i+0.5)*res_x, etc.
═══════════════════════════════════════════════════════════════════════════════════
 Aquest script és la meitat "ràpida" del pipeline original (t_final_blindado.py).
 La resta (3D meteofetch + SRH/Shear + Convectiu + SCP + Calamarsa) viu a
 td_3d.py, que és molt més lent a descarregar (IP1+IP3, GBs de GRIB) i per això
 es fa córrer com a job separat en paral·lel a GitHub Actions.

 Genera: sfc_XX.json.gz (XX = step horari) + status_sfc.json.gz
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
import cfgrib
import tifffile
from requests.adapters import HTTPAdapter
from scipy.interpolate import griddata

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

if not CFG.key or not CFG.key.strip():
    sys.exit("❌ api_key buida a configNE.json. Revisa el secret AROME_API_KEY al workflow de GitHub Actions.")

WCS_SERVICE = "MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS"
WCS_BASE_URL = f"https://public-api.meteofrance.fr/public/arome/1.0/wcs/{WCS_SERVICE}"

JSON_DIR = Path(CFG.out)
LOG_DIR = Path(CFG.out) / "logs"
TMP_DIR = Path(os.environ.get("TEMP", "/tmp")) / "arome_sfc_wcs"

JSON_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

DOMINI_CAT = {"lon_min": -4.0, "lon_max": 4.5, "lat_min": 36.5, "lat_max": 44.0, "w": 170, "h": 150}
DOMINI_GRAN = {"lon_min": -5.0, "lon_max": 5.0, "lat_min": 36.0, "lat_max": 44.5, "w": 201, "h": 170}

MAX_REINTENTS = 3
ESPERA_ENTRE_REINTENTS = 2
ESPERA_ENTRE_PETICIONS = 0.7
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


# ═══════════════════════════════════════════════════════════════════════
#  VARIABLES WCS (TOTES LES QUE FUNCIONEN)
# ═══════════════════════════════════════════════════════════════════════

VARIABLES_WCS_2D = {
    "BT__CHANNELS_108": {"llindar": 350, "cmap": "RdYlBu_r", "label": "BT 10.8µm", "domini": "GRAN"},
    "BT__CHANNELS_62": {"llindar": 350, "cmap": "RdYlBu_r", "label": "BT 6.2µm", "domini": "GRAN"},
    "P__TOP_CB": {"llindar": 9000, "cmap": "terrain", "label": "Tope Cumulonimbus", "domini": "CAT"},
    "P__BASE_CB": {"llindar": 9000, "cmap": "terrain", "label": "Base Cumulonimbus", "domini": "CAT"},
    "BASE_NUAGE__GROUND": {"llindar": 9000, "cmap": "terrain", "label": "Base nubes", "domini": "CAT"},
    "PLAFOND__GROUND": {"llindar": 9000, "cmap": "terrain", "label": "Techo nubes", "domini": "CAT"},
    "PRECIP__GROUND": {"llindar": 9000, "cmap": "Blues", "label": "Precipitación 1h", "domini": "CAT", "sufix": "_PT1H"},
    "NEIGE__GROUND": {"llindar": 9000, "cmap": "Blues", "label": "Nieve 1h", "domini": "CAT", "sufix": "_PT1H"},
    "DIAG_GRELE__GROUND": {"llindar": 9000, "cmap": "YlOrRd", "label": "Calamar diagnóstico", "domini": "CAT"},
    "HTEURNEIGE__GROUND": {"llindar": 9000, "cmap": "Blues", "label": "Altura nieve", "domini": "CAT"},
    "WATER_EQUIVALENT_ACCUMULATED_SNOW__GROUND_OR_WATER_SURFACE": {"llindar": 9000, "cmap": "Blues", "label": "Equiv. agua nieve", "domini": "CAT"},
    "RR_SOL_GELE__GROUND": {"llindar": 9000, "cmap": "Reds", "label": "Lluvia helada", "domini": "CAT"},
    "NEIGE_SC__GROUND": {"llindar": 9000, "cmap": "Blues", "label": "Nieve superficie", "domini": "CAT"},
    "SNOW_DEPTH__GROUND_OR_WATER_SURFACE": {"llindar": 9000, "cmap": "Blues", "label": "Profundidad nieve", "domini": "CAT"},
    "RESR_NEIGE__GROUND": {"llindar": 9000, "cmap": "Blues", "label": "Reserva nieve", "domini": "CAT"},
    "ALTITUDE__ISO_TPW_27315": {"llindar": 9000, "cmap": "coolwarm", "label": "Iso TPW 0°C", "domini": "CAT"},
    "ALTITUDE__ISO_TPW_27415": {"llindar": 9000, "cmap": "coolwarm", "label": "Iso TPW +1°C", "domini": "CAT"},
    "ALTITUDE__ISO_TPW_27465": {"llindar": 9000, "cmap": "coolwarm", "label": "Iso TPW +1.5°C", "domini": "CAT"},
    "ALTITUDE__ISO_T_27315": {"llindar": 9000, "cmap": "coolwarm", "label": "Isoterma 0°C", "domini": "CAT"},
    "T__GROUND": {"llindar": 9000, "cmap": "RdBu_r", "label": "Temperatura superficie", "domini": "CAT"},
    "DIAG_EHI__GROUND": {"llindar": 9000, "cmap": "hot", "label": "EHI (Tornados)", "domini": "CAT"},
    "DIAG_SCP__GROUND": {"llindar": 9000, "cmap": "viridis", "label": "SCP (Supercélula)", "domini": "CAT"},
    "DIAG_STP__GROUND": {"llindar": 9000, "cmap": "viridis", "label": "STP (Tornados signif.)", "domini": "CAT"},
    "HELICITE__GROUND": {"llindar": 9000, "cmap": "hot", "label": "Helicidad", "domini": "CAT"},
    "FF__ISO_TP_1500": {"llindar": 9000, "cmap": "viridis", "label": "Viento PV=1.5", "domini": "CAT"},
    "FF__ISO_TP_2000": {"llindar": 9000, "cmap": "viridis", "label": "Viento PV=2.0", "domini": "CAT"},
   "REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "plasma", "label": "Reflectivitat dBZ", "domini": "CAT"
    },

        "CONVECTIVE_INHIBITION__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "RdBu_r", "label": "CIN", "domini": "CAT"
    },


        "TOTAL_CLOUD_COVER__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "gray", "label": "Nebulositat total", "domini": "CAT"
    },
}

VARIABLES_WCS_3D_MITJANA = {
    "CIWC__ISOBARIC": {"nivells": ["925", "850", "500", "300"], "llindar": 9000, "cmap": "Blues", "label": "Gel núvols (mitjana)", "domini": "CAT", "var_sortida": "CIWC_MITJANA"},
    "CLD_RAIN__ISOBARIC": {"nivells": ["925", "850", "500", "300"], "llindar": 9000, "cmap": "Blues", "label": "Pluja núvols (mitjana)", "domini": "CAT", "var_sortida": "CLD_RAIN_MITJANA"},
    "TPW__ISOBARIC": {"nivells": ["925", "850", "500", "300"], "llindar": 9000, "cmap": "Blues", "label": "Aigua precipitable (mitjana)", "domini": "CAT", "var_sortida": "TPW_MITJANA"},
}

VARIABLES_WCS_3D_PV = {}

VARIABLES_WCS_3D_ISOBARIC = {
    "THETAV__ISOBARIC": {"nivells": ["850"], "llindar": 9000, "cmap": "coolwarm", "label": "Theta virtual 850hPa", "domini": "CAT", "var_sortida": "THETAV_850"},
}

# ═══════════════ VARIABLES METEOFETCH SFC ═══════════════

SFC_METEOFETCH = {
    "st": ("SP1", "2t", "K->C", "Temperatura 2m", "°C"),
    "srh": ("SP1", "2r", 1.0, "Humitat 2m", "%"),
    "su": ("SP1", "10u", 1.0, "Vent U 10m", "m/s"),
    "sv": ("SP1", "10v", 1.0, "Vent V 10m", "m/s"),
    "pressure_msl": ("SP1", "prmsl", 0.01, "Pressió MSL", "hPa"),
    "tp": ("SP1", "tp", 1.0, "Precip. total acum.", "mm"),
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

SFC_VARS_CRITIQUES = ["st", "srh", "su", "sv", "pressure_msl", "cape"]

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

# ═══════════════════════════════════════════════════════════════════════
#  🔧 GEOREFERENCIACIÓ REAL DEL TIFF (fix del desquadrament)
# ═══════════════════════════════════════════════════════════════════════
#
#  El WCS de Météo-France:
#   1) NO respecta el SCALESIZE demanat — retorna la resolució NATIVA
#      d'AROME (0.025°), sigui quina sigui la mida que has demanat.
#   2) El ModelTiepointTag apunta a la CANTONADA (esquina NW) del
#      píxel (0,0), seguint la convenció GeoTIFF "PixelIsArea", NO al
#      seu centre.
#
#  Abans es feia:
#      lons_src = np.linspace(domini['lon_min'], domini['lon_max'], w_src)
#  … assumint que lon_min/lon_max eren els CENTRES dels píxels extrems.
#  Això introduïa un error sistemàtic de mig píxel (0.0125°) que es fa
#  molt visible quan el domini demanat és gran.
#
#  Ara llegim ModelTiepointTag + ModelPixelScaleTag de CADA TIFF i
#  calculem els centres de píxel correctament:
#      lon_centre[i] = lon_origen + (i + 0.5) * res_x
#      lat_centre[j] = lat_origen - (j + 0.5) * res_y
# ═══════════════════════════════════════════════════════════════════════

def extreure_coords_reals_tiff(contingut_bytes, h_real, w_real):
    """
    Llegeix ModelTiepointTag i ModelPixelScaleTag del TIFF per calcular
    les coordenades REALS (centre de cada píxel) de la graella.

    Retorna (lons_centre, lats_centre) com a arrays 1D de longitud
    w_real i h_real respectivament, o None si no es poden llegir els
    tags (en aquest cas cal fer servir un fallback).
    """
    try:
        with tifffile.TiffFile(io.BytesIO(contingut_bytes)) as tif:
            page = tif.pages[0]
            tiepoint = None
            pixelscale = None
            for tag in page.tags:
                if tag.name == "ModelTiepointTag":
                    tiepoint = tag.value
                elif tag.name == "ModelPixelScaleTag":
                    pixelscale = tag.value

            if tiepoint is None or pixelscale is None:
                return None

            # ModelTiepointTag = (I, J, K, X, Y, Z) — (I,J,K) és el punt
            # raster (normalment 0,0,0) i (X,Y,Z) el punt món corresponent
            # (X=lon_origen a la cantonada, Y=lat_origen a la cantonada).
            lon_origen = float(tiepoint[3])
            lat_origen = float(tiepoint[4])
            res_x = float(pixelscale[0])
            res_y = float(pixelscale[1])

            if res_x <= 0 or res_y <= 0:
                return None

            # Centres de píxel: origen + (índex + 0.5) * resolució.
            # Lon creix cap a la dreta; Lat DECREIX cap avall (convenció
            # habitual nord→sud en rasters).
            lons_centre = lon_origen + (np.arange(w_real) + 0.5) * res_x
            lats_centre = lat_origen - (np.arange(h_real) + 0.5) * res_y

            return lons_centre, lats_centre
    except Exception:
        return None


def coords_fallback_linspace(domini, h_src, w_src):
    """
    Fallback si per algun motiu no es poden llegir els tags GeoTIFF.
    Manté el comportament ANTIC (linspace entre els límits demanats).
    """
    lons_src = np.linspace(domini["lon_min"], domini["lon_max"], w_src)
    lats_src = np.linspace(domini["lat_max"], domini["lat_min"], h_src)
    return lons_src, lats_src


def interpolar_wcs_a_graella_desti(arr, coords_reals, domini, lons_mf, lats_mf):
    """
    🔧 Funció centralitzada d'interpolació WCS → graella meteofetch.
    Fa servir SEMPRE les coordenades REALS del TIFF (si estan disponibles)
    en lloc d'assumir un linspace entre els límits del domini demanat.
    Retorna la graella interpolada (mateixa forma que meshgrid de
    lons_mf/lats_mf) o None si no hi ha prou dades vàlides.
    """
    h_src, w_src = arr.shape

    if coords_reals is not None:
        lons_src, lats_src = coords_reals
    else:
        lons_src, lats_src = coords_fallback_linspace(domini, h_src, w_src)

    lon_src, lat_src = np.meshgrid(lons_src, lats_src)
    mask = ~np.isnan(arr)

    if np.sum(mask) < 10:
        return None

    punts = np.column_stack((lon_src[mask], lat_src[mask]))
    vals = arr[mask]
    lon_dst, lat_dst = np.meshgrid(np.array(lons_mf), np.array(lats_mf))
    grid = griddata(punts, vals, (lon_dst, lat_dst), method='linear')
    return grid


# ═══════════════ WCS: DESCARREGAR TILE ═══════════════

def descarregar_tile_wcs(session, cov_id, time_str, domini, llindar_nan, nivell_pressure=None, intent=1):
    """
    🔧 Ara retorna una tupla (arr, missatge, coords_reals) on coords_reals
    és (lons_centre, lats_centre) llegit dels tags GeoTIFF reals, o bé
    None si no s'han pogut llegir.
    """
    url = (f"{WCS_BASE_URL}/GetCoverage?SERVICE=WCS&VERSION=2.0.1"
           f"&COVERAGEID={cov_id}&FORMAT=image/tiff"
           f"&SUBSET=long({domini['lon_min']},{domini['lon_max']})"
           f"&SUBSET=lat({domini['lat_min']},{domini['lat_max']})"
           f"&SUBSET=time({time_str})")
    if nivell_pressure:
        url += f"&SUBSET=pressure({nivell_pressure})"
    url += f"&SCALESIZE=long({domini['w']})&SCALESIZE=lat({domini['h']})"

    try:
        r = session.get(url, timeout=CFG.to)

        if r.status_code == 401:
            return None, "HTTP 401 (token invàlid o caducat — revisa AROME_API_KEY)", None
        if r.status_code == 502:
            if intent < MAX_REINTENTS:
                time.sleep(ESPERA_ENTRE_REINTENTS)
                return descarregar_tile_wcs(session, cov_id, time_str, domini, llindar_nan, nivell_pressure, intent + 1)
            return None, f"HTTP 502 (reintents esgotats)", None
        if r.status_code == 429:
            if intent < MAX_REINTENTS + 2:
                time.sleep(_backoff(intent, base=5.0, cap=30.0))
                return descarregar_tile_wcs(session, cov_id, time_str, domini, llindar_nan, nivell_pressure, intent + 1)
            return None, f"HTTP 429 (reintents esgotats)", None
        if r.status_code != 200:
            return None, f"HTTP {r.status_code}", None
        if len(r.content) < 1000:
            return None, f"Contingut petit ({len(r.content)} bytes)", None

        contingut = r.content
        arr = tifffile.imread(io.BytesIO(contingut))
        if arr.ndim == 3:
            arr = arr[0]
        arr = arr.astype(np.float64)
        arr[arr > llindar_nan] = np.nan

        if np.sum(~np.isnan(arr)) < 10:
            return None, "Poques dades vàlides", None

        h_real, w_real = arr.shape
        coords_reals = extreure_coords_reals_tiff(contingut, h_real, w_real)

        return arr, "OK", coords_reals
    except Exception as e:
        if intent < MAX_REINTENTS:
            time.sleep(ESPERA_ENTRE_REINTENTS)
            return descarregar_tile_wcs(session, cov_id, time_str, domini, llindar_nan, nivell_pressure, intent + 1)
        return None, f"Error: {str(e)[:40]}", None

def descarregar_wcs_mitjana(session, var_base, nivells, domini, llindar, run_dt, step):
    """
    🔧 Ara també retorna les coordenades reals (del primer nivell vàlid,
    ja que tots els nivells comparteixen la mateixa graella espacial).
    Retorna: (grid_mitjana, missatge, coords_reals)
    """
    grids = []
    nivells_ok = []
    coords_reals_guardades = None
    dh = run_dt + timedelta(hours=step)
    ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")
    cov_id = f"{var_base}___{run_dt.strftime('%Y-%m-%dT%H.00.00Z')}"

    for nivell in nivells:
        arr, missatge, coords_reals = descarregar_tile_wcs(session, cov_id, ts, domini, llindar, nivell_pressure=nivell)
        if arr is not None:
            grids.append(arr)
            nivells_ok.append(nivell)
            if coords_reals_guardades is None:
                coords_reals_guardades = coords_reals
        time.sleep(ESPERA_ENTRE_PETICIONS)

    if len(grids) == 0:
        return None, "Cap nivell disponible", None

    mitjana = np.nanmean(np.array(grids), axis=0) if grids else None
    if mitjana is None or np.sum(~np.isnan(mitjana)) < 10:
        return None, "Poques dades després de mitjana", None
    return mitjana, f"OK — {len(nivells_ok)}/{len(nivells)} nivells", coords_reals_guardades

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

# ═══════════════ SFC: METEOFETCH ═══════════════

def descarregar_sfc_meteofetch(steps_bloc, run_dt):
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    date_str = run_dt.strftime("%Y-%m-%dT%H")
    groups = Arome0025.groups_

    print(f"\n  ╔══════════════════════════════════════╗")
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
            desti = TMP_DIR / f"sfc_{paquet}_{grup}.grib2"

            ok = descarregar_fitxer_robust(session, url, desti, timeout=(15, 120), magic_bytes=MAGIC_GRIB, acceptar_404=True)
            if ok is None:
                print(f"  [{barra(pct)}] [{grup}] {paquet}: 404")
                continue
            if not ok:
                print(f"  [{barra(pct)}] [{grup}] {paquet}: ❌")
                fallits.append(f"{paquet}/{grup}")
                continue

            mb = desti.stat().st_size / (1024 * 1024)
            pes_total += desti.stat().st_size
            print(f"  [{barra(pct)}] [{grup}] {paquet}: {mb:.0f}MB", end=" ", flush=True)

            try:
                datasets = cfgrib.open_datasets(str(desti))
            except:
                print("❌")
                desti.unlink(missing_ok=True)
                continue

            if not datasets:
                print("❌")
                desti.unlink(missing_ok=True)
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
        print("     ⚠️  No s'ha pogut construir graella SFC")
    if fallits:
        print(f"     ⚠️  Grups fallits: {', '.join(fallits)}")
    print(f"     Temps: {format_time(time.time() - t0)}")

    return resultats, lats, lons

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

def informe_integritat(steps_bloc, sfc_data):
    print("\n  ╔══════════════════════════════════════╗")
    print("  ║  🔎 INFORME D'INTEGRITAT              ║")
    print("  ╚══════════════════════════════════════╝")

    hores_incompletes = []
    for step in steps_bloc:
        d = sfc_data.get(step, {})
        falten = [v for v in SFC_VARS_CRITIQUES if v not in d]
        if falten:
            hores_incompletes.append((step, falten))

    if not hores_incompletes:
        print(f"  ✅ Totes les {len(steps_bloc)} hores SFC tenen variables crítiques")
    else:
        print(f"  ⚠️  {len(hores_incompletes)}/{len(steps_bloc)} hores SFC amb variables crítiques absents")

    return [s for s, _ in hores_incompletes]

def generar_status_json(run_mf, steps_bloc, sfc_data, t_inici, fitxers, pes_total, hores_sfc_incompletes=None):
    vars_sfc = set()
    for d in sfc_data.values():
        vars_sfc.update(d.keys())

    status = {
        "generat": datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "run_meteofetch": run_mf,
        "total_hores": len(steps_bloc),
        "fitxers": len(fitxers),
        "sfc_fitxers": len(sfc_data),
        "pes_total_mb": round(pes_total / (1024 * 1024), 1),
        "temps_total_segons": round(time.time() - t_inici),
        "interromput": SHUTDOWN_REQUESTED,
        "variables_sfc_totals": len(vars_sfc),
        "integritat": {
            "hores_sfc_amb_variables_critiques_absents": hores_sfc_incompletes or [],
        },
        "fonts": {
            "sfc": "meteofetch",
            "wcs_2d": "TOTES (BT108,BT62,Altitud,Neu,Precip,CAPE,CIN,Pressio,Temp,Nuvols)",
            "wcs_3d_mitjana": "CIWC_MITJANA,CLD_RAIN_MITJANA,TPW_MITJANA (925/850/500/300)",
            "wcs_3d_isoterma": "Altitud 0°C i afins",
            "ratxa_vent": "calculada_su+sv",
            "georeferenciacio_wcs": "FIX 2026: coordenades reals llegides de ModelTiepointTag + ModelPixelScaleTag de cada TIFF (centre de píxel), en lloc de linspace assumit entre límits del domini demanat"
        },
        "nota": "SRH/Shear/Convectiu/SCP/Calamarsa es generen a td_3d.py (script separat)."
    }

    path = JSON_DIR / "status_sfc.json.gz"
    try:
        path_escrit = escriure_json_atomic(path, status)
        if path_escrit:
            print(f"\n  📊 status_sfc.json.gz: {format_size(os.path.getsize(path_escrit))}")
    except OSError as e:
        print(f"\n  ⚠️  No s'ha pogut escriure status_sfc.json: {e}")

# ═══════════════ MAIN ═══════════════
def main():
    global SHUTDOWN_REQUESTED
    t0 = time.time()

    JSON_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    try:
        print("=" * 70)
        print("  AROME 51h: SFC + WCS (part ràpida)")
        print("  🔧 Amb FIX de georeferenciació WCS (coords reals del TIFF)")
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

        # ═══ SFC METEOFETCH ═══
        sfc_mf, lats_mf, lons_mf = descarregar_sfc_meteofetch(steps_bloc, run_dt_mf)

        if SHUTDOWN_REQUESTED:
            print("\n  ⚠️  Interromput.")
            sys.exit(130)

        # ═══ WCS ═══
        session = requests.Session()
        session.headers.update({"apikey": CFG.key})

        print("\n  ╔══════════════════════════════════════╗")
        print("  ║  🛰️  WCS: DESCÀRREGA DE VARIABLES     ║")
        print("  ╚══════════════════════════════════════╝")

        wcs_2d_data = {}
        wcs_3d_data = {}
        run_str = run_dt_mf.strftime("%Y-%m-%dT%H.00.00Z")

        # ─── WCS 2D ───
        print("\n  📡 WCS 2D (GROUND)")
        for var, info in VARIABLES_WCS_2D.items():
            domini = DOMINI_GRAN if info["domini"] == "GRAN" else DOMINI_CAT
            no_horaria = info.get("no_horaria", False)
            sufix = info.get("sufix", "")

            for step in steps_bloc:
                if SHUTDOWN_REQUESTED:
                    break
                if no_horaria and step > 0:
                    continue

                dh = run_dt_mf + timedelta(hours=step)
                ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")
                cov_id = f"{var}___{run_str}{sufix}"

                pct = (step + 1) / len(steps_bloc) * 100
                print(f"  [{barra(pct)}] Descarregant {var} +{step:02d}h...", end=" ", flush=True)

                arr, missatge, coords_reals = descarregar_tile_wcs(session, cov_id, ts, domini, info["llindar"])
                if arr is None:
                    print(f"❌ {missatge}")
                    continue

                # 🔧 Interpolar a graella SFC fent servir coordenades REALS
                grid = interpolar_wcs_a_graella_desti(arr, coords_reals, domini, lons_mf, lats_mf)

                if grid is None:
                    print("❌ Poques dades")
                    continue

                if step not in wcs_2d_data:
                    wcs_2d_data[step] = {}
                wcs_2d_data[step][var] = grid

                etiqueta_fix = "geo✓" if coords_reals is not None else "geo⚠fallback"
                print(f"✅ ({etiqueta_fix})")
                time.sleep(ESPERA_ENTRE_PETICIONS)

        # ─── WCS 3D AMB MITJANA ───
        print("\n  📡 WCS 3D (MITJANA DE NIVELLS)")
        for var_base, info in VARIABLES_WCS_3D_MITJANA.items():
            domini = DOMINI_GRAN if info["domini"] == "GRAN" else DOMINI_CAT
            var_sortida = info["var_sortida"]
            nivells = info["nivells"]

            for step in steps_bloc:
                if SHUTDOWN_REQUESTED:
                    break

                pct = (step + 1) / len(steps_bloc) * 100
                print(f"  [{barra(pct)}] {var_sortida} +{step:02d}h...", end=" ", flush=True)

                grid_raw, missatge, coords_reals = descarregar_wcs_mitjana(session, var_base, nivells, domini, info["llindar"], run_dt_mf, step)
                if grid_raw is None:
                    print(f"❌ {missatge}")
                    continue

                # 🔧 Interpolar a graella SFC fent servir coordenades REALS
                grid_interp = interpolar_wcs_a_graella_desti(grid_raw, coords_reals, domini, lons_mf, lats_mf)

                if grid_interp is None:
                    print("❌ Poques dades")
                    continue

                if step not in wcs_3d_data:
                    wcs_3d_data[step] = {}
                wcs_3d_data[step][var_sortida] = grid_interp

                etiqueta_fix = "geo✓" if coords_reals is not None else "geo⚠fallback"
                print(f"✅ {missatge} ({etiqueta_fix})")
                time.sleep(ESPERA_ENTRE_PETICIONS)

        # ─── WCS 3D PV SURFACES i ISOTERMES ───
        print("\n  📡 WCS 3D (PV SURFACES i ISOTERMES)")
        for var_base, info in VARIABLES_WCS_3D_PV.items():
            domini = DOMINI_GRAN if info["domini"] == "GRAN" else DOMINI_CAT
            var_sortida = info["var_sortida"]
            nivells = info["nivells"]

            for step in steps_bloc:
                if SHUTDOWN_REQUESTED:
                    break

                pct = (step + 1) / len(steps_bloc) * 100
                print(f"  [{barra(pct)}] {var_sortida} +{step:02d}h...", end=" ", flush=True)

                dh = run_dt_mf + timedelta(hours=step)
                ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")
                cov_id = f"{var_base}___{run_str}"

                nivell = nivells[0]
                arr, missatge, coords_reals = descarregar_tile_wcs(session, cov_id, ts, domini, info["llindar"], nivell_pressure=nivell)
                if arr is None:
                    print(f"❌ {missatge}")
                    continue

                # 🔧 Interpolar a graella SFC fent servir coordenades REALS
                grid_interp = interpolar_wcs_a_graella_desti(arr, coords_reals, domini, lons_mf, lats_mf)

                if grid_interp is None:
                    print("❌ Poques dades")
                    continue

                if step not in wcs_3d_data:
                    wcs_3d_data[step] = {}
                wcs_3d_data[step][var_sortida] = grid_interp

                etiqueta_fix = "geo✓" if coords_reals is not None else "geo⚠fallback"
                print(f"✅ ({etiqueta_fix})")
                time.sleep(ESPERA_ENTRE_PETICIONS)

        # ─── WCS 3D ISOBÀRIQUES INDIVIDUALS ───
        print("\n  📡 WCS 3D (ISOBÀRIQUES INDIVIDUALS)")
        for var_base, info in VARIABLES_WCS_3D_ISOBARIC.items():
            domini = DOMINI_GRAN if info["domini"] == "GRAN" else DOMINI_CAT
            var_sortida = info["var_sortida"]
            nivells = info["nivells"]

            for step in steps_bloc:
                if SHUTDOWN_REQUESTED:
                    break

                pct = (step + 1) / len(steps_bloc) * 100
                print(f"  [{barra(pct)}] {var_sortida} +{step:02d}h...", end=" ", flush=True)

                dh = run_dt_mf + timedelta(hours=step)
                ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")
                cov_id = f"{var_base}___{run_str}"

                nivell = nivells[0]
                arr, missatge, coords_reals = descarregar_tile_wcs(session, cov_id, ts, domini, info["llindar"], nivell_pressure=nivell)
                if arr is None:
                    print(f"❌ {missatge}")
                    continue

                # 🔧 Interpolar a graella SFC fent servir coordenades REALS
                grid_interp = interpolar_wcs_a_graella_desti(arr, coords_reals, domini, lons_mf, lats_mf)

                if grid_interp is None:
                    print("❌ Poques dades")
                    continue

                if step not in wcs_3d_data:
                    wcs_3d_data[step] = {}
                wcs_3d_data[step][var_sortida] = grid_interp

                etiqueta_fix = "geo✓" if coords_reals is not None else "geo⚠fallback"
                print(f"✅ ({etiqueta_fix})")
                time.sleep(ESPERA_ENTRE_PETICIONS)

        # ═══ COMBINAR DADES ═══
        sfc_data = {}
        for step in steps_bloc:
            sfc_data[step] = {}

            if step in sfc_mf:
                sfc_data[step].update(sfc_mf[step])

            if step in wcs_2d_data:
                for var, grid in wcs_2d_data[step].items():
                    if grid is not None and np.any(~np.isnan(grid)):
                        label = VARIABLES_WCS_2D[var]["label"]
                        sfc_data[step][var] = {
                            "nombre": label, "unidades": "",
                            "datos": [float(v) if not np.isnan(v) else None for v in grid.flatten()]
                        }

            if step in wcs_3d_data:
                for var, grid in wcs_3d_data[step].items():
                    if grid is not None and np.any(~np.isnan(grid)):
                        label = var
                        for v, info in VARIABLES_WCS_3D_MITJANA.items():
                            if info["var_sortida"] == var:
                                label = info["label"]; break
                        for v, info in VARIABLES_WCS_3D_PV.items():
                            if info["var_sortida"] == var:
                                label = info["label"]; break
                        for v, info in VARIABLES_WCS_3D_ISOBARIC.items():
                            if info["var_sortida"] == var:
                                label = info["label"]; break
                        sfc_data[step][var] = {
                            "nombre": label, "unidades": "",
                            "datos": [float(v) if not np.isnan(v) else None for v in grid.flatten()]
                        }

            # Vent i ratxa
            if "su" in sfc_data[step] and "sv" in sfc_data[step]:
                su_arr = np.array(sfc_data[step]["su"]["datos"], dtype=np.float64)
                sv_arr = np.array(sfc_data[step]["sv"]["datos"], dtype=np.float64)
                wind_kmh = np.sqrt(su_arr**2 + sv_arr**2) * 3.6
                sfc_data[step]["wind_speed_10m"] = {
                    "nombre": "Vent 10m", "unidades": "km/h",
                    "datos": [round(float(x), 1) if not np.isnan(x) else None for x in wind_kmh]
                }
                gust = wind_kmh * 1.5
                sfc_data[step]["wind_gust"] = {
                    "nombre": "Ratxa 10m", "unidades": "km/h",
                    "datos": [round(float(x), 1) if not np.isnan(x) else None for x in gust]
                }

        # ═══ GENERAR JSONs ═══
        print("\n  ╔══════════════════════════════════════╗")
        print("  ║  📦 GENERANT JSONs                   ║")
        print("  ╚══════════════════════════════════════╝")

        ordre_sfc = [
            "st", "srh", "su", "sv", "wind_speed_10m", "wind_gust",
            "pressure_msl", "tp", "tsnowp", "sd", "sh2", "cape", "spbl",
            "high_cloud_cover", "low_cloud_cover", "medium_cloud_cover",
            "temp_min2m", "temp_max2m", "sp",
            "CIWC_MITJANA", "CLD_RAIN_MITJANA", "TPW_MITJANA",
            "THETAV_850",
        ]

        ts = len(steps_bloc)
        fitxers = []
        pes_total = 0

        for step in steps_bloc:
            if step in sfc_data and sfc_data[step] and lats_mf:
                vo = {}
                for k in ordre_sfc:
                    if k in sfc_data[step]:
                        vo[k] = sfc_data[step][k]
                for k, v in sfc_data[step].items():
                    if k not in vo:
                        vo[k] = v
                res = generar_json(step, vo, run_dt_mf, lats_mf, lons_mf, "sfc", ts)
                if res:
                    fitxers.append(res[0])
                    pes_total += res[1]

        # ═══ INFORME FINAL ═══
        hores_sfc_incompletes = informe_integritat(steps_bloc, sfc_data)
        generar_status_json(run_mf, steps_bloc, sfc_data, t0, fitxers, pes_total, hores_sfc_incompletes)

        print("\n  ╔══════════════════════════════════════╗")
        estat = "⚠️  INTERROMPUT" if SHUTDOWN_REQUESTED else "✅ FINALITZAT"
        print(f"  ║  {estat}")
        print(f"  ║  Fitxers: {len(fitxers)} | SFC: {len(sfc_data)}/{ts}")
        print(f"  ║  WCS 2D: {len(wcs_2d_data)} hores | WCS 3D: {len(wcs_3d_data)} hores")
        print(f"  ║  Pes total: {format_size(pes_total)} | Temps: {format_time(time.time() - t0)}")
        print("  ╚══════════════════════════════════════╝")

        if SHUTDOWN_REQUESTED:
            sys.exit(130)
        elif hores_sfc_incompletes:
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