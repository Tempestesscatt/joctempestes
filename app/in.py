#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
arome_grele_catalunya.py
-------------------------------
Genera fitxers msgpack.gz amb el DIAGNOSTIC DE GRANIS (DIAG_GRELE) de l'AROME
per a CATALUNYA, un fitxer per hora, amb el mateix estil que els mapes GFS
(bandes de contorn + isolinies en poligons llestos per pintar).

Nom de sortida: grele_d{dia:02d}_h{hora:02d}.msgpack.gz
Sortida a:      C:\\Users\\simob\\Documents\\GitHub\\Radarlluviacat\\app\\dades_anim

Font de dades: API WCS de Meteo-France (AROME 0.025 graus, variable
DIAG_GRELE__GROUND), igual que a l'script d'outbreak de Catalunya.

Us:
    python arome_grele_catalunya.py --start-hora 20 --end-hora 40
    python arome_grele_catalunya.py --start-hora 10 --end-hora 21 --api-key TA_CLAU

El rang d'hores es sempre en "steps" del run (hores de previsio, FXX),
no en hora local. Per exemple --start-hora 20 --end-hora 40 vol dir
els steps +20h a +40h del run mes recent trobat.
"""

import argparse
import gzip
import io
import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import requests
import tifffile
import matplotlib.pyplot as plt
import msgpack
from requests.adapters import HTTPAdapter

# ============================================================
# CONFIG
# ============================================================

def carregar_config():
    d = os.path.dirname(os.path.abspath(__file__))
    path_cfg = os.path.join(d, "configAVIS.json")
    cfg = {}
    if os.path.exists(path_cfg):
        with open(path_cfg, encoding="utf-8-sig") as f:
            cfg = json.load(f)

    class C:
        pass

    c = C()
    c.key = cfg.get("api_key", "")
    c.to = cfg.get("http", {}).get("timeout_seconds", 90)
    return c

CFG = carregar_config()

# ============================================================
# CONSTANTS
# ============================================================

WCS_SERVICE = "MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS"
WCS_BASE_URL = f"https://public-api.meteofrance.fr/public/arome/1.0/wcs/{WCS_SERVICE}"

VAR_GRELE = {
    "id": "DIAG_GRELE__GROUND",
    "llindar": 9000,
    "label": "Risc de calamarsa",
}

# Domini Catalunya (mateix que a l'script d'outbreak)
DOMINI = {
    "lon_min": 0.0, "lon_max": 3.4,
    "lat_min": 40.4, "lat_max": 42.9,
    "w": 400, "h": 380,
}

# DIAG_GRELE es un index brut (aprox. 0-40), NO un percentatge.
# Es guarda tal qual (sense normalitzar) perque el front (mapa-grele.js)
# apliqui els seus propis llindars per comarca: 5/10/20/30.
GRELE_INDEX_MAX_ESPERAT = 40.0  # nomes orientatiu, per la nostra propia escala de contorns

OUTPUT_DIR_DEFAULT = r"C:\Users\simob\Documents\GitHub\Radarlluviacat\app\dades_anim"

MAX_REINTENTS = 5
ESPERA_ENTRE_REINTENTS = 5
ESPERA_ENTRE_PETICIONS = 3
ESPERA_429_SEGONS = 120
ESPERA_429_MAX_INTENTS = 3

HORES_POSSIBLES_RUN = [0, 3, 6, 9, 12, 15, 18, 21]

# ============================================================
# UTILS
# ============================================================

def format_time(s):
    if s < 60:
        return f"{s:.0f}s"
    elif s < 3600:
        return f"{int(s // 60)}m {int(s % 60)}s"
    else:
        return f"{int(s // 3600)}h {int((s % 3600) // 60)}m"


def a_percentatge(valor_bruto, escala_max):
    return np.clip((valor_bruto / escala_max) * 100.0, 0, 100)

# ============================================================
# TROBAR EL RUN MES RECENT DISPONIBLE (AROME)
# ============================================================

def trobar_millor_run(max_step_necessari):
    """
    Busca el run mes recent d'AROME que, sumat al step maxim demanat,
    sigui un step valid (<= 51h, que es el maxim d'AROME 0.025).
    Es comprova la disponibilitat fent servir el mateix patro de fitxers
    SP1 que fa servir meteofetch/Arome0025.
    """
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_

    print(f"\n  Buscant el RUN MES RECENT que cobreixi fins a +{max_step_necessari}h...")
    now_utc = datetime.now(ZoneInfo("UTC"))

    for dies_enrere in range(0, 3):
        dt = (now_utc - timedelta(days=dies_enrere)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        for h in sorted(HORES_POSSIBLES_RUN, reverse=True):
            dt_run = dt.replace(hour=h)
            if dt_run > now_utc + timedelta(hours=1):
                continue
            if max_step_necessari > 51:
                continue

            run_str = dt_run.strftime("%Y-%m-%dT%H")
            url_test = (
                f"{base_url}/{run_str}:00:00Z/arome/0025/SP1/"
                f"arome__0025__SP1__00H06H__{run_str}:00:00Z.grib2"
            )
            try:
                if requests.head(url_test, timeout=10).status_code == 200:
                    print(f"    Run trobat: {run_str}Z")
                    return dt_run
            except Exception:
                pass

    sys.exit("Cap run d'AROME disponible.")

# ============================================================
# DESCARREGA D'UNA TILE WCS (DIAG_GRELE)
# ============================================================

def descarregar_tile_wcs(session, run_str, time_str, intent=1, intents_429=0):
    cov_id = f"{VAR_GRELE['id']}___{run_str}"

    url = (
        f"{WCS_BASE_URL}/GetCoverage?SERVICE=WCS&VERSION=2.0.1"
        f"&COVERAGEID={cov_id}"
        f"&FORMAT=image/tiff"
        f"&SUBSET=long({DOMINI['lon_min']},{DOMINI['lon_max']})"
        f"&SUBSET=lat({DOMINI['lat_min']},{DOMINI['lat_max']})"
        f"&SUBSET=time({time_str})"
        f"&SCALESIZE=long({DOMINI['w']})&SCALESIZE=lat({DOMINI['h']})"
    )

    try:
        r = session.get(url, timeout=CFG.to)

        if r.status_code == 429:
            if intents_429 < ESPERA_429_MAX_INTENTS:
                print(f"\n      HTTP 429. Esperant {ESPERA_429_SEGONS}s...", flush=True)
                time.sleep(ESPERA_429_SEGONS)
                return descarregar_tile_wcs(session, run_str, time_str, intent, intents_429 + 1)
            return None, "HTTP 429", None

        if r.status_code in (502, 503, 504):
            if intent < MAX_REINTENTS:
                espera = ESPERA_ENTRE_REINTENTS * intent
                print(f"\n      HTTP {r.status_code}. Reintentant en {espera}s...", flush=True)
                time.sleep(espera)
                return descarregar_tile_wcs(session, run_str, time_str, intent + 1, intents_429)
            return None, f"HTTP {r.status_code}", None

        if r.status_code != 200:
            return None, f"HTTP {r.status_code}", None
        if len(r.content) < 1000:
            return None, "Contingut petit", None

        arr = tifffile.imread(io.BytesIO(r.content))
        if arr.ndim == 3:
            arr = arr[0]
        arr = arr.astype(np.float64)
        arr[arr > VAR_GRELE["llindar"]] = np.nan

        if np.sum(~np.isnan(arr)) < 10:
            return None, "Poques dades", None

        coords = None
        try:
            with tifffile.TiffFile(io.BytesIO(r.content)) as tif:
                page = tif.pages[0]
                tiepoint = pixelscale = None
                for tag in page.tags:
                    if tag.name == "ModelTiepointTag":
                        tiepoint = tag.value
                    elif tag.name == "ModelPixelScaleTag":
                        pixelscale = tag.value
                if tiepoint and pixelscale:
                    lon_origen = float(tiepoint[3])
                    lat_origen = float(tiepoint[4])
                    res_x = float(pixelscale[0])
                    res_y = float(pixelscale[1])
                    h_real, w_real = arr.shape
                    lons_src = lon_origen + (np.arange(w_real) + 0.5) * res_x
                    lats_src = lat_origen - (np.arange(h_real) + 0.5) * res_y
                    coords = (lons_src, lats_src)
        except Exception:
            pass

        return arr, "OK", coords

    except Exception as e:
        if intent < MAX_REINTENTS:
            time.sleep(ESPERA_ENTRE_REINTENTS * intent)
            return descarregar_tile_wcs(session, run_str, time_str, intent + 1, intents_429)
        return None, f"Error: {str(e)[:40]}", None

# ============================================================
# CONTORNS -> POLIGONS (mateixa logica que l'script GFS)
# ============================================================

def _contourf_to_polygons(lons, lats, field, levels, cmap_name):
    fig_tmp = plt.figure()
    ax_tmp = fig_tmp.add_subplot(111)
    cs = ax_tmp.contourf(lons, lats, field, levels=levels, cmap=cmap_name, extend="both")
    facecolors = cs.get_facecolor()
    bands = []
    for i, segs in enumerate(cs.allsegs):
        if not segs:
            continue
        color = facecolors[i] if i < len(facecolors) else facecolors[-1]
        rgba = [round(float(c), 4) for c in color]
        rings = []
        for seg in segs:
            if len(seg) < 3:
                continue
            xs = seg[:, 0]
            if (xs.max() - xs.min()) > 300:
                continue
            ring = [[round(float(x), 3), round(float(y), 3)] for x, y in seg]
            rings.append(ring)
        if not rings:
            continue
        level_lo = float(levels[i]) if i < len(levels) else None
        level_hi = float(levels[i + 1]) if i + 1 < len(levels) else None
        bands.append({
            "level_min": level_lo,
            "level_max": level_hi,
            "color_rgba": rgba,
            "rings": rings,
        })
    plt.close(fig_tmp)
    return bands


def _contour_lines_to_geo(lons, lats, field, levels, color="#000000"):
    if levels is None or len(levels) == 0:
        return []
    fig_tmp = plt.figure()
    ax_tmp = fig_tmp.add_subplot(111)
    cs = ax_tmp.contour(lons, lats, field, levels=levels)
    lines_out = []
    for i, segs in enumerate(cs.allsegs):
        value = float(levels[i]) if i < len(levels) else None
        for seg in segs:
            if len(seg) < 2:
                continue
            xs = seg[:, 0]
            if (xs.max() - xs.min()) > 300:
                continue
            coords = [[round(float(x), 3), round(float(y), 3)] for x, y in seg]
            lines_out.append({"value": value, "coords": coords, "color": color})
    plt.close(fig_tmp)
    return lines_out

# ============================================================
# EXPORTAR UNA HORA A msgpack.gz
# ============================================================

def export_grele_msgpack(arr, lons_src, lats_src, dia_num, hora_num, run_dt, step, out_dir):
    """
    Exporta el DIAG_GRELE d'una hora concreta amb el mateix format que
    els fitxers GFS: bandes de contorn + isolinies, empaquetat en msgpack
    i comprimit amb gzip.

    IMPORTANT: el DIAG_GRELE es un index BRUT (aprox. 0-40), NO un
    percentatge. Es guarda tal qual, sense normalitzar, perque el front
    (mapa-grele.js) apliqui els seus propis llindars de color per comarca
    (5/10/20/30).

    Nom del fitxer: grele_d{dia:02d}_h{hora:02d}.msgpack.gz
    """
    # L'array de la tile ja ve en ordre lat descendent (nord->sud) tal com
    # el retorna el WCS; les coordenades lons_src/lats_src son consistents
    # amb aquest ordre.
    grele_raw = np.nan_to_num(arr, nan=0.0)
    valor_max_real = float(np.nanmax(grele_raw))

    # Nivells de contorn en unitats de l'index BRUT (no percentatge)
    levels = np.linspace(0, GRELE_INDEX_MAX_ESPERAT, 21)
    bands = _contourf_to_polygons(lons_src, lats_src, grele_raw, levels, "Blues")

    isoline_levels = [5, 10, 15, 20, 25, 30, 35]
    isolines = _contour_lines_to_geo(lons_src, lats_src, grele_raw, isoline_levels, color="#0066cc")

    valid_time = run_dt + timedelta(hours=step)

    payload = {
        "model": "arome",
        "variable": "diag_grele",
        "dia": dia_num,
        "hora": hora_num,  # hora local dins del dia (0-23), veure nota mes avall
        "step": step,       # step del run (FXX)
        "run_time": run_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "valid_time": valid_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "domain": {
            "lon_min": DOMINI["lon_min"], "lon_max": DOMINI["lon_max"],
            "lat_min": DOMINI["lat_min"], "lat_max": DOMINI["lat_max"],
        },
        "grele": {
            "units": "index",
            "range": [0.0, GRELE_INDEX_MAX_ESPERAT],
            "valor_max_real": round(valor_max_real, 2),
            "colormap": "Blues",
            "bands": bands,
            "isolines": isolines,
        },
    }

    out_path = os.path.join(out_dir, f"grele_d{dia_num:02d}_h{hora_num:02d}.msgpack.gz")
    packed = msgpack.packb(payload, use_bin_type=True)
    with gzip.open(out_path, "wb", compresslevel=6) as f:
        f.write(packed)

    size_kb = os.path.getsize(out_path) / 1024
    print(
        f"[OK] GRELE -> Dia {dia_num:02d}, Hora {hora_num:02d}h "
        f"(step=+{step:03d}h, valid {valid_time:%Y-%m-%d %HZ}): {size_kb:.0f} KB"
    )
    return out_path

# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Genera fitxers msgpack.gz de DIAG_GRELE (AROME) per a Catalunya, un per hora."
    )
    parser.add_argument("--start-hora", type=int, default=10,
                         help="Step inicial (hores de previsio, FXX). Ex: 20")
    parser.add_argument("--end-hora", type=int, default=21,
                         help="Step final (hores de previsio, FXX). Ex: 40")
    parser.add_argument("--api-key", type=str, default=None,
                         help="Clau API de Meteo-France (si no s'indica, es fa servir configAVIS.json)")
    parser.add_argument("--out-dir", type=str, default=OUTPUT_DIR_DEFAULT,
                         help="Carpeta de sortida dels msgpack.gz")
    args = parser.parse_args()

    if args.start_hora < 0 or args.end_hora > 51 or args.start_hora > args.end_hora:
        sys.exit("Rang d'hores invalid. Ha d'estar entre 0 i 51, amb start <= end.")

    if args.api_key:
        CFG.key = args.api_key

    if not CFG.key:
        sys.exit(
            "No hi ha api_key configurada. Passa-la amb --api-key o afegeix-la "
            "a configAVIS.json (camp 'api_key')."
        )

    try:
        import meteofetch  # noqa: F401
    except ImportError:
        sys.exit("Falta el paquet meteofetch: pip install meteofetch")

    os.makedirs(args.out_dir, exist_ok=True)

    t0 = time.time()
    print("=" * 70)
    print("  AROME - DIAGNOSTIC DE GRANIS (DIAG_GRELE) - CATALUNYA")
    print(f"  Steps: +{args.start_hora}h a +{args.end_hora}h")
    print(f"  Sortida: {args.out_dir}")
    print("=" * 70)

    run_dt = trobar_millor_run(args.end_hora)
    run_str = run_dt.strftime("%Y-%m-%dT%H.00.00Z")

    steps = list(range(args.start_hora, args.end_hora + 1))
    total = len(steps)

    session = requests.Session()
    session.headers.update({"apikey": CFG.key})
    session.mount("https://", HTTPAdapter(pool_connections=4, pool_maxsize=4))

    ok_count = 0
    for i, step in enumerate(steps, start=1):
        if _shutdown_requested():
            break

        dh = run_dt + timedelta(hours=step)
        ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")

        # dia_num: dia relatiu des del run (1 = dia del run, 2 = l'endema, etc.)
        # hora_num: hora local (Europe/Madrid) del moment de validesa, per
        # facilitar quadrar-ho amb els fitxers GFS existents.
        dia_num = (dh.date() - run_dt.date()).days + 1
        hora_local = dh.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Madrid"))
        hora_num = hora_local.hour

        print(f"\n  [{i:2d}/{total}] step +{step:02d}h (valid {dh:%Y-%m-%d %HZ} UTC "
              f"/ {hora_local:%H:%M} Madrid)...", end=" ", flush=True)

        arr, msg, coords = descarregar_tile_wcs(session, run_str, ts)

        if arr is None:
            print(f"ERROR {msg}")
            time.sleep(ESPERA_ENTRE_PETICIONS)
            continue

        if coords is not None:
            lons_src, lats_src = coords
        else:
            h_src, w_src = arr.shape
            lons_src = np.linspace(DOMINI["lon_min"], DOMINI["lon_max"], w_src)
            lats_src = np.linspace(DOMINI["lat_max"], DOMINI["lat_min"], h_src)

        try:
            export_grele_msgpack(arr, lons_src, lats_src, dia_num, hora_num, run_dt, step, args.out_dir)
            ok_count += 1
        except Exception as e:
            print(f"ERROR en exportar: {e}")

        time.sleep(ESPERA_ENTRE_PETICIONS)

    print("\n" + "=" * 70)
    print(f"  FINALITZAT en {format_time(time.time() - t0)}")
    print(f"  Fitxers generats: {ok_count}/{total}")
    print(f"  Sortida: {args.out_dir}")
    print("=" * 70)


def _shutdown_requested():
    return False


if __name__ == "__main__":
    main()