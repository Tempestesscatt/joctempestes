#!/usr/bin/env python3
"""
ERA5 Downloader — Genera PNGs organitzats per any
Estructura: web_dataERA5/2026/2026-06_t2m_t0.png
"""
import cdsapi
import netCDF4 as nc2
import numpy as np
import json, os, calendar
from pathlib import Path
from datetime import date, datetime
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import matplotlib.colors as mcolors

# ─── CONFIGURACIÓ ─────────────────────────────────────────────────────────
CONFIG = {
    "any_inicial": 2026,
    "any_final":   1940,
    "area":        [43.0, -1.0, 40.4, 3.5],  # TOTA Catalunya
    "grid":        [0.1, 0.1],
    "hores":       ["00:00", "06:00", "12:00", "18:00"],
    "output_dir":  r"C:\Users\simob\Documents\GitHub\joctempestes\meu-mapa\public\web_dataERA5",
    "temp_dir":    "era5_nc_temp",
    "esborra_nc":  True,
}

# ─── VARIABLES A DESCARREGAR ──────────────────────────────────────────────
VARIABLES_DESCARGAR = [
    # Temperatures
    "2m_temperature",
    "2m_dewpoint_temperature",
    "skin_temperature",
    # Precipitació i neu
    "total_precipitation",
    "convective_precipitation",
    "snowfall",
    "snow_depth",
    # Vent
    "10m_u_component_of_wind",
    "10m_v_component_of_wind",
    "instantaneous_10m_wind_gust",
    # Pressió
    "mean_sea_level_pressure",
    "surface_pressure",
    # Nuvolositat
    "total_cloud_cover",
    # Humitat del sòl
    "volumetric_soil_water_layer_1",
]

# ─── CONFIGURACIÓ DE COLORS PER VARIABLE ──────────────────────────────────
CONFIG_VARS = {
    "2m_temperature": {
        "nom": "Temperatura 2m",
        "unitat_original": "K",
        "unitat_mostrar": "°C",
        "conversio": lambda x: x - 273.15,
        "colors": ["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#f7f7f7", "#fddbc7", "#f4a582", "#d6604d", "#b2182b"],
        "rangs": [-5, 0, 5, 10, 15, 20, 25, 30, 35, 40],  # °C
        "nivells": [-5, 0, 5, 10, 15, 20, 25, 30, 35, 40],
    },
    "2m_dewpoint_temperature": {
        "nom": "Punt de rosada",
        "unitat_original": "K",
        "unitat_mostrar": "°C",
        "conversio": lambda x: x - 273.15,
        "colors": ["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#f7f7f7", "#fddbc7", "#f4a582", "#d6604d", "#b2182b"],
        "rangs": [-10, -5, 0, 5, 10, 15, 20, 25, 30],
        "nivells": [-10, -5, 0, 5, 10, 15, 20, 25, 30],
    },
    "skin_temperature": {
        "nom": "Temp. superfície",
        "unitat_original": "K",
        "unitat_mostrar": "°C",
        "conversio": lambda x: x - 273.15,
        "colors": ["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#f7f7f7", "#fddbc7", "#f4a582", "#d6604d", "#b2182b"],
        "rangs": [-5, 0, 5, 10, 15, 20, 25, 30, 35, 40],
        "nivells": [-5, 0, 5, 10, 15, 20, 25, 30, 35, 40],
    },
    "total_precipitation": {
        "nom": "Precipitació total",
        "unitat_original": "m",
        "unitat_mostrar": "mm",
        "conversio": lambda x: x * 1000,
        "colors": ["#ffffff", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#810f7c", "#4d004b"],
        "rangs": [0, 0.5, 1, 2, 5, 10, 20, 50, 100],
        "nivells": [0, 0.5, 1, 2, 5, 10, 20, 50, 100],
    },
    "convective_precipitation": {
        "nom": "Precip. convectiva",
        "unitat_original": "m",
        "unitat_mostrar": "mm",
        "conversio": lambda x: x * 1000,
        "colors": ["#ffffff", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#810f7c", "#4d004b"],
        "rangs": [0, 0.5, 1, 2, 5, 10, 20, 50, 100],
        "nivells": [0, 0.5, 1, 2, 5, 10, 20, 50, 100],
    },
    "snowfall": {
        "nom": "Nevada",
        "unitat_original": "m of water equivalent",
        "unitat_mostrar": "mm",
        "conversio": lambda x: x * 1000,
        "colors": ["#f7f7f7", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#810f7c", "#4d004b"],
        "rangs": [0, 0.1, 0.5, 1, 2, 5, 10, 20],
        "nivells": [0, 0.1, 0.5, 1, 2, 5, 10, 20],
    },
    "snow_depth": {
        "nom": "Gruix de neu",
        "unitat_original": "m of water equivalent",
        "unitat_mostrar": "cm",
        "conversio": lambda x: x * 100,
        "colors": ["#f7f7f7", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#810f7c", "#4d004b"],
        "rangs": [0, 1, 5, 10, 20, 50, 100],
        "nivells": [0, 1, 5, 10, 20, 50, 100],
    },
    "10m_u_component_of_wind": {
        "nom": "Vent U (Est-Oest)",
        "unitat_original": "m s**-1",
        "unitat_mostrar": "km/h",
        "conversio": lambda x: x * 3.6,
        "colors": ["#2166ac", "#f7f7f7", "#b2182b"],
        "rangs": [-50, -25, -10, 0, 10, 25, 50],
        "nivells": [-50, -25, -10, 0, 10, 25, 50],
    },
    "10m_v_component_of_wind": {
        "nom": "Vent V (Nord-Sud)",
        "unitat_original": "m s**-1",
        "unitat_mostrar": "km/h",
        "conversio": lambda x: x * 3.6,
        "colors": ["#2166ac", "#f7f7f7", "#b2182b"],
        "rangs": [-50, -25, -10, 0, 10, 25, 50],
        "nivells": [-50, -25, -10, 0, 10, 25, 50],
    },
    "instantaneous_10m_wind_gust": {
        "nom": "Ratxes de vent",
        "unitat_original": "m s**-1",
        "unitat_mostrar": "km/h",
        "conversio": lambda x: x * 3.6,
        "colors": ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#b10026"],
        "rangs": [0, 10, 20, 30, 40, 50, 70, 100],
        "nivells": [0, 10, 20, 30, 40, 50, 70, 100],
    },
    "mean_sea_level_pressure": {
        "nom": "Pressió nivell mar",
        "unitat_original": "Pa",
        "unitat_mostrar": "hPa",
        "conversio": lambda x: x / 100,
        "colors": ["#313695", "#74add1", "#e0f3f8", "#ffffbf", "#fee090", "#f46d43", "#a50026"],
        "rangs": [980, 995, 1010, 1015, 1020, 1025, 1040],
        "nivells": [980, 995, 1010, 1015, 1020, 1025, 1040],
    },
    "surface_pressure": {
        "nom": "Pressió superfície",
        "unitat_original": "Pa",
        "unitat_mostrar": "hPa",
        "conversio": lambda x: x / 100,
        "colors": ["#313695", "#74add1", "#e0f3f8", "#ffffbf", "#fee090", "#f46d43", "#a50026"],
        "rangs": [980, 995, 1010, 1015, 1020, 1025, 1040],
        "nivells": [980, 995, 1010, 1015, 1020, 1025, 1040],
    },
    "total_cloud_cover": {
        "nom": "Nuvolositat",
        "unitat_original": "(0 - 1)",
        "unitat_mostrar": "%",
        "conversio": lambda x: x * 100,
        "colors": ["#ffffff", "#e6e6e6", "#cccccc", "#999999", "#666666", "#333333", "#1a1a1a"],
        "rangs": [0, 15, 30, 45, 60, 75, 100],
        "nivells": [0, 15, 30, 45, 60, 75, 100],
    },
    "volumetric_soil_water_layer_1": {
        "nom": "Humitat sòl",
        "unitat_original": "m**3 m**-3",
        "unitat_mostrar": "%",
        "conversio": lambda x: x * 100,
        "colors": ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#74add1", "#313695"],
        "rangs": [0, 10, 20, 30, 40, 50, 60, 70, 100],
        "nivells": [0, 10, 20, 30, 40, 50, 60, 70, 100],
    },
}

# ─── HELPERS ──────────────────────────────────────────────────────────────
def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def data_maxima_cds():
    avui = date.today()
    if avui.day <= 5:
        mes = avui.month - 1 if avui.month > 1 else 12
        any = avui.year if avui.month > 1 else avui.year - 1
    else:
        mes = avui.month
        any = avui.year
    return any, mes

def dies_mes(any, mes):
    return [str(d).zfill(2) for d in range(1, calendar.monthrange(any, mes)[1] + 1)]

# ─── DESCARREGA ───────────────────────────────────────────────────────────
def descarrega(client, any, mes, nc_path):
    request = {
        "product_type": ["reanalysis"],
        "variable":     VARIABLES_DESCARGAR,
        "year":         [str(any)],
        "month":        [str(mes).zfill(2)],
        "day":          dies_mes(any, mes),
        "time":         CONFIG["hores"],
        "data_format":  "netcdf4",
        "grid":         CONFIG["grid"],
        "area":         CONFIG["area"],
    }
    client.retrieve("reanalysis-era5-single-levels", request, str(nc_path.resolve()))

# ─── LLEGEIX NC ───────────────────────────────────────────────────────────
def llegeix_nc(nc_path):
    ds = nc2.Dataset(str(nc_path.resolve()), "r")
    skip = {"latitude", "longitude", "time", "expver", "number", "valid_time"}
    
    if "valid_time" in ds.variables:
        time_var = ds.variables["valid_time"]
    else:
        time_var = ds.variables["time"]
    times = [nc2.num2date(t, time_var.units).isoformat() for t in time_var[:]]
    lats = ds.variables["latitude"][:].tolist()
    lons = ds.variables["longitude"][:].tolist()
    
    variables = {}
    for vname in ds.variables:
        if vname in skip:
            continue
        var = ds.variables[vname]
        data = var[:]
        if hasattr(data, "filled"):
            data = data.filled(np.nan)
        attrs = {a: getattr(var, a) for a in ["long_name", "units", "standard_name"] if hasattr(var, a)}
        variables[vname] = {
            "attrs": attrs,
            "data": data.astype(float),
        }
    ds.close()
    return lats, lons, times, variables

# ─── GENERAR PNG ──────────────────────────────────────────────────────────
def generar_png(variable_name, data_array, lats, lons, time_idx, time_str, any, mes, output_dir):
    config = CONFIG_VARS.get(variable_name, {})
    nom = config.get("nom", variable_name)
    unitat = config.get("unitat_mostrar", "")
    conversio = config.get("conversio", lambda x: x)
    colors = config.get("colors", ["#2166ac", "#f7f7f7", "#b2182b"])
    nivells = config.get("nivells", [0, 10, 20, 30, 40])
    
    # Convertir valors
    data_conv = conversio(data_array)
    
    # Crear colormap
    n_colors = len(colors)
    cmap = LinearSegmentedColormap.from_list('custom', colors, N=n_colors)
    norm = mcolors.BoundaryNorm(nivells, n_colors - 1)
    
    # Crear figura
    fig, ax = plt.subplots(1, 1, figsize=(10, 8), dpi=150)
    fig.patch.set_alpha(0)
    
    extent = [lons[0], lons[-1], lats[-1], lats[0]]
    
    # Dibuixar
    im = ax.imshow(data_conv, extent=extent, cmap=cmap, norm=norm,
                   aspect='auto', origin='upper', interpolation='bilinear')
    
    # Treure eixos
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_frame_on(False)
    
    # Data formatada
    dt = datetime.fromisoformat(time_str)
    titol = f"{nom} — {dt.strftime('%d/%m/%Y %H:%M')}"
    ax.set_title(titol, fontsize=10, pad=5, color='white', fontweight='bold')
    
    # Colorbar amb els nivells
    cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04, ticks=nivells)
    cbar.set_label(unitat, fontsize=9, color='white')
    cbar.ax.tick_params(labelsize=8, colors='white')
    cbar.outline.set_edgecolor('white')
    
    plt.tight_layout(pad=0.5)
    
    # Guardar
    nom_fitxer = f"{any}-{mes:02d}_{variable_name}_t{time_idx}.png"
    output_path = output_dir / nom_fitxer
    
    plt.savefig(str(output_path.resolve()), dpi=150, bbox_inches='tight',
                pad_inches=0.1, transparent=False, facecolor='#1a1a2e')
    plt.close()
    
    # Info pel JSON
    min_val = float(np.nanmin(data_conv))
    max_val = float(np.nanmax(data_conv))
    
    return nom_fitxer, {
        "lat_min": lats[-1], "lat_max": lats[0],
        "lon_min": lons[0], "lon_max": lons[-1],
        "unit": unitat,
        "time": time_str,
        "min_val": min_val,
        "max_val": max_val,
        "nom": nom,
        "nivells": nivells,
        "colors": colors,
    }

# ─── PROCESSA UN MES ──────────────────────────────────────────────────────
def processa_mes(client, any, mes, progress, progress_file):
    key = f"{any}-{mes:02d}"
    
    # Crear carpeta per any
    out_dir = Path(CONFIG["output_dir"]) / str(any)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    index_file = out_dir / f"{mes:02d}_index.json"
    
    if progress.get(key) == "ok" and index_file.exists():
        log(f"  {key}: ja fet ✓")
        return
    
    tmp_dir = Path(CONFIG["temp_dir"])
    tmp_dir.mkdir(parents=True, exist_ok=True)
    nc_path = tmp_dir / f"era5_{any}_{mes:02d}.nc"
    
    # Descarregar
    if not progress.get(f"{key}_dl") == "ok" or not nc_path.exists():
        log(f"  {key}: descarregant {len(VARIABLES_DESCARGAR)} variables...")
        try:
            descarrega(client, any, mes, nc_path)
            progress[f"{key}_dl"] = "ok"
            progress_file.write_text(json.dumps(progress, indent=2))
            log(f"  {key}: descarregat ({nc_path.stat().st_size/1024/1024:.1f} MB)")
        except Exception as e:
            log(f"  {key}: ERROR descàrrega — {e}")
            return
    
    # Llegir NC
    try:
        lats, lons, times, variables = llegeix_nc(nc_path)
        log(f"  {key}: {len(variables)} variables llegides")
        
        if CONFIG["esborra_nc"]:
            nc_path.unlink()
    except Exception as e:
        log(f"  {key}: ERROR llegint NC — {e}")
        return
    
    if not variables:
        log(f"  {key}: sense dades")
        return
    
    # Generar PNGs
    index_data = {
        "any": any,
        "mes": mes,
        "lats": lats,
        "lons": lons,
        "times": times,
        "variables": {},
    }
    
    total_pngs = 0
    
    for vname, vdata in variables.items():
        if vname not in CONFIG_VARS:
            continue
        
        index_data["variables"][vname] = {
            "config": CONFIG_VARS[vname],
            "times": [],
        }
        
        data_arr = vdata["data"]
        n_times = data_arr.shape[0] if data_arr.ndim >= 3 else 1
        
        for t_idx in range(n_times):
            time_str = times[t_idx] if t_idx < len(times) else f"t{t_idx}"
            dades_2d = data_arr[t_idx] if data_arr.ndim >= 3 else data_arr
            
            try:
                png_name, png_info = generar_png(
                    vname, dades_2d, lats, lons, t_idx, time_str, any, mes, out_dir
                )
                index_data["variables"][vname]["times"].append(png_info)
                total_pngs += 1
            except Exception as e:
                log(f"  {key} {vname} t{t_idx}: error PNG — {e}")
    
    # Guardar índex
    with open(str(index_file.resolve()), 'w', encoding='utf-8') as f:
        json.dump(index_data, f, indent=2, default=str)
    
    log(f"  {key}: ✓ {total_pngs} PNGs a {out_dir}")
    
    progress[key] = "ok"
    progress_file.write_text(json.dumps(progress, indent=2))

# ─── MAIN ─────────────────────────────────────────────────────────────────
def main():
    out_dir = Path(CONFIG["output_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    
    progress_file = out_dir / "progress.json"
    progress = json.loads(progress_file.read_text()) if progress_file.exists() else {}
    
    client = cdsapi.Client()
    max_any, max_mes = data_maxima_cds()
    
    # Usar l'any configurat o el màxim disponible
    any_inici = min(CONFIG["any_inicial"], max_any)
    
    log(f"Data màxima CDS: {max_any}-{max_mes:02d}")
    log(f"Iniciant des de: {any_inici}-{max_mes:02d}")
    log(f"Variables: {len(VARIABLES_DESCARGAR)}")
    log(f"Sortida: {out_dir}/<ANY>/")
    
    for any in range(any_inici, CONFIG["any_final"] - 1, -1):
        mes_inici = max_mes if any == any_inici else 12
        for mes in range(mes_inici, 0, -1):
            try:
                processa_mes(client, any, mes, progress, progress_file)
            except Exception as e:
                log(f"ERROR {any}-{mes:02d}: {e}")
    
    log("✓ Tot completat!")

if __name__ == "__main__":
    main()