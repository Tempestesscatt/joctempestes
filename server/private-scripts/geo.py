"""
investigar_geo500_v2.py
═══════════════════════════════════════
 Prova amb diferents formats de pressió
 i sense SCALESIZE
═══════════════════════════════════════
"""

import json, re, time
import requests
import tifffile
import io
import numpy as np

with open("config2.json", encoding="utf-8") as f:
    cfg = json.load(f)

API_KEY = cfg["api_key"]
BASE_URL = "https://public-api.meteofrance.fr/public/arome/1.0"
SERVICE = "MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS"

session = requests.Session()
session.headers.update({"apikey": API_KEY})

print("=" * 60)
print("INVESTIGANT GEOPOTENTIAL 500 hPa v2")
print("=" * 60)

# ── Buscar coverage ──────────────────────────
url = f"{BASE_URL}/wcs/{SERVICE}/GetCapabilities?SERVICE=WCS&VERSION=2.0.1"
for intent in range(1, 6):
    try:
        r = session.get(url, timeout=90)
        if r.status_code == 200: break
        print(f"  HTTP {r.status_code}, esperant...")
    except Exception as e:
        print(f"  Error: {e}")
    time.sleep(15)

text = r.text
cov_ids = re.findall(r'<[^>]*CoverageId[^>]*>(.*?)</[^>]*CoverageId[^>]*>', text)
print(f"✅ {len(cov_ids)} CoverageIds")

# Buscar GEOPOTENTIAL__ISOBARIC_SURFACE
geo_cov = None
geo_run = None
for cid in cov_ids:
    if cid.startswith('GEOPOTENTIAL__ISOBARIC_SURFACE___'):
        m = re.search(r'(\d{4}-\d{2}-\d{2}T\d{2})\.\d{2}\.\d{2}Z', cid)
        if m:
            geo_cov = cid
            geo_run = m.group(1)
            break

if not geo_cov:
    print("❌ No trobat!")
    exit()

print(f"✅ Coverage: {geo_cov[:80]}...")
print(f"   Run: {geo_run}")

time_str = f"{geo_run}:00:00Z"
LON_MIN, LON_MAX = -5.0, 5.0
LAT_MIN, LAT_MAX = 40.0, 44.0

# ── Provar diferents valors de pressió ──────
print("\n🧪 Provant valors de pressió...")

proves = [
    ("50000", "50000"),     # Pascals
    ("500", "500"),         # hPa
    ("500.0", "500.0"),
    ("50000.0", "50000.0"),
]

for nom, valor in proves:
    print(f"\n  pressure={nom} ...", end=" ", flush=True)
    
    url = (f"{BASE_URL}/wcs/{SERVICE}/GetCoverage?"
           f"SERVICE=WCS&VERSION=2.0.1&COVERAGEID={geo_cov}&FORMAT=image/tiff"
           f"&SUBSET=long({LON_MIN},{LON_MAX})&SUBSET=lat({LAT_MIN},{LAT_MAX})"
           f"&SUBSET=time({time_str})&SUBSET=pressure({valor})")
    
    try:
        resp = session.get(url, timeout=60)
        print(f"HTTP {resp.status_code} | {len(resp.content)} bytes", end=" ")
        
        if resp.status_code == 200 and len(resp.content) > 500:
            arr = tifffile.imread(io.BytesIO(resp.content))
            if arr.ndim == 3: arr = arr[0]
            arr = arr.astype(np.float64)
            arr[arr > 9000] = np.nan
            valids = arr[~np.isnan(arr)]
            if len(valids) > 0:
                print(f"| Shape: {arr.shape} | {np.min(valids):.0f} a {np.max(valids):.0f}")
            else:
                print(f"| Shape: {arr.shape} | Sense dades vàlides")
        elif resp.status_code == 400:
            print(f"| {resp.text[:200]}")
        else:
            print()
    except Exception as e:
        print(f"| {e}")
    
    time.sleep(3)

# ── Provar amb DescribeCoverage ──────────────
print(f"\n{'='*60}")
print("📋 DescribeCoverage per veure els eixos disponibles")
print("="*60)

url_desc = (f"{BASE_URL}/wcs/{SERVICE}/DescribeCoverage?"
            f"SERVICE=WCS&VERSION=2.0.1&COVERAGEID={geo_cov}")

try:
    resp = session.get(url_desc, timeout=60)
    if resp.status_code == 200:
        # Buscar info de pressió
        text_desc = resp.text
        # Mostrar trossos rellevants
        if 'pressure' in text_desc.lower():
            print("✅ Conté 'pressure'")
            # Extreure valors de pressió disponibles
            pres_vals = re.findall(r'[>\\s](\\d+)[<\\s]', text_desc)
            if pres_vals:
                print(f"   Valors trobats: {pres_vals[:20]}")
        else:
            print("❌ No conté 'pressure'")
            print("   Buscant 'hPa' o 'Pa'...")
            if 'hpa' in text_desc.lower() or 'hectopascal' in text_desc.lower():
                print("   Trobat hPa!")
        print(f"\n   Primers 500 chars:\n{text_desc[:500]}")
    else:
        print(f"❌ HTTP {resp.status_code}")
except Exception as e:
    print(f"❌ {e}")

print(f"\n{'='*60}")
print("✅ Investigació completada")