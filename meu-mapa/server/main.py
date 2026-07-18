"""
AROME Skew-T Server · Fly.io 24/7
Genera imatges Skew-T amb matplotlib+metpy
"""
import gc
from datetime import datetime
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
import json
import base64
import io
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from metpy.plots import SkewT
import metpy.calc as mpcalc
from metpy.units import units

app = FastAPI(title="AROME Skew-T", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Garbage collection després de cada petició
@app.middleware("http")
async def cleanup_after_request(request: Request, call_next):
    response = await call_next(request)
    gc.collect()
    return response

DATA_DIR = Path("/public/web_data")

# ═══════════════════ UTILITATS ═══════════════════

def trobar_index_mes_proper(arr, val):
    best, best_diff = 0, float('inf')
    for i, x in enumerate(arr):
        d = abs(x - val)
        if d < best_diff:
            best_diff, best = d, i
    return best

# ═══════════════════ ENDPOINT PRINCIPAL ═══════════════════

@app.get("/api/skewt")
async def skewt(
    lat: float = Query(...),
    lon: float = Query(...),
    hour: int = Query(...)
):
    try:
        # 1. Carregar dades
        sfc_path = DATA_DIR / f"sfc_{hour:02d}.json"
        td_path = DATA_DIR / f"3d_{hour:02d}.json"
        
        if not sfc_path.exists() or not td_path.exists():
            return JSONResponse({"error": f"+{hour:02d}h no disponible"}, 404)
        
        with open(sfc_path, encoding="utf-8") as f:
            sfc = json.load(f)
        with open(td_path, encoding="utf-8") as f:
            td = json.load(f)
        
        # 2. Punt
        lats = sfc["coordenadas"]["lat"]
        lons = sfc["coordenadas"]["lon"]
        Nlon = len(lons)
        
        i = trobar_index_mes_proper(lats, lat)
        j = trobar_index_mes_proper(lons, lon)
        idx = i * Nlon + j
        
        # 3. Pressió superficial
        sp = sfc["variables"].get("sp") or sfc["variables"].get("pressure_msl")
        if not sp:
            return JSONResponse({"error": "Sense pressió"}, 400)
        
        psfc = sp["datos"][idx]
        if psfc is None:
            return JSONResponse({"error": "Fora de graella"}, 400)
        
        # 4. Perfil
        perfil = {}
        for var_name, var_info in td["variables"].items():
            parts = var_name.split("_")
            if len(parts) < 2:
                continue
            try:
                nivell = int(parts[-1])
            except ValueError:
                continue
            if nivell < 100 or nivell > 1050:
                continue
            
            valor = var_info["datos"][idx]
            if valor is None or not np.isfinite(valor):
                continue
            
            prefix = "_".join(parts[:-1])
            if nivell not in perfil:
                perfil[nivell] = {}
            perfil[nivell][prefix] = valor
        
        if len(perfil) < 3:
            return JSONResponse({"error": "Perfil insuficient"}, 400)
        
        # 5. Arrays
        nivells = sorted(perfil.keys(), reverse=True)
        p = np.array(nivells, dtype=float) * units.hPa
        T = np.array([perfil[n].get('t', np.nan) for n in nivells]) * units.degC
        Td = np.array([perfil[n].get('dpt', np.nan) for n in nivells]) * units.degC
        u = np.array([perfil[n].get('u', 0) for n in nivells]) * units.meter_per_second
        v = np.array([perfil[n].get('v', 0) for n in nivells]) * units.meter_per_second
        
        mask = ~np.isnan(T.magnitude) & ~np.isnan(Td.magnitude)
        p, T, Td, u, v = p[mask], T[mask], Td[mask], u[mask], v[mask]
        
        if len(p) < 3:
            return JSONResponse({"error": "Poques dades vàlides"}, 400)
        
        # 6. Dibuixar (mida reduïda per estalviar RAM)
        fig, ax = plt.subplots(figsize=(5.5, 6.5), facecolor='white', dpi=72)
        skew = SkewT(fig, rotation=45)
        skew.ax.set_facecolor('#fafbfc')
        
        skew.plot(p, T, 'r', linewidth=2, label='Temperatura')
        skew.plot(p, Td, 'g', linewidth=1.5, label='Punt rosada')
        
        step = max(1, len(p) // 12)
        skew.plot_barbs(p[::step], u[::step], v[::step], length=5, alpha=0.6)
        
        try:
            prof = mpcalc.parcel_profile(p, T[0], Td[0]).to('degC')
            skew.plot(p, prof, 'k--', linewidth=1.5, label='Parcel·la')
            
            cape, cin = mpcalc.cape_cin(p, T, Td, prof)
            cape_val = cape.magnitude if np.isfinite(cape.magnitude) else 0
            cin_val = cin.magnitude if np.isfinite(cin.magnitude) else 0
            
            if cape_val > 0:
                skew.ax.fill_betweenx(p.magnitude, prof.magnitude, T.magnitude,
                                      where=prof.magnitude > T.magnitude,
                                      color='orange', alpha=0.25, label=f'CAPE: {cape_val:.0f} J/kg')
            if cin_val < 0:
                skew.ax.fill_betweenx(p.magnitude, prof.magnitude, T.magnitude,
                                      where=prof.magnitude < T.magnitude,
                                      color='blue', alpha=0.2, label=f'CIN: {cin_val:.0f} J/kg')
        except Exception:
            pass
        
        skew.plot_dry_adiabats(alpha=0.12, color='#8b4513')
        skew.plot_moist_adiabats(alpha=0.12, color='#006400')
        skew.plot_mixing_lines(alpha=0.12, color='#1e90ff')
        
        skew.ax.set_xlim(-40, 45)
        skew.ax.set_ylim(1050, 100)
        skew.ax.set_xlabel('Temperatura (°C)', fontsize=9, color='#444')
        skew.ax.set_ylabel('Pressió (hPa)', fontsize=9, color='#444')
        
        plt.title(f'AROME · {lats[i]:.2f}°N {lons[j]:.2f}°E · +{hour:02d}h · {psfc:.0f} hPa',
                  fontsize=11, fontweight='bold', color='#222', pad=8)
        
        plt.legend(loc='upper right', fontsize=7, framealpha=0.7)
        plt.tight_layout()
        
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=72, bbox_inches='tight', facecolor='white')
        plt.close(fig)
        buf.seek(0)
        
        img_b64 = base64.b64encode(buf.getvalue()).decode()
        
        return {
            "image": f"data:image/png;base64,{img_b64}",
            "lat": round(lats[i], 4),
            "lon": round(lons[j], 4),
            "hour": hour,
            "psfc": round(psfc, 1)
        }
        
    except Exception as e:
        return JSONResponse({"error": str(e)}, 500)

# ═══════════════════ HEALTH ═══════════════════

@app.get("/api/health")
async def health():
    return {"status": "ok", "hour": datetime.utcnow().strftime("%H:%M")}