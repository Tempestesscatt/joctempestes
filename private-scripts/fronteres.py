#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CONVERTEIX ALTITUD (metres) → PRESSIÓ (hPa)
============================================
Llegeix altitude.js i genera un fitxer JSON amb la pressió
equivalent (atmosfera estàndard) perquè el Skew-T el pugui fer servir.
"""

import json
import os
import re
import sys
from pathlib import Path

# ═══════════════ CONFIGURACIÓ ═══════════════

def carregar_altitud_des_de_js(js_path="altitude.js"):
    """
    Llegeix el fitxer altitude.js i extreu les dades de la variable "altitude".
    Retorna (lats, lons, data) on data és una matriu 2D d'altituds en metres.
    """
    if not os.path.exists(js_path):
        print(f"❌ No es troba el fitxer: {js_path}")
        return None
    
    with open(js_path, "r", encoding="utf-8") as f:
        contingut = f.read()
    
    # Buscar la variable "altitude" amb regex
    # Busquem: var altitude = { ... };
    patron = r'var\s+altitude\s*=\s*({[\s\S]*?});'
    match = re.search(patron, contingut)
    
    if not match:
        print("❌ No s'ha trobat la variable 'altitude' al fitxer")
        return None
    
    try:
        # Netejar i parsejar el JSON
        json_str = match.group(1)
        # Eliminar comentaris (// ...)
        json_str = re.sub(r'//.*?(\n|$)', '', json_str)
        # Eliminar espais innecessaris
        data = json.loads(json_str)
        
        lats = data.get("lat", [])
        lons = data.get("lon", [])
        altituds = data.get("data", [])
        
        if not lats or not lons or not altituds:
            print("❌ El fitxer no té les dades esperades (lat, lon, data)")
            return None
        
        print(f"✅ Altitud carregada: {len(lats)} lat × {len(lons)} lon = {len(lats)*len(lons)} punts")
        
        # Estadístiques
        vals = [v for fila in altituds for v in fila if v is not None and v != 'null']
        if vals:
            print(f"   Altitud: min={min(vals):.0f}m, max={max(vals):.0f}m, mitjana={sum(vals)/len(vals):.0f}m")
        
        return lats, lons, altituds
        
    except json.JSONDecodeError as e:
        print(f"❌ Error parsejant JSON: {e}")
        return None

def altitud_a_pressio(altitud_metres):
    """
    Converteix altitud en metres a pressió en hPa
    usant l'atmosfera estàndard (ICAO).
    
    Fórmula: p = p0 * (1 - lapse * z / T0)^(g / (R * lapse))
    """
    T0 = 288.15   # Temperatura a nivell del mar (K)
    p0 = 1013.25  # Pressió a nivell del mar (hPa)
    lapse = 0.0065  # Gradient tèrmic vertical (K/m)
    g = 9.80665   # Gravetat (m/s²)
    R = 287.05    # Constant dels gasos per a l'aire sec (J/kg·K)
    
    if altitud_metres is None or altitud_metres == 'null':
        return None
    
    # Fórmula hipsomètrica
    exponent = g / (R * lapse)
    pressio = p0 * (1 - (lapse * altitud_metres) / T0) ** exponent
    
    # La fórmula només és vàlida fins a ~11km
    if altitud_metres > 11000:
        # Tropopausa: aproximació simplificada
        pressio = 226.32 * (altitud_metres / 11000) ** -1.5
    
    return max(pressio, 50)  # No baixar de 50 hPa

def generar_json_pressio(lats, lons, altituds, output_path="pressio_des_de_altitud.js"):
    """
    Genera un fitxer JSON/JS amb el mateix format que gfs_pressio_superficial_ne.json
    però amb la pressió calculada a partir de l'altitud.
    """
    print(f"\n  📊 Convertint altitud → pressió...")
    
    n_lats = len(lats)
    n_lons = len(lons)
    
    # Convertir matriu d'altituds a matriu de pressions
    pressio_dades = []
    for i in range(n_lats):
        fila = []
        for j in range(n_lons):
            alt = altituds[i][j] if j < len(altituds[i]) else None
            if alt is not None and alt != 'null' and alt != '':
                pressio = altitud_a_pressio(alt)
                fila.append(round(pressio, 1) if pressio is not None else None)
            else:
                fila.append(None)
        pressio_dades.append(fila)
    
    # Estadístiques
    vals = [v for fila in pressio_dades for v in fila if v is not None]
    if vals:
        print(f"   Pressió: min={min(vals):.1f}hPa, max={max(vals):.1f}hPa, mitjana={sum(vals)/len(vals):.1f}hPa")
    
    # Crear estructura JSON (igual que gfs_pressio_superficial_ne.json)
    data = {
        "coordenadas": {
            "lat": [round(float(x), 4) for x in lats],
            "lon": [round(float(x), 4) for x in lons]
        },
        "variables": {
            "surface_pressure": {
                "nombre": "Pressió superficial (des de altitud real)",
                "unidades": "hPa",
                "datos": pressio_dades
            }
        }
    }
    
    # Guardar com a JS (perquè el Skew-T el pugui carregar)
    js_content = f"""// Pressió superficial calculada a partir de l'altitud real
// Generat el {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
// Font: altitude.js (altitud real en metres)
// Fórmula: atmosfera estàndard (ICAO)

var pressio_altitud = {json.dumps(data, ensure_ascii=False, indent=2)};
"""
    
    # Guardar fitxer
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    print(f"\n  ✅ Fitxer guardat: {output_path}")
    print(f"     Mida: {len(js_content) // 1024} KB")
    
    return output_path

def generar_json_pressio_flat(lats, lons, altituds, output_path="gfs_pressio_superficial_ne.json"):
    """
    Genera un fitxer JSON amb el format EXACTE que espera el Skew-T:
    - Les dades en 1D (flat), no en 2D
    - Amb "datos" com a array pla
    """
    print(f"\n  📊 Convertint altitud → pressió (format pla per Skew-T)...")
    
    n_lats = len(lats)
    n_lons = len(lons)
    
    # Convertir a array pla (1D)
    pressio_flat = []
    for i in range(n_lats):
        for j in range(n_lons):
            alt = altituds[i][j] if j < len(altituds[i]) else None
            if alt is not None and alt != 'null' and alt != '':
                pressio = altitud_a_pressio(alt)
                pressio_flat.append(round(pressio, 1) if pressio is not None else None)
            else:
                pressio_flat.append(None)
    
    # Estadístiques
    vals = [v for v in pressio_flat if v is not None]
    if vals:
        print(f"   Pressió: min={min(vals):.1f}hPa, max={max(vals):.1f}hPa, mitjana={sum(vals)/len(vals):.1f}hPa")
    
    # Crear estructura JSON (exactament igual que gfs_pressio_superficial_ne.json)
    data = {
        "coordenadas": {
            "lat": [round(float(x), 4) for x in lats],
            "lon": [round(float(x), 4) for x in lons]
        },
        "variables": {
            "surface_pressure": {
                "nombre": "Pressió superficial (des de altitud real)",
                "unidades": "hPa",
                "datos": pressio_flat
            }
        }
    }
    
    # Guardar com a JSON pur (perquè el Skew-T fa fetch)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n  ✅ Fitxer guardat: {output_path}")
    print(f"     Mida: {len(json.dumps(data)) // 1024} KB")
    print(f"     Punts: {len(pressio_flat)}")
    
    return output_path

def main():
    print("=" * 60)
    print("  🏔️  ALTITUD → PRESSIÓ (per Skew-T)")
    print("=" * 60)
    
    # 1. Carregar l'altitud des de altitude.js
    resultat = carregar_altitud_des_de_js("altitude.js")
    if resultat is None:
        print("\n  ❌ No s'han pogut carregar les dades d'altitud")
        print("     Assegura't que altitude.js existeix a la carpeta actual")
        sys.exit(1)
    
    lats, lons, altituds = resultat
    
    # 2. Preguntar quina sortida volem
    print("\n  📁 Opcions de sortida:")
    print("     1. gfs_pressio_superficial_ne.json (format pla, per Skew-T)")
    print("     2. pressio_des_de_altitud.js (format JS, per debug)")
    print("     3. Ambdós")
    
    opcio = input("\n  Selecciona (1/2/3): ").strip() or "1"
    
    # 3. Generar fitxers
    if opcio in ["1", "3"]:
        generar_json_pressio_flat(lats, lons, altituds, "gfs_pressio_superficial_ne.json")
    
    if opcio in ["2", "3"]:
        generar_json_pressio(lats, lons, altituds, "pressio_des_de_altitud.js")
    
    print("\n  ✅ FET! Ara el Skew-T farà servir la pressió calculada")
    print("     a partir de l'altitud REAL de cada punt.")
    print("\n  ⚠️  IMPORTANT: Col·loca 'gfs_pressio_superficial_ne.json'")
    print("     a la carpeta: meu-mapa/public/dades/")

if __name__ == "__main__":
    main()