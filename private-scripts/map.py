"""
crear_mapa_base_net.py — Mapa base net sense fronteres
═══════════════════════════════════════════════════════════════════════════════
 Genera un mapa base PNG de tot Europa sense fronteres ni decoracions
 Només mar i terra (útil com a base per superposar)
═══════════════════════════════════════════════════════════════════════════════
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.feature as cfeature
import os

# ═══════════════════ CONFIGURACIÓ ═══════════════════

LAT_MIN, LAT_MAX = 35.0, 72.0
LON_MIN, LON_MAX = -12.0, 45.0

OUTPUT_DIR = "web_data_arome"
NOM_FITXER = "mapa_base.png"

DPI = 200
FIG_WIDTH = 14
FIG_HEIGHT = 12

# Colors
COLOR_MAR = '#b5d6e8'      # Blau clar
COLOR_TERRA = '#e8e0d0'    # Beix/terra
COLOR_COSTA = '#2a3a4a'    # Gris fosc per la costa

# ═══════════════════ FUNCIÓ ═══════════════════

def crear_mapa_base():
    """Crea un mapa base sense fronteres ni decoracions"""
    
    print("=" * 60)
    print("  CREANT MAPA BASE (sense fronteres)")
    print("=" * 60)
    print(f"  Regió: LON {LON_MIN} a {LON_MAX}, LAT {LAT_MIN} a {LAT_MAX}")
    print(f"  DPI: {DPI}, Mida: {FIG_WIDTH}x{FIG_HEIGHT}")
    print(f"  Sortida: {OUTPUT_DIR}/{NOM_FITXER}")
    
    # Crear figura
    fig = plt.figure(figsize=(FIG_WIDTH, FIG_HEIGHT), dpi=DPI, facecolor='white')
    ax = plt.axes(projection=ccrs.PlateCarree())
    
    # Establir límits
    ax.set_extent([LON_MIN, LON_MAX, LAT_MIN, LAT_MAX], crs=ccrs.PlateCarree())
    
    # ── Afegir només mar i terra ──
    
    # 1. Mar (fons)
    ax.add_feature(cfeature.OCEAN, facecolor=COLOR_MAR, edgecolor='none')
    
    # 2. Terra
    ax.add_feature(cfeature.LAND, facecolor=COLOR_TERRA, edgecolor='none')
    
    # 3. Llacs (del mateix color que el mar)
    ax.add_feature(cfeature.LAKES, facecolor=COLOR_MAR, edgecolor='none')
    
    # 4. Costes (línia fina per definir el contorn)
    ax.add_feature(cfeature.COASTLINE, linewidth=1.2, edgecolor=COLOR_COSTA)
    
    # ── Eliminar TOTA decoració ──
    ax.set_axis_off()           # Treure eixos
    ax.set_frame_on(False)      # Treure el marc
    ax.set_title('')            # Sense títol
    
    # ── Guardar ──
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, NOM_FITXER)
    
    plt.savefig(path, 
                dpi=DPI, 
                bbox_inches='tight', 
                pad_inches=0, 
                facecolor='white',
                edgecolor='none')
    plt.close(fig)
    
    # Mida del fitxer
    size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"\n  ✅ Mapa guardat a: {path}")
    print(f"  📦 Mida: {size_mb:.1f} MB")
    print("=" * 60)
    
    return path

# ═══════════════════ MAIN ═══════════════════

if __name__ == "__main__":
    crear_mapa_base()