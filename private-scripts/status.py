#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generar_status_js.py — Genera status.js per al frontend
"""

import json
import os
from datetime import datetime, timezone

def generar_status_js():
    """Genera el fitxer status.js amb la data d'execució"""
    
    # Obté la data actual en UTC
    ara = datetime.now(timezone.utc)
    data_iso = ara.isoformat().replace('+00:00', 'Z')
    timestamp = int(ara.timestamp())
    
    # Dades que es guardaran al status.js
    status_data = {
        "generat": data_iso,
        "timestamp": timestamp,
        "model": "AROME-0025",
        "status": "ok",
        "versio": "1.0"
    }
    
    # Camí de sortida (ajusta segons la teva estructura)
    # Aquesta ruta és per al projecte joctempestes
    js_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..", "meu-mapa", "public", "js", "status.js"
    )
    
    # Assegurar que el directori existeix
    os.makedirs(os.path.dirname(js_path), exist_ok=True)
    
    # Escriure el fitxer status.js
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f"""// ═══════════════════════════════════════════════════════════════════════
//  status.js — GENERAT AUTOMÀTICAMENT pel backend
//  ═══════════════════════════════════════════════════════════════════════
//  No editar manualment! Aquest fitxer es regenera cada execució.
//  ═══════════════════════════════════════════════════════════════════════

const STATUS_DATA = {json.dumps(status_data, indent=2)};

// Per a compatibilitat amb statuscheck.js
window.STATUS_DATA = STATUS_DATA;
""")
    
    print(f"  ✅ status.js generat: {js_path}")
    print(f"     📅 {data_iso}")
    return js_path

if __name__ == "__main__":
    generar_status_js()