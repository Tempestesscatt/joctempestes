"""
detectar_run.py — Detecta el millor run AROME disponible i l'exporta a
GITHUB_OUTPUT perquè els jobs paral·lels (SFC i 3D) facin servir EXACTAMENT
el mateix run, sense risc que un canviï de run a mig camí de l'altre.

Ús (dins d'un step de GitHub Actions):
    python3 detectar_run.py >> "$GITHUB_OUTPUT"

Imprimeix per stdout una línia:
    run=2026-08-02T18
"""

import sys
import requests


def trobar_millor_run():
    from meteofetch import Arome0025
    base_url = Arome0025.base_url_

    from datetime import datetime, timedelta

    print("🔍 Buscant el millor run disponible...", file=sys.stderr)
    ara = datetime.utcnow()
    runs_a_provar = []
    for h in range(0, 48, 6):
        dt = ara - timedelta(hours=h)
        dt = dt.replace(minute=0, second=0, microsecond=0)
        hora_run = (dt.hour // 6) * 6
        dt = dt.replace(hour=hora_run)
        runs_a_provar.append(dt)
    runs_a_provar = sorted(set(runs_a_provar), reverse=True)

    URL_GRIB = "{b}/{d}:00:00Z/arome/0025/{p}/arome__0025__{p}__{g}__{d}:00:00Z.grib2"

    for dt in runs_a_provar:
        run_str = dt.strftime("%Y-%m-%dT%H")
        url_test = URL_GRIB.format(b=base_url, d=run_str, p="SP1", g="49H51H")
        try:
            resp = requests.head(url_test, timeout=10)
            if resp.status_code == 200:
                print(f"✅ Run {run_str}Z: 51 hores OK", file=sys.stderr)
                return run_str
        except Exception:
            pass

    for dt in runs_a_provar:
        run_str = dt.strftime("%Y-%m-%dT%H")
        url_test = URL_GRIB.format(b=base_url, d=run_str, p="SP1", g="00H06H")
        try:
            resp = requests.head(url_test, timeout=10)
            if resp.status_code == 200:
                print(f"⚠️  Run {run_str}Z seleccionat (màxim disponible)", file=sys.stderr)
                return run_str
        except Exception:
            pass

    sys.exit("❌ Cap run disponible.")


if __name__ == "__main__":
    run = trobar_millor_run()
    print(f"run={run}")