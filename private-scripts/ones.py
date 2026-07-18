"""
Descarrega les primeres N_HOURS de previsio MFWAM0025 (totes les variables
del paquet SP1) per Catalunya (incloent Delta de l'Ebre), i genera un mapa
COMPLET amb Cartopy per cada combinacio hora x variable:
  - terra en verd, costa, fronteres, graella de coordenades
  - color ple + isolínies amb els valors etiquetats
  - fletxes de direccio (per a variables angulars: vent, onades)

Instal·lacio previa necessaria:
    pip install meteofetch cartopy matplotlib

Documentacio meteofetch: https://meteofetch.readthedocs.io
"""

import warnings
from pathlib import Path

import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.feature as cfeature
import numpy as np

from meteofetch import MFWAM0025

warnings.filterwarnings("ignore", category=FutureWarning)

# ---------------------------------------------------------------------------
# Configuracio
# ---------------------------------------------------------------------------
# Catalunya sencera, incloent el Delta de l'Ebre i marge de mar
EXTENT = [0.10, 3.60, 40.40, 42.95]  # lon_min, lon_max, lat_min, lat_max
N_HOURS = 24
MAPS_DIR = Path(
    r"C:\Users\simob\Documents\GitHub\joctempestes\meu-mapa\public\webdata_waves\maps"
)
MAIN_VAR = "swh"  # variable de referencia per saber quantes hores hi ha disponibles


def load_forecast():
    """Descarrega totes les variables disponibles del paquet SP1."""
    print("Descarregant previsio MFWAM0025 (totes les variables SP1)...")
    datasets = MFWAM0025.get_latest_forecast(paquet="SP1")  # variables=None -> totes
    print("Variables disponibles:", list(datasets.keys()))
    return datasets


def crop_to_extent(da, extent):
    lon_min, lon_max, lat_min, lat_max = extent
    lat_vals = da.latitude.values
    lat_slice = (
        slice(lat_min, lat_max) if lat_vals[0] < lat_vals[-1] else slice(lat_max, lat_min)
    )
    da = da.sel(longitude=slice(lon_min, lon_max), latitude=lat_slice)
    if da.sizes.get("latitude", 0) == 0 or da.sizes.get("longitude", 0) == 0:
        raise ValueError(f"Retall buit per extent={extent}")
    return da


# Variables de direcció (graus, 0-360, meteorologic: "d'on ve")
DIRECTION_VARS = {"wdir10", "mwd", "swdir", "wvdir"}

# Emparellem cada variable de direcció amb la seva variable d'intensitat
# corresponent, per dibuixar fletxes escalades per força.
DIRECTION_TO_SPEED = {
    "wdir10": "si10",   # direcció vent 10m <-> intensitat vent 10m
    "mwd": "swh",        # direcció onada total <-> alçada onada total
    "swdir": "shts",     # direcció houle <-> alçada houle
    "wvdir": "shww",     # direcció mar de vent <-> alçada mar de vent
}

DPI = 140


def make_map(datasets_hour, var_name, extent, hour_index):
    """
    Mapa NET (sense colorbar, sense títol, sense marges, sense graella de
    coordenades) que ocupa tot el requadre = extent. Manté: terra verda,
    costa, fronteres, color ple, isolínies amb valors, i fletxes de
    direcció per a variables angulars.
    """
    da_var = datasets_hour[var_name]
    values = da_var.values
    if np.all(np.isnan(values)):
        print(f"  (avis: {var_name} h{hour_index:02d} és tot NaN, s'omet el mapa)")
        return

    lon_min, lon_max, lat_min, lat_max = extent
    width_deg = lon_max - lon_min
    height_deg = lat_max - lat_min
    fig_w = 9
    fig_h = fig_w * (height_deg / width_deg)

    fig = plt.figure(figsize=(fig_w, fig_h), dpi=DPI)
    ax = plt.axes([0, 0, 1, 1], projection=ccrs.PlateCarree())  # ocupa tot el requadre
    ax.set_extent(extent, crs=ccrs.PlateCarree())
    ax.axis("off")
    ax.set_frame_on(False)

    # Terra verda + costa + fronteres + rius (sense graella ni etiquetes)
    ax.add_feature(cfeature.LAND, facecolor="#c8e6b0", zorder=2)
    ax.add_feature(cfeature.OCEAN, facecolor="#eef6fb", zorder=0)
    ax.add_feature(cfeature.COASTLINE, linewidth=1.0, zorder=4)
    ax.add_feature(cfeature.BORDERS, linewidth=0.7, linestyle="--", zorder=4)
    ax.add_feature(cfeature.RIVERS, linewidth=0.6, edgecolor="#3a7bd5", zorder=3)

    is_direction = var_name in DIRECTION_VARS
    cmap = "twilight" if is_direction else "viridis"

    ax.pcolormesh(
        da_var.longitude,
        da_var.latitude,
        values,
        transform=ccrs.PlateCarree(),
        cmap=cmap,
        shading="auto",
        alpha=0.85,
        zorder=1,
    )

    # Isolínies amb etiquetes de valor
    try:
        vmin, vmax = np.nanmin(values), np.nanmax(values)
        if vmax > vmin:
            cs = ax.contour(
                da_var.longitude,
                da_var.latitude,
                values,
                levels=8,
                colors="black",
                linewidths=0.6,
                transform=ccrs.PlateCarree(),
                zorder=6,
            )
            ax.clabel(cs, inline=True, fontsize=7, fmt="%.1f")
    except Exception as e:
        print(f"  (avis: no s'han pogut dibuixar isolinies per {var_name}: {e})")

    # Fletxes de direcció (quiver), escalades per la intensitat associada
    if is_direction:
        speed_var = DIRECTION_TO_SPEED.get(var_name)
        speed_da = datasets_hour.get(speed_var) if speed_var else None

        step = max(1, len(da_var.longitude) // 22)
        lon2d, lat2d = np.meshgrid(da_var.longitude.values, da_var.latitude.values)
        dir_deg = values

        theta = np.deg2rad(270.0 - dir_deg)
        u = np.cos(theta)
        v = np.sin(theta)

        if speed_da is not None:
            mag = speed_da.values
            mag_norm = np.where(np.isnan(mag), 0, mag)
            mag_max = np.nanmax(mag_norm) if np.nanmax(mag_norm) > 0 else 1.0
            scale_factor = mag_norm / mag_max
        else:
            scale_factor = np.ones_like(dir_deg)

        u_plot = u * scale_factor
        v_plot = v * scale_factor

        ax.quiver(
            lon2d[::step, ::step],
            lat2d[::step, ::step],
            u_plot[::step, ::step],
            v_plot[::step, ::step],
            transform=ccrs.PlateCarree(),
            color="black",
            scale=25,
            width=0.003,
            zorder=7,
        )

    out_png = MAPS_DIR / var_name / f"{var_name}_h{hour_index:02d}.png"
    out_png.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_png, dpi=DPI, pad_inches=0)
    plt.close(fig)


def process_all(datasets, extent, n_hours):
    """
    Per cada variable: retalla a l'extent.
    Per cada hora: construeix el diccionari {var: DataArray_hora} i genera
    un mapa complet per cada variable (amb fletxes per les de direcció).
    """
    cropped = {}
    time_dim = None
    for var_name, da in datasets.items():
        da_c = crop_to_extent(da, extent)
        cropped[var_name] = da_c
        if time_dim is None:
            time_dim = "time" if "time" in da_c.dims else "step"

    n_available = cropped[MAIN_VAR].sizes[time_dim]
    n_hours = min(n_hours, n_available)
    print(f"Hores disponibles: {n_available}. Processant les primeres {n_hours}.")

    for h in range(n_hours):
        datasets_hour = {var: da_c.isel({time_dim: h}) for var, da_c in cropped.items()}

        for var_name in datasets_hour:
            make_map(datasets_hour, var_name, extent, h + 1)

        print(f"  -> h{h + 1:02d}: {len(cropped)} mapes escrits")

    print(f"\nFET. {n_hours} hores x {len(cropped)} variables = {n_hours * len(cropped)} imatges.")
    print(f"  PNGs a: {MAPS_DIR.resolve()}")


def main():
    MAPS_DIR.mkdir(parents=True, exist_ok=True)

    datasets = load_forecast()

    if MAIN_VAR not in datasets:
        raise KeyError(
            f"'{MAIN_VAR}' no es troba entre les variables descarregades: "
            f"{list(datasets.keys())}. Canvia MAIN_VAR per una de la llista."
        )

    process_all(datasets, EXTENT, N_HOURS)


if __name__ == "__main__":
    main()