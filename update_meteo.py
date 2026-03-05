import json, os, sys, time, math
from datetime import datetime, timezone
import requests
import numpy as np

# ─────────────────────────────────────────────
#  COLORS ANSI
# ─────────────────────────────────────────────
<<<<<<< HEAD
R="\033[0m"; B="\033[1m"; D="\033[2m"
RED="\033[91m"; GRN="\033[92m"; YLW="\033[93m"; CYN="\033[96m"; WHT="\033[97m"
=======
R  = "\033[0m"
B  = "\033[1m"
D  = "\033[2m"
RED    = "\033[91m"
GRN    = "\033[92m"
YLW    = "\033[93m"
CYN    = "\033[96m"
WHT    = "\033[97m"

# ─────────────────────────────────────────────
#  HELPERS DE TERMINAL
# ─────────────────────────────────────────────
def cls():
    sys.stdout.write("\033[2K\r")
    sys.stdout.flush()

def fmt_time(s):
    if s < 0 or s > 86400: return "..."
    if s < 60: return f"{int(s)}s"
    return f"{int(s//60)}m {int(s%60):02d}s"

def fmt_size(b):
    if b < 1024: return f"{b} B"
    if b < 1024**2: return f"{b/1024:.1f} KB"
    return f"{b/1024**2:.2f} MB"

def draw_bar(current, total, errors=0, fatal=0, eta="", label=""):
    W = 38
    pct = current / total if total else 0
    filled = int(W * pct)
    empty  = W - filled
    col = RED if fatal > 0 else (YLW if errors > 0 else GRN)
    bar   = f"{col}{B}{'█' * filled}{R}{D}{'░' * empty}{R}"
    pct_s = f"{B}{WHT}{pct*100:5.1f}%{R}"
    cnt_s = f"{D}({current}/{total}){R}"
    eta_s = f"  {CYN}ETA {eta}{R}" if eta else ""
    err_s = f"  {YLW}⚠ {errors}err{R}" if errors > 0 else ""
    fat_s = f"  {RED}{B}✗ {fatal} perduts{R}" if fatal > 0 else ""
    lbl_s = f"  {D}{label}{R}" if label else ""
    sys.stdout.write(f"\r  [{bar}] {pct_s} {cnt_s}{eta_s}{err_s}{fat_s}{lbl_s}   ")
    sys.stdout.flush()

def warn(msg, paquet=None, intent=None):
    cls()
    parts = []
    if paquet is not None: parts.append(f"paquet {paquet+1}")
    if intent is not None: parts.append(f"intent {intent+1}")
    loc = f"{YLW}[{', '.join(parts)}]{R} " if parts else ""
    print(f"  {YLW}⚠  {loc}{msg}{R}")

def fatal_warn(msg):
    cls()
    print(f"  {RED}{B}✗  FATAL: {msg}{R}")

def info(k, v, c=WHT):
    print(f"  {D}│{R}  {CYN}{k:<22}{R} {c}{B}{v}{R}")

def section(title):
    print(f"\n  {YLW}{B}▶ {title}{R}")
    print(f"  {D}{'─'*52}{R}")
>>>>>>> b3c3621ff00acb0cc6d8f49accb4e7592f25f212

# ─────────────────────────────────────────────
#  CONFIGURACIÓ
# ─────────────────────────────────────────────
LON_MIN, LON_MAX = -4.6, 4.0
LAT_MIN, LAT_MAX = 38.5, 42.9
N_GRID        = 40       # ← 50×50 = 2500 punts
MODEL         = "arome_seamless"
URL_BASE      = "https://api.open-meteo.com/v1/meteofrance"
FORECAST_DAYS = 2
<<<<<<< HEAD
CHUNK_SIZE    = 5     # ← reduït a 5: paquets més petits = menys timeout
SLEEP_OK      = 4.0  # entre paquets normals
SLEEP_ERR     = 8.0  # després d'un error
=======
CHUNK_SIZE    = 6           # menys paquets totals → 417 en comptes de 625
SLEEP         = 8.0         # més espera entre paquets → evita 429
>>>>>>> b3c3621ff00acb0cc6d8f49accb4e7592f25f212
MAX_ATTEMPTS  = 5
TIMEOUT       = 90   # més generós

LEVELS = [
    "1000hPa","950hPa","925hPa","900hPa","850hPa",
    "800hPa","700hPa","600hPa","500hPa",
    "400hPa","300hPa","250hPa","200hPa","150hPa","100hPa",
]

# ── PASSADA 1: només superfície ──────────────
VARS_SFC = {
    "temperature_2m":       "temperature",
    "relative_humidity_2m": "relative_humidity",
    "dew_point_2m":         "dew_point",
    "precipitation":        "rain",
    "snowfall":             "snowfall",
    "wind_speed_10m":       "wind_speed",
    "wind_direction_10m":   "wind_direction",
    "wind_gusts_10m":       "wind_gusts",
    "cape":                 "cape",
    "surface_pressure":     "surface_pressure",
}

# ── PASSADA 2: nivells de pressió ────────────
VARS_PL = {
    "temperature":       "temperature",
    "relative_humidity": "relative_humidity",
    "dew_point":         "dew_point",
    "wind_speed":        "wind_speed",
    "wind_direction":    "wind_direction",
}

# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────
def fmt_time(s):
    if s < 0 or s > 86400: return "..."
    if s < 60: return f"{int(s)}s"
    return f"{int(s//60)}m {int(s%60):02d}s"

def fmt_size(b):
    if b < 1024**2: return f"{b/1024:.1f} KB"
    return f"{b/1024**2:.2f} MB"

def info(k, v, c=WHT):
    print(f"  {D}│{R}  {CYN}{k:<24}{R} {c}{B}{v}{R}")

def section(t):
    print(f"\n  {YLW}{B}▶ {t}{R}")
    print(f"  {D}{'─'*54}{R}")

def draw_bar(cur, tot, nerr=0, nfat=0, eta="", lbl=""):
    W   = 36
    pct = cur/tot if tot else 0
    col = RED if nfat>0 else (YLW if nerr>0 else GRN)
    bar = f"{col}{B}{'█'*int(W*pct)}{R}{D}{'░'*(W-int(W*pct))}{R}"
    parts = [f"\r  [{bar}] {B}{WHT}{pct*100:5.1f}%{R} {D}({cur}/{tot}){R}"]
    if eta:   parts.append(f"  {CYN}ETA {eta}{R}")
    if nerr:  parts.append(f"  {YLW}⚠ {nerr}err{R}")
    if nfat:  parts.append(f"  {RED}{B}✗ {nfat} perduts{R}")
    if lbl:   parts.append(f"  {D}{lbl}{R}")
    sys.stdout.write("".join(parts) + "   ")
    sys.stdout.flush()

def warn(msg, idx=None, att=None):
    sys.stdout.write("\033[2K\r")
    loc = ""
    if idx is not None: loc += f"paquet {idx+1}"
    if att is not None: loc += f", intent {att+1}"
    print(f"  {YLW}⚠  [{loc}] {msg}{R}")

def fatal(msg):
    sys.stdout.write("\033[2K\r")
    print(f"  {RED}{B}✗  FATAL: {msg}{R}")

# ─────────────────────────────────────────────
#  DESCÀRREGA D'UNA PASSADA
#  passada: 'sfc' o 'pl'
# ─────────────────────────────────────────────
<<<<<<< HEAD
def download_pass(lats_flat, lons_flat, passada, prev_results=None):
    total_punts  = len(lats_flat)
    total_chunks = math.ceil(total_punts / CHUNK_SIZE)
    results      = {}
    n_errors     = 0
    n_fatal      = 0
    t0           = time.time()

    empty_arr = [None] * (FORECAST_DAYS * 24)
=======
def main():
    total_punts  = N_GRID * N_GRID
    total_chunks = (total_punts + CHUNK_SIZE - 1) // CHUNK_SIZE
    eta_total    = total_chunks * (SLEEP + 2)  # estimació conservadora

    print()
    print(f"  {CYN}{B}╔══════════════════════════════════════════════════════╗{R}")
    print(f"  {CYN}{B}║       TEMPESTES.CAT  —  DESCÀRREGA AROME             ║{R}")
    print(f"  {CYN}{B}╚══════════════════════════════════════════════════════╝{R}")
    print()
    info("Model",         "AROME Seamless",                           CYN)
    info("Zona",          f"{LAT_MIN}–{LAT_MAX}°N  {LON_MIN}–{LON_MAX}°E", WHT)
    info("Graella",       f"{N_GRID}×{N_GRID} = {total_punts} punts", GRN)
    info("Paquets API",   f"{total_chunks}  ({CHUNK_SIZE} punts/paquet)", WHT)
    info("Sleep",         f"{SLEEP}s entre paquets",                  DIM if False else WHT)
    info("Temps estimat", f"~{fmt_time(eta_total)} (sense errors)",   YLW)
    print(f"  {D}{'─'*52}{R}")

    lats_flat = np.round(np.meshgrid(
        np.linspace(LON_MIN, LON_MAX, N_GRID),
        np.linspace(LAT_MIN, LAT_MAX, N_GRID)
    )[1].flatten(), 4)
    lons_flat = np.round(np.meshgrid(
        np.linspace(LON_MIN, LON_MAX, N_GRID),
        np.linspace(LAT_MIN, LAT_MAX, N_GRID)
    )[0].flatten(), 4)

    # ── DESCÀRREGA ────────────────────────────
    section("DESCÀRREGA")
    print()

    results_dict = {}
    t0       = time.time()
    n_errors = 0
    n_fatal  = 0
>>>>>>> b3c3621ff00acb0cc6d8f49accb4e7592f25f212

    for idx in range(total_chunks):
        s  = idx * CHUNK_SIZE
        e  = min(s + CHUNK_SIZE, total_punts)
        cl = lats_flat[s:e].tolist()
        co = lons_flat[s:e].tolist()
        ci = list(range(s, e))

        elapsed = time.time() - t0
        eta = fmt_time((elapsed/idx)*(total_chunks-idx)) if idx > 0 else ""
        draw_bar(idx, total_chunks, n_errors, n_fatal, eta, f"passada {passada}...")

        # Construir params segons passada
        if passada == 'sfc':
            hourly_str = ",".join(VARS_SFC.keys())
        else:
            # Nivells de pressió: dividits en 2 subpassades per no sobrecarregar
            pl_vars = []
            for lvl in LEVELS:
                for v in VARS_PL.keys():
                    pl_vars.append(f"{v}_{lvl}")
            hourly_str = ",".join(pl_vars)

        params = {
            "latitude":      cl,
            "longitude":     co,
            "hourly":        hourly_str,
            "models":        MODEL,
            "forecast_days": FORECAST_DAYS,
            "timezone":      "auto",
        }

        ok   = False
        data = None

        for att in range(MAX_ATTEMPTS):
            try:
<<<<<<< HEAD
                r = requests.get(URL_BASE, params=params, timeout=TIMEOUT)

                if r.status_code == 429:
                    # Rate limit — pausa llarga progressiva
                    w = 90 * (att + 1)  # 90s, 180s, 270s...
=======
                r = requests.get(URL_BASE, params=params, timeout=45)

                if r.status_code == 429:
>>>>>>> b3c3621ff00acb0cc6d8f49accb4e7592f25f212
                    n_errors += 1
                    # Llegir missatge de l'API
                    try:
                        err_body = r.json()
                        err_msg  = err_body.get('reason', err_body.get('error', str(err_body))).lower()
                    except Exception:
                        err_msg = (r.text[:300] if r.text else "").lower()

                    # Detectar tipus de límit
                    if 'daily' in err_msg or 'day' in err_msg:
                        cls()
                        print(f"\n  {RED}{B}╔══════════════════════════════════════════════════════╗{R}")
                        print(f"  {RED}{B}║   ✗  LÍMIT DIARI EXHAURIT — ACTUALITZACIÓ CANCEL·LADA  ║{R}")
                        print(f"  {RED}{B}╚══════════════════════════════════════════════════════╝{R}")
                        print(f"\n  {WHT}Missatge API:{R} {YLW}{err_msg}{R}")
                        print(f"  {D}Torna a executar demà quan es reinicia el comptador.{R}\n")
                        sys.exit(1)

                    elif 'minute' in err_msg or 'minutely' in err_msg:
                        wait = 90
                        tipo = f"{YLW}límit/minut{R}"
                    else:
                        # Hourly o desconegut → esperar 1h
                        wait = 3600
                        tipo = f"{YLW}límit/hora{R}"

                    cls()
                    print(f"  {YLW}⚠  [paquet {idx+1}] Rate limit 429 ({tipo}): {err_msg[:80]}{R}")

                    # Countdown visual en una sola línia
                    t_wait = time.time()
                    while True:
                        remaining = int(wait - (time.time() - t_wait))
                        if remaining <= 0: break
                        mins, secs = divmod(remaining, 60)
                        bar_w   = 30
                        elapsed_w = wait - remaining
                        filled_w  = int(bar_w * elapsed_w / wait)
                        bar_str = f"{GRN}{'█' * filled_w}{D}{'░' * (bar_w - filled_w)}{R}"
                        sys.stdout.write(f"\r  {D}esperant [{bar_str}] {CYN}{mins:02d}:{secs:02d}{R}   ")
                        sys.stdout.flush()
                        time.sleep(1)
                    cls()
                    continue

                if r.status_code >= 500:
                    w = 30 * (att + 1)
                    n_errors += 1
                    warn(f"Error servidor ({r.status_code}) — esperant {w}s", idx, att)
                    time.sleep(w)
                    continue

                r.raise_for_status()
                data = r.json()

                if isinstance(data, dict) and "hourly" not in data:
                    raise ValueError("Resposta sense 'hourly'")
                if isinstance(data, list) and len(data) == 0:
                    raise ValueError("Llista buida")

                ok = True
                break

            except requests.exceptions.Timeout:
                w = 30 * (att + 1)
                n_errors += 1
                warn(f"Timeout — esperant {w}s", idx, att)
                time.sleep(w)

            except requests.exceptions.ConnectionError:
<<<<<<< HEAD
                w = 45 * (att + 1)
=======
                w = 25 * (att + 1)
>>>>>>> b3c3621ff00acb0cc6d8f49accb4e7592f25f212
                n_errors += 1
                warn(f"Connexió perduda — esperant {w}s", idx, att)
                time.sleep(w)

<<<<<<< HEAD
=======
            except requests.exceptions.HTTPError as ex:
                w = 10 * (att + 1)
                n_errors += 1
                warn(f"HTTP {ex} — esperant {w}s", idx, att)
                time.sleep(w)

            except ValueError as ex:
                n_errors += 1
                warn(f"Dades invàlides: {ex}", idx, att)
                time.sleep(5)

>>>>>>> b3c3621ff00acb0cc6d8f49accb4e7592f25f212
            except Exception as ex:
                n_errors += 1
                warn(f"{type(ex).__name__}: {ex}", idx, att)
                time.sleep(10)

        if ok and data is not None:
            items = data if isinstance(data, list) else [data]
            for j, dp in enumerate(items):
                if j < len(ci):
                    results[ci[j]] = dp
        else:
            n_fatal += 1
            fatal(f"Paquet {idx+1} perdut ({len(ci)} punts s'interpolaran)")
            for ip in ci:
                results[ip] = None

<<<<<<< HEAD
        # Sleep adaptatiu — si hi ha hagut errors recents, espera més
        time.sleep(SLEEP_ERR if n_errors > 0 and idx < 5 else SLEEP_OK)
=======
        time.sleep(SLEEP)
>>>>>>> b3c3621ff00acb0cc6d8f49accb4e7592f25f212

    draw_bar(total_chunks, total_chunks, n_errors, n_fatal, "", "completat!")
    print("\n")
    return results, n_errors, n_fatal

<<<<<<< HEAD
# ─────────────────────────────────────────────
#  REPARAR FORATS
# ─────────────────────────────────────────────
def repair_holes(results, lats_flat, lons_flat):
    failed = [i for i, v in results.items() if v is None]
    if not failed:
        return results, 0
    repaired = 0
    for fi in failed:
        row, col = divmod(fi, N_GRID)
        nearest  = None
        for d in range(1, 8):
            best_dist = float('inf')
            for dr in range(-d, d+1):
                for dc in range(-d, d+1):
                    nr, nc = row+dr, col+dc
                    if 0 <= nr < N_GRID and 0 <= nc < N_GRID:
                        ni = nr*N_GRID + nc
                        if results.get(ni) is not None:
                            dist = abs(lats_flat[ni]-lats_flat[fi]) + abs(lons_flat[ni]-lons_flat[fi])
                            if dist < best_dist:
                                best_dist, nearest = dist, results[ni]
            if nearest: break
        if nearest:
            results[fi] = nearest
            repaired += 1
    return results, repaired
=======
    elapsed_total = time.time() - t0
    ok_count = sum(1 for v in results_dict.values() if v is not None)
    info("Paquets OK",        f"{ok_count}/{total_punts}", GRN if n_fatal == 0 else YLW)
    info("Errors recuperats", str(n_errors), GRN if n_errors == 0 else YLW)
    info("Paquets perduts",   str(n_fatal),  GRN if n_fatal  == 0 else RED)
    info("Temps descàrrega",  fmt_time(elapsed_total), WHT)
>>>>>>> b3c3621ff00acb0cc6d8f49accb4e7592f25f212

# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    print()
    print(f"  {CYN}{B}╔══════════════════════════════════════════════════════╗{R}")
    print(f"  {CYN}{B}║       TEMPESTES.CAT  —  DESCÀRREGA AROME  v2         ║{R}")
    print(f"  {CYN}{B}╚══════════════════════════════════════════════════════╝{R}")
    print()

    lats_flat = np.round(np.meshgrid(
        np.linspace(LON_MIN, LON_MAX, N_GRID),
        np.linspace(LAT_MIN, LAT_MAX, N_GRID)
    )[1].flatten(), 4)
    lons_flat = np.round(np.meshgrid(
        np.linspace(LON_MIN, LON_MAX, N_GRID),
        np.linspace(LAT_MIN, LAT_MAX, N_GRID)
    )[0].flatten(), 4)

    total_punts  = len(lats_flat)
    total_chunks = math.ceil(total_punts / CHUNK_SIZE)

    info("Model",         "AROME Seamless",                          CYN)
    info("Zona",          f"{LAT_MIN}–{LAT_MAX}°N  {LON_MIN}–{LON_MAX}°E", WHT)
    info("Graella",       f"{N_GRID}×{N_GRID} = {total_punts} punts",     GRN)
    info("Paquets/passa", f"{total_chunks}  ({CHUNK_SIZE} pts/paquet)",    WHT)
    info("Passades",      "2  (superfície + nivells pressió)",             YLW)
    info("Temps estimat", "~45min – 1h 15min",                             GRN)
    print(f"  {D}{'─'*54}{R}")

    t_total = time.time()

    # ══ PASSADA 1: SUPERFÍCIE ════════════════
    section("PASSADA 1/2 — SUPERFÍCIE")
    print()
    res_sfc, err_sfc, fat_sfc = download_pass(lats_flat, lons_flat, 'sfc')

    info("Errors superfície", str(err_sfc), GRN if err_sfc==0 else YLW)
    info("Perduts superfície", str(fat_sfc), GRN if fat_sfc==0 else RED)

    if fat_sfc > 0:
        print(f"\n  {YLW}⟲ Reparant forats superfície...{R}")
        res_sfc, rep = repair_holes(res_sfc, lats_flat, lons_flat)
        print(f"  {GRN}✓ Reparats {rep}/{fat_sfc}{R}")

    # Pausa entre passades per deixar refredar l'API
    print(f"\n  {D}Pausa 30s entre passades per evitar rate limit...{R}")
    time.sleep(30)

    # ══ PASSADA 2: NIVELLS DE PRESSIÓ ════════
    section("PASSADA 2/2 — NIVELLS DE PRESSIÓ")
    print()
    res_pl, err_pl, fat_pl = download_pass(lats_flat, lons_flat, 'pl')

    info("Errors pressió", str(err_pl), GRN if err_pl==0 else YLW)
    info("Perduts pressió", str(fat_pl), GRN if fat_pl==0 else RED)

    if fat_pl > 0:
        print(f"\n  {YLW}⟲ Reparant forats pressió...{R}")
        res_pl, rep = repair_holes(res_pl, lats_flat, lons_flat)
        print(f"  {GRN}✓ Reparats {rep}/{fat_pl}{R}")

    # ══ CONSTRUCCIÓ JSON ══════════════════════
    section("CONSTRUCCIÓ DEL FITXER")
    print()

    expected_hours = FORECAST_DAYS * 24
    empty_arr      = [None] * expected_hours

    final_json = {
        "meta": {
            "model": "AROME",
            "extent": [LON_MIN, LON_MAX, LAT_MIN, LAT_MAX],
            "resolution": f"{N_GRID}x{N_GRID}",
            "n_grid": N_GRID,
            "surface_pressure": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "lats": lats_flat.tolist(),
        "lons": lons_flat.tolist(),
        "hourly": {"surface": {k: [] for k in VARS_SFC.values()}},
    }
    for lvl in LEVELS:
        final_json["hourly"][lvl] = {k: [] for k in VARS_PL.values()}

    for pt in range(total_punts):
        draw_bar(pt+1, total_punts, label="construint JSON...")

        sfc = res_sfc.get(pt)
        pl  = res_pl.get(pt)

        # Superfície
        h_sfc = sfc["hourly"] if sfc and "hourly" in sfc else {}
        for ak, jk in VARS_SFC.items():
            arr = h_sfc.get(ak, empty_arr)
            final_json["hourly"]["surface"][jk].append(
                [round(x,1) if isinstance(x,(int,float)) else x for x in arr])

        sp = h_sfc.get("surface_pressure", [])
        final_json["meta"]["surface_pressure"].append(
            round(sp[0],1) if sp and sp[0] is not None else 1013)

        # Nivells pressió
        h_pl = pl["hourly"] if pl and "hourly" in pl else {}
        for lvl in LEVELS:
            for ak, jk in VARS_PL.items():
                arr = h_pl.get(f"{ak}_{lvl}", empty_arr)
                final_json["hourly"][lvl][jk].append(
                    [round(x,1) if isinstance(x,(int,float)) else x for x in arr])

    print("\n")

    # ══ GUARDAR ══════════════════════════════
    os.makedirs("web_data", exist_ok=True)
    js_path = os.path.join("web_data", "dades.js")
    print(f"  {D}Guardant {js_path}...{R}", end=" ", flush=True)
    try:
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write("const DADES_CAT = ")
            json.dump(final_json, f, separators=(',',':'))
            f.write(";")
        mida = os.path.getsize(js_path)
        print(f"{GRN}{B}✓{R}  {D}({fmt_size(mida)}){R}")
    except Exception as ex:
        print(f"{RED}✗  Error guardant: {ex}{R}")
        sys.exit(1)

    # ══ RESUM FINAL ══════════════════════════
    temps_total = time.time() - t_total
    n_errors = err_sfc + err_pl
    n_fatal  = fat_sfc + fat_pl
    c_box = GRN if n_fatal == 0 else YLW

    print()
    print(f"  {c_box}{B}╔══════════════════════════════════════════════════════╗{R}")
    print(f"  {c_box}{B}║                ✓  COMPLETAT!                         ║{R}")
    print(f"  {c_box}{B}╚══════════════════════════════════════════════════════╝{R}")
    print()
    info("Fitxer",        js_path,                                    GRN)
    info("Mida",          fmt_size(os.path.getsize(js_path)),          WHT)
<<<<<<< HEAD
    info("Resolució",     f"{N_GRID}×{N_GRID} = {total_punts} punts",  CYN)
    info("Temps total",   fmt_time(temps_total),                       WHT)
    info("Errors totals", str(n_errors), GRN if n_errors==0 else YLW)
    info("Perduts",       str(n_fatal),  GRN if n_fatal==0  else RED)
=======
    info("Resolució",     f"{N_GRID}×{N_GRID} = {total_punts} punts", CYN)
    info("Temps total",   fmt_time(temps_total),                       WHT)
    info("Errors totals", str(n_errors), GRN if n_errors == 0 else YLW)
    info("Perduts",       str(n_fatal),  GRN if n_fatal  == 0 else RED)
>>>>>>> b3c3621ff00acb0cc6d8f49accb4e7592f25f212
    if n_fatal > 0:
        cob = 100 * (1 - n_fatal * CHUNK_SIZE / total_punts)
        info("Cobertura", f"{cob:.1f}%", YLW)
    else:
        info("Cobertura", "100% — sense forats", GRN)
    print()

if __name__ == "__main__":
    main()