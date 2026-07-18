#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
descarrega_total.py / all.py  —  VERSIÓ BLINDADA
═══════════════════════════════════════
 SCRIPT ÚNIC — fa les DUES coses, en ordre:

   1) SATÈL·LIT: BT 10.8µm + BT 6.2µm + GEOPOTENCIAL 500hPa + LLAMPS
      -> genera un .json PER HORA dins de web_data/ (sense subcarpetes)
         (config2.json)

   2) VARIABLES AROME (el que ja teníem, "all.py"):
      -> Avui 00Z-24Z + Dema 24Z-52Z, temperatura/vent/pluja/etc.
         (config.json)

 ⚡ NOVETAT: Llamps (lightning_1h) integrats al JSON del satèl·lit
 ⚡ ESTABLE: Cerca de satèl·lit robusta (variants), barra global

 🛡️  BLINDATGE (aquesta versió):
   - Backoff exponencial + jitter a TOTES les crides HTTP (evita el
     "thundering herd" i els bans temporals per repetir peticions en
     ràfega -> menys hores buides). Pràctica estàndard de resiliència
     d'APIs (AWS Builders' Library, Google Cloud, OpenAI cookbook).
   - Límits físics (range-check) per a totes les variables de
     superfície i de nivell de pressió: descarta valors impossibles
     abans que arribin al producte final.
   - Control de monotonicitat vertical del geopotencial i coherència
     punt de rosada <= temperatura al perfil 3D (mateix criteri que
     fan servir els arxius de sondeigs IGRA / RAPSODI per detectar
     nivells espuris).
   - Control de CONSISTÈNCIA TEMPORAL hora a hora: cada punt de
     graella es compara amb la mitjana dels seus veïns temporals
     (h-1, h+1); si el salt és fisicament impossible en 1h, es
     substitueix per interpolació temporal. Això és el que elimina
     les "caigudes brusques" del skew-T entre hores consecutives.
   - Reompliment d'hores senceres perdudes per interpolació temporal
     lineal (en lloc de deixar el forat / null), amb marca a les
     metadades de quantes dades són interpolades.
   - 🆕 TALL DUR (kill-switch) si una hora surt 0/27 variables: es
     reintenta fins a 10 vegades i, si segueix buida, es LLANÇA UNA
     EXCEPCIÓ que atura TOT el procés (no es genera ni es publica res
     a la web). Es prefereix que el worker falli clarament (job en
     vermell a GitHub Actions) abans que pujar una web amb dades
     buides que espanti als usuaris.
   - 🆕 DETECCIÓ DE CASCADA: si es detecten 3 hores CONSECUTIVES a
     0/27 (després dels seus reintents individuals), es considera que
     l'API està penalitzada/caiguda per a aquesta sessió, i el procés
     es talla IMMEDIATAMENT amb exit code 42, perquè el workflow de
     GitHub Actions rellanci all.py des de zero (sessió/connexions
     noves) en lloc d'esperar que s'esgotin tots els reintents interns
     sense recuperar-se mai.
═══════════════════════════════════════
"""

import io, json, re, os, shutil, time, logging, sys, threading, glob, random
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import numpy as np
import requests
import tifffile
import xml.etree.ElementTree as ET
from scipy.interpolate import griddata, RegularGridInterpolator

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 🛡️ Exit code especial: senyala al workflow YAML que això ha estat una
# "fallida en cascada" (API penalitzada) i que cal rellançar all.py des
# de ZERO amb un procés nou, en lloc de comptar-ho com un error normal.
EXIT_CODE_CASCADA = 42


class HoraBuidaError(RuntimeError):
    """
    🛡️ Excepció greu: una hora ha sortit amb 0/27 variables de superfície
    després d'esgotar tots els reintents. NO és un simple forat puntual
    (per això és diferent del QC temporal, que interpola forats normals).
    Quan es llança, TOT el procés s'ha d'aturar: no es genera cap fitxer
    nou i, sobretot, NO es crida l'autodeploy, per no publicar una web
    amb dades buides.
    """
    pass


class CascadaAPIError(RuntimeError):
    """
    🛡️ Detectada una CASCADA real: diverses hores CONSECUTIVES han
    sortit a 0/27 variables (o sense cap banda de satèl·lit) després
    dels seus reintents individuals. Això és senyal que l'API de
    Météo-France està penalitzada/caiguda per aquesta sessió/IP
    concreta, NO un forat puntual normal.

    A diferència de HoraBuidaError (que espera que s'esgotin els
    reintents d'UNA hora abans d'aturar-se), aquesta excepció es
    llança tan aviat com es detecta el patró de cascada, i talla el
    procés IMMEDIATAMENT (cancel·lant la resta de tasques en curs)
    perquè no calgui esperar minuts reintentant amb la mateixa sessió
    penalitzada.

    S'ha de propagar fins a main() i acabar el procés amb
    sys.exit(EXIT_CODE_CASCADA), perquè el workflow de GitHub Actions
    el reconegui i rellanci all.py des de zero (nova Session, noves
    connexions TCP) en comptes de comptar-ho com un reintent "normal".
    """
    pass


def resoldre_output_dir(ruta):
    if os.path.isabs(ruta):
        return ruta
    return os.path.normpath(os.path.join(BASE_DIR, ruta))


def espera_amb_jitter(base, intent, cap=90):
    """
    Backoff exponencial + jitter (AWS/GCP/OpenAI best practice):
    evita que totes les peticions fallides es re-sincronitzin i
    tornin a disparar el rate-limit ("thundering herd").
    """
    delay = min(base * (2 ** (intent - 1)), cap)
    jitter = random.uniform(0, delay * 0.5)
    time.sleep(delay + jitter)


# ════════════════════════════════════════════════════════════════
#  🛡️  DETECCIÓ DE CASCADA (hores consecutives buides)
#  Comptador thread-safe, compartit entre threads, per a cada
#  "processament" (AVUI / DEMA / satèl·lit). Quan es detecten N
#  hores CONSECUTIVES a 0/27 (o sense dades de satèl·lit), es
#  llança CascadaAPIError per tallar tot el procés immediatament.
# ════════════════════════════════════════════════════════════════
LLINDAR_CASCADA_HORES_CONSECUTIVES = 3


class DetectorCascada:
    """
    Porta el registre de quines hores han sortit buides (0/27, o sense
    banda de satèl·lit) per a un "processament" concret (p.ex. "AVUI",
    "DEMA", "SATELIT"). Com que les hores es descarreguen en paral·lel
    amb threads, el que compta com a "consecutiu" no és l'ordre
    d'arribada sinó l'ordre NUMÈRIC de l'hora (h, h+1, h+2, ...).

    Thread-safe: registrar_buida()/registrar_ok() es poden cridar
    concurrentment des de múltiples threads sense condicions de carrera.
    """

    def __init__(self, label, llindar=LLINDAR_CASCADA_HORES_CONSECUTIVES):
        self.label = label
        self.llindar = llindar
        self.hores_buides = set()
        self.hores_ok = set()
        self.lock = threading.Lock()
        self.cascada_detectada = False

    def registrar_buida(self, h):
        with self.lock:
            if self.cascada_detectada:
                return
            self.hores_buides.add(h)
            if self._hi_ha_run_consecutiu(h):
                self.cascada_detectada = True
                raise CascadaAPIError(
                    f"[{self.label}] CASCADA detectada: {self.llindar} hores "
                    f"CONSECUTIVES a 0 variables al voltant de H{h:02d} "
                    f"(hores buides fins ara: {sorted(self.hores_buides)}). "
                    f"L'API sembla penalitzada/caiguda per aquesta sessió — "
                    f"s'atura TOT el procés (exit {EXIT_CODE_CASCADA}) perquè "
                    f"el workflow el rellanci amb un procés nou."
                )

    def registrar_ok(self, h):
        with self.lock:
            self.hores_ok.add(h)

    def _hi_ha_run_consecutiu(self, h_nova):
        """Comprova si, comptant h_nova, hi ha `llindar` hores buides seguides."""
        for inici in range(h_nova - self.llindar + 1, h_nova + 1):
            finestra = range(inici, inici + self.llindar)
            if all(hh in self.hores_buides for hh in finestra):
                return True
        return False


def espera_amb_jitter_curta(base, intent, cap=90):
    return espera_amb_jitter(base, intent, cap)


# ════════════════════════════════════════════════════════════════
#  🛡️  BLINDATGE / CONTROL DE QUALITAT (QC)
#  Basat en pràctiques de QC de sondeigs atmosfèrics (IGRA, RAPSODI,
#  WMO): monotonicitat vertical, límits físics, consistència temporal.
# ════════════════════════════════════════════════════════════════

# Límits físics raonables per variable (unitats del propi pipeline)
LIMITS_FISICS = {
    "st": (-60, 55), "sd": (-70, 45), "srh": (0, 100),
    "sp": (850, 1085), "pressure_msl": (870, 1085),
    "cape": (0, 8000), "cin": (-800, 0), "cape_ml": (0, 8000),
    "precip_water": (0, 100), "wind_gust": (0, 300),
    "rain": (0, 300), "snow": (0, 300), "graupel": (0, 200), "hail": (0, 200),
    "lightning": (0, 1e6), "lightning_3h": (0, 1e6), "lightning_3h_avg": (0, 1e6),
    "reflectivity_dbz": (-30, 75), "reflectivity_lin": (0, 1e7),
    "snow_depth": (0, 1000), "visibility_min60": (0, 100000),
    "low_cloud_cover": (0, 100), "medium_cloud_cover": (0, 100),
    "high_cloud_cover": (0, 100), "spbl": (0, 5000),
    # variables 3D (per nivell de pressió)
    "t": (-95, 50), "dew": (-95, 50), "rh": (0, 100),
    "geo": (-500, 32000), "u": (-160, 160), "v": (-160, 160),
    # brillantor de satèl·lit (Celsius)
    "bt": (-110, 55),
}

# Canvi màxim físicament plausible EN 1 HORA per variable (per detectar
# caigudes/pujades brusques irreals al skew-T i a les sèries de superfície)
LLINDARS_CANVI_HORARI = {
    "st": 6, "sd": 6, "srh": 40, "sp": 6, "pressure_msl": 6,
    "cape": 3000, "cin": 400, "cape_ml": 3000, "precip_water": 15,
    "wind_gust": 60, "spbl": 1500,
    "t": 6, "dew": 6, "rh": 40, "geo": 60, "u": 40, "v": 40,
}


def aplicar_limits_fisics(nom_var, arr):
    """Posa a NaN els valors fora d'un rang físic raonable."""
    if arr is None or nom_var not in LIMITS_FISICS:
        return arr
    vmin, vmax = LIMITS_FISICS[nom_var]
    arr = arr.copy()
    arr[(arr < vmin) | (arr > vmax)] = np.nan
    return arr


def corregir_monotonicitat_geopotencial(perfil_geo_per_nivell, plevs_ordenats_desc):
    """
    plevs_ordenats_desc: pressions ordenades de MÉS alta a MÉS baixa
    (p.ex. [1000, 925, 850, 700, 500, 300]) -> l'alçada geopotencial ha
    de CRÉIXER sempre en aquest sentit. Si es trenca, es marca NaN el
    nivell superior (mateix criteri que IGRA/RAPSODI per a sondeigs).
    """
    disponibles = [p for p in plevs_ordenats_desc if p in perfil_geo_per_nivell
                   and perfil_geo_per_nivell[p] is not None]
    for i in range(1, len(disponibles)):
        p_baix, p_alt = disponibles[i - 1], disponibles[i]
        geo_baix = perfil_geo_per_nivell[p_baix]
        geo_alt = perfil_geo_per_nivell[p_alt]
        trencat = geo_alt <= geo_baix
        if np.any(trencat):
            geo_alt = geo_alt.copy()
            geo_alt[trencat] = np.nan
            perfil_geo_per_nivell[p_alt] = geo_alt
    return perfil_geo_per_nivell


def corregir_punt_de_rosada(perfil_t, perfil_dew):
    """El punt de rosada mai pot superar la temperatura (+0.5C de marge tècnic)."""
    for plev in list(perfil_dew.keys()):
        if plev in perfil_t and perfil_t[plev] is not None and perfil_dew[plev] is not None:
            t, d = perfil_t[plev], perfil_dew[plev]
            mask = d > (t + 0.5)
            if np.any(mask):
                d = d.copy()
                d[mask] = np.nan
                perfil_dew[plev] = d
    return perfil_dew


def omplir_hores_perdudes(dades_per_hora, h0, h1):
    """
    Si una hora sencera falta (None / no existeix), s'interpola
    linealment en el temps a partir de les hores vàlides més properes.
    Es retorna també el nombre d'hores reconstruïdes.
    """
    hores_totes = list(range(h0, h1 + 1))
    hores_valides = sorted(h for h in hores_totes if dades_per_hora.get(h) is not None)
    if len(hores_valides) < 2:
        return dades_per_hora, 0

    n_interpolades = 0
    for h in hores_totes:
        if dades_per_hora.get(h) is not None:
            continue
        anteriors = [x for x in hores_valides if x < h]
        posteriors = [x for x in hores_valides if x > h]
        if anteriors and posteriors:
            ha, hp = anteriors[-1], posteriors[0]
            frac = (h - ha) / (hp - ha)
            dades_per_hora[h] = dades_per_hora[ha] * (1 - frac) + dades_per_hora[hp] * frac
        elif anteriors:
            dades_per_hora[h] = dades_per_hora[anteriors[-1]].copy()
        elif posteriors:
            dades_per_hora[h] = dades_per_hora[posteriors[0]].copy()
        else:
            continue
        n_interpolades += 1
    return dades_per_hora, n_interpolades


def detectar_i_corregir_salts_temporals(dades_per_hora, llindar_canvi, h0, h1):
    """
    🛡️ BLINDATGE CLAU contra les "caigudes super brusques" del skew-T:
    per a cada punt de graella, compara cada hora amb la MITJANA dels
    seus veïns temporals immediats (h-1, h+1). Si la diferència supera
    el llindar físicament plausible en 1h, es considera un outlier
    (típicament una tessel·la corrupta o un nivell fallit puntualment)
    i se substitueix per interpolació temporal entre veïns.
    """
    hores = sorted(h for h in range(h0, h1 + 1)
                    if dades_per_hora.get(h) is not None)
    if len(hores) < 3:
        return dades_per_hora, 0

    n_corregits = 0
    for idx in range(1, len(hores) - 1):
        h_prev, h_cur, h_next = hores[idx - 1], hores[idx], hores[idx + 1]
        # Només aplica si són hores consecutives de veritat (evita
        # "arreglar" salts que són legítims perquè hi ha un forat gran al mig)
        if (h_cur - h_prev) > 2 or (h_next - h_cur) > 2:
            continue
        v_prev, v_cur, v_next = dades_per_hora[h_prev], dades_per_hora[h_cur], dades_per_hora[h_next]
        veins_mitjana = (v_prev + v_next) / 2.0
        with np.errstate(invalid="ignore"):
            diff = np.abs(v_cur - veins_mitjana)
            outlier = diff > llindar_canvi
        outlier = np.nan_to_num(outlier, nan=False).astype(bool)
        n_out = int(np.sum(outlier))
        if n_out > 0:
            v_corregit = v_cur.copy()
            v_corregit[outlier] = veins_mitjana[outlier]
            dades_per_hora[h_cur] = v_corregit
            n_corregits += n_out
    return dades_per_hora, n_corregits


def qc_serie_temporal(dades_per_hora, nom_var, h0, h1):
    """Pipeline complet de QC temporal per a UNA variable: reomplir forats + suavitzar salts."""
    d, n_interp = omplir_hores_perdudes(dades_per_hora, h0, h1)
    llindar = LLINDARS_CANVI_HORARI.get(nom_var, 9999)
    d, n_corr = detectar_i_corregir_salts_temporals(d, llindar, h0, h1)
    return d, n_interp, n_corr


# ════════════════════════════════════════════════════════════════
#  PART 1 — SATÈL·LIT (BT108 / BT62 / GEO500 / LLAMPS) -> JSON
# ════════════════════════════════════════════════════════════════
def descarregar_satelit():
    print("\n" + "=" * 70)
    print("PAS 1/2 — BT 10.8 + BT 6.2 + GEOPOTENCIAL 500 hPa + LLAMPS -> JSON")
    print("=" * 70)

    with open(os.path.join(BASE_DIR, "config2.json"), encoding="utf-8") as f:
        cfg2 = json.load(f)

    API_KEY = cfg2["api_key"]
    BASE_URL = "https://public-api.meteofrance.fr/public/arome/1.0"
    SERVICE = "MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS"

    try:
        with open(os.path.join(BASE_DIR, "config.json"), encoding="utf-8") as f:
            cfg1_para_satelit = json.load(f)
        BASE_OUTPUT = resoldre_output_dir(cfg1_para_satelit["output_dir"])
    except Exception:
        BASE_OUTPUT = os.path.dirname(resoldre_output_dir(cfg2["output_dir"]))

    PAUSA = 3.0
    MAX_REINTENTS = 4          # 🛡️ +1 respecte l'original (menys hores buides)
    MAX_REINTENTS_GEO = 4
    # 🛡️ Configurable des de config2.json ("satelit_max_hores"); per
    # defecte es manté el comportament original (1 hora), però es
    # deixa la porta oberta perquè no calgui tocar el codi.
    MAX_HORES = int(cfg2.get("satelit_max_hores", 51))
    G0 = 9.80665
    TIMEOUT = 90
    RATE_LIMIT_DELAY = 5
    INTER_REQUEST_DELAY = 1.0
    RETRY_DELAY_BASE = 6        # base del backoff exponencial+jitter

    # 🛡️ Detector de cascada per al satèl·lit: si 3 hores CONSECUTIVES
    # no aconsegueixen NI UNA SOLA banda (ni BT108 ni BT62), es considera
    # cascada i es talla immediatament.
    detector_cascada_sat = DetectorCascada("SATELIT")

    session = requests.Session()
    session.headers.update({"apikey": API_KEY})

    def get_coverage_ids(service, max_attempts=8):
        url = f"{BASE_URL}/wcs/{service}/GetCapabilities"
        params = {"SERVICE": "WCS", "VERSION": "2.0.1", "LANGUAGE": "eng"}
        for attempt in range(max_attempts):
            try:
                print(f"   Intent {attempt+1}/{max_attempts}...", end=" ", flush=True)
                r = session.get(url, params=params, timeout=TIMEOUT)
                if r.status_code == 200:
                    root = ET.fromstring(r.content)
                    covs = [e.text.strip() for e in root.iter('{http://www.opengis.net/wcs/2.0}CoverageId')]
                    if covs:
                        print(f"OK - {len(covs)} CoverageIds trobats")
                        return covs
                    else:
                        covs2 = [e.text.strip() for e in root.iter() if 'CoverageId' in e.tag]
                        if covs2:
                            print(f"   CoverageIds sense NS: {len(covs2)}")
                            return covs2
                elif r.status_code == 429:
                    print("HTTP 429 (quota)")
                    try:
                        data = r.json()
                        next_time = data.get("nextAccessTime", "")
                        if next_time:
                            print(f"   Esperant fins {next_time}...")
                            esperar_fins_429(next_time)
                    except Exception:
                        espera_amb_jitter(RATE_LIMIT_DELAY, attempt + 1)
                else:
                    print(f"HTTP {r.status_code}")
            except Exception as e:
                print(f"Error: {str(e)[:80]}")
            print(f"   Backoff+jitter...")
            espera_amb_jitter(10, attempt + 1, cap=60)
        raise RuntimeError(f"No s'han pogut obtenir CoverageIds després de {max_attempts} intents")

    def esperar_fins_429(next_access_str):
        try:
            mesos_fr = {
                'janv.': '01', 'févr.': '02', 'fév.': '02', 'mars': '03', 'avr.': '04',
                'mai': '05', 'juin': '06', 'juil.': '07', 'août': '08',
                'sept.': '09', 'oct.': '10', 'nov.': '11', 'déc.': '12'
            }
            s = next_access_str
            for fr, num in mesos_fr.items():
                s = s.replace(fr, num)
            s = s.replace(' UTC', '')
            dt_next = datetime.strptime(s, "%Y-%m-%d %H:%M:%S%z")
            ara = datetime.now(timezone.utc)
            espera = (dt_next - ara).total_seconds() + 5
            if espera > 0:
                print(f"      ⏳ Esperant {espera/60:.1f} minuts...")
                time.sleep(espera)
        except Exception as e:
            print(f"      ⚠️ Error parsejant data 429: {e}")
            time.sleep(300)

    print("\n📡 GetCapabilities (WCS 0.025)...")
    cov_ids_0025 = get_coverage_ids("MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS")
    print(f"\n✅ {len(cov_ids_0025)} CoverageIds totals")

    def buscar_coverage(cov_ids, paraules, excloure=None):
        res = {}
        for cid in cov_ids:
            u = cid.upper()
            if all(p.upper() in u for p in paraules):
                if excloure and any(e.upper() in u for e in excloure):
                    continue
                m = re.search(r'(\d{4}-\d{2}-\d{2}T\d{2})\.\d{2}\.\d{2}Z', cid)
                if m:
                    run = m.group(1)
                    if run not in res:
                        res[run] = cid
        return res

    def buscar_coverage_variants(cov_ids, llista_paraules_possibles, excloure=None):
        for paraules in llista_paraules_possibles:
            res = buscar_coverage(cov_ids, paraules, excloure=excloure)
            if res:
                print(f"   → Trobat amb: {paraules}")
                return res
        return {}

    # Cerca BT108
    print("\n🔎 Cercant BT 10.8µm...")
    bt108_dict = buscar_coverage_variants(cov_ids_0025, [
        ['BRIGHTNESS_TEMPERATURE_108'],
        ['BRIGHTNESS_TEMPERATURE_10_8'],
        ['BRIGHTNESS_TEMPERATURE__10_8'],
        ['BRIGHTNESS_TEMPERATURE'],
    ], excloure=['_62', '_39', '_120', '_87', '_73', '_97'])

    # Cerca BT62
    print("🔎 Cercant BT 6.2µm...")
    bt62_dict = buscar_coverage_variants(cov_ids_0025, [
        ['BRIGHTNESS_TEMPERATURE_62'],
        ['BRIGHTNESS_TEMPERATURE_6_2'],
        ['BRIGHTNESS_TEMPERATURE__6_2'],
        ['BRIGHTNESS_TEMPERATURE_62UM'],
    ])

    # Cerca Geopotencial 500hPa
    print("🔎 Cercant GEOPOTENCIAL 500hPa...")
    geo500_dict = buscar_coverage_variants(cov_ids_0025, [
        ['GEOPOTENTIAL_HEIGHT__ISOBARIC_SURFACE'],
        ['GEOPOTENTIAL__ISOBARIC_SURFACE'],
        ['GEOPOTENTIAL_HEIGHT'],
        ['GEOPOTENTIAL'],
    ])

    # ⚡ Cerca LLAMPS
    print("🔎 Cercant LLAMPS (lightning 1h)...")
    lightning_dict = buscar_coverage_variants(cov_ids_0025, [
        ['LIGHTNING_STRIKE_DENSITY_CUMULATED__GROUND_OR_WATER_SURFACE', 'PT1H'],
        ['LIGHTNING_STRIKE_DENSITY_CUMULATED', 'PT1H'],
        ['LIGHTNING_STRIKE_DENSITY', 'PT1H'],
    ])

    print(f"\n✅ BT 10.8µm: {len(bt108_dict)} runs | BT 6.2µm: {len(bt62_dict)} runs | GEO500: {len(geo500_dict)} runs | LLAMPS: {len(lightning_dict)} runs")

    if len(bt108_dict) == 0 and len(bt62_dict) == 0:
        print("\n⚠️ No s'han trobat coverages de BT. El satèl·lit no estarà disponible.")
        print("   Es continua igualment amb el pas de variables AROME...\n")
        return

    NE = {"lon_min": -5.0, "lon_max": 5.0, "lat_min": 37.5, "lat_max": 44.0, "res": 0.025}
    NE["w"] = int((NE["lon_max"] - NE["lon_min"]) / NE["res"]) + 1
    NE["h"] = int((NE["lat_max"] - NE["lat_min"]) / NE["res"]) + 1

    AR = {"lon_min": -10.0, "lon_max": 12.0, "lat_min": 38.0, "lat_max": 55.0, "res": 0.05}
    AR["w"] = int((AR["lon_max"] - AR["lon_min"]) / AR["res"]) + 1
    AR["h"] = int((AR["lat_max"] - AR["lat_min"]) / AR["res"]) + 1

    GEO = {
        "lon_min": AR["lon_min"], "lon_max": AR["lon_max"],
        "lat_min": AR["lat_min"], "lat_max": AR["lat_max"],
        "res": AR["res"], "w": AR["w"], "h": AR["h"]
    }

    OUT_BT108 = BASE_OUTPUT
    OUT_BT62 = BASE_OUTPUT

    os.makedirs(BASE_OUTPUT, exist_ok=True)

    for patro in ("bt108_*.json", "bt62_*.json", "index_bt108.json", "index_bt62.json"):
        for vell in glob.glob(os.path.join(BASE_OUTPUT, patro)):
            try:
                os.remove(vell)
            except OSError:
                pass

    runs = sorted(bt108_dict.keys(), reverse=True) if bt108_dict else sorted(bt62_dict.keys(), reverse=True)
    ara = datetime.now(timezone.utc)
    run_bo = None
    for r in runs:
        dt_run = datetime.strptime(r + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        if dt_run <= ara:
            run_bo = r
            break
    if not run_bo:
        run_bo = runs[0]

    run_dt = datetime.strptime(run_bo + ":00:00Z", "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    bt108_cov = bt108_dict.get(run_bo)
    bt62_cov = bt62_dict.get(run_bo)
    geo500_cov = geo500_dict.get(run_bo)
    lightning_cov = lightning_dict.get(run_bo)  # ⚡

    print(f"\n📅 Run seleccionat: {run_bo}:00 UTC")
    print(f"   BT108: {'✅' if bt108_cov else '❌'}  BT62: {'✅' if bt62_cov else '❌'}  GEO500: {'✅' if geo500_cov else '❌'}  LLAMPS: {'✅' if lightning_cov else '❌'}")

    def descarregar_tile(cov_id, time_str, lon_min, lon_max, lat_min, lat_max, w, h,
                          extra="", llindar_nan=9000, etiqueta="", max_reintents=None):
        url = (f"{BASE_URL}/wcs/{SERVICE}/GetCoverage?"
               f"SERVICE=WCS&VERSION=2.0.1&COVERAGEID={cov_id}&FORMAT=image/tiff"
               f"&SUBSET=long({lon_min},{lon_max})&SUBSET=lat({lat_min},{lat_max})"
               f"&SUBSET=time({time_str}){extra}"
               f"&SCALESIZE=long({w})&SCALESIZE=lat({h})")
        n_reintents = max_reintents if max_reintents is not None else MAX_REINTENTS
        for intent in range(1, n_reintents + 1):
            try:
                resp = session.get(url, timeout=TIMEOUT)
                if resp.status_code == 429:
                    print(f"\n      ⚠️ {etiqueta}: HTTP 429 (quota)")
                    try:
                        data = resp.json()
                        next_time = data.get("nextAccessTime", "")
                        if next_time:
                            esperar_fins_429(next_time)
                    except Exception:
                        espera_amb_jitter(RATE_LIMIT_DELAY, intent)
                    continue
                if resp.status_code == 200 and len(resp.content) > 1000:
                    arr = tifffile.imread(io.BytesIO(resp.content))
                    if arr.ndim == 3:
                        arr = arr[0]
                    arr = arr.astype(np.float64)
                    arr[arr > llindar_nan] = np.nan
                    if arr.shape[0] >= h * 2 - 1:
                        arr = arr[::2, ::2]
                    if arr.shape[1] >= w * 2 - 1:
                        arr = arr[:, ::2]
                    arr = np.flipud(arr)
                    time.sleep(INTER_REQUEST_DELAY)
                    return arr
                elif resp.status_code == 404:
                    return None
                else:
                    print(f"\n      ⚠️ {etiqueta} intent {intent}/{n_reintents}: HTTP {resp.status_code}")
                    espera_amb_jitter(RETRY_DELAY_BASE, intent)
            except Exception as e:
                print(f"\n      ⚠️ {etiqueta} intent {intent}/{n_reintents}: {str(e)[:100]}")
                espera_amb_jitter(RETRY_DELAY_BASE, intent)
        return None

    def retallar_geo_a_domini(arr_geo, lon_min_src, lon_max_src, lat_min_src, lat_max_src,
                               lon_min_dst, lon_max_dst, lat_min_dst, lat_max_dst, w_dst, h_dst):
        h_src, w_src = arr_geo.shape
        lons_src = np.linspace(lon_min_src, lon_max_src, w_src)
        lats_src = np.linspace(lat_min_src, lat_max_src, h_src)
        lon_src, lat_src = np.meshgrid(lons_src, lats_src)
        lons_dst = np.linspace(lon_min_dst, lon_max_dst, w_dst)
        lats_dst = np.linspace(lat_min_dst, lat_max_dst, h_dst)
        lon_dst, lat_dst = np.meshgrid(lons_dst, lats_dst)
        mask = ~np.isnan(arr_geo)
        if np.sum(mask) < 10:
            return np.full((h_dst, w_dst), np.nan)
        punts = np.column_stack((lon_src[mask], lat_src[mask]))
        vals = arr_geo[mask]
        return griddata(punts, vals, (lon_dst, lat_dst), method='linear')

    def data_utc_a_madrid(data_utc):
        year = data_utc.year
        marc_31 = datetime(year, 3, 31, tzinfo=timezone.utc)
        ult_dium_marc = marc_31 - timedelta(days=(marc_31.weekday() + 1) % 7)
        oct_31 = datetime(year, 10, 31, tzinfo=timezone.utc)
        ult_dium_oct = oct_31 - timedelta(days=(oct_31.weekday() + 1) % 7)
        offset = 2 if (ult_dium_marc <= data_utc < ult_dium_oct) else 1
        data_local = data_utc + timedelta(hours=offset)
        dies = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge']
        mesos = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost',
                 'setembre', 'octubre', 'novembre', 'desembre']
        return f"{dies[data_local.weekday()]}, {data_local.day} de {mesos[data_local.month-1]} de {data_local.year} - {data_local.strftime('%H:%M')}"

    def arr_a_llista(arr, decimals=1):
        flat = arr.flatten()
        return [round(float(v), decimals) if not np.isnan(v) else None for v in flat]

    def generar_json(arr_bt, arr_geo, arr_lightning, lon_min, lon_max, lat_min, lat_max, data_hora, hora,
                      carpeta, nom, geo_disponible, lightning_disponible):
        try:
            # 🛡️ límits físics abans de res
            arr_bt = aplicar_limits_fisics("bt", arr_bt)

            h_bt, w_bt = arr_bt.shape
            lons = np.linspace(lon_min, lon_max, w_bt)
            lats = np.linspace(lat_min, lat_max, h_bt)

            geo_dam_list = None
            vmin_t = vmax_t = None
            if geo_disponible and arr_geo is not None:
                vmax_raw = np.nanmax(arr_geo)
                arr_geo_m = arr_geo / G0 if vmax_raw > 20000 else arr_geo
                arr_geo_dam = arr_geo_m / 10.0
                if arr_geo_dam.shape == arr_bt.shape:
                    vmin_t = float(np.nanmin(arr_geo_dam))
                    vmax_t = float(np.nanmax(arr_geo_dam))
                    geo_dam_list = arr_a_llista(arr_geo_dam, decimals=1)

            # ⚡ Processar llamps
            lightning_list = None
            lightning_max = None
            if lightning_disponible and arr_lightning is not None:
                lightning_list = arr_a_llista(arr_lightning, decimals=4)
                lightning_max = float(np.nanmax(arr_lightning)) if np.any(~np.isnan(arr_lightning)) else 0

            hora_local_str = data_utc_a_madrid(data_hora)
            payload = {
                "meta": {
                    "model": "AROME-MF", "canal": nom, "run": run_bo,
                    "hora_previsio": hora,
                    "data_utc": data_hora.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "data_local": hora_local_str,
                    "extent": [lon_min, lon_max, lat_min, lat_max],
                    "w": w_bt, "h": h_bt,
                    "geo500_disponible": bool(geo_dam_list is not None),
                    "geo500_min_dam": round(vmin_t, 1) if vmin_t is not None else None,
                    "geo500_max_dam": round(vmax_t, 1) if vmax_t is not None else None,
                    "lightning_disponible": bool(lightning_list is not None),
                    "lightning_max": round(lightning_max, 4) if lightning_max is not None else None,
                    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                },
                "lats": [round(float(x), 4) for x in lats],
                "lons": [round(float(x), 4) for x in lons],
                "bt_celsius": arr_a_llista(arr_bt, decimals=1),
            }
            if geo_dam_list is not None:
                payload["geo500_dam"] = geo_dam_list
            if lightning_list is not None:
                payload["lightning_1h"] = lightning_list

            nom_json = f"{nom}_{data_hora.strftime('%Y%m%d_%H%M')}UTC_+{hora:02d}h.json"
            ruta = os.path.join(carpeta, nom_json)
            tmp = ruta + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(payload, f, separators=(',', ':'))
            for _ in range(10):
                try:
                    os.replace(tmp, ruta)
                    break
                except PermissionError:
                    time.sleep(3)
            mida = os.path.getsize(ruta)
            return nom_json, mida
        except Exception as e:
            print(f"      ❌ Error JSON: {e}")
            return None, 0

    print(f"\n{'='*70}")
    print("PROCESSANT HORA PER HORA (satèl·lit + llamps)...")
    print(f"{'='*70}")

    entrades_108 = []
    entrades_62 = []

    for hora in range(0, MAX_HORES):
        dh = run_dt + timedelta(hours=hora)
        ts = dh.strftime("%Y-%m-%dT%H:%M:%SZ")

        print(f"\n+{hora:02d}h | {dh.strftime('%d/%m %H:%M')} UTC")
        print("-" * 50)

        # ─── GEO500 ───
        arr_geo500 = None
        geo_ok = False
        if geo500_cov:
            print("  Geopotencial 500hPa...", end=" ", flush=True)
            a = descarregar_tile(geo500_cov, ts,
                                  GEO["lon_min"], GEO["lon_max"],
                                  GEO["lat_min"], GEO["lat_max"],
                                  GEO["w"], GEO["h"],
                                  "&SUBSET=pressure(500)", llindar_nan=200000,
                                  etiqueta="GEO500", max_reintents=MAX_REINTENTS_GEO)
            if a is not None:
                a[(a < 30000) | (a > 70000)] = np.nan
                if np.sum(~np.isnan(a)) > 10:
                    arr_geo500 = a
                    geo_ok = True
                    print(f"OK [{np.nanmin(a):.0f} a {np.nanmax(a):.0f}]")
                else:
                    print("dades buides")
            else:
                print("fallida")

        time.sleep(2)

        # ─── LLAMPS (domini AR) ───
        arr_lightning_ar = None
        lightning_ok = False
        if lightning_cov:
            print("  Llamps 1h (AR)...", end=" ", flush=True)
            a = descarregar_tile(lightning_cov, ts,
                                  AR["lon_min"], AR["lon_max"],
                                  AR["lat_min"], AR["lat_max"],
                                  AR["w"], AR["h"],
                                  llindar_nan=1e10, etiqueta="LLAMPS")
            if a is not None:
                if np.sum(~np.isnan(a)) > 0:
                    arr_lightning_ar = a
                    lightning_ok = True
                    print(f"OK [max: {np.nanmax(a):.4f}]")
                else:
                    print("sense llamps")
            else:
                print("fallida")

        time.sleep(2)

        # ─── BT62 ───
        bt62_ok = False
        if bt62_cov:
            print("  BT 6.2um...", end=" ", flush=True)
            a = descarregar_tile(bt62_cov, ts, AR["lon_min"], AR["lon_max"], AR["lat_min"], AR["lat_max"],
                                  AR["w"], AR["h"], etiqueta="BT62")
            if a is not None:
                print(f"OK [{np.nanmin(a):.0f} a {np.nanmax(a):.0f}C]")
                print("  Generant JSON bt62...", end=" ", flush=True)
                arr_geo_arg = arr_geo500 if geo_ok else None
                arr_lightning_arg = arr_lightning_ar if lightning_ok else None
                nom_json, mida = generar_json(a, arr_geo_arg, arr_lightning_arg,
                                               AR["lon_min"], AR["lon_max"], AR["lat_min"], AR["lat_max"],
                                               dh, hora, OUT_BT62, 'bt62', geo_disponible=geo_ok,
                                               lightning_disponible=lightning_ok)
                if nom_json:
                    print(f"OK {mida/1024:.0f}KB")
                    entrades_62.append({"hora_previsio": hora, "data_utc": ts, "fitxer": nom_json,
                                         "mida_kb": round(mida / 1024, 1)})
                    bt62_ok = True
                else:
                    print("ERROR")
            else:
                print("fallida")

        time.sleep(2)

        # ─── BT108 (amb llamps interpolats al domini NE) ───
        bt108_ok = False
        if bt108_cov:
            print("  BT 10.8um...", end=" ", flush=True)
            a = descarregar_tile(bt108_cov, ts, NE["lon_min"], NE["lon_max"], NE["lat_min"], NE["lat_max"],
                                  NE["w"], NE["h"], etiqueta="BT108")
            if a is not None:
                print(f"OK [{np.nanmin(a):.0f} a {np.nanmax(a):.0f}C]")

                arr_geo_ne = None
                geo_ne_ok = False
                if geo_ok:
                    arr_geo_ne = retallar_geo_a_domini(
                        arr_geo500,
                        GEO["lon_min"], GEO["lon_max"], GEO["lat_min"], GEO["lat_max"],
                        NE["lon_min"], NE["lon_max"], NE["lat_min"], NE["lat_max"],
                        NE["w"], NE["h"]
                    )
                    if arr_geo_ne is not None and np.sum(~np.isnan(arr_geo_ne)) > 10:
                        geo_ne_ok = True

                # ⚡ Interpolar llamps al domini NE
                arr_lightning_ne = None
                lightning_ne_ok = False
                if lightning_ok and arr_lightning_ar is not None:
                    arr_lightning_ne = retallar_geo_a_domini(
                        arr_lightning_ar,
                        AR["lon_min"], AR["lon_max"], AR["lat_min"], AR["lat_max"],
                        NE["lon_min"], NE["lon_max"], NE["lat_min"], NE["lat_max"],
                        NE["w"], NE["h"]
                    )
                    if arr_lightning_ne is not None:
                        lightning_ne_ok = True

                print("  Generant JSON bt108...", end=" ", flush=True)
                arr_geo_arg = arr_geo_ne if geo_ne_ok else None
                arr_lightning_arg = arr_lightning_ne if lightning_ne_ok else None
                nom_json, mida = generar_json(a, arr_geo_arg, arr_lightning_arg,
                                               NE["lon_min"], NE["lon_max"], NE["lat_min"], NE["lat_max"],
                                               dh, hora, OUT_BT108, 'bt108', geo_disponible=geo_ne_ok,
                                               lightning_disponible=lightning_ne_ok)
                if nom_json:
                    print(f"OK {mida/1024:.0f}KB")
                    entrades_108.append({"hora_previsio": hora, "data_utc": ts, "fitxer": nom_json,
                                          "mida_kb": round(mida / 1024, 1)})
                    bt108_ok = True
                else:
                    print("ERROR")
            else:
                print("fallida")

        # 🛡️ Detecció de cascada: si NI bt108 NI bt62 s'han pogut generar
        # per a aquesta hora, es registra com a "buida". Si 3 hores
        # consecutives cauen així, es talla tot el procés immediatament.
        if not bt108_ok and not bt62_ok:
            detector_cascada_sat.registrar_buida(hora)

        for carp, nom_c, ents in [(OUT_BT108, 'bt108', entrades_108), (OUT_BT62, 'bt62', entrades_62)]:
            idx = {
                "canal": nom_c, "run": run_bo,
                "ultima_actualitzacio": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "estat": "descarregant", "n_steps": len(ents), "steps": ents
            }
            with open(os.path.join(carp, f"index_{nom_c}.json"), "w", encoding="utf-8") as f:
                json.dump(idx, f, indent=2, ensure_ascii=False)

        time.sleep(PAUSA)

    for carp, nom_c in [(OUT_BT108, 'bt108'), (OUT_BT62, 'bt62')]:
        ip = os.path.join(carp, f"index_{nom_c}.json")
        if os.path.exists(ip):
            with open(ip, "r") as f:
                idx = json.load(f)
            idx["estat"] = "complet"
            idx["ultima_actualitzacio"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            with open(ip, "w") as f:
                json.dump(idx, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*70}")
    print("PAS 1/2 COMPLETAT!")
    print(f"   bt108_*.json -> {len(entrades_108)} JSONs")
    print(f"   bt62_*.json  -> {len(entrades_62)} JSONs")
    print(f"{'='*70}")


# ════════════════════════════════════════════════════════════════
#  PART 2 — VARIABLES AROME (estable, amb barra global + QC)
# ════════════════════════════════════════════════════════════════
def descarregar_variables_arome():
    print("\n" + "=" * 70)
    print("PAS 2/2 — VARIABLES AROME (superfície + 3D)")
    print("=" * 70 + "\n")

    LOG_DIR = os.path.join(BASE_DIR, "logs")
    os.makedirs(LOG_DIR, exist_ok=True)
    log = logging.getLogger("arome_vars")
    if not log.handlers:
        log.setLevel(logging.INFO)
        fh = logging.FileHandler(os.path.join(LOG_DIR, "arome.log"), encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s | %(levelname)-7s | %(message)s", "%H:%M:%S"))
        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(logging.Formatter("%(asctime)s | %(levelname)-7s | %(message)s", "%H:%M:%S"))
        log.addHandler(fh)
        log.addHandler(sh)

    class CFG:
        def __init__(self, f):
            with open(f, encoding="utf-8") as fh:
                c = json.load(fh)
            self.key = c["api_key"]
            self.base = c["arome"]["api_base"]
            self.svc1 = c["arome"]["service_001"]
            self.svc2 = c["arome"]["service_0025"]
            self.delay = c["arome"]["availability_delay_minutes"]
            self.timeout = c["http"]["timeout_seconds"]
            self.retry = c["http"]["max_retries"]
            self.rdelay = c["http"]["retry_delay_base"]
            self.rl = c["http"]["rate_limit_delay"]
            self.idelay = c["http"]["inter_request_delay"]
            r = c["region"]
            self.lon0, self.lon1, self.lat0, self.lat1 = r["lon_min"], r["lon_max"], r["lat_min"], r["lat_max"]
            self.name = r["name"]
            self.out = resoldre_output_dir(c["output_dir"])
            self.nsfc = c["sfc"]["n_grid"]
            self.wsfc = c["sfc"]["workers"]
            self.n3d = c["3d"]["n_grid"]
            self.w3d = c["3d"]["workers"]
            self.plevs = c["3d"]["pressure_levels"]
            self.ses = requests.Session()
            self.ses.headers.update({"apikey": self.key})
            self.lock = threading.Semaphore(10)

    cfg = CFG(os.path.join(BASE_DIR, "config.json"))

    CRITICAL_VARS = ["st", "su", "sv", "srh", "sd", "sp", "pressure_msl"]

    progress_lock = threading.Lock()
    total_blocs_globals = 0
    blocs_completats_globals = 0

    def mostrar_barra_global():
        nonlocal blocs_completats_globals, total_blocs_globals
        with progress_lock:
            blocs_completats_globals += 1
            if total_blocs_globals == 0:
                return
            pct = blocs_completats_globals / total_blocs_globals * 100
            bar_w = 30
            bf = int(bar_w * blocs_completats_globals / total_blocs_globals)
            bar = "█" * bf + "░" * (bar_w - bf)
            sys.stdout.write(f"\r  ⬇ GLOBAL: {bar} {pct:5.1f}% ({blocs_completats_globals}/{total_blocs_globals})   ")
            sys.stdout.flush()

    def covs(svc):
        for a in range(30):
            try:
                r = cfg.ses.get(f"{cfg.base}/wcs/{svc}/GetCapabilities",
                                 params={"SERVICE": "WCS", "VERSION": "2.0.1", "LANGUAGE": "eng"}, timeout=cfg.timeout)
                if r.status_code == 200:
                    c = [e.text.strip() for e in ET.fromstring(r.content).iter("{http://www.opengis.net/wcs/2.0}CoverageId")]
                    if c:
                        return c
                elif r.status_code == 429:
                    espera_amb_jitter(cfg.rl, 1, cap=30)
            except Exception:
                pass
            espera_amb_jitter(10, (a % 6) + 1, cap=120)
        raise RuntimeError("API down")

    def dates(c):
        ds = set()
        for x in c:
            p = x.split("___")
            if len(p) >= 2:
                try:
                    ds.add(datetime.strptime(p[-1][:10], "%Y-%m-%d").date())
                except Exception:
                    pass
        return sorted(ds)

    def find_cov(covs, prefix, dt, run_date=None, period=None):
        day = dt.strftime("%Y-%m-%d")
        rday = run_date.strftime("%Y-%m-%d") if run_date else None
        RUNS = ["T18.00.00Z", "T12.00.00Z", "T06.00.00Z", "T00.00.00Z"]

        def ok(c):
            if not c.startswith(prefix):
                return False
            if period and period not in c:
                return False
            if not period and ("_PT" in c or any(f"_P{n}D" in c for n in range(1, 10))):
                return False
            return day in c or (rday and rday in c)

        for rh in RUNS:
            m = sorted(c for c in covs if ok(c) and day in c and rh in c)
            if m:
                return m[-1]
        if rday and rday != day:
            for rh in RUNS:
                m = sorted(c for c in covs if ok(c) and rday in c and rh in c)
                if m:
                    return m[-1]
        m = sorted(c for c in covs if ok(c))
        return m[-1] if m else None

    def tile(svc, cid, t_iso, height=None, pressure=None):
        if not cid:
            return None
        url = (f"{cfg.base}/wcs/{svc}/GetCoverage?SERVICE=WCS&VERSION=2.0.1&COVERAGEID={cid}"
               f"&FORMAT=image/tiff&SUBSET=long({cfg.lon0},{cfg.lon1})&SUBSET=lat({cfg.lat0},{cfg.lat1})&SUBSET=time({t_iso})")
        if height:
            url += f"&SUBSET=height({height})"
        if pressure:
            url += f"&SUBSET=pressure({pressure})"
        # 🛡️ +1 intent addicional respecte l'original per a variables crítiques
        n_intents = cfg.retry + 1
        for a in range(n_intents):
            try:
                with cfg.lock:
                    r = cfg.ses.get(url, timeout=cfg.timeout)
                    if r.status_code == 200:
                        arr = tifffile.imread(io.BytesIO(r.content)).astype(np.float32)
                        if arr.ndim == 3:
                            arr = arr[0]
                        time.sleep(cfg.idelay)
                        return arr
                    if r.status_code == 429:
                        espera_amb_jitter(cfg.rl, a + 1, cap=45)
                    if r.status_code in (400, 404):
                        return None
            except Exception:
                espera_amb_jitter(cfg.rdelay, a + 1, cap=45)
        return None

    def grid(n):
        la = np.linspace(cfg.lat0, cfg.lat1, n)
        lo = np.linspace(cfg.lon0, cfg.lon1, n)
        log2, lag = np.meshgrid(lo, la[::-1])
        return la, lo, log2, lag

    def interp(raw, la, lo):
        nr, nc = raw.shape
        fn = RegularGridInterpolator(
            (np.linspace(cfg.lat0, cfg.lat1, nr), np.linspace(cfg.lon0, cfg.lon1, nc)),
            raw[::-1, :], method="linear", bounds_error=False, fill_value=np.nan)
        pts = np.array([[lt, ln] for lt in la for ln in lo])
        return fn(pts).reshape(len(la), len(lo))

    def pack(acc, h0, h1, n):
        nh = h1 - h0 + 1
        res = [[None] * nh for _ in range(n * n)]
        for hidx, arr in acc.items():
            s = hidx - h0
            if s < 0 or s >= nh:
                continue
            flat = arr[::-1, :].flatten()
            for i, v in enumerate(flat):
                res[i][s] = round(float(v), 1) if not np.isnan(v) else None
        return res

    def sfc_hour(h, run_ref, scovs, rdate, la, lo):
        dt = run_ref + timedelta(hours=h)
        ts = dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        def f(p, per=None):
            return find_cov(scovs, p, dt, rdate, per)

        def _s(raw):
            return interp(raw, la, lo)

        def g(cv, ht=None, fc=1.0):
            if not cv:
                return None
            r = tile(cfg.svc1, cv, ts, height=ht)
            return _s(r) * fc if r is not None else None

        def g2(cv, fc=1.0):
            if not cv:
                return None
            r = tile(cfg.svc1, cv, ts)
            return _s(r) * fc if r is not None else None

        tasks = {
            "st": lambda: g(f("TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), ht=2),
            "su": lambda: g(f("U_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), ht=10),
            "sv": lambda: g(f("V_COMPONENT_OF_WIND__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), ht=10),
            "srh": lambda: g(f("RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), ht=2),
            "sd": lambda: g(f("DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), ht=2),
            "sp": lambda: g2(f("PRESSURE__GROUND_OR_WATER_SURFACE"), fc=0.01),
            "spbl": lambda: g2(f("PLANETARY_BOUNDARY_LAYER_HEIGHT__GROUND_OR_WATER_SURFACE")),
            "cape": lambda: g2(f("CONVECTIVE_AVAILABLE_POTENTIAL_ENERGY__GROUND_OR_WATER_SURFACE")),
            "cin": lambda: g2(f("CONVECTIVE_INHIBITION__GROUND_OR_WATER_SURFACE")),
            "cape_ml": lambda: g2(f("MEAN_LAYER_CAPE__GROUND_OR_WATER_SURFACE")),
            "precip_water": lambda: g2(f("PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE")),
            "lightning_3h_avg": lambda: g2(f("AVERAGE_LIGHTNING_STRIKE_DENSITY_OVER_3HOURS__GROUND_OR_WATER_SURFACE")),
            "reflectivity_dbz": lambda: g2(f("REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE")),
            "reflectivity_lin": lambda: g2(f("REFLECTIVITY_MAX__GROUND_OR_WATER_SURFACE")),
            "snow_depth": lambda: g2(f("SNOW_DEPTH__GROUND_OR_WATER_SURFACE")),
            "rain": lambda: g2(f("TOTAL_WATER_PRECIPITATION__GROUND_OR_WATER_SURFACE", "PT1H")),
            "snow": lambda: g2(f("TOTAL_SNOW_PRECIPITATION__GROUND_OR_WATER_SURFACE", "PT1H")),
            "graupel": lambda: g2(f("GRAUPEL__GROUND_OR_WATER_SURFACE", "PT1H")),
            "hail": lambda: g2(f("HAIL__GROUND_OR_WATER_SURFACE", "PT1H")),
            "lightning": lambda: g2(f("LIGHTNING_STRIKE_DENSITY_CUMULATED__GROUND_OR_WATER_SURFACE", "PT1H")),
            "lightning_3h": lambda: g2(f("LIGHTNING_STRIKE_DENSITY_CUMULATED__GROUND_OR_WATER_SURFACE", "PT3H")),
            "wind_gust": lambda: g(f("WIND_SPEED_GUST__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"), ht=10, fc=3.6),
            "pressure_msl": lambda: g2(f("PRESSURE__MEAN_SEA_LEVEL"), fc=0.01),
            "visibility_min60": lambda: g2(f("VISIBILITY_MINI_60MIN__GROUND_OR_WATER_SURFACE")),
            "low_cloud_cover": lambda: g2(f("LOW_CLOUD_COVER__GROUND_OR_WATER_SURFACE")),
            "medium_cloud_cover": lambda: g2(f("MEDIUM_CLOUD_COVER__GROUND_OR_WATER_SURFACE")),
            "high_cloud_cover": lambda: g2(f("HIGH_CLOUD_COVER__GROUND_OR_WATER_SURFACE")),
        }

        res = {}
        with ThreadPoolExecutor(max_workers=cfg.wsfc) as ex:
            futs = {ex.submit(fn): k for k, fn in tasks.items()}
            for fu in as_completed(futs):
                k = futs[fu]
                try:
                    v = fu.result()
                    if v is not None:
                        res[k] = v
                except Exception:
                    pass

        # 🛡️ Límits físics abans de guardar res (evita valors impossibles
        # que després es propaguen com a "caigudes brusques" al skew-T)
        for k in list(res.keys()):
            res[k] = aplicar_limits_fisics(k, res[k])
        return res

    def sfc_hour_with_retries(h, run_ref, scovs, rdate, la, lo, detector_cascada, max_attempts=1):
        MAX_REINTENTS_BUIT = 10  # 🛡️ reintents quan surt 0/27

        res = sfc_hour(h, run_ref, scovs, rdate, la, lo)

        # 🛡️ TALL DUR: si l'hora surt completament buida (0/27), NO és un
        # forat puntual normal — és senyal que l'API està caiguda o que la
        # xarxa/token està fallant de veritat. Es reintenta fins a 10
        # vegades amb backoff+jitter.
        intents_buit = 0
        while len(res) == 0 and intents_buit < MAX_REINTENTS_BUIT:
            intents_buit += 1
            log.warning(f"[SFC H{h:02d}] 0/27 variables — reintent {intents_buit}/{MAX_REINTENTS_BUIT}...")
            espera_amb_jitter(5, intents_buit, cap=30)
            res = sfc_hour(h, run_ref, scovs, rdate, la, lo)

        if len(res) == 0:
            # 🛡️ Aquesta hora concreta ha esgotat els seus 10 reintents i
            # segueix buida. En lloc de llançar HoraBuidaError directament,
            # es registra al detector de cascada: si aquesta és la 3a hora
            # CONSECUTIVA buida, es llançarà CascadaAPIError immediatament
            # (tall dur i ràpid). Si no forma part d'una cascada (és un
            # forat puntual aïllat), es manté el comportament original de
            # HoraBuidaError, que atura igualment tot el procés però sense
            # l'exit code especial de "rellançar de seguida".
            detector_cascada.registrar_buida(h)
            msg = (f"[SFC H{h:02d}] 0/27 variables després de {MAX_REINTENTS_BUIT} "
                   f"reintents — ATURANT TOT EL PROCÉS (no es publicarà res a la web)")
            log.critical(msg)
            raise HoraBuidaError(msg)

        detector_cascada.registrar_ok(h) if hasattr(detector_cascada, "registrar_ok") else None

        critical_ok = all(v in res for v in CRITICAL_VARS if v != "pressure_msl")
        # 🛡️ Si falten variables crítiques (però n'hi ha alguna), es
        # reintenta la hora sencera un cop més abans de donar-la per
        # parcial (redueix hores buides sense arribar a aturar el procés)
        intents_extra = 0
        while not critical_ok and intents_extra < 2:
            intents_extra += 1
            espera_amb_jitter(4, intents_extra, cap=20)
            res2 = sfc_hour(h, run_ref, scovs, rdate, la, lo)
            res.update({k: v for k, v in res2.items() if k not in res})
            critical_ok = all(v in res for v in CRITICAL_VARS if v != "pressure_msl")

        if critical_ok:
            log.info(f"[SFC H{h:02d}] OK: {len(res)}/27v")
        else:
            log.info(f"[SFC H{h:02d}] Parcial ({intents_extra} reintents extra): {len(res)}/27v")
        mostrar_barra_global()
        return res

    def td_hour(h, run_ref, pcovs, rdate, la, lo):
        dt = run_ref + timedelta(hours=h)
        ts = dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        def f(p):
            return find_cov(pcovs, p, dt, rdate)

        def _s(raw):
            return interp(raw, la, lo)

        def gp(cv, pr):
            if not cv:
                return None
            r = tile(cfg.svc2, cv, ts, pressure=pr)
            return _s(r) if r is not None else None

        CID = {
            "temp": f("TEMPERATURE__ISOBARIC_SURFACE"),
            "geo": f("GEOPOTENTIAL__ISOBARIC_SURFACE"),
            "rh": f("RELATIVE_HUMIDITY__ISOBARIC_SURFACE"),
            "u": f("U_COMPONENT_OF_WIND__ISOBARIC_SURFACE"),
            "v": f("V_COMPONENT_OF_WIND__ISOBARIC_SURFACE"),
            "dew": f("DEW_POINT_TEMPERATURE__ISOBARIC_SURFACE"),
        }
        res = {}
        for plev in cfg.plevs:
            td = gp(CID["temp"], plev) if CID["temp"] else None
            if td is None:
                continue
            tasks = {
                "t": lambda: td,
                "geo": lambda: gp(CID["geo"], plev),
                "rh": lambda: gp(CID["rh"], plev),
                "u": lambda: gp(CID["u"], plev),
                "v": lambda: gp(CID["v"], plev),
                "dew": lambda: gp(CID["dew"], plev),
            }
            pr = {}
            with ThreadPoolExecutor(max_workers=cfg.w3d) as ex:
                futs = {ex.submit(fn): k for k, fn in tasks.items()}
                for fu in as_completed(futs):
                    k = futs[fu]
                    try:
                        v = fu.result()
                        if v is not None:
                            pr[k] = v / 10.0 if k == "geo" else v
                    except Exception:
                        pass

            # 🛡️ Límits físics per nivell abans d'emmagatzemar
            for k in list(pr.keys()):
                pr[k] = aplicar_limits_fisics(k, pr[k])

            if "t" in pr:
                res[plev] = pr

        # 🛡️ Coherència VERTICAL dins la mateixa hora:
        #    - geopotencial estrictament creixent en alçada (menys pressió)
        #    - punt de rosada <= temperatura
        plevs_ordenats_desc = sorted(cfg.plevs, reverse=True)
        perfil_geo = {p: res[p]["geo"] for p in res if "geo" in res.get(p, {})}
        perfil_geo = corregir_monotonicitat_geopotencial(perfil_geo, plevs_ordenats_desc)
        for p, v in perfil_geo.items():
            res[p]["geo"] = v
        perfil_t = {p: res[p]["t"] for p in res if "t" in res.get(p, {})}
        perfil_dew = {p: res[p]["dew"] for p in res if "dew" in res.get(p, {})}
        perfil_dew = corregir_punt_de_rosada(perfil_t, perfil_dew)
        for p, v in perfil_dew.items():
            res[p]["dew"] = v

        mostrar_barra_global()
        return res

    _index_cache = {}

    def carregar_index_satelit(canal):
        if canal in _index_cache:
            return _index_cache[canal]
        mapa = {}
        ruta_idx = os.path.join(cfg.out, f"index_{canal}.json")
        try:
            with open(ruta_idx, "r", encoding="utf-8") as f:
                idx = json.load(f)
            for step in idx.get("steps", []):
                h = step.get("hora_previsio")
                fitxer = step.get("fitxer")
                if h is not None and fitxer:
                    mapa[h] = fitxer
        except Exception:
            pass
        _index_cache[canal] = mapa
        return mapa

    def carregar_dades_satelit(run_ref, h0, h1, n):
        bt108_data, bt62_data = {}, {}
        idx_bt108 = carregar_index_satelit("bt108")
        idx_bt62 = carregar_index_satelit("bt62")

        def carregar_un(canal, idx_canal, h, desti):
            nom_fitxer = idx_canal.get(h)
            if not nom_fitxer:
                return
            fitxer = os.path.join(cfg.out, nom_fitxer)
            if not os.path.exists(fitxer):
                return
            try:
                with open(fitxer, "r", encoding="utf-8") as f:
                    data = json.load(f)
                arr = np.array(data["bt_celsius"], dtype=np.float32)
                w, h_bt = data["meta"]["w"], data["meta"]["h"]
                arr_2d = arr.reshape(h_bt, w)
                lons_orig, lats_orig = np.array(data["lons"]), np.array(data["lats"])
                lon_mesh, lat_mesh = np.meshgrid(lons_orig, lats_orig)
                _, _, lons_dst, lats_dst = grid(n)
                mask = ~np.isnan(arr_2d)
                if np.sum(mask) > 10:
                    desti[h] = griddata((lon_mesh[mask].flatten(), lat_mesh[mask].flatten()),
                                         arr_2d[mask].flatten(), (lons_dst, lats_dst), method='linear')
                else:
                    desti[h] = np.full((n, n), np.nan)
            except Exception:
                pass

        for h in range(h0, h1 + 1):
            carregar_un("BT108", idx_bt108, h, bt108_data)
            carregar_un("BT62", idx_bt62, h, bt62_data)
        return bt108_data, bt62_data

    def write_js(data, varname, filepath):
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        tmp = filepath + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(f"const {varname} = ")
            json.dump(data, f, separators=(',', ':'))
            f.write(";\n")
        for _ in range(10):
            try:
                os.replace(tmp, filepath)
                break
            except PermissionError:
                time.sleep(3)
        mb = os.path.getsize(filepath) / 1024 / 1024
        print(f"\n  -> {os.path.basename(filepath)} ({mb:.1f} MB)")

    def save_sfc(acc, h0, h1, run_ref, label):
        n = cfg.nsfc
        spd, wdir = {}, {}
        for h in acc:
            if "su" in acc[h] and "sv" in acc[h]:
                u, v = acc[h]["su"], acc[h]["sv"]
                spd[h] = np.sqrt(u ** 2 + v ** 2) * 3.6
                wdir[h] = (270 - np.degrees(np.arctan2(v, u))) % 360

        def ts(d):
            return pack(d, h0, h1, n)

        bt108_data, bt62_data = carregar_dades_satelit(run_ref, h0, h1, n)

        surface = {
            "wind_speed": ts(spd), "wind_direction": ts(wdir),
            "temperature": ts({h: acc[h]["st"] for h in acc if "st" in acc[h]}),
            "dew_point": ts({h: acc[h]["sd"] for h in acc if "sd" in acc[h]}),
            "relative_humidity": ts({h: acc[h]["srh"] for h in acc if "srh" in acc[h]}),
            "pressure_surface": ts({h: acc[h]["sp"] for h in acc if "sp" in acc[h]}),
            "pbl_height": ts({h: acc[h]["spbl"] for h in acc if "spbl" in acc[h]}),
            "cape": ts({h: acc[h]["cape"] for h in acc if "cape" in acc[h]}),
            "cin": ts({h: acc[h]["cin"] for h in acc if "cin" in acc[h]}),
            "cape_mean_layer": ts({h: acc[h]["cape_ml"] for h in acc if "cape_ml" in acc[h]}),
            "precipitable_water": ts({h: acc[h]["precip_water"] for h in acc if "precip_water" in acc[h]}),
            "lightning_3h_avg": ts({h: acc[h]["lightning_3h_avg"] for h in acc if "lightning_3h_avg" in acc[h]}),
            "reflectivity_dbz": ts({h: acc[h]["reflectivity_dbz"] for h in acc if "reflectivity_dbz" in acc[h]}),
            "reflectivity_linear": ts({h: acc[h]["reflectivity_lin"] for h in acc if "reflectivity_lin" in acc[h]}),
            "snow_depth": ts({h: acc[h]["snow_depth"] for h in acc if "snow_depth" in acc[h]}),
            "rain_1h": ts({h: acc[h]["rain"] for h in acc if "rain" in acc[h]}),
            "snowfall_1h": ts({h: acc[h]["snow"] for h in acc if "snow" in acc[h]}),
            "graupel_1h": ts({h: acc[h]["graupel"] for h in acc if "graupel" in acc[h]}),
            "hail_1h": ts({h: acc[h]["hail"] for h in acc if "hail" in acc[h]}),
            "lightning_1h": ts({h: acc[h]["lightning"] for h in acc if "lightning" in acc[h]}),
            "lightning_3h": ts({h: acc[h]["lightning_3h"] for h in acc if "lightning_3h" in acc[h]}),
            "wind_gust": ts({h: acc[h]["wind_gust"] for h in acc if "wind_gust" in acc[h]}),
            "pressure_msl": ts({h: acc[h]["pressure_msl"] for h in acc if "pressure_msl" in acc[h]}),
            "visibility_min60": ts({h: acc[h]["visibility_min60"] for h in acc if "visibility_min60" in acc[h]}),
            "low_cloud_cover": ts({h: acc[h]["low_cloud_cover"] for h in acc if "low_cloud_cover" in acc[h]}),
            "medium_cloud_cover": ts({h: acc[h]["medium_cloud_cover"] for h in acc if "medium_cloud_cover" in acc[h]}),
            "high_cloud_cover": ts({h: acc[h]["high_cloud_cover"] for h in acc if "high_cloud_cover" in acc[h]}),
            "bt108": ts(bt108_data), "bt62": ts(bt62_data),
        }
        sp = surface["pressure_surface"]
        np2 = n * n
        sp_meta = [round([v for v in sp[i] if v is not None][0], 1) if any(v is not None for v in sp[i]) else 1013.25 for i in range(np2)]
        seg_date = (run_ref + timedelta(hours=h0)).strftime("%Y-%m-%d")
        hours_utc = [(run_ref + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ") for h in range(h0, h1 + 1)]
        _, _, log2, lag = grid(n)
        meta = {
            "model": "AROME-MF", "region": cfg.name,
            "extent": [cfg.lon0, cfg.lon1, cfg.lat0, cfg.lat1],
            "n_grid": n, "forecast_hours": h1 - h0 + 1,
            "date": seg_date, "run": run_ref.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "h_start_utc": h0, "h_end_utc": h1,
            "hours_utc": hours_utc, "surface_pressure": sp_meta,
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        data = {"meta": meta, "lats": [round(float(x), 4) for x in lag.flatten()],
                "lons": [round(float(x), 4) for x in log2.flatten()], "hourly": {"surface": surface}}
        nm = label.lower().replace(" ", "_")
        fn = f"dades_{nm}_sfc.js"
        fp = os.path.join(cfg.out, fn)
        write_js(data, f"DADES_{label.upper()}_SFC", fp)
        return fp

    def save_3d(acc, h0, h1, run_ref, label):
        n = cfg.n3d
        def ts(d):
            return pack(d, h0, h1, n)

        td_data = {}
        for plev in cfg.plevs:
            t_arr = {h: acc[h][plev]["t"] for h in acc if plev in acc[h] and "t" in acc[h][plev]}
            geo_arr = {h: acc[h][plev]["geo"] for h in acc if plev in acc[h] and "geo" in acc[h][plev]}
            rh_arr = {h: acc[h][plev]["rh"] for h in acc if plev in acc[h] and "rh" in acc[h][plev]}
            dew_arr = {h: acc[h][plev]["dew"] for h in acc if plev in acc[h] and "dew" in acc[h][plev]}
            u_arr = {h: acc[h][plev]["u"] for h in acc if plev in acc[h] and "u" in acc[h][plev]}
            v_arr = {h: acc[h][plev]["v"] for h in acc if plev in acc[h] and "v" in acc[h][plev]}
            spd2, dir2 = {}, {}
            for h in u_arr:
                if h in v_arr:
                    spd2[h] = np.sqrt(u_arr[h] ** 2 + v_arr[h] ** 2) * 3.6
                    dir2[h] = (270 - np.degrees(np.arctan2(v_arr[h], u_arr[h]))) % 360
            td_data[f"{plev}hPa"] = {
                "temperature": ts(t_arr), "geopotential": ts(geo_arr),
                "relative_humidity": ts(rh_arr), "dew_point": ts(dew_arr),
                "wind_speed": ts(spd2), "wind_direction": ts(dir2),
            }
        seg_date = (run_ref + timedelta(hours=h0)).strftime("%Y-%m-%d")
        hours_utc = [(run_ref + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ") for h in range(h0, h1 + 1)]
        _, _, log2, lag = grid(n)
        meta = {
            "model": "AROME-MF", "region": cfg.name,
            "extent": [cfg.lon0, cfg.lon1, cfg.lat0, cfg.lat1],
            "n_grid": n, "forecast_hours": h1 - h0 + 1, "pressure_levels": cfg.plevs,
            "date": seg_date, "run": run_ref.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "h_start_utc": h0, "h_end_utc": h1, "hours_utc": hours_utc,
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        data = {"meta": meta, "lats": [round(float(x), 4) for x in lag.flatten()],
                "lons": [round(float(x), 4) for x in log2.flatten()], "hourly": td_data}
        nm = label.lower().replace(" ", "_")
        fn = f"dades_{nm}_3d.js"
        fp = os.path.join(cfg.out, fn)
        write_js(data, f"DADES_{label.upper()}_3D", fp)
        return fp

    def blindar_series_temporals_sfc(asfc, h0, h1, label, log):
        """
        🛡️ QC temporal de superfície: reompliment d'hores perdudes +
        suavitzat de salts bruscos, variable a variable.
        """
        totes_vars = set()
        for h in asfc:
            totes_vars.update(asfc[h].keys())

        n_interp_total = n_corr_total = 0
        for var in totes_vars:
            serie = {h: asfc.get(h, {}).get(var) for h in range(h0, h1 + 1)}
            serie, n_i, n_c = qc_serie_temporal(serie, var, h0, h1)
            n_interp_total += n_i
            n_corr_total += n_c
            for h, arr in serie.items():
                if arr is not None:
                    asfc.setdefault(h, {})[var] = arr
        log.info("[%s] QC SFC: %d hores-variable interpolades, %d punts de graella corregits",
                  label, n_interp_total, n_corr_total)
        return asfc

    def blindar_series_temporals_3d(atd, h0, h1, plevs, label, log):
        """
        🛡️ QC temporal de la columna vertical (3D): és aquí on es corregeixen
        les "caigudes brusques" del skew-T entre hores consecutives, ja que
        cada nivell de pressió es suavitza de manera independent en el temps
        i, després, es torna a comprovar la monotonicitat vertical.
        """
        n_interp_total = n_corr_total = 0
        for plev in plevs:
            for var in ["t", "geo", "rh", "dew", "u", "v"]:
                serie = {h: atd.get(h, {}).get(plev, {}).get(var) for h in range(h0, h1 + 1)}
                serie, n_i, n_c = qc_serie_temporal(serie, var, h0, h1)
                n_interp_total += n_i
                n_corr_total += n_c
                for h, arr in serie.items():
                    if arr is not None:
                        atd.setdefault(h, {}).setdefault(plev, {})[var] = arr

        # Recomprovar monotonicitat vertical i punt de rosada DESPRÉS del
        # suavitzat temporal (el suavitzat pot desfer una correcció prèvia)
        plevs_ordenats_desc = sorted(plevs, reverse=True)
        for h in atd:
            perfil_geo = {p: atd[h][p]["geo"] for p in atd[h] if "geo" in atd[h][p]}
            perfil_geo = corregir_monotonicitat_geopotencial(perfil_geo, plevs_ordenats_desc)
            for p, v in perfil_geo.items():
                atd[h][p]["geo"] = v
            perfil_t = {p: atd[h][p]["t"] for p in atd[h] if "t" in atd[h][p]}
            perfil_dew = {p: atd[h][p]["dew"] for p in atd[h] if "dew" in atd[h][p]}
            perfil_dew = corregir_punt_de_rosada(perfil_t, perfil_dew)
            for p, v in perfil_dew.items():
                atd[h][p]["dew"] = v

        log.info("[%s] QC 3D (skew-T): %d hores-nivell interpolades, %d punts de graella corregits",
                  label, n_interp_total, n_corr_total)
        return atd

    def processar(label, h0, h1, run_ref, scovs, pcovs, adates):
        rdate = max(adates)
        la_s, lo_s, _, _ = grid(cfg.nsfc)
        la_3, lo_3, _, _ = grid(cfg.n3d)
        asfc, atd = {}, {}
        hores = list(range(h0, h1 + 1))
        total = len(hores)
        log.info("[%s] %02dZ->%02dZ (%dh)", label, h0, h1, total)

        # 🛡️ Un detector de cascada PER PROCESSAMENT (AVUI té el seu,
        # DEMA té el seu propi) — així una cascada a la matinada d'avui
        # no es confon amb hores buides dels dies següents.
        detector_cascada = DetectorCascada(label)

        G = 54
        for i in range(0, total, G):
            gh = hores[i:i + G]
            ng = len(gh)
            print(f"\n  [{label}] {ng} hores, {ng*2} blocs")

            with ThreadPoolExecutor(max_workers=10) as ex:
                futs = {}
                for h in gh:
                    futs[ex.submit(sfc_hour_with_retries, h, run_ref, scovs, rdate, la_s, lo_s, detector_cascada)] = ("sfc", h)
                    futs[ex.submit(td_hour, h, run_ref, pcovs, rdate, la_3, lo_3)] = ("3d", h)
                for fu in as_completed(futs):
                    tp, h = futs[fu]
                    try:
                        d = fu.result()
                        if tp == "sfc" and d:
                            asfc[h] = d
                        elif tp == "3d" and d:
                            atd[h] = d
                    except CascadaAPIError:
                        # 🛡️ CASCADA CONFIRMADA (3 hores consecutives a 0/27):
                        # tallem IMMEDIATAMENT, cancel·lant la resta de
                        # tasques pendents d'aquest bloc, i propaguem cap
                        # amunt fins a main() perquè faci sys.exit(42).
                        log.critical(f"[{label}] 🔁 CASCADA CONFIRMADA — cancel·lant tasques pendents i sortint (exit {EXIT_CODE_CASCADA})")
                        for other_fu in futs:
                            other_fu.cancel()
                        raise
                    except HoraBuidaError:
                        # 🛡️ Error greu però NO de cascada (forat puntual
                        # aïllat): cancel·lem la resta de tasques pendents
                        # d'aquest bloc i propaguem cap amunt igualment,
                        # però SENSE exit code especial.
                        for other_fu in futs:
                            other_fu.cancel()
                        raise
                    except Exception as e:
                        log.error("[%s] H%02d %s: %s", label, h, tp, e)

        hores_ok = sum(1 for h in asfc if sum(1 for v in CRITICAL_VARS if v in asfc[h] and v != "pressure_msl") >= len(CRITICAL_VARS) - 1)
        log.info("[%s] Hores OK (abans de QC): %d/%d", label, hores_ok, total)

        # 🛡️ BLINDATGE: reompliment d'hores perdudes + suavitzat de salts
        # bruscos, tant per a superfície com per al perfil 3D (skew-T)
        print(f"\n  [{label}] 🛡️ Aplicant control de qualitat (monotonicitat + consistència temporal)...")
        asfc = blindar_series_temporals_sfc(asfc, h0, h1, label, log)
        atd = blindar_series_temporals_3d(atd, h0, h1, cfg.plevs, label, log)

        files = []
        sfc_mati = {h: asfc[h] for h in asfc if h <= h0 + 11}
        sfc_tarda = {h: asfc[h] for h in asfc if h >= h0 + 12}
        td_mati = {h: atd[h] for h in atd if h <= h0 + 11}
        td_tarda = {h: atd[h] for h in atd if h >= h0 + 12}

        if sfc_mati: files.append(save_sfc(sfc_mati, min(sfc_mati), max(sfc_mati), run_ref, f"{label}_MATI"))
        if sfc_tarda: files.append(save_sfc(sfc_tarda, min(sfc_tarda), max(sfc_tarda), run_ref, f"{label}_TARDA"))
        if td_mati: files.append(save_3d(td_mati, min(td_mati), max(td_mati), run_ref, f"{label}_MATI"))
        if td_tarda: files.append(save_3d(td_tarda, min(td_tarda), max(td_tarda), run_ref, f"{label}_TARDA"))

        log.info("[%s] %d fitxers guardats", label, len(files))
        return files

    def run_autodeploy():
        script_path = os.path.join(BASE_DIR, "auto.py")
        if not os.path.exists(script_path):
            return
        try:
            import subprocess
            subprocess.run([sys.executable, script_path], capture_output=False, timeout=90000)
        except Exception:
            pass

    os.makedirs(cfg.out, exist_ok=True)

    print("[*] Obtenint coverages...")
    scovs = covs(cfg.svc1)
    pcovs = covs(cfg.svc2)
    adates = dates(scovs)
    if not adates:
        raise RuntimeError("No hi ha dates disponibles.")
    latest = max(adates)
    now = datetime.now(timezone.utc)

    runs = [18, 12, 6, 0]
    srun = 0
    for rh in runs:
        rt = datetime(latest.year, latest.month, latest.day, rh, 0, tzinfo=timezone.utc)
        if rt > now + timedelta(hours=1):
            continue
        rs = f"T{rh:02d}.00.00Z"
        for c in scovs[:200]:
            if latest.strftime("%Y-%m-%d") in c and rs in c:
                srun = rh
                break
        if srun == rh:
            break

    print(f"[*] Run: {latest} {srun:02d}Z")
    run_ref = datetime(latest.year, latest.month, latest.day, srun, 0, tzinfo=timezone.utc)

    avui_h0, avui_h1 = 0, 23
    dema_h0, dema_h1 = 24, 51

    total_blocs_globals = (avui_h1 - avui_h0 + 1) * 2 + (dema_h1 - dema_h0 + 1) * 2
    blocs_completats_globals = 0

    print(f"\n{'='*70}")
    print(f"⚡ DESCÀRREGA: {total_blocs_globals} blocs totals (SFC+3D)")
    print(f"{'='*70}\n")

    all_files = []
    with ThreadPoolExecutor(max_workers=2) as ex:
        f_avui = ex.submit(processar, "AVUI", avui_h0, avui_h1, run_ref, scovs, pcovs, adates)
        f_dema = ex.submit(processar, "DEMA", dema_h0, dema_h1, run_ref, scovs, pcovs, adates)
        for nm, fu in [("AVUI", f_avui), ("DEMA", f_dema)]:
            try:
                fls = fu.result()
                all_files.extend(fls)
                log.info("[%s] ✅ OK — %d fitxers", nm, len(fls))
            except CascadaAPIError:
                # 🛡️ CASCADA: no es genera NI ES PUJA RES a la web. Es
                # propaga fins a main(), que farà sys.exit(EXIT_CODE_CASCADA)
                # perquè el workflow YAML rellanci all.py IMMEDIATAMENT amb
                # un procés nou (nova sessió/connexions), en lloc d'esperar
                # que s'esgotin desenes de reintents amb la sessió penalitzada.
                log.critical("[%s] 🔁 ATURAT PER CASCADA: API penalitzada/caiguda. "
                              "NO ES DESPLEGA RES A LA WEB — es demana rellançament immediat.", nm)
                raise
            except HoraBuidaError:
                # 🛡️ No es genera NI ES PUJA RES a la web. És preferible que
                # el worker falli (job en vermell) a publicar un forat buit.
                log.critical("[%s] ❌ ATURAT: hora(es) amb 0/27 variables després "
                              "de 10 reintents. NO ES DESPLEGA RES A LA WEB.", nm)
                raise
            except Exception as e:
                log.error("[%s] Error: %s", nm, e)

    print(f"\n[✅] DONE! {len(all_files)} fitxers")
    for f in all_files:
        print(f"    {os.path.basename(f)}")

    if all_files:
        run_autodeploy()

    print(f"\n{'='*70}")
    print("PAS 2/2 COMPLETAT!")
    print(f"{'='*70}")


# ════════════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════════════
def main():
    print("\n" + "#" * 70)
    print("#  DESCÀRREGA TOTAL: 1) SATÈL·LIT (JSON)   2) VARIABLES AROME")
    print("#" + " ⚡ LLAMPS + 🛡️ BLINDATGE QC + DETECCIÓ DE CASCADA".ljust(71) + "#")
    print("#" * 70)

    try:
        descarregar_satelit()
    except CascadaAPIError as e:
        # 🛡️ Cascada detectada durant el satèl·lit: sortim IMMEDIATAMENT
        # amb l'exit code especial perquè el workflow rellanci all.py
        # des de zero. No té sentit continuar amb la Part 2 (AROME): és
        # senyal que la sessió/IP amb l'API de Météo-France està
        # penalitzada en general, no només per al satèl·lit.
        print(f"\n🔁 CASCADA (SATÈL·LIT): {e}")
        print(f"   Sortint amb exit code {EXIT_CODE_CASCADA} perquè el workflow rellanci all.py...")
        sys.exit(EXIT_CODE_CASCADA)
    except Exception as e:
        print(f"\n⚠️ El pas de SATÈL·LIT no està disponible: {e}")
        print("   Es continua amb el pas de variables AROME...\n")

    try:
        descarregar_variables_arome()
    except CascadaAPIError as e:
        # 🛡️ Cascada detectada durant les variables AROME: sortim
        # IMMEDIATAMENT amb l'exit code especial (42) perquè el workflow
        # YAML detecti aquest cas concret i rellanci all.py des de zero
        # (nova Session, noves connexions TCP), en lloc de comptar-ho
        # com un error "normal" que reintentaria després d'una pausa de
        # 30s reutilitzant potencialment el mateix entorn de xarxa.
        print(f"\n🔁 CASCADA (AROME): {e}")
        print(f"   Sortint amb exit code {EXIT_CODE_CASCADA} perquè el workflow rellanci all.py...")
        sys.exit(EXIT_CODE_CASCADA)
    except HoraBuidaError as e:
        # 🛡️ Fallo greu però NO de cascada (forat puntual aïllat, no 3
        # hores seguides): es manté el comportament ORIGINAL — error
        # "normal" (exit code != 0, != 42), que el workflow reintentarà
        # amb la lògica dels 10 intents normals (pausa de 30s cadascun).
        print(f"\n❌ TALL DUR (hora puntual buida, no cascada): {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ El pas de VARIABLES AROME ha fallat: {e}")
        sys.exit(1)

    print("\n" + "#" * 70)
    print("#  TOT COMPLETAT")
    print("#" * 70)


if __name__ == "__main__":
    main()