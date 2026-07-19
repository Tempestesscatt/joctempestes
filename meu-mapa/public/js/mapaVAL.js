// ═══════════════════════════════════════════════════════════════════════
//  mapa.js — VERSIÓ FINAL COMPLETA I FUNCIONAL (BLOQUEIG CORREGIT)
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
    'pressure_msl', 'sp',
    'el_m', 'reflectivity_dbz', 'lightning','lcl_m','lfc_m',
    'geopotencial_500', 'temperatura_500','cape'
];

// ─── Configuració streamlines ──────────────────────────────────────
window.ventEnabled = true;
window.ventMode = 'streamlines';

const wCfg = {
    streamlineColor: 'black',
    streamlineOpacity: 0.7,
    streamlineWidth: 1.2,
};

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
}).setView([39.4699, -0.3763], 13); // Valencia ciudad

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
    {v:0,r:0,g:40,b:120,a:255},{v:100,r:0,g:80,b:200,a:255},{v:300,r:0,g:140,b:255,a:255},
    {v:500,r:0,g:200,b:255,a:255},{v:700,r:0,g:255,b:200,a:255},{v:900,r:120,g:255,b:80,a:255},
    {v:1100,r:220,g:255,b:0,a:255},{v:1300,r:255,g:255,b:0,a:255},{v:1500,r:255,g:200,b:0,a:255},
    {v:1800,r:255,g:140,b:0,a:255},{v:2100,r:255,g:60,b:0,a:255},{v:2400,r:255,g:0,b:0,a:255},
    {v:2800,r:255,g:0,b:140,a:255},{v:3200,r:255,g:0,b:220,a:255},{v:3800,r:200,g:0,b:255,a:255}
];

const STOPS_CIN = [
    {v:-500,r:0,g:0,b:180},{v:-200,r:0,g:80,b:255},{v:-100,r:0,g:180,b:255},
    {v:-50,r:100,g:220,b:255},{v:0,r:200,g:200,b:200},{v:50,r:255,g:220,b:100},
    {v:100,r:255,g:150,b:0},{v:200,r:200,g:50,b:0},{v:500,r:150,g:0,b:0}
];

const STOPS_NUVOLS = [
    {v:0,r:0,g:0,b:0,a:0},{v:10,r:180,g:180,b:200},{v:30,r:150,g:160,b:200},
    {v:50,r:120,g:140,b:200},{v:70,r:100,g:120,b:200},{v:90,r:80,g:100,b:200},
    {v:100,r:60,g:80,b:200}
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
    {v:-5,r:0,g:0,b:200},{v:-2,r:0,g:150,b:255},{v:-0.5,r:150,g:220,b:255},
    {v:0,r:230,g:230,b:230},{v:0.5,r:255,g:220,b:150},{v:2,r:255,g:120,b:0},
    {v:5,r:200,g:0,b:0}
];

const STOPS_VORT_POT = [
    {v:-10,r:0,g:0,b:200},{v:-3,r:0,g:150,b:255},{v:0,r:220,g:220,b:220},
    {v:3,r:255,g:180,b:0},{v:10,r:200,g:0,b:0}
];

const STOPS_DBZ = [
    {v:0,r:0,g:0,b:0,a:0},{v:5,r:0,g:236,b:236,a:150},{v:10,r:1,g:160,b:246,a:200},
    {v:15,r:0,g:0,b:246,a:210},{v:20,r:0,g:236,b:0,a:220},{v:25,r:0,g:180,b:0,a:220},
    {v:30,r:0,g:100,b:0,a:220},{v:35,r:255,g:144,b:0,a:230},{v:40,r:255,g:0,b:0,a:240},
    {v:45,r:192,g:0,b:0,a:240},{v:50,r:120,g:0,b:0,a:240},{v:55,r:255,g:0,b:255,a:250},
    {v:60,r:160,g:32,b:240,a:250},{v:65,r:80,g:0,b:130,a:255},{v:70,r:200,g:200,b:200,a:255},
    {v:75,r:255,g:255,b:255,a:255}
];

const STOPS_LLAMPS = [
    {v:0,r:0,g:0,b:0,a:0},{v:0.1,r:80,g:80,b:120},{v:0.5,r:100,g:100,b:200},
    {v:1,r:100,g:150,b:255},{v:2,r:150,g:200,b:255},{v:5,r:255,g:255,b:100},
    {v:10,r:255,g:200,b:0},{v:20,r:255,g:100,b:0},{v:50,r:255,g:0,b:0},
    {v:100,r:200,g:0,b:200}
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

const STOPS_SRH = [
    // ── NEGATIUS: Mirall dels positius (blaus freds) ──
    {v:-1500, r:0,   g:0,   b:40},     // 🔵 Blau quasi negre
    {v:-1000, r:0,   g:0,   b:120},    // 🔵 Blau molt fosc
    {v:-800,  r:20,  g:0,   b:180},    // 🔵 Blau fosc
    {v:-600,  r:60,  g:0,   b:200},    // 💜 Violeta blavós
    {v:-500,  r:100, g:0,   b:140},    // 🟣 Porpra blavós
    {v:-400,  r:140, g:0,   b:80},     // 🟣 Magenta blavós
    {v:-350,  r:170, g:0,   b:30},     // 🔴 Carmesí blavós
    {v:-300,  r:200, g:0,   b:0},      // 🔴 Vermell fosc blavós
    {v:-275,  r:230, g:0,   b:0},      // 🔴 Vermell intens blavós
    {v:-250,  r:255, g:30,  b:0},      // 🔴 Vermell blavós
    {v:-225,  r:255, g:80,  b:0},      // 🟠 Taronja fosc blavós
    {v:-200,  r:255, g:130, b:0},      // 🟠 Taronja blavós
    {v:-175,  r:255, g:180, b:0},      // 🟠 Taronja clar blavós
    {v:-150,  r:255, g:220, b:0},      // 🟠 Groc-taronja blavós
    {v:-125,  r:255, g:255, b:0},      // 🟡 Groc blavós
    {v:-100,  r:200, g:255, b:0},      // 💚 Verd groguenc blavós
    {v:-75,   r:0,   g:255, b:0},      // 🟢 Verd blavós
    {v:-50,   r:100, g:255, b:100},    // 🟢 Verd clar blavós
    {v:-25,   r:180, g:255, b:180},    // 🟢 Verd menta blavós
    
    // ── ZERO: Punt neutre ──
    {v:0,    r:255, g:255, b:255},     // ⬜ Blanc pur
    
    // ── POSITIUS: Colors càlids ──
    {v:25,   r:180, g:255, b:180},     // 🟢 Verd menta
    {v:50,   r:100, g:255, b:100},     // 🟢 Verd clar
    {v:75,   r:0,   g:255, b:0},       // 🟢 Verd pur
    {v:100,  r:200, g:255, b:0},       // 💚 Verd groguenc
    {v:125,  r:255, g:255, b:0},       // 🟡 Groc pur
    {v:150,  r:255, g:220, b:0},       // 🟠 Groc-taronja
    {v:175,  r:255, g:180, b:0},       // 🟠 Taronja clar
    {v:200,  r:255, g:130, b:0},       // 🟠 Taronja
    {v:225,  r:255, g:80,  b:0},       // 🟠 Taronja fosc
    {v:250,  r:255, g:30,  b:0},       // 🔴 Vermell
    {v:275,  r:230, g:0,   b:0},       // 🔴 Vermell intens
    {v:300,  r:200, g:0,   b:0},       // 🔴 Vermell fosc
    {v:350,  r:170, g:0,   b:30},      // 🔴 Carmesí
    {v:400,  r:140, g:0,   b:80},      // 🟣 Magenta
    {v:500,  r:100, g:0,   b:140},     // 🟣 Porpra
    {v:600,  r:60,  g:0,   b:200},     // 💜 Violeta
    {v:800,  r:20,  g:0,   b:180},     // 🔵 Blau fosc
    {v:1000, r:0,   g:0,   b:120},     // 🔵 Blau molt fosc
    {v:1500, r:0,   g:0,   b:40},      // 🔵 Blau quasi negre
];

// SHEAR: Un color DIFERENT cada 2 m/s - Contrast MÀXIM
const STOPS_SHEAR = [
    {v:0,   r:0,   g:0,   b:255},    // 🔵 Blau pur
    {v:2,   r:0,   g:200, b:255},    // 🩵 Cian clar
    {v:4,   r:0,   g:255, b:200},    // 🩵 Turquesa
    {v:6,   r:0,   g:255, b:100},    // 💚 Verd menta
    {v:8,   r:0,   g:255, b:0},      // 🟢 Verd pur
    {v:10,  r:150, g:255, b:0},      // 💚 Verd groguenc
    {v:12,  r:220, g:255, b:0},      // 💛 Groc verdós
    {v:14,  r:255, g:255, b:0},      // 🟡 Groc pur
    {v:16,  r:255, g:220, b:0},      // 🟠 Groc intens
    {v:18,  r:255, g:180, b:0},      // 🟠 Taronja clar
    {v:20,  r:255, g:140, b:0},      // 🟠 Taronja
    {v:22,  r:255, g:90,  b:0},      // 🟠 Taronja fosc
    {v:24,  r:255, g:40,  b:0},      // 🔴 Vermell ataronjat
    {v:26,  r:255, g:0,   b:0},      // 🔴 Vermell pur
    {v:28,  r:230, g:0,   b:30},     // 🔴 Carmesí
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
//  PALETES MAP
// ═══════════════════════════════════════════════════════════════════════

const PALETES = {
    st:             {titol:'Temperatura 2m',           unitat:'°C',        stops:STOPS_TEMP},
    sd:             {titol:'Punt rosada 2m',           unitat:'°C',        stops:STOPS_TEMP},
    srh:            {titol:'Humitat 2m',               unitat:'%',         stops:STOPS_HUMITAT},
    temp_min2m:     {titol:'Temp. mín. 2m',            unitat:'°C',        stops:STOPS_TEMP},
    temp_max2m:     {titol:'Temp. màx. 2m',            unitat:'°C',        stops:STOPS_TEMP},
    su:             {titol:'Vent U 10m',               unitat:'m/s',       stops:STOPS_VENT_UV},
    sv:             {titol:'Vent V 10m',               unitat:'m/s',       stops:STOPS_VENT_UV},
    wind_speed_10m: {titol:'Vent 10m',                 unitat:'km/h',      stops:STOPS_RATXA},
    sp:             {titol:'Pressió superf.',          unitat:'hPa',       stops:STOPS_PRESSIO},
    pressure_msl:   {titol:'Pressió MSL',              unitat:'hPa',       stops:STOPS_PRESSIO},
    cape:           {titol:'CAPE',                     unitat:'J/kg',      stops:STOPS_CAPE},
    cin:            {titol:'CIN',                      unitat:'J/kg',      stops:STOPS_CIN},
    spbl:           {titol:'Capa límit',               unitat:'m',         stops:STOPS_ALTURA_CL},
    wind_gust:      {titol:'Ratxa 10m',                unitat:'km/h',      stops:STOPS_RATXA},
    low_cloud_cover:    {titol:'Nuvols baixos',        unitat:'%',         stops:STOPS_NUVOLS},
    medium_cloud_cover: {titol:'Nuvols mitjans',       unitat:'%',         stops:STOPS_NUVOLS},
    high_cloud_cover:   {titol:'Nuvols alts',          unitat:'%',         stops:STOPS_NUVOLS},
    rain:           {titol:'Pluja 1h (WCS)',           unitat:'mm',        stops:STOPS_PRECIP},
    rain_1h:        {titol:'Pluja acum. 1h',           unitat:'mm',        stops:STOPS_PRECIP},
    snow:           {titol:'Neu 1h (WCS)',             unitat:'mm',        stops:STOPS_PRECIP},
    graupel:        {titol:'Calamarsa 1h (WCS)',       unitat:'mm',        stops:STOPS_PRECIP},
    tp:             {titol:'Precip. total acum.',      unitat:'mm',        stops:STOPS_PRECIP},
    tgrp:           {titol:'Calamarsa/graupel acum.',  unitat:'mm',        stops:STOPS_PRECIP},
    tsnowp:         {titol:'Neu total acum.',          unitat:'mm',        stops:STOPS_PRECIP},
    precip_water:   {titol:'Aigua precipitable',       unitat:'mm',        stops:STOPS_HUMITAT},
    reflectivity_dbz:{titol:'Reflectivitat',           unitat:'dBZ',       stops:STOPS_DBZ},
    lightning:      {titol:'Llamps acum. 1h',          unitat:'imp./m²',   stops:STOPS_LLAMPS},
    t:              {titol:'Temperatura',              unitat:'°C',        stops:STOPS_TEMP_ALT},
    u:              {titol:'Vent U',                   unitat:'m/s',       stops:STOPS_VENT_UV},
    v:              {titol:'Vent V',                   unitat:'m/s',       stops:STOPS_VENT_UV},
    wind_speed:     {titol:'Vent',                     unitat:'km/h',      stops:STOPS_RATXA},
    r:              {titol:'Humitat',                  unitat:'%',         stops:STOPS_HUMITAT},
    w:              {titol:'Vel. vertical',            unitat:'Pa/s',      stops:STOPS_VEL_VERT},
    dpt:            {titol:'Punt rosada',              unitat:'°C',        stops:STOPS_TEMP_ALT},
    pv:             {titol:'Vort. potencial',          unitat:'PVU',       stops:STOPS_VORT_POT},
    lcl_m:          {titol:'LCL (alçada)',             unitat:'m',         stops:STOPS_ALTURA_CL},
    lfc_m:          {titol:'LFC (alçada)',             unitat:'m',         stops:STOPS_ALTURA_CL},
    lifted_index:   {titol:'Lifted Index',             unitat:'°C',        stops:STOPS_LI},
    el_m:           {titol:'Equilibrium Level',        unitat:'m',         stops:STOPS_ALTURA_CL},
        geopotencial_500: {titol:'Geopotencial 500hPa',    unitat:'dam',      stops:STOPS_GEO500},
    temperatura_500:  {titol:'Temperatura 500hPa',     unitat:'°C',       stops:STOPS_T500},
    srh_01:           {titol:'SRH 0-1km',              unitat:'m²/s²',    stops:STOPS_SRH},
    srh_03:           {titol:'SRH 0-3km',              unitat:'m²/s²',    stops:STOPS_SRH},
    shear_03:         {titol:'Shear 0-3km',            unitat:'m/s',      stops:STOPS_SHEAR},
    shear_06:         {titol:'Shear 0-6km',            unitat:'m/s',      stops:STOPS_SHEAR},
};

// GRUP PRINCIPAL (apareix primer, sense títol, destacat) — TOTES LLIURES SENSE LOGIN
const GRUP_PRINCIPAL = ['st', 'sd', 'srh', 'temp_min2m', 'temp_max2m'];

const GRUPS_SIMPLES = {
    'Vent superfície': ['wind_speed_10m', 'wind_gust'],
    'Pressió': ['pressure_msl', 'sp'],
    'Precipitació': ['rain', 'tp', 'tgrp', 'tsnowp'],
    'Núvols': ['low_cloud_cover', 'medium_cloud_cover', 'high_cloud_cover'],
    'Inestabilitat': ['cape', 'spbl', 'lcl_m', 'lfc_m', 'lifted_index', 'el_m'],
    'Reflectivitat i llamps': ['reflectivity_dbz', 'lightning'],
    'Humitat': ['precip_water'],'500 hPa': ['geopotencial_500', 'temperatura_500'],
'Severitat': ['srh_01', 'srh_03', 'shear_03', 'shear_06'],
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
    'su', 'sv',
    'u', 'v',
    'sh2',
    'geo_h',
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
    if (PALETES[c]) return c;  // ← Ja funciona perquè srh_01 és a PALETES!
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
        'temp_min2m','temp_max2m'
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
    if (!totesLesHores[curIdx]) return false;
    const data = totesLesHores[curIdx].data;
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

    const data = totesLesHores[curIdx].data;
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

        const varInfo = this._data.variables[variableActiva];
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
    { id: 'valencia', nom: 'Comunitat Valenciana', arxiu: 'valencia.geojson', color: '#000000', gruix: 1.2 },
    { id: 'alicant', nom: 'Alacant', arxiu: 'alicant.geojson', color: '#000000', gruix: 1.2 },
    { id: 'castellon', nom: 'Castelló', arxiu: 'castellon.geojson', color: '#000000', gruix: 1.2 },
];

const capaInstancies = {};

function estilCapa(def) {
    return { pane: 'paneGeojson', color: def.color, weight: def.gruix, opacity: 1, fill: false };
}

async function carregarCapaGeojson(def) {
    try {
        const r = await fetch(`${DADES_PATH}/${def.arxiu}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const geojson = await r.json();
        const capa = L.geoJSON(geojson, { pane: 'paneGeojson', style: () => estilCapa(def) });
        capaInstancies[def.id] = capa;
        capa.addTo(map);
    } catch (err) {
        console.warn('[GeoJSON] ' + def.nom + ': ' + err.message);
    }
}

async function inicialitzarGeojson() {
    for (const def of GEOJSON_CAPES) {
        await carregarCapaGeojson(def);
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  CLICK AL MAPA
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
    const varInfo = data.variables[variableActiva];
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
    const vt = v===null || isNaN(v) ? '—' :
        (Math.abs(v)>=10000||(Math.abs(v)<0.001&&v!==0)) ? v.toExponential(2) :
        Number.isInteger(v) ? v.toString() : v.toFixed(1);

    const html = `
        <div class="popup-meteo">
            <div class="popup-meteo-header">${pal.titol}</div>
            <div class="popup-meteo-value">
                <span class="popup-meteo-number">${vt}</span>
                <span class="popup-meteo-unit">${pal.unitat}</span>
            </div>
            <div class="popup-meteo-coords">
                ${lat.toFixed(4)}°N &nbsp;·&nbsp; ${lng.toFixed(4)}°E
            </div>
        </div>
    `;

    if (marcadorClic) map.removeLayer(marcadorClic);
    marcadorClic = L.popup({
        closeButton: true,
        className: 'popup-clic',
        offset: [0, -8]
    }).setLatLng(e.latlng).setContent(html).openOn(map);
});

// ═══════════════════════════════════════════════════════════════════════
//  CÀRREGA DE JSONs
// ═══════════════════════════════════════════════════════════════════════

let totesLesHores = [];
let curIdx = 0;

async function carregarUnStep(i) {
    const base = 'webdata_val/';
    const p = String(i).padStart(2,'0');
    try {
        const [sfc, td] = await Promise.all([
            fetch(base+'sfc_'+p+'.json').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(base+'3d_'+p+'.json').then(r => r.ok ? r.json() : null).catch(() => null)
        ]);
        if (!sfc && !td) return null;
        const base_d = sfc || td;
        const variables = {};
        if (sfc) Object.assign(variables, sfc.variables);
        if (td) Object.assign(variables, td.variables);
        if (Object.keys(variables).length === 0) return null;
        
        calcularVelocitatVent(variables);
        
        const data = {
            ...base_d, variables,
            coordenadas: sfc ? sfc.coordenadas : td.coordenadas,
            coordenadas_3d: td ? td.coordenadas : null,
        };
        return {step: data.step, dateObj: new Date(data.hora_utc + 'Z'), data};
    } catch (e) {
        return null;
    }
}

function afegirHoraCarregada(item) {
    if (!item) return;
    if (totesLesHores.some(h => h.data.step === item.step)) return;
    let idxInsercio = totesLesHores.findIndex(h => h.dateObj > item.dateObj);
    if (idxInsercio === -1) idxInsercio = totesLesHores.length;
    totesLesHores.splice(idxInsercio, 0, item);
    construirGraellaHores();
    if (totesLesHores.length === 1) {
        construirPanellParametres();
        mostrarHora(0);
    } else if (idxInsercio <= curIdx) {
        curIdx++;
    }
}

async function carregarTotsJSONs() {
    const TIEMPO_INICIO = Date.now();
    const TIEMPO_MINIMO = 5000; // 5 segons
    
    let carregats = 0;
    const total = MAX_STEPS;
    
    // Inicialitzar barra
    actualitzarBarraProgress(0, total);
    
    // ⬅️ Crear una promesa que es resol als 5 segons exactes
    const esperaMinima = new Promise(resolve => {
        setTimeout(resolve, TIEMPO_MINIMO);
    });
    
    let primerCarregat = false;
    for (let i = 0; i < MAX_STEPS && !primerCarregat; i++) {
        const item = await carregarUnStep(i);
        if (item) {
            afegirHoraCarregada(item);
            primerCarregat = true;
            carregats++;
            actualitzarBarraProgress(carregats, total);
        }
    }
    
    if (!primerCarregat) {
        return;
    }
    
    const promeses = [];
    for (let i = 0; i < MAX_STEPS; i++) {
        if (totesLesHores.some(h => h.data.step === i)) continue;
        promeses.push(
            carregarUnStep(i).then(item => {
                if (item) {
                    afegirHoraCarregada(item);
                    carregats++;
                    actualitzarBarraProgress(carregats, total);
                }
            })
        );
    }
    
    // ⬅️ Esperar TOTES les càrregues I els 5 segons mínims
    await Promise.all([...promeses, esperaMinima]);
    
    construirPanellParametres();
    
    if (totesLesHores.length > 0) {
        mostrarHora(0);
    }
    
    // ⬅️ Petita pausa per veure el 100%
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // ⬅️ Amagar loading
    const loadingOverlay = document.getElementById('loading_overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
    
    console.log('[Loading] Temps total: ' + ((Date.now() - TIEMPO_INICIO) / 1000).toFixed(1) + 's');
}


function actualitzarBarraProgress(carregats, total) {
    const pct = Math.round((carregats / total) * 100);
    const barra = document.getElementById('loading_progress_bar');
    const text = document.getElementById('loading_progress_text');
    
    if (barra) {
        barra.style.width = pct + '%';
    }
    if (text) {
        text.textContent = carregats + ' / ' + total + ' hores (' + pct + '%)';
    }
}

function mostrarHora(idx) {
    if (idx < 0 || idx >= totesLesHores.length) return;
    if (!totesLesHores[idx]) return;
    
    const user = window._firebaseUser || null;
    // Hores lliures cada 3h (0, 3, 6, 9...)
    const horaLliure = (idx % 3 === 0);
    const bloquejat = !user && !horaLliure;
    
    if (bloquejat) {
        if (typeof loginWithGoogle === 'function') {
            loginWithGoogle();
        }
        return;
    }
    
    curIdx = idx;
    window.skewtHourIndex = idx;
    
    if (canvasLayer) {
        canvasLayer.setData(totesLesHores[idx].data);
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
                active.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            }
        }, 100);
    }
    
    // Actualitzar overlay
    const d = totesLesHores[idx].dateObj;
    const ds = d.toLocaleDateString('ca-ES', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
    });
    const ls = String(d.getHours()).padStart(2, '0') + ':00';
    const us = String(d.getUTCHours()).padStart(2, '0') + 'Z';
    
    const overlayDate = document.getElementById('overlay-date');
    const overlayLocal = document.getElementById('overlay-local');
    const overlayUtc = document.getElementById('overlay-utc');
    const fhValidTime = document.getElementById('fh_validtime');
    
    if (overlayDate) overlayDate.textContent = ds.toUpperCase();
    if (overlayLocal) overlayLocal.textContent = ls;
    if (overlayUtc) overlayUtc.textContent = us;
    if (fhValidTime) fhValidTime.textContent = ds + ' · ' + ls + ' local / ' + us;
    
    if (window.ventEnabled && typeof redibuixarVent === 'function') {
        redibuixarVent();
    }
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

    const totesVariables = new Set();
    const infoVariables = {};
    totesLesHores.forEach(hora => {
        if (hora.data && hora.data.variables) {
            Object.keys(hora.data.variables).forEach(clau => {
                totesVariables.add(clau);
                if (!infoVariables[clau]) infoVariables[clau] = hora.data.variables[clau];
            });
        }
    });

    const clausUsades = new Set();

    // GRUP PRINCIPAL
    const principals = [];
    GRUP_PRINCIPAL.forEach(clauB => {
        if (totesVariables.has(clauB) && !esVariableAmagada(clauB)) {
            principals.push(clauB);
            clausUsades.add(clauB);
        }
    });
    
    if (principals.length > 0) {
        principals.forEach(clau => {
            const info = infoVariables[clau];
            if (!info) return;
            const row = document.createElement('div');
            row.className = 'param-row param-row-principal';
            row.dataset.clau = clau;
            row.innerHTML = `<div class="param-link">${info.nombre} <span class="param-unit">(${info.unidades})</span></div>`;
            row.onclick = () => seleccionarVariable(clau);
            cont.appendChild(row);
        });
        
        const sep = document.createElement('div');
        sep.className = 'param-separador';
        sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:6px 12px;';
        cont.appendChild(sep);
    }

    // GRUPS SIMPLES
    Object.entries(GRUPS_SIMPLES).forEach(([nomGrup, clausGrup]) => {
        const entrades = [];

        clausGrup.forEach(clauB => {
            if (totesVariables.has(clauB) && !esVariableAmagada(clauB)) {
                entrades.push(clauB);
            }
        });

        totesVariables.forEach(clau => {
            if (entrades.includes(clau) || clausUsades.has(clau)) return;
            for (const clauB of clausGrup) {
                if (clau.startsWith(clauB + '_')) {
                    entrades.push(clau);
                    break;
                }
            }
        });

        entrades.sort((a, b) => a.localeCompare(b));
        if (entrades.length === 0) return;

        const h3 = document.createElement('h3');
        h3.className = 'param-group-title';
        h3.textContent = nomGrup + ' (' + entrades.length + ')';
        cont.appendChild(h3);

        entrades.forEach(clau => {
            const info = infoVariables[clau];
            if (!info) return;
            clausUsades.add(clau);
            const row = document.createElement('div');
            row.className = 'param-row';
            row.dataset.clau = clau;
            row.innerHTML = `<div class="param-link">${info.nombre} <span class="param-unit">(${info.unidades})</span></div>`;
            row.onclick = () => seleccionarVariable(clau);
            cont.appendChild(row);
        });
    });

    // GRUPS ACORDIO
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
            capcal.innerHTML = `<span class="param-acordio-fletxa">${estatAcordio[clauEstat] ? '▾' : '▸'}</span> ${nomBase} <span class="param-unit">(${nivellsOrdenats.length} nivells)</span>`;
            cont.appendChild(capcal);

            const cosContenidor = document.createElement('div');
            cosContenidor.className = 'param-acordio-cos';
            cosContenidor.style.display = estatAcordio[clauEstat] ? 'block' : 'none';

            nivellsOrdenats.forEach(clau => {
                const info = infoVariables[clau];
                if (!info) return;
                clausUsades.add(clau);
                const row = document.createElement('div');
                row.className = 'param-row param-row-nivell';
                row.dataset.clau = clau;
                row.innerHTML = `<div class="param-link">${info.nombre} <span class="param-unit">(${info.unidades})</span></div>`;
                row.onclick = () => seleccionarVariable(clau);
                cosContenidor.appendChild(row);
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

    // ALTRES
    const sobrants = [...totesVariables].filter(c => !clausUsades.has(c) && !esVariableAmagada(c));
    if (sobrants.length > 0) {
        const h3 = document.createElement('h3');
        h3.className = 'param-group-title';
        h3.textContent = 'Altres (' + sobrants.length + ')';
        cont.appendChild(h3);
        sobrants.sort((a, b) => a.localeCompare(b)).forEach(clau => {
            const info = infoVariables[clau];
            if (!info) return;
            const row = document.createElement('div');
            row.className = 'param-row';
            row.dataset.clau = clau;
            row.innerHTML = `<div class="param-link">${info.nombre} <span class="param-unit">(${info.unidades})</span></div>`;
            row.onclick = () => seleccionarVariable(clau);
            cont.appendChild(row);
        });
    }

    seleccionarVariable('st', true);
}

function seleccionarVariable(clau, silenciós) {
    if (variableActiva === clau && !silenciós) return;

    // ── COMPROVACIÓ DE BLOQUEIG ABANS DE RES ──
    // Si no hi ha usuari i el paràmetre està bloquejat, NO canviem de variable
    // ni redibuixem res. Només mostrem l'overlay.
    const user = window._firebaseUser || null;
    if (!user && isParamBloquejat(clau)) {
        window._currentParameter = clau;
        actualitzarBloqueigMapa();
        return;
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

    canvasLayer._needsRedraw = true;
    canvasLayer._render();
    if (!silenciós) {
        const actiu = document.querySelector('.param-row.param-selected');
        if (actiu) actiu.scrollIntoView({block:'nearest'});
    }
    
    actualitzarBloqueigMapa();
}

function actualitzarCapcaleraParametre() {
    const pal = getPaleta(variableActiva);
    const label = document.getElementById('parameter_menu_link');
    if (label) label.textContent = pal.titol + ' (' + pal.unitat + ')';
}

// ═══════════════════════════════════════════════════════════════════════
//  BLOQUEIG DE VARIABLES — LÒGICA SIMPLE I EXPLÍCITA
// ═══════════════════════════════════════════════════════════════════════

// Variables que SEMPRE són lliures sense login (bàsiques)
const PARAMETRES_LLIURES = ['st', 'sd', 'srh', 'temp_min2m', 'temp_max2m'];

// Qualsevol altra variable requereix login. Simple i explícit: no calen
// llistes negres ni "includes" ambigus — tot el que no és lliure, bloqueja.
function isParamBloquejat(paramName) {
    if (!paramName) return false;
    const p = paramName.toLowerCase().trim();
    const base = clauBase(p);

    if (PARAMETRES_LLIURES.includes(p) || PARAMETRES_LLIURES.includes(base)) {
        return false;
    }

    return true;
}

// Aquest botó NOMÉS tanca l'avís visualment. NO desbloqueja cap variable.
// El bloqueig real es torna a avaluar cada cop que se selecciona una
// variable o una hora, així que amagar l'overlay un moment no dona accés
// permanent a res.
window.tancarBloqueig = function() {
    const overlay = document.getElementById('mapLockOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        document.getElementById('map').style.opacity = '1';
    }
    console.log('[Bloqueig] Avís tancat (el bloqueig de variables segueix actiu)');
};

function actualitzarBloqueigMapa() {
    const overlay = document.getElementById('mapLockOverlay');
    if (!overlay) return;

    const user = window._firebaseUser;
    const paramActual = window._currentParameter || variableActiva || 'st';

    if (user) {
        overlay.classList.remove('visible');
        document.getElementById('map').style.opacity = '1';
        return;
    }

    const bloquejat = isParamBloquejat(paramActual);

    if (bloquejat) {
        overlay.classList.add('visible');
        document.getElementById('map').style.opacity = '0.25';
        
        overlay.innerHTML = `
            <div class="lock-content">
                <div class="lock-icon-wrapper">
                    <i class="fas fa-cloud-bolt"></i>
                </div>
                <h3><i class="fas fa-cloud-showers-heavy" style="margin-right:8px; color:#FFD700;"></i> Accés restringit</h3>
                <p>Aquesta variable requereix <strong>iniciar sessió</strong> per visualitzar-la.</p>
                <div class="lock-features">
                    <span><i class="fas fa-check-circle"></i> Temperatura 2m</span>
                    <span><i class="fas fa-check-circle"></i> Temp. mín/màx 2m</span>
                    <span><i class="fas fa-check-circle"></i> Punt rosada / Humitat 2m</span>
                    <span><i class="fas fa-lock"></i> Totes les altres variables</span>
                </div>
                <div class="lock-buttons">
                    <button class="btn-unlock" onclick="loginWithGoogle()">
                        <i class="fab fa-google"></i> Iniciar sessió
                    </button>
                    <button class="btn-continue" onclick="window.tancarBloqueig()">
                        <i class="fas fa-arrow-right"></i> Tancar avís
                    </button>
                </div>
                <p class="lock-sub">Registra't gratuïtament per accedir a totes les variables</p>
            </div>
        `;
    } else {
        overlay.classList.remove('visible');
        document.getElementById('map').style.opacity = '1';
    }
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

setTimeout(function() {
    if (totesLesHores && totesLesHores.length > 0) {
        window.totesLesHores = totesLesHores;
        document.dispatchEvent(new CustomEvent('mapa-dades-llestes', {
            detail: { totesLesHores: totesLesHores }
        }));
    }
}, 1000);

// ─── ESDEVENIMENTS DE LOGIN/LOGOUT ──────────────────────────────────

window.addEventListener('tc:login', function(e) {
    console.log('[mapa.js] Usuari loguejat');
    if (totesLesHores && totesLesHores.length > 0) {
        construirGraellaHores();
        mostrarHora(curIdx);
    }
    actualitzarBloqueigMapa();
});

window.addEventListener('tc:logout', function() {
    console.log('[mapa.js] Usuari desloguejat');
    if (totesLesHores && totesLesHores.length > 0) {
        construirGraellaHores();
        mostrarHora(0);
    }
    // Al desloguejar, tornem a la variable bàsica per si estava en una de bloquejada
    if (isParamBloquejat(variableActiva)) {
        seleccionarVariable('st', true);
        document.querySelectorAll('.param-row').forEach(el => {
            el.classList.toggle('param-selected', el.dataset.clau === 'st');
        });
    }
    actualitzarBloqueigMapa();
});

// ═══════════════════════════════════════════════════════════════════════
//  INICI
// ═══════════════════════════════════════════════════════════════════════

inicialitzarGeojson();
inicialitzarCanvasVent();
crearPanellAjustos();
carregarTotsJSONs();

// Assegurar que el bloqueig s'aplica després de carregar
setTimeout(() => {
    window._currentParameter = variableActiva || 'st';
    actualitzarBloqueigMapa();
}, 2000);