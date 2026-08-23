#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
t_risc_supercelules_granis.py — DESCARREGA PER FASES (SATÈL·LIT PRIMER)
FASE 1: Satèl·lit (WCS) → PNGs immediats
FASE 2: Meteofrance (GRIB) → PNGs després
AMB DIAGNOSI DETALLADA DE COBERTURES WCS
═══════════════════════════════════════════════════════════════════════════════════
"""

import atexit, io, json, logging, os, random, re, shutil, signal, sys, time, traceback, warnings
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import requests
import xarray as xr
import cfgrib
import tifffile
from requests.adapters import HTTPAdapter
from scipy.interpolate import griddata

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.colors import LinearSegmentedColormap

logging.getLogger("cfgrib").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", category=FutureWarning)

# ═══════════════ CONFIG ═══════════════

def carregar_config():
    d = os.path.dirname(os.path.abspath(__file__))
    path_cfg_ne = os.path.join(d, "configNE.json")
    path_cfg_png = os.path.join(d, "configPNG.json")
    
    satelit_cfg = {}
    if os.path.exists(path_cfg_ne):
        try:
            with open(path_cfg_ne, encoding="utf-8-sig") as f:
                satelit_cfg = json.load(f)
            print(f"  ✓ Satèl·lit config: {os.path.basename(path_cfg_ne)}")
        except json.JSONDecodeError as e:
            print(f"  ⚠️  {os.path.basename(path_cfg_ne)} té errors: {e}")
    else:
        print(f"  ⚠️  No es troba {os.path.basename(path_cfg_ne)}")
    
    if not os.path.exists(path_cfg_png):
        path_cfg_png = os.path.join(d, "config.json")
    if not os.path.exists(path_cfg_png):
        sys.exit(f"❌ No es troba configPNG.json ni config.json a: {d}")
    
    try:
        with open(path_cfg_png, encoding="utf-8-sig") as f:
            cfg = json.load(f)
        print(f"  ✓ Meteofrance config: {os.path.basename(path_cfg_png)}")
    except json.JSONDecodeError as e:
        sys.exit(f"❌ {os.path.basename(path_cfg_png)} té un error: {e}")
    
    class C: pass
    c = C()
    
    c.key = cfg["api_key"]
    c.base = cfg["arome"]["api_base"]
    c.svc = cfg["arome"]["service_0025"]
    c.to = cfg["http"]["timeout_seconds"]
    r = cfg["region"]
    c.la0, c.la1, c.lo0, c.lo1 = r["lat_min"], r["lat_max"], r["lon_min"], r["lon_max"]
    
    if "output_dir_risc" in cfg:
        out = cfg["output_dir_risc"]
        if not os.path.isabs(out):
            out = os.path.join(d, out)
        c.out = out
    else:
        c.out = os.path.join(d, "web_data_risc")

    c.zones = {}
    c.zones["espanya_ne"] = {"nom": "Espanya (NE)", "lon_min": c.lo0, "lon_max": c.lo1, "lat_min": c.la0, "lat_max": c.la1}
    
    c.satelit_enabled = bool(satelit_cfg.get("api_key"))
    c.satelit_key = satelit_cfg.get("api_key", cfg.get("api_key", ""))
    c.satelit_bt108 = satelit_cfg.get("bt108_enabled", True)
    c.satelit_lightning = satelit_cfg.get("lightning_enabled", True)
    c.satelit_radar = satelit_cfg.get("radar_enabled", True)
    c.satelit_pausa = satelit_cfg.get("satelit_pausa", 2.0)
    c.satelit_max_reintents = satelit_cfg.get("satelit_max_reintents", 4)
    
    return c

CFG = carregar_config()
TOTAL_HORES = 5
MAX_REINTENTS_GRIB = 5
OUTPUT_DIR = Path(CFG.out)
TMP_DIR = Path(os.environ.get("TEMP", "/tmp")) / "arome_risc"
URL_GRIB = "{b}/{d}:00:00Z/arome/0025/{p}/arome__0025__{p}__{g}__{d}:00:00Z.grib2"
MAGIC_GRIB = (b"GRIB",)

WCS_SERVICE = "MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS"
WCS_BASE_URL = f"https://public-api.meteofrance.fr/public/arome/1.0/wcs/{WCS_SERVICE}"

DOMINI_BT = {"lon_min": -5.0, "lon_max": 5.0, "lat_min": 37.5, "lat_max": 44.0, "res": 0.025}
DOMINI_BT["w"] = int((DOMINI_BT["lon_max"] - DOMINI_BT["lon_min"]) / DOMINI_BT["res"]) + 1
DOMINI_BT["h"] = int((DOMINI_BT["lat_max"] - DOMINI_BT["lat_min"]) / DOMINI_BT["res"]) + 1

DOMINI_GRAN = {"lon_min": -10.0, "lon_max": 12.0, "lat_min": 38.0, "lat_max": 55.0, "res": 0.05}
DOMINI_GRAN["w"] = int((DOMINI_GRAN["lon_max"] - DOMINI_GRAN["lon_min"]) / DOMINI_GRAN["res"]) + 1
DOMINI_GRAN["h"] = int((DOMINI_GRAN["lat_max"] - DOMINI_GRAN["lat_min"]) / DOMINI_GRAN["res"]) + 1

ZONES = CFG.zones
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
    except Exception:
        pass

atexit.register(netejar_tmp)

def borrar_sortida_antiga():
    print("  🧹 Borrant sortida antiga...")
    logs_dir = OUTPUT_DIR / "logs"
    if logs_dir.exists():
        try:
            shutil.rmtree(logs_dir)
            print(f"     ✓ Borrat: {logs_dir}")
        except Exception:
            pass
    for zona_nom in list(ZONES) + ["catalunya", "barcelona", "girona", "tarragona", "lleida", "test_satelit"]:
        zona_dir = OUTPUT_DIR / zona_nom
        if zona_dir.exists():
            try:
                shutil.rmtree(zona_dir)
                print(f"     ✓ Borrat: {zona_dir}")
            except Exception:
                pass
    for f in OUTPUT_DIR.glob("*.png"):
        try: f.unlink()
        except Exception: pass
    for f in OUTPUT_DIR.glob("*.js"):
        try: f.unlink()
        except Exception: pass
    print()

class Tee:
    def __init__(self, *s): self.streams = s
    def write(self, d):
        for s in self.streams:
            try: s.write(d); s.flush()
            except Exception: pass
    def flush(self):
        for s in self.streams:
            try: s.flush()
            except Exception: pass

def configurar_log():
    log_dir = OUTPUT_DIR / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = log_dir / f"run_{ts}.log"
    fitxer_log = open(log_path, "a", encoding="utf-8")
    sys.stdout = Tee(sys.__stdout__, fitxer_log)
    sys.stderr = Tee(sys.__stderr__, fitxer_log)
    return log_path, fitxer_log

def generar_js_coordenades(out_dir):
    js_content = """// ═══════════════════════════════════════════════════════════════════════
//  COORDENADES_ZONES.JS — Coordenades exactes de cada mapa PNG
// ═══════════════════════════════════════════════════════════════════════

const COORDENADES_ZONES = {
"""
    for zona_nom, zona_def in ZONES.items():
        js_content += f"""    "{zona_nom}": {{
        nom: "{zona_def['nom']}",
        lon_min: {zona_def['lon_min']},
        lon_max: {zona_def['lon_max']},
        lat_min: {zona_def['lat_min']},
        lat_max: {zona_def['lat_max']},
    }},
"""
    js_content += """};

console.log('[Coordenades] ZONES:', Object.keys(COORDENADES_ZONES).join(', '));
"""
    js_path = out_dir / "coordenades_zones.js"
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"  📄 Generat: {js_path}")
    return js_path

# ═══════════════ VARIABLES ═══════════════

SFC_METEOFETCH = {
    "st": ("SP1", "2t", "K->C", "Temperatura 2m", "°C"),
    "sd": ("SP2", "2d", "K->C", "Punt rosada 2m", "°C"),
    "su": ("SP1", "10u", 1.0, "Vent U 10m", "m/s"),
    "sv": ("SP1", "10v", 1.0, "Vent V 10m", "m/s"),
    "sp": ("SP2", "sp", 0.01, "Pressió superf.", "hPa"),
    "cape": ("SP2", "CAPE_INS", 1.0, "CAPE", "J/kg"),
    "srh": ("SP1", "2r", 1.0, "Humitat relativa 2m", "%"),
    "sh2": ("SP2", "2sh", 1.0, "Humitat específica 2m", "kg/kg"),
}

NIVELLS_PRESSIO = {1000, 950, 925, 900, 875, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100}
NIVELLS_W = {925, 850, 700, 500, 300}

VARS_3D = {
    "t": (NIVELLS_PRESSIO, lambda v: v - 273.15, "Temperatura", "°C"),
    "u": (NIVELLS_PRESSIO, lambda v: v, "Vent U", "m/s"),
    "v": (NIVELLS_PRESSIO, lambda v: v, "Vent V", "m/s"),
    "dpt": (NIVELLS_PRESSIO, lambda v: v - 273.15, "Punt rosada", "°C"),
    "w": (NIVELLS_W, lambda v: v, "Velocitat vertical", "Pa/s"),
    "r": (NIVELLS_PRESSIO, lambda v: v, "Humitat relativa", "%"),
}

NIVELLS_VENT_BARBES = [925, 850, 700, 500, 300]

# ═══════════════ PALETES PNG ═══════════════

PALETES_PNG = {
    "st": {
        "nivells": [-24, -20, -15, -10, -5, 0, 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 42, 46],
        "colors": ["#2d004b", "#8200a0", "#410073", "#0000ff", "#0087ff", "#00ebff", "#00ff96", "#00c800", "#78ff00", "#ffff00", "#ffffaa", "#ffeb64", "#ffc800", "#ff8c00", "#ff4600", "#ff0000", "#b40000", "#5a0000", "#960096", "#ff00ff", "#ffb9ff"]
    },
    "sd": {
        "nivells": [-24, -20, -15, -10, -5, 0, 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 42, 46],
        "colors": ["#2d004b", "#8200a0", "#410073", "#0000ff", "#0087ff", "#00ebff", "#00ff96", "#00c800", "#78ff00", "#ffff00", "#ffffaa", "#ffeb64", "#ffc800", "#ff8c00", "#ff4600", "#ff0000", "#b40000", "#5a0000", "#960096", "#ff00ff", "#ffb9ff"]
    },
    "sp": {
        "nivells": [980, 990, 995, 1000, 1005, 1010, 1015, 1020, 1025, 1030, 1040],
        "colors": ["#0000c8", "#0064ff", "#00c8ff", "#64ffc8", "#ffff96", "#ffc864", "#ff9632", "#ff5000", "#c80000", "#960000", "#640032"]
    },
    "cape": {
        "nivells": [0, 100, 300, 500, 700, 900, 1100, 1300, 1500, 1800, 2100, 2400, 2800, 3200, 3800],
        "colors": ["#002878", "#0050c8", "#008cff", "#00c8ff", "#00ffc8", "#78ff50", "#dcff00", "#ffff00", "#ffc800", "#ff8c00", "#ff3c00", "#ff0000", "#ff008c", "#ff00dc", "#c800ff"]
    },
    "wind_speed_10m": {
        "nivells": [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150],
        "colors": ["#c8c8ff", "#96b4ff", "#64b4ff", "#0096ff", "#00c8dc", "#00dcb4", "#00ff64", "#32ff00", "#96ff00", "#dcff00", "#ffff00", "#ffe600", "#ffc800", "#ffaa00", "#ff8c00", "#ff6e00", "#ff5000", "#ff3200", "#ff1400", "#ff0000", "#e60000", "#d20000", "#be001e", "#aa003c", "#960064"]
    },
    "wind_speed_altura": {
        "nivells": [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250],
        "colors": ["#c8c8ff", "#96b4ff", "#64b4ff", "#0096ff", "#00c8dc", "#00dcb4", "#00ff64", "#32ff00", "#96ff00", "#dcff00", "#ffff00", "#ffe600", "#ffc800", "#ffaa00", "#ff8c00", "#ff6e00", "#ff5000", "#ff3200", "#ff1400", "#ff0000", "#d20000"]
    },
    "srh": {
        "nivells": [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        "colors": ["#8B4513", "#A0522D", "#CD853F", "#DEB887", "#F5DEB3", "#FFFACD", "#FFFFE0", "#E0FFFF", "#87CEEB", "#4169E1", "#0000CD"]
    },
    "sh2": {
        "nivells": [0, 0.002, 0.004, 0.006, 0.008, 0.010, 0.012, 0.014, 0.016, 0.018, 0.020],
        "colors": ["#FFFFFF", "#E8F5E9", "#C8E6C9", "#A5D6A7", "#81C784", "#66BB6A", "#4CAF50", "#388E3C", "#2E7D32", "#1B5E20", "#0D3B0F"]
    },
    "r_925": {
        "nivells": [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        "colors": ["#8B4513", "#A0522D", "#CD853F", "#DEB887", "#F5DEB3", "#FFFACD", "#FFFFE0", "#E0FFFF", "#87CEEB", "#4169E1", "#0000CD"]
    },
    "r_850": {
        "nivells": [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        "colors": ["#8B4513", "#A0522D", "#CD853F", "#DEB887", "#F5DEB3", "#FFFACD", "#FFFFE0", "#E0FFFF", "#87CEEB", "#4169E1", "#0000CD"]
    },
    "r_700": {
        "nivells": [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        "colors": ["#8B4513", "#A0522D", "#CD853F", "#DEB887", "#F5DEB3", "#FFFACD", "#FFFFE0", "#E0FFFF", "#87CEEB", "#4169E1", "#0000CD"]
    },
    "r_500": {
        "nivells": [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        "colors": ["#8B4513", "#A0522D", "#CD853F", "#DEB887", "#F5DEB3", "#FFFACD", "#FFFFE0", "#E0FFFF", "#87CEEB", "#4169E1", "#0000CD"]
    },
    "bt108": {
        "nivells": [-80, -70, -60, -50, -40, -30, -20, -10, 0, 5, 10, 15, 20, 25, 30, 35, 40],
        "colors": ["#ffffff", "#f5f5f5", "#ebebeb", "#e0e0e0", "#d5d5d5", "#c8c8c8", "#b8b8b8", "#a0a0a0", "#808080", "#606060", "#484848", "#303030", "#202020", "#101010", "#080808", "#040404", "#000000"]
    },
    "lightning_1h": {
        "nivells": [0, 0.1, 0.5, 1, 2, 5, 10, 20, 50, 100],
        "colors": ["#00000000", "#1a0033", "#330066", "#660099", "#9900cc", "#cc00ff", "#ff00cc", "#ff0066", "#ff0000", "#ffff00"]
    },
    "radar_dbz": {
        "nivells": [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
        "colors": ["#00ffff", "#00ccff", "#0099ff", "#0066ff", "#0000ff", "#00ff00", "#00cc00", "#009900", "#ffff00", "#ffcc00", "#ff9900", "#ff6600", "#ff0000", "#cc0000", "#990099"]
    },
    "t_925": {
        "nivells": [-70, -55, -40, -30, -20, -10, 0, 5, 10, 15, 20, 25, 30, 38],
        "colors": ["#2d004b", "#410073", "#0000ff", "#0087ff", "#00ebff", "#00ff96", "#00c800", "#78ff00", "#ffff00", "#ffc800", "#ff8c00", "#ff4600", "#ff0000", "#960096"]
    },
    "t_850": {
        "nivells": [-70, -55, -40, -30, -20, -10, 0, 5, 10, 15, 20, 25, 30, 38],
        "colors": ["#2d004b", "#410073", "#0000ff", "#0087ff", "#00ebff", "#00ff96", "#00c800", "#78ff00", "#ffff00", "#ffc800", "#ff8c00", "#ff4600", "#ff0000", "#960096"]
    },
    "t_700": {
        "nivells": [-70, -55, -40, -30, -20, -10, 0, 5, 10, 15, 20, 25, 30, 38],
        "colors": ["#2d004b", "#410073", "#0000ff", "#0087ff", "#00ebff", "#00ff96", "#00c800", "#78ff00", "#ffff00", "#ffc800", "#ff8c00", "#ff4600", "#ff0000", "#960096"]
    },
    "t_500": {
        "nivells": [-50, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40],
        "colors": ["#000096", "#0032c8", "#0064ff", "#00a0ff", "#00d2ff", "#00ffff", "#00ffc8", "#00ff64", "#64ff00", "#dcff00", "#ffff00", "#ffdc00", "#ffb400", "#ff7800", "#ff3c00", "#ff0000", "#c80000", "#960032"]
    },
    "t_300": {
        "nivells": [-70, -55, -40, -30, -20, -10, 0, 5, 10, 15, 20, 25, 30, 38],
        "colors": ["#2d004b", "#410073", "#0000ff", "#0087ff", "#00ebff", "#00ff96", "#00c800", "#78ff00", "#ffff00", "#ffc800", "#ff8c00", "#ff4600", "#ff0000", "#960096"]
    },
    "w_925": {
        "nivells": [-5, -2, -0.5, 0, 0.5, 2, 5],
        "colors": ["#c80000", "#ff7800", "#ffdc96", "#e6e6e6", "#96dcff", "#0096ff", "#0000c8"]
    },
    "w_850": {
        "nivells": [-5, -2, -0.5, 0, 0.5, 2, 5],
        "colors": ["#c80000", "#ff7800", "#ffdc96", "#e6e6e6", "#96dcff", "#0096ff", "#0000c8"]
    },
    "w_700": {
        "nivells": [-5, -2, -0.5, 0, 0.5, 2, 5],
        "colors": ["#c80000", "#ff7800", "#ffdc96", "#e6e6e6", "#96dcff", "#0096ff", "#0000c8"]
    },
    "w_500": {
        "nivells": [-8, -4, -1, 0, 1, 4, 8],
        "colors": ["#c80000", "#ff7800", "#ffdc96", "#e6e6e6", "#96dcff", "#0096ff", "#0000c8"]
    },
    "w_300": {
        "nivells": [-8, -4, -1, 0, 1, 4, 8],
        "colors": ["#c80000", "#ff7800", "#ffdc96", "#e6e6e6", "#96dcff", "#0096ff", "#0000c8"]
    },
    "scp": {
        "nivells": [0, 0.5, 1, 2, 3, 4, 5, 7, 9, 11, 13, 16, 20, 25, 30],
        "colors": ["#ffffff", "#e1f0ff", "#bee1ff", "#82beff", "#468cff", "#285aff", "#5032ff", "#8c1eff", "#be14f0", "#e60ac8", "#ff008c", "#ff003c", "#e60000", "#b40000", "#780000"]
    },
    "hail_cm": {
        "nivells": [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0],
        "colors": ["#e8f7ff", "#b8e6ff", "#7fd0ff", "#4db8ff", "#ffe680", "#ffb84d", "#ff7f2e", "#c93aff", "#ff3ab0", "#ff2e2e", "#a30000"]
    },
}

# ═══════════════ UTILITATS ═══════════════

def format_time(s):
    if s < 60: return f"{s:.0f}s"
    elif s < 3600: return f"{int(s // 60)}m {int(s % 60)}s"
    else: return f"{int(s // 3600)}h {int((s % 3600) // 60)}m"

def barra(pct, ample=20):
    fet = int(ample * pct / 100)
    return f"[{'█' * fet}{'░' * (ample - fet)}] {pct:5.1f}%"

def calcular_steps(total_hores):
    return list(range(0, min(total_hores, 52)))

def comprovar_connexio():
    print("  Comprovant connexió...", end=" ", flush=True)
    try:
        requests.head("https://meteofrance-pnt.s3.rbx.io.cloud.ovh.net", timeout=15)
        print("✓")
        return True
    except Exception:
        print("❌")
        print("  No es pot connectar")
        return False

def _backoff(intent, base=2.0, cap=30.0):
    return min(cap, base * (2 ** (intent - 1))) + random.uniform(0, 1)

def aplicar_factor(vals, factor):
    return vals - 273.15 if factor == "K->C" else vals * factor

# ═══════════════ DESCÀRREGA GRIB ═══════════════

def descarregar_fitxer_robust(session, url, desti: Path, timeout=(15, 180),
                               max_intents=MAX_REINTENTS_GRIB, min_bytes=1000,
                               magic_bytes=None, acceptar_404=True):
    tmp_path = desti.with_name(desti.name + ".part")
    for intent in range(1, max_intents + 1):
        if SHUTDOWN_REQUESTED: return False
        try:
            r = session.get(url, stream=True, timeout=timeout)
            if r.status_code == 404:
                if acceptar_404: return None
                if intent < max_intents: time.sleep(_backoff(intent)); continue
                return False
            if r.status_code == 429:
                time.sleep(_backoff(intent, base=8, cap=60)); continue
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
                if intent < max_intents: time.sleep(_backoff(intent)); continue
                return False
            if magic_bytes is not None:
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

# ═══════════════ SELECCIÓ DEL MILLOR RUN ═══════════════

def trobar_millor_run():
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    print("\n  🔍 Buscant el millor run disponible...")
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
        url_test = URL_GRIB.format(b=base_url, d=run_str, p="SP1", g="49H51H")
        try:
            resp = requests.head(url_test, timeout=10)
            if resp.status_code == 200:
                print(f"    ✅ Run {run_str}Z seleccionat\n")
                return run_str
        except Exception:
            pass
    for dt in runs_a_provar:
        run_str = dt.strftime("%Y-%m-%dT%H")
        try:
            if requests.head(URL_GRIB.format(b=base_url, d=run_str, p="SP1", g="00H06H"), timeout=10).status_code == 200:
                print(f"    ⚠️  Run {run_str}Z seleccionat\n")
                return run_str
        except Exception:
            pass
    sys.exit("❌ Cap run disponible.")

# ═══════════════ DESCÀRREGA GLOBAL (UNA VEGADA) ═══════════════

def descarregar_sfc_global(steps_bloc, run_dt):
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    date_str = run_dt.strftime("%Y-%m-%dT%H")
    groups = Arome0025.groups_
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
    
    for grup in grups_ok:
        if SHUTDOWN_REQUESTED: break
        for paquet in ["SP1", "SP2"]:
            if SHUTDOWN_REQUESTED: break
            url = URL_GRIB.format(b=base_url, d=date_str, p=paquet, g=grup)
            desti = TMP_DIR / f"sfc_{paquet}_{grup}.grib2"
            ok = descarregar_fitxer_robust(session, url, desti, timeout=(15, 120), magic_bytes=MAGIC_GRIB, acceptar_404=True)
            if ok is None or not ok: continue
            try:
                datasets = cfgrib.open_datasets(str(desti))
            except Exception:
                desti.unlink(missing_ok=True)
                continue
            for ds in datasets:
                for var_name, da in ds.data_vars.items():
                    sn = da.attrs.get("GRIB_shortName", var_name)
                    claus_match = [k for k, (p_ok, sn_cfg, *_) in SFC_METEOFETCH.items() if p_ok == paquet and sn_cfg == sn]
                    if not claus_match: continue
                    lat_dim = next((d for d in da.dims if 'lat' in d.lower()), None)
                    lon_dim = next((d for d in da.dims if 'lon' in d.lower()), None)
                    time_dim = next((d for d in da.dims if d.lower() in ("time", "step", "valid_time")), None)
                    if not lat_dim or not lon_dim: continue
                    if lats is None:
                        lat_mask = (da[lat_dim].values >= CFG.la0) & (da[lat_dim].values <= CFG.la1)
                        lon_mask = (da[lon_dim].values >= CFG.lo0) & (da[lon_dim].values <= CFG.lo1)
                        lats = da[lat_dim].values[lat_mask][::-1]
                        lons = da[lon_dim].values[lon_mask]
                    nl, nlo = len(lats), len(lons)
                    for so in range(da.sizes.get(time_dim, 1) if time_dim else 1):
                        da_step = da.isel({time_dim: so}) if (time_dim and time_dim in da.dims) else da
                        try:
                            sr = int(da_step.get('step', so))
                        except Exception:
                            sr = so
                        sa = int(grup.split("H")[0]) + sr
                        if sa not in steps_bloc: continue
                        if sa not in resultats:
                            resultats[sa] = {}
                        da_step_f = da_step.where(
                            (da_step[lat_dim] >= CFG.la0) & (da_step[lat_dim] <= CFG.la1) &
                            (da_step[lon_dim] >= CFG.lo0) & (da_step[lon_dim] <= CFG.lo1), drop=True)
                        vals = np.flipud(da_step_f.values)
                        if vals.shape != (nl, nlo): continue
                        for clau in claus_match:
                            _, _, factor, nom, unitat = SFC_METEOFETCH[clau]
                            vals_conv = aplicar_factor(vals.flatten(), factor)
                            resultats[sa][clau] = np.array([float(v) if not np.isnan(v) else np.nan for v in vals_conv])
                ds.close()
            desti.unlink(missing_ok=True)
    
    if lats is not None:
        lats = [round(float(x), 4) for x in lats]
        lons = [round(float(x), 4) for x in lons]
    return resultats, lats, lons

def descarregar_3d_global(steps_bloc, run_dt):
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_
    date_str = run_dt.strftime("%Y-%m-%dT%H")
    groups = Arome0025.groups_
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
    
    for paquet in ["IP1", "IP3"]:
        if SHUTDOWN_REQUESTED: break
        for grup in grups_ok:
            if SHUTDOWN_REQUESTED: break
            url = URL_GRIB.format(b=base_url, d=date_str, p=paquet, g=grup)
            desti = TMP_DIR / f"3d_{paquet}_{grup}.grib2"
            ok = descarregar_fitxer_robust(session, url, desti, timeout=(15, 180), magic_bytes=MAGIC_GRIB, acceptar_404=True)
            if ok is None or not ok: continue
            for var_name, (nivells_set, conv, nom, unitat) in VARS_3D.items():
                try:
                    ds = xr.open_dataset(desti, engine="cfgrib", backend_kwargs={"filter_by_keys": {"shortName": var_name}})
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
                    lat_mask = (da[lat_dim].values >= CFG.la0) & (da[lat_dim].values <= CFG.la1)
                    lon_mask = (da[lon_dim].values >= CFG.lo0) & (da[lon_dim].values <= CFG.lo1)
                    lats = da[lat_dim].values[lat_mask][::-1]
                    lons = da[lon_dim].values[lon_mask]
                nl, nlo = len(lats), len(lons)
                for so in range(da.sizes.get(time_dim, 1) if time_dim else 1):
                    da_step = da.isel({time_dim: so}) if (time_dim and time_dim in da.dims) else da
                    try:
                        sr = int(da_step.get('step', so))
                    except Exception:
                        sr = so
                    sa = int(grup.split("H")[0]) + sr
                    if sa not in steps_bloc: continue
                    if sa not in resultats:
                        resultats[sa] = {}
                    da_step_f = da_step.where(
                        (da_step[lat_dim] >= CFG.la0) & (da_step[lat_dim] <= CFG.la1) &
                        (da_step[lon_dim] >= CFG.lo0) & (da_step[lon_dim] <= CFG.lo1), drop=True)
                    for nivell in da_step_f[dim_niv].values:
                        ni = int(round(float(nivell)))
                        if ni not in nivells_set: continue
                        try:
                            da_niv = da_step_f.sel({dim_niv: nivell})
                            vals = np.flipud(da_niv.values)
                            if vals.shape != (nl, nlo): continue
                            resultats[sa][f"{var_name}_{ni}"] = np.array([float(conv(v)) if not np.isnan(v) else np.nan for v in vals.flatten()])
                        except Exception:
                            pass
                ds.close()
            desti.unlink(missing_ok=True)
    
    if lats is not None:
        lats = [round(float(x), 4) for x in lats]
        lons = [round(float(x), 4) for x in lons]
    return resultats, lats, lons

# ═══════════════ SATÈL·LIT WCS ═══════════════

def _descarregar_tile_wcs(session, cov_id, time_str, lon_min, lon_max, lat_min, lat_max, w, h, llindar_nan=9000, max_intents=4):
    url = (f"{WCS_BASE_URL}/GetCoverage?SERVICE=WCS&VERSION=2.0.1&COVERAGEID={cov_id}&FORMAT=image/tiff"
           f"&SUBSET=long({lon_min},{lon_max})&SUBSET=lat({lat_min},{lat_max})&SUBSET=time({time_str})&SCALESIZE=long({w})&SCALESIZE=lat({h})")
    for intent in range(1, max_intents + 1):
        try:
            r = session.get(url, timeout=CFG.to)
            if r.status_code == 200 and len(r.content) > 1000:
                arr = tifffile.imread(io.BytesIO(r.content))
                if arr.ndim == 3:
                    arr = arr[0]
                arr = arr.astype(np.float64)
                arr[arr > llindar_nan] = np.nan
                if arr.shape[0] >= h * 2 - 1:
                    arr = arr[::2, ::2]
                if arr.shape[1] >= w * 2 - 1:
                    arr = arr[:, ::2]
                return np.flipud(arr)
            elif r.status_code == 404:
                return None
            elif r.status_code == 429:
                time.sleep(_backoff(intent, base=5, cap=30))
            else:
                time.sleep(_backoff(intent, base=2, cap=15))
        except Exception:
            time.sleep(_backoff(intent, base=2, cap=15))
    return None

def _interpolar_a_graella_sfc(arr_sat, domini_sat, lats_sfc, lons_sfc):
    try:
        h_src, w_src = arr_sat.shape
        lons_src = np.linspace(domini_sat["lon_min"], domini_sat["lon_max"], w_src)
        lats_src = np.linspace(domini_sat["lat_min"], domini_sat["lat_max"], h_src)
        lon_src, lat_src = np.meshgrid(lons_src, lats_src)
        mask = ~np.isnan(arr_sat)
        if np.sum(mask) < 10:
            return None
        punts = np.column_stack((lon_src[mask], lat_src[mask]))
        vals = arr_sat[mask]
        lon_dst, lat_dst = np.meshgrid(np.array(lons_sfc), np.array(lats_sfc))
        return griddata(punts, vals, (lon_dst, lat_dst), method='linear')
    except Exception:
        return None

def descarregar_satelit_wcs(steps_bloc, run_dt, lats_sfc, lons_sfc):
    """Descarga datos de satélite WCS con diagnóstico detallado"""
    if not CFG.satelit_enabled:
        print("\n  🛰️  SATÈL·LIT: DESACTIVAT")
        return {}, {}, {}
    
    print(f"\n  🛰️  Descarregant satèl·lit (BT, llamps, radar)...")
    session_sat = requests.Session()
    session_sat.headers.update({"apikey": CFG.satelit_key})
    
    print("  GetCapabilities WCS...", end=" ", flush=True)
    cov_ids = []
    try:
        r = session_sat.get(f"{WCS_BASE_URL}/GetCapabilities", params={"SERVICE":"WCS","VERSION":"2.0.1","LANGUAGE":"eng"}, timeout=CFG.to)
        if r.status_code == 200:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(r.content)
            cov_ids = [e.text.strip() for e in root.iter('{http://www.opengis.net/wcs/2.0}CoverageId')]
        print(f"✓ ({len(cov_ids)} IDs)")
    except Exception as e:
        print(f"❌ ({e})")
        return {}, {}, {}
    
    if not cov_ids:
        print("  ❌ Cap CoverageId trobat")
        return {}, {}, {}
    
    # ═══ DIAGNOSI: Mostrar exemples de cobertures ═══
    print(f"\n  🔍 DIAGNOSI: Exemples de CoverageIds:")
    bt_exemples = []
    ll_exemples = []
    rd_exemples = []
    
    for cid in cov_ids:
        cid_upper = cid.upper()
        if "BRIGHTNESS_TEMPERATURE" in cid_upper and len(bt_exemples) < 3:
            bt_exemples.append(cid)
        if "LIGHTNING" in cid_upper and len(ll_exemples) < 3:
            ll_exemples.append(cid)
        if "REFLECTIVITY" in cid_upper and len(rd_exemples) < 3:
            rd_exemples.append(cid)
    
    print(f"\n  BT candidates:")
    for c in bt_exemples:
        print(f"    → {c}")
    
    print(f"\n  Lightning candidates:")
    for c in ll_exemples:
        print(f"    → {c}")
    
    print(f"\n  Radar candidates:")
    for c in rd_exemples:
        print(f"    → {c}")
    
    # Buscar qualsevol cobertura que coincideixi amb els noms
    bt108_cov = None
    lightning_cov = None
    radar_cov = None
    
    # Buscar BT
    for cid in cov_ids:
        cid_upper = cid.upper()
        if "BRIGHTNESS_TEMPERATURE" in cid_upper and "108" in cid_upper and "_62" not in cid_upper:
            bt108_cov = cid
            break
    
    # Si no, buscar qualsevol brightness temperature
    if not bt108_cov:
        for cid in cov_ids:
            cid_upper = cid.upper()
            if "BRIGHTNESS_TEMPERATURE" in cid_upper and "_62" not in cid_upper:
                bt108_cov = cid
                break
    
    # Buscar Lightning
    for cid in cov_ids:
        cid_upper = cid.upper()
        if "LIGHTNING" in cid_upper and "PT1H" in cid_upper and "PT3H" not in cid_upper and "PT6H" not in cid_upper:
            lightning_cov = cid
            break
    
    # Si no, buscar qualsevol lightning
    if not lightning_cov:
        for cid in cov_ids:
            cid_upper = cid.upper()
            if "LIGHTNING" in cid_upper and "PT1H" in cid_upper:
                lightning_cov = cid
                break
    
    # Buscar Radar
    for cid in cov_ids:
        cid_upper = cid.upper()
        if "REFLECTIVITY" in cid_upper and "DBZ" in cid_upper and "GROUND" in cid_upper:
            radar_cov = cid
            break
    
    # Si no, buscar qualsevol reflectivity
    if not radar_cov:
        for cid in cov_ids:
            cid_upper = cid.upper()
            if "REFLECTIVITY" in cid_upper and "DBZ" in cid_upper:
                radar_cov = cid
                break
    
    print(f"\n  📡 Cobertures seleccionades:")
    print(f"  BT: {bt108_cov}")
    print(f"  LL: {lightning_cov}")
    print(f"  RD: {radar_cov}")
    
    if not bt108_cov and not lightning_cov and not radar_cov:
        print("  ❌ CAP COBERTURA TROBADA")
        return {}, {}, {}
    
    bt108_data = {}
    lightning_data = {}
    radar_data = {}
    pngs_satelit_generats = []
    total_h = len(steps_bloc)
    t0_sat = time.time()
    
    for i, step in enumerate(steps_bloc):
        if SHUTDOWN_REQUESTED:
            break
        pct = (i + 1) / total_h * 100
        dh = run_dt + timedelta(hours=step)
        ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")
        ts_str = dh.strftime("%Y%m%d-%H%M")
        
        if bt108_cov and CFG.satelit_bt108:
            arr = _descarregar_tile_wcs(session_sat, bt108_cov, ts, 
                                         DOMINI_BT["lon_min"], DOMINI_BT["lon_max"], 
                                         DOMINI_BT["lat_min"], DOMINI_BT["lat_max"], 
                                         DOMINI_BT["w"], DOMINI_BT["h"], llindar_nan=9000)
            if arr is not None and np.sum(~np.isnan(arr)) > 100:
                arr_interp = _interpolar_a_graella_sfc(arr, DOMINI_BT, lats_sfc, lons_sfc)
                if arr_interp is not None:
                    bt108_data[step] = arr_interp
                    for zona_nom, zona_def in ZONES.items():
                        lat_mask = (np.array(lats_sfc) >= zona_def["lat_min"]) & (np.array(lats_sfc) <= zona_def["lat_max"])
                        lon_mask = (np.array(lons_sfc) >= zona_def["lon_min"]) & (np.array(lons_sfc) <= zona_def["lon_max"])
                        lats_z = np.array(lats_sfc)[lat_mask]
                        lons_z = np.array(lons_sfc)[lon_mask]
                        ordre_lat = np.argsort(lats_z)[::-1]
                        ordre_lon = np.argsort(lons_z)
                        lats_z_ord = lats_z[ordre_lat]
                        lons_z_ord = lons_z[ordre_lon]
                        
                        grid_zona = arr_interp[np.ix_(lat_mask, lon_mask)]
                        grid_zona = grid_zona[np.ix_(ordre_lat, ordre_lon)]
                        p = generar_png_variable("bt108", grid_zona, lats_z_ord, lons_z_ord, ts_str, OUTPUT_DIR, zona_nom, amb_etiquetes=False)
                        if p:
                            pngs_satelit_generats.append(p)
            time.sleep(CFG.satelit_pausa)
        
        if lightning_cov and CFG.satelit_lightning:
            arr = _descarregar_tile_wcs(session_sat, lightning_cov, ts,
                                         DOMINI_GRAN["lon_min"], DOMINI_GRAN["lon_max"],
                                         DOMINI_GRAN["lat_min"], DOMINI_GRAN["lat_max"],
                                         DOMINI_GRAN["w"], DOMINI_GRAN["h"], llindar_nan=9998)
            if arr is not None:
                arr_interp = _interpolar_a_graella_sfc(arr, DOMINI_GRAN, lats_sfc, lons_sfc)
                if arr_interp is not None:
                    lightning_data[step] = arr_interp
                    for zona_nom, zona_def in ZONES.items():
                        lat_mask = (np.array(lats_sfc) >= zona_def["lat_min"]) & (np.array(lats_sfc) <= zona_def["lat_max"])
                        lon_mask = (np.array(lons_sfc) >= zona_def["lon_min"]) & (np.array(lons_sfc) <= zona_def["lon_max"])
                        lats_z = np.array(lats_sfc)[lat_mask]
                        lons_z = np.array(lons_sfc)[lon_mask]
                        ordre_lat = np.argsort(lats_z)[::-1]
                        ordre_lon = np.argsort(lons_z)
                        lats_z_ord = lats_z[ordre_lat]
                        lons_z_ord = lons_z[ordre_lon]
                        
                        grid_zona = arr_interp[np.ix_(lat_mask, lon_mask)]
                        grid_zona = grid_zona[np.ix_(ordre_lat, ordre_lon)]
                        p = generar_png_variable("lightning_1h", grid_zona, lats_z_ord, lons_z_ord, ts_str, OUTPUT_DIR, zona_nom, amb_etiquetes=False)
                        if p:
                            pngs_satelit_generats.append(p)
            time.sleep(CFG.satelit_pausa)
        
        if radar_cov and CFG.satelit_radar:
            arr = _descarregar_tile_wcs(session_sat, radar_cov, ts,
                                         DOMINI_GRAN["lon_min"], DOMINI_GRAN["lon_max"],
                                         DOMINI_GRAN["lat_min"], DOMINI_GRAN["lat_max"],
                                         DOMINI_GRAN["w"], DOMINI_GRAN["h"], llindar_nan=200)
            if arr is not None:
                arr_interp = _interpolar_a_graella_sfc(arr, DOMINI_GRAN, lats_sfc, lons_sfc)
                if arr_interp is not None:
                    radar_data[step] = arr_interp
                    for zona_nom, zona_def in ZONES.items():
                        lat_mask = (np.array(lats_sfc) >= zona_def["lat_min"]) & (np.array(lats_sfc) <= zona_def["lat_max"])
                        lon_mask = (np.array(lons_sfc) >= zona_def["lon_min"]) & (np.array(lons_sfc) <= zona_def["lon_max"])
                        lats_z = np.array(lats_sfc)[lat_mask]
                        lons_z = np.array(lons_sfc)[lon_mask]
                        ordre_lat = np.argsort(lats_z)[::-1]
                        ordre_lon = np.argsort(lons_z)
                        lats_z_ord = lats_z[ordre_lat]
                        lons_z_ord = lons_z[ordre_lon]
                        
                        grid_zona = arr_interp[np.ix_(lat_mask, lon_mask)]
                        grid_zona = grid_zona[np.ix_(ordre_lat, ordre_lon)]
                        p = generar_png_variable("radar_dbz", grid_zona, lats_z_ord, lons_z_ord, ts_str, OUTPUT_DIR, zona_nom, amb_etiquetes=False)
                        if p:
                            pngs_satelit_generats.append(p)
            time.sleep(CFG.satelit_pausa)
        
        sys.stdout.write(f"\r  [{barra(pct)}] Satèl·lit +{step:02d}h | BT:{len(bt108_data)} LL:{len(lightning_data)} RDR:{len(radar_data)} PNGs:{len(pngs_satelit_generats)}   ")
        sys.stdout.flush()
    
    print()
    print(f"  ✅ Satèl·lit: {len(bt108_data)}h BT108, {len(lightning_data)}h llamps, {len(radar_data)}h radar, {len(pngs_satelit_generats)} PNGs ({format_time(time.time() - t0_sat)})")
    return bt108_data, lightning_data, radar_data

# ═══════════════ FUNCIONS TERMODINÀMIQUES ═══════════════

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

def _mixing_ratio(td_c, p_hpa):
    es = 6.112 * np.exp(17.67 * td_c / (td_c + 243.5))
    w = EPS * es / np.maximum(p_hpa - es, 0.1)
    return w * 1000.0

def calcular_lcl_lfc(t_sfc, td_sfc, p_sfc, T, TD, pl):
    n_punts = t_sfc.shape[0]
    mask = ~(np.isnan(t_sfc) | np.isnan(td_sfc) | np.isnan(p_sfc))
    p_lcl, _ = _lcl_bolton(t_sfc, td_sfc, p_sfc)
    p_lcl = np.where(mask, p_lcl, np.nan)
    lcl_m = _pressio_a_alcada_estandard(p_lcl)
    P = np.array(pl, dtype=np.float64)[:, None] * np.ones((1, n_punts))
    T_masked = np.where(P >= p_sfc[None, :], np.nan, T)
    tpn = np.full((len(pl), n_punts), np.nan)
    for k, n in enumerate(pl):
        tpn[k], _, _ = _perfil_parcela_a_nivell(t_sfc, td_sfc, p_sfc, np.full(n_punts, float(n)))
    psl = P < p_lcl[None, :]
    dv = np.where(psl & ~np.isnan(T_masked), tpn - T_masked, np.nan)
    an = _pressio_a_alcada_estandard(P[:, 0])
    lfc_m = np.full(n_punts, np.nan)
    for i in range(n_punts):
        if not mask[i]: continue
        ix = np.where(psl[:, i] & ~np.isnan(dv[:, i]))[0]
        if len(ix) < 2: continue
        ds = dv[ix, i]
        al = an[ix]
        ps = np.where(ds > 0)[0]
        if len(ps) == 0: continue
        tr = []
        for j in range(ps[0], len(ds)):
            if ds[j] > 0:
                tr.append(al[j])
            else:
                break
        if len(tr) < 2 or tr[-1] - tr[0] < 500: continue
        lfc_m[i] = tr[0]
    return lcl_m, lfc_m

def pressio_a_alcada_shear(p_hpa):
    return _pressio_a_alcada_estandard(p_hpa)

def calcular_srh_shear_graella(step, td_step, n_punts):
    srh_01 = np.full(n_punts, np.nan)
    shear_06 = np.full(n_punts, np.nan)
    pressions_disponibles = sorted(NIVELLS_PRESSIO, reverse=True)
    alcades = {p: pressio_a_alcada_shear(p) for p in pressions_disponibles}
    for idx in range(n_punts):
        nivells_vent = []
        for p in pressions_disponibles:
            ku, kv = f"u_{p}", f"v_{p}"
            if ku in td_step and kv in td_step:
                u_val = td_step[ku][idx]
                v_val = td_step[kv][idx]
                if not np.isnan(u_val) and not np.isnan(v_val):
                    nivells_vent.append({"z": alcades[p], "u": u_val, "v": v_val})
        if len(nivells_vent) < 3: continue
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
        v6km = vent_a_z(6000)
        du06, dv06 = v6km["u"] - v0["u"], v6km["v"] - v0["v"]
        shear_06[idx] = round(float(np.sqrt(du06 * du06 + dv06 * dv06)), 2)
        def vent_mitja(z_bot, z_top):
            su = sv = sw = 0
            for j in range(len(nivells_vent) - 1):
                a, b = nivells_vent[j], nivells_vent[j + 1]
                z0, z1 = max(a["z"], z_bot), min(b["z"], z_top)
                if z1 <= z0: continue
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
                if z1 <= z0: continue
                f0 = (z0 - a["z"]) / (b["z"] - a["z"]) if b["z"] != a["z"] else 0
                f1 = (z1 - a["z"]) / (b["z"] - a["z"]) if b["z"] != a["z"] else 0
                u0, v0_w = a["u"] + f0 * (b["u"] - a["u"]), a["v"] + f0 * (b["v"] - a["v"])
                u1, v1_w = a["u"] + f1 * (b["u"] - a["u"]), a["v"] + f1 * (b["v"] - a["v"])
                srh += (u0 - su) * (v1_w - sv) - (u1 - su) * (v0_w - sv)
            return srh
        srh_01[idx] = round(float(calc_srh(1000, storm_u, storm_v)), 1)
    return srh_01, shear_06

def calcular_scp(cape_sfc, srh_01, shear_06):
    cape = np.where(np.isnan(cape_sfc), 0.0, np.maximum(cape_sfc, 0.0))
    srh = np.where(np.isnan(srh_01), 0.0, srh_01)
    shear = np.where(np.isnan(shear_06), 0.0, shear_06)
    shear_lim = np.clip(shear, 10.0, 20.0)
    scp = (cape / 1000.0) * (srh / 50.0) * (shear_lim / 20.0)
    scp = np.where(shear < 10.0, scp * (shear / 10.0), scp)
    return np.clip(scp, 0.0, None)

def calcular_ship_ajustat(cape_sfc, T, TD, pl, shear_06, w_step, lfc_m, n_punts):
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
        lapse_700_500_ship = np.full(n_punts, 6.5)
        t_500_ship = np.full(n_punts, -10.0)
    shear_ship = np.clip(np.where(np.isnan(shear_06), 7.0, shear_06), 7.0, 27.0)
    ship = (mucape_ship * mixr_700_ship * lapse_700_500_ship * (-t_500_ship) * shear_ship) / 42_000_000.0
    ship = np.clip(ship, 0.0, None)
    ship = np.where(mucape < 250.0, 0.0, ship)
    if i700 is not None and i500 is not None:
        ship = np.where(lapse_700_500 < 5.8, ship * 0.2, ship)
    w_vals = [w_step[f"w_{niv}"] for niv in (500, 300) if f"w_{niv}" in w_step]
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
    ship_ajustat = ship * w_factor * lfc_factor
    mida_cm = np.clip(ship_ajustat * 2.5, 0.0, 10.0)
    return mida_cm

# ═══════════════ GENERACIÓ DE PNGs ═══════════════

def _extent_real(lats_zona, lons_zona):
    lon_min, lon_max = float(lons_zona.min()), float(lons_zona.max())
    lat_min, lat_max = float(lats_zona.min()), float(lats_zona.max())
    dlon = float(np.median(np.diff(np.sort(lons_zona)))) if len(lons_zona) > 1 else 0.025
    dlat = float(np.median(np.diff(np.sort(lats_zona)))) if len(lats_zona) > 1 else 0.025
    return [lon_min - dlon/2, lon_max + dlon/2, lat_min - dlat/2, lat_max + dlat/2]

def generar_png_variable(var_nom, grid, lats_zona, lons_zona, ts_str, out_dir, zona_nom, amb_etiquetes=True):
    paleta = PALETES_PNG.get(var_nom)
    if not paleta:
        return None
    if grid.size == 0 or len(lats_zona) < 2 or len(lons_zona) < 2:
        return None
    
    extent = _extent_real(lats_zona, lons_zona)
    ample_graus = extent[1] - extent[0]
    alt_graus = extent[3] - extent[2]
    dpi = 150
    ample_in = ample_graus * 2.5
    alt_in = alt_graus * 2.5
    if max(ample_in, alt_in) > 10:
        factor = 10 / max(ample_in, alt_in)
        ample_in *= factor
        alt_in *= factor
    
    colors_rgba = []
    for hex_color in paleta["colors"]:
        if len(hex_color) == 9:
            r = int(hex_color[1:3], 16) / 255.0
            g = int(hex_color[3:5], 16) / 255.0
            b = int(hex_color[5:7], 16) / 255.0
            a = int(hex_color[7:9], 16) / 255.0
            colors_rgba.append((r, g, b, a))
        else:
            r = int(hex_color[1:3], 16) / 255.0
            g = int(hex_color[3:5], 16) / 255.0
            b = int(hex_color[5:7], 16) / 255.0
            colors_rgba.append((r, g, b, 1.0))
    
    cmap = LinearSegmentedColormap.from_list(f"cmap_{var_nom}", colors_rgba, N=256)
    norm = mcolors.BoundaryNorm(paleta["nivells"], cmap.N)
    
    fig = plt.figure(figsize=(ample_in, alt_in), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_axis_off()
    ax.imshow(grid, cmap=cmap, norm=norm, origin='upper', extent=extent, aspect='equal', interpolation='bilinear')
    ax.set_xlim(extent[0], extent[1])
    ax.set_ylim(extent[2], extent[3])
    
    if amb_etiquetes:
        lon2d, lat2d = np.meshgrid(lons_zona, lats_zona)
        try:
            cs = ax.contour(lon2d, lat2d, grid, levels=paleta["nivells"][1:-1], colors='black', linewidths=0.6, alpha=0.6)
            ax.clabel(cs, inline=True, fontsize=5, fmt='%.0f', colors='black')
        except Exception:
            pass
    
    subdir = out_dir / zona_nom
    subdir.mkdir(parents=True, exist_ok=True)
    path = subdir / f"{ts_str}z_{var_nom}.png"
    fig.savefig(path, transparent=True, facecolor='none', bbox_inches='tight', pad_inches=0)
    plt.close(fig)
    return path

def generar_png_vent_amb_barbes(grid_speed, grid_u, grid_v, lats_zona, lons_zona, ts_str, out_dir, zona_nom, var_nom="wind_speed_10m", nivell=None):
    if grid_speed.size == 0 or len(lats_zona) < 2 or len(lons_zona) < 2:
        return None
    
    paleta_nom = "wind_speed_10m" if nivell is None else "wind_speed_altura"
    paleta = PALETES_PNG.get(paleta_nom)
    if not paleta:
        return None
    
    extent = _extent_real(lats_zona, lons_zona)
    ample_graus = extent[1] - extent[0]
    alt_graus = extent[3] - extent[2]
    dpi = 150
    ample_in = ample_graus * 2.5
    alt_in = alt_graus * 2.5
    if max(ample_in, alt_in) > 10:
        factor = 10 / max(ample_in, alt_in)
        ample_in *= factor
        alt_in *= factor
    
    colors_rgba = []
    for hex_color in paleta["colors"]:
        r = int(hex_color[1:3], 16) / 255.0
        g = int(hex_color[3:5], 16) / 255.0
        b = int(hex_color[5:7], 16) / 255.0
        colors_rgba.append((r, g, b, 1.0))
    
    cmap = LinearSegmentedColormap.from_list(f"cmap_{paleta_nom}", colors_rgba, N=256)
    norm = mcolors.BoundaryNorm(paleta["nivells"], cmap.N)
    
    fig = plt.figure(figsize=(ample_in, alt_in), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_axis_off()
    
    ax.imshow(grid_speed, cmap=cmap, norm=norm, origin='upper', extent=extent, aspect='equal', interpolation='bilinear', alpha=0.7)
    
    step_lat = max(1, len(lats_zona) // 15)
    step_lon = max(1, len(lons_zona) // 15)
    
    lon2d, lat2d = np.meshgrid(lons_zona, lats_zona)
    ax.barbs(lon2d[::step_lat, ::step_lon], lat2d[::step_lat, ::step_lon],
             grid_u[::step_lat, ::step_lon] * 1.94384,
             grid_v[::step_lat, ::step_lon] * 1.94384,
             length=5, linewidth=0.8, color='black', alpha=0.9)
    
    ax.set_xlim(extent[0], extent[1])
    ax.set_ylim(extent[2], extent[3])
    
    subdir = out_dir / zona_nom
    subdir.mkdir(parents=True, exist_ok=True)
    
    if nivell is None:
        nom_fitxer = f"{ts_str}z_wind_barbs.png"
    else:
        nom_fitxer = f"{ts_str}z_wind_{nivell}hPa_barbs.png"
    
    path = subdir / nom_fitxer
    fig.savefig(path, transparent=True, facecolor='none', bbox_inches='tight', pad_inches=0)
    plt.close(fig)
    return path

# ═══════════════ FUNCIÓ PER GENERAR PNGS DE METEOFRANCE ═══════════════

def generar_pngs_meteofrance(sfc_data, td_data, lats_sfc, lons_sfc, steps_bloc, run_dt):
    pngs_generats = []
    nlat_global = len(lats_sfc)
    nlon_global = len(lons_sfc)
    pl = sorted(NIVELLS_PRESSIO, reverse=True)
    
    for zona_nom, zona_def in ZONES.items():
        if SHUTDOWN_REQUESTED:
            break
        print(f"\n  📍 Zona: {zona_def['nom']}...")
        
        lat_mask = (np.array(lats_sfc) >= zona_def["lat_min"]) & (np.array(lats_sfc) <= zona_def["lat_max"])
        lon_mask = (np.array(lons_sfc) >= zona_def["lon_min"]) & (np.array(lons_sfc) <= zona_def["lon_max"])
        lats_z = np.array(lats_sfc)[lat_mask]
        lons_z = np.array(lons_sfc)[lon_mask]
        ordre_lat = np.argsort(lats_z)[::-1]
        ordre_lon = np.argsort(lons_z)
        lats_z_ord = lats_z[ordre_lat]
        lons_z_ord = lons_z[ordre_lon]
        
        for i, step in enumerate(steps_bloc):
            if step not in sfc_data or step not in td_data:
                continue
            
            sd = sfc_data[step]
            td_step = td_data[step]
            
            if "su" in sd and "sv" in sd:
                sd["wind_speed_10m"] = np.sqrt(sd["su"]**2 + sd["sv"]**2) * 3.6
            
            ts_str = (run_dt + timedelta(hours=step)).strftime("%Y%m%d-%H%M")
            
            for var_nom in ["st", "sd", "sp", "cape", "wind_speed_10m", "srh", "sh2"]:
                if var_nom in sd:
                    grid_full = sd[var_nom].reshape(nlat_global, nlon_global)
                    grid_zona = grid_full[np.ix_(lat_mask, lon_mask)]
                    grid_zona = grid_zona[np.ix_(ordre_lat, ordre_lon)]
                    p = generar_png_variable(var_nom, grid_zona, lats_z_ord, lons_z_ord, ts_str, OUTPUT_DIR, zona_nom, amb_etiquetes=True)
                    if p:
                        pngs_generats.append(p)
            
            if "su" in sd and "sv" in sd:
                grid_speed_full = sd["wind_speed_10m"].reshape(nlat_global, nlon_global)
                grid_u_full = sd["su"].reshape(nlat_global, nlon_global)
                grid_v_full = sd["sv"].reshape(nlat_global, nlon_global)
                
                grid_speed_zona = grid_speed_full[np.ix_(lat_mask, lon_mask)]
                grid_u_zona = grid_u_full[np.ix_(lat_mask, lon_mask)]
                grid_v_zona = grid_v_full[np.ix_(lat_mask, lon_mask)]
                
                grid_speed_zona = grid_speed_zona[np.ix_(ordre_lat, ordre_lon)]
                grid_u_zona = grid_u_zona[np.ix_(ordre_lat, ordre_lon)]
                grid_v_zona = grid_v_zona[np.ix_(ordre_lat, ordre_lon)]
                
                p = generar_png_vent_amb_barbes(grid_speed_zona, grid_u_zona, grid_v_zona, 
                                                 lats_z_ord, lons_z_ord, ts_str, OUTPUT_DIR, zona_nom,
                                                 var_nom="wind_speed_10m", nivell=None)
                if p:
                    pngs_generats.append(p)
            
            for nivell in NIVELLS_VENT_BARBES:
                clau_u = f"u_{nivell}"
                clau_v = f"v_{nivell}"
                if clau_u in td_step and clau_v in td_step:
                    u_vals = td_step[clau_u]
                    v_vals = td_step[clau_v]
                    
                    if len(u_vals) == nlat_global * nlon_global and len(v_vals) == nlat_global * nlon_global:
                        speed_vals = np.sqrt(u_vals**2 + v_vals**2) * 3.6
                        
                        grid_u_full = u_vals.reshape(nlat_global, nlon_global)
                        grid_v_full = v_vals.reshape(nlat_global, nlon_global)
                        grid_speed_full = speed_vals.reshape(nlat_global, nlon_global)
                        
                        grid_u_zona = grid_u_full[np.ix_(lat_mask, lon_mask)]
                        grid_v_zona = grid_v_full[np.ix_(lat_mask, lon_mask)]
                        grid_speed_zona = grid_speed_full[np.ix_(lat_mask, lon_mask)]
                        
                        grid_u_zona = grid_u_zona[np.ix_(ordre_lat, ordre_lon)]
                        grid_v_zona = grid_v_zona[np.ix_(ordre_lat, ordre_lon)]
                        grid_speed_zona = grid_speed_zona[np.ix_(ordre_lat, ordre_lon)]
                        
                        p = generar_png_vent_amb_barbes(grid_speed_zona, grid_u_zona, grid_v_zona,
                                                         lats_z_ord, lons_z_ord, ts_str, OUTPUT_DIR, zona_nom,
                                                         var_nom=f"wind_{nivell}", nivell=nivell)
                        if p:
                            pngs_generats.append(p)
            
            for var_nom in td_step:
                if var_nom.startswith("t_") or var_nom.startswith("w_") or var_nom.startswith("r_"):
                    vals = td_step[var_nom]
                    if len(vals) == nlat_global * nlon_global:
                        grid_full = vals.reshape(nlat_global, nlon_global)
                        grid_zona = grid_full[np.ix_(lat_mask, lon_mask)]
                        grid_zona = grid_zona[np.ix_(ordre_lat, ordre_lon)]
                        p = generar_png_variable(var_nom, grid_zona, lats_z_ord, lons_z_ord, ts_str, OUTPUT_DIR, zona_nom, amb_etiquetes=True)
                        if p:
                            pngs_generats.append(p)
            
            if all(k in sd for k in ["st", "sd", "sp", "cape"]):
                T_list, TD_list, pl_ok = [], [], []
                for n in pl:
                    if f"t_{n}" in td_step and f"dpt_{n}" in td_step:
                        T_list.append(td_step[f"t_{n}"])
                        TD_list.append(td_step[f"dpt_{n}"])
                        pl_ok.append(n)
                
                if len(pl_ok) >= 3:
                    T = np.array(T_list)
                    TD = np.array(TD_list)
                    n_total = nlat_global * nlon_global
                    
                    if T.shape[1] != n_total:
                        factor = T.shape[1] / n_total
                        idx_map = np.clip(np.floor(np.arange(n_total) / factor).astype(int), 0, T.shape[1]-1)
                        T = T[:, idx_map]
                        TD = TD[:, idx_map]
                        td_step_al = {k: (v[idx_map] if len(v) == T.shape[1] else v) for k, v in td_step.items()}
                    else:
                        td_step_al = td_step
                    
                    lcl_m, lfc_m = calcular_lcl_lfc(sd["st"], sd["sd"], sd["sp"], T, TD, pl_ok)
                    srh_01, shear_06 = calcular_srh_shear_graella(step, td_step_al, n_total)
                    scp = calcular_scp(sd["cape"], srh_01, shear_06)
                    w_step = {k: v for k, v in td_step_al.items() if k.startswith("w_")}
                    hail_cm = calcular_ship_ajustat(sd["cape"], T, TD, pl_ok, shear_06, w_step, lfc_m, n_total)
                    
                    grid_full = scp.reshape(nlat_global, nlon_global)
                    grid_zona = grid_full[np.ix_(lat_mask, lon_mask)]
                    grid_zona = grid_zona[np.ix_(ordre_lat, ordre_lon)]
                    p = generar_png_variable("scp", grid_zona, lats_z_ord, lons_z_ord, ts_str, OUTPUT_DIR, zona_nom, amb_etiquetes=True)
                    if p:
                        pngs_generats.append(p)
                    
                    grid_full = hail_cm.reshape(nlat_global, nlon_global)
                    grid_zona = grid_full[np.ix_(lat_mask, lon_mask)]
                    grid_zona = grid_zona[np.ix_(ordre_lat, ordre_lon)]
                    p = generar_png_variable("hail_cm", grid_zona, lats_z_ord, lons_z_ord, ts_str, OUTPUT_DIR, zona_nom, amb_etiquetes=True)
                    if p:
                        pngs_generats.append(p)
        
        n_pngs_zona = len(list((OUTPUT_DIR / zona_nom).glob("*.png"))) if (OUTPUT_DIR / zona_nom).exists() else 0
        print(f"     ✅ {zona_def['nom']}: {n_pngs_zona} PNGs")
    
    return pngs_generats

# ═══════════════ MAIN ═══════════════

def main():
    t0 = time.time()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    borrar_sortida_antiga()
    log_path, fitxer_log = configurar_log()
    netejar_tmp()
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    exit_code = 0
    pngs_generats = []
    
    try:
        print("=" * 65)
        print("  AROME: DESCARREGA PER FASES")
        print("  FASE 1: Satèl·lit → PNGs immediats")
        print("  FASE 2: Meteofrance → PNGs després")
        print("=" * 65)
        
        try:
            import meteofetch
        except ImportError:
            sys.exit("❌ Falta meteofetch")
        
        if not comprovar_connexio():
            sys.exit(1)
        
        run_mf = trobar_millor_run()
        run_dt_mf = datetime.strptime(run_mf + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ")
        steps_bloc = calcular_steps(TOTAL_HORES)
        print(f"  ✅ Run: {run_mf}Z | Steps: {len(steps_bloc)} | Zones: {len(ZONES)}")
        
        generar_js_coordenades(OUTPUT_DIR)
        
        nlat = int((CFG.la1 - CFG.la0) / 0.025) + 1
        nlon = int((CFG.lo1 - CFG.lo0) / 0.025) + 1
        lats_out = np.linspace(CFG.la0, CFG.la1, nlat)
        lons_out = np.linspace(CFG.lo0, CFG.lo1, nlon)
        
        # ═══════════════ FASE 1: SATÈL·LIT ═══════════════
        if CFG.satelit_enabled and not SHUTDOWN_REQUESTED:
            print("\n  ╔══════════════════════════════════════╗")
            print("  ║  FASE 1: SATÈL·LIT (WCS)             ║")
            print("  ╚══════════════════════════════════════╝")
            
            try:
                bt108_data, lightning_data, radar_data = descarregar_satelit_wcs(steps_bloc, run_dt_mf, lats_out, lons_out)
            except Exception as e:
                print(f"  ⚠️  Error en satèl·lit: {e}")
                traceback.print_exc()
        else:
            print("\n  🛰️  Satèl·lit desactivat o interromput")
        
        # ═══════════════ FASE 2: METEOFRANCE ═══════════════
        print("\n  ╔══════════════════════════════════════╗")
        print("  ║  FASE 2: METEOFRANCE (GRIB)          ║")
        print("  ╚══════════════════════════════════════╝")
        
        sfc_data, lats_sfc, lons_sfc = descarregar_sfc_global(steps_bloc, run_dt_mf)
        td_data, lats_3d, lons_3d = descarregar_3d_global(steps_bloc, run_dt_mf)
        
        if not lats_sfc or not lats_3d:
            print("  ❌ ERROR: No s'han pogut descarregar les dades meteofrance")
            sys.exit(1)
        
        print("\n  📸 Generant PNGs de Meteofrance...")
        pngs_meteofrance = generar_pngs_meteofrance(sfc_data, td_data, lats_sfc, lons_sfc, 
                                                      steps_bloc, run_dt_mf)
        pngs_generats.extend(pngs_meteofrance)
        print(f"  ✅ PNGs Meteofrance: {len(pngs_meteofrance)} generats")
        
        print(f"\n  ✅ TOTAL: {len(pngs_generats)} PNGs en {format_time(time.time() - t0)}")
        for zona_nom in ZONES:
            zona_dir = OUTPUT_DIR / zona_nom
            if zona_dir.exists():
                print(f"     📁 {zona_nom}/: {len(list(zona_dir.glob('*.png')))} PNGs")
        
        if SHUTDOWN_REQUESTED:
            exit_code = 130
    
    except SystemExit as e:
        exit_code = e.code if isinstance(e.code, int) else 1
    except Exception as e:
        print(f"\n  ❌ ERROR: {e}")
        traceback.print_exc()
        exit_code = 1
    finally:
        netejar_tmp()
        print(f"\n  📝 Log: {log_path}")
    
    try:
        fitxer_log.close()
    except Exception:
        pass
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()