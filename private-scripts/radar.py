"""
Genera datos de radar OPERA para visualización web.
Descarga el composite más reciente y 60 minutos anteriores.
Filtrado para NE de España (Catalunya, Aragó, València, Illes Balears).
MÀXIMA RESOLUCIÓ (step=1) · Borra carpeta abans de generar.
INTERVAL: 10 minuts entre frames.
"""

import requests
import h5py
import numpy as np
import json
import os
import shutil
from datetime import datetime, timedelta, timezone
from pyproj import CRS, Transformer
from pathlib import Path
import sys

# ---------------------------------------------------------------------------
# CONFIGURACIÓN
# ---------------------------------------------------------------------------

API_KEY = "eyJ4NXQiOiJZV0kxTTJZNE1qWTNOemsyTkRZeU5XTTRPV014TXpjek1UVmhNbU14T1RSa09ETXlOVEE0Tnc9PSIsImtpZCI6ImdhdGV3YXlfY2VydGlmaWNhdGVfYWxpYXMiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJTaW1vTWV0ZW9AY2FyYm9uLnN1cGVyIiwiYXBwbGljYXRpb24iOnsib3duZXIiOiJTaW1vTWV0ZW8iLCJ0aWVyUXVvdGFUeXBlIjpudWxsLCJ0aWVyIjoiVW5saW1pdGVkIiwibmFtZSI6IkRlZmF1bHRBcHBsaWNhdGlvbiIsImlkIjozMDc0MSwidXVpZCI6ImQxN2MxNzg3LTczZDktNGRhOC1iNmMzLTI1ZmYyNzE4MTgwYiJ9LCJpc3MiOiJodHRwczpcL1wvcG9ydGFpbC1hcGkubWV0ZW9mcmFuY2UuZnI6NDQzXC9vYXV0aDJcL3Rva2VuIiwidGllckluZm8iOnsiQnJvbnplIjp7InRpZXJRdW90YVR5cGUiOiJyZXF1ZXN0Q291bnQiLCJncmFwaFFMTWF4Q29tcGxleGl0eSI6MCwiZ3JhcGhRTE1heERlcHRoIjowLCJzdG9wT25RdW90YVJlYWNoIjp0cnVlLCJzcGlrZUFycmVzdExpbWl0IjowLCJzcGlrZUFycmVzdFVuaXQiOm51bGx9LCI1MFBlck1pbiI6eyJ0aWVyUXVvdGFUeXBlIjoicmVxdWVzdENvdW50IiwiZ3JhcGhRTE1heENvbXBsZXhpdHkiOjAsImdyYXBoUUxNYXhEZXB0aCI6MCwic3RvcE9uUXVvdGFSZWFjaCI6dHJ1ZSwic3Bpa2VBcnJlc3RMaW1pdCI6MCwic3Bpa2VBcnJlc3RVbml0Ijoic2VjIn0sIjEwMFJlcVBlck1pbiI6eyJ0aWVyUXVvdGFUeXBlIjoicmVxdWVzdENvdW50IiwiZ3JhcGhRTE1heENvbXBsZXhpdHkiOjAsImdyYXBoUUxNYXhEZXB0aCI6MCwic3RvcE9uUXVvdGFSZWFjaCI6dHJ1ZSwic3Bpa2VBcnJlc3RMaW1pdCI6MCwic3Bpa2VBcnJlc3RVbml0Ijoic2VjIn0sIjQwMFJlcU1pbiI6eyJ0aWVyUXVvdGFUeXBlIjoicmVxdWVzdENvdW50IiwiZ3JhcGhRTE1heENvbXBsZXhpdHkiOjAsImdyYXBoUUxNYXhEZXB0aCI6MCwic3RvcE9uUXVvdGFSZWFjaCI6dHJ1ZSwic3Bpa2VBcnJlc3RMaW1pdCI6MCwic3Bpa2VBcnJlc3RVbml0Ijoic2VjIn0sIjM1MFJlcVBhck1pbiI6eyJ0aWVyUXVvdGFUeXBlIjoicmVxdWVzdENvdW50IiwiZ3JhcGhRTE1heENvbXBsZXhpdHkiOjAsImdyYXBoUUxNYXhEZXB0aCI6MCwic3RvcE9uUXVvdGFSZWFjaCI6dHJ1ZSwic3Bpa2VBcnJlc3RMaW1pdCI6MCwic3Bpa2VBcnJlc3RVbml0Ijoic2VjIn0sIjkwMFJlcU1pbiI6eyJ0aWVyUXVvdGFUeXBlIjoicmVxdWVzdENvdW50IiwiZ3JhcGhRTE1heENvbXBsZXhpdHkiOjAsImdyYXBoUUxNYXhEZXB0aCI6MCwic3RvcE9uUXVvdGFSZWFjaCI6dHJ1ZSwic3Bpa2VBcnJlc3RMaW1pdCI6MCwic3Bpa2VBcnJlc3RVbml0Ijoic2VjIn19LCJrZXl0eXBlIjoiUFJPRFVDVElPTiIsInN1YnNjcmliZWRBUElzIjpbeyJzdWJzY3JpYmVyVGVuYW50RG9tYWluIjoiY2FyYm9uLnN1cGVyIiwibmFtZSI6IlByZXZpc2lvbkltbWVkaWF0ZVByZWNpcGl0YXRpb25zIiwiY29udGV4dCI6IlwvcHJvXC9waWFmXC8xLjAiLCJwdWJsaXNoZXIiOiJhZG1pbl9tZiIsInZlcnNpb24iOiIxLjAiLCJzdWJzY3JpcHRpb25UaWVyIjoiNTBQZXJNaW4ifSx7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiQVJPTUUiLCJjb250ZXh0IjoiXC9wdWJsaWNcL2Fyb21lXC8xLjAiLCJwdWJsaXNoZXIiOiJhZG1pbl9tZiIsInZlcnNpb24iOiIxLjAiLCJzdWJzY3JpcHRpb25UaWVyIjoiNTBQZXJNaW4ifSx7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiQVJPTUUtUEkiLCJjb250ZXh0IjoiXC9wdWJsaWNcL2Fyb21lcGlcLzEuMCIsInB1Ymxpc2hlciI6ImFkbWluX21mIiwidmVyc2lvbiI6IjEuMCIsInN1YnNjcmlwdGlvblRpZXIiOiI1MFBlck1pbiJ9LHsic3Vic2NyaWJlclRlbmFudERvbWFpbiI6ImNhcmJvbi5zdXBlciIsIm5hbWUiOiJSYWRhck9wZXJhIiwiY29udGV4dCI6IlwvcGFydG5lclwvcmFkYXJcL29wZXJhXC8xLjAiLCJwdWJsaXNoZXIiOiJNRVRFTy5GUlwvbWFydGlubCIsInZlcnNpb24iOiIxLjAiLCJzdWJzY3JpcHRpb25UaWVyIjoiQnJvbnplIn0seyJzdWJzY3JpYmVyVGVuYW50RG9tYWluIjoiY2FyYm9uLnN1cGVyIiwibmFtZSI6IkFSUEVHRSIsImNvbnRleHQiOiJcL3B1YmxpY1wvYXJwZWdlXC8xLjAiLCJwdWJsaXNoZXIiOiJhZG1pbl9tZiIsInZlcnNpb24iOiIxLjAiLCJzdWJzY3JpcHRpb25UaWVyIjoiNTBQZXJNaW4ifSx7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiV2F2ZXNNb2RlbHMiLCJjb250ZXh0IjoiXC9wdWJsaWNcL3dhdmVzbW9kZWxzXC8xLjAiLCJwdWJsaXNoZXIiOiJhZG1pbl9tZiIsInZlcnNpb24iOiIxLjAiLCJzdWJzY3JpcHRpb25UaWVyIjoiNTBQZXJNaW4ifSx7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiRG9ubmVlc1B1YmxpcXVlc09ic2VydmF0aW9uIiwiY29udGV4dCI6IlwvcHVibGljXC9EUE9ic1wvdjIiLCJwdWJsaXNoZXIiOiJiYXN0aWVuZyIsInZlcnNpb24iOiJ2MiIsInN1YnNjcmlwdGlvblRpZXIiOiIxMDBSZXFQZXJNaW4ifSx7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiRG9ubmVlc1B1YmxpcXVlc0JSQSIsImNvbnRleHQiOiJcL3B1YmxpY1wvRFBCUkFcL3YxIiwicHVibGlzaGVyIjoiYmFzdGllbmciLCJ2ZXJzaW9uIjoidjEiLCJzdWJzY3JpcHRpb25UaWVyIjoiNTBQZXJNaW4ifSx7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiUGFxdWV0QVJQRUdFIiwiY29udGV4dCI6IlwvcHJldmludW1cL0RQUGFxdWV0QVJQRUdFXC92MSIsInB1Ymxpc2hlciI6ImZyaXNib3VyZyIsInZlcnNpb24iOiJ2MSIsInN1YnNjcmlwdGlvblRpZXIiOiI1MFBlck1pbiJ9LHsic3Vic2NyaWJlclRlbmFudERvbWFpbiI6ImNhcmJvbi5zdXBlciIsIm5hbWUiOiJQYXF1ZXRXQVZFU01PREVMUyIsImNvbnRleHQiOiJcL3ByZXZpbnVtXC9EUFBhcXVldFdBVkVTTU9ERUxTXC92MSIsInB1Ymxpc2hlciI6ImZyaXNib3VyZyIsInZlcnNpb24iOiJ2MSIsInN1YnNjcmlwdGlvblRpZXIiOiIxMDBSZXFQZXJNaW4ifSx7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiRG9ubmVlc1B1YmxpcXVlc1BhcXVldFJhZGFyIiwiY29udGV4dCI6IlwvcHVibGljXC9EUFBhcXVldFJhZGFyXC92MSIsInB1Ymxpc2hlciI6ImxvaWMubWFydGluIiwidmVyc2lvbiI6InYxIiwic3Vic2NyaXB0aW9uVGllciI6IjUwUGVyTWluIn0seyJzdWJzY3JpYmVyVGVuYW50RG9tYWluIjoiY2FyYm9uLnN1cGVyIiwibmFtZSI6IlBFLUFST01FIiwiY29udGV4dCI6IlwvcHVibGljXC9wZWFyb21lXC8xLjAiLCJwdWJsaXNoZXIiOiJtdXJpZWwuYXViaW4iLCJ2ZXJzaW9uIjoiMS4wIiwic3Vic2NyaXB0aW9uVGllciI6IjkwMFJlcU1pbiJ9LHsic3Vic2NyaWJlclRlbmFudERvbWFpbiI6ImNhcmJvbi5zdXBlciIsIm5hbWUiOiJEb25uZWVzUHVibGlxdWVzQ2xpbWF0b2xvZ2llIiwiY29udGV4dCI6IlwvcHVibGljXC9EUENsaW1cL3YxIiwicHVibGlzaGVyIjoiYWRtaW5fbWYiLCJ2ZXJzaW9uIjoidjEiLCJzdWJzY3JpcHRpb25UaWVyIjoiNTBQZXJNaW4ifSx7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiUGFxdWV0QVJPTUUtT00iLCJjb250ZXh0IjoiXC9wcmV2aW51bVwvRFBQYXF1ZXRBUk9NRS1PTVwvdjEiLCJwdWJsaXNoZXIiOiJmcmlzYm91cmciLCJ2ZXJzaW9uIjoidjEiLCJzdWJzY3JpcHRpb25UaWVyIjoiMzUwUmVxUGFyTWluIn0seyJzdWJzY3JpYmVyVGVuYW50RG9tYWluIjoiY2FyYm9uLnN1cGVyIiwibmFtZSI6IlBhcXVldEVOVklST05ORU1FTlQiLCJjb250ZXh0IjoiXC9wcmV2aW51bVwvRFBQYXF1ZXRFTlZJUk9OTkVNRU5UXC92MSIsInB1Ymxpc2hlciI6Im11cmllbC5hdWJpbiIsInZlcnNpb24iOiJ2MSIsInN1YnNjcmlwdGlvblRpZXIiOiIxMDBSZXFQZXJNaW4ifSx7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiUGFxdWV0QVJPTUVJRlMiLCJjb250ZXh0IjoiXC9wcmV2aW51bVwvRFBQYXF1ZXRBUk9NRUlGU1wvdjEiLCJwdWJsaXNoZXIiOiJtdXJpZWwuYXViaW4iLCJ2ZXJzaW9uIjoidjEiLCJzdWJzY3JpcHRpb25UaWVyIjoiMTAwUmVxUGVyTWluIn0seyJzdWJzY3JpYmVyVGVuYW50RG9tYWluIjoiY2FyYm9uLnN1cGVyIiwibmFtZSI6IlBFLUFSUEVHRSIsImNvbnRleHQiOiJcL3B1YmxpY1wvcGVhcnBlZ2VcLzEuMCIsInB1Ymxpc2hlciI6Im11cmllbC5hdWJpbiIsInZlcnNpb24iOiIxLjAiLCJzdWJzY3JpcHRpb25UaWVyIjoiNDAwUmVxTWluIn1dLCJleHAiOjE4NzkyMjM1MTIsInRva2VuX3R5cGUiOiJhcGlLZXkiLCJpYXQiOjE3ODQ1NTA3MTIsImp0aSI6IjEyMTEyMTJkLTEwODQtNDYwNC05MGE4LTc2OGVmM2Y4NjdlYiJ9.AhKyoHLJFVsqJ_OT4KA9fBEkqMbon_lYAjItpMyrV6HeyqiQ_yMSeZMj0PtBUFSgnpt6q1oSV98aOfQeGdKPom2WtOyLzdwYznlXWvmFOQ4fb-BNckN-V3P-2mqzYQtZ5-aW6h2oPr4lcxwA6lJlLoizokFR1UVilcbtTd83TvICE9RBicypUseo34d_S51iDV_g6XN_bnIuHiVQK1D9hz9ToXofN3l78FsTfVa2uy9OtcDEGNS6BaANLnSvmZTNPgNeY3_dVivsDIlW5GXI-2Q-xUbE-knNmUzy7PI77fiKchmbC1A-0ax0dsLNX0TRxM3K8eOZzGvzTwwrfnC0tg=="

BASE_URL = "https://partner-api.meteofrance.fr/partner/radar/opera/1.0/realtime/cirrus/composite/REFLECTIVITY/{date}?format=HDF5"

# Ruta relativa: funciona tant en local (Windows) com a GitHub Actions (Linux)
SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR.parent.parent / "public" / "dades_radar"

# Regió: NE Espanya
REGIO = {
    "lat_min": 38.5,
    "lat_max": 43.0,
    "lon_min": -2.0,
    "lon_max": 5.0
}

# INTERVAL EN MINUTS (10 minuts)
INTERVAL_MINUTS = 10
MAX_FRAMES = 7  # 7 frames × 10 minuts = 70 minuts

# ---------------------------------------------------------------------------
# FUNCIONS
# ---------------------------------------------------------------------------

def round_down_interval(dt, interval_min=10):
    """Arrodoneix al múltiple de l'interval inferior"""
    minute = (dt.minute // interval_min) * interval_min
    return dt.replace(minute=minute, second=0, microsecond=0)

def format_mida(bytes_count):
    if bytes_count < 1024:
        return f"{bytes_count} B"
    elif bytes_count < 1024 * 1024:
        return f"{bytes_count / 1024:.1f} KB"
    else:
        return f"{bytes_count / (1024 * 1024):.2f} MB"

def netejar_carpeta(carpeta):
    if carpeta.exists():
        for fitxer in carpeta.glob("radar_*.js"):
            fitxer.unlink()
            print(f"  Esborrat: {fitxer.name}")
        print(f"  Carpeta netejada\n")

def find_latest_frames(api_key, max_frames=7, interval_min=10):
    now = datetime.now(timezone.utc)
    candidate = round_down_interval(now, interval_min)
    headers = {"accept": "application/x-hdf", "apikey": api_key}
    frames = []
    
    for i in range(max_frames):
        ts = candidate.strftime("%Y-%m-%dT%H%M%SZ")
        url = BASE_URL.format(date=ts)
        
        try:
            print(f"  Provant {ts} ...", end=" ")
            resp = requests.get(url, headers=headers, timeout=30)
            print(f"HTTP {resp.status_code}")
            
            if resp.status_code == 200 and resp.content:
                mida = format_mida(len(resp.content))
                print(f"    Descarregat ({mida})")
                frames.append((candidate, resp.content))
                if len(frames) >= max_frames:
                    break
        except Exception as e:
            print(f"    Error: {e}")
        
        candidate -= timedelta(minutes=interval_min)
    
    return frames

def is_point_in_region(lat, lon, regio):
    return (regio["lat_min"] <= lat <= regio["lat_max"] and 
            regio["lon_min"] <= lon <= regio["lon_max"])

def process_frame(h5data, regio):
    import tempfile
    
    with tempfile.NamedTemporaryFile(suffix='.hdf', delete=False) as tmp:
        tmp.write(h5data)
        tmp_path = tmp.name
    
    try:
        with h5py.File(tmp_path, "r") as f:
            where = f["where"].attrs
            what = f["what"].attrs
            data_grp = f["dataset1"]["data1"]
            raw = data_grp["data"][:]
            data_what = data_grp["what"].attrs
            
            gain = float(data_what.get("gain", 1.0))
            offset = float(data_what.get("offset", 0.0))
            nodata = data_what.get("nodata", None)
            undetect = data_what.get("undetect", None)
            
            dbz = raw.astype(float) * gain + offset
            if nodata is not None:
                dbz = np.where(raw == nodata, np.nan, dbz)
            if undetect is not None:
                dbz = np.where(raw == undetect, np.nan, dbz)
            
            projdef = where["projdef"]
            if isinstance(projdef, bytes):
                projdef = projdef.decode()
            
            proj_crs = CRS.from_proj4(projdef)
            
            ll_lon = float(where["LL_lon"])
            ll_lat = float(where["LL_lat"])
            ur_lon = float(where["UR_lon"])
            ur_lat = float(where["UR_lat"])
            
            fwd = Transformer.from_crs("EPSG:4326", proj_crs, always_xy=True)
            x0, y0 = fwd.transform(ll_lon, ll_lat)
            x1, y1 = fwd.transform(ur_lon, ur_lat)
            
            ny, nx = dbz.shape
            
            step = 1  # Màxima resolució
            xs = np.linspace(x0, x1, nx)[::step]
            ys = np.linspace(y1, y0, ny)[::step]
            dbz_reduced = dbz[::step, ::step]
            
            xx, yy = np.meshgrid(xs, ys)
            inv = Transformer.from_crs(proj_crs, "EPSG:4326", always_xy=True)
            lons, lats = inv.transform(xx, yy)
            
            points = []
            min_lat, max_lat = 90, -90
            min_lon, max_lon = 180, -180
            
            for i in range(dbz_reduced.shape[0]):
                for j in range(dbz_reduced.shape[1]):
                    if not np.isnan(dbz_reduced[i, j]):
                        lat = float(lats[i, j])
                        lon = float(lons[i, j])
                        
                        if is_point_in_region(lat, lon, regio):
                            points.append({
                                "lat": lat,
                                "lon": lon,
                                "dbz": float(dbz_reduced[i, j])
                            })
                            
                            if lat < min_lat: min_lat = lat
                            if lat > max_lat: max_lat = lat
                            if lon < min_lon: min_lon = lon
                            if lon > max_lon: max_lon = lon
            
            if len(points) == 0:
                min_lat, max_lat = regio["lat_min"], regio["lat_max"]
                min_lon, max_lon = regio["lon_min"], regio["lon_max"]
            else:
                marge = 0.1
                min_lat -= marge
                max_lat += marge
                min_lon -= marge
                max_lon += marge
            
            date_str = what.get("date", b"")
            time_str = what.get("time", b"")
            if isinstance(date_str, bytes): date_str = date_str.decode()
            if isinstance(time_str, bytes): time_str = time_str.decode()
            
            if len(str(date_str)) == 8:
                ts = f"{str(date_str)[:4]}-{str(date_str)[4:6]}-{str(date_str)[6:8]}"
            else:
                ts = str(date_str)
            
            if len(str(time_str)) == 6:
                ts += f"T{str(time_str)[:2]}:{str(time_str)[2:4]}:{str(time_str)[4:6]}Z"
            elif time_str:
                ts += f"T{time_str}Z"
            else:
                ts += "T00:00:00Z"
            
            return {
                "bounds": {
                    "north": float(max_lat),
                    "south": float(min_lat),
                    "east": float(max_lon),
                    "west": float(min_lon)
                },
                "points": points,
                "timestamp": ts
            }
    finally:
        os.unlink(tmp_path)

def generate_web_files(frames_data):
    if not frames_data:
        print("\nNo hi ha dades per generar")
        return
    
    mida_total = 0
    
    metadata = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "region": "NE_Espanya",
        "resolution": "max (step=1)",
        "interval": f"{INTERVAL_MINUTS} min",
        "frames": []
    }
    
    for i, frame in enumerate(frames_data):
        metadata["frames"].append({
            "id": f"frame_{i}",
            "timestamp": frame["timestamp"],
            "file": f"radar_frame_{i}.js",
            "bounds": frame["bounds"]
        })
        
        js_content = f"""// Radar frame {frame['timestamp']} - NE Espanya
window.radarFrame_{i} = {{
    timestamp: "{frame['timestamp']}",
    bounds: {json.dumps(frame['bounds'])},
    points: {json.dumps(frame['points'], separators=(',', ':'))}
}};
"""
        
        js_file = OUTPUT_DIR / f"radar_frame_{i}.js"
        with open(js_file, 'w', encoding='utf-8') as f:
            f.write(js_content)
        
        mida = js_file.stat().st_size
        mida_total += mida
        print(f"  radar_frame_{i}.js  ->  {len(frame['points']):,} punts  |  {format_mida(mida)}")
    
    metadata["latest_frame"] = f"radar_frame_{len(frames_data)-1}.js"
    
    metadata_js = f"""// Radar metadata - actualitzat {metadata['updated']}
// Regió: NE Espanya · Resolució: màxima (step=1) · Interval: {INTERVAL_MINUTS} min
window.radarMetadata = {json.dumps(metadata, indent=2)};
"""
    
    metadata_file = OUTPUT_DIR / "radar_metadata.js"
    with open(metadata_file, 'w', encoding='utf-8') as f:
        f.write(metadata_js)
    
    mida_meta = metadata_file.stat().st_size
    mida_total += mida_meta
    
    print(f"\n  radar_metadata.js  ->  {format_mida(mida_meta)}")
    print(f"\n  Total: {format_mida(mida_total)} en {len(frames_data) + 1} fitxers")

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("  RADAR OPERA — NE ESPANYA (MAXIMA RESOLUCIO)")
    print("=" * 60)
    print(f"  Regio: lat {REGIO['lat_min']}-{REGIO['lat_max']}, lon {REGIO['lon_min']}-{REGIO['lon_max']}")
    print(f"  Desti: {OUTPUT_DIR}")
    print(f"  Resolucio: step = 1 (maxima)")
    print(f"  Interval: {INTERVAL_MINUTS} minuts entre frames")
    print(f"  Cobertura: {MAX_FRAMES} frames = {MAX_FRAMES * INTERVAL_MINUTS} minuts")
    print()
    
    # 1. Netejar carpeta
    print("Netejant carpeta de sortida...")
    netejar_carpeta(OUTPUT_DIR)
    
    # 2. Buscar frames
    print("Buscant frames recents (cada {} minuts)...".format(INTERVAL_MINUTS))
    frames = find_latest_frames(API_KEY, MAX_FRAMES, INTERVAL_MINUTS)
    
    if not frames:
        print("\nNo s'han trobat frames disponibles")
        sys.exit(1)
    
    print(f"\nTrobats {len(frames)} frames\n")
    
    # 3. Processar frames
    frames_data = []
    for dt, content in frames:
        print(f"Processant {dt.strftime('%Y-%m-%d %H:%M')} UTC...")
        try:
            data = process_frame(content, REGIO)
            if data["points"]:
                frames_data.append(data)
                print(f"   -> {len(data['points']):,} punts dins de la regio\n")
            else:
                print(f"   Sense punts a la regio\n")
        except Exception as e:
            print(f"   Error: {e}\n")
    
    # 4. Generar fitxers
    if frames_data:
        print("=" * 60)
        print("  GENERANT FITXERS")
        print("=" * 60)
        generate_web_files(frames_data)
        print(f"\nLlest! {len(frames_data)} frames generats a:\n   {OUTPUT_DIR}")
    else:
        print("\nNo s'han pogut processar els frames")
