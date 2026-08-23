// ═══════════════════════════════════════════════════════════════════════
//  mapa.js — VERSIÓ FINAL COMPLETA I FUNCIONAL (BLOQUEIG CORREGIT)
//  🌪️ + SCP (risc supercèl·lula) + Calamarsa (mida cm)
//  🔧 Normalització de claus WCS (bt108, ehi, cin, scp_wcs, tpw_700/850, etc.)
//  🔧 FIX: carrera de condicions a assegurarHoraCarregada (mapa en blanc a 3D)
//  🔧 FIX: precàrrega completa en segon pla de TOTES les hores 3D (sense purga)
// ═══════════════════════════════════════════════════════════════════════

const REGION = {
    name: "Catalunya",
    lon_min: 0.10,
    lon_max: 3.60,
    lat_min: 40.40,
    lat_max: 42.95
};

const MAX_STEPS = 52;
const DADES_PATH = './dades';

const VARS_SENSE_VENT = [
    'rain', 'rain_1h', 'snow', 'graupel', 
    'tp', 'tgrp', 'tsnowp', 'precip_water',
    'low_cloud_cover', 'medium_cloud_cover', 'high_cloud_cover',
    'spbl', 'cin',
    'pressure_msl', 'sp','shear_06_eff',
    'el_m', 'reflectivity_dbz', 'lightning','lcl_m','lfc_m',
    'geopotencial_500', 'temperatura_500','bt108', 'lightning_1h','radar_dbz',
    'scp', 'hail_cm', 'scp_wcs', 'stp', 'altitud',
    'ciwc_500', 'cld_rain_850', 'tpw_700', 'tpw_850', 'ehi', 'bt62',
    
    // 🔧 WCS 3D MITJANA
    'CIWC_MITJANA',
    'CLD_RAIN_MITJANA',
    'TPW_MITJANA',
    
    // 🔧 WCS 3D PV SURFACES
    'GEOPOTENTIAL_PV1500',
    'GEOPOTENTIAL_PV2000',
    'THETA_PV1500',
    'THETA_PV2000',
    'U_PV1500',
    'U_PV2000',
    'V_PV1500',
    'V_PV2000',
    'WIND_PV1500',
    'WIND_PV2000',
    
    // 🔧 WCS 3D ISOTERMES
    'ALTITUDE_ISOTERMA_0C',
    'ALTITUDE_ISOTERMA_M10C',
    
    
    'SNOW_DEPTH__GROUND_OR_WATER_SURFACE',
    'WATER_EQUIVALENT_ACCUMULATED_SNOW__GROUND_OR_WATER_SURFACE',
    'PRECIPITATION_TYPE_60_MIN__GROUND_OR_WATER_SURFACE',
    'SEVERE_PRECIPITATION_TYPE_60_MIN__GROUND_OR_WATER_SURFACE',
    'REFLECTIVITY_MAX__GROUND_OR_WATER_SURFACE',
    'REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE',  // ← AFEGIDA!
    'VISIBILITY_MINI_60MIN__GROUND_OR_WATER_SURFACE',
    'VISIBILITY_MINI_PRECIP_60MIN__GROUND_OR_WATER_SURFACE',
    'PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE',
    'TEMPERATURE__GROUND_OR_WATER_SURFACE',
    'TOTAL_CLOUD_COVER__GROUND_OR_WATER_SURFACE',
    'MEAN_LAYER_CAPE__GROUND_OR_WATER_SURFACE',
    'DIAG_GRELE__GROUND_OR_WATER_SURFACE',
    'PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE',
    'SEVERE_PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE',
    'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE',
    'VISIBILITY_MINI_15MIN__GROUND_OR_WATER_SURFACE',
    'VISIBILITY_MINI_PRECIP_15MIN__GROUND_OR_WATER_SURFACE',
];

// ─── Configuració streamlines ──────────────────────────────────────
window.ventEnabled = true;
window.ventMode = 'streamlines';

const wCfg = {
    streamlineColor: 'black',
    streamlineOpacity: 0.7,
    streamlineWidth: 1.2,
};

// ─── MAPES BASE DISPONIBLES ─────────────────────────────────────────
// ─── MAPA BASE OpenStreetMap ──────────────────────────────────────
const MAPES_BASE = {
    osm: {
        url: 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/simplificat/MON3857NW/{z}/{x}/{y}.png',
        opts: { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 },
        nom: ' Mapa orogràfic ICGC'
    },
};
let mapaBaseActiva = 'osm';

// ─── MAPA ─────────────────────────────────────────────────────────
// Centrado en la ciudad de Valencia
const map = L.map('map', {
    crs: L.CRS.EPSG3857,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    minZoom: 6,
    maxZoom: 19,
}).setView([41.8, 1.8], 8)

L.tileLayer(MAPES_BASE[mapaBaseActiva].url, MAPES_BASE[mapaBaseActiva].opts).addTo(map);

map.createPane('paneDades');
map.getPane('paneDades').style.zIndex = 400;
map.getPane('paneDades').style.pointerEvents = 'none';

map.createPane('paneVent');
map.getPane('paneVent').style.zIndex = 500;
map.getPane('paneVent').style.pointerEvents = 'none';

map.createPane('paneGeojson');
map.getPane('paneGeojson').style.zIndex = 650;
map.getPane('paneGeojson').style.pointerEvents = 'auto';

let capaMapaBase = L.tileLayer(MAPES_BASE[mapaBaseActiva].url, MAPES_BASE[mapaBaseActiva].opts).addTo(map);

function canviarMapaBase(clau) {
    const def = MAPES_BASE[clau];
    if (!def) return;
    map.removeLayer(capaMapaBase);
    capaMapaBase = L.tileLayer(def.url, def.opts).addTo(map);
    capaMapaBase.bringToBack();
    mapaBaseActiva = clau;
}

// ═══════════════════════════════════════════════════════════════════════
//  PALETES
// ═══════════════════════════════════════════════════════════════════════

const STOPS_TEMP = [
    {v:-24,r:45,g:0,b:75},{v:-20,r:130,g:0,b:160},{v:-15,r:65,g:0,b:115},
    {v:-10,r:0,g:0,b:255},{v:-5,r:0,g:135,b:255},{v:0,r:0,g:235,b:255},
    {v:2,r:0,g:255,b:150},{v:5,r:0,g:200,b:0},{v:8,r:120,g:255,b:0},
    {v:11,r:255,g:255,b:0},{v:14,r:255,g:255,b:170},{v:17,r:255,g:235,b:100},
    {v:20,r:255,g:200,b:0},{v:23,r:255,g:140,b:0},{v:26,r:255,g:70,b:0},
    {v:29,r:255,g:0,b:0},{v:32,r:180,g:0,b:0},{v:35,r:90,g:0,b:0},
    {v:38,r:150,g:0,b:150},{v:42,r:255,g:0,b:255},{v:46,r:255,g:185,b:255}
];

const STOPS_TEMP_ALT = [
    {v:-70,r:45,g:0,b:75},{v:-55,r:65,g:0,b:115},{v:-40,r:0,g:0,b:255},
    {v:-30,r:0,g:135,b:255},{v:-20,r:0,g:235,b:255},{v:-10,r:0,g:255,b:150},
    {v:0,r:0,g:200,b:0},{v:5,r:120,g:255,b:0},{v:10,r:255,g:255,b:0},
    {v:15,r:255,g:200,b:0},{v:20,r:255,g:140,b:0},{v:25,r:255,g:70,b:0},
    {v:30,r:255,g:0,b:0},{v:38,r:150,g:0,b:150}
];

const STOPS_VENT = [
    {v:0,r:200,g:200,b:255},{v:5,r:150,g:200,b:255},{v:10,r:100,g:180,b:255},
    {v:15,r:0,g:150,b:255},{v:20,r:0,g:200,b:220},{v:25,r:0,g:220,b:180},
    {v:30,r:0,g:255,b:100},{v:35,r:50,g:255,b:0},{v:40,r:150,g:255,b:0},
    {v:45,r:220,g:255,b:0},{v:50,r:255,g:255,b:0},{v:55,r:255,g:230,b:0},
    {v:60,r:255,g:200,b:0},{v:65,r:255,g:170,b:0},{v:70,r:255,g:140,b:0},
    {v:75,r:255,g:110,b:0},{v:80,r:255,g:80,b:0},{v:85,r:255,g:50,b:0},
    {v:90,r:255,g:20,b:0},{v:95,r:255,g:0,b:0},{v:100,r:230,g:0,b:0},
    {v:110,r:210,g:0,b:0},{v:120,r:190,g:0,b:30},{v:130,r:170,g:0,b:60},
    {v:140,r:150,g:0,b:100},{v:150,r:130,g:0,b:140},{v:160,r:180,g:0,b:180},
    {v:170,r:200,g:0,b:200},{v:180,r:220,g:20,b:220},{v:190,r:240,g:50,b:240},
    {v:200,r:250,g:100,b:250},{v:220,r:255,g:150,b:255},{v:240,r:255,g:200,b:255},
    {v:260,r:255,g:220,b:255},{v:280,r:255,g:240,b:255},{v:300,r:255,g:255,b:255}
];

const STOPS_VENT_UV = [
    {v:-60,r:255,g:0,b:255},{v:-40,r:200,g:0,b:200},{v:-20,r:100,g:0,b:200},
    {v:-10,r:0,g:100,b:255},{v:0,r:255,g:255,b:255},{v:10,r:255,g:100,b:0},
    {v:20,r:200,g:0,b:100},{v:40,r:200,g:0,b:0},{v:60,r:100,g:0,b:0}
];

const STOPS_HUMITAT = [
    {v:0,r:210,g:180,b:140},{v:10,r:200,g:160,b:100},{v:20,r:180,g:140,b:80},
    {v:30,r:160,g:200,b:80},{v:40,r:120,g:220,b:60},{v:50,r:80,g:240,b:40},
    {v:60,r:40,g:220,b:20},{v:70,r:0,g:200,b:0},{v:80,r:0,g:150,b:200},
    {v:90,r:0,g:80,b:240},{v:100,r:0,g:0,b:200}
];

const STOPS_PRESSIO = [
    {v:980,r:0,g:0,b:200},{v:990,r:0,g:100,b:255},{v:995,r:0,g:200,b:255},
    {v:1000,r:100,g:255,b:200},{v:1005,r:255,g:255,b:150},{v:1010,r:255,g:200,b:100},
    {v:1015,r:255,g:150,b:50},{v:1020,r:255,g:80,b:0},{v:1025,r:200,g:30,b:0},
    {v:1030,r:150,g:0,b:0},{v:1040,r:100,g:0,b:50}
];

const STOPS_CAPE = [
    {v:0,    r:79,  g:195, b:247, a:255},
    {v:100,  r:50,  g:170, b:240, a:255},
    {v:300,  r:0,   g:140, b:255, a:255},
    {v:500,  r:0,   g:200, b:255, a:255},
    {v:700,  r:0,   g:255, b:200, a:255},
    {v:900,  r:120, g:255, b:80,  a:255},
    {v:1100, r:220, g:255, b:0,   a:255},
    {v:1300, r:255, g:255, b:0,   a:255},
    {v:1500, r:255, g:200, b:0,   a:255},
    {v:1800, r:255, g:140, b:0,   a:255},
    {v:2100, r:255, g:60,  b:0,   a:255},
    {v:2400, r:255, g:0,   b:0,   a:255},
    {v:2800, r:255, g:0,   b:140, a:255},
    {v:3200, r:255, g:0,   b:220, a:255},
    {v:3800, r:200, g:0,   b:255, a:255}
];

// Radar simulat - Reflectivitat dBZ (estil NEXRAD americà)
const STOPS_RADAR = [
    {v:-10, r:0,   g:0,   b:0,   a:0},
    {v:-5,  r:0,   g:0,   b:0,   a:0},
    {v:0,   r:0,   g:0,   b:0,   a:0},
    {v:5,   r:0,   g:236, b:236, a:200},
    {v:10,  r:0,   g:160, b:246, a:215},
    {v:15,  r:0,   g:0,   b:246, a:225},
    {v:20,  r:0,   g:255, b:0,   a:230},
    {v:25,  r:0,   g:200, b:0,   a:235},
    {v:30,  r:0,   g:140, b:0,   a:238},
    {v:35,  r:255, g:255, b:0,   a:240},
    {v:40,  r:255, g:200, b:0,   a:242},
    {v:45,  r:255, g:120, b:0,   a:245},
    {v:50,  r:255, g:0,   b:0,   a:248},
    {v:55,  r:200, g:0,   b:0,   a:250},
    {v:60,  r:255, g:0,   b:255, a:252},
    {v:65,  r:180, g:0,   b:220, a:254},
    {v:70,  r:100, g:0,   b:200, a:255},
    {v:75,  r:255, g:255, b:255, a:255},
];

// ─── BT 10.8µm (negre = calent, blanc = fred) ──────────────────────
const STOPS_BT108 = [
    {v:-80, r:255, g:255, b:255},
    {v:-70, r:250, g:250, b:250},
    {v:-60, r:240, g:240, b:240},
    {v:-50, r:225, g:225, b:225},
    {v:-40, r:210, g:210, b:210},
    {v:-35, r:195, g:195, b:195},
    {v:-30, r:180, g:180, b:180},
    {v:-25, r:165, g:165, b:165},
    {v:-20, r:150, g:150, b:150},
    {v:-15, r:135, g:135, b:135},
    {v:-10, r:120, g:120, b:120},
    {v:-5,  r:105, g:105, b:105},
    {v:0,   r:90,  g:90,  b:90},
    {v:5,   r:60,  g:60,  b:60},
    {v:10,  r:35,  g:35,  b:35},
    {v:15,  r:18,  g:18,  b:18},
    {v:20,  r:8,   g:8,   b:8},
    {v:25,  r:3,   g:3,   b:3},
    {v:30,  r:0,   g:0,   b:0},
    {v:35,  r:0,   g:0,   b:0},
    {v:40,  r:0,   g:0,   b:0},
    {v:50,  r:0,   g:0,   b:0},
];

// ─── BT62 - VAPOR D'AIGUA (BLANC → BLAU → NEGRE) ──────────────────
const STOPS_BT62 = [
    {v:-60, r:255, g:255, b:255},  // blanc
    {v:-55, r:250, g:250, b:255},
    {v:-50, r:245, g:245, b:255},
    {v:-45, r:240, g:240, b:255},
    {v:-40, r:235, g:235, b:255},
    {v:-35, r:225, g:225, b:255},
    {v:-30, r:210, g:210, b:255},
    {v:-25, r:195, g:195, b:255},
    {v:-20, r:180, g:180, b:255},
    {v:-15, r:160, g:160, b:255},
    {v:-10, r:140, g:140, b:255},
    {v:-5,  r:120, g:120, b:255},
    {v:0,   r:100, g:100, b:255},
    {v:5,   r:70,  g:70,  b:255},
    {v:10,  r:40,  g:40,  b:255},
    {v:15,  r:20,  g:20,  b:230},
    {v:20,  r:0,   g:0,   b:200},
    {v:25,  r:0,   g:0,   b:160},
    {v:30,  r:0,   g:0,   b:120},
    {v:35,  r:0,   g:0,   b:80},
    {v:40,  r:0,   g:0,   b:40},
    {v:45,  r:0,   g:0,   b:20},
    {v:50,  r:0,   g:0,   b:0},    // negre
];

// ─── EHI (Energy Helicity Index) - BLANC SEMITRANSPARENT ──────────
const STOPS_EHI = [
    {v:0,    r:255, g:255, b:255, a:30},   // blanc semitransparent (sense dades / EHI≈0)
    {v:0.5,  r:200, g:220, b:255, a:80},   // blau molt clar (per sota del llindar)
    {v:1,    r:150, g:200, b:255, a:120},  // blau clar — llindar EHI≥1: amenaça de tornados
    {v:2,    r:80,  g:180, b:255, a:160},  // blau
    {v:3,    r:0,   g:150, b:255, a:190},  // blau intens — potencial de supercèl·lules ciclòniques
    {v:4,    r:0,   g:200, b:255, a:210},  // cian
    {v:5,    r:0,   g:240, b:200, a:220},  // cian-verd — llindar EHI≥5: tornados violents (rar)
    {v:7,    r:0,   g:255, b:100, a:230},  // verd
    {v:9,    r:100, g:255, b:0,   a:235},  // verd-groc
    {v:11,   r:200, g:255, b:0,   a:240},  // groc-verd
    {v:13,   r:255, g:255, b:0,   a:242},  // groc
    {v:16,   r:255, g:200, b:0,   a:245},  // groc-taronja
    {v:20,   r:255, g:140, b:0,   a:248},  // taronja
    {v:25,   r:255, g:80,  b:0,   a:250},  // taronja-vermell
    {v:30,   r:255, g:20,  b:0,   a:252},  // vermell
    {v:40,   r:220, g:0,   b:60,  a:254},  // vermell-rosa
    {v:50,   r:180, g:0,   b:140, a:255},  // magenta
    {v:70,   r:140, g:0,   b:200, a:255},  // púrpura
    {v:100,  r:100, g:0,   b:255, a:255},  // lila intens (valor extrem, teòric)
];

// ─── STP (Significant Tornado Parameter) - MULTICOLOR ──────────────
const STOPS_STP = [
    {v:0.0,  r:255, g:255, b:255, a:255}, // blanc
    {v:0.57, r:210, g:233, b:255, a:255}, // blau molt clar
    {v:1.16, r:117, g:186, b:255, a:255}, // blau clar
    {v:1.74, r:4,   g:130, b:255, a:255}, // blau
    {v:2.33, r:0,   g:105, b:210, a:255}, // blau mitjà-fosc
    {v:2.93, r:0,   g:54,  b:127, a:255}, // blau fosc
    {v:3.51, r:20,  g:143, b:27,  a:255}, // verd fosc
    {v:4.11, r:99,  g:237, b:7,   a:255}, // verd llima
    {v:4.70, r:255, g:244, b:43,  a:255}, // groc
    {v:5.28, r:232, g:220, b:0,   a:255}, // groc-oliva
    {v:5.88, r:255, g:127, b:39,  a:255}, // taronja
    {v:6.46, r:247, g:30,  b:84,  a:255}, // vermell-rosa
    {v:7.06, r:136, g:0,   b:0,   a:255}, // vermell fosc
    {v:7.65, r:100, g:0,   b:127, a:255}, // púrpura
    {v:8.24, r:194, g:0,   b:251, a:255}, // lila
    {v:8.83, r:221, g:102, b:255, a:255}, // lila clar
    {v:9.41, r:235, g:166, b:255, a:255}, // lila molt clar
    {v:10.0, r:245, g:200, b:255, a:255}, // marge final (extrapolat, la imatge no arriba fins aquí)
];

// ─── GEL NÚVOLS (CIWC) ─────────────────────────────────────────────
const STOPS_GEL = [
    {v:0,    r:255, g:255, b:255, a:0},    // sense gel
    {v:0.01, r:240, g:245, b:255, a:30},   // traces
    {v:0.05, r:220, g:235, b:255, a:60},   // gra molt petit
    {v:0.1,  r:200, g:220, b:255, a:90},   // gra petit
    {v:0.2,  r:170, g:200, b:255, a:120},
    {v:0.3,  r:140, g:180, b:255, a:150},  // pèsol petit
    {v:0.5,  r:100, g:150, b:255, a:180},  // pèsol
    {v:0.7,  r:60,  g:120, b:255, a:200},
    {v:1.0,  r:0,   g:80,  b:255, a:215},  // ~1cm, mida típica de calamarsa
    {v:1.5,  r:0,   g:40,  b:230, a:230},
    {v:2.0,  r:0,   g:0,   b:200, a:240},  // moneda gran
    {v:3.0,  r:60,  g:0,   b:200, a:248},  // pilota golf
    {v:5.0,  r:140, g:0,   b:200, a:252},  // pilota tennis — llindar sever (EUA, ≥2.5cm)
    {v:8.0,  r:200, g:0,   b:180, a:255},  // pilota beisbol
    {v:12,   r:255, g:0,   b:140, a:255},  // pilota softbol
    {v:20,   r:255, g:0,   b:60,  a:255},  // extrem
    {v:30,   r:200, g:0,   b:0,   a:255},  // rècord mundial (~15-20cm real; marge teòric)
];

// ─── AIGUA PRECIPITABLE (TPW) ─────────────────────────────────────
const STOPS_TPW = [
    {v:0,   r:255, g:255, b:255},  // ⬜ blanc
    {v:2,   r:200, g:255, b:200},  // 🟩 verd clar
    {v:4,   r:100, g:255, b:100},  // 🟩 verd clar mig
    {v:6,   r:0,   g:255, b:50},   // 🟩 verd
    {v:8,   r:0,   g:255, b:0},    // 🟩 verd pur
    {v:10,  r:150, g:255, b:0},    // 🟨 verd-groc
    {v:12,  r:255, g:255, b:0},    // 🟨 groc
    {v:14,  r:255, g:230, b:0},    // 🟨 groc daurat
    {v:16,  r:255, g:200, b:0},    // 🟧 groc-taronja
    {v:18,  r:255, g:170, b:0},    // 🟧 taronja clar
    {v:20,  r:255, g:140, b:0},    // 🟧 taronja
    {v:22,  r:255, g:110, b:0},    // 🟧 taronja intens
    {v:24,  r:255, g:80,  b:0},    // 🟧 taronja fort
    {v:26,  r:255, g:50,  b:0},    // 🟧🟥 taronja-vermell
    {v:28,  r:255, g:20,  b:0},    // 🟥 vermell-taronja
    {v:30,  r:255, g:0,   b:0},    // 🟥 vermell
    {v:32,  r:240, g:0,   b:20},   // 🟥 vermell-rosa
    {v:34,  r:220, g:0,   b:50},   // 🟪 rosa
    {v:36,  r:200, g:0,   b:80},   // 🟪 rosa-lila
    {v:38,  r:180, g:0,   b:110},  // 🟪 lila clar
    {v:40,  r:160, g:0,   b:140},  // 🟪 lila
    {v:42,  r:140, g:0,   b:170},  // 🟪 lila mig
    {v:44,  r:120, g:0,   b:200},  // 🟪 lila intens
    {v:46,  r:100, g:0,   b:230},  // 🟪 lila-porpra
    {v:48,  r:80,  g:0,   b:255},  // 🟪 porpra
    {v:50,  r:60,  g:20,  b:255},  // 🔵 porpra-blau
    {v:52,  r:40,  g:40,  b:230},  // 🔵 blau-lila
    {v:54,  r:20,  g:60,  b:200},  // 🔵 blau
    {v:56,  r:0,   g:80,  b:180},  // 🔵 blau mitjà
    {v:58,  r:0,   g:60,  b:150},  // 🔵 blau fosc
    {v:60,  r:0,   g:40,  b:120},  // 🔵 blau més fosc
    {v:62,  r:0,   g:20,  b:90},   // ⬛ blau nit
    {v:64,  r:0,   g:10,  b:60},   // ⬛ blau molt fosc
    {v:66,  r:0,   g:0,   b:40},   // ⬛ gairebé negre
    {v:70,  r:0,   g:0,   b:20},   // ⬛ negre
    {v:75,  r:0,   g:0,   b:10},   // ⬛ negre intens
    {v:80,  r:0,   g:0,   b:5},    // ⬛ negre pur
];

// ─── THETA VIRTUAL (θv) - PALETA PSICODÈLICA EXTREMA ────────────────
// COLORS NEÓ PURS - Cada 1°C és un color COMPLETAMENT diferent
const STOPS_THETAV = [
    // ❄️ AIRE ÀRTIC (negre → neó)
    {v:-40, r:0,   g:0,   b:0},       // NEGRE ABSOLUT
    {v:-39, r:255, g:0,   b:255},     // MAGENTA NEÓ
    {v:-38, r:0,   g:255, b:255},     // CIAN NEÓ
    {v:-37, r:255, g:255, b:0},       // GROC NEÓ
    {v:-36, r:0,   g:255, b:0},       // VERD NEÓ
    {v:-35, r:255, g:0,   b:0},       // VERMELL NEÓ
    {v:-34, r:0,   g:0,   b:255},     // BLAU NEÓ
    {v:-33, r:255, g:128, b:0},       // TARONJA NEÓ
    {v:-32, r:128, g:0,   b:255},     // VIOLETA NEÓ
    {v:-31, r:0,   g:255, b:128},     // VERD MENTA NEÓ
    {v:-30, r:255, g:0,   b:128},     // ROSA NEÓ
    
    // 💙 AIRE MOLT FRED (neó → colors purs)
    {v:-29, r:0,   g:128, b:255},     // BLAU CEL
    {v:-28, r:128, g:255, b:0},       // LIMA
    {v:-27, r:255, g:128, b:255},     // ORQUÍDIA
    {v:-26, r:0,   g:255, b:255},     // AIGUA
    {v:-25, r:255, g:255, b:128},     // CREMA
    {v:-24, r:128, g:0,   b:255},     // PORPRA ELÈCTRIC
    {v:-23, r:255, g:0,   b:255},     // FUCSIA
    {v:-22, r:0,   g:255, b:0},       // VERD PUR
    {v:-21, r:255, g:255, b:0},       // GROC PUR
    {v:-20, r:0,   g:0,   b:255},     // BLAU PUR
    
    // 💚 AIRE FRED (colors primaris elèctrics)
    {v:-19, r:255, g:0,   b:0},       // VERMELL PUR
    {v:-18, r:0,   g:255, b:255},     // CIAN PUR
    {v:-17, r:255, g:0,   b:255},     // MAGENTA PUR
    {v:-16, r:255, g:255, b:0},       // GROC PUR
    {v:-15, r:0,   g:0,   b:0},       // NEGRE
    {v:-14, r:255, g:255, b:255},     // BLANC
    {v:-13, r:255, g:128, b:0},       // TARONJA
    {v:-12, r:0,   g:255, b:128},     // PRIMAVERA
    {v:-11, r:128, g:0,   b:255},     // VIOLETA
    {v:-10, r:255, g:0,   b:128},     // ROSA FORT
    
    // 💛 AIRE FRESC (colors impossibles)
    {v:-9,  r:0,   g:128, b:255},     // BLAU REIAL
    {v:-8,  r:128, g:255, b:0},       // VERD ÀCID
    {v:-7,  r:255, g:128, b:255},     // ROSA CLAR
    {v:-6,  r:0,   g:255, b:255},     // TURQUESA
    {v:-5,  r:255, g:255, b:128},     // GROC CLAR
    {v:-4,  r:128, g:0,   b:0},       // MARRÓ FOSC
    {v:-3,  r:0,   g:128, b:0},       // VERD FOSC
    {v:-2,  r:0,   g:0,   b:128},     // BLAU MARÍ
    {v:-1,  r:255, g:165, b:0},       // TARONJA BRILLANT
    {v:0,   r:255, g:20,  b:147},     // ROSA XOCANT
    
    // 🧡 AIRE TEMPERAT (colors elèctrics)
    {v:1,   r:0,   g:255, b:255},     // CIAN ELÈCTRIC
    {v:2,   r:255, g:255, b:0},       // GROC ELÈCTRIC
    {v:3,   r:255, g:0,   b:255},     // MAGENTA ELÈCTRIC
    {v:4,   r:0,   g:255, b:0},       // VERD ELÈCTRIC
    {v:5,   r:255, g:0,   b:0},       // VERMELL ELÈCTRIC
    {v:6,   r:0,   g:0,   b:255},     // BLAU ELÈCTRIC
    {v:7,   r:255, g:128, b:0},       // TARONJA ELÈCTRIC
    {v:8,   r:128, g:0,   b:255},     // VIOLETA ELÈCTRIC
    {v:9,   r:0,   g:255, b:128},     // MENTA ELÈCTRIC
    {v:10,  r:255, g:0,   b:128},     // ROSA ELÈCTRIC
    
    // ❤️ AIRE CÀLID (colors impossibles)
    {v:11,  r:255, g:255, b:255},     // BLANC PUR
    {v:12,  r:0,   g:0,   b:0},       // NEGRE PUR
    {v:13,  r:255, g:215, b:0},       // OR
    {v:14,  r:192, g:192, b:192},     // PLATA
    {v:15,  r:255, g:69,  b:0},       // TARONJA-vermell
    {v:16,  r:0,   g:255, b:255},     // AIGUA MARINA
    {v:17,  r:255, g:0,   b:255},     // FUCSIA
    {v:18,  r:50,  g:205, b:50},      // VERD LIMA
    {v:19,  r:255, g:105, b:180},     // ROSA CALENT
    {v:20,  r:0,   g:191, b:255},     // BLAU PROFUND
    
    // 🔥 AIRE MOLT CÀLID (colors extrems)
    {v:21,  r:255, g:255, b:0},       // GROC
    {v:22,  r:255, g:0,   b:0},       // VERMELL
    {v:23,  r:0,   g:255, b:0},       // VERD
    {v:24,  r:0,   g:0,   b:255},     // BLAU
    {v:25,  r:255, g:0,   b:255},     // MAGENTA
    {v:26,  r:0,   g:255, b:255},     // CIAN
    {v:27,  r:255, g:255, b:255},     // BLANC
    {v:28,  r:0,   g:0,   b:0},       // NEGRE
    {v:29,  r:255, g:128, b:0},       // TARONJA
    {v:30,  r:128, g:0,   b:255},     // VIOLETA
    
    // ⚡ AIRE TÒRRID (colors impossibles finals)
    {v:31,  r:0,   g:255, b:128},     // VERD NEÓ
    {v:32,  r:255, g:0,   b:128},     // ROSA NEÓ
    {v:33,  r:0,   g:128, b:255},     // BLAU NEÓ
    {v:34,  r:255, g:128, b:255},     // PORPRA NEÓ
    {v:35,  r:128, g:255, b:0},       // LIMA NEÓ
    {v:36,  r:255, g:255, b:128},     // CREMA NEÓ
    {v:37,  r:128, g:255, b:255},     // CEL NEÓ
    {v:38,  r:255, g:128, b:128},     // CORAL NEÓ
    {v:39,  r:128, g:128, b:255},     // LAVANDA NEÓ
    {v:40,  r:255, g:255, b:255},     // BLANC ABSOLUT
];

// ─── PLUJA NÚVOLS (CLD_RAIN) ──────────────────────────────────────
const STOPS_PLUJA = [
    {v:0,    r:255, g:255, b:255, a:0},
    {v:0.01, r:240, g:248, b:255, a:30},
    {v:0.05, r:220, g:240, b:255, a:60},
    {v:0.1,  r:200, g:230, b:255, a:90},
    {v:0.2,  r:170, g:210, b:255, a:120},
    {v:0.3,  r:140, g:190, b:255, a:150},
    {v:0.5,  r:100, g:170, b:255, a:180},
    {v:0.7,  r:50,  g:200, b:255, a:200},
    {v:1.0,  r:0,   g:220, b:255, a:215},
    {v:1.5,  r:0,   g:240, b:200, a:230},
    {v:2.0,  r:0,   g:255, b:140, a:240},
    {v:3.0,  r:100, g:255, b:80,  a:248},
    {v:4.0,  r:180, g:255, b:20,  a:252},
    {v:5.0,  r:255, g:255, b:0,   a:255},
    {v:7.0,  r:255, g:220, b:0,   a:255},
    {v:10,   r:255, g:180, b:0,   a:255},
    {v:15,   r:255, g:140, b:0,   a:255},
    {v:20,   r:255, g:100, b:0,   a:255},
    {v:30,   r:255, g:60,  b:0,   a:255},
    {v:50,   r:200, g:0,   b:0,   a:255},
];

// Llamps 1h — Transparent → Groc → Taronja → Vermell → Morat
const STOPS_LLAMPS_V2 = [
    {v:0,    r:0,   g:0,   b:0,   a:0},
    {v:0.01, r:255, g:255, b:200, a:80},
    {v:0.05, r:255, g:255, b:150, a:120},
    {v:0.1,  r:255, g:255, b:100, a:160},
    {v:0.2,  r:255, g:255, b:50,  a:200},
    {v:0.5,  r:255, g:255, b:0,   a:220},
    {v:1,    r:255, g:220, b:0,   a:230},
    {v:2,    r:255, g:180, b:0,   a:235},
    {v:5,    r:255, g:120, b:0,   a:240},
    {v:10,   r:255, g:60,  b:0,   a:245},
    {v:15,   r:255, g:0,   b:0,   a:250},
    {v:25,   r:230, g:0,   b:30,  a:252},
    {v:40,   r:200, g:0,   b:80,  a:254},
    {v:60,   r:170, g:0,   b:150, a:255},
    {v:80,   r:140, g:0,   b:200, a:255},
    {v:100,  r:100, g:0,   b:255, a:255},
    {v:150,  r:60,  g:0,   b:200, a:255},
    {v:200,  r:30,  g:0,   b:150, a:255},
];

const STOPS_CIN = [
    {v:-500,r:0,g:0,b:180},{v:-200,r:0,g:80,b:255},{v:-100,r:0,g:180,b:255},
    {v:-50,r:100,g:220,b:255},{v:0,r:200,g:200,b:200},{v:50,r:255,g:220,b:100},
    {v:100,r:255,g:150,b:0},{v:200,r:200,g:50,b:0},{v:500,r:150,g:0,b:0}
];

// Paleta per a NÚVOLS ALTS - Només grocs
const STOPS_NUVOLS_ALTS = [
    {v:0,  r:0,   g:0,   b:0,   a:0},
    {v:10, r:255, g:255, b:230, a:160},
    {v:20, r:255, g:255, b:210, a:175},
    {v:30, r:255, g:255, b:190, a:190},
    {v:40, r:255, g:255, b:160, a:200},
    {v:50, r:255, g:255, b:130, a:210},
    {v:60, r:255, g:255, b:100, a:215},
    {v:70, r:255, g:255, b:60,  a:220},
    {v:80, r:255, g:255, b:20,  a:230},
    {v:90, r:255, g:245, b:0,   a:235},
    {v:100,r:255, g:235, b:0,   a:240},
];

// Paleta per a NÚVOLS MITJANS - Només liles
const STOPS_NUVOLS_MITJANS = [
    {v:0,  r:0,   g:0,   b:0,   a:0},
    {v:10, r:230, g:210, b:255, a:160},
    {v:20, r:215, g:190, b:250, a:175},
    {v:30, r:200, g:170, b:245, a:190},
    {v:40, r:185, g:145, b:240, a:200},
    {v:50, r:170, g:120, b:235, a:210},
    {v:60, r:155, g:95,  b:230, a:215},
    {v:70, r:140, g:70,  b:225, a:220},
    {v:80, r:125, g:45,  b:220, a:230},
    {v:90, r:110, g:20,  b:215, a:235},
    {v:100,r:95,  g:0,   b:210, a:240},
];

// Paleta per a NÚVOLS BAIXOS - Només vermells
const STOPS_NUVOLS_BAIXOS = [
    {v:0,  r:0,   g:0,   b:0,   a:0},
    {v:10, r:255, g:200, b:200, a:160},
    {v:20, r:255, g:175, b:175, a:175},
    {v:30, r:255, g:145, b:145, a:190},
    {v:40, r:255, g:115, b:115, a:200},
    {v:50, r:255, g:80,  b:80,  a:210},
    {v:60, r:255, g:50,  b:50,  a:215},
    {v:70, r:240, g:20,  b:20,  a:220},
    {v:80, r:220, g:0,   b:0,   a:230},
    {v:90, r:190, g:0,   b:0,   a:235},
    {v:100,r:160, g:0,   b:0,   a:240},
];

const STOPS_ALTURA_CL = [
    {v:0,r:0,g:0,b:0,a:0},{v:100,r:200,g:200,b:255},{v:200,r:150,g:200,b:255},
    {v:500,r:100,g:180,b:255},{v:1000,r:0,g:200,b:200},{v:1500,r:0,g:255,b:100},
    {v:2000,r:100,g:255,b:0},{v:3000,r:255,g:255,b:0},{v:4000,r:255,g:150,b:0},
    {v:5000,r:255,g:0,b:0},{v:8000,r:200,g:0,b:200},{v:12000,r:150,g:100,b:255}
];

const STOPS_RATXA = [
    {v:0,r:200,g:200,b:255},{v:5,r:150,g:200,b:255},{v:10,r:100,g:180,b:255},
    {v:15,r:0,g:150,b:255},{v:20,r:0,g:200,b:220},{v:25,r:0,g:220,b:180},
    {v:30,r:0,g:255,b:100},{v:35,r:50,g:255,b:0},{v:40,r:150,g:255,b:0},
    {v:45,r:220,g:255,b:0},{v:50,r:255,g:255,b:0},{v:55,r:255,g:230,b:0},
    {v:60,r:255,g:200,b:0},{v:65,r:255,g:170,b:0},{v:70,r:255,g:140,b:0},
    {v:75,r:255,g:110,b:0},{v:80,r:255,g:80,b:0},{v:85,r:255,g:50,b:0},
    {v:90,r:255,g:20,b:0},{v:95,r:255,g:0,b:0},{v:100,r:230,g:0,b:0},
    {v:110,r:210,g:0,b:0},{v:120,r:190,g:0,b:30},{v:130,r:170,g:0,b:60},
    {v:140,r:150,g:0,b:100},{v:150,r:130,g:0,b:140},{v:160,r:180,g:0,b:180},
    {v:170,r:200,g:0,b:200},{v:180,r:220,g:20,b:220},{v:190,r:240,g:50,b:240},
    {v:200,r:250,g:100,b:250},{v:220,r:255,g:150,b:255},{v:240,r:255,g:200,b:255},
    {v:260,r:255,g:220,b:255},{v:280,r:255,g:240,b:255},{v:300,r:255,g:255,b:255}
];

const STOPS_PRECIP = [
    {v:0,r:0,g:0,b:0,a:0},{v:0.1,r:200,g:230,b:255},{v:0.5,r:100,g:200,b:255},
    {v:1,r:0,g:150,b:255},{v:2,r:0,g:100,b:200},{v:5,r:0,g:200,b:0},
    {v:10,r:100,g:255,b:0},{v:20,r:255,g:255,b:0},{v:30,r:255,g:200,b:0},
    {v:50,r:255,g:100,b:0},{v:75,r:255,g:0,b:0},{v:100,r:200,g:0,b:200}
];

const STOPS_VEL_VERT = [
    {v:-5, r:200, g:0,   b:0},
    {v:-2, r:255, g:120, b:0},
    {v:-0.5, r:255, g:220, b:150},
    {v:0,  r:230, g:230, b:230},
    {v:0.5, r:150, g:220, b:255},
    {v:2,  r:0,   g:150, b:255},
    {v:5,  r:0,   g:0,   b:200}
];

const STOPS_VORT_POT = [
    {v:-10,r:0,g:0,b:200},{v:-3,r:0,g:150,b:255},{v:0,r:220,g:220,b:220},
    {v:3,r:255,g:180,b:0},{v:10,r:200,g:0,b:0}
];

const STOPS_DBZ = [
    {v:0,  r:0,   g:0,   b:0,   a:0},    // sense eco
    {v:5,  r:0,   g:236, b:236, a:150},  // cian — traces / boira
    {v:10, r:1,   g:160, b:246, a:200},  // blau clar — pluja/neu molt lleugera
    {v:15, r:0,   g:0,   b:246, a:210},  // blau
    {v:20, r:0,   g:236, b:0,   a:220},  // verd — inici pluja lleugera
    {v:25, r:0,   g:180, b:0,   a:220},  // verd mitjà
    {v:30, r:0,   g:100, b:0,   a:220},  // verd fosc — límit lleugera/moderada
    {v:35, r:255, g:144, b:0,   a:230},  // taronja — pluja moderada
    {v:40, r:255, g:0,   b:0,   a:240},  // vermell — convectiu / moderada-forta
    {v:45, r:192, g:0,   b:0,   a:240},  // vermell fosc
    {v:50, r:120, g:0,   b:0,   a:240},  // granat — pluja forta
    {v:55, r:255, g:0,   b:255, a:250},  // magenta — probable calamarsa
    {v:60, r:160, g:32,  b:240, a:250},  // púrpura — calamarsa probable
    {v:65, r:80,  g:0,   b:130, a:255},  // indi — calamarsa ~2,5cm
    {v:70, r:200, g:200, b:200, a:255},  // gris — extrem
    {v:75, r:255, g:255, b:255, a:255},  // blanc — extrem màxim
];

const STOPS_LLAMPS = [
    {v:0,   r:0,   g:0,   b:0,   a:0},
    {v:0.1, r:255, g:255, b:180},
    {v:0.5, r:255, g:255, b:120},
    {v:1,   r:255, g:255, b:0},
    {v:2,   r:255, g:210, b:0},
    {v:5,   r:255, g:170, b:0},
    {v:10,  r:255, g:120, b:0},
    {v:20,  r:255, g:60,  b:0},
    {v:35,  r:230, g:0,   b:0},
    {v:50,  r:180, g:0,   b:60},
    {v:75,  r:150, g:0,   b:140},
    {v:100, r:130, g:0,   b:200}
];

const STOPS_LI = [
    {v:-10,r:180,g:0,b:0},{v:-6,r:255,g:60,b:0},{v:-3,r:255,g:150,b:0},
    {v:0,r:255,g:255,b:150},{v:3,r:150,g:220,b:255},{v:6,r:0,g:150,b:255},
    {v:10,r:0,g:0,b:180}
];

const STOPS_GEO500 = [
    {v:470,r:0,g:0,b:200},{v:490,r:0,g:100,b:255},{v:510,r:0,g:200,b:255},
    {v:530,r:0,g:255,b:200},{v:540,r:0,g:255,b:0},{v:550,r:100,g:255,b:0},
    {v:560,r:220,g:255,b:0},{v:570,r:255,g:255,b:0},{v:580,r:255,g:200,b:0},
    {v:590,r:255,g:120,b:0},{v:600,r:255,g:60,b:0},{v:610,r:255,g:0,b:0},
    {v:630,r:200,g:0,b:100},{v:650,r:150,g:0,b:150}
];

const STOPS_T500 = [
    {v:-50,r:0,g:0,b:150},{v:-40,r:0,g:50,b:200},{v:-35,r:0,g:100,b:255},
    {v:-30,r:0,g:160,b:255},{v:-25,r:0,g:210,b:255},{v:-20,r:0,g:255,b:255},
    {v:-15,r:0,g:255,b:200},{v:-10,r:0,g:255,b:100},{v:-5,r:100,g:255,b:0},
    {v:0,r:220,g:255,b:0},{v:5,r:255,g:255,b:0},{v:10,r:255,g:220,b:0},
    {v:15,r:255,g:180,b:0},{v:20,r:255,g:120,b:0},{v:25,r:255,g:60,b:0},
    {v:30,r:255,g:0,b:0},{v:35,r:200,g:0,b:0},{v:40,r:150,g:0,b:50}
];

// SRH (Storm Relative Helicity): Efecte MIRALL simètric
const STOPS_SRH = [
    {v:-1500, r:0,   g:0,   b:40},
    {v:-1000, r:0,   g:0,   b:120},
    {v:-800,  r:20,  g:0,   b:180},
    {v:-600,  r:60,  g:0,   b:200},
    {v:-500,  r:100, g:0,   b:140},
    {v:-400,  r:140, g:0,   b:80},
    {v:-350,  r:170, g:0,   b:30},
    {v:-300,  r:200, g:0,   b:0},
    {v:-275,  r:230, g:0,   b:0},
    {v:-250,  r:255, g:30,  b:0},
    {v:-225,  r:255, g:80,  b:0},
    {v:-200,  r:255, g:130, b:0},
    {v:-175,  r:255, g:180, b:0},
    {v:-150,  r:255, g:220, b:0},
    {v:-125,  r:255, g:255, b:0},
    {v:-100,  r:200, g:255, b:0},
    {v:-75,   r:0,   g:255, b:0},
    {v:-50,   r:100, g:255, b:100},
    {v:-25,   r:180, g:255, b:180},
    {v:0,    r:255, g:255, b:255},
    {v:25,   r:180, g:255, b:180},
    {v:50,   r:100, g:255, b:100},
    {v:75,   r:0,   g:255, b:0},
    {v:100,  r:200, g:255, b:0},
    {v:125,  r:255, g:255, b:0},
    {v:150,  r:255, g:220, b:0},
    {v:175,  r:255, g:180, b:0},
    {v:200,  r:255, g:130, b:0},
    {v:225,  r:255, g:80,  b:0},
    {v:250,  r:255, g:30,  b:0},
    {v:275,  r:230, g:0,   b:0},
    {v:300,  r:200, g:0,   b:0},
    {v:350,  r:170, g:0,   b:30},
    {v:400,  r:140, g:0,   b:80},
    {v:500,  r:100, g:0,   b:140},
    {v:600,  r:60,  g:0,   b:200},
    {v:800,  r:20,  g:0,   b:180},
    {v:1000, r:0,   g:0,   b:120},
    {v:1500, r:0,   g:0,   b:40},
];

// SHEAR: Un color DIFERENT cada 2 m/s - Contrast MÀXIM
const STOPS_SHEAR = [
    {v:0,   r:0,   g:0,   b:255},
    {v:2,   r:0,   g:200, b:255},
    {v:4,   r:0,   g:255, b:200},
    {v:6,   r:0,   g:255, b:100},
    {v:8,   r:0,   g:255, b:0},
    {v:10,  r:150, g:255, b:0},
    {v:12,  r:220, g:255, b:0},
    {v:14,  r:255, g:255, b:0},
    {v:16,  r:255, g:220, b:0},
    {v:18,  r:255, g:180, b:0},
    {v:20,  r:255, g:140, b:0},
    {v:22,  r:255, g:90,  b:0},
    {v:24,  r:255, g:40,  b:0},
    {v:26,  r:255, g:0,   b:0},
    {v:28,  r:230, g:0,   b:30},
    {v:30,  r:210, g:0,   b:80},
    {v:32,  r:180, g:0,   b:140},
    {v:34,  r:150, g:0,   b:200},
    {v:36,  r:120, g:0,   b:240},
    {v:38,  r:80,  g:0,   b:255},
    {v:40,  r:40,  g:0,   b:255},
    {v:44,  r:0,   g:0,   b:220},
    {v:48,  r:0,   g:0,   b:180},
    {v:52,  r:20,  g:0,   b:130},
    {v:56,  r:40,  g:0,   b:80},
    {v:60,  r:60,  g:0,   b:0},
    {v:70,  r:0,   g:0,   b:0},
];



// ═══════════════════════════════════════════════════════════════════════
//  🔧 PALETES FALTANTS — WCS 2D
// ═══════════════════════════════════════════════════════════════════════

// ─── Neu i aigua equivalent ──────────────────────────────────────────
const STOPS_NEU = [
    {v:0, r:255, g:255, b:255, a:0},
    {v:1, r:200, g:230, b:255, a:80},
    {v:5, r:150, g:200, b:255, a:120},
    {v:10, r:100, g:170, b:255, a:160},
    {v:20, r:50, g:130, b:255, a:190},
    {v:50, r:0, g:80, b:200, a:220},
    {v:100, r:0, g:30, b:150, a:240},
    {v:200, r:0, g:0, b:100, a:255},
    {v:500, r:0, g:0, b:50, a:255},
];

// ─── Tipus de precipitació (categòric) ──────────────────────────────
const STOPS_PRECIP_TYPE = [
    {v:0, r:255, g:255, b:255, a:0},    // Sense dades
    {v:1, r:0,   g:150, b:255, a:200},  // Pluja (bleu — estàndard Météo-France)
    {v:2, r:255, g:255, b:255, a:220},  // Neige (blanc)
    {v:3, r:255, g:0,   b:255, a:220},  // Verglas / Gel (magenta-rosa — alerta crítica)
    {v:4, r:180, g:0,   b:220, a:200},  // Mélange (púrpura, transició pluja/neu)
];

// ─── Reflectivitat WCS ──────────────────────────────────────────────
const STOPS_REFLECTIVITAT = [
    {v:0, r:0, g:0, b:0, a:0},
    {v:5, r:0, g:236, b:236, a:150},
    {v:10, r:1, g:160, b:246, a:200},
    {v:15, r:0, g:0, b:246, a:210},
    {v:20, r:0, g:236, b:0, a:220},
    {v:25, r:0, g:180, b:0, a:220},
    {v:30, r:0, g:100, b:0, a:220},
    {v:35, r:255, g:144, b:0, a:230},
    {v:40, r:255, g:0, b:0, a:240},
    {v:45, r:192, g:0, b:0, a:240},
    {v:50, r:120, g:0, b:0, a:240},
    {v:55, r:255, g:0, b:255, a:250},
    {v:60, r:160, g:32, b:240, a:250},
    {v:65, r:80, g:0, b:130, a:255},
    {v:70, r:200, g:200, b:200, a:255},
    {v:75, r:255, g:255, b:255, a:255},
];

// ─── Visibilitat ─────────────────────────────────────────────────────
const STOPS_VISIBILITAT = [
    {v:0, r:0, g:0, b:0, a:255},        // Molt mala
    {v:100, r:255, g:0, b:0, a:230},
    {v:500, r:255, g:100, b:0, a:200},
    {v:1000, r:255, g:255, b:0, a:180},
    {v:2000, r:0, g:255, b:0, a:160},
    {v:5000, r:0, g:200, b:255, a:140},
    {v:10000, r:100, g:150, b:255, a:100},
    {v:20000, r:200, g:200, b:255, a:80},
    {v:50000, r:255, g:255, b:255, a:60},
];

// ─── Aigua precipitable (TPW) ──────────────────────────────────────
const STOPS_TPW_WCS = [
    {v:0, r:255, g:255, b:255, a:0},
    {v:2, r:200, g:255, b:200, a:80},
    {v:5, r:100, g:255, b:100, a:120},
    {v:10, r:0, g:255, b:0, a:160},
    {v:15, r:255, g:255, b:0, a:190},
    {v:20, r:255, g:200, b:0, a:210},
    {v:25, r:255, g:140, b:0, a:220},
    {v:30, r:255, g:80, b:0, a:235},
    {v:40, r:255, g:0, b:0, a:248},
    {v:50, r:200, g:0, b:50, a:255},
    {v:60, r:150, g:0, b:100, a:255},
    {v:80, r:100, g:0, b:150, a:255},
];

// ─── Temperatura superfície (model) ────────────────────────────────
const STOPS_TEMP_SFC_MODEL = [
    {v:-50, r:45, g:0, b:75},
    {v:-40, r:130, g:0, b:160},
    {v:-30, r:0, g:0, b:255},
    {v:-20, r:0, g:135, b:255},
    {v:-10, r:0, g:235, b:255},
    {v:0, r:0, g:255, b:150},
    {v:5, r:0, g:200, b:0},
    {v:10, r:120, g:255, b:0},
    {v:15, r:255, g:255, b:0},
    {v:20, r:255, g:255, b:170},
    {v:25, r:255, g:235, b:100},
    {v:30, r:255, g:200, b:0},
    {v:35, r:255, g:140, b:0},
    {v:40, r:255, g:70, b:0},
    {v:45, r:255, g:0, b:0},
    {v:50, r:180, g:0, b:0},
];

// ─── Nuvolositat total ──────────────────────────────────────────────
const STOPS_TOTAL_CLOUD = [
    {v:0, r:0, g:0, b:0, a:0},
    {v:10, r:50, g:50, b:50, a:80},
    {v:20, r:100, g:100, b:100, a:120},
    {v:30, r:150, g:150, b:150, a:150},
    {v:40, r:200, g:200, b:200, a:170},
    {v:50, r:220, g:220, b:220, a:180},
    {v:60, r:240, g:240, b:240, a:190},
    {v:70, r:250, g:250, b:250, a:200},
    {v:80, r:255, g:255, b:255, a:210},
    {v:90, r:255, g:255, b:255, a:220},
    {v:100, r:255, g:255, b:255, a:230},
];

// ─── CAPE mitjana ────────────────────────────────────────────────────
const STOPS_CAPE_MITJANA = [
    {v:0, r:79, g:195, b:247, a:255},
    {v:100, r:50, g:170, b:240, a:255},
    {v:300, r:0, g:140, b:255, a:255},
    {v:500, r:0, g:200, b:255, a:255},
    {v:700, r:0, g:255, b:200, a:255},
    {v:900, r:120, g:255, b:80, a:255},
    {v:1100, r:220, g:255, b:0, a:255},
    {v:1300, r:255, g:255, b:0, a:255},
    {v:1500, r:255, g:200, b:0, a:255},
    {v:1800, r:255, g:140, b:0, a:255},
    {v:2100, r:255, g:60, b:0, a:255},
    {v:2400, r:255, g:0, b:0, a:255},
    {v:2800, r:255, g:0, b:140, a:255},
    {v:3200, r:255, g:0, b:220, a:255},
    {v:3800, r:200, g:0, b:255, a:255},
];

// ─── Intensitat precipitació ────────────────────────────────────────
const STOPS_PRECIP_RATE = [
    {v:0, r:0, g:0, b:0, a:0},
    {v:0.1, r:200, g:230, b:255, a:80},
    {v:0.5, r:100, g:200, b:255, a:120},
    {v:1, r:0, g:150, b:255, a:160},
    {v:2, r:0, g:100, b:200, a:190},
    {v:5, r:0, g:200, b:0, a:210},
    {v:10, r:100, g:255, b:0, a:220},
    {v:20, r:255, g:255, b:0, a:230},
    {v:30, r:255, g:200, b:0, a:240},
    {v:50, r:255, g:100, b:0, a:248},
    {v:75, r:255, g:0, b:0, a:252},
    {v:100, r:200, g:0, b:200, a:255},
];

// ─── GEL NÚVOLS (CIWC) - PALETA BLANC-BLAU ESPECTACULAR ─────────────
// Del blau més profund al blanc més brillant (gel pur)
const STOPS_CIWC_MITJANA = [
    // Sense dades → Transparent
    {v:0,         r:255, g:255, b:255, a:0},
    
    // Gel molt lleu (blanc-blau molt suau, gairebé invisible)
    {v:0.000001,  r:220, g:230, b:255, a:30},
    {v:0.000002,  r:200, g:220, b:255, a:50},
    {v:0.000005,  r:180, g:210, b:255, a:70},
    {v:0.00001,   r:160, g:200, b:255, a:90},
    {v:0.00002,   r:140, g:190, b:255, a:110},
    {v:0.00003,   r:120, g:180, b:255, a:130},
    {v:0.00004,   r:100, g:170, b:255, a:145},
    {v:0.00005,   r:80,  g:160, b:255, a:155},
    
    // Gel lleu (blaus clars)
    {v:0.00006,   r:60,  g:150, b:255, a:165},
    {v:0.00007,   r:40,  g:140, b:255, a:175},
    {v:0.00008,   r:20,  g:130, b:255, a:185},
    {v:0.00009,   r:0,   g:120, b:255, a:190},
    {v:0.0001,    r:0,   g:110, b:250, a:195},
    
    // Gel moderat (blaus mitjans)
    {v:0.0002,    r:0,   g:100, b:245, a:200},
    {v:0.0003,    r:0,   g:90,  b:240, a:205},
    {v:0.0004,    r:0,   g:80,  b:235, a:210},
    {v:0.0005,    r:0,   g:70,  b:230, a:215},
    {v:0.0006,    r:0,   g:60,  b:225, a:220},
    {v:0.0007,    r:0,   g:50,  b:220, a:225},
    {v:0.0008,    r:0,   g:40,  b:215, a:230},
    {v:0.0009,    r:0,   g:30,  b:210, a:235},
    
    // Gel abundant (blaus profunds)
    {v:0.001,     r:0,   g:20,  b:205, a:240},
    {v:0.002,     r:0,   g:10,  b:200, a:245},
    {v:0.003,     r:0,   g:0,   b:195, a:248},
    {v:0.004,     r:10,  g:0,   b:190, a:250},
    {v:0.005,     r:20,  g:0,   b:185, a:252},
    {v:0.006,     r:30,  g:0,   b:180, a:253},
    {v:0.007,     r:40,  g:0,   b:175, a:254},
    {v:0.008,     r:50,  g:0,   b:170, a:255},
    {v:0.009,     r:60,  g:0,   b:165, a:255},
    
    // Gel molt abundant (blaus-porpra profunds)
    {v:0.01,      r:70,  g:0,   b:160, a:255},
    {v:0.02,      r:80,  g:0,   b:155, a:255},
    {v:0.03,      r:90,  g:0,   b:150, a:255},
    {v:0.04,      r:100, g:0,   b:145, a:255},
    {v:0.05,      r:110, g:0,   b:140, a:255},
    
    // Gel extrem (porpres-blanes intensos)
    {v:0.06,      r:120, g:0,   b:135, a:255},
    {v:0.07,      r:130, g:0,   b:130, a:255},
    {v:0.08,      r:140, g:0,   b:125, a:255},
    {v:0.09,      r:150, g:0,   b:120, a:255},
    {v:0.1,       r:160, g:0,   b:115, a:255},
    
    // Gel molt extrem (transició a blanc brillant)
    {v:0.15,      r:170, g:0,   b:110, a:255},
    {v:0.2,       r:180, g:20,  b:105, a:255},
    {v:0.25,      r:190, g:40,  b:100, a:255},
    {v:0.3,       r:200, g:60,  b:95,  a:255},
    {v:0.4,       r:210, g:80,  b:90,  a:255},
    {v:0.5,       r:220, g:100, b:85,  a:255},
    
    // Gel pur (blanc-blau brillant)
    {v:0.6,       r:230, g:120, b:80,  a:255},
    {v:0.7,       r:235, g:140, b:75,  a:255},
    {v:0.8,       r:240, g:160, b:70,  a:255},
    {v:0.9,       r:245, g:180, b:65,  a:255},
    {v:1.0,       r:250, g:200, b:60,  a:255},
    
    // Gel molt intens (blanc daurat)
    {v:1.2,       r:252, g:210, b:55,  a:255},
    {v:1.4,       r:254, g:220, b:50,  a:255},
    {v:1.6,       r:255, g:230, b:45,  a:255},
    {v:1.8,       r:255, g:235, b:40,  a:255},
    {v:2.0,       r:255, g:240, b:35,  a:255},
    
    // Gel extremadament intens (blanc pur)
    {v:2.5,       r:255, g:245, b:30,  a:255},
    {v:3.0,       r:255, g:250, b:25,  a:255},
    {v:4.0,       r:255, g:252, b:20,  a:255},
    {v:5.0,       r:255, g:254, b:15,  a:255},
    {v:7.0,       r:255, g:255, b:10,  a:255},
    {v:10.0,      r:255, g:255, b:255, a:255},  // BLANC PUR (gel màxim)
    
    // Valors extrems (blanc brillant amb to daurat)
    {v:15.0,      r:255, g:250, b:240, a:255},
    {v:20.0,      r:255, g:255, b:255, a:255},  // BLANC ABSOLUT
];
const STOPS_CLD_RAIN_MITJANA = [
    // Sense dades / Zero → Gris fosc elegant
    {v:0,         r:25,  g:28,  b:40,  a:220},
    
    // Blaus profunds (valors molt petits)
    {v:0.000001,  r:10,  g:40,  b:120, a:230},
    {v:0.000005,  r:0,   g:70,  b:190, a:235},
    {v:0.00001,   r:0,   g:110, b:240, a:240},
    {v:0.00002,   r:0,   g:160, b:255, a:242},
    {v:0.00003,   r:0,   g:200, b:255, a:245},
    {v:0.00004,   r:0,   g:230, b:220, a:248},
    {v:0.00005,   r:0,   g:255, b:180, a:250},
    
    // Verds (valors petits)
    {v:0.0001,    r:50,  g:255, b:120, a:252},
    {v:0.0002,    r:130, g:255, b:70,  a:253},
    {v:0.0005,    r:210, g:255, b:20,  a:254},
    
    // Grocs i taronges (valors mitjans)
    {v:0.001,     r:255, g:255, b:0,   a:255},
    {v:0.002,     r:255, g:220, b:0,   a:255},
    {v:0.003,     r:255, g:180, b:0,   a:255},
    {v:0.005,     r:255, g:140, b:0,   a:255},
    {v:0.01,      r:255, g:100, b:0,   a:255},
    
    // Vermells (valors alts)
    {v:0.02,      r:255, g:60,  b:0,   a:255},
    {v:0.03,      r:255, g:20,  b:0,   a:255},
    {v:0.05,      r:230, g:0,   b:50,  a:255},
    {v:0.1,       r:200, g:0,   b:120, a:255},
    
    // Liles i morats (valors molt alts)
    {v:0.2,       r:160, g:0,   b:200, a:255},
    {v:0.5,       r:120, g:0,   b:240, a:255},
    {v:1.0,       r:80,  g:0,   b:220, a:255},
    {v:2.0,       r:40,  g:0,   b:180, a:255},
    
    // Blanc brillant per a valors extrems
    {v:5.0,       r:200, g:200, b:255, a:255},
    {v:10.0,      r:255, g:255, b:255, a:255},
];

// ─── TPW mitjana ──────────────────────────────────────────────────
const STOPS_TPW_MITJANA = [
    // Sense dades / Zero → Gris fosc elegant
    {v:0,     r:30,  g:32,  b:45,  a:220},
    
    // Molt sec (blau molt clar)
    {v:1,     r:200, g:220, b:255, a:200},
    {v:2,     r:180, g:210, b:255, a:210},
    {v:4,     r:150, g:195, b:255, a:215},
    {v:6,     r:120, g:180, b:255, a:220},
    
    // Humitat baixa (blau)
    {v:8,     r:90,  g:165, b:255, a:225},
    {v:10,    r:60,  g:145, b:255, a:230},
    {v:12,    r:30,  g:125, b:255, a:235},
    {v:14,    r:0,   g:105, b:245, a:240},
    
    // Humitat mitjana (cian a verd)
    {v:16,    r:0,   g:145, b:230, a:242},
    {v:17,    r:0,   g:180, b:210, a:244},
    {v:18,    r:0,   g:210, b:185, a:246},
    {v:19,    r:50,  g:230, b:155, a:248},
    
    // Humitat alta (verd a groc)
    {v:20,    r:100, g:245, b:120, a:250},
    {v:21,    r:160, g:250, b:80,  a:252},
    {v:22,    r:210, g:250, b:40,  a:253},
    {v:23,    r:245, g:245, b:0,   a:254},
    
    // Molt humit (groc a taronja)
    {v:24,    r:255, g:220, b:0,   a:255},
    {v:25,    r:255, g:195, b:0,   a:255},
    {v:26,    r:255, g:165, b:0,   a:255},
    {v:27,    r:255, g:135, b:0,   a:255},
    
    // Extremadament humit (taronja a vermell)
    {v:28,    r:255, g:105, b:0,   a:255},
    {v:29,    r:255, g:75,  b:0,   a:255},
    {v:30,    r:255, g:45,  b:0,   a:255},
    {v:32,    r:255, g:20,  b:0,   a:255},
    
    // Saturat (vermell fosc)
    {v:34,    r:230, g:0,   b:0,   a:255},
    {v:36,    r:200, g:0,   b:0,   a:255},
    {v:38,    r:170, g:0,   b:0,   a:255},
    {v:40,    r:140, g:0,   b:0,   a:255},
    {v:45,    r:100, g:0,   b:0,   a:255},
    {v:50,    r:70,  g:0,   b:0,   a:255},
    {v:60,    r:40,  g:0,   b:0,   a:255},
];

// ═══════════════════════════════════════════════════════════════════════
//  🔧 PALETES FALTANTS — WCS 3D (PV SURFACES)
// ═══════════════════════════════════════════════════════════════════════

// ─── Geopotencial PV ──────────────────────────────────────────────
const STOPS_GEO_PV = [
    {v:470, r:0, g:0, b:200},
    {v:490, r:0, g:100, b:255},
    {v:510, r:0, g:200, b:255},
    {v:530, r:0, g:255, b:200},
    {v:540, r:0, g:255, b:0},
    {v:550, r:100, g:255, b:0},
    {v:560, r:220, g:255, b:0},
    {v:570, r:255, g:255, b:0},
    {v:580, r:255, g:200, b:0},
    {v:590, r:255, g:120, b:0},
    {v:600, r:255, g:60, b:0},
    {v:610, r:255, g:0, b:0},
    {v:630, r:200, g:0, b:100},
    {v:650, r:150, g:0, b:150},
];

// ─── Theta PV ──────────────────────────────────────────────────────
const STOPS_THETA_PV = [
    {v:-30, r:0, g:0, b:200},
    {v:-20, r:0, g:100, b:255},
    {v:-10, r:0, g:200, b:255},
    {v:0, r:0, g:255, b:200},
    {v:10, r:0, g:255, b:100},
    {v:20, r:100, g:255, b:0},
    {v:30, r:255, g:255, b:0},
    {v:40, r:255, g:200, b:0},
    {v:50, r:255, g:120, b:0},
    {v:60, r:255, g:60, b:0},
    {v:70, r:255, g:0, b:0},
    {v:80, r:200, g:0, b:100},
    {v:90, r:150, g:0, b:150},
];

// ─── Vent U i V (PV) ──────────────────────────────────────────────
const STOPS_VENT_PV = [
    {v:-100, r:255, g:0, b:255},
    {v:-60, r:200, g:0, b:200},
    {v:-30, r:100, g:0, b:200},
    {v:-10, r:0, g:100, b:255},
    {v:0, r:255, g:255, b:255},
    {v:10, r:255, g:100, b:0},
    {v:30, r:200, g:0, b:100},
    {v:60, r:200, g:0, b:0},
    {v:100, r:100, g:0, b:0},
];

// ─── Vent total (PV) ──────────────────────────────────────────────
const STOPS_WIND_PV = [
    {v:0, r:200, g:200, b:255},
    {v:5, r:150, g:200, b:255},
    {v:10, r:100, g:180, b:255},
    {v:15, r:0, g:150, b:255},
    {v:20, r:0, g:200, b:220},
    {v:30, r:0, g:255, b:100},
    {v:40, r:150, g:255, b:0},
    {v:50, r:255, g:255, b:0},
    {v:60, r:255, g:200, b:0},
    {v:70, r:255, g:140, b:0},
    {v:80, r:255, g:80, b:0},
    {v:90, r:255, g:20, b:0},
    {v:100, r:255, g:0, b:0},
    {v:120, r:190, g:0, b:30},
    {v:150, r:130, g:0, b:140},
    {v:200, r:250, g:100, b:250},
    {v:250, r:255, g:200, b:255},
    {v:300, r:255, g:255, b:255},
];

// ─── Altitud isoterma ──────────────────────────────────────────────
const STOPS_ISOTERMA = [
    {v:0, r:0, g:0, b:0, a:0},
    {v:500, r:200, g:200, b:255, a:80},
    {v:1000, r:100, g:180, b:255, a:120},
    {v:1500, r:0, g:200, b:200, a:160},
    {v:2000, r:0, g:255, b:100, a:190},
    {v:2500, r:100, g:255, b:0, a:210},
    {v:3000, r:255, g:255, b:0, a:220},
    {v:3500, r:255, g:200, b:0, a:230},
    {v:4000, r:255, g:150, b:0, a:240},
    {v:4500, r:255, g:80, b:0, a:248},
    {v:5000, r:255, g:0, b:0, a:252},
    {v:6000, r:200, g:0, b:50, a:255},
    {v:8000, r:150, g:0, b:100, a:255},
    {v:12000, r:100, g:0, b:150, a:255},
];

// ─── SCP (Supercell Composite Parameter) - BLANC SEMITRANSPARENT ──
const STOPS_SCP = [
    {v:0,    r:255, g:255, b:255, a:30},   // blanc semitransparent (sense dades)
    {v:0.1,  r:255, g:250, b:255, a:50},
    {v:0.2,  r:255, g:240, b:255, a:70},
    {v:0.3,  r:255, g:230, b:255, a:90},
    {v:0.5,  r:255, g:210, b:255, a:120},  // risc baix
    {v:0.7,  r:255, g:180, b:255, a:150},
    {v:1.0,  r:255, g:150, b:255, a:175},  // risc moderat
    {v:1.3,  r:255, g:120, b:255, a:190},
    {v:1.5,  r:255, g:100, b:255, a:200},
    {v:1.8,  r:255, g:70,  b:255, a:210},
    {v:2.0,  r:255, g:40,  b:255, a:220},  // risc alt
    {v:2.3,  r:255, g:20,  b:220, a:225},
    {v:2.5,  r:255, g:0,   b:190, a:230},
    {v:3.0,  r:240, g:0,   b:160, a:235},  // risc molt alt
    {v:3.5,  r:220, g:0,   b:130, a:240},
    {v:4.0,  r:200, g:0,   b:100, a:245},
    {v:4.5,  r:180, g:0,   b:80,  a:248},
    {v:5.0,  r:160, g:0,   b:60,  a:250},  // risc extrem
    {v:6.0,  r:140, g:0,   b:40,  a:252},
    {v:7.0,  r:120, g:0,   b:20,  a:254},
    {v:8.0,  r:100, g:0,   b:0,   a:255},
    {v:9.0,  r:80,  g:0,   b:0,   a:255},
    {v:10,   r:60,  g:0,   b:0,   a:255},
    {v:12,   r:40,  g:0,   b:0,   a:255},
    {v:15,   r:20,  g:0,   b:0,   a:255},
    {v:20,   r:0,   g:0,   b:0,   a:255},  // negre
];

// ─── CALAMARSA (mida cm) ──────────────────────────────────────────────
const STOPS_HAIL = [
    {v:0,    r:255, g:255, b:255, a:0},
    {v:0.1,  r:250, g:252, b:255, a:60},
    {v:0.2,  r:240, g:248, b:255, a:100},
    {v:0.3,  r:225, g:240, b:255, a:130},
    {v:0.4,  r:210, g:232, b:255, a:155},
    {v:0.5,  r:190, g:220, b:255, a:175},
    {v:0.6,  r:170, g:210, b:255, a:190},
    {v:0.7,  r:145, g:195, b:255, a:200},
    {v:0.8,  r:120, g:180, b:255, a:210},
    {v:0.9,  r:95,  g:165, b:255, a:218},
    {v:1.0,  r:70,  g:150, b:255, a:225},
    {v:1.1,  r:45,  g:135, b:255, a:230},
    {v:1.2,  r:20,  g:120, b:255, a:235},
    {v:1.3,  r:0,   g:105, b:255, a:240},
    {v:1.4,  r:0,   g:90,  b:245, a:242},
    {v:1.5,  r:0,   g:75,  b:235, a:245},
    {v:1.6,  r:0,   g:60,  b:225, a:248},
    {v:1.7,  r:0,   g:45,  b:215, a:250},
    {v:1.8,  r:0,   g:30,  b:205, a:252},
    {v:1.9,  r:0,   g:15,  b:195, a:254},
    {v:2.0,  r:0,   g:0,   b:185, a:255},
    {v:2.1,  r:20,  g:20,  b:170, a:255},
    {v:2.2,  r:40,  g:40,  b:155, a:255},
    {v:2.3,  r:60,  g:60,  b:140, a:255},
    {v:2.4,  r:80,  g:80,  b:125, a:255},
    {v:2.5,  r:100, g:100, b:110, a:255},
    {v:2.6,  r:120, g:120, b:95,  a:255},
    {v:2.7,  r:140, g:140, b:80,  a:255},
    {v:2.8,  r:160, g:160, b:65,  a:255},
    {v:2.9,  r:180, g:180, b:50,  a:255},
    {v:3.0,  r:200, g:200, b:35,  a:255},
    {v:3.1,  r:210, g:200, b:30,  a:255},
    {v:3.2,  r:220, g:200, b:25,  a:255},
    {v:3.3,  r:230, g:200, b:20,  a:255},
    {v:3.4,  r:240, g:200, b:15,  a:255},
    {v:3.5,  r:250, g:200, b:10,  a:255},
    {v:3.6,  r:255, g:190, b:5,   a:255},
    {v:3.7,  r:255, g:180, b:0,   a:255},
    {v:3.8,  r:255, g:170, b:0,   a:255},
    {v:3.9,  r:255, g:160, b:0,   a:255},
    {v:4.0,  r:255, g:150, b:0,   a:255},
    {v:4.2,  r:255, g:130, b:0,   a:255},
    {v:4.4,  r:255, g:110, b:0,   a:255},
    {v:4.6,  r:255, g:90,  b:0,   a:255},
    {v:4.8,  r:255, g:70,  b:0,   a:255},
    {v:5.0,  r:255, g:50,  b:0,   a:255},
    {v:5.2,  r:255, g:35,  b:0,   a:255},
    {v:5.4,  r:255, g:20,  b:0,   a:255},
    {v:5.6,  r:255, g:5,   b:0,   a:255},
    {v:5.8,  r:255, g:0,   b:0,   a:255},
    {v:6.0,  r:240, g:0,   b:0,   a:255},
    {v:6.2,  r:230, g:0,   b:20,  a:255},
    {v:6.4,  r:220, g:0,   b:40,  a:255},
    {v:6.6,  r:210, g:0,   b:60,  a:255},
    {v:6.8,  r:200, g:0,   b:80,  a:255},
    {v:7.0,  r:190, g:0,   b:100, a:255},
    {v:7.2,  r:180, g:0,   b:120, a:255},
    {v:7.4,  r:170, g:0,   b:140, a:255},
    {v:7.6,  r:160, g:0,   b:160, a:255},
    {v:7.8,  r:150, g:0,   b:180, a:255},
    {v:8.0,  r:140, g:0,   b:200, a:255},
    {v:8.2,  r:130, g:0,   b:220, a:255},
    {v:8.4,  r:120, g:0,   b:240, a:255},
    {v:8.6,  r:110, g:0,   b:255, a:255},
    {v:8.8,  r:100, g:20,  b:255, a:255},
    {v:9.0,  r:90,  g:40,  b:255, a:255},
    {v:9.2,  r:80,  g:60,  b:255, a:255},
    {v:9.4,  r:70,  g:80,  b:255, a:255},
    {v:9.6,  r:60,  g:100, b:255, a:255},
    {v:9.8,  r:50,  g:120, b:255, a:255},
    {v:10.0, r:255, g:255, b:255, a:255},
];


const ALIES_CLAUS = {
    'BRIGHTNESS_TEMPERATURE__GROUND_OR_WATER_SURFACE': 'bt108',
    'BRIGHTNESS_TEMPERATURE_62__GROUND_OR_WATER_SURFACE': 'bt62',
    'DIAG_EHI__GROUND': 'ehi',
    'CIN__GROUND': 'cin',
    'DIAG_SCP__GROUND': 'scp_wcs',      // SCP del WCS (Météo-France) — diferenciat del 'scp' calculat localment
    'DIAG_STP__GROUND': 'stp',
    'ALTITUDE__GROUND': 'altitud',
    'CIWC__ISOBARIC_500': 'ciwc_500',
    'CLD_RAIN__ISOBARIC_850': 'cld_rain_850',
    'TPW__ISOBARIC_700': 'tpw_700',
    'TPW__ISOBARIC_850': 'tpw_850',
    'THETAV__ISOBARIC_850': 'thetav_850',
};

// Mapeig invers: clau curta -> clau crua real del JSON
const CLAU_REAL = {};
Object.entries(ALIES_CLAUS).forEach(([crua, curta]) => {
    CLAU_REAL[curta] = crua;
});

// Retorna la clau curta normalitzada (per PALETES, panell, agrupacions)
function normalitzarClau(clauOriginal) {
    return ALIES_CLAUS[clauOriginal] || clauOriginal;
}

// Retorna la clau tal com és realment al JSON (data.variables[...])
function clauRealPerLlegir(clauCurta) {
    return CLAU_REAL[clauCurta] || clauCurta;
}

// ═══════════════════════════════════════════════════════════════════════
//  PALETES MAP
// ═══════════════════════════════════════════════════════════════════════

const PALETES = {
    // ─── SFC (superfície) ──────────────────────────────────────────
    st:             {titol:'Temperatura 2m',           unitat:'°C',        stops:STOPS_TEMP},
    sd:             {titol:'Punt rosada 2m',           unitat:'°C',        stops:STOPS_TEMP},
    srh:            {titol:'Humitat 2m',               unitat:'%',         stops:STOPS_HUMITAT},
    temp_min2m:     {titol:'Temp. mín. 2m',            unitat:'°C',        stops:STOPS_TEMP},
    temp_max2m:     {titol:'Temp. màx. 2m',            unitat:'°C',        stops:STOPS_TEMP},
    su:             {titol:'Vent U 10m',               unitat:'m/s',       stops:STOPS_VENT_UV},
    sv:             {titol:'Vent V 10m',               unitat:'m/s',       stops:STOPS_VENT_UV},
    wind_speed_10m: {titol:'Vent 10m',                 unitat:'km/h',      stops:STOPS_RATXA},
    wind_gust:      {titol:'Ratxa 10m',                unitat:'km/h',      stops:STOPS_RATXA},
    sp:             {titol:'Pressió superf.',          unitat:'hPa',       stops:STOPS_PRESSIO},
    pressure_msl:   {titol:'Pressió MSL',              unitat:'hPa',       stops:STOPS_PRESSIO},
    cape:           {titol:'CAPE',                     unitat:'J/kg',      stops:STOPS_CAPE},
    cin:            {titol:'CIN',                      unitat:'J/kg',      stops:STOPS_CIN},
    spbl:           {titol:'Capa límit',               unitat:'m',         stops:STOPS_ALTURA_CL},
    radar_dbz:      {titol:'Radar simulat',            unitat:'dBZ',       stops:STOPS_RADAR},
    'REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE': {
    titol: 'Reflectivitat dBZ',
    unitat: 'dBZ',
    stops: STOPS_REFLECTIVITAT
},
    lightning_1h:   {titol:'Llamps 1h',                unitat:'fl/m²',     stops:STOPS_LLAMPS_V2},
    low_cloud_cover:{titol:'Núvols baixos',            unitat:'%',         stops:STOPS_NUVOLS_BAIXOS},
    medium_cloud_cover:{titol:'Núvols mitjans',        unitat:'%',         stops:STOPS_NUVOLS_MITJANS},
    high_cloud_cover:{titol:'Núvols alts',             unitat:'%',         stops:STOPS_NUVOLS_ALTS},
    tp:             {titol:'Precip. total acum.',      unitat:'mm',        stops:STOPS_PRECIP},
    tsnowp:         {titol:'Neu total acum.',          unitat:'mm',        stops:STOPS_PRECIP},

    // ─── SATÈL·LIT ──────────────────────────────────────────────────
    bt108:          {titol:'BT 10.8µm',                unitat:'°C',        stops:STOPS_BT108},
    bt62:           {titol:'BT 6.2µm (vapor)',         unitat:'°C',        stops:STOPS_BT62},

    // ─── 3D ─────────────────────────────────────────────────────────
    t:              {titol:'Temperatura',               unitat:'°C',        stops:STOPS_TEMP_ALT},
    u:              {titol:'Vent U',                   unitat:'m/s',       stops:STOPS_VENT_UV},
    v:              {titol:'Vent V',                   unitat:'m/s',       stops:STOPS_VENT_UV},
    wind_speed:     {titol:'Vent',                     unitat:'km/h',      stops:STOPS_RATXA},
    r:              {titol:'Humitat',                  unitat:'%',         stops:STOPS_HUMITAT},
    w:              {titol:'Vel. vertical',            unitat:'Pa/s',      stops:STOPS_VEL_VERT},
    dpt:            {titol:'Punt rosada',              unitat:'°C',        stops:STOPS_TEMP_ALT},
    pv:             {titol:'Vort. potencial',          unitat:'PVU',       stops:STOPS_VORT_POT},

    // ─── CONVECTIU ──────────────────────────────────────────────────
    lcl_m:          {titol:'LCL (alçada)',             unitat:'m',         stops:STOPS_ALTURA_CL},
    lfc_m:          {titol:'LFC (alçada)',             unitat:'m',         stops:STOPS_ALTURA_CL},
    lifted_index:   {titol:'Lifted Index',             unitat:'°C',        stops:STOPS_LI},
    el_m:           {titol:'Equilibrium Level',        unitat:'m',         stops:STOPS_ALTURA_CL},
    scp:            {titol:'SCP (càlcul local)',       unitat:'Index',    stops:STOPS_SCP},
    scp_wcs:        {titol:'SCP (Météo-France)',       unitat:'Index',    stops:STOPS_SCP},
    stp:            {titol:'STP (Météo-France)',       unitat:'Index',     stops:STOPS_STP},
    hail_cm:        {titol:'Calamarsa (mida aprox.)',  unitat:'cm',        stops:STOPS_HAIL},
    ehi:            {titol:'EHI (SRH×CAPE)',           unitat:'m²/s²',     stops:STOPS_EHI},

    // ─── SHEAR + SRH ────────────────────────────────────────────────
    srh_01:         {titol:'SRH 0-1km',                unitat:'m²/s²',    stops:STOPS_SRH},
    srh_03:         {titol:'SRH 0-3km',                unitat:'m²/s²',    stops:STOPS_SRH},
    shear_03:       {titol:'Shear 0-3km',              unitat:'m/s',      stops:STOPS_SHEAR},
    shear_06:       {titol:'Shear 0-6km',              unitat:'m/s',      stops:STOPS_SHEAR},

    // ─── NÚVOLS (WCS 3D) ────────────────────────────────────────────
    ciwc_500:       {titol:'Gel núvols 500hPa',        unitat:'g/kg',     stops:STOPS_GEL},
    cld_rain_850:   {titol:'Pluja núvols 850hPa',      unitat:'g/kg',     stops:STOPS_PLUJA},
    tpw_700:        {titol:'Aigua precip   @700hPa',    unitat:'kg/m²',   stops:STOPS_TPW},
    tpw_850:        {titol:'Aigua precip. @850hPa',    unitat:'mm',   stops:STOPS_TPW},
    thetav_850:     {titol:'Theta virtual 850hPa',     unitat:'°C',        stops:STOPS_THETAV},

    // ─── ALTRES ─────────────────────────────────────────────────────
    geopotencial_500:{titol:'Geopotencial 500hPa',     unitat:'dam',      stops:STOPS_GEO500},
    temperatura_500:{titol:'Temperatura 500hPa',       unitat:'°C',       stops:STOPS_T500},
    altitud:        {titol:'Altitud',                  unitat:'m',        stops:STOPS_ALTURA_CL},
      'SNOW_DEPTH__GROUND_OR_WATER_SURFACE': {
        titol: 'Gruix de neu', unitat: 'm', stops: STOPS_NEU
    },
    'WATER_EQUIVALENT_ACCUMULATED_SNOW__GROUND_OR_WATER_SURFACE': {
        titol: 'Equivalent aigua neu', unitat: 'm', stops: STOPS_NEU
    },
    'PRECIPITATION_TYPE_60_MIN__GROUND_OR_WATER_SURFACE': {
        titol: 'Tipus precip. 60min', unitat: 'categ.', stops: STOPS_PRECIP_TYPE
    },
    'SEVERE_PRECIPITATION_TYPE_60_MIN__GROUND_OR_WATER_SURFACE': {
        titol: 'Tipus precip. severa 60min', unitat: 'categ.', stops: STOPS_PRECIP_TYPE
    },
    'REFLECTIVITY_MAX__GROUND_OR_WATER_SURFACE': {
        titol: 'Reflectivitat màxima', unitat: 'dBZ', stops: STOPS_REFLECTIVITAT
    },
    'VISIBILITY_MINI_60MIN__GROUND_OR_WATER_SURFACE': {
        titol: 'Visibilitat 60min', unitat: 'm', stops: STOPS_VISIBILITAT
    },
    'VISIBILITY_MINI_PRECIP_60MIN__GROUND_OR_WATER_SURFACE': {
        titol: 'Visibilitat sota precip. 60min', unitat: 'm', stops: STOPS_VISIBILITAT
    },
    'PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE': {
        titol: 'Aigua precipitable (WCS)', unitat: 'kg/m²', stops: STOPS_TPW_WCS
    },
    'TEMPERATURE__GROUND_OR_WATER_SURFACE': {
        titol: 'Temperatura superfície model', unitat: '°C', stops: STOPS_TEMP_SFC_MODEL
    },
    'TOTAL_CLOUD_COVER__GROUND_OR_WATER_SURFACE': {
        titol: 'Nuvolositat total', unitat: '%', stops: STOPS_TOTAL_CLOUD
    },
    'MEAN_LAYER_CAPE__GROUND_OR_WATER_SURFACE': {
        titol: 'CAPE mitjana', unitat: 'J/kg', stops: STOPS_CAPE_MITJANA
    },
    'DIAG_GRELE__GROUND_OR_WATER_SURFACE': {
        titol: 'Calamarsa (WCS)', unitat: 'Index', stops: STOPS_HAIL  // Reutilitzem la paleta d'hail_cm
    },
    'PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE': {
        titol: 'Tipus precip. 15min', unitat: 'categ.', stops: STOPS_PRECIP_TYPE
    },
    'SEVERE_PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE': {
        titol: 'Tipus precip. severa 15min', unitat: 'categ.', stops: STOPS_PRECIP_TYPE
    },
    'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE': {
        titol: 'Intensitat precip.', unitat: 'mm/h', stops: STOPS_PRECIP_RATE
    },
    'VISIBILITY_MINI_15MIN__GROUND_OR_WATER_SURFACE': {
        titol: 'Visibilitat 15min', unitat: 'm', stops: STOPS_VISIBILITAT
    },
    'VISIBILITY_MINI_PRECIP_15MIN__GROUND_OR_WATER_SURFACE': {
        titol: 'Visibilitat sota precip. 15min', unitat: 'm', stops: STOPS_VISIBILITAT
    },

'CIWC_MITJANA': {
    titol: 'Gel núvols (mitjana)',
    unitat: 'g/m²',  // ← CANVIAT DE g/kg A g/m²
    stops: STOPS_CIWC_MITJANA
},
'CLD_RAIN_MITJANA': {
    titol: 'Pluja núvols (mitjana)',
    unitat: 'g/m²',  // ← Manté
    stops: STOPS_CLD_RAIN_MITJANA
},
'TPW_MITJANA': {
    titol: 'Aigua precipitable (mitjana)',
    unitat: 'mm',  // o 'kg/m²'
    stops: STOPS_TPW_MITJANA
},

    // ─── WCS 3D (PV SURFACES) ────────────────────────────────────────
    'GEOPOTENTIAL_PV1500': {
        titol: 'Geopotencial PV=1.5', unitat: 'dam', stops: STOPS_GEO_PV
    },
    'GEOPOTENTIAL_PV2000': {
        titol: 'Geopotencial PV=2.0', unitat: 'dam', stops: STOPS_GEO_PV
    },
    'THETA_PV1500': {
        titol: 'Theta PV=1.5', unitat: '°C', stops: STOPS_THETA_PV
    },
    'THETA_PV2000': {
        titol: 'Theta PV=2.0', unitat: '°C', stops: STOPS_THETA_PV
    },
    'U_PV1500': {
        titol: 'Vent U PV=1.5', unitat: 'm/s', stops: STOPS_VENT_PV
    },
    'U_PV2000': {
        titol: 'Vent U PV=2.0', unitat: 'm/s', stops: STOPS_VENT_PV
    },
    'V_PV1500': {
        titol: 'Vent V PV=1.5', unitat: 'm/s', stops: STOPS_VENT_PV
    },
    'V_PV2000': {
        titol: 'Vent V PV=2.0', unitat: 'm/s', stops: STOPS_VENT_PV
    },
    'WIND_PV1500': {
        titol: 'Vent total PV=1.5', unitat: 'm/s', stops: STOPS_WIND_PV
    },
    'WIND_PV2000': {
        titol: 'Vent total PV=2.0', unitat: 'm/s', stops: STOPS_WIND_PV
    },
    'ALTITUDE_ISOTERMA_0C': {
        titol: 'Altitud isoterma 0°C', unitat: 'm', stops: STOPS_ISOTERMA
    },
    'ALTITUDE_ISOTERMA_M10C': {
        titol: 'Altitud isoterma -10°C', unitat: 'm', stops: STOPS_ISOTERMA
    },
};

function escalarVariablesMitjana(variables) {
    // CIWC_MITJANA: g/kg → g/m² (multiplicar per ~0.1)
if (variables['CIWC_MITJANA']?.datos) {
    const vals = variables['CIWC_MITJANA'].datos;
    const escalats = new Float32Array(vals.length);
    for (let i = 0; i < vals.length; i++) {
        escalats[i] = vals[i] * 1000;
    }
    variables['CIWC_MITJANA'].datos = escalats;
}
    
    // CLD_RAIN_MITJANA: g/kg → g/m²
    if (variables['CLD_RAIN_MITJANA']?.datos) {
        const vals = variables['CLD_RAIN_MITJANA'].datos;
        const escalats = new Float32Array(vals.length);
        for (let i = 0; i < vals.length; i++) {
            escalats[i] = vals[i] * 100;
        }
        variables['CLD_RAIN_MITJANA'].datos = escalats;
    }
    
// TPW_MITJANA: kg/m² → mm (1:1, no cal escalar)
// Però si ve en g/kg, multiplicar per 0.1
if (variables['TPW_MITJANA']?.datos) {
    const vals = variables['TPW_MITJANA'].datos;
    const escalats = new Float32Array(vals.length);
    for (let i = 0; i < vals.length; i++) {
        // Si ve en g/kg → mm (÷1000 perquè 1 mm = 1 kg/m² = 1000 g/m²)
        // Però com que les dades ja estan en kg/m², no cal canviar
        escalats[i] = vals[i];  // 1 kg/m² = 1 mm
    }
    variables['TPW_MITJANA'].datos = escalats;
}
    
    return variables;
}

// GRUP PRINCIPAL (apareix primer, sense títol, destacat) — TOTES LLIURES SENSE LOGIN
// ═══════════════════════════════════════════════════════════════════════
//  PALETES — ASGURAR QUE wind_speed_10m EXISTEIX
// ═══════════════════════════════════════════════════════════════════════

// Si no existeix, afegir-la
if (!PALETES['wind_speed_10m']) {
    PALETES['wind_speed_10m'] = {
        titol: 'Vent 10m',
        unitat: 'km/h',
        stops: STOPS_RATXA
    };
}

// GRUP PRINCIPAL (apareix primer, sense títol, destacat)
// AFEGIR 'wind_speed_10m' al final del grup
const GRUP_PRINCIPAL = ['st', 'sd', 'srh', 'temp_min2m', 'temp_max2m', 'wind_speed_10m', 'wind_gust'];
const GRUPS_SIMPLES = {
    // ═══════════════════════════════════════════════════════════════════
    // 1. TEMPERATURA I HUMITAT (Superfície)
    // ═══════════════════════════════════════════════════════════════════
    'Temperatura i Humitat': [
        'st',              // Temperatura 2m
        'sd',              // Punt rosada 2m
        'temp_min2m',      // Temp. mín. 2m
        'temp_max2m',      // Temp. màx. 2m
        'wind_speed_10m',  // Vent 10m
        'wind_gust',       // Ratxa 10m
        'TEMPERATURE__GROUND_OR_WATER_SURFACE', // Temp. superfície model
        
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 2. PRESSIÓ
    // ═══════════════════════════════════════════════════════════════════
    'Pressió': [
        'pressure_msl',    // Pressió MSL
        'sp',              // Pressió superfície
        'PRESSURE__GROUND_OR_WATER_SURFACE',
        'PRESSURE__MEAN_SEA_LEVEL',
    ],

'Precipitació': [
    'tp',              // Precip. total acum.
    'tsnowp',          // Neu acum.
    'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE', // Intensitat precip.
    'CONVECTIVE_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE', // Precip. convectiva
    'PRECIPITATION_TYPE_60_MIN__GROUND_OR_WATER_SURFACE', // Tipus precip. 60min
    'SEVERE_PRECIPITATION_TYPE_60_MIN__GROUND_OR_WATER_SURFACE', // ← Tipus precip. severa
    'PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE', // Tipus precip. 15min
    'SEVERE_PRECIPITATION_TYPE_15_MIN__GROUND_OR_WATER_SURFACE', // ← Tipus precip. severa 15min
    'TPW_MITJANA',     
    'PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE', 
    'tpw_700',         
    'tpw_850',  
],

    // ═══════════════════════════════════════════════════════════════════
    // 4. INESTABILITAT I CONVECCIÓ
    // ═══════════════════════════════════════════════════════════════════
    'Inestabilitat i Convecció': [
        'cape',            // CAPE
        'cin',             // CIN
        'MEAN_LAYER_CAPE__GROUND_OR_WATER_SURFACE', // CAPE mitjana
        'lifted_index',    // Lifted Index
        'lcl_m',           // LCL alçada
        'lfc_m',           // LFC alçada
        'el_m',            // Equilibrium Level
        'THETAV_850',      // Theta virtual 850hPa
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 5. TORNADOS I SUPERCÈL·LULES
    // ═══════════════════════════════════════════════════════════════════
    'Tornados i Supercèl·lules': [
        'scp',             // SCP (càlcul local)
        'scp_wcs',         // SCP (Météo-France)
        'stp',             // STP
        'ehi',             // EHI
        'hail_cm',         // Calamarsa mida
        'DIAG_GRELE__GROUND_OR_WATER_SURFACE', // Calamarsa WCS
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 6. SHEAR I SRH
    // ═══════════════════════════════════════════════════════════════════
    'Shear i SRH': [
        'shear_03',        // Shear 0-3km
        'shear_06',        // Shear 0-6km
        'srh_01',          // SRH 0-1km
        'srh_03',          // SRH 0-3km
                'srh',             // Humitat 2m
        'sh2', 
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 7. NÚVOLS (Superfície + WCS 3D)
    // ═══════════════════════════════════════════════════════════════════
    'Núvols': [
        'low_cloud_cover',   // Núvols baixos
        'medium_cloud_cover', // Núvols mitjans
        'high_cloud_cover',  // Núvols alts
        'TOTAL_CLOUD_COVER__GROUND_OR_WATER_SURFACE', // Nuvolositat total
        'CIWC_MITJANA',      // Gel núvols (mitjana)
        'CLD_RAIN_MITJANA',  // Pluja núvols (mitjana)
        'ciwc_500',          // Gel núvols 500hPa
        'cld_rain_850',      // Pluja núvols 850hPa
    ],


    // ═══════════════════════════════════════════════════════════════════
    // 9. NEU I VISIBILITAT
    // ═══════════════════════════════════════════════════════════════════
    'Neu i Visibilitat': [
        'SNOW_DEPTH__GROUND_OR_WATER_SURFACE',  // Gruix de neu
        'WATER_EQUIVALENT_ACCUMULATED_SNOW__GROUND_OR_WATER_SURFACE', // Equivalent aigua neu
        'VISIBILITY_MINI_60MIN__GROUND_OR_WATER_SURFACE',  // Visibilitat 60min
        'VISIBILITY_MINI_PRECIP_60MIN__GROUND_OR_WATER_SURFACE',
        'VISIBILITY_MINI_15MIN__GROUND_OR_WATER_SURFACE',
        'VISIBILITY_MINI_PRECIP_15MIN__GROUND_OR_WATER_SURFACE',
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 10. SATÈL·LIT
    // ═══════════════════════════════════════════════════════════════════
    'Satèl·lit': [
        'bt108',           // BT 10.8µm
        'bt62',            // BT 6.2µm vapor
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 11. REFLECTIVITAT (Radar)
    // ═══════════════════════════════════════════════════════════════════
    'Reflectivitat': [
        'radar_dbz',            // Radar simulat
        'REFLECTIVITY_MAX__GROUND_OR_WATER_SURFACE', // Reflectivitat
        'REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE', // Reflectivitat dBZ
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 12. GEOMETRIA I ALTITUD
    // ═══════════════════════════════════════════════════════════════════
    'Geometria i Altitud': [
        'altitud',           // Altitud
        'GEOMETRIC_HEIGHT__GROUND_OR_WATER_SURFACE', // Altitud geomètrica
        'spbl',              // Alçada capa límit
        'PLANETARY_BOUNDARY_LAYER_HEIGHT__GROUND_OR_WATER_SURFACE',
        'ALTITUDE_ISOTERMA_0C',   // Altitud isoterma 0°C
        'ALTITUDE_ISOTERMA_M10C', // Altitud isoterma -10°C
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 13. VELOCITAT VERTICAL (w)
    // ═══════════════════════════════════════════════════════════════════
    'Velocitat vertical': [
        'w_925',           // Vel. vertical @ 925hPa
        'w_850',           // Vel. vertical @ 850hPa
        'w_700',           // Vel. vertical @ 700hPa
        'w_500',           // Vel. vertical @ 500hPa
        'w_300',           // Vel. vertical @ 300hPa
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 14. PV SUPERFÍCIES (Vorticitat potencial)
    // ═══════════════════════════════════════════════════════════════════
    'PV Superfícies': [
        'pv_925',           // Vorticitat potencial @ 925hPa
        'pv_850',           // Vorticitat potencial @ 850hPa
        'pv_700',           // Vorticitat potencial @ 700hPa
        'pv_500',           // Vorticitat potencial @ 500hPa
        'pv_300',           // Vorticitat potencial @ 300hPa
        'pv_200',           // Vorticitat potencial @ 200hPa
        'GEOPOTENTIAL_PV1500',  // Geopotencial PV=1.5
        'GEOPOTENTIAL_PV2000',  // Geopotencial PV=2.0
        'THETA_PV1500',         // Theta PV=1.5
        'THETA_PV2000',         // Theta PV=2.0
        'U_PV1500',             // Vent U PV=1.5
        'U_PV2000',             // Vent U PV=2.0
        'V_PV1500',             // Vent V PV=1.5
        'V_PV2000',             // Vent V PV=2.0
        'WIND_PV1500',          // Vent total PV=1.5
        'WIND_PV2000',          // Vent total PV=2.0
    ],

    // ═══════════════════════════════════════════════════════════════════
    // 15. VENT EN NIVELLS (3D) - TOTS ELS NIVELLS
    // ═══════════════════════════════════════════════════════════════════
    'Vent en nivells (3D)': [
        'wind_speed_1000',
        'wind_speed_950',
        'wind_speed_925',
        'wind_speed_900',
        'wind_speed_875',
        'wind_speed_850',
        'wind_speed_800',
        'wind_speed_750',
        'wind_speed_700',
        'wind_speed_650',
        'wind_speed_600',
        'wind_speed_550',
        'wind_speed_500',
        'wind_speed_450',
        'wind_speed_400',
        'wind_speed_350',
        'wind_speed_300',
        'wind_speed_250',
        'wind_speed_200',
        'wind_speed_150',
        'wind_speed_100',
    ],
};


const GRUPS_ACORDIO = {
    'Temperatura':      ['t'],
    'Punt rosada':      ['dpt'],
    'Humitat':          ['r'],
    'Vent (nivells)':   ['wind_speed'],
    'Vel. vertical':    ['w'],
    'Vort. potencial':  ['pv'],
};

const CLAUS_3D = new Set(['t','u','v','r','w','dpt','pv','wind_speed']);

const VARIABLES_AMAGADES = new Set([
    'su', 'sv', 'u', 'v', 'sh2', 'geo_h', 'shear_06_eff',
    'srh_06_eff', 'sp', 'lightning', 'reflectivity_dbz', 'rain','precip_water', 'group', 'tgrp' ,'scp', 'bt62',
    
    // 🔧 NÚVOLS WCS (amagar)
    'LOW_CLOUD_COVER__GROUND_OR_WATER_SURFACE',
    'MEDIUM_CLOUD_COVER__GROUND_OR_WATER_SURFACE',
    'HIGH_CLOUD_COVER__GROUND_OR_WATER_SURFACE',
    'TOTAL_CLOUD_COVER__GROUND_OR_WATER_SURFACE',
    
    // 🔧 CAPE i CIN WCS (amagar)
    'CONVECTIVE_AVAILABLE_POTENTIAL_ENERGY__GROUND_OR_WATER_SURFACE',
    'CONVECTIVE_INHIBITION__GROUND_OR_WATER_SURFACE',
    'CIN__GROUND',
    
    // 🔧 Altres WCS duplicats
    'MEAN_LAYER_CAPE__GROUND_OR_WATER_SURFACE',
    'PLANETARY_BOUNDARY_LAYER_HEIGHT__GROUND_OR_WATER_SURFACE',
    'PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE',
    'TEMPERATURE__GROUND_OR_WATER_SURFACE',
    'PRESSURE__GROUND_OR_WATER_SURFACE',
    'PRESSURE__MEAN_SEA_LEVEL',
    'GEOMETRIC_HEIGHT__GROUND_OR_WATER_SURFACE',
]);

function esVariableAmagada(clau) {
    if (VARIABLES_AMAGADES.has(clau)) return true;
    const m = clau.match(/^(.+)_(-?\d+)$/);
    if (m && VARIABLES_AMAGADES.has(m[1])) return true;
    return false;
}

function esVariable3D(clau) { return CLAUS_3D.has(clauBase(clau)); }

function getCoordenadesPer(data, clau) {
    if (esVariable3D(clau) && data.coordenadas_3d) return data.coordenadas_3d;
    return data.coordenadas;
}

let variableActiva = 'st';
window._currentParameter = 'st';

function clauBase(c) {
    // 1. Coincidència directa a PALETES
    if (PALETES[c]) return c;
    // 2. És una clau crua del WCS? Traduir-la a la curta normalitzada
    if (ALIES_CLAUS[c] && PALETES[ALIES_CLAUS[c]]) return ALIES_CLAUS[c];
    // 3. Sufix numèric de nivell (p. ex. t_850)
    const m = c.match(/^(.+)_(-?\d+)$/);
    return (m && PALETES[m[1]]) ? m[1] : 'st';
}

function getPaleta(c) { return PALETES[clauBase(c)] || PALETES.st; }

function getColor(pal, v) {
    const s = pal.stops;
    if (v === null || v === undefined || isNaN(v)) return {r:0,g:0,b:0,a:0};
    if (v <= s[0].v) return {r:s[0].r,g:s[0].g,b:s[0].b,a:s[0].a??220};
    if (v >= s[s.length-1].v) return {r:s[s.length-1].r,g:s[s.length-1].g,b:s[s.length-1].b,a:s[s.length-1].a??220};
    for (let i=0; i<s.length-1; i++) {
        if (v>=s[i].v && v<=s[i+1].v) {
            const t=(v-s[i].v)/(s[i+1].v-s[i].v);
            const lr=(a,b)=>Math.round(a+(b-a)*t);
            return {r:lr(s[i].r,s[i+1].r),g:lr(s[i].g,s[i+1].g),b:lr(s[i].b,s[i+1].b),a:lr(s[i].a??220,s[i+1].a??220)};
        }
    }
    return {r:0,g:0,b:0,a:0};
}

// ═══════════════════════════════════════════════════════════════════════
//  CALCULAR VENT
// ═══════════════════════════════════════════════════════════════════════

function calcularVelocitatVent(variables) {
    if (variables['su'] && variables['sv']) {
        const u = variables['su'].datos;
        const v = variables['sv'].datos;
        if (u.length === v.length) {
            const dades = u.map((valU, i) => {
                if (valU === null || v[i] === null || isNaN(valU) || isNaN(v[i])) return null;
                return Math.round(Math.sqrt(valU * valU + v[i] * v[i]) * 3.6 * 10) / 10;
            });
            variables['wind_speed_10m'] = {
                nombre: 'Vent 10m',
                unidades: 'km/h',
                datos: dades
            };
        }
    }

    const nivellsPressio = new Set();
    Object.keys(variables).forEach(clau => {
        const m = clau.match(/^[uv]_(\d+)$/);
        if (m) nivellsPressio.add(parseInt(m[1]));
    });

    nivellsPressio.forEach(nivell => {
        const clauU = `u_${nivell}`;
        const clauV = `v_${nivell}`;
        if (variables[clauU] && variables[clauV]) {
            const u = variables[clauU].datos;
            const v = variables[clauV].datos;
            if (u.length === v.length) {
                const dades = u.map((valU, i) => {
                    if (valU === null || v[i] === null || isNaN(valU) || isNaN(v[i])) return null;
                    return Math.round(Math.sqrt(valU * valU + v[i] * v[i]) * 3.6 * 10) / 10;
                });
                variables[`wind_speed_${nivell}`] = {
                    nombre: `Vent @ ${nivell}hPa`,
                    unidades: 'km/h',
                    datos: dades
                };
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════
//  OBTENIR DADES DE VENT PER STREAMLINES
// ═══════════════════════════════════════════════════════════════════════

function obtenirVentPerStreamlines(data, clau) {
    const coords = getCoordenadesPer(data, clau);
    const lats = coords.lat;
    const lons = coords.lon;
    const Nlat = lats.length;
    const Nlon = lons.length;

    let clauU, clauV;
    const base = clauBase(clau);

    const varsSuperficie = [
        'st','sd','srh','sp','pressure_msl','cape','cin','spbl',
        'rain','rain_1h','snow','graupel','tp','tgrp','tsnowp',
        'precip_water','low_cloud_cover','medium_cloud_cover',
        'high_cloud_cover','reflectivity_dbz','lightning',
        'wind_speed_10m','wind_gust',
        'lcl_m','lfc_m','lifted_index','el_m',
        'temp_min2m','temp_max2m','scp','scp_wcs','stp','hail_cm',
        'ehi','bt108','bt62','ciwc_500','cld_rain_850','tpw_700','tpw_850',
        'thetav_850','altitud'
    ];

    if (varsSuperficie.includes(base) || varsSuperficie.includes(clau)) {
        clauU = 'su';
        clauV = 'sv';
    } else if (base === 'wind_speed') {
        const m = clau.match(/_(\d+)$/);
        if (m) {
            clauU = `u_${m[1]}`;
            clauV = `v_${m[1]}`;
        }
    } else {
        const m = clau.match(/_(\d+)$/);
        if (m) {
            clauU = `u_${m[1]}`;
            clauV = `v_${m[1]}`;
        } else {
            clauU = 'su';
            clauV = 'sv';
        }
    }

    const varU = data.variables[clauU];
    const varV = data.variables[clauV];
    if (!varU || !varV) return null;
    if (varU.datos.length !== Nlat * Nlon || varV.datos.length !== Nlat * Nlon) return null;

    const speed = new Float32Array(Nlat * Nlon);
    const dir = new Float32Array(Nlat * Nlon);

    for (let i = 0; i < Nlat; i++) {
        const filaReal = (Nlat - 1 - i);
        for (let j = 0; j < Nlon; j++) {
            const idx = filaReal * Nlon + j;
            const uVal = varU.datos[idx];
            const vVal = varV.datos[idx];
            if (uVal === null || vVal === null || isNaN(uVal) || isNaN(vVal)) {
                speed[i * Nlon + j] = 0;
                dir[i * Nlon + j] = 0;
            } else {
                const spd = Math.sqrt(uVal * uVal + vVal * vVal) * 3.6;
                let angle = Math.atan2(vVal, uVal) * 180 / Math.PI;
                angle = (270 - angle) % 360;
                if (angle < 0) angle += 360;
                speed[i * Nlon + j] = spd;
                dir[i * Nlon + j] = angle;
            }
        }
    }

    return {
        lats, lons, Nlat, Nlon,
        speed, dir,
        extent: [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
    };
}

// ═══════════════════════════════════════════════════════════════════════
//  STREAMLINES
// ═══════════════════════════════════════════════════════════════════════

let canvasVent = null;
let ctxVent = null;

function _hauriaDeDibuixarVent() {
    if (!window.ventEnabled) return false;
    const base = clauBase(variableActiva);
    for (const v of VARS_SENSE_VENT) {
        if (base === v) return false;
        if (variableActiva.startsWith(v + '_')) return false;
    }
    const item = totesLesHores[curIdx];
    if (!item || !item.data || !item.data.variables) return false; // 🔧 protecció null
    const data = item.data;
    return !!(data.variables['su'] || data.variables['u']);
}

function _dibuixarStreamlines() {
    if (!canvasVent) return;
    const ctx = ctxVent;
    const w = canvasVent.width;
    const h = canvasVent.height;
    ctx.clearRect(0, 0, w, h);

    if (!_hauriaDeDibuixarVent()) return;
    if (window.ventMode !== 'streamlines') return;

    const item = totesLesHores[curIdx];
    if (!item || !item.data) return; // 🔧 protecció null
    const data = item.data;
    const ventData = obtenirVentPerStreamlines(data, variableActiva);
    if (!ventData) return;

    const { lats, lons, Nlat, Nlon, speed, dir, extent } = ventData;

    function sampleUV(px, py) {
        if (px < 0 || px > w || py < 0 || py > h) return null;
        const latlng = map.containerPointToLatLng([px, py]);
        const fx = ((latlng.lng - extent[0]) / (extent[1] - extent[0])) * (Nlon - 1);
        const fy = ((extent[3] - latlng.lat) / (extent[3] - extent[2])) * (Nlat - 1);
        if (fx < 0 || fx >= Nlon - 1 || fy < 0 || fy >= Nlat - 1) return null;

        const x0 = fx | 0, y0 = fy | 0;
        const tx = fx - x0, ty = fy - y0;
        const x1 = Math.min(x0 + 1, Nlon - 1);
        const y1 = Math.min(y0 + 1, Nlat - 1);

        const at = (xi, yi) => {
            const idx = yi * Nlon + xi;
            const spd = speed[idx];
            const rad = (270 - dir[idx]) * 0.01745329252;
            return { u: spd * Math.cos(rad), v: spd * Math.sin(rad) };
        };

        const a = at(x0, y0), b = at(x1, y0), c = at(x0, y1), d = at(x1, y1);
        return {
            u: (1 - ty) * ((1 - tx) * a.u + tx * b.u) + ty * ((1 - tx) * c.u + tx * d.u),
            v: (1 - ty) * ((1 - tx) * a.v + tx * b.v) + ty * ((1 - tx) * c.v + tx * d.v),
        };
    }

    const STEP = 28, STEP_LEN = 2.5, MAX_STEPS = 45, GRID = 8;

    const gw = Math.floor(w / GRID) + 1;
    const gh = Math.floor(h / GRID) + 1;
    const visited = new Uint8Array(gw * gh);

    const strokeColor = wCfg.streamlineColor === 'white'
        ? `rgba(255, 255, 255, ${wCfg.streamlineOpacity})`
        : `rgba(0, 0, 0, ${wCfg.streamlineOpacity})`;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = wCfg.streamlineWidth;
    ctx.strokeStyle = strokeColor;
    ctx.shadowBlur = 0;

    for (let py = 0; py < h; py += STEP) {
        for (let px = 0; px < w; px += STEP) {
            let sx = px + (Math.random() - 0.5) * STEP * 0.6;
            let sy = py + (Math.random() - 0.5) * STEP * 0.6;

            const gx0 = Math.floor(sx / GRID), gy0 = Math.floor(sy / GRID);
            if (gy0 < 0 || gy0 >= gh || gx0 < 0 || gx0 >= gw) continue;
            if (visited[gy0 * gw + gx0]) continue;

            const fwd = [], back = [];
            let cx = sx, cy = sy;

            for (let s = 0; s < MAX_STEPS; s++) {
                const uv = sampleUV(cx, cy);
                if (!uv) break;
                const mag = Math.hypot(uv.u, uv.v);
                if (mag < 0.2) break;
                cx += (uv.u / mag) * STEP_LEN;
                cy -= (uv.v / mag) * STEP_LEN;
                const gx = Math.floor(cx / GRID), gy = Math.floor(cy / GRID);
                if (gy < 0 || gy >= gh || gx < 0 || gx >= gw) break;
                if (visited[gy * gw + gx]) break;
                fwd.push([cx, cy]);
            }

            cx = sx; cy = sy;
            for (let s = 0; s < MAX_STEPS; s++) {
                const uv = sampleUV(cx, cy);
                if (!uv) break;
                const mag = Math.hypot(uv.u, uv.v);
                if (mag < 0.2) break;
                cx -= (uv.u / mag) * STEP_LEN;
                cy += (uv.v / mag) * STEP_LEN;
                const gx = Math.floor(cx / GRID), gy = Math.floor(cy / GRID);
                if (gy < 0 || gy >= gh || gx < 0 || gx >= gw) break;
                if (visited[gy * gw + gx]) break;
                back.push([cx, cy]);
            }

            const line = [...back.reverse(), [sx, sy], ...fwd];
            if (line.length <= 12) continue;

            for (let i = 0; i < line.length; i += 3) {
                const gx = Math.floor(line[i][0] / GRID), gy = Math.floor(line[i][1] / GRID);
                if (gy >= 0 && gy < gh && gx >= 0 && gx < gw) visited[gy * gw + gx] = 1;
            }

            ctx.beginPath();
            ctx.moveTo(line[0][0], line[0][1]);
            for (let i = 1; i < line.length - 1; i++) {
                const mx = (line[i][0] + line[i + 1][0]) / 2;
                const my = (line[i][1] + line[i + 1][1]) / 2;
                ctx.quadraticCurveTo(line[i][0], line[i][1], mx, my);
            }
            ctx.stroke();

            if (line.length > 25) {
                const step = Math.floor(line.length / 4);
                for (let i = step; i < line.length - 3; i += step) {
                    const p0 = line[i], p1 = line[i + 2];
                    if (p0 && p1) {
                        const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
                        ctx.beginPath();
                        ctx.moveTo(p0[0], p0[1]);
                        ctx.lineTo(p0[0] - 4 * Math.cos(a - 0.6), p0[1] - 4 * Math.sin(a - 0.6));
                        ctx.moveTo(p0[0], p0[1]);
                        ctx.lineTo(p0[0] - 4 * Math.cos(a + 0.6), p0[1] - 4 * Math.sin(a + 0.6));
                        ctx.stroke();
                    }
                }
            }
        }
    }
    ctx.restore();
}

function inicialitzarCanvasVent() {
    if (canvasVent) return;
    canvasVent = document.createElement('canvas');
    canvasVent.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    map.getPane('paneVent').appendChild(canvasVent);
    ctxVent = canvasVent.getContext('2d');
    
    // ⬅️ Només redibuixar al FINAL del moviment, no durant
    map.on('moveend', _redibuixarCanvasVent);
    map.on('zoomend', _redibuixarCanvasVent);
    // ELIMINAR: map.on('moveend zoomend', _redibuixarCanvasVent);
    // ELIMINAR: map.on('move', ...);  // no existeix, però per si de cas
    
    _redibuixarCanvasVent();
}

function _redibuixarCanvasVent() {
    if (!canvasVent) return;
    const size = map.getSize();
    canvasVent.width = size.x;
    canvasVent.height = size.y;
    L.DomUtil.setPosition(canvasVent, map.containerPointToLayerPoint([0, 0]));
    _dibuixarStreamlines();
}

function redibuixarVent() {
    _redibuixarCanvasVent();
}

// ─── Controls de vent ──────────────────────────────────────────────
window.toggleVent = function() {
    window.ventEnabled = !window.ventEnabled;
    const btn = document.getElementById('btnVent');
    if (btn) {
        btn.textContent = window.ventEnabled ? ' Vent ON' : ' Vent OFF';
        btn.style.background = window.ventEnabled ? '#2a5a8a' : '#141c2a';
    }
    if (!window.ventEnabled && canvasVent) {
        ctxVent.clearRect(0, 0, canvasVent.width, canvasVent.height);
    }
    if (window.ventEnabled) _redibuixarCanvasVent();
    return window.ventEnabled;
};

window.toggleVentMode = function() {
    window.ventMode = window.ventMode === 'streamlines' ? 'particles' : 'streamlines';
    if (window.ventMode !== 'streamlines' && canvasVent) {
        ctxVent.clearRect(0, 0, canvasVent.width, canvasVent.height);
    }
    _redibuixarCanvasVent();
    return window.ventMode;
};

window.setStreamlineColor = function(color) {
    wCfg.streamlineColor = color;
    _redibuixarCanvasVent();
};

window.setStreamlineWidth = function(v) {
    wCfg.streamlineWidth = Math.min(3, Math.max(0.5, v));
    _redibuixarCanvasVent();
};

window.setStreamlineOpacity = function(v) {
    wCfg.streamlineOpacity = Math.min(1, Math.max(0.1, v));
    _redibuixarCanvasVent();
};

// ═══════════════════════════════════════════════════════════════════════
//  CANVAS LAYER (dades)
// ═══════════════════════════════════════════════════════════════════════

const CanvasLayer = L.Layer.extend({
    initialize: function() {
        this._canvas = null;
        this._data = null;
        this._offscreen = null;
        this._needsRedraw = true;
    },

    onAdd: function(map) {
        this._map = map;
        const c = document.createElement('canvas');
        c.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
        map.getPane('paneDades').appendChild(c);
        this._canvas = c;
        map.on('moveend zoomend', this._render, this);
        this._render();
    },

    onRemove: function(map) {
        map.getPane('paneDades').removeChild(this._canvas);
        map.off('moveend zoomend', this._render, this);
    },

    setData: function(data) {
        this._data = data;
        this._needsRedraw = true;
        this._render();
    },

    _drawOffscreen: function() {
        if (!this._data) return;
        const coords = getCoordenadesPer(this._data, variableActiva);
        const lats = coords.lat;
        const lons = coords.lon;
        const Nlat = lats.length;
        const Nlon = lons.length;

        // 🔧 Llegim les dades fent servir la clau REAL del JSON
        // (variableActiva pot ser una clau curta normalitzada, p. ex. 'ehi',
        //  però al JSON pot estar guardada com 'DIAG_EHI__GROUND')
        const clauLectura = clauRealPerLlegir(variableActiva);
        const varInfo = this._data.variables[clauLectura] || this._data.variables[variableActiva];
        if (!varInfo || !varInfo.datos) {
            if (this._offscreen) {
                const ctx = this._offscreen.getContext('2d');
                ctx.clearRect(0, 0, this._offscreen.width, this._offscreen.height);
            }
            this._needsRedraw = false;
            return;
        }

        const dades = varInfo.datos;
        if (dades.length !== Nlat * Nlon) {
            if (this._offscreen) {
                const ctx = this._offscreen.getContext('2d');
                ctx.clearRect(0, 0, this._offscreen.width, this._offscreen.height);
            }
            this._needsRedraw = false;
            return;
        }

        const pal = getPaleta(variableActiva);
        if (!this._offscreen || this._offscreen.width !== Nlon || this._offscreen.height !== Nlat) {
            this._offscreen = document.createElement('canvas');
            this._offscreen.width = Nlon;
            this._offscreen.height = Nlat;
        }

        const ctx = this._offscreen.getContext('2d');
        const imgData = ctx.createImageData(Nlon, Nlat);
        const d = imgData.data;

        const CLAUS_TEMP = ['st', 'sd', 't', 'dpt', 'temp_min2m', 'temp_max2m'];
        const base = clauBase(variableActiva);
        const esTemperatura = CLAUS_TEMP.includes(base);

        for (let i = 0; i < Nlat; i++) {
            const filaReal = (Nlat - 1 - i);
            for (let j = 0; j < Nlon; j++) {
                let v = dades[filaReal * Nlon + j];
                if (esTemperatura && v !== null && !isNaN(v) && v > 100) {
                    v = v - 273.15;
                }
                const ii = (i * Nlon + j) * 4;
                if (v === null || isNaN(v)) {
                    d[ii+3] = 0;
                } else {
                    const c = getColor(pal, v);
                    d[ii] = c.r; d[ii+1] = c.g; d[ii+2] = c.b; d[ii+3] = c.a;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);
        this._needsRedraw = false;
    },

    _render: function() {
        if (!this._data || !this._map) return;
        if (this._needsRedraw) this._drawOffscreen();

        const map = this._map;
        const size = map.getSize();
        const canvas = this._canvas;
        canvas.width = size.x;
        canvas.height = size.y;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0,0]));

        const coords = getCoordenadesPer(this._data, variableActiva);
        const lats = coords.lat;
        const lons = coords.lon;
        const latMax = Math.max(lats[0], lats[lats.length - 1]);
        const latMin = Math.min(lats[0], lats[lats.length - 1]);
        const lonMin = Math.min(lons[0], lons[lons.length - 1]);
        const lonMax = Math.max(lons[0], lons[lons.length - 1]);

        const nw = map.latLngToContainerPoint(L.latLng(latMax, lonMin));
        const se = map.latLngToContainerPoint(L.latLng(latMin, lonMax));
        const x = nw.x, y = nw.y, w = se.x - nw.x, h = se.y - nw.y;

        if (this._offscreen && w > 0 && h > 0) {
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(this._offscreen, x, y, w, h);
            ctx.restore();
        }

        this._drawLegend(ctx, getPaleta(variableActiva));
        actualitzarCapcaleraParametre();
        redibuixarVent();
    },

    _drawLegend: function(ctx, pal) {
        const s = pal.stops;
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const bw = 25, x0 = W - bw - 15, y0 = H - s.length * 3 - 25;
        ctx.fillStyle = 'rgba(10,16,26,0.75)';
        ctx.fillRect(x0-5, y0-18, bw+10, s.length*3+22);
        s.forEach((st,i) => {
            ctx.fillStyle = `rgb(${st.r},${st.g},${st.b})`;
            ctx.fillRect(x0, y0+i*3, bw, 3);
        });
        ctx.fillStyle = '#fff';
        ctx.font = '9px Arial';
        ctx.textAlign = 'right';
        const fmt = v => (Math.abs(v)>=10000||(Math.abs(v)<0.01&&v!==0)) ? v.toExponential(1) : v;
        ctx.fillText(fmt(s[s.length-1].v), x0-3, y0+10);
        ctx.fillText(fmt(s[0].v), x0-3, y0+s.length*3+2);
    }
});

const canvasLayer = new CanvasLayer();
canvasLayer.addTo(map);
window._canvasLayer = canvasLayer;

// ═══════════════════════════════════════════════════════════════════════
//  GEOJSON
// ═══════════════════════════════════════════════════════════════════════

const GEOJSON_CAPES = [
    { id: 'catalunya', nom: 'Catalunya', arxiu: 'girona_comarques.geojson', color: '#000000', gruix: 1.2 },

];

const capaInstancies = {};

function estilCapa(def) {
    return { pane: 'paneGeojson', color: def.color, weight: def.gruix, opacity: 1, fill: false };
}

async function carregarCapaGeojson(def) {
    let retard = RETARD_INICIAL;
    
    for (let intent = 1; intent <= MAX_REINTENTS; intent++) {
        try {
            const r = await fetch(`${DADES_PATH}/${def.arxiu}`);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const geojson = await r.json();
            const capa = L.geoJSON(geojson, { pane: 'paneGeojson', style: () => estilCapa(def) });
            capaInstancies[def.id] = capa;
            capa.addTo(map);
            return;
        } catch (err) {
            if (intent === MAX_REINTENTS) {
                console.warn('[GeoJSON] ' + def.nom + ': fallada definitiva — ' + err.message);
                return;
            }
            console.warn(`[GeoJSON ${def.nom}] Reintent ${intent}/${MAX_REINTENTS} en ${retard}ms...`);
            await esperar(retard);
            retard *= 2;
        }
    }
}

async function inicialitzarGeojson() {
    for (const def of GEOJSON_CAPES) {
        await carregarCapaGeojson(def);
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  CLICK AL MAPA — POPUP ESTIL AMERICÀ (MINIMALISTA)
// ═══════════════════════════════════════════════════════════════════════

function trobarIndexMesProper(arr, val) {
    let best=0, bestDiff=Infinity;
    for (let i=0;i<arr.length;i++) {
        const d=Math.abs(arr[i]-val);
        if (d<bestDiff){bestDiff=d;best=i;}
    }
    return best;
}

let marcadorClic = null;
map.on('click', function(e) {
    const {lat, lng} = e.latlng;
    const item = totesLesHores[curIdx];
    if (!item) return;
    const data = item.data;
    const coords = getCoordenadesPer(data, variableActiva);
    const lats = coords.lat;
    const lons = coords.lon;
    // 🔧 Fem servir la clau real del JSON per llegir les dades
    const clauLectura = clauRealPerLlegir(variableActiva);
    const varInfo = data.variables[clauLectura] || data.variables[variableActiva];
    if (!varInfo || !varInfo.datos) return;

    const latMin = Math.min(lats[0], lats[lats.length-1]);
    const latMax = Math.max(lats[0], lats[lats.length-1]);
    const lonMin = Math.min(lons[0], lons[lons.length-1]);
    const lonMax = Math.max(lons[0], lons[lons.length-1]);
    if (lat<latMin||lat>latMax||lng<lonMin||lng>lonMax) return;

    const i = trobarIndexMesProper(lats, lat);
    const j = trobarIndexMesProper(lons, lng);
    const Nlon = lons.length;
    if (varInfo.datos.length !== lats.length * Nlon) return;

    const latNord = lats[0] > lats[lats.length-1];
    const filaReal = latNord ? (lats.length - 1 - i) : i;

    let v = varInfo.datos[filaReal * Nlon + j];

    const CLAUS_TEMP = ['st', 'sd', 't', 'dpt', 'temp_min2m', 'temp_max2m'];
    const base = clauBase(variableActiva);
    if (CLAUS_TEMP.includes(base) && v !== null && !isNaN(v) && v > 100) {
        v = v - 273.15;
    }

    const pal = getPaleta(variableActiva);
// Funció per formatar valors de manera llegible
function formatarValor(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    
    const absV = Math.abs(v);
    
    // Valors molt petits (menys de 0.001) → mostrar amb decimals significatius
    if (absV < 0.001 && absV > 0) {
        // Mostrar amb notació decimal, no científica
        return v.toFixed(6);
    }
    
    // Valors grans
    if (absV >= 10000) return v.toExponential(2);
    
    // Valors normals
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(2);
}

// Al popup, usa:
const vt = formatarValor(v);

    // ─── POPUP ESTIL AMERICÀ (COMPACTE / LATERAL) ───
    const html = `
        <div style="
            position: relative;
            background: rgba(0, 0, 0, 0.79);
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 4px;
            padding: 5px 22px 5px 10px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'Courier New', 'Segoe UI', monospace;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
            letter-spacing: 0.3px;
            white-space: nowrap;
        ">
            <div style="
                font-size: 9px;
                color: #cccccc;
                font-weight: 400;
                letter-spacing: 0.3px;
                text-transform: uppercase;
                line-height: 1.2;
            ">${lat.toFixed(2)}°${lat >= 0 ? 'N' : 'S'}<br>${lng.toFixed(2)}°${lng >= 0 ? 'E' : 'W'}</div>

            <div style="
                font-size: 20px;
                font-weight: 700;
                color: #ffffff;
                line-height: 1;
            ">${vt}<span style="font-size:9px;color:#667788;font-weight:400;margin-left:2px;">${pal.unitat}</span></div>

            <button onclick="if(marcadorClic){map.removeLayer(marcadorClic);marcadorClic=null;}" style="
                position: absolute; 
                top: 3px;
                right: 4px;
                background: transparent;
                border: none;
                color: #8899aa;
                font-size: 12px;
                cursor: pointer;
                line-height: 1;
                padding: 2px;
            " onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#8899aa'">✕</button>
        </div>
    `;

    if (marcadorClic) map.removeLayer(marcadorClic);
    marcadorClic = L.popup({
        closeButton: false,
        closeOnClick: true,
        className: 'popup-minimal',
        offset: [0, -8]
    }).setLatLng(e.latlng).setContent(html).openOn(map);
});

// ─── TANCAR AMB ESC ──────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && marcadorClic) {
        map.removeLayer(marcadorClic);
        marcadorClic = null;
    }
});

// ═══════════════════════════════════════════════════════════════════════
//  CÀRREGA DE JSONs
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
//  🔧 CÀRREGA DE JSONs — VERSIÓ OPTIMITZADA (lazy-load intel·ligent)
//  Manté l'estructura totesLesHores[idx].data igual que abans, però:
//   1) NOMÉS carrega SFC a l'inici, ràpid (barra de progrés visible)
//   2) Un cop acabat l'SFC, comença AUTOMÀTICAMENT una precàrrega en
//      segon pla del 3D de TOTES les hores (52), amb concurrència baixa
//      (2 a la vegada) perquè no saturi xarxa ni CPU/RAM de cop
//   3) El 3D, un cop carregat per a una hora, NO es purga mai (no hi ha
//      LRU pel 3D): es manté sempre en memòria fins que es recarrega la
//      pàgina. Així mai més falla per "hora no disponible".
//   4) Els arrays "datos" es converteixen a Float32Array (4-8x menys RAM)
//   5) 🔧 FIX carrera de condicions: assegurarHoraCarregada ara reutilitza
//      la MATEIXA promesa si ja hi ha una càrrega en curs per a la
//      mateixa hora+tipus, en lloc d'abandonar silenciosament amb false.
// ═══════════════════════════════════════════════════════════════════════

const MAX_REINTENTS = 4;           // Màxim intents per petició
const RETARD_INICIAL = 500;        // ms (500ms, 1s, 2s, 4s...)
const CONCURRENCIA_CARREGA = 3;    // SFC en paral·lel
const CONCURRENCIA_3D = 2;         // 3D en paral·lel
const MAX_HORES_SFC_CACHE = 999;   // (mantenir)

let totesLesHores = [];   // array d'objectes {step, dateObj, data} — 'data' pot ser null si encara no s'ha carregat
let curIdx = 0;
let _ordreUsSfc = [];      // es manté per compatibilitat, però ja no purga (veure _marcarUsSfc)

// 🔧 Ara guardem Promeses (no només flags) per poder ESPERAR una càrrega
//    en curs en lloc d'abandonar-la. Clau: "idx_sfc" o "idx_3d".
let _carregantAra = new Map(); // clauPeticio -> Promise<boolean>

let _precarga3dEnMarxa = false;
let _precarga3dCompletada = false;

// ─── Converteix array JS (amb null) a Float32Array (molta menys RAM) ──
function aArrayTipat(datos) {
    const n = datos.length;
    const arr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const v = datos[i];
        arr[i] = (v === null || v === undefined) ? NaN : v;
    }
    return arr;
}

function tipificarVariables(variables) {
    for (const clau in variables) {
        const info = variables[clau];
        if (info && Array.isArray(info.datos)) {
            info.datos = aArrayTipat(info.datos);
        }
    }
    return variables;
}

async function descomprimirGzip(response) {
    try {
        if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('gzip');
            const reader = response.body.pipeThrough(ds).getReader();
            const chunks = [];
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            const blob = new Blob(chunks);
            const text = await blob.text();
            return JSON.parse(text);
        } else {
            if (typeof pako !== 'undefined') {
                const buffer = await response.arrayBuffer();
                const data = pako.inflate(new Uint8Array(buffer), { to: 'string' });
                return JSON.parse(data);
            }
            return await response.json();
        }
    } catch (e) {
        throw new Error('Error descomprimint: ' + e.message);
    }
}


// ─── Mostra un avís si hi ha moltes hores fallades ──────────────────
function comprovarHoresFallades() {
    const total = totesLesHores.length;
    const fallades = totesLesHores.filter(h => h.data === null).length;
    const pct = total > 0 ? (fallades / total) * 100 : 0;

    if (pct > 30) {
        const missatge = document.getElementById('avis_xarxa');
        if (missatge) {
            missatge.style.display = 'block';
            missatge.textContent = `⚠️ ${fallades} de ${total} hores no s'han pogut carregar. Comprova la teva connexió a internet.`;
        } else {
            const div = document.createElement('div');
            div.id = 'avis_xarxa';
            div.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 60, 60, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 6px;
                font-family: Arial, sans-serif;
                font-size: 13px;
                z-index: 9999;
                max-width: 90%;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                backdrop-filter: blur(4px);
                border: 1px solid rgba(255,255,255,0.1);
            `;
            div.textContent = `⚠️ ${fallades} de ${total} hores no s'han pogut carregar. Comprova la teva connexió a internet.`;
            document.body.appendChild(div);

            setTimeout(() => {
                div.style.transition = 'opacity 0.5s';
                div.style.opacity = '0';
                setTimeout(() => div.remove(), 500);
            }, 8000);
        }
    }
}
// ─── Espera amb backoff exponencial ──────────────────────────────────
function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Intenta descomprimir amb múltiples estratègies ──────────────────
async function descomprimirGzipAmbFallback(response, url) {
    try {
        // Estratègia 1: DecompressionStream (nadiu)
        if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('gzip');
            const reader = response.body.pipeThrough(ds).getReader();
            const chunks = [];
            let errorDeCompresio = false;
            
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
            } catch (e) {
                // Si falla aquí, és un error de compressió
                errorDeCompresio = true;
                console.warn(`[Descompressió] Error amb DecompressionStream:`, e.message);
            }
            
            if (!errorDeCompresio && chunks.length > 0) {
                const blob = new Blob(chunks);
                const text = await blob.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.warn(`[Descompressió] JSON malformat:`, e.message);
                    throw new Error('JSON malformat');
                }
            }
        }
        
        // Estratègia 2: pako (llibreria de fallback)
        if (typeof pako !== 'undefined') {
            try {
                const buffer = await response.arrayBuffer();
                const data = pako.inflate(new Uint8Array(buffer), { to: 'string' });
                try {
                    return JSON.parse(data);
                } catch (e) {
                    console.warn(`[Descompressió] JSON malformat amb pako:`, e.message);
                    throw new Error('JSON malformat');
                }
            } catch (e) {
                console.warn(`[Descompressió] Error amb pako:`, e.message);
                throw e;
            }
        }
        
        // Estratègia 3: Intentar com a JSON sense comprimir (fallback final)
        try {
            const text = await response.text();
            return JSON.parse(text);
        } catch (e) {
            console.warn(`[Descompressió] No és JSON vàlid:`, e.message);
            throw new Error('No es pot descomprimir ni llegir com a JSON');
        }
        
    } catch (e) {
        // Si tot falla, intentar llegir el raw (potser és text pla)
        try {
            const text = await response.text();
            if (text.startsWith('{') || text.startsWith('[')) {
                return JSON.parse(text);
            }
        } catch (e2) {
            // Silenciós
        }
        throw new Error('Error descomprimint: ' + e.message);
    }
}

// ─── Carrega un fitxer amb múltiples intents i estratègies ────────────
async function carregarFitxerAmbReintents(url, maxIntents = 3) {
    let retard = RETARD_INICIAL;
    let ultimError = null;
    
    for (let intent = 1; intent <= maxIntents; intent++) {
        try {
            const response = await fetch(url);
            
            if (response.status === 404) {
                console.log(`[Fitxer] ${url} no existeix (404)`);
                return null;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Intentar descomprimir
            try {
                const data = await descomprimirGzipAmbFallback(response, url);
                return data;
            } catch (e) {
                // Si la descompressió falla per corrupte, NO reintentar
                if (e.message.includes('incorrect header check') || 
                    e.message.includes('corrupted') ||
                    e.message.includes('header check')) {
                    console.warn(`[Fitxer corrupte] ${url} - No es pot recuperar:`, e.message);
                    return null; // No reintentar, el fitxer està malmès
                }
                // Altres errors (xarxa, timeout) → reintentar
                throw e;
            }
            
        } catch (e) {
            ultimError = e;
            
            // Si és l'últim intent, rendir-se
            if (intent === maxIntents) {
                console.warn(`[Fitxer] ${url} fallat després de ${maxIntents} intents:`, e.message);
                return null;
            }
            
            // Si és un error de xarxa (NS_BASE_STREAM_CLOSED), reintentar
            if (e.message.includes('NS_BASE_STREAM_CLOSED') || 
                e.message.includes('network') ||
                e.message.includes('timeout')) {
                console.warn(`[Reintent ${intent}/${maxIntents}] ${url} - Error de xarxa: ${e.message}. Reintentant en ${retard}ms...`);
                await esperar(retard);
                retard *= 2;
                continue;
            }
            
            // Altres errors (corrupte) → no reintentar
            console.warn(`[Fitxer] ${url} - Error no recuperable:`, e.message);
            return null;
        }
    }
    
    return null;
}

// ─── Carrega SFC (i 3D si cal) amb estratègies múltiples ─────────────
async function carregarUnStep(i, ambDades3d) {
    const base = 'web_data/';
    const p = String(i).padStart(2, '0');
    
    // Intentar 3D si es demana
    let td = null;
    if (ambDades3d) {
        // Intentar primer .json.gz
        td = await carregarFitxerAmbReintents(base + '3d_' + p + '.json.gz', 3);
        
        // Si falla, intentar .json sense comprimir (per si de cas)
        if (!td) {
            try {
                const resp = await fetch(base + '3d_' + p + '.json');
                if (resp.ok) {
                    td = await resp.json();
                    console.log(`[3D] Carregat sense compressió: 3d_${p}.json`);
                }
            } catch (e) {
                // Silenciós
            }
        }
    }
    
    // Intentar SFC
    let sfc = await carregarFitxerAmbReintents(base + 'sfc_' + p + '.json.gz', 3);
    
    // Si falla, intentar .json sense comprimir
    if (!sfc) {
        try {
            const resp = await fetch(base + 'sfc_' + p + '.json');
            if (resp.ok) {
                sfc = await resp.json();
                console.log(`[SFC] Carregat sense compressió: sfc_${p}.json`);
            }
        } catch (e) {
            // Silenciós
        }
    }
    
    // Si tenim almenys SFC o 3D
    if (sfc || td) {
        const base_d = sfc || td;
        const variables = {};
        if (sfc) Object.assign(variables, tipificarVariables(sfc.variables));
        if (td) Object.assign(variables, tipificarVariables(td.variables));
        escalarVariablesMitjana(variables);
        if (Object.keys(variables).length === 0) {
            console.warn(`[carregarUnStep] Hora ${p}: variables buides`);
            return null;
        }
        
        calcularVelocitatVent(variables);
        
        const data = {
            ...base_d, variables,
            coordenadas: sfc ? sfc.coordenadas : td.coordenadas,
            coordenadas_3d: td ? td.coordenadas : null,
            _te3d: !!td,
        };
        return { step: data.step, dateObj: new Date(data.hora_utc + 'Z'), data };
    }
    
    // Si arribem aquí, no tenim dades
    console.warn(`[carregarUnStep] Hora ${p}: sense dades (SFC ni 3D)`);
    return null;
}

// ─── Marca un idx com "usat". 🔧 Ja NO purga res: mantenim totes les
//     hores (SFC sempre, 3D quan es carrega) permanentment en memòria
//     perquè no torni a fallar cap hora un cop carregada. ──────────────
function _marcarUsSfc(idx) {
    const p = _ordreUsSfc.indexOf(idx);
    if (p !== -1) _ordreUsSfc.splice(p, 1);
    _ordreUsSfc.push(idx);
    // 🔧 Purga desactivada intencionadament (es volen les 52 hores sempre
    //     disponibles, tant SFC com 3D). Si en el futur cal limitar RAM,
    //     reactivar aquí una purga LRU com abans.
}

// ─── Assegura que l'hora idx té dades carregades (SFC sempre; 3D només
//     si ambDades3d=true o ja hi era). Retorna una Promise<boolean>.
//     🔧 FIX carrera de condicions: si ja hi ha una càrrega en curs per
//     a la mateixa clau (idx+tipus), ESPEREM la seva mateixa promesa en
//     lloc de retornar false immediatament. Això evita el "mapa en blanc"
//     quan dues parts del codi demanen la mateixa hora alhora (per
//     exemple: la precàrrega en segon pla i un clic de l'usuari). ──────
async function assegurarHoraCarregada(idx, ambDades3d) {
    if (idx < 0 || idx >= totesLesHores.length) return false;
    const item = totesLesHores[idx];

    const teSfc = item.data && item.data.variables;
    const te3d = item.data && item.data._te3d;

    if (teSfc && (!ambDades3d || te3d)) {
        _marcarUsSfc(idx);
        return true;
    }

    const clauPeticio = idx + '_' + (ambDades3d ? '3d' : 'sfc');

    // Si ja hi ha una càrrega en curs per a aquesta mateixa clau,
    // n'esperem el resultat en lloc d'abandonar.
    if (_carregantAra.has(clauPeticio)) {
        return await _carregantAra.get(clauPeticio);
    }

    const promesa = (async () => {
        const nou = await carregarUnStep(idx, ambDades3d);
        if (!nou) return false;

        const itemActual = totesLesHores[idx];
        if (itemActual.data && itemActual.data.variables && !ambDades3d) {
            // Ja teníem SFC (i potser 3D antic); combinem per no perdre res
            Object.assign(itemActual.data.variables, nou.data.variables);
        } else {
            itemActual.data = nou.data;
        }

        _marcarUsSfc(idx);
        return true;
    })();

    _carregantAra.set(clauPeticio, promesa);
    try {
        return await promesa;
    } finally {
        _carregantAra.delete(clauPeticio);
    }
}

// ─── Prefetch en segon pla de les hores veïnes (no bloqueja la UI) ─────
function prefetchVeines(idx, amb3d) {
    [idx - 1, idx + 1].forEach(v => {
        if (v >= 0 && v < totesLesHores.length) {
            const item = totesLesHores[v];
            const jaTe3d = item && item.data && item.data._te3d;
            if (!item || !item.data || (amb3d && !jaTe3d)) {
                assegurarHoraCarregada(v, !!amb3d);
            }
        }
    });
}

function afegirHoraCarregada(item) {
    if (!item) return;
    if (totesLesHores.some(h => h.step === item.step)) return;
    let idxInsercio = totesLesHores.findIndex(h => h.dateObj > item.dateObj);
    if (idxInsercio === -1) idxInsercio = totesLesHores.length;
    totesLesHores.splice(idxInsercio, 0, item);
    _marcarUsSfc(idxInsercio);

    window.totesLesHores = totesLesHores;
    document.dispatchEvent(new CustomEvent('mapa-dades-llestes', {
        detail: { totesLesHores: totesLesHores }
    }));

    construirGraellaHores();
    if (totesLesHores.length === 1) {
        construirPanellParametres();
        mostrarHora(0);
    } else if (idxInsercio <= curIdx) {
        curIdx++;
    }
}

// ─── Carrega inicial: només SFC, amb concurrència limitada ─────────────
async function carregarTotsJSONs() {
    const TIEMPO_INICIO = Date.now();
    const TIEMPO_MINIMO = 1500;

    let carregats = 0;
    let fallats = 0;
    const total = MAX_STEPS;
    actualitzarBarraProgress(0, total);

    let seguent = 0;
    const errors = [];

    async function worker() {
        while (seguent < total) {
            const i = seguent++;
            const item = await carregarUnStep(i, false);
            if (item) {
                afegirHoraCarregada(item);
                carregats++;
                actualitzarBarraProgress(carregats + fallats, total);
            } else {
                fallats++;
                errors.push(i);
                actualitzarBarraProgress(carregats + fallats, total);
            }
        }
    }

    const workers = [];
    for (let w = 0; w < CONCURRENCIA_CARREGA; w++) workers.push(worker());
    await Promise.all(workers);

    const tempsPassat = Date.now() - TIEMPO_INICIO;
    if (tempsPassat < TIEMPO_MINIMO) {
        await new Promise(resolve => setTimeout(resolve, TIEMPO_MINIMO - tempsPassat));
    }

    if (errors.length > 0) {
        console.warn(`[Loading] ${errors.length} hores SFC fallades:`, errors);
        comprovarHoresFallades();
    }

    construirPanellParametres();
    if (totesLesHores.length > 0) mostrarHora(0);

    const loadingOverlay = document.getElementById('loading_overlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');

    console.log(`[Loading] ${totesLesHores.length} hores (SFC) carregades en ${((Date.now() - TIEMPO_INICIO) / 1000).toFixed(1)}s. Començant precàrrega 3D en segon pla...`);

    precarregarTot3dEnSegonPla();
}

// ─── 🔧 NOU: precàrrega en segon pla del 3D de TOTES les hores ─────────
//     No bloqueja la UI. Prioritza sempre l'hora que l'usuari té oberta
//     en aquell moment (curIdx) perquè, si canvia de variable a una 3D,
//     ja estigui (o estigui a punt d'estar) disponible.
async function precarregarTot3dEnSegonPla() {
    if (_precarga3dEnMarxa || _precarga3dCompletada) return;
    _precarga3dEnMarxa = true;

    // Ordenem els índexs començant per l'hora actual i expandint-nos cap
    // enfora (actual, +1, -1, +2, -2...) perquè les hores que l'usuari
    // és més probable que miri aviat es carreguin primero.
    const total = totesLesHores.length;
    const ordre = [];
    const centre = curIdx || 0;
    ordre.push(centre);
    for (let d = 1; d < total; d++) {
        if (centre + d < total) ordre.push(centre + d);
        if (centre - d >= 0) ordre.push(centre - d);
    }

    let cursor = 0;
    async function worker() {
        while (cursor < ordre.length) {
            const idx = ordre[cursor++];
            await assegurarHoraCarregada(idx, true);
            // petita pausa perquè no acapari tota la xarxa/CPU de cop
            await new Promise(r => setTimeout(r, 30));
        }
    }

    const workers = [];
    for (let w = 0; w < CONCURRENCIA_3D; w++) workers.push(worker());
    await Promise.all(workers);

    _precarga3dEnMarxa = false;
    _precarga3dCompletada = true;
    console.log('[3D] Precàrrega completa: totes les hores tenen dades 3D disponibles en memòria.');
}

function actualitzarBarraProgress(carregats, total) {
    const pct = Math.round((carregats / total) * 100);
    const barra = document.getElementById('loading_progress_bar');
    const text = document.getElementById('loading_progress_text');
    if (barra) barra.style.width = pct + '%';
    if (text) text.textContent = carregats + ' / ' + total + ' hores (' + pct + '%)';
}

async function mostrarHora(idx) {
    if (idx < 0 || idx >= totesLesHores.length) return;

    const user = window._firebaseUser || null;
    const horaLliure = (idx % 3 === 0);
    const bloquejat = !user && !horaLliure;

    if (bloquejat) {
        if (typeof loginWithGoogle === 'function') loginWithGoogle();
        return;
    }

    curIdx = idx;
    window.skewtHourIndex = idx;

    const item0 = totesLesHores[idx];
    if (item0 && item0.data) {
        if (canvasLayer) canvasLayer.setData(item0.data);
        if (window.ventEnabled && typeof redibuixarVent === 'function') redibuixarVent();
    }

    // Actualitzar barra d'hores
    const grid = document.getElementById('fh_grid');
    if (grid) {
        const items = grid.querySelectorAll('.fh-item');
        items.forEach((el, i) => {
            el.classList.remove('active');
            el.style.color = '#556680';
            el.style.background = 'rgba(255,255,255,0.03)';
            el.style.borderColor = 'transparent';

            if (i === idx) {
                el.classList.add('active');
                el.style.color = '#FFD700';
                el.style.background = 'rgba(255,215,0,0.12)';
                el.style.borderColor = 'rgba(255,215,0,0.3)';
            }
        });

        setTimeout(() => {
            const active = grid.querySelector('.fh-item.active');
            if (active) {
                active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 100);
    }

    // Actualitzar overlay
    const d = totesLesHores[idx].dateObj;
    const ds = d.toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' });
    const ls = d.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' });
    const us = String(d.getUTCHours()).padStart(2, '0') + 'Z';

    const overlayDate = document.getElementById('overlay-date');
    const overlayLocal = document.getElementById('overlay-local');
    const overlayUtc = document.getElementById('overlay-utc');
    const fhValidTime = document.getElementById('fh_validtime');

    if (overlayDate) overlayDate.textContent = ds.toUpperCase();
    if (overlayLocal) overlayLocal.textContent = ls;
    if (overlayUtc) overlayUtc.textContent = us;
    if (fhValidTime) fhValidTime.textContent = ds + ' · ' + ls + ' local / ' + us;

    // 🔧 Cal 3D si: la variable activa del mapa és 3D, O el Skew-T està obert
    const necessita3d = (variableActiva && esVariable3D(variableActiva)) || window.sondeigObert;

    const item = totesLesHores[idx];
    const teDadesJa = item && item.data && item.data.variables &&
                       (!necessita3d || item.data._te3d);

    if (!teDadesJa) {
        const ok = await assegurarHoraCarregada(idx, necessita3d);
        if (!ok) {
            console.warn('[mostrarHora] No s\'ha pogut carregar la hora', idx);
            return;
        }
        if (curIdx === idx && totesLesHores[idx].data) {
            if (canvasLayer) canvasLayer.setData(totesLesHores[idx].data);
            if (window.ventEnabled && typeof redibuixarVent === 'function') redibuixarVent();
            document.dispatchEvent(new CustomEvent('mapa-dades-llestes', {
                detail: { totesLesHores: totesLesHores, idx: idx }
            }));
        }
    } else {
        document.dispatchEvent(new CustomEvent('mapa-dades-llestes', {
            detail: { totesLesHores: totesLesHores, idx: idx }
        }));
    }

    if (curIdx !== idx) return;

    prefetchVeines(idx, necessita3d);
}

function construirGraellaHores() {
    const grid = document.getElementById('fh_grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (!totesLesHores || totesLesHores.length === 0) {
        grid.innerHTML = '<div style="color:#556680;padding:6px 12px;font-size:11px;text-align:center;width:100%;">Carregant dades...</div>';
        return;
    }
    
    const user = window._firebaseUser || null;
    const bloquejat = !user;
    
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;gap:3px;align-items:center;padding:2px 4px;';
    
    totesLesHores.forEach((item, i) => {
        const d = item.dateObj;
        const horaNum = d.getHours();
        const horaStr = String(horaNum).padStart(2, '0') + 'h';
        const minStr = String(d.getMinutes()).padStart(2, '0');
        const isActive = (i === curIdx);

        // Hores lliures cada 3h (0, 3, 6, 9...)
        const horaLliure = (i % 3 === 0);
        const itemBloquejat = bloquejat && !horaLliure;
        
        const cell = document.createElement('div');
        cell.className = 'fh-item' + (isActive ? ' active' : '');
        cell.dataset.idx = i;
        
        cell.style.cssText = `
            flex: 0 0 auto;
            padding: 2px 8px;
            border-radius: 3px;
            cursor: ${itemBloquejat ? 'not-allowed' : 'pointer'};
            font-size: 11px;
            font-weight: 500;
            color: ${isActive ? '#FFD700' : '#556680'};
            background: ${isActive ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.03)'};
            border: ${isActive ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent'};
            transition: all 0.15s ease;
            text-align: center;
            min-width: 32px;
            position: relative;
            user-select: none;
            font-family: 'Segoe UI', Tahoma, sans-serif;
            line-height: 1.2;
            opacity: ${itemBloquejat ? '0.3' : '1'};
        `;
        
        if (itemBloquejat) {
            cell.title = 'Inicia sessió per desbloquejar';
            cell.innerHTML = `
                <span style="font-size:12px;font-weight:600;display:block;">${horaStr}</span>
                <span style="font-size:7px;color:#3a4a5a;display:block;margin-top:-1px;">${minStr}'</span>
                <span style="position:absolute;top:-2px;right:-1px;font-size:7px;color:#FF6B35;"><i class="fas fa-lock"></i></span>
            `;
        } else {
            cell.innerHTML = `
                <span style="font-size:12px;font-weight:600;display:block;">${horaStr}</span>
                <span style="font-size:7px;color:#3a4a5a;display:block;margin-top:-1px;">${minStr}'</span>
            `;
        }
        
        if (!itemBloquejat) {
            cell.addEventListener('mouseenter', function() {
                if (!this.classList.contains('active')) {
                    this.style.background = 'rgba(255,255,255,0.08)';
                    this.style.color = '#c8d8e8';
                }
            });
            cell.addEventListener('mouseleave', function() {
                if (!this.classList.contains('active')) {
                    this.style.background = 'rgba(255,255,255,0.03)';
                    this.style.color = '#556680';
                }
            });
        }
        
        cell.onclick = function(e) {
            e.stopPropagation();
            const idx = parseInt(this.dataset.idx);
            const lliure = (idx % 3 === 0);
            if (bloquejat && !lliure) {
                if (typeof loginWithGoogle === 'function') {
                    loginWithGoogle();
                }
                return;
            }
            mostrarHora(idx);
        };
        
        container.appendChild(cell);
    });
    
    grid.appendChild(container);
    
    setTimeout(() => {
        const active = grid.querySelector('.fh-item.active');
        if (active) {
            active.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest', 
                inline: 'center' 
            });
        }
    }, 150);
}

// ═══════════════════════════════════════════════════════════════════════
//  PANELL DE PARÀMETRES
// ═══════════════════════════════════════════════════════════════════════

function tancarTotsAcordions(excepteClauBase) {
    document.querySelectorAll('.param-acordio-cap').forEach(capcal => {
        const clauB = capcal.dataset.clauBase;
        if (clauB === excepteClauBase) return;
        const clauEstat = `acordio_${clauB}`;
        estatAcordio[clauEstat] = false;
        capcal.querySelector('.param-acordio-fletxa').textContent = '▸';
        const cos = capcal.nextElementSibling;
        if (cos && cos.classList.contains('param-acordio-cos')) {
            cos.style.display = 'none';
        }
    });
}

function ordenarClausPerNivell(claus) {
    return claus.slice().sort((a, b) => {
        const na = parseFloat(a.split('_').pop());
        const nb = parseFloat(b.split('_').pop());
        return nb - na;
    });
}

const estatAcordio = {};
function construirPanellParametres() {
    const cont = document.getElementById('parameter_selection');
    if (!cont || !totesLesHores[0]) return;
    cont.innerHTML = '';

    // 1. RECOLLIR TOTES LES VARIABLES DISPONIBLES
    //    🔧 Normalitzem les claus crues del WCS a claus curtes aquí mateix,
    //    perquè tota la resta del panell (agrupacions, cerca, etc.) treballi
    //    sempre amb noms consistents amb PALETES/GRUPS_SIMPLES.
    const totesVariables = new Set();
    const infoVariables = {};
    totesLesHores.forEach(hora => {
        if (hora.data && hora.data.variables) {
            Object.keys(hora.data.variables).forEach(clauOriginal => {
                const clau = normalitzarClau(clauOriginal);
                totesVariables.add(clau);
                if (!infoVariables[clau]) infoVariables[clau] = hora.data.variables[clauOriginal];
            });
        }
    });

    const clausUsades = new Set();

const crearRow = (clau, className = 'param-row') => {
    const info = infoVariables[clau];
    if (!info) return null;
    
    const teAcces = verificarAccesVariable(clau);
    const esPremium = typeof esParametrePremium === 'function' && esParametrePremium(clau);
    
    const row = document.createElement('div');
    row.className = className;
    row.dataset.clau = clau;
    
    if (!teAcces && esPremium) {
        row.style.opacity = '0.35';
        row.style.filter = 'grayscale(0.8)';
        row.style.cursor = 'not-allowed';
        row.title = '🔒 Variable exclusiva per membres premium';
    } else {
        row.style.cursor = 'pointer';
    }
    
    const pal = getPaleta(clau);
    const unitat = (info.unidades && info.unidades.trim() !== '') ? info.unidades : (pal.unitat || '');
    const nomBackend = info.nombre || '';
    const semblaClauCrua = /^[A-Z0-9_]+$/.test(nomBackend) && nomBackend.length > 6;
    const nom = semblaClauCrua ? pal.titol : (nomBackend || pal.titol);
    
    const iconaCandau = (!teAcces && esPremium) ? ' 🔒' : '';
    
    row.innerHTML = `<div class="param-link">${nom} <span class="param-unit">(${unitat})</span>${iconaCandau}</div>`;
    
    row.onclick = () => {
        if (teAcces) {
            seleccionarVariable(clau);
        } else if (esPremium) {
            if (typeof mostrarAvisPremium === 'function') {
                mostrarAvisPremium(clau);
            } else {
                console.warn('[Accés] Variable premium bloquejada:', clau);
            }
        } else {
            if (typeof mostrarAvisLogin === 'function') {
                mostrarAvisLogin(clau);
            } else {
                console.warn('[Accés] Variable bloquejada per login:', clau);
            }
        }
    };

    return row;
};


// ─── Tancar bloqueig ──────────────────────────────────────────────────
window.tancarBloqueig = function() {
    const overlay = document.getElementById('mapLockOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
    const mapa = document.getElementById('map');
    if (mapa) {
        mapa.style.opacity = '1';
        mapa.style.pointerEvents = 'auto';
    }
};

    const crearSeparador = () => {
        const sep = document.createElement('div');
        sep.className = 'param-separador';
        sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:6px 12px;';
        return sep;
    };

    const crearTitolGrup = (nom, count) => {
        const h3 = document.createElement('h3');
        h3.className = 'param-group-title';
        h3.textContent = `${nom} (${count})`;
        return h3;
    };

    // ============================================
    // PART SUPERIOR - GRUP PRINCIPAL
    // ============================================
    
    const principals = GRUP_PRINCIPAL
        .filter(clau => totesVariables.has(clau) && !esVariableAmagada(clau));
    
    if (principals.length > 0) {
        principals.forEach(clau => {
            const row = crearRow(clau, 'param-row param-row-principal');
            if (row) {
                cont.appendChild(row);
                clausUsades.add(clau);
            }
        });
        cont.appendChild(crearSeparador());
    }

    // ============================================
    // GRUPS SIMPLES
    // ============================================
    
    Object.entries(GRUPS_SIMPLES).forEach(([nomGrup, clausGrup]) => {
        const entrades = [];

        clausGrup.forEach(clauB => {
            if (totesVariables.has(clauB) && !esVariableAmagada(clauB) && !clausUsades.has(clauB)) {
                entrades.push(clauB);
            }
        });

        totesVariables.forEach(clau => {
            if (clausUsades.has(clau)) return;
            for (const clauB of clausGrup) {
                if (clau.startsWith(clauB + '_') && !entrades.includes(clau)) {
                    entrades.push(clau);
                    break;
                }
            }
        });

        entrades.sort((a, b) => a.localeCompare(b));
        if (entrades.length === 0) return;

        cont.appendChild(crearTitolGrup(nomGrup, entrades.length));
        entrades.forEach(clau => {
            const row = crearRow(clau);
            if (row) {
                cont.appendChild(row);
                clausUsades.add(clau);
            }
        });
    });

    // ============================================
    // GRUPS ACORDIÓ
    // ============================================
    
    Object.entries(GRUPS_ACORDIO).forEach(([nomGrupTitol, clausBase]) => {
        clausBase.forEach(clauB => {
            const nivellsClaus = [];
            totesVariables.forEach(clau => {
                if (clausUsades.has(clau)) return;
                if (clau.startsWith(clauB + '_') && /^\d+$/.test(clau.slice(clauB.length + 1))) {
                    nivellsClaus.push(clau);
                }
            });

            if (nivellsClaus.length === 0) return;

            const nivellsOrdenats = ordenarClausPerNivell(nivellsClaus);
            const paletaBase = PALETES[clauB];
            const nomBase = paletaBase ? paletaBase.titol : clauB;
            const clauEstat = `acordio_${clauB}`;
            if (!(clauEstat in estatAcordio)) estatAcordio[clauEstat] = false;

            const capcal = document.createElement('div');
            capcal.className = 'param-acordio-cap';
            capcal.dataset.clauBase = clauB;
            capcal.innerHTML = `
                <span class="param-acordio-fletxa">${estatAcordio[clauEstat] ? '▾' : '▸'}</span> 
                ${nomBase} 
                <span class="param-unit">(${nivellsOrdenats.length} nivells)</span>
            `;
            cont.appendChild(capcal);

            const cosContenidor = document.createElement('div');
            cosContenidor.className = 'param-acordio-cos';
            cosContenidor.style.display = estatAcordio[clauEstat] ? 'block' : 'none';

            nivellsOrdenats.forEach(clau => {
                const row = crearRow(clau, 'param-row param-row-nivell');
                if (row) {
                    cosContenidor.appendChild(row);
                    clausUsades.add(clau);
                }
            });

            cont.appendChild(cosContenidor);

            capcal.addEventListener('click', () => {
                const obert = estatAcordio[clauEstat];
                tancarTotsAcordions(clauB);
                estatAcordio[clauEstat] = !obert;
                capcal.querySelector('.param-acordio-fletxa').textContent = !obert ? '▾' : '▸';
                cosContenidor.style.display = !obert ? 'block' : 'none';
            });
        });
    });

    // ============================================
    // PART INFERIOR - ALTRES
    // ============================================
    
    const sobrants = [...totesVariables]
        .filter(c => !clausUsades.has(c) && !esVariableAmagada(c))
        .sort((a, b) => a.localeCompare(b));

    if (sobrants.length > 0) {
        cont.appendChild(crearSeparador());
        cont.appendChild(crearTitolGrup('Altres', sobrants.length));
        sobrants.forEach(clau => {
            const row = crearRow(clau);
            if (row) cont.appendChild(row);
        });
    }

    // SELECCIONAR VARIABLE PER DEFECTE
    seleccionarVariable('st', true);
}

async function seleccionarVariable(clau, silenciós) {
    if (variableActiva === clau && !silenciós) return;

    if (typeof window.verificarAccesVariable === 'function') {
        const acces = window.verificarAccesVariable(clau);
        if (!acces) {
            console.log('[Mapa] Accés denegat per:', clau);
            return;
        }
    }

    variableActiva = clau;
    window._currentParameter = clau;

    document.querySelectorAll('.param-row').forEach(el => {
        el.classList.toggle('param-selected', el.dataset.clau === clau);
    });

    const base = clauBase(clau);
    const clauEstat = `acordio_${base}`;
    if (clauEstat in estatAcordio && !estatAcordio[clauEstat] && clau !== base) {
        tancarTotsAcordions(base);
        estatAcordio[clauEstat] = true;
        const capcal = document.querySelector(`.param-acordio-cap[data-clau-base="${base}"]`);
        if (capcal) {
            capcal.querySelector('.param-acordio-fletxa').textContent = '▾';
            const cos = capcal.nextElementSibling;
            if (cos && cos.classList.contains('param-acordio-cos')) cos.style.display = 'block';
        }
    }

    // 🔧 Si la variable és 3D i encara no tenim el 3D d'aquesta hora carregat,
    //    el descarreguem ara (només aquesta hora, no totes). Amb la
    //    precàrrega en segon pla activa, normalment ja hi serà; això és
    //    només una xarxa de seguretat per si l'usuari va més ràpid que la
    //    precàrrega. 🔧 FIX: ara SÍ comprovem el resultat (`ok`) abans de
    //    renderitzar, per no pintar un mapa buit si la càrrega ha fallat.
    if (esVariable3D(clau)) {
        const item = totesLesHores[curIdx];
        const jaTe3d = item && item.data && item.data._te3d;
        if (!jaTe3d) {
            const ok = await assegurarHoraCarregada(curIdx, true);
            if (variableActiva !== clau) return; // l'usuari ha canviat de variable mentrestant
            if (!ok) {
                console.warn('[seleccionarVariable] No s\'ha pogut carregar el 3D d\'aquesta hora encara. Es tornarà a intentar.');
                // Petit reintent automàtic (per exemple si hi va haver un
                // error de xarxa puntual), sense bloquejar la UI massa temps.
                setTimeout(() => {
                    if (variableActiva === clau) {
                        assegurarHoraCarregada(curIdx, true).then(ok2 => {
                            if (ok2 && variableActiva === clau) {
                                canvasLayer._needsRedraw = true;
                                canvasLayer._render();
                            }
                        });
                    }
                }, 1500);
                return;
            }
        }
    }

    canvasLayer._needsRedraw = true;
    canvasLayer._render();

    if (!silenciós) {
        const actiu = document.querySelector('.param-row.param-selected');
        if (actiu) actiu.scrollIntoView({ block: 'nearest' });
    }

    actualitzarCapcaleraParametre();
}

function actualitzarCapcaleraParametre() {
    const pal = getPaleta(variableActiva);
    const label = document.getElementById('parameter_menu_link');
    if (label) label.textContent = pal.titol + ' (' + pal.unitat + ')';
}




// ═══════════════════════════════════════════════════════════════════════
//  PANELL D'AJUSTOS
// ═══════════════════════════════════════════════════════════════════════

function crearPanellAjustos() {
    const btnAjustos = document.createElement('button');
    btnAjustos.id = 'btnAjustos';
    btnAjustos.textContent = '⚙';
    btnAjustos.title = 'Ajustos: mapa base i capes';
    btnAjustos.style.cssText = 'position:absolute;top:10px;right:10px;z-index:1000;width:34px;height:34px;border-radius:4px;border:1px solid #33475b;background:#0a101a;color:#cfe0ee;font-size:16px;cursor:pointer;';
    document.body.appendChild(btnAjustos);

    const gridMapesHtml = Object.entries(MAPES_BASE).map(([clau, def]) => `
        <button data-mapa="${clau}" class="aj-mapa-btn" style="display:block;width:100%;text-align:left;padding:5px 8px;margin-bottom:3px;border-radius:3px;border:1px solid #2a3a5a;background:${clau===mapaBaseActiva?'#2a5a8a':'#141c2a'};color:#cfe0ee;font-size:11px;cursor:pointer;">${def.nom}</button>
    `).join('');

    const capesHtml = GEOJSON_CAPES.map(def => `
        <div class="aj-capa-fila" data-id="${def.id}" style="display:flex;align-items:center;gap:6px;padding:4px 0;">
            <input type="checkbox" checked style="cursor:pointer;">
            <span style="flex:1;font-size:11px;color:#cfe0ee;">${def.nom}</span>
            <input type="color" value="${def.color}" style="width:22px;height:18px;padding:0;border:none;cursor:pointer;background:transparent;">
        </div>
    `).join('');

    const panell = document.createElement('div');
    panell.id = 'panellAjustos';
    panell.style.cssText = 'display:none;position:absolute;top:50px;right:10px;z-index:1000;width:230px;background:#0a101a;border:1px solid #33475b;border-radius:6px;padding:10px;font-family:Arial,sans-serif;font-size:12px;color:#cfe0ee;box-shadow:0 4px 14px rgba(0,0,0,0.4);';
    panell.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px;">Mapa base</div>
        <div id="ajGridMapes">${gridMapesHtml}</div>
        <div style="border-top:1px solid #2a3a5a;margin:8px 0;"></div>
        <div style="font-weight:700;margin-bottom:6px;">Capes</div>
        <div id="ajLlistaCapes">${capesHtml}</div>
        <div style="border-top:1px solid #2a3a5a;margin:8px 0;"></div>
        <div style="font-weight:700;margin-bottom:6px;">Vent</div>
        <div style="display:flex;gap:6px;margin-bottom:4px;">
            <button id="btnVent" style="flex:1;padding:4px;border-radius:3px;border:1px solid #2a3a5a;background:${window.ventEnabled?'#2a5a8a':'#141c2a'};color:#cfe0ee;font-size:10px;cursor:pointer;">${window.ventEnabled?'💨 Vent ON':'💨 Vent OFF'}</button>
            <button id="btnVentMode" style="flex:1;padding:4px;border-radius:3px;border:1px solid #2a3a5a;background:#141c2a;color:#cfe0ee;font-size:10px;cursor:pointer;">〜 Streamlines</button>
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:#7f9bb3;">
            <span>Color:</span>
            <select id="ventColor" style="background:#141c2a;color:#cfe0ee;border:1px solid #2a3a5a;border-radius:3px;padding:2px;font-size:10px;">
                <option value="black" selected>Negre</option>
                <option value="white">Blanc</option>
            </select>
            <span>Opac:</span>
            <input type="range" id="ventOpacity" min="0.1" max="1" step="0.1" value="0.7" style="width:40px;">
            <span>Gruix:</span>
            <input type="range" id="ventWidth" min="0.5" max="3" step="0.1" value="1.2" style="width:40px;">
        </div>
    `;
    document.body.appendChild(panell);

    btnAjustos.addEventListener('click', (e) => {
        e.stopPropagation();
        panell.style.display = panell.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
        if (panell.style.display !== 'none' && !panell.contains(e.target) && e.target !== btnAjustos) {
            panell.style.display = 'none';
        }
    });

    panell.querySelectorAll('.aj-mapa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            canviarMapaBase(btn.dataset.mapa);
            panell.querySelectorAll('.aj-mapa-btn').forEach(b => {
                b.style.background = b.dataset.mapa === mapaBaseActiva ? '#2a5a8a' : '#141c2a';
            });
        });
    });

    panell.querySelectorAll('.aj-capa-fila').forEach(fila => {
        const id = fila.dataset.id;
        const cb = fila.querySelector('input[type="checkbox"]');
        const colorInput = fila.querySelector('input[type="color"]');
        cb.addEventListener('change', () => {
            const capa = capaInstancies[id];
            if (!capa) return;
            if (cb.checked) capa.addTo(map);
            else map.removeLayer(capa);
        });
        colorInput.addEventListener('input', () => {
            const capa = capaInstancies[id];
            if (capa) capa.setStyle({ color: colorInput.value });
        });
    });

    document.getElementById('btnVent').addEventListener('click', function() {
        window.toggleVent();
    });
    document.getElementById('btnVentMode').addEventListener('click', function() {
        window.toggleVentMode();
    });
    document.getElementById('ventColor').addEventListener('change', function() {
        window.setStreamlineColor(this.value);
    });
    document.getElementById('ventOpacity').addEventListener('input', function() {
        window.setStreamlineOpacity(parseFloat(this.value));
    });
    document.getElementById('ventWidth').addEventListener('input', function() {
        window.setStreamlineWidth(parseFloat(this.value));
    });
}

// ─── CONTROLS ─────────────────────────────────────────────────────────
document.getElementById('btnPrev').addEventListener('click', ()=>mostrarHora((curIdx-1+totesLesHores.length)%totesLesHores.length));
document.getElementById('btnNext').addEventListener('click', ()=>mostrarHora((curIdx+1)%totesLesHores.length));
let animTimer=null, isPlaying=false;
document.getElementById('btnPlay').addEventListener('click', function() {
    if (isPlaying) { clearInterval(animTimer); isPlaying=false; this.textContent='▶ Animació'; }
    else { isPlaying=true; this.textContent='⏹ Aturar'; animTimer=setInterval(()=>mostrarHora((curIdx+1)%totesLesHores.length), 600); }
});
document.addEventListener('keydown', (e) => {
    if (e.key==='ArrowLeft') mostrarHora((curIdx-1+totesLesHores.length)%totesLesHores.length);
    if (e.key==='ArrowRight') mostrarHora((curIdx+1)%totesLesHores.length);
});

// ─── CERCADOR ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const cercador = document.getElementById('parameter_search');
    if (!cercador) return;
    cercador.addEventListener('input', () => {
        const q = cercador.value.trim().toLowerCase();

        document.querySelectorAll('.param-row').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });

        document.querySelectorAll('.param-group-title').forEach(title => {
            let next = title.nextElementSibling;
            let visible = false;
            while (next && !next.classList.contains('param-group-title') && !next.classList.contains('param-acordio-cap')) {
                const rows = next.querySelectorAll ? next.querySelectorAll('.param-row') : [];
                if (Array.from(rows).some(r => r.style.display !== 'none')) visible = true;
                next = next.nextElementSibling;
            }
            title.style.display = visible ? '' : 'none';
        });

        document.querySelectorAll('.param-acordio-cap').forEach(capcal => {
            const cos = capcal.nextElementSibling;
            if (!cos || !cos.classList.contains('param-acordio-cos')) return;
            const rows = cos.querySelectorAll('.param-row');
            const teMatch = Array.from(rows).some(r => r.style.display !== 'none');
            const nomCapcal = capcal.textContent.toLowerCase();
            const capcalMatch = nomCapcal.includes(q);

            if (q === '') {
                capcal.style.display = '';
                cos.style.display = 'none';
                const clauB = capcal.dataset.clauBase;
                if (clauB) estatAcordio[`acordio_${clauB}`] = false;
                capcal.querySelector('.param-acordio-fletxa').textContent = '▸';
            } else if (teMatch || capcalMatch) {
                capcal.style.display = '';
                cos.style.display = 'block';
                capcal.querySelector('.param-acordio-fletxa').textContent = '▾';
            } else {
                capcal.style.display = 'none';
                cos.style.display = 'none';
            }
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════
//  PUBLICAR DADES PER SKEW-T
// ═══════════════════════════════════════════════════════════════════════



window.addEventListener('tc:login', function(e) {
    console.log('[mapa.js] Usuari loguejat');
    if (totesLesHores && totesLesHores.length > 0) {
        construirGraellaHores();
        mostrarHora(curIdx);
    }
    // Amagar overlay si existeix
    if (typeof window.amagarOverlay === 'function') {
        window.amagarOverlay();
    }
});

window.addEventListener('tc:logout', function() {
    console.log('[mapa.js] Usuari desloguejat');
    if (totesLesHores && totesLesHores.length > 0) {
        construirGraellaHores();
        mostrarHora(0);
    }
    // Tornar a variable bàsica
    if (typeof seleccionarVariable === 'function') {
        seleccionarVariable('st', true);
    }
    // Amagar overlay si existeix
    if (typeof window.amagarOverlay === 'function') {
        window.amagarOverlay();
    }
});





(function() {
    const mapContainer = map.getContainer();
    
    // Crear un cursor personalitzat amb SVG - Només la creu
    const cursorSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <!-- Línia horitzontal de la creu amb ombra -->
            <line x1="6" y1="24" x2="42" y2="24" stroke="#030303" stroke-width="2" stroke-linecap="round"/>
            <line x1="6" y1="24" x2="42" y2="24" stroke="#faf8f8" stroke-width="1" stroke-linecap="round" opacity="0.3" transform="translate(1, 1)"/>
            
            <!-- Línia vertical de la creu amb ombra -->
            <line x1="24" y1="6" x2="24" y2="42" stroke="#030303" stroke-width="2" stroke-linecap="round"/>
            <line x1="24" y1="6" x2="24" y2="42" stroke="#faf8f8" stroke-width="1" stroke-linecap="round" opacity="0.3" transform="translate(1, 1)"/>
            
            <!-- Punt central brillant -->
            <circle cx="24" cy="24" r="3" fill="#070000"/>
            <circle cx="24" cy="24" r="1.5" fill="#fcf9f9"/>
        </svg>
    `;
    
    // Convertir SVG a data URI
    const encodedSVG = encodeURIComponent(cursorSVG);
    const cursorURL = `data:image/svg+xml,${encodedSVG}`;
    
    // Aplicar el cursor personalitzat
    mapContainer.style.cursor = `url('${cursorURL}') 24 24, crosshair`;
    
    // Forçar crosshair a TOTS els elements dins del mapa
    mapContainer.addEventListener('mouseover', function(e) {
        mapContainer.style.cursor = `url('${cursorURL}') 24 24, crosshair`;
    });
    
    mapContainer.addEventListener('mouseout', function(e) {
        if (!mapContainer.contains(e.relatedTarget)) {
            mapContainer.style.cursor = '';
        }
    });
    
    // Estil CSS per assegurar que TOT dins del mapa tingui el cursor personalitzat
    const style = document.createElement('style');
    style.textContent = `
        #map, #map * {
            cursor: url('${cursorURL}') 24 24, crosshair !important;
        }
        /* Excepcions: botons i enllaços dins del mapa */
        #map button, #map a, #map .leaflet-control, #map .leaflet-popup,
        #map button *, #map a * {
            cursor: pointer !important;
        }
        /* Efecte suau per quan el cursor està sobre el mapa */
        #map {
            transition: cursor 0.1s ease;
        }
    `;
    document.head.appendChild(style);
    
    console.log('✅ Cursor en creu (+) gran i bonica (sense cercles) activat!');
})();




// ═══════════════════════════════════════════════════════════════════════
//  FONS NEGRE NOMÉS FORA DE LA ZONA lon/lat DEFINIDA
// ═══════════════════════════════════════════════════════════════════════

(function() {
    // Zona on es veu el mapa base (dins) vs negre (fora)
    const ZONA_VISIBLE = {
        lon_min: 0.1,
        lon_max: 3.4,
        lat_min: 45,
        lat_max: 42.9
    };  

    function aplicarOverride() {
        if (!window._canvasLayer) {
            setTimeout(aplicarOverride, 200);
            return;
        }

        const layer = window._canvasLayer;
        const renderOriginal = layer._render;
        map.off('moveend zoomend', renderOriginal, layer);

        function renderAmbNegre() {
            if (!layer._data || !layer._map) return;
            if (layer._needsRedraw) layer._drawOffscreen();

            const m = layer._map;
            const size = m.getSize();
            const canvas = layer._canvas;
            canvas.width = size.x;
            canvas.height = size.y;
            const ctx = canvas.getContext('2d');
            L.DomUtil.setPosition(canvas, m.containerPointToLayerPoint([0, 0]));

            // ── 1. Calculem el rectangle en píxels de la ZONA_VISIBLE ──
            const nwZona = m.latLngToContainerPoint(L.latLng(ZONA_VISIBLE.lat_max, ZONA_VISIBLE.lon_min));
            const seZona = m.latLngToContainerPoint(L.latLng(ZONA_VISIBLE.lat_min, ZONA_VISIBLE.lon_max));
            const zx = nwZona.x, zy = nwZona.y, zw = seZona.x - nwZona.x, zh = seZona.y - nwZona.y;

            // ── 2. Netegem tot el canvas (transparent = es veu el mapa base) ──
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // ── 3. Pintem de negre NOMÉS fora del rectangle ZONA_VISIBLE ──
            ctx.fillStyle = '#000000';
            // Marge superior
            ctx.fillRect(0, 0, canvas.width, Math.max(0, zy));
            // Marge inferior
            ctx.fillRect(0, zy + zh, canvas.width, canvas.height - (zy + zh));
            // Marge esquerre
            ctx.fillRect(0, zy, Math.max(0, zx), zh);
            // Marge dret
            ctx.fillRect(zx + zw, zy, canvas.width - (zx + zw), zh);

            // ── 4. Dibuixem les dades AROME a sobre (rectangle petit) ──
            const coords = getCoordenadesPer(layer._data, variableActiva);
            const lats = coords.lat;
            const lons = coords.lon;
            const latMax = Math.max(lats[0], lats[lats.length - 1]);
            const latMin = Math.min(lats[0], lats[lats.length - 1]);
            const lonMin = Math.min(lons[0], lons[lons.length - 1]);
            const lonMax = Math.max(lons[0], lons[lons.length - 1]);

            const nw = m.latLngToContainerPoint(L.latLng(latMax, lonMin));
            const se = m.latLngToContainerPoint(L.latLng(latMin, lonMax));
            const x = nw.x, y = nw.y, w = se.x - nw.x, h = se.y - nw.y;

            if (layer._offscreen && w > 0 && h > 0) {
                ctx.save();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(layer._offscreen, x, y, w, h);
                ctx.restore();
            }

            layer._drawLegend(ctx, getPaleta(variableActiva));
            actualitzarCapcaleraParametre();
            redibuixarVent();
        }

        layer._render = renderAmbNegre;
        map.off('move', renderAmbNegre);
        map.on('move moveend zoomend', renderAmbNegre);

        layer._needsRedraw = true;
        renderAmbNegre();

        console.log('[Fons negre] Aplicat: negre fora de la zona -1.0/4.0/40.0/43.5');
    }

    aplicarOverride();
})();

inicialitzarGeojson();
inicialitzarCanvasVent();
crearPanellAjustos();

carregarTotsJSONs().then(() => {
    assegurarHoraCarregada(0, true).then(() => {
        construirPanellParametres();
    });
});

// 🔧 Estat global: indica si el panell de Skew-T està obert.
//    Quan és true, mostrarHora() carregarà sempre el 3D encara que
//    la variable activa del mapa sigui de superfície.
//    Es declara amb "window." explícitament perquè funcioni igual
//    des del HTML (index.html) i des de skewt.js.
window.sondeigObert = false;

window._currentParameter = variableActiva || 'st';
actualitzarBloqueigMapa();