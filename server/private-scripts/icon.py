#!/usr/bin/env python3
"""
icon_eu_storm_json.py

Pipeline complet per a "joctempestes":
  1. Descarrega del servidor opendata del DWD (ICON-EU) totes les hores
     (steps) disponibles per a un conjunt de variables pensades per a
     tempestes + sondejos (temperatura/punt de rosada en alçada).
  2. Llegeix cada GRIB2 amb eccodes, retalla la malla a la zona d'Espanya
     (bounding box configurable) i ho aboca a JSON.
  3. Genera UN FITXER JSON PER HORA (step), amb totes les variables
     d'aquella hora juntes, perquè cada fitxer pesi poc.
  4. Esborra els GRIB2 temporals un cop convertits, per no acumular pes.

Necessita: eccodes, numpy, certifi (s'instal·len automàticament si falten).

Ús bàsic:
    python icon_eu_storm_json.py --run 00
    python icon_eu_storm_json.py --run 00 --max-step 78
    python icon_eu_storm_json.py --run 00 --bbox 35.0 44.5 -10.0 4.5
"""

import bz2
import json
import re
import ssl
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# ---------------------------------------------------------------------------
# Auto-instalación de dependencias (eccodes, numpy, certifi) si faltan
# ---------------------------------------------------------------------------

def _ensure(pkg_import_name: str, pip_name: str | None = None):
    pip_name = pip_name or pkg_import_name
    try:
        __import__(pkg_import_name)
    except ImportError:
        print(f"Instal·lant dependència que falta: {pip_name} ...")
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet", pip_name],
            check=True,
        )


for _imp, _pip in [("numpy", "numpy"), ("certifi", "certifi"), ("eccodes", "eccodes")]:
    _ensure(_imp, _pip)

import numpy as np  # noqa: E402
import eccodes  # noqa: E402

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

BASE_URL = "https://opendata.dwd.de/weather/nwp/icon-eu/grib"
VALID_RUNS = ["00", "06", "12", "18"]
TIMEOUT = 60

# Variables single-level (un sol valor per punt de graella i hora)
SINGLE_LEVEL_VARS = [
    # Convecció / tempesta
    "cape_ml", "cin_ml", "lpi_con_max", "cape_con",
    "hbas_con", "htop_con",
    "tot_prec", "rain_con", "rain_gsp", "snow_con", "snow_gsp",
    "ww", "vmax_10m", "hzerocl",
    # Context
    "clct", "clcl", "clcm", "clch",
    "t_2m", "td_2m", "relhum_2m",
    "pmsl", "u_10m", "v_10m",
]

# Variables multinivell (sondeig: temperatura, humitat, pressió, vent)
# Es descarreguen TOTS els nivells del model (~60).
MULTI_LEVEL_VARS = ["t", "qv", "p", "u", "v", "fi"]

# Variable estàtica (no varia amb el temps, només cal una vegada)
STATIC_VARS = ["hhl"]

# Bounding box per defecte: Espanya peninsular + Balears + marge
# (lat_min, lat_max, lon_min, lon_max)
DEFAULT_BBOX = (35.0, 44.5, -10.0, 4.5)

# En Windows sovint falla la verificació SSL per certificats no trobats.
try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = ssl.create_default_context()


# ---------------------------------------------------------------------------
# Funciones de red: listar y descargar ficheros del servidor DWD
# ---------------------------------------------------------------------------

def _fetch_html(url: str) -> str:
    req = Request(url, headers={"User-Agent": "icon-eu-storm-json/1.0"})
    try:
        with urlopen(req, timeout=TIMEOUT, context=SSL_CONTEXT) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} accedint a {url}") from e
    except URLError as e:
        raise RuntimeError(f"No s'ha pogut connectar a {url}: {e.reason}") from e


def list_files_for_variable(run: str, variable: str) -> list[str]:
    """Llista els .grib2.bz2 disponibles per a una variable+run, sense duplicats."""
    url = f"{BASE_URL}/{run}/{variable}/"
    html = _fetch_html(url)
    files = re.findall(r'href="([^"]+\.grib2\.bz2)"', html)
    return sorted(set(files))


def extract_step(fname: str) -> int | None:
    """Extreu el pas de temps (step, en hores) del nom de fitxer DWD."""
    m = re.search(r"_(\d{3})_", fname)
    return int(m.group(1)) if m else None


def extract_run_datetime(fname: str) -> datetime | None:
    """
    Extreu la data+hora de la run (en UTC) del nom de fitxer DWD.
    Format típic: icon-eu_europe_regular-lat-lon_single-level_2026063000_003_T_2M.grib2.bz2
    El bloc YYYYMMDDHH és la data+hora de la run (no la del step).
    """
    m = re.search(r"_(\d{10})_\d{3}_", fname)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y%m%d%H")
    except ValueError:
        return None


def download_bytes(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": "icon-eu-storm-json/1.0"})
    with urlopen(req, timeout=TIMEOUT, context=SSL_CONTEXT) as resp:
        return resp.read()


def download_and_decompress(url: str, dest_path: Path) -> Path:
    """Descarrega un .bz2 i el descomprimeix a dest_path (sense l'extensió .bz2)."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    raw = download_bytes(url)
    data = bz2.decompress(raw)
    dest_path.write_bytes(data)
    return dest_path


# ---------------------------------------------------------------------------
# Lectura GRIB2 con eccodes + recorte a la bounding box
# ---------------------------------------------------------------------------

def read_grib_cropped(grib_path: Path, bbox: tuple[float, float, float, float]):
    """
    Llegeix TOTS els missatges d'un fitxer GRIB2 (pot tenir més d'un nivell)
    i retorna una llista de dicts amb: level, lats, lons, values (ja retallats
    a la bounding box donada).

    bbox = (lat_min, lat_max, lon_min, lon_max)
    """
    lat_min, lat_max, lon_min, lon_max = bbox
    results = []

    with open(grib_path, "rb") as f:
        while True:
            gid = eccodes.codes_grib_new_from_file(f)
            if gid is None:
                break
            try:
                lats = np.array(eccodes.codes_get_array(gid, "latitudes"))
                lons = np.array(eccodes.codes_get_array(gid, "longitudes"))
                values = np.array(eccodes.codes_get_array(gid, "values"))

                # normalizamos longitudes a [-180, 180] por si vienen en [0, 360]
                lons_norm = np.where(lons > 180, lons - 360, lons)

                mask = (
                    (lats >= lat_min) & (lats <= lat_max) &
                    (lons_norm >= lon_min) & (lons_norm <= lon_max)
                )

                try:
                    level = eccodes.codes_get(gid, "level")
                except Exception:
                    level = 0

                missing_val = eccodes.codes_get(gid, "missingValue")
                vals_masked = values[mask]
                vals_masked = np.where(vals_masked == missing_val, None, vals_masked)

                results.append({
                    "level": int(level),
                    "lat": np.round(lats[mask], 4).tolist(),
                    "lon": np.round(lons_norm[mask], 4).tolist(),
                    "value": [
                        round(float(v), 4) if v is not None else None
                        for v in vals_masked
                    ],
                })
            finally:
                eccodes.codes_release(gid)

    return results


# ---------------------------------------------------------------------------
# Orquestación principal
# ---------------------------------------------------------------------------

def discover_steps(run: str, sample_var: str = "t_2m") -> list[int]:
    """Esbrina quins steps (hores) hi ha disponibles mirant una variable de mostra."""
    files = list_files_for_variable(run, sample_var)
    steps = sorted({extract_step(f) for f in files if extract_step(f) is not None})
    return steps


def build_url(run: str, variable: str, fname: str) -> str:
    return f"{BASE_URL}/{run}/{variable}/{fname}"


def find_file_for_step(run: str, variable: str, step: int) -> str | None:
    files = list_files_for_variable(run, variable)
    for f in files:
        if extract_step(f) == step:
            return f
    return None


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Descarrega ICON-EU (DWD) i genera un JSON per hora, "
                    "retallat a Espanya, amb variables de tempesta + sondeig."
    )
    parser.add_argument("--run", choices=VALID_RUNS, default="00",
                         help="Run del model (UTC). Per defecte: 00")
    parser.add_argument("--max-step", type=int, default=None,
                         help="Pas màxim (hores) a descarregar. Per defecte: totes les disponibles.")
    parser.add_argument("--bbox", nargs=4, type=float, default=DEFAULT_BBOX,
                         metavar=("LAT_MIN", "LAT_MAX", "LON_MIN", "LON_MAX"),
                         help=f"Bounding box. Per defecte Espanya: {DEFAULT_BBOX}")
    parser.add_argument("--out", default="./icon_eu_storm_json",
                         help="Directori de sortida. Per defecte: ./icon_eu_storm_json")
    parser.add_argument("--tmp", default="./_icon_eu_tmp",
                         help="Directori temporal per als GRIB2 (s'esborra després).")
    args = parser.parse_args()

    bbox = tuple(args.bbox)
    out_dir = Path(args.out) / args.run
    tmp_dir = Path(args.tmp)
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    print(f"Model: ICON-EU | Run: {args.run} UTC")
    print(f"Bounding box: lat[{bbox[0]}, {bbox[1]}] lon[{bbox[2]}, {bbox[3]}]")
    print("Esbrinant hores (steps) disponibles...")

    try:
        steps = discover_steps(args.run)
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    if not steps:
        print("No s'han trobat steps disponibles. ¿Existeix encara aquesta run?")
        sys.exit(1)

    if args.max_step is not None:
        steps = [s for s in steps if s <= args.max_step]

    print(f"Hores disponibles ({len(steps)}): {steps}\n")

    all_vars = SINGLE_LEVEL_VARS + MULTI_LEVEL_VARS

    # --- 1. Descarregamos la variable estática (hhl) una sola vez ---
    static_data = {}
    for var in STATIC_VARS:
        print(f"Variable estàtica: {var}")
        files = list_files_for_variable(args.run, var)
        if not files:
            print(f"  (no disponible per a aquesta run)")
            continue
        fname = files[0]
        url = build_url(args.run, var, fname)
        grib_path = tmp_dir / fname.replace(".bz2", "")
        try:
            download_and_decompress(url, grib_path)
            static_data[var] = read_grib_cropped(grib_path, bbox)
        except Exception as e:
            print(f"  ERROR: {e}")
        finally:
            grib_path.unlink(missing_ok=True)

    if static_data:
        static_path = out_dir / "static.json"
        static_path.write_text(json.dumps(static_data), encoding="utf-8")
        print(f"  Guardat: {static_path}\n")

    # --- 2. Por cada hora (step): descargamos todas las variables, las
    #         convertimos a JSON, y limpiamos los GRIB2 temporales ---
    run_datetime = None  # se detecta del primer fichero descargado (YYYYMMDDHH)

    for step in steps:
        print(f"=== Hora (step) {step:03d} ===")
        hour_data = {
            "run": args.run,
            "step": step,
            "bbox": bbox,
            "valid_time_utc": None,  # se rellena más abajo en cuanto sabemos la fecha de la run
            "variables": {},
        }

        for var in all_vars:
            fname = find_file_for_step(args.run, var, step)
            if not fname:
                print(f"  {var}: no disponible per a aquest step, s'omet")
                continue

            if run_datetime is None:
                run_datetime = extract_run_datetime(fname)

            url = build_url(args.run, var, fname)
            grib_path = tmp_dir / fname.replace(".bz2", "")
            try:
                download_and_decompress(url, grib_path)
                parsed = read_grib_cropped(grib_path, bbox)

                if var in MULTI_LEVEL_VARS:
                    # multinivell: guardamos lista de {level, lat, lon, value}
                    hour_data["variables"][var] = parsed
                else:
                    # single-level: solo hay un mensaje, lo aplanamos
                    hour_data["variables"][var] = parsed[0] if parsed else None

                print(f"  {var}: ok ({len(parsed)} nivell(s))")
            except Exception as e:
                print(f"  {var}: ERROR ({e})")
            finally:
                grib_path.unlink(missing_ok=True)

        if run_datetime is not None:
            valid_dt = run_datetime + timedelta(hours=step)
            hour_data["valid_time_utc"] = valid_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        out_path = out_dir / f"step_{step:03d}.json"
        out_path.write_text(json.dumps(hour_data), encoding="utf-8")
        print(f"  -> Guardat: {out_path}\n")

    # --- 3. Generamos steps.json: la lista real de horas que se han
    #         descargado, con su valid_time, para que el visor JS no
    #         tenga que adivinar nada ---
    steps_index = []
    for step in steps:
        valid_dt = (run_datetime + timedelta(hours=step)) if run_datetime else None
        steps_index.append({
            "step": step,
            "valid_time_utc": valid_dt.strftime("%Y-%m-%dT%H:%M:%SZ") if valid_dt else None,
        })

    steps_path = out_dir / "steps.json"
    steps_path.write_text(json.dumps(steps_index), encoding="utf-8")
    print(f"Índex d'hores guardat a: {steps_path}")

    print("Procés complet.")
    print(f"JSONs generats a: {out_dir.resolve()}")


if __name__ == "__main__":
    main()