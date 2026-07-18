r"""
Descarga datos del modelo ICON-CH1-EPS (MeteoSwiss) via API oficial
y genera 4 PNGs (un per zona) de MAXIMA RESOLUCIO de temperatura i punt de rosada
sobre el Pirineu Catala. Sense etiquetes ni isolinies.

RESOLUCIO: ICON-CH1 (1 km) + INTERPOLACIO a 0.005 graus (~500m) + 400 DPI

IMPORTANTE (Windows): abans d'executar, fixa la variable d'entorn:
    $env:GRIB_DEFINITION_PATH = "C:\Users\simob\AppData\Local\Programs\Python\Python311\share\eccodes-cosmo-resources\definitions;C:\Users\simob\eccodes-definitions\definitions"
"""

from meteodatalab import ogd_api
import numpy as np
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.feature as cfeature
from scipy.interpolate import griddata
import matplotlib
matplotlib.use('Agg')

# -------------------------------------------------------------------------
# 1. Configuracio
# -------------------------------------------------------------------------
COLLECTION = "ogd-forecasting-icon-ch1"
LEAD_TIME = "P0DT6H"

print("Descarregant TEMPERATURA (T_2M)...")
req_temp = ogd_api.Request(
    collection=COLLECTION,
    variable="T_2M",
    ref_time="latest",
    perturbed=False,
    lead_time=LEAD_TIME,
)
da_temp = ogd_api.get_from_ogd(req_temp)
print("OK")

print("Descarregant PUNT DE ROSADA (TD_2M)...")
req_td = ogd_api.Request(
    collection=COLLECTION,
    variable="TD_2M",
    ref_time="latest",
    perturbed=False,
    lead_time=LEAD_TIME,
)
da_td = ogd_api.get_from_ogd(req_td)
print("OK")

# -------------------------------------------------------------------------
# 2. Extreure dades
# -------------------------------------------------------------------------
lon = da_temp["lon"].values
lat = da_temp["lat"].values
temp_values = da_temp.squeeze().values - 273.15
td_values = da_td.squeeze().values - 273.15

ref_time = str(da_temp["ref_time"].values[0])[:16].replace("T", " ")
valid_time = str(da_temp["valid_time"].values.flatten()[0])[:16].replace("T", " ")

# -------------------------------------------------------------------------
# 3. Definir les 4 zones
# -------------------------------------------------------------------------
zonas = {
    'zona1_occidental': {
        'nom': 'Pirineu Occidental (Vall Aran, Ribagorca, Pallars)',
        'lon_min': 0.4, 'lon_max': 1.3,
        'lat_min': 42.2, 'lat_max': 42.95
    },
    'zona2_central': {
        'nom': 'Pirineu Central (Alt Urgell, Andorra, Cerdanya Oest)',
        'lon_min': 1.2, 'lon_max': 1.85,
        'lat_min': 42.2, 'lat_max': 42.95
    },
    'zona3_oriental': {
        'nom': 'Pirineu Oriental (Cerdanya Est, Ripolles, Garrotxa)',
        'lon_min': 1.75, 'lon_max': 2.6,
        'lat_min': 42.0, 'lat_max': 42.8
    },
    'zona4_prepirineu': {
        'nom': 'Prepirineu i Alt Emporda (Bergueda, Osona, Figueres)',
        'lon_min': 1.6, 'lon_max': 3.3,
        'lat_min': 41.7, 'lat_max': 42.3
    }
}

def interpolate_to_grid(lon_pts, lat_pts, values, lon_min, lon_max, lat_min, lat_max, resolution=0.005):
    """
    Interpola dades disperses a una graella regular d'alta resolucio.
    resolution=0.005 graus = ~500 metres
    """
    # Crear graella regular
    xi = np.arange(lon_min, lon_max, resolution)
    yi = np.arange(lat_min, lat_max, resolution)
    xi_grid, yi_grid = np.meshgrid(xi, yi)
    
    # Interpolar usant 'linear' (mes rapid) o 'cubic' (mes suau)
    zi_grid = griddata(
        (lon_pts, lat_pts), values,
        (xi_grid, yi_grid),
        method='linear'
    )
    
    return xi_grid, yi_grid, zi_grid

def setup_clean_map(ax, lon_min, lon_max, lat_min, lat_max):
    """Mapa net amb maxima qualitat geografica"""
    ax.set_extent([lon_min, lon_max, lat_min, lat_max], crs=ccrs.PlateCarree())
    
    # Capes base
    ax.add_feature(cfeature.OCEAN, facecolor="#d4e6f1", alpha=0.85, zorder=0)
    ax.add_feature(cfeature.LAND, facecolor="#e8e0d5", alpha=0.35, zorder=0)
    ax.add_feature(cfeature.LAKES, facecolor="#a8d5e5", edgecolor='#1a4d6e',
                   linewidth=0.8, alpha=0.85, zorder=1)
    
    # Costa
    ax.add_feature(cfeature.COASTLINE, linewidth=2.0, edgecolor='#0d0d0d', zorder=3)
    
    # Fronteres
    ax.add_feature(cfeature.BORDERS, linewidth=3.5, edgecolor='#6b0000',
                   linestyle='-', alpha=0.95, zorder=4)
    
    # Limits administratius
    admin_borders = cfeature.NaturalEarthFeature(
        category='cultural',
        name='admin_1_states_provinces_lines',
        scale='10m',
        facecolor='none',
        edgecolor='#444444',
        linewidth=1.5,
        linestyle='--'
    )
    ax.add_feature(admin_borders)
    
    # Rius
    ax.add_feature(cfeature.RIVERS, edgecolor="#1a4d6e", linewidth=0.8,
                   alpha=0.75, zorder=2)
    
    # Gridlines sense etiquetes
    gl = ax.gridlines(draw_labels=False, linewidth=0.5, color="gray",
                      alpha=0.35, linestyle='--')

# -------------------------------------------------------------------------
# 4. Generar un PNG per cada zona
# -------------------------------------------------------------------------
for zona_key, zona_data in zonas.items():
    print(f"\n{'='*60}")
    print(f"Processant {zona_data['nom']}...")
    
    lon_min, lon_max = zona_data['lon_min'], zona_data['lon_max']
    lat_min, lat_max = zona_data['lat_min'], zona_data['lat_max']
    
    # Mascara per agafar punts
    mask = (
        (lon >= lon_min - 0.05) & (lon <= lon_max + 0.05) &
        (lat >= lat_min - 0.05) & (lat <= lat_max + 0.05)
    )
    
    lon_zone = lon[mask]
    lat_zone = lat[mask]
    temp_zone = temp_values[mask]
    td_zone = td_values[mask]
    
    n_points = len(lon_zone)
    print(f"Punts originals (1 km): {n_points:,}")
    print(f"Temperatura original: {temp_zone.min():.1f}C a {temp_zone.max():.1f}C")
    print(f"Punt Rosada original: {td_zone.min():.1f}C a {td_zone.max():.1f}C")
    
    if n_points < 10:
        print(f"ATENCIO: Pocs punts, saltant...")
        continue
    
    # INTERPOLAR a graella regular d'alta resolucio (~500m)
    print("Interpolant a graella regular (0.005 graus = ~500m)...")
    
    xi_t, yi_t, temp_grid = interpolate_to_grid(
        lon_zone, lat_zone, temp_zone,
        lon_min, lon_max, lat_min, lat_max,
        resolution=0.005
    )
    
    xi_td, yi_td, td_grid = interpolate_to_grid(
        lon_zone, lat_zone, td_zone,
        lon_min, lon_max, lat_min, lat_max,
        resolution=0.005
    )
    
    grid_shape = temp_grid.shape
    print(f"Graella interpolada: {grid_shape[1]} x {grid_shape[0]} = {grid_shape[0]*grid_shape[1]:,} pixels")
    
    # Crear figura ENORME
    fig, (ax1, ax2) = plt.subplots(
        1, 2,
        figsize=(30, 18),
        subplot_kw={'projection': ccrs.PlateCarree()}
    )
    
    # ---- MAPA 1: TEMPERATURA ----
    setup_clean_map(ax1, lon_min, lon_max, lat_min, lat_max)
    
    vmin_t = np.floor(np.nanmin(temp_grid))
    vmax_t = np.ceil(np.nanmax(temp_grid))
    
    # Usar pcolormesh amb la graella regular (MOLT MES NITID)
    mesh_t = ax1.pcolormesh(
        xi_t, yi_t, temp_grid,
        cmap='RdYlBu_r',
        shading='gouraud',
        transform=ccrs.PlateCarree(),
        zorder=2,
        alpha=0.92,
        vmin=vmin_t,
        vmax=vmax_t,
        rasterized=True  # Evita pixelat en el PNG final
    )
    
    cbar_t = plt.colorbar(mesh_t, ax=ax1, orientation="horizontal",
                          pad=0.05, shrink=0.72)
    cbar_t.set_label('Temperatura (C)', fontsize=14, fontweight='bold')
    cbar_t.ax.tick_params(labelsize=11)
    
    ax1.set_title(f'TEMPERATURA A 2m\n{zona_data["nom"]}',
                  fontsize=16, fontweight='bold', pad=15)
    
    # ---- MAPA 2: PUNT DE ROSADA ----
    setup_clean_map(ax2, lon_min, lon_max, lat_min, lat_max)
    
    vmin_td = np.floor(np.nanmin(td_grid))
    vmax_td = np.ceil(np.nanmax(td_grid))
    
    mesh_td = ax2.pcolormesh(
        xi_td, yi_td, td_grid,
        cmap='BrBG',
        shading='gouraud',
        transform=ccrs.PlateCarree(),
        zorder=2,
        alpha=0.92,
        vmin=vmin_td,
        vmax=vmax_td,
        rasterized=True
    )
    
    cbar_td = plt.colorbar(mesh_td, ax=ax2, orientation="horizontal",
                           pad=0.05, shrink=0.72)
    cbar_td.set_label('Punt de Rosada (C)', fontsize=14, fontweight='bold')
    cbar_td.ax.tick_params(labelsize=11)
    
    ax2.set_title(f'PUNT DE ROSADA A 2m\n{zona_data["nom"]}',
                  fontsize=16, fontweight='bold', pad=15)
    
    # Titol general
    fig.suptitle(f'ICON-CH1-EPS (1 km) + INTERPOLACIO 500m\n'
                 f'Run: {ref_time} UTC | Valid: {valid_time} UTC (+{LEAD_TIME[-2:]}h)',
                 fontsize=16, fontweight='bold', y=1.015)
    
    # Guardar PNG individual a 400 DPI
    plt.tight_layout(pad=2.5, w_pad=3.5)
    output_file = f"pirineu_{zona_key}_temp_rosada_INTERPOLAT_400DPI.png"
    plt.savefig(output_file, dpi=400, bbox_inches="tight", facecolor='white',
                edgecolor='none', format='png', pil_kwargs={'optimize': True})
    plt.close('all')
    
    print(f"GUARDAT: {output_file}")
    print(f"  - Mida figura: 30x18 polzades")
    print(f"  - DPI: 400")
    print(f"  - Pixels sortida: 12000 x 7200")
    print(f"  - Graella: {grid_shape[1]} x {grid_shape[0]} pixels")

print(f"\n{'='*60}")
print(f"TOTS ELS MAPES GUARDATS:")
print(f"  1. pirineu_zona1_occidental_temp_rosada_INTERPOLAT_400DPI.png")
print(f"  2. pirineu_zona2_central_temp_rosada_INTERPOLAT_400DPI.png")
print(f"  3. pirineu_zona3_oriental_temp_rosada_INTERPOLAT_400DPI.png")
print(f"  4. pirineu_zona4_prepirineu_temp_rosada_INTERPOLAT_400DPI.png")
print(f"\nMILLORES APLICADES:")
print(f"  - Interpolacio a graella regular de 0.005 graus (~500m)")
print(f"  - pcolormesh en lloc de tripcolor (mes nitid)")
print(f"  - rasterized=True per evitar pixelat")
print(f"  - Figura 30x18 polzades")
print(f"  - 400 DPI")
print(f"{'='*60}")