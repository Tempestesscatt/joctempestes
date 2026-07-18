"""
aromepi.py — AROME-PI Downloader
VERSIO FINAL v3.3 - Status JS al inici
CARACTERÍSTIQUES:
  - Logos animats amb colors per a cada fase del procés
  - Barres de progrés amb emojis i colors
  - Crea status.js al INICI amb estat "IN_PROGRESS"
  - Actualitza status.js al FINAL amb estat "COMPLETAT"
  - Comptador d'èxits/fallades per bloc
  - Reintens intel·ligents per variables pendents
"""
import io, json, logging, os, re, sys, time, glob, subprocess, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
import numpy as np, requests, tifffile, xml.etree.ElementTree as ET
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from scipy.interpolate import RegularGridInterpolator
from dotenv import load_dotenv
load_dotenv()

LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

# Configuració de logging - NOMÉS arxiu, sense consola (la consola la gestionem manualment)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, "aromepi.log"), encoding="utf-8"),
    ]
)
log = logging.getLogger("aromepi")

# ========== COLORS PER LA CONSOLA ==========
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'
    MAGENTA = '\033[35m'
    WHITE = '\033[37m'
    ORANGE = '\033[38;5;214m'
    PURPLE = '\033[38;5;141m'

# ========== LOGOS ==========
LOGO_START = f"""
{Colors.CYAN}╔══════════════════════════════════════════════════════════════╗
{Colors.CYAN}║{Colors.BOLD}{Colors.WHITE}  █████╗ ██████╗  ██████╗ ███╗   ███╗███████╗██████╗  ██╗{Colors.END}{Colors.CYAN} ║
{Colors.CYAN}║{Colors.BOLD}{Colors.WHITE} ██╔══██╗██╔══██╗██╔═══██╗████╗ ████║██╔════╝██╔══██╗███║{Colors.END}{Colors.CYAN} ║
{Colors.CYAN}║{Colors.BOLD}{Colors.WHITE} ███████║██████╔╝██║   ██║██╔████╔██║█████╗  ██████╔╝╚██║{Colors.END}{Colors.CYAN} ║
{Colors.CYAN}║{Colors.BOLD}{Colors.WHITE} ██╔══██║██╔══██╗██║   ██║██║╚██╔╝██║██╔══╝  ██╔═══╝  ██║{Colors.END}{Colors.CYAN} ║
{Colors.CYAN}║{Colors.BOLD}{Colors.WHITE} ██║  ██║██║  ██║╚██████╔╝██║ ╚═╝ ██║███████╗██║      ██║{Colors.END}{Colors.CYAN} ║
{Colors.CYAN}║{Colors.BOLD}{Colors.WHITE} ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝      ╚═╝{Colors.END}{Colors.CYAN} ║
{Colors.CYAN}╚══════════════════════════════════════════════════════════════╝{Colors.END}
{Colors.MAGENTA}              🌤️  AROME-PI DOWNLOADER v3.3  🌤️{Colors.END}
{Colors.YELLOW}              ═══════════════════════════════════{Colors.END}
"""

LOGO_RUN = f"""
{Colors.GREEN}  🛰️  {Colors.BOLD}BUSCANT RUN DISPONIBLE...{Colors.END}
{Colors.CYAN}  ═══════════════════════════════════════{Colors.END}
"""

LOGO_PROCESS = f"""
{Colors.ORANGE}  📡  {Colors.BOLD}PROCESSANT ZONA...{Colors.END}
{Colors.CYAN}  ═══════════════════════════════════════{Colors.END}
"""

LOGO_COMPLETE = f"""
{Colors.GREEN}  ✅  {Colors.BOLD}PROCÉS COMPLETAT!{Colors.END}
{Colors.CYAN}  ═══════════════════════════════════════{Colors.END}
"""

class CFG:
    def __init__(self, f):
        with open(f, encoding="utf-8") as fh: c = json.load(fh)
        self.key      = c["api_key"]
        self.base_pi  = c["aromepi"]["api_base"]
        self.svc_pi   = c["aromepi"]["service"]
        self.timeout  = c["http"]["timeout_seconds"]
        self.retry    = c["http"]["max_retries"]
        self.rdelay   = c["http"]["retry_delay_base"]
        self.rl       = c["http"]["rate_limit_delay"]
        self.idelay   = c["http"]["inter_request_delay"]
        self.out      = c["output_dir"]
        self.n_sfc    = c["grid"]["n_grid"]
        self.workers  = c["grid"]["workers"]
        fc = c.get("forecast", {})
        self.fc_minutes_max = fc.get("max_minutes", 30)
        self.fc_step        = fc.get("step_minutes", 15)
        rt = c.get("retry_pending", {})
        self.pending_max_retries   = rt.get("max_retries", 3)
        self.pending_wait_seconds  = rt.get("wait_seconds", 45)
        self.ses_pi = self._create_session()

    def _create_session(self):
        session = requests.Session()
        retry_strategy = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=["GET"])
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=30, pool_maxsize=30, pool_block=False)
        session.mount("https://", adapter); session.mount("http://", adapter)
        session.headers.update({"apikey": self.key, "User-Agent": "AROME-PI/13.0-FINAL"})
        return session

cfg = CFG("config2.json")
REGIONS = [{"name": "Catalunya", "lon_min": -9.5, "lon_max": 4.0, "lat_min": 37.5, "lat_max": 44.5}]

ALTURES_T  = [2, 10, 20, 50, 100, 250, 500]
ALTURES_RH = [10, 20, 35, 50, 75, 100, 150, 200, 250, 375, 500, 625, 750, 875, 1000, 1125, 1250, 1375, 1500, 1750, 2000, 2250, 2500, 2750, 3000]
ALTURES_DP = [10, 20, 50, 100, 250, 500]
ALTURES_PR = [10]
VENT_ALTURES = [10, 20, 100, 250, 500]
GUST_MIN_STEP = 4

VARS_PI = {
    "stp":                ("DIAG_STP__GROUND_OR_WATER_SURFACE", None, 1.0),
    "ehi":                ("DIAG_EHI__GROUND_OR_WATER_SURFACE", None, 1.0),
    "ica":                ("DIAG_ICA__GROUND_OR_WATER_SURFACE", None, 1.0),
    "diag_grele":         ("DIAG_GRELE__GROUND_OR_WATER_SURFACE", None, 1.0),
    "diag_fog":           ("DIAG_FOG__GROUND_OR_WATER_SURFACE", None, 1.0),
    "reflectivity":       ("REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE", None, 1.0),
    "total_precip_rate":  ("TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE", None, 1.0),
    "cb_top_pressure":    ("PRESSURE__CUMULONIMBUS_TOP", None, 0.01),
    "cloud_top_pressure": ("PRESSURE__LEVEL_OF_CLOUD_TOP", None, 0.01),
    "high_cloud":         ("HIGH_CLOUD_COVER__GROUND_OR_WATER_SURFACE", None, 1.0),
    "medium_cloud":       ("MEDIUM_CLOUD_COVER__GROUND_OR_WATER_SURFACE", None, 1.0),
    "tke":                ("TKE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 20, 1.0),
    "visibility_mini":    ("VISIBILITY_MINI_15MIN__GROUND_OR_WATER_SURFACE", None, 1.0),
    "nebul":              ("NEBUL__GROUND_OR_WATER_SURFACE", None, 1.0),
    "pressure_msl":       ("PRESSURE__SEA_SURFACE", None, 0.01),
    "graupel":            ("GRAUPEL__GROUND_OR_WATER_SURFACE", None, 1.0),
    "hail":               ("HAIL__GROUND_OR_WATER_SURFACE", None, 1.0),
    "snow_sc":            ("SNOW_SC__GROUND_OR_WATER_SURFACE", None, 1.0),
    "total_precip":       ("TOTAL_PRECIPITATION__GROUND_OR_WATER_SURFACE", None, 1.0),
    "total_snow":         ("TOTAL_SNOW_PRECIPITATION__GROUND_OR_WATER_SURFACE", None, 1.0),
    "solid_precip":       ("SOLID_PRECIPITATION__GROUND_OR_WATER_SURFACE", None, 1.0),
    "precip_type":        ("PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE", None, 1.0),
    "severe_precip_type": ("SEVERE_PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE", None, 1.0),
    "precip_fzn":         ("PRECIPITATION_FZN_GROUND__GROUND_OR_WATER_SUFACE", None, 1.0),
    "visibility_precip":  ("VISIBILITY_MINI_PRECIP_15MIN__GROUND_OR_WATER_SURFACE", None, 1.0),
    "tpw_0c":             ("TPW_27315_HEIGHT__LEVEL_OF_ADIABATIC_CONDENSATION", None, 1.0),
    "tpw_1c":             ("TPW_27415_HEIGHT__LEVEL_OF_ADIABATIC_CONDENSATION", None, 1.0),
    "tpw_1_5c":           ("TPW_27465_HEIGHT__LEVEL_OF_ADIABATIC_CONDENSATION", None, 1.0),
    "sw_radiation":       ("SHORT_WAVE_RADIATION_FLUX__GROUND_OR_WATER_SURFACE", None, 1.0),
    "u_10m":   ("U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 10, 1.0),
    "v_10m":   ("V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 10, 1.0),
    "u_20m":   ("U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 20, 1.0),
    "v_20m":   ("V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 20, 1.0),
    "u_100m":  ("U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 100, 1.0),
    "v_100m":  ("V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 100, 1.0),
    "u_250m":  ("U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 250, 1.0),
    "v_250m":  ("V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 250, 1.0),
    "u_500m":  ("U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 500, 1.0),
    "v_500m":  ("V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 500, 1.0),
    "t_2m":    ("TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 2,   1.0),
    "t_10m":   ("TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 10,  1.0),
    "t_20m":   ("TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 20,  1.0),
    "t_50m":   ("TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 50,  1.0),
    "t_100m":  ("TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 100, 1.0),
    "t_250m":  ("TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 250, 1.0),
    "t_500m":  ("TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 500, 1.0),
    "rh_10m":   ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 10,   1.0),
    "rh_20m":   ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 20,   1.0),
    "rh_35m":   ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 35,   1.0),
    "rh_50m":   ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 50,   1.0),
    "rh_75m":   ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 75,   1.0),
    "rh_100m":  ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 100,  1.0),
    "rh_150m":  ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 150,  1.0),
    "rh_200m":  ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 200,  1.0),
    "rh_250m":  ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 250,  1.0),
    "rh_375m":  ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 375,  1.0),
    "rh_500m":  ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 500,  1.0),
    "rh_625m":  ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 625,  1.0),
    "rh_750m":  ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 750,  1.0),
    "rh_875m":  ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 875,  1.0),
    "rh_1000m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 1000, 1.0),
    "rh_1125m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 1125, 1.0),
    "rh_1250m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 1250, 1.0),
    "rh_1375m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 1375, 1.0),
    "rh_1500m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 1500, 1.0),
    "rh_1750m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 1750, 1.0),
    "rh_2000m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 2000, 1.0),
    "rh_2250m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 2250, 1.0),
    "rh_2500m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 2500, 1.0),
    "rh_2750m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 2750, 1.0),
    "rh_3000m": ("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 3000, 1.0),
    "dp_10m":  ("DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 10,  1.0),
    "dp_20m":  ("DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 20,  1.0),
    "dp_50m":  ("DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 50,  1.0),
    "dp_100m": ("DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 100, 1.0),
    "dp_250m": ("DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 250, 1.0),
    "dp_500m": ("DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 500, 1.0),
    "pr_10m":  ("PRESSURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 10,  0.01),
    "wind_gust_15min": ("WIND_SPEED_GUST_15MIN__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND", 10, 1.0),
}


class DoubleProgressBar:
    """Dues barres de progrés simultànies amb colors i emojis"""

    def __init__(self, total1, total2, label1="Bloc 1", label2="Bloc 2"):
        self.total1 = total1
        self.total2 = total2
        self.current1 = 0
        self.current2 = 0
        self.ok1 = 0
        self.ok2 = 0
        self.fail1 = 0
        self.fail2 = 0
        self.label1 = label1
        self.label2 = label2
        self.start_time = time.time()
        self.lock = threading.Lock()
        self.total_size1 = 0
        self.total_size2 = 0

        print("\n" * 3)
        self._move_cursor_up(3)
        self._draw_both()

    def _move_cursor_up(self, n):
        sys.stdout.write(f'\033[{n}A')
        sys.stdout.flush()

    def _move_cursor_down(self, n):
        sys.stdout.write(f'\033[{n}B')
        sys.stdout.flush()

    def _clear_line(self):
        sys.stdout.write('\033[2K\r')
        sys.stdout.flush()

    def _format_size(self, size):
        if size >= 1024*1024:
            return f"{size/(1024*1024):.1f} MB"
        elif size >= 1024:
            return f"{size/1024:.1f} KB"
        else:
            return f"{size} B"

    def _format_bar(self, current, total, ok_count, fail_count, label, total_size=0):
        percent = (current / total) * 100 if total > 0 else 0
        bar_len = 35
        filled = int(bar_len * current / total) if total > 0 else 0
        bar = '█' * filled + '░' * (bar_len - filled)

        # Color segons percentatge
        if percent < 30:
            color = Colors.RED
        elif percent < 70:
            color = Colors.YELLOW
        else:
            color = Colors.GREEN

        size_str = self._format_size(total_size)
        elapsed = time.time() - self.start_time
        elapsed_min = elapsed / 60
        elapsed_str = f"⏱ {elapsed_min:.0f}min" if elapsed >= 60 else f"⏱ {elapsed:.0f}s"
        
        eta_str = ""
        if current > 0 and current < total:
            eta = (elapsed / current) * (total - current)
            if eta >= 60:
                eta_str = f" | ETA: {eta/60:.0f}min"
            else:
                eta_str = f" | ETA: {eta:.0f}s"

        if fail_count > 0:
            status_str = f"({ok_count}✅/{fail_count}❌/{total} tot)"
        else:
            status_str = f"({current}/{total})"

        return f"{color}{label}{Colors.END} |{color}{bar}{Colors.END}| {color}{percent:5.1f}%{Colors.END} {status_str} | 📦 {size_str} | {elapsed_str}{eta_str}"

    def _draw_both(self):
        line1 = self._format_bar(self.current1, self.total1, self.ok1, self.fail1, self.label1, self.total_size1)
        line2 = self._format_bar(self.current2, self.total2, self.ok2, self.fail2, self.label2, self.total_size2)

        sys.stdout.write('\033[s')
        sys.stdout.write('\033[3A')
        self._clear_line()
        sys.stdout.write(line1 + '\n')
        self._clear_line()
        sys.stdout.write(line2 + '\n')
        self._clear_line()
        sys.stdout.write(Colors.CYAN + '─' * 70 + Colors.END + '\n')
        sys.stdout.write('\033[u')
        sys.stdout.flush()

    def update_bar1(self, increment=1, file_size=0, success=True):
        with self.lock:
            self.current1 = min(self.current1 + increment, self.total1)
            if success:
                self.ok1 += increment
                self.total_size1 += file_size
            else:
                self.fail1 += increment
            self._draw_both()

    def update_bar2(self, increment=1, file_size=0, success=True):
        with self.lock:
            self.current2 = min(self.current2 + increment, self.total2)
            if success:
                self.ok2 += increment
                self.total_size2 += file_size
            else:
                self.fail2 += increment
            self._draw_both()

    def finish(self):
        with self.lock:
            self.current1 = self.total1
            self.current2 = self.total2
            self._draw_both()
            sys.stdout.write('\n\n\n')
            sys.stdout.flush()


def print_log(msg):
    """Imprimeix un missatge de log a la consola sense trencar les barres de progrés."""
    sys.stdout.write('\033[s')
    sys.stdout.write('\033[3B')
    sys.stdout.write('\n' + msg + '\n')
    sys.stdout.write('\033[u')
    sys.stdout.flush()
    log.info(msg)


def api_get(url, params=None, timeout=30):
    for intento in range(4):
        try:
            r = cfg.ses_pi.get(url, params=params, timeout=timeout)
            if r.status_code == 200: return r
            elif r.status_code == 429: time.sleep(cfg.rl * (intento + 1))
            elif r.status_code == 401: raise RuntimeError("API key no valida")
            else: time.sleep(2)
        except requests.exceptions.Timeout: time.sleep(3)
        except Exception: time.sleep(2)
    return None


def covs():
    for intento in range(5):
        try:
            url = f"{cfg.base_pi}/wcs/{cfg.svc_pi}/GetCapabilities"
            r = api_get(url, params={"SERVICE": "WCS", "VERSION": "2.0.1", "LANGUAGE": "eng"}, timeout=60)
            if r and r.status_code == 200:
                root = ET.fromstring(r.content)
                c = [e.text.strip() for e in root.iter("{http://www.opengis.net/wcs/2.0}CoverageId")]
                if c: print_log(f"{len(c)} coverages found"); return c
            time.sleep(min(20 * (intento + 1), 60))
        except Exception as e: print_log(f"GetCapabilities error: {e}"); time.sleep(30)
    raise RuntimeError("Could not get coverages")


def find_cov(covs_list, prefix, run_dt):
    ts = run_dt.strftime("%Y-%m-%dT%H.%M.00Z")
    cands = [c for c in covs_list if c.startswith(prefix) and ts in c]
    sense_pt = [c for c in cands if "_PT" not in c.split("___")[-1]]
    if sense_pt: return sorted(sense_pt)[-1]
    if cands: return sorted(cands, key=lambda c: len(c.split("___")[-1]))[0]
    return None


def esperar_run_disponible():
    print(LOGO_RUN)
    for intent in range(1, 9999):
        try:
            covs_list = covs()
            runs = set()
            for c in covs_list:
                if not c.startswith("REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE"): continue
                m = re.search(r'(\d{4}-\d{2}-\d{2}T\d{2}\.\d{2}\.\d{2}Z)', c)
                if m:
                    try:
                        ts = m.group(1).replace(".", ":").replace("Z", "")
                        runs.add(datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc))
                    except: pass
            runs = sorted(runs)
            if runs:
                ultim = runs[-1]; ant = int((datetime.now(timezone.utc) - ultim).total_seconds() / 60)
                print_log(f"📡 Últim run: {ultim.strftime('%Y-%m-%d %H:%MZ')} ({ant} min enrere)")
                if ant < 240: return ultim, covs_list
            time.sleep(min(60 + intent * 15, 300))
        except Exception as e: print_log(f"Error: {e}"); time.sleep(60)


def tile(cid, t_iso, lon0, lon1, lat0, lat1, height=None, var_key=""):
    if not cid:
        return None, "CID_NONE"
    url = (f"{cfg.base_pi}/wcs/{cfg.svc_pi}/GetCoverage?SERVICE=WCS&VERSION=2.0.1"
           f"&COVERAGEID={cid}&FORMAT=image/tiff"
           f"&SUBSET=long({lon0},{lon1})&SUBSET=lat({lat0},{lat1})&SUBSET=time({t_iso})")
    if height is not None: url += f"&SUBSET=height({height})"
    last_reason = "UNKNOWN"
    for intento in range(4):
        try:
            r = api_get(url, timeout=90)
            if r and r.status_code == 200 and len(r.content) > 100:
                try:
                    arr = tifffile.imread(io.BytesIO(r.content)).astype(np.float32)
                    if arr.ndim == 3: arr = arr[0]
                    if arr.size > 0 and not np.all(np.isnan(arr)): time.sleep(0.1); return arr, None
                    last_reason = "ALL_NAN"
                except Exception as e:
                    last_reason = f"TIFF_PARSE_ERR:{e}"
            elif r and r.status_code == 429:
                last_reason = "HTTP_429"; time.sleep(2 * (intento + 1))
            elif r and r.status_code in (502, 503, 504):
                last_reason = f"HTTP_{r.status_code}_TRANSIENT"; time.sleep(2)
            elif r and r.status_code == 404:
                last_reason = "HTTP_404_NOT_YET_PUBLISHED"; time.sleep(1)
            else:
                last_reason = f"HTTP_{r.status_code if r else 'NO_RESPONSE'}"; time.sleep(2)
        except requests.exceptions.Timeout:
            last_reason = "TIMEOUT"; time.sleep(2)
        except Exception as e:
            last_reason = f"EXC:{type(e).__name__}"; time.sleep(2)

    return None, last_reason


def grid(n, lon0, lon1, lat0, lat1):
    la = np.linspace(lat0, lat1, n); lo = np.linspace(lon0, lon1, n)
    lon2d, lat2d = np.meshgrid(lo, la)
    return la, lo, lon2d, lat2d


def interp(raw, la, lo, lon0, lon1, lat0, lat1):
    if raw is None or raw.size == 0: return None
    try:
        nr, nc = raw.shape
        fn = RegularGridInterpolator((np.linspace(lat0, lat1, nr), np.linspace(lon0, lon1, nc)), raw, method="linear", bounds_error=False, fill_value=np.nan)
        return fn(np.array([[lt, ln] for lt in la for ln in lo])).reshape(len(la), len(lo))
    except: return None


def validar(key, data):
    if data is None or data.size == 0: return None
    try:
        if key.startswith("sw_") or key.startswith("pr_") or key.startswith("cb_") or key.startswith("cloud_") or key == "pressure_msl":
            data = np.where(np.abs(data - 9999) < 1, np.nan, data)
        else:
            data = np.where(np.abs(data) > 9000, np.nan, data)

        if key == "reflectivity": data[(data < -30) | (data > 80)] = np.nan
        elif key in ("stp", "ehi", "ica"): data[data > 100] = np.nan
        elif key == "diag_grele": data[data > 24] = np.nan
        elif key == "diag_fog": data[(data < 0) | (data > 100)] = np.nan
        elif key in ("cb_top_pressure", "cloud_top_pressure"): data[(data < 100) | (data > 105000)] = np.nan
        elif key == "tke": data[data > 1000] = np.nan
        elif key.startswith("u_") or key.startswith("v_"): data[(data < -150) | (data > 150)] = np.nan
        elif key.startswith("t_"): data[(data < -80) | (data > 80)] = np.nan
        elif key.startswith("rh_"): data[(data < 0) | (data > 100)] = np.nan
        elif key.startswith("dp_"): data[(data < -80) | (data > 60)] = np.nan
        elif key.startswith("pr_"): data[(data < 50000) | (data > 110000)] = np.nan
        elif key == "wind_gust_15min": data[(data < 0) | (data > 200)] = np.nan
        elif key == "total_precip_rate": data[data < 0] = np.nan
        elif key in ("high_cloud", "medium_cloud", "nebul"): data[(data < 0) | (data > 100)] = np.nan
        elif key == "pressure_msl": data[(data < 80000) | (data > 110000)] = np.nan
        elif key in ("visibility_mini", "visibility_precip"): data[(data < 0) | (data > 100000)] = np.nan
        elif key in ("graupel", "hail", "total_precip", "total_snow", "solid_precip"): data[data < 0] = np.nan
        elif key in ("snow_sc", "precip_type", "severe_precip_type", "precip_fzn"): data[(data < -10) | (data > 300)] = np.nan
        elif key.startswith("tpw_"): data[(data < 0) | (data > 10000)] = np.nan
        elif key.startswith("sw_"): data[data < 0] = np.nan

        return data
    except: return None


def _download_single(key, cid, ts, height, factor, lon0, lon1, lat0, lat1, la, lo):
    r, reason = tile(cid, ts, lon0, lon1, lat0, lat1, height=height, var_key=key)
    if r is None: return None, reason
    r = validar(key, r)
    if r is None: return None, "VALIDAR_REJECTED"
    r = interp(r, la, lo, lon0, lon1, lat0, lat1)
    if r is None: return None, "INTERP_FAILED"
    if factor != 1.0: r = r * factor
    return r, None


def descarregar_hora(step_idx, run_ref, covs_list, la, lo, lon0, lon1, lat0, lat1):
    minutes = step_idx * cfg.fc_step
    dt = run_ref + timedelta(minutes=minutes)
    ts = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    res = {}

    keys_to_try = []
    for key in VARS_PI:
        if key == "wind_gust_15min" and step_idx < GUST_MIN_STEP: continue
        if key == "sw_radiation" and step_idx < 4: continue
        keys_to_try.append(key)

    effective_total = len(keys_to_try)
    pending = list(keys_to_try)
    fail_reasons = {}
    attempt = 1
    max_attempts = 1 + cfg.pending_max_retries

    while pending and attempt <= max_attempts:
        if attempt > 1:
            print_log(f"  H+{minutes:03d}min: reintent {attempt-1}/{cfg.pending_max_retries} per {len(pending)} vars pendents (esperant {cfg.pending_wait_seconds}s)")
            time.sleep(cfg.pending_wait_seconds)
            try:
                covs_list = covs()
            except Exception as e:
                print_log(f"  No s'ha pogut refrescar coverages: {e}")

        still_pending = []
        with ThreadPoolExecutor(max_workers=min(cfg.workers, 12)) as ex:
            futures = {}
            for key in pending:
                prefix, height, factor = VARS_PI[key]
                cid = find_cov(covs_list, prefix, run_ref)
                futures[ex.submit(_download_single, key, cid, ts, height, factor, lon0, lon1, lat0, lat1, la, lo)] = key

            completed_in_batch = 0
            for future in as_completed(futures):
                key = futures[future]
                try:
                    result, reason = future.result(timeout=120)
                    if result is not None:
                        res[key] = result
                        completed_in_batch += 1
                        if attempt == 1:
                            print_log(f"    ✅ [{completed_in_batch}/{len(pending)}] {key} OK")
                        else:
                            print_log(f"    ✅ [reintent] {key} OK")
                    else:
                        still_pending.append(key)
                        fail_reasons[key] = reason
                        print_log(f"    ❌ {key} FAIL: {reason}")
                except Exception as e:
                    still_pending.append(key)
                    fail_reasons[key] = f"EXC:{type(e).__name__}"
                    print_log(f"    ❌ {key} EXCEPTION: {type(e).__name__}")

        pending = still_pending
        attempt += 1

    ok_count = len(res)
    total_count = effective_total
    if ok_count == total_count:
        print_log(f"  🎯 H+{minutes:03d}min: {ok_count}/{total_count} vars OK ✅")
    elif ok_count > 0:
        print_log(f"  ⚠️  H+{minutes:03d}min: {ok_count}/{total_count} vars OK ({total_count - ok_count} perdudes)")
    else:
        print_log(f"  🚨 H+{minutes:03d}min: 0/{total_count} vars — revisar connexió/API key")

    if pending:
        for key in pending:
            print_log(f"    ❌ {key}: {fail_reasons.get(key, '?')}")

    return res if res else None


def guardar_hora(acc, step_idx, run_ref, lon2d, lat2d, nom, lon0, lon1, lat0, lat1):
    n = cfg.n_sfc
    minutes = step_idx * cfg.fc_step
    dt = run_ref + timedelta(minutes=minutes)
    ts = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    nom_clean = nom.lower().replace(" ", "_")
    surface = {}

    def g(arr, d=2):
        if arr is not None: return [round(float(v), d) if not np.isnan(v) else None for v in arr.flatten()]
        return [None] * (n * n)

    for k in VARS_PI:
        if any(k.startswith(p) for p in ("u_", "v_", "t_", "rh_", "dp_", "pr_")): continue
        if k == "wind_gust_15min": continue
        surface[k] = g(acc.get(k), 2)

    for h in VENT_ALTURES:
        u, v = acc.get(f"u_{h}m"), acc.get(f"v_{h}m")
        if u is not None and v is not None:
            wspd = np.sqrt(u**2 + v**2) * 3.6; wdir = (270 - np.degrees(np.arctan2(v, u))) % 360
            surface[f"wind_speed_{h}m"] = g(wspd, 2); surface[f"wind_direction_{h}m"] = g(wdir, 1)
        else:
            surface[f"wind_speed_{h}m"] = [None]*(n*n); surface[f"wind_direction_{h}m"] = [None]*(n*n)

    for h in ALTURES_T: surface[f"t_{h}m"] = g(acc.get(f"t_{h}m"), 1)
    for h in ALTURES_RH: surface[f"rh_{h}m"] = g(acc.get(f"rh_{h}m"), 1)
    for h in ALTURES_DP: surface[f"dp_{h}m"] = g(acc.get(f"dp_{h}m"), 1)
    for h in ALTURES_PR: surface[f"pr_{h}m"] = g(acc.get(f"pr_{h}m"), 1)

    arr = acc.get("wind_gust_15min")
    surface["wind_gust_15min"] = g(arr * 3.6, 2) if arr is not None else [None]*(n*n)

    data = {"step": step_idx, "minutes": minutes, "time_utc": ts, "surface": surface}
    fn = f"dades_aromepi_{nom_clean}_h{step_idx:02d}.js"
    fp = os.path.join(cfg.out, fn)
    write_js(data, f"DADES_AROMEPI_{nom.upper().replace(' ','_')}_H{step_idx:02d}", fp)

    file_size = os.path.getsize(fp) if os.path.exists(fp) else 0
    return fp, dt, file_size


def guardar_index(run_ref, n_steps, lon2d, lat2d, nom, lon0, lon1, lat0, lat1):
    n = cfg.n_sfc; nom_clean = nom.lower().replace(" ", "_")
    minutes_list = [s * cfg.fc_step for s in range(n_steps)]
    times_utc = [(run_ref + timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:%SZ") for m in minutes_list]
    meta = {"model": "AROME-PI", "region": nom, "extent": [lon0, lon1, lat0, lat1], "n_grid": n, "n_steps": n_steps,
            "step_minutes": cfg.fc_step, "forecast_minutes": minutes_list,
            "run": run_ref.strftime("%Y-%m-%dT%H:%M:%SZ"), "times_utc": times_utc,
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    data = {"meta": meta, "lats": [round(float(x), 4) for x in lat2d.flatten()], "lons": [round(float(x), 4) for x in lon2d.flatten()]}
    fp = os.path.join(cfg.out, f"dades_aromepi_{nom_clean}_index.js")
    write_js(data, f"DADES_AROMEPI_{nom.upper().replace(' ','_')}_INDEX", fp)
    return fp


def write_js(data, varname, filepath):
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    tmp = filepath + f".tmp.{threading.get_ident()}"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(f"const {varname} = "); json.dump(data, f, separators=(',', ':')); f.write(";\n")
    for _ in range(10):
        try: os.replace(tmp, filepath); break
        except PermissionError: time.sleep(3)


def crear_status_inicial(run_ref, covs_pi):
    """Crea status.json i status.js al inici de l'execució"""
    ara = datetime.now(timezone.utc)
    
    # Status inicial
    status_inicial = {
        "model": "AROME-PI",
        "estat": "IN_PROGRESS",
        "ultima_execucio": {
            "utc": ara.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "madrid": ara.astimezone(timezone(timedelta(hours=2))).strftime("%Y-%m-%dT%H:%M:%S"),
            "timestamp_unix": int(ara.timestamp())
        },
        "run_descargat": {
            "utc": run_ref.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "madrid": run_ref.astimezone(timezone(timedelta(hours=2))).strftime("%Y-%m-%dT%H:%M:%S"),
            "minuts_endarrerit": int((ara - run_ref).total_seconds() / 60)
        },
        "passos": {
            "total": 0,
            "completats": 0,
            "fallats": 0
        },
        "fitxers": [],
        "mida_total_mb": 0,
        "durada_segons": 0
    }
    
    # Guardar status.json
    status_path = os.path.join(cfg.out, "status.json")
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(status_inicial, f, indent=2, ensure_ascii=False)
    
    # Guardar status.js
    js_path = os.path.join(cfg.out, "status.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("const STATUS_AROMEPI = ")
        json.dump(status_inicial, f, indent=2, ensure_ascii=False)
        f.write(";\n")
    
    print_log(f"📄 Status inicial creat (IN_PROGRESS)")
    print_log(f"   📅 Run: {run_ref.strftime('%Y-%m-%d %H:%MZ')}")
    print_log(f"   ⏱️  Endarreriment: {status_inicial['run_descargat']['minuts_endarrerit']} min")
    
    return status_inicial


def actualitzar_status_final(status_inicial, files, elapsed, n_steps, ok_count, fail_count):
    """Actualitza status.json i status.js al final de l'execució"""
    ara = datetime.now(timezone.utc)
    
    # Calcular mida total
    mida_total = 0
    for f in files:
        if os.path.exists(f):
            mida_total += os.path.getsize(f)
    
    # Actualitzar status
    status_final = {
        "model": "AROME-PI",
        "estat": "COMPLETAT",
        "ultima_execucio": {
            "utc": ara.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "madrid": ara.astimezone(timezone(timedelta(hours=2))).strftime("%Y-%m-%dT%H:%M:%S"),
            "timestamp_unix": int(ara.timestamp())
        },
        "run_descargat": status_inicial["run_descargat"],
        "passos": {
            "total": n_steps,
            "completats": ok_count,
            "fallats": fail_count
        },
        "fitxers": [os.path.basename(f) for f in files if os.path.basename(f) != "status.js"],
        "mida_total_mb": round(mida_total / (1024 * 1024), 2),
        "durada_segons": round(elapsed, 1)
    }
    
    # Guardar status.json
    status_path = os.path.join(cfg.out, "status.json")
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(status_final, f, indent=2, ensure_ascii=False)
    
    # Guardar status.js
    js_path = os.path.join(cfg.out, "status.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("const STATUS_AROMEPI = ")
        json.dump(status_final, f, indent=2, ensure_ascii=False)
        f.write(";\n")
    
    print_log(f"📄 Status final actualitzat (COMPLETAT)")
    print_log(f"   📊 Fitxers: {len(status_final['fitxers'])}")
    print_log(f"   💾 Mida: {status_final['mida_total_mb']} MB")
    print_log(f"   ⏱️  Durada: {status_final['durada_segons']}s")


def netejar_carpeta_output():
    """Neteja la carpeta de sortida, incloent status.json i status.js"""
    if os.path.exists(cfg.out):
        # Esborrar tots els fitxers .js
        for fp in glob.glob(os.path.join(cfg.out, "*.js")):
            try: os.remove(fp)
            except: pass
        
        # Esborrar status.json
        status_json = os.path.join(cfg.out, "status.json")
        if os.path.exists(status_json):
            try: os.remove(status_json)
            except: pass
        
        # Esborrar fitxers temporals
        for fp in glob.glob(os.path.join(cfg.out, "*.tmp*")):
            try: os.remove(fp)
            except: pass
        
        print_log(f"🧹 Carpeta {cfg.out} netejada")


def format_size(bytes_val):
    if bytes_val >= 1024*1024:
        return f"{bytes_val/(1024*1024):.2f} MB"
    elif bytes_val >= 1024:
        return f"{bytes_val/1024:.2f} KB"
    return f"{bytes_val} B"


def _processar_bloc(bloc_id, steps, run_ref_pi, covs_pi, la, lo, lon0, lon1, lat0, lat1,
                     nom, lon2d, lat2d, files, status, lock, progress_bar_obj, n_steps):
    bloc_label = f"Bloc {bloc_id} (0-180min)" if bloc_id == 1 else f"Bloc {bloc_id} (180-360min)"
    bloc_total = len(steps)
    failed_count = 0

    for i, s in enumerate(steps):
        minutes = s * cfg.fc_step
        print_log(f"[{bloc_label}] Iniciant H+{minutes:03d}min (step {s:02d}/{n_steps-1})")

        dades = descarregar_hora(s, run_ref_pi, covs_pi, la, lo, lon0, lon1, lat0, lat1)
        if dades:
            fp, file_dt, file_size = guardar_hora(dades, s, run_ref_pi, lon2d, lat2d, nom, lon0, lon1, lat0, lat1)
            fname = os.path.basename(fp)
            with lock:
                files.append(fp)
                status["files"][fname] = file_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

            if bloc_id == 1:
                progress_bar_obj.update_bar1(1, file_size, success=True)
            else:
                progress_bar_obj.update_bar2(1, file_size, success=True)

            print_log(f"  [{bloc_label}] Step {s:02d}: {fname} ({format_size(file_size)}) ✅")
        else:
            failed_count += 1
            if bloc_id == 1:
                progress_bar_obj.update_bar1(1, 0, success=False)
            else:
                progress_bar_obj.update_bar2(1, 0, success=False)
            print_log(f"  [{bloc_label}] Step {s:02d}: no data ❌")
        time.sleep(2)

    ok_count = bloc_total - failed_count
    if failed_count > 0:
        print_log(f"[{bloc_label}] COMPLETAT: {ok_count}✅ / {failed_count}❌ / {bloc_total} tot ⚠️")
    else:
        print_log(f"[{bloc_label}] COMPLETAT: {ok_count}/{bloc_total} OK ✅")
    
    return ok_count, failed_count


def processar_zona(zona, run_ref_pi, covs_pi, status_inicial):
    nom = zona["name"]
    lon0, lon1 = zona["lon_min"], zona["lon_max"]
    lat0, lat1 = zona["lat_min"], zona["lat_max"]
    
    print(LOGO_PROCESS)
    print_log(f"📍 {Colors.BOLD}{nom}{Colors.END}")
    print_log(f"   📐 Grid: {cfg.n_sfc}x{cfg.n_sfc}")
    
    la, lo, lon2d, lat2d = grid(cfg.n_sfc, lon0, lon1, lat0, lat1)
    n_steps = cfg.fc_minutes_max // cfg.fc_step + 1
    print_log(f"   🔢 Steps: {n_steps} (0-{cfg.fc_minutes_max} min)")

    idx_fp = guardar_index(run_ref_pi, n_steps, lon2d, lat2d, nom, lon0, lon1, lat0, lat1)
    print_log(f"📑 Index creat: {os.path.basename(idx_fp)}")

    files = [idx_fp]
    status = {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "files": {}}

    mid = n_steps // 2
    bloc1 = list(range(0, mid))
    bloc2 = list(range(mid, n_steps))

    lock = threading.Lock()
    zone_start = time.time()

    print(f"\n{Colors.CYAN}{'='*70}{Colors.END}")
    print(f"  📡 {Colors.BOLD}{nom}{Colors.END}: Descarregant en 2 BLOCS PARAL·LELS")
    print(f"     {Colors.BLUE}🔵 Bloc 1:  0min → {mid*cfg.fc_step}min  ({len(bloc1)} passos){Colors.END}")
    print(f"     {Colors.ORANGE}🟠 Bloc 2: {mid*cfg.fc_step}min → {cfg.fc_minutes_max}min ({len(bloc2)} passos){Colors.END}")
    print(f"{Colors.CYAN}{'='*70}{Colors.END}")
    print("\n")

    progress_bars = DoubleProgressBar(
        total1=len(bloc1),
        total2=len(bloc2),
        label1=f"{Colors.BLUE}🔵 Bloc 1 [0-{mid*cfg.fc_step}min]{Colors.END}",
        label2=f"{Colors.ORANGE}🟠 Bloc 2 [{mid*cfg.fc_step}-{cfg.fc_minutes_max}min]{Colors.END}"
    )

    ok_total = 0
    fail_total = 0

    with ThreadPoolExecutor(max_workers=2) as ex:
        fut1 = ex.submit(_processar_bloc, 1, bloc1, run_ref_pi, covs_pi, la, lo, lon0, lon1, lat0, lat1,
                         nom, lon2d, lat2d, files, status, lock, progress_bars, n_steps)
        fut2 = ex.submit(_processar_bloc, 2, bloc2, run_ref_pi, covs_pi, la, lo, lon0, lon1, lat0, lat1,
                         nom, lon2d, lat2d, files, status, lock, progress_bars, n_steps)

        ok1, fail1 = fut1.result()
        ok2, fail2 = fut2.result()
        ok_total = ok1 + ok2
        fail_total = fail1 + fail2

    progress_bars.finish()

    total_size = sum(os.path.getsize(f) for f in files if os.path.exists(f))
    elapsed = time.time() - zone_start
    
    print(f"\n{Colors.GREEN}{'='*70}{Colors.END}")
    print(f"  ✅ {Colors.BOLD}{nom}{Colors.END}: {len(files)} fitxers | {format_size(total_size)} | {elapsed/60:.1f} min")
    print(f"{Colors.GREEN}{'='*70}{Colors.END}\n")

    status_path = os.path.join(cfg.out, "status.json")
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(status, f, indent=2, ensure_ascii=False)
    print_log(f"📊 Status JSON: {os.path.basename(status_path)}")

    return files, ok_total, fail_total


def main():
    print(LOGO_START)
    log.info("AROME-PI FINAL v3.3 - Status JS al inici")
    log.info("="*50)

    # Netejar carpeta de sortida
    netejar_carpeta_output()

    # Buscar run disponible
    print("\n🔍 Buscant run disponible...")
    run_ref_pi, covs_pi = esperar_run_disponible()
    print_log(f"🛰️  Run seleccionat: {run_ref_pi.strftime('%Y-%m-%d %H:%MZ')}")

    # CREAR STATUS INICIAL (IN_PROGRESS)
    status_inicial = crear_status_inicial(run_ref_pi, covs_pi)

    start_time = time.time()
    total_files = []
    total_ok = 0
    total_fail = 0
    n_steps_total = 0

    # Processar zones
    for zona in REGIONS:
        try:
            start = time.time()
            fps, ok_count, fail_count = processar_zona(zona, run_ref_pi, covs_pi, status_inicial)
            elapsed = time.time() - start
            
            total_files.extend(fps)
            total_ok += ok_count
            total_fail += fail_count
            n_steps_total += len(fps) - 1  # Restem l'index
            
            print_log(f"✅ Zona completada: {len(fps)} fitxers en {elapsed/60:.1f} min")
        except Exception as e:
            print_log(f"❌ Error a {zona['name']}: {e}")
            import traceback
            traceback.print_exc()

    # ACTUALITZAR STATUS FINAL (COMPLETAT)
    elapsed_total = time.time() - start_time
    actualitzar_status_final(status_inicial, total_files, elapsed_total, n_steps_total, total_ok, total_fail)
    
    if glob.glob(os.path.join(cfg.out, "*.js")):
        print_log("✅ Tots els fitxers generats correctament")
        print(LOGO_COMPLETE)
    else:
        print_log("⚠️ No s'ha generat cap fitxer")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️ Procés interromput per l'usuari")
        sys.exit(0)