#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
t_final_blindado.py — VERSIÓ FINAL COMPLETA · 51 HORES
═══════════════════════════════════════════════════════════════════════════════════
 SFC: meteofetch SP1+SP2 (17 vars)
 3D: meteofetch IP1+IP3
 WCS: TOTES les variables que funcionen (segons test)
 RATXA VENT: Calculada de su+sv
 SRH + SHEAR: SRH 0-1km, 0-3km, Shear 0-3km, Shear 0-6km
 CONVECTIU: LCL, LFC, LI, EL
 🌪️ SCP (Supercell Composite Parameter) + Calamarsa (SHIP ajustat amb w i LFC)

 🔧 FIX GEOREFERENCIACIÓ WCS (2026): el TIFF que retorna el WCS de
    Météo-France NO respecta el SCALESIZE demanat (retorna la resolució
    nativa AROME, 0.025°) i el ModelTiepointTag apunta a la CANTONADA
    del píxel (0,0), no al seu CENTRE (convenció GeoTIFF PixelIsArea).
    Abans es feia servir np.linspace(lon_min, lon_max, w_src) assumint
    que lon_min/lon_max eren els CENTRES dels píxels extrems, cosa que
    introduïa un desquadrament de mig píxel (~0.0125°) que es feia molt
    visible en dominis grans. Ara es llegeixen ModelTiepointTag +
    ModelPixelScaleTag de CADA TIFF real i es calculen els centres de
    píxel correctament: lon_centre = lon_origen + (i+0.5)*res_x, etc.
═══════════════════════════════════════════════════════════════════════════════════
"""

import atexit, io, json, logging, os, random, re, shutil, signal, sys, time, traceback, warnings
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
import requests
import gzip
import xarray as xr
import cfgrib
import tifffile
from requests.adapters import HTTPAdapter
from scipy.interpolate import griddata
from collections import defaultdict

logging.getLogger("cfgrib").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", category=FutureWarning)

# ═══════════════ CONFIG ═══════════════

def carregar_config():
    d = os.path.dirname(os.path.abspath(__file__))
    path_cfg = os.path.join(d, "configNE.json")
    if not os.path.exists(path_cfg):
        path_cfg = os.path.join(d, "configNE.json")
    if not os.path.exists(path_cfg):
        sys.exit(f"❌ No es troba configNE.json o config.json a: {path_cfg}")
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
    c.la0 = r.get("lat_min", 40.3)
    c.la1 = r.get("lat_max", 42.9)
    c.lo0 = r.get("lon_min", 0.1)
    c.lo1 = r.get("lon_max", 3.4)
    out = cfg.get("output_dir", "../meu-mapa/public/web_data_NE")
    if not os.path.isabs(out):
        out = os.path.join(d, out)
    c.out = out
    
    return c

CFG = carregar_config()

WCS_SERVICE = "MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS"
WCS_BASE_URL = f"https://public-api.meteofrance.fr/public/arome/1.0/wcs/{WCS_SERVICE}"

# Directoris de sortida
JSON_DIR = Path(CFG.out)  # web_data/
LOG_DIR = Path(CFG.out) / "logs"  # web_data/logs/
TMP_DIR = Path(os.environ.get("TEMP", "/tmp")) / "arome_final"

# Crear directoris
JSON_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

DOMINI_CAT = {"lon_min": -4.0, "lon_max": 4.5, "lat_min": 36.5, "lat_max": 44.0, "w": 217, "h": 245}
DOMINI_GRAN = {"lon_min": -4.0, "lon_max": 4.5, "lat_min": 36.5, "lat_max": 44.0, "w": 217, "h": 245}

# ═══════════════ CONFIGURACIÓ ═══════════════

MAX_REINTENTS = 3
ESPERA_ENTRE_REINTENTS = 2
ESPERA_ENTRE_PETICIONS = 0.7
MAX_REINTENTS_GRIB = 5
TOTAL_HORES = 51
MAGIC_GRIB = (b"GRIB",)

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

# ═══════════════ NETEJA DE FITXERS ANTICS ═══════════════

def netejar_fitxers_antics():
    """Neteja JSONs i logs antics abans d'executar."""
    print("\n  🗑️  Netejant fitxers antics...")
    
    # 1. Borrar JSONs antics (web_data/*.json.gz)
    n = pes = 0
    for pattern in ["*.json.gz", "*.json"]:
        for f in JSON_DIR.glob(pattern):
            try:
                if f.name.startswith("sfc_") or f.name.startswith("3d_") or f.name == "status.json.gz":
                    pes += f.stat().st_size
                    f.unlink()
                    n += 1
            except:
                pass
    if n:
        print(f"     ✅ Borrats {n} JSONs ({format_size(pes)} alliberats)")
    
    # 2. Mantenir només els últims 5 logs
    logs = sorted(LOG_DIR.glob("run_*.log"), key=lambda x: x.stat().st_mtime, reverse=True)
    if len(logs) > 5:
        for log in logs[5:]:
            try:
                log.unlink()
            except:
                pass
        print(f"     ✅ Mantinguts últims 5 logs (borrats {len(logs)-5})")

# ═══════════════════════════════════════════════════════════════════════
#  VARIABLES WCS (TOTES LES QUE FUNCIONEN)
# ═══════════════════════════════════════════════════════════════════════

VARIABLES_WCS_2D = {
    "BRIGHTNESS_TEMPERATURE__GROUND_OR_WATER_SURFACE": {
        "llindar": 350, "cmap": "RdYlBu_r", "label": "BT 10.8µm", "domini": "GRAN"
    },
    "BRIGHTNESS_TEMPERATURE_62__GROUND_OR_WATER_SURFACE": {
        "llindar": 350, "cmap": "RdYlBu_r", "label": "BT 6.2µm (vapor)", "domini": "GRAN"
    },
    "GEOMETRIC_HEIGHT__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "terrain", "label": "Altitud geomètrica", "domini": "CAT"
    },
    "SNOW_DEPTH__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "Blues", "label": "Gruix de neu", "domini": "CAT"
    },
    "REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "plasma", "label": "Reflectivitat dBZ", "domini": "CAT"
    },

    "CONVECTIVE_AVAILABLE_POTENTIAL_ENERGY__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "RdBu_r", "label": "CAPE", "domini": "CAT"
    },
    "CONVECTIVE_INHIBITION__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "RdBu_r", "label": "CIN", "domini": "CAT"
    },
    "PRESSURE__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "RdBu_r", "label": "Pressió superfície", "domini": "CAT"
    },
    "PRESSURE__MEAN_SEA_LEVEL": {
        "llindar": 9000, "cmap": "RdBu_r", "label": "Pressió MSL", "domini": "CAT"
    },
    "TEMPERATURE__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "RdBu_r", "label": "Temperatura superfície", "domini": "CAT"
    },
    "TOTAL_CLOUD_COVER__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "gray", "label": "Nebulositat total", "domini": "CAT"
    },
    "TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "Blues", "label": "Intensitat precip.", "domini": "CAT"
    },
    "DIAG_GRELE__GROUND_OR_WATER_SURFACE": {
        "llindar": 9000, "cmap": "Reds", "label": "Calamarsa", "domini": "CAT"
    },
    "DIAG_SCP__GROUND": {
        "llindar": 9000, "cmap": "viridis", "label": "Risc de supercèl·lula", "domini": "CAT"
    },
    "DIAG_STP__GROUND": {
        "llindar": 9000, "cmap": "viridis", "label": "Tornados EF2+", "domini": "CAT"
    }
}

# Variables WCS 3D (ISOBARIC) - AMB MITJANA DE NIVELLS
VARIABLES_WCS_3D_MITJANA = {
    "CIWC__ISOBARIC": {
        "nivells": ["925", "850", "500", "300"],
        "llindar": 9000,
        "cmap": "Blues",
        "label": "Gel núvols (mitjana)",
        "domini": "CAT",
        "var_sortida": "CIWC_MITJANA"
    },
    "CLD_RAIN__ISOBARIC": {
        "nivells": ["925", "850", "500", "300"],
        "llindar": 9000,
        "cmap": "Blues",
        "label": "Pluja núvols (mitjana)",
        "domini": "CAT",
        "var_sortida": "CLD_RAIN_MITJANA"
    },
    "TPW__ISOBARIC": {
        "nivells": ["925", "850", "500", "300"],
        "llindar": 9000,
        "cmap": "Blues",
        "label": "Aigua precipitable (mitjana)",
        "domini": "CAT",
        "var_sortida": "TPW_MITJANA"
    },
}

# Variables WCS 3D (PV SURFACES - sense mitjana)
VARIABLES_WCS_3D_PV = {
    "GEOPOTENTIAL__POTENTIAL_VORTICITY_SURFACE_1500": {
        "nivells": ["1500"], "llindar": 9000, "cmap": "RdBu_r", 
        "label": "Geopotencial PV=1.5", "domini": "CAT", "var_sortida": "GEOPOTENTIAL_PV1500"
    },
    "GEOPOTENTIAL__POTENTIAL_VORTICITY_SURFACE_2000": {
        "nivells": ["2000"], "llindar": 9000, "cmap": "RdBu_r", 
        "label": "Geopotencial PV=2.0", "domini": "CAT", "var_sortida": "GEOPOTENTIAL_PV2000"
    },
    "POTENTIAL_TEMPERATURE__POTENTIAL_VORTICITY_SURFACE_1500": {
        "nivells": ["1500"], "llindar": 9000, "cmap": "coolwarm", 
        "label": "Theta PV=1.5", "domini": "CAT", "var_sortida": "THETA_PV1500"
    },
    "POTENTIAL_TEMPERATURE__POTENTIAL_VORTICITY_SURFACE_2000": {
        "nivells": ["2000"], "llindar": 9000, "cmap": "coolwarm", 
        "label": "Theta PV=2.0", "domini": "CAT", "var_sortida": "THETA_PV2000"
    },
    "U_COMPONENT_OF_WIND__POTENTIAL_VORTICITY_SURFACE_1500": {
        "nivells": ["1500"], "llindar": 9000, "cmap": "RdBu_r", 
        "label": "Vent U PV=1.5", "domini": "CAT", "var_sortida": "U_PV1500"
    },
    "U_COMPONENT_OF_WIND__POTENTIAL_VORTICITY_SURFACE_2000": {
        "nivells": ["2000"], "llindar": 9000, "cmap": "RdBu_r", 
        "label": "Vent U PV=2.0", "domini": "CAT", "var_sortida": "U_PV2000"
    },
    "V_COMPONENT_OF_WIND__POTENTIAL_VORTICITY_SURFACE_1500": {
        "nivells": ["1500"], "llindar": 9000, "cmap": "RdBu_r", 
        "label": "Vent V PV=1.5", "domini": "CAT", "var_sortida": "V_PV1500"
    },
    "V_COMPONENT_OF_WIND__POTENTIAL_VORTICITY_SURFACE_2000": {
        "nivells": ["2000"], "llindar": 9000, "cmap": "RdBu_r", 
        "label": "Vent V PV=2.0", "domini": "CAT", "var_sortida": "V_PV2000"
    },
    "WIND_SPEED__POTENTIAL_VORTICITY_SURFACE_1500": {
        "nivells": ["1500"], "llindar": 9000, "cmap": "viridis", 
        "label": "Vent total PV=1.5", "domini": "CAT", "var_sortida": "WIND_PV1500"
    },
    "WIND_SPEED__POTENTIAL_VORTICITY_SURFACE_2000": {
        "nivells": ["2000"], "llindar": 9000, "cmap": "viridis", 
        "label": "Vent total PV=2.0", "domini": "CAT", "var_sortida": "WIND_PV2000"
    },
    "ALTITUDE_TEMPERATURE__ISOTHERMAL_LEVEL_27315": {
        "nivells": ["273.15"], "llindar": 9000, "cmap": "coolwarm", 
        "label": "Altitud isoterma 0°C", "domini": "CAT", "var_sortida": "ALTITUDE_ISOTERMA_0C"
    },
    "ALTITUDE_TEMPERATURE__ISOTHERMAL_LEVEL_26315": {
        "nivells": ["263.15"], "llindar": 9000, "cmap": "coolwarm", 
        "label": "Altitud isoterma -10°C", "domini": "CAT", "var_sortida": "ALTITUDE_ISOTERMA_M10C"
    },
}

# Variables WCS 3D (ISOBÀRIQUES INDIVIDUALS - sense mitjana)
VARIABLES_WCS_3D_ISOBARIC = {
    "THETAV__ISOBARIC": {
        "nivells": ["850"], "llindar": 9000, "cmap": "coolwarm", 
        "label": "Theta virtual 850hPa", "domini": "CAT", "var_sortida": "THETAV_850"
    },
}


# ═══════════════ VARIABLES METEOFETCH ═══════════════

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
    if s < 60:
        return f"{s:.0f}s"
    elif s < 3600:
        return f"{int(s // 60)}m {int(s % 60)}s"
    else:
        return f"{int(s // 3600)}h {int((s % 3600) // 60)}m"

def format_size(b):
    if b < 1024:
        return f"{b} B"
    elif b < 1024*1024:
        return f"{b/1024:.1f} KB"
    elif b < 1024*1024*1024:
        return f"{b/(1024*1024):.1f} MB"
    else:
        return f"{b/(1024*1024*1024):.2f} GB"

def barra(pct, ample=20):
    fet = int(ample * pct / 100)
    return f"[{'█' * fet}{'░' * (ample - fet)}] {pct:5.1f}%"

def _backoff(intent, base=2.0, cap=30.0):
    return min(cap, base * (2 ** (intent - 1))) + random.uniform(0, 1)

def escriure_json_atomic(path: Path, data):
    """Escriu un fitxer JSON comprimit en gzip."""
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
#  🔧 NOU: GEOREFERENCIACIÓ REAL DEL TIFF (fix del desquadrament)
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
#  molt visible quan el domini demanat és gran (verificat amb diagnòstic
#  real: shape esperat (245,217) vs. shape real (261,341)).
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
            # habitual nord→sud en rasters, confirmat pel tiepoint amb
            # Y=44.0=lat_max i que sabem que el domini va de 36.5 a 44.0).
            lons_centre = lon_origen + (np.arange(w_real) + 0.5) * res_x
            lats_centre = lat_origen - (np.arange(h_real) + 0.5) * res_y

            return lons_centre, lats_centre
    except Exception:
        return None


# ═══════════════ WCS: DESCARREGAR TILE ═══════════════

def descarregar_tile_wcs(session, cov_id, time_str, domini, llindar_nan, nivell_pressure=None, intent=1):
    """
    Descarrega un tile WCS amb reintents per HTTP 502.

    🔧 Ara retorna una tupla (arr, missatge, coords_reals) on coords_reals
    és (lons_centre, lats_centre) llegit dels tags GeoTIFF reals, o bé
    None si no s'han pogut llegir (en aquest cas cal fer fallback amb
    linspace, encara que sabem que això pot introduir l'error de mig
    píxel descrit més amunt).
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

        if r.status_code == 502:
            if intent < MAX_REINTENTS:
                time.sleep(ESPERA_ENTRE_REINTENTS)
                return descarregar_tile_wcs(session, cov_id, time_str, domini, llindar_nan, nivell_pressure, intent + 1)
            else:
                return None, f"HTTP 502 (reintents esgotats)", None

        if r.status_code == 429:
            if intent < MAX_REINTENTS + 2:
                espera = _backoff(intent, base=5.0, cap=30.0)
                time.sleep(espera)
                return descarregar_tile_wcs(session, cov_id, time_str, domini, llindar_nan, nivell_pressure, intent + 1)
            else:
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


def coords_fallback_linspace(domini, h_src, w_src):
    """
    Fallback si per algun motiu no es poden llegir els tags GeoTIFF.
    Manté el comportament ANTIC (linspace entre els límits demanats).
    Es manté disponible per no trencar l'execució, però ara només
    s'hauria d'utilitzar en el cas rar que el TIFF no porti tags.
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
        # Fallback (rar): mateix comportament que abans del fix
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


# ═══════════════ DESCARREGAR WCS AMB MITJANA DE NIVELLS ═══════════════

def descarregar_wcs_mitjana(session, var_base, nivells, domini, llindar, run_dt, step):
    """
    Descarrega tots els nivells d'una variable WCS i en calcula la mitjana.
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
        arr, missatge, coords_reals = descarregar_tile_wcs(
            session, cov_id, ts, domini, llindar, 
            nivell_pressure=nivell
        )
        
        if arr is not None:
            grids.append(arr)
            nivells_ok.append(nivell)
            if coords_reals_guardades is None:
                coords_reals_guardades = coords_reals
        
        time.sleep(ESPERA_ENTRE_PETICIONS)
    
    if len(grids) == 0:
        return None, "Cap nivell disponible", None
    
    # Calcular mitjana (ignorant NaNs)
    mitjana = np.nanmean(np.array(grids), axis=0)
    
    # Comprovar que hi ha dades
    if np.sum(~np.isnan(mitjana)) < 10:
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
            "srh_01": srh_01,
            "srh_03": srh_03,
            "shear_03": shear_03,
            "shear_06": shear_06
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

    # Factor w
    w_vals = [w_dict[f"w_{niv}"] for niv in (500, 300) if f"w_{niv}" in w_dict]
    if w_vals:
        w_mig = np.nanmean(np.array(w_vals), axis=0)
        w_mig = np.where(np.isnan(w_mig), 0.0, w_mig)
        w_asc = np.clip(-w_mig, 0.0, None)
        w_factor = 0.3 + 0.7 * np.clip(w_asc / 6.0, 0.0, 1.0)
    else:
        w_factor = np.full(n_punts, 0.6)

    # Factor LFC
    lfc_safe = np.where(np.isnan(lfc_m), 3500.0, lfc_m)
    lfc_factor = np.interp(lfc_safe, [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000],
                                    [1.5, 1.3, 1.0, 0.7, 0.4, 0.2, 0.08, 0.03, 0.01])

    # Factor CIN
    cin_factor = np.full(n_punts, 0.8)

    if t_sfc is not None and td_sfc is not None and p_sfc is not None:
        try:
            cin_arr = np.full(n_punts, np.nan)
            for i in range(n_punts):
                if np.isnan(t_sfc[i]) or np.isnan(td_sfc[i]) or np.isnan(p_sfc[i]):
                    continue
                if np.isnan(lfc_m[i]) or lfc_m[i] <= 0:
                    continue

                p_lfc = p_sfc[i] * np.exp(-lfc_m[i] / 8000.0)
                nivells_per_sota = [pl[j] for j in range(len(pl)) if pl[j] >= p_lfc and pl[j] <= p_sfc[i]]

                if len(nivells_per_sota) < 2:
                    continue

                cin_acum = 0.0
                for j in range(len(nivells_per_sota) - 1):
                    p1 = nivells_per_sota[j]
                    p2 = nivells_per_sota[j + 1]

                    t_parc_1, _, _ = _perfil_parcela_a_nivell(
                        np.array([t_sfc[i]]), np.array([td_sfc[i]]),
                        np.array([p_sfc[i]]), np.array([p1])
                    )
                    t_parc_2, _, _ = _perfil_parcela_a_nivell(
                        np.array([t_sfc[i]]), np.array([td_sfc[i]]),
                        np.array([p_sfc[i]]), np.array([p2])
                    )

                    idx_1 = pl.index(p1) if p1 in pl else None
                    idx_2 = pl.index(p2) if p2 in pl else None

                    if idx_1 is None or idx_2 is None:
                        continue

                    t_amb_1 = T[idx_1, i]
                    t_amb_2 = T[idx_2, i]

                    if np.isnan(t_parc_1[0]) or np.isnan(t_parc_2[0]) or np.isnan(t_amb_1) or np.isnan(t_amb_2):
                        continue

                    delta_t_1 = t_parc_1[0] - t_amb_1
                    delta_t_2 = t_parc_2[0] - t_amb_2

                    if delta_t_1 < 0 or delta_t_2 < 0:
                        dp = p1 - p2
                        delta_t_mitja = (min(delta_t_1, 0) + min(delta_t_2, 0)) / 2.0
                        cin_acum += -RD * delta_t_mitja * (dp / ((p1 + p2) / 2.0))

                if cin_acum > 0:
                    cin_arr[i] = cin_acum

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

def calcular_convectiu(step, td_data, sfc_step, n_punts_sfc):
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

    scp_arr = None
    hail_arr = None
    srh_shear = sfc_step.get("_srh_shear_tmp")

    if srh_shear is not None:
        w_dict = {}
        for niv in (500, 300):
            k = f"w_{niv}"
            if k in d:
                w_dict[k] = np.array(d[k]["datos"], dtype=np.float64)

        cape_arr = np.array(sfc_step["cape"]["datos"], dtype=np.float64) if "cape" in sfc_step else np.full(n_punts_sfc, np.nan)
        cape_arr_n3 = interpolar_graelles(cape_arr, n_punts_sfc, n3) if n_punts_sfc != n3 else cape_arr
        srh_01_n3 = srh_shear["srh_01"]
        shear_06_n3 = srh_shear["shear_06"]
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
    else:
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
        print(f"  ✅ Totes les {len(steps_bloc)} hores SFC tenen variables crítiques")
    else:
        print(f"  ⚠️  {len(hores_incompletes)}/{len(steps_bloc)} hores SFC amb variables crítiques absents")

    if not hores_3d_faltants:
        print(f"  ✅ Totes les {len(steps_bloc)} hores 3D generades")
    else:
        print(f"  ⚠️  {len(hores_3d_faltants)}/{len(steps_bloc)} hores 3D absents")

    return [s for s, _ in hores_incompletes], hores_3d_faltants

def generar_status_json(run_mf, steps_bloc, sfc_data, td_data, t_inici, fitxers, pes_total,
                        hores_sfc_incompletes=None, hores_3d_faltants=None):
    vars_sfc = set()
    for d in sfc_data.values():
        vars_sfc.update(d.keys())

    status = {
        "generat": datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "run_meteofetch": run_mf,
        "total_hores": len(steps_bloc),
        "fitxers": len(fitxers),
        "sfc_fitxers": len(sfc_data),
        "3d_fitxers": len(td_data),
        "pes_total_mb": round(pes_total / (1024 * 1024), 1),
        "temps_total_segons": round(time.time() - t_inici),
        "interromput": SHUTDOWN_REQUESTED,
        "variables_sfc_totals": len(vars_sfc),
        "integritat": {
            "hores_sfc_amb_variables_critiques_absents": hores_sfc_incompletes or [],
            "hores_3d_absents": hores_3d_faltants or []
        },
        "fonts": {
            "sfc": "meteofetch",
            "3d": "meteofetch",
            "wcs_2d": "TOTES (BT108,BT62,Altitud,Neu,Visibilitat,Precip,Reflectivitat,CAPE,CIN,Pressio,Temp,Nuvols,CapaLimite)",
            "wcs_3d_mitjana": "CIWC_MITJANA,CLD_RAIN_MITJANA,TPW_MITJANA (925/850/500/300)",
            "wcs_3d_pv": "PV1500/PV2000 (Geopotencial,Theta,Vent U,V,VentTotal)",
            "wcs_3d_isoterma": "Altitud 0°C i -10°C",
            "convectiu": "calculat_local",
            "shear": "calculat_local",
            "supercelula_scp": "calculat_local_SCP_estandard",
            "calamarsa_ship": "calculat_local_SHIP_ajustat_w_lfc",
            "ratxa_vent": "calculada_su+sv",
            "temp_min_max": "meteofetch_amb_fallback",
            "georeferenciacio_wcs": "FIX 2026: coordenades reals llegides de ModelTiepointTag + ModelPixelScaleTag de cada TIFF (centre de píxel), en lloc de linspace assumit entre límits del domini demanat"
        }
    }

    path = JSON_DIR / "status.json.gz"
    try:
        path_escrit = escriure_json_atomic(path, status)
        if path_escrit:
            print(f"\n  📊 status.json.gz: {format_size(os.path.getsize(path_escrit))}")
    except OSError as e:
        print(f"\n  ⚠️  No s'ha pogut escriure status.json: {e}")

# ═══════════════ MAIN ═══════════════
def main():
    global SHUTDOWN_REQUESTED

    t0 = time.time()
    
    # Crear directoris
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    try:
        print("=" * 70)
        print("  AROME 51h: SFC + 3D + WCS + SRH/SHEAR + SCP/STP")
        print("  🔧 Amb FIX de georeferenciació WCS (coords reals del TIFF)")
        print(f"  JSONs: {JSON_DIR}")
        print("=" * 70)

        # 🔥 NETEGAR FITXERS ANTICS
        netejar_fitxers_antics()

        try:
            import meteofetch
        except ImportError:
            sys.exit("❌ Falta meteofetch")

        if not comprovar_connexio():
            sys.exit(1)

        # ═══ OBTENIR EL RUN ═══
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

        # ═══ WCS (DESCARREGAR VARIABLES) ═══
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

            for step in steps_bloc:
                if SHUTDOWN_REQUESTED:
                    break

                if no_horaria and step > 0:
                    continue

                dh = run_dt_mf + timedelta(hours=step)
                ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")
                cov_id = f"{var}___{run_str}"

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

                # Guardar al diccionari
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
                
                grid_raw, missatge, coords_reals = descarregar_wcs_mitjana(
                    session, var_base, nivells, domini, info["llindar"], 
                    run_dt_mf, step
                )
                
                if grid_raw is None:
                    print(f"❌ {missatge}")
                    continue
                
                # 🔧 Interpolar a graella SFC fent servir coordenades REALS
                grid_interp = interpolar_wcs_a_graella_desti(grid_raw, coords_reals, domini, lons_mf, lats_mf)

                if grid_interp is None:
                    print("❌ Poques dades")
                    continue
                
                # Guardar al diccionari 3D
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
                
                # Per PV surfaces, el "nivell" és el valor PV (1500, 2000) o temperatura (273.15)
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
                
                # Guardar al diccionari
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
                
                # Per nivells isobàrics, el "nivell" és la pressió en hPa
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
                
                # Guardar al diccionari
                if step not in wcs_3d_data:
                    wcs_3d_data[step] = {}
                wcs_3d_data[step][var_sortida] = grid_interp
                
                etiqueta_fix = "geo✓" if coords_reals is not None else "geo⚠fallback"
                print(f"✅ ({etiqueta_fix})")
                time.sleep(ESPERA_ENTRE_PETICIONS)

        # ═══ 3D METEOFETCH ═══
        td_data_tmp, lats_3d, lons_3d = descarregar_3d(steps_bloc, run_dt_mf)
        td_data = td_data_tmp

        # ═══ SRH + SHEAR ═══
        shear_data_per_hora = calcular_srh_i_shear(steps_bloc, td_data, lats_3d, lons_3d)

        # ═══ COMBINAR DADES ═══
        sfc_data = {}
        for step in steps_bloc:
            sfc_data[step] = {}

            # Meteofetch SFC
            if step in sfc_mf:
                sfc_data[step].update(sfc_mf[step])

            # WCS 2D
            if step in wcs_2d_data:
                for var, grid in wcs_2d_data[step].items():
                    if grid is not None and np.any(~np.isnan(grid)):
                        label = VARIABLES_WCS_2D[var]["label"]
                        sfc_data[step][var] = {
                            "nombre": label,
                            "unidades": "",
                            "datos": [float(v) if not np.isnan(v) else None for v in grid.flatten()]
                        }

            # WCS 3D (mitjana i PV)
            if step in wcs_3d_data:
                for var, grid in wcs_3d_data[step].items():
                    if grid is not None and np.any(~np.isnan(grid)):
                        # Buscar la info original
                        label = var
                        for v, info in VARIABLES_WCS_3D_MITJANA.items():
                            if info["var_sortida"] == var:
                                label = info["label"]
                                break
                        for v, info in VARIABLES_WCS_3D_PV.items():
                            if info["var_sortida"] == var:
                                label = info["label"]
                                break
                        for v, info in VARIABLES_WCS_3D_ISOBARIC.items():
                            if info["var_sortida"] == var:
                                label = info["label"]
                                break
                        sfc_data[step][var] = {
                            "nombre": label,
                            "unidades": "",
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

            # SRH + Shear
            if step in shear_data_per_hora:
                shear = shear_data_per_hora[step]
                for k, nom, u in [("srh_01", "SRH 0-1km", "m²/s²"),
                                  ("srh_03", "SRH 0-3km", "m²/s²"),
                                  ("shear_03", "Shear 0-3km", "m/s"),
                                  ("shear_06", "Shear 0-6km", "m/s")]:
                    if shear.get(k) is not None and np.sum(~np.isnan(shear[k])) > 100:
                        sfc_data[step][k] = {
                            "nombre": nom, "unidades": u,
                            "datos": [round(float(v), 1) if not np.isnan(v) else None for v in shear[k]]
                        }
                sfc_data[step]["_srh_shear_tmp"] = {
                    "srh_01": shear["srh_01"],
                    "shear_06": shear["shear_06"]
                }

        # ═══ CONVECTIU + SCP + STP + CALAMARSA ═══
        if lats_mf and td_data:
            print("\n  ╔══════════════════════════════════════╗")
            print("  ║  🌡️  Convectiu + SCP + STP + Calamarsa ║")
            print("  ╚══════════════════════════════════════╝")
            n_punts = len(lats_mf) * len(lons_mf)
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
                    print(f"    ⚠️  convectiu +{step:02d}h: {e}")
                sfc_data[step].pop("_srh_shear_tmp", None)
            print(f"  ✅ {n_ok}/{len(steps_bloc)} hores")

        # ═══ GENERAR JSONs ═══
        print("\n  ╔══════════════════════════════════════╗")
        print("  ║  📦 GENERANT JSONs                   ║")
        print("  ╚══════════════════════════════════════╝")

        ordre_sfc = [
            "st", "srh", "su", "sv", "wind_speed_10m", "wind_gust",
            "pressure_msl", "tp", "tsnowp", "sd", "sh2", "cape", "spbl",
            "high_cloud_cover", "low_cloud_cover", "medium_cloud_cover",
            "temp_min2m", "temp_max2m", "sp",
            "BRIGHTNESS_TEMPERATURE__GROUND_OR_WATER_SURFACE",
            "BRIGHTNESS_TEMPERATURE_62__GROUND_OR_WATER_SURFACE",
            "GEOMETRIC_HEIGHT__GROUND_OR_WATER_SURFACE",
            "SNOW_DEPTH__GROUND_OR_WATER_SURFACE",
            "WATER_EQUIVALENT_ACCUMULATED_SNOW__GROUND_OR_WATER_SURFACE",
            "PRECIPITATION_TYPE_60_MIN__GROUND_OR_WATER_SURFACE",
            "SEVERE_PRECIPITATION_TYPE_60_MIN__GROUND_OR_WATER_SURFACE",
            "REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE",
            "REFLECTIVITY_MAX__GROUND_OR_WATER_SURFACE",
            "VISIBILITY_MINI_60MIN__GROUND_OR_WATER_SURFACE",
            "VISIBILITY_MINI_PRECIP_60MIN__GROUND_OR_WATER_SURFACE",
            "CONVECTIVE_AVAILABLE_POTENTIAL_ENERGY__GROUND_OR_WATER_SURFACE",
            "CONVECTIVE_INHIBITION__GROUND_OR_WATER_SURFACE",
            "PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE",
            "PRESSURE__GROUND_OR_WATER_SURFACE",
            "PRESSURE__MEAN_SEA_LEVEL",
            "TEMPERATURE__GROUND_OR_WATER_SURFACE",
            "TOTAL_CLOUD_COVER__GROUND_OR_WATER_SURFACE",
            "HIGH_CLOUD_COVER__GROUND_OR_WATER_SURFACE",
            "MEDIUM_CLOUD_COVER__GROUND_OR_WATER_SURFACE",
            "LOW_CLOUD_COVER__GROUND_OR_WATER_SURFACE",
            "PLANETARY_BOUNDARY_LAYER_HEIGHT__GROUND_OR_WATER_SURFACE",
            "MEAN_LAYER_CAPE__GROUND_OR_WATER_SURFACE",
            "CIWC_MITJANA",
            "CLD_RAIN_MITJANA",
            "TPW_MITJANA",
            "GEOPOTENTIAL_PV1500", "GEOPOTENTIAL_PV2000",
            "THETA_PV1500", "THETA_PV2000",
            "U_PV1500", "U_PV2000",
            "V_PV1500", "V_PV2000",
            "WIND_PV1500", "WIND_PV2000",
            "ALTITUDE_ISOTERMA_0C", "ALTITUDE_ISOTERMA_M10C",
            "THETAV_850",
            "DIAG_GRELE__GROUND_OR_WATER_SURFACE",
            "PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE",
            "SEVERE_PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE",
            "TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE",
            "VISIBILITY_MINI_15MIN__GROUND_OR_WATER_SURFACE",
            "VISIBILITY_MINI_PRECIP_15MIN__GROUND_OR_WATER_SURFACE",
            "lcl_m", "lfc_m", "lifted_index", "el_m",
            "srh_01", "srh_03", "shear_03", "shear_06",
            "scp", "hail_cm"
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
                    if k not in vo and k != "_srh_shear_tmp":
                        vo[k] = v
                res = generar_json(step, vo, run_dt_mf, lats_mf, lons_mf, "sfc", ts)
                if res:
                    fitxers.append(res[0])
                    pes_total += res[1]

            if step in td_data and td_data[step] and lats_3d:
                res = generar_json(step, td_data[step], run_dt_mf, lats_3d, lons_3d, "3d", ts)
                if res:
                    fitxers.append(res[0])
                    pes_total += res[1]

        # ═══ INFORME FINAL ═══
        hores_sfc_incompletes, hores_3d_faltants = informe_integritat(steps_bloc, sfc_data, td_data)
        generar_status_json(run_mf, steps_bloc, sfc_data, td_data, t0, fitxers, pes_total,
                           hores_sfc_incompletes, hores_3d_faltants)

        print("\n  ╔══════════════════════════════════════╗")
        estat = "⚠️  INTERROMPUT" if SHUTDOWN_REQUESTED else "✅ FINALITZAT"
        print(f"  ║  {estat}")
        print(f"  ║  Fitxers: {len(fitxers)} | SFC: {len(sfc_data)}/{ts} | 3D: {len(td_data)}/{ts}")
        print(f"  ║  WCS 2D: {len(wcs_2d_data)} hores | WCS 3D: {len(wcs_3d_data)} hores")
        print(f"  ║  Pes total: {format_size(pes_total)} | Temps: {format_time(time.time() - t0)}")
        print("  ╚══════════════════════════════════════╝")

        if SHUTDOWN_REQUESTED:
            sys.exit(130)
        elif hores_sfc_incompletes or hores_3d_faltants:
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