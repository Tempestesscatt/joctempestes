#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
descarregar_linees.py
---------------------
Descarrega provincies d'Espanya i fronteres internacionals amb Cartopy
i genera un fitxer lineas.js amb window.LINEAS_MAPA = { provincies: [...], fronteres: [...] }

Requeriments:
    pip install cartopy shapely

Ús:
    python descarregar_linees.py
"""

import os
import json
from pathlib import Path

import cartopy.io.shapereader as shpreader
from shapely.geometry import MultiLineString, LineString, MultiPolygon, Polygon
from shapely.ops import unary_union

# ─── Configuració ──────────────────────────────────────────────────
OUT_PATH = Path(r"C:\Users\simob\Documents\GitHub\joctempestes\meu-mapa\public\dades\lineas.js")

# Àrea d'interès (per filtrar i reduir mida)
# Espanya + França + Andorra + Portugal (una mica més gran per cobrir marges)
BBOX = {
    "lon_min": -10.0,
    "lon_max": 5.0,
    "lat_min": 35.0,
    "lat_max": 44.5,
}

# Simplificació (en graus). 0.005 ≈ 500 m, suficient per zoom mitjà.
TOLERANCIA_SIMPLIFICACIO = 0.005

# Precisió decimal dels números (redueix molt la mida del fitxer)
DECIMALS = 4

# ─── Utilitats ─────────────────────────────────────────────────────

def _dins_bbox(geom):
    """Retorna True si la geometria toca el bbox."""
    minx, miny, maxx, maxy = geom.bounds
    return not (
        maxx < BBOX["lon_min"] or minx > BBOX["lon_max"] or
        maxy < BBOX["lat_min"] or miny > BBOX["lat_max"]
    )


def _linies_de_geometria(geom):
    """Extreu totes les LineStrings d'una geometria (Polygon, MultiPolygon, LineString...)."""
    linies = []

    if geom is None or geom.is_empty:
        return linies

    if isinstance(geom, LineString):
        linies.append(geom)
    elif isinstance(geom, MultiLineString):
        linies.extend(geom.geoms)
    elif isinstance(geom, Polygon):
        linies.append(LineString(geom.exterior.coords))
        for forat in geom.interiors:
            linies.append(LineString(forat.coords))
    elif isinstance(geom, MultiPolygon):
        for poly in geom.geoms:
            linies.extend(_linies_de_geometria(poly))
    elif hasattr(geom, "geoms"):  # GeometryCollection
        for g in geom.geoms:
            linies.extend(_linies_de_geometria(g))

    return linies


def _simplificar_i_convertir(geom, tolerancia):
    """Simplifica i retorna llista de llistes [[lon,lat], [lon,lat], ...]."""
    geom = geom.simplify(tolerancia, preserve_topology=False)
    resultat = []
    for linia in _linies_de_geometria(geom):
        coords = [[round(x, DECIMALS), round(y, DECIMALS)] for x, y in linia.coords]
        if len(coords) >= 2:
            resultat.append(coords)
    return resultat


def _retallar_a_bbox(geom):
    """Retalla la geometria al bbox d'interès."""
    from shapely.geometry import box
    bbox_geom = box(BBOX["lon_min"], BBOX["lat_min"], BBOX["lon_max"], BBOX["lat_max"])
    try:
        return geom.intersection(bbox_geom)
    except Exception:
        return geom


# ─── Províncies d'Espanya ──────────────────────────────────────────

def obtenir_provincies():
    """
    Descarrega les províncies d'Espanya.
    Nota: Natural Earth admin_1 inclou províncies d'Espanya.
    """
    print("[provincies] Descarregant admin_1_states_provinces...")
    shp = shpreader.natural_earth(
        resolution="10m",
        category="cultural",
        name="admin_1_states_provinces",
    )
    reader = shpreader.Reader(shp)

    provincies = []
    for record in reader.records():
        attrs = record.attributes
        # Filtrem només Espanya
        if attrs.get("admin") != "Spain":
            continue

        geom = record.geometry
        if not _dins_bbox(geom):
            continue

        nom = attrs.get("name") or attrs.get("name_local") or "?"
        geom = _retallar_a_bbox(geom)
        linies = _simplificar_i_convertir(geom, TOLERANCIA_SIMPLIFICACIO)

        if linies:
            provincies.append({
                "nom": nom,
                "linies": linies,
            })
            print(f"  - {nom}: {len(linies)} linies")

    return provincies


# ─── Fronteres internacionals ──────────────────────────────────────

def obtenir_fronteres():
    """
    Descarrega fronteres de països (admin_0_countries) i n'extreu els contorns.
    Així obtenim les línies de frontera entre països.
    """
    print("[fronteres] Descarregant admin_0_countries...")
    shp = shpreader.natural_earth(
        resolution="10m",
        category="cultural",
        name="admin_0_countries",
    )
    reader = shpreader.Reader(shp)

    geometries = []
    for record in reader.records():
        geom = record.geometry
        if _dins_bbox(geom):
            geometries.append(geom)

    if not geometries:
        return []

    # Unim totes les geometries i n'extraiem els límits
    print(f"  [fronteres] Fusionant {len(geometries)} geometries...")
    unio = unary_union(geometries)

    # Els límits de la unió són les fronteres exteriors + internes
    fronteres = []
    if hasattr(unio, "boundary"):
        boundary = unio.boundary
        boundary = _retallar_a_bbox(boundary)
        fronteres = _simplificar_i_convertir(boundary, TOLERANCIA_SIMPLIFICACIO)

    print(f"  [fronteres] {len(fronteres)} linies de frontera")
    return fronteres


# ─── Escriptura del JS ─────────────────────────────────────────────

def escriure_js(provincies, fronteres, path):
    path.parent.mkdir(parents=True, exist_ok=True)

    contingut = {
        "provincies": provincies,
        "fronteres": fronteres,
    }

    js = (
        "// Auto-generat per descarregar_linees.py\n"
        "// No editar a mà.\n"
        "window.LINEAS_MAPA = "
        + json.dumps(contingut, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(js)

    mida_kb = os.path.getsize(path) / 1024
    print(f"[OK] Escrit {path} ({mida_kb:.1f} KB)")


# ─── Main ──────────────────────────────────────────────────────────

def main():
    provincies = obtenir_provincies()
    fronteres = obtenir_fronteres()

    if not provincies and not fronteres:
        print("[!] No s'ha obtingut cap geometria. Comprova la connexió o Cartopy.")
        return

    escriure_js(provincies, fronteres, OUT_PATH)


if __name__ == "__main__":
    main()