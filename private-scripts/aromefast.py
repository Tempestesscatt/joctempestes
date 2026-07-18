"""
Descarrega les primeres N_HOURS de previsio AROME0025 i genera
un fitxer JS per cada hora amb TOTES les variables incloses.
Cada JS conté dades raster + vectors de vent per visualització Leaflet.
"""

import warnings
import json
import os
from pathlib import Path
import numpy as np
from datetime import datetime
from meteofetch import Arome0025

warnings.filterwarnings("ignore", category=FutureWarning)

# ---------------------------------------------------------------------------
# Configuració
# ---------------------------------------------------------------------------
EXTENT = [0.10, 3.60, 40.40, 42.95]  # lon_min, lon_max, lat_min, lat_max
N_HOURS = 5  # nombre d'hores a processar
MAIN_VAR = "t2m"
PAQUET = "SP1"
CAPE_VAR = "CAPE_INS"

# Directori de sortida (on s'envien els JS)
DATA_DIR = Path("/app/web_data")

DIRECTION_VARS = {"wdir10"}
WIND_OVERLAY_VARS = {
    "t2m", "r2", "prmsl", "tp", "max_i10fg", "efg10", "nfg10",
    "ssrd", "tgrp", "tsnowp", "CAPE_INS",
}

# Reduir resolució per fitxers més petits (factor de reducció)
RESAMPLE_FACTOR = 2  # 1 = resolució completa, 2 = meitat, 3 = terç...


def format_size(bytes_size):
    """Formata mida en bytes a unitats llegibles."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"


def load_forecast():
    """Descarrega dades AROME SP1 + CAPE de SP2."""
    print("📡 Descarregant previsió Arome0025 (paquet SP1)...")
    datasets = Arome0025.get_latest_forecast(paquet=PAQUET)
    print(f"   ✓ Variables SP1: {list(datasets.keys())}")
    
    print(f"📡 Descarregant {CAPE_VAR} (paquet SP2)...")
    try:
        sp2 = Arome0025.get_latest_forecast(paquet="SP2", variables=(CAPE_VAR,))
        if CAPE_VAR in sp2:
            datasets[CAPE_VAR] = sp2[CAPE_VAR]
            print(f"   ✓ {CAPE_VAR} afegit")
    except Exception as e:
        print(f"   ⚠ No s'ha pogut descarregar {CAPE_VAR}: {e}")
    
    print(f"   Total variables: {len(datasets)}")
    return datasets


def crop_to_extent(da, extent):
    """Retalla les dades a l'extent geogràfic."""
    lon_min, lon_max, lat_min, lat_max = extent
    da = da.sel(
        longitude=slice(lon_min, lon_max),
        latitude=slice(lat_min, lat_max)
    )
    return da


def resample_data(da, factor):
    """Redueix la resolució per fer els fitxers més petits."""
    if factor <= 1:
        return da
    return da.isel(
        latitude=slice(None, None, factor),
        longitude=slice(None, None, factor)
    )


def process_wind_vectors(u10, v10, lon, lat, step=3):
    """Genera vectors de vent simplificats."""
    vectors = []
    
    for i in range(0, len(lat), step):
        for j in range(0, len(lon), step):
            if i < u10.shape[0] and j < u10.shape[1]:
                u = float(u10[i, j])
                v = float(v10[i, j])
                
                if not np.isnan(u) and not np.isnan(v):
                    speed = np.sqrt(u**2 + v**2)
                    if speed > 0.3:  # Filtrar vents molt febles
                        vectors.append({
                            "lat": round(float(lat[i]), 4),
                            "lon": round(float(lon[j]), 4),
                            "u": round(u, 2),
                            "v": round(v, 2),
                            "speed": round(speed, 2)
                        })
    
    return vectors


def process_hour_to_js(datasets_hour, hour_idx):
    """
    Processa TOTES les variables d'una hora en un sol objecte JS.
    Retorna el codi JavaScript com a string.
    """
    
    # Data de referència (timestamp)
    timestamp = None
    for ds in datasets_hour.values():
        if hasattr(ds, 'time'):
            try:
                timestamp = str(ds.time.values)
                break
            except:
                pass
    
    hour_data = {
        "hour": hour_idx,
        "timestamp": timestamp or f"h+{hour_idx:02d}",
        "extent": EXTENT,
        "variables": {},
        "wind": None
    }
    
    # Extreure coordenades comunes
    lon = None
    lat = None
    
    for var_name, da_var in datasets_hour.items():
        if lon is None:
            lon = da_var.longitude.values[::RESAMPLE_FACTOR]
            lat = da_var.latitude.values[::RESAMPLE_FACTOR]
    
    # Processar vent primer (per compartir-lo entre variables)
    u10_da = datasets_hour.get("u10")
    v10_da = datasets_hour.get("v10")
    
    if u10_da is not None and v10_da is not None:
        u10 = u10_da.values[::RESAMPLE_FACTOR, ::RESAMPLE_FACTOR]
        v10 = v10_da.values[::RESAMPLE_FACTOR, ::RESAMPLE_FACTOR]
        hour_data["wind"] = process_wind_vectors(u10, v10, lon, lat, step=4)
    
    # Processar cada variable
    for var_name, da_var in datasets_hour.items():
        try:
            # Resamplejar
            da_resampled = resample_data(da_var, RESAMPLE_FACTOR)
            values = da_resampled.values
            
            if np.all(np.isnan(values)):
                continue
            
            # Arrodonir valors per reduir mida
            values_rounded = np.round(values, 2)
            
            # Metadades
            metadata = {
                "units": str(da_var.attrs.get("units", "")),
                "long_name": str(da_var.attrs.get("long_name", var_name)),
                "min": round(float(np.nanmin(values)), 2),
                "max": round(float(np.nanmax(values)), 2),
                "isDirection": var_name in DIRECTION_VARS,
                "showWind": var_name in WIND_OVERLAY_VARS,
                "cmap": "twilight" if var_name in DIRECTION_VARS else "viridis"
            }
            
            # Per variables de direcció, calcular vectors específics
            vectors = None
            if var_name in DIRECTION_VARS:
                si10_da = datasets_hour.get("si10")
                if si10_da is not None:
                    dir_deg = values_rounded
                    speed = si10_da.values[::RESAMPLE_FACTOR, ::RESAMPLE_FACTOR]
                    vectors = []
                    
                    step = 4
                    for i in range(0, len(lat), step):
                        for j in range(0, len(lon), step):
                            if not np.isnan(dir_deg[i,j]) and not np.isnan(speed[i,j]):
                                s = float(speed[i,j])
                                if s > 0.3:
                                    dir_rad = np.deg2rad(270 - dir_deg[i,j])
                                    vectors.append({
                                        "lat": round(float(lat[i]), 4),
                                        "lon": round(float(lon[j]), 4),
                                        "u": round(-np.cos(dir_rad) * s * 0.01, 2),
                                        "v": round(-np.sin(dir_rad) * s * 0.01, 2),
                                        "speed": round(s, 2)
                                    })
            
            # Variable específica sense vent propi (usarà el vent general)
            if var_name not in DIRECTION_VARS and var_name not in {"u10", "v10", "si10"}:
                hour_data["variables"][var_name] = {
                    "values": values_rounded.tolist(),
                    "metadata": metadata
                }
            
        except Exception as e:
            print(f"   ⚠ Error processant {var_name}: {e}")
    
    # Convertir a JavaScript
    js_content = f"""// AROME0025 - Hora {hour_idx:02d}
// Generat: {datetime.now().isoformat()}
// Extent: Catalunya ({EXTENT})
window.aromeData = window.aromeData || {{}};
window.aromeData['hour{hour_idx:02d}'] = {json.dumps(hour_data, ensure_ascii=False)};
"""
    
    return js_content


def process_all(datasets, extent, n_hours):
    """Processa totes les hores, generant un JS per hora."""
    
    print(f"\n{'='*60}")
    print(f"⚙️  Processant dades...")
    print(f"{'='*60}")
    
    # Retallar totes les variables
    cropped = {}
    time_dim = None
    
    for var_name, da in datasets.items():
        try:
            da_c = crop_to_extent(da, extent)
            cropped[var_name] = da_c
            if time_dim is None:
                time_dim = "time" if "time" in da_c.dims else "step"
        except Exception as e:
            print(f"   ⚠ No s'ha pogut retallar '{var_name}': {e}")
    
    n_available = cropped[MAIN_VAR].sizes[time_dim]
    n_hours = min(n_hours, n_available)
    print(f"   Hores disponibles: {n_available}")
    print(f"   Hores a processar: {n_hours}")
    print(f"   Factor resampleig: {RESAMPLE_FACTOR}x")
    print(f"   Directori sortida: {DATA_DIR}")
    
    # Crear directori
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Índex general
    index = {
        "model": "AROME0025",
        "package": PAQUET,
        "extent": EXTENT,
        "hours": n_hours,
        "variables": [],
        "generated": datetime.now().isoformat(),
        "files": []
    }
    
    total_size = 0
    
    # Processar cada hora
    for h in range(n_hours):
        print(f"\n   🕐 Processant hora {h+1:02d}/{n_hours}...")
        
        # Extreure dades d'aquesta hora
        datasets_hour = {}
        for var, da_c in cropped.items():
            dim = time_dim
            if dim in da_c.dims and h < da_c.sizes[dim]:
                datasets_hour[var] = da_c.isel({dim: h})
        
        # Generar JS
        js_content = process_hour_to_js(datasets_hour, h + 1)
        
        # Guardar fitxer
        filename = f"arome_h{h+1:02d}.js"
        filepath = DATA_DIR / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(js_content)
        
        # Calcular mida
        file_size = os.path.getsize(filepath)
        total_size += file_size
        size_str = format_size(file_size)
        
        print(f"      ✓ {filename} ({size_str})")
        
        # Actualitzar índex
        index["files"].append({
            "file": filename,
            "hour": h + 1,
            "size": file_size,
            "size_formatted": size_str,
            "variables_count": len(datasets_hour)
        })
    
    # Col·lecció de variables
    index["variables"] = sorted(list(cropped.keys()))
    
    # Guardar índex
    index_path = DATA_DIR / "arome_index.json"
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    
    index_size = os.path.getsize(index_path)
    total_size += index_size
    
    # Resum final
    print(f"\n{'='*60}")
    print(f"✅ PROCÉS COMPLETAT!")
    print(f"{'='*60}")
    print(f"   📁 Directori: {DATA_DIR}")
    print(f"   📄 Fitxers generats: {n_hours} JS + 1 índex")
    print(f"   📊 Variables per hora: {len(cropped)}")
    print(f"   💾 Pes total: {format_size(total_size)}")
    print(f"   📈 Pes mitjà per hora: {format_size(total_size/n_hours)}")
    print(f"\n   Variables incloses: {', '.join(index['variables'])}")
    print(f"\n   🚀 Llest per utilitzar amb Leaflet!")
    
    return index


def main():
    print(f"{'='*60}")
    print(f"  AROME0025 → JavaScript Map Generator")
    print(f"  Catalunya (Delta Ebre inclòs)")
    print(f"{'='*60}\n")
    
    # Descarregar
    datasets = load_forecast()
    
    if MAIN_VAR not in datasets:
        raise KeyError(f"'{MAIN_VAR}' no trobada: {list(datasets.keys())}")
    
    # Processar
    index = process_all(datasets, EXTENT, N_HOURS)
    
    print(f"\n✨ Tot llest! Els fitxers JS estan a:")
    print(f"   {DATA_DIR.absolute()}")
    print(f"\n   Cada fitxer .js conté TOTES les variables d'una hora")


if __name__ == "__main__":
    main()