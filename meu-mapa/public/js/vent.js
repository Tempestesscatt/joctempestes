// ═══════════════════════════════════════════════════════════════════════
// mapa.js — VERSIÓ FLUIDA (renderitza graella nativa i l'estira)
// Adaptat per a TOTES les variables AROME (2D + 3D per nivells)
// Interfície: estil Pivotal Weather
// ═══════════════════════════════════════════════════════════════════════

const REGION = {
    name: "Catalunya",
    lon_min: 0.10,
    lon_max: 3.60,
    lat_min: 40.40,
    lat_max: 42.95
};

// ─── MAPA ─────────────────────────────────────────────────────────────
const map = L.map('map', {
    crs: L.CRS.EPSG3857,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    maxBounds: [[36.0, -10.0], [70.0, 30.0]],
    maxBoundsViscosity: 1.0,
    minZoom: 6,
    maxZoom: 14,
}).setView([41.82, 1.55], 8);

window._mapInstance = map;

// ── Panes dedicats: dades (canvas) per sota, línies GeoJSON per sobre ──
map.createPane('paneDades');
map.getPane('paneDades').style.zIndex = 400;

map.createPane('paneLimits');
map.getPane('paneLimits').style.zIndex = 650;
map.getPane('paneLimits').style.pointerEvents = 'none';

// ── Pane per partícules de vent (entre dades i límits) ──
map.createPane('paneVent');
map.getPane('paneVent').style.zIndex = 500;
map.getPane('paneVent').style.pointerEvents = 'none';

// ─── Mapes de fons disponibles (ICGC) ────────────────────────────────
const MAPES_FONS = {
    osm: {
        nom: 'Complet',
        capa: L.tileLayer('https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/estandard/MON3857NW/{z}/{x}/{y}.png', {
            attribution: '&copy; ICGC', maxZoom: 19, maxNativeZoom: 19, className: 'icgc-base'
        })
    },
    cartoLight: {
        nom: 'Satèl·lit (Ortofoto)',
        capa: L.tileLayer('https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/orto/MON3857NW/{z}/{x}/{y}.png', {
            attribution: '&copy; ICGC', maxZoom: 19, maxNativeZoom: 19, className: 'icgc-base'
        })
    },
    cartoDark: {
        nom: 'Ortofoto híbrida',
        capa: L.tileLayer('https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/orto-hibrida/MON3857NW/{z}/{x}/{y}.png', {
            attribution: '&copy; ICGC', maxZoom: 19, className: 'icgc-base'
        })
    },
    openTopo: {
        nom: 'Simplificat',
        capa: L.tileLayer('https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/simplificat/MON3857NW/{z}/{x}/{y}.png', {
            attribution: '&copy; ICGC', maxZoom: 19, className: 'icgc-base'
        })
    },
    humanitarian: {
        nom: 'Topogràfic',
        capa: L.tileLayer('https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/topografic/MON3857NW/{z}/{x}/{y}.png', {
            attribution: '&copy; ICGC', maxZoom: 19, className: 'icgc-base'
        })
    }
};

let mapaFonsActiu = 'humanitarian';
let capaFonsActiva = null;

function activarMapaFons(clau) {
    if (capaFonsActiva) map.removeLayer(capaFonsActiva);
    const entrada = MAPES_FONS[clau];
    if (!entrada) return;
    capaFonsActiva = entrada.capa;
    capaFonsActiva.addTo(map);
    capaFonsActiva.setZIndex(1);
    mapaFonsActiu = clau;
}

activarMapaFons(mapaFonsActiu);

// ═══════════════════════════════════════════════════════════════════════
//  PALETES BASE (reutilitzades per família física de variable)
// ═══════════════════════════════════════════════════════════════════════

const STOPS_TEMP = [
    {v:-24,r:45,g:0,b:75},{v:-15,r:65,g:0,b:115},{v:-10,r:0,g:0,b:255},
    {v:-5,r:0,g:135,b:255},{v:0,r:0,g:235,b:255},{v:2,r:0,g:255,b:150},
    {v:5,r:0,g:200,b:0},{v:8,r:120,g:255,b:0},{v:11,r:255,g:255,b:0},
    {v:14,r:255,g:235,b:100},{v:17,r:255,g:200,b:0},{v:20,r:255,g:140,b:0},
    {v:23,r:255,g:70,b:0},{v:26,r:255,g:0,b:0},{v:29,r:180,g:0,b:0},
    {v:32,r:90,g:0,b:0},{v:35,r:150,g:0,b:150},{v:38,r:255,g:0,b:255}
];

const STOPS_TEMP_K = STOPS_TEMP.map(s => ({...s, v: s.v + 273.15}));

const STOPS_TEMP_ALT = [
    {v:-70,r:45,g:0,b:75},{v:-55,r:65,g:0,b:115},{v:-40,r:0,g:0,b:255},
    {v:-30,r:0,g:135,b:255},{v:-20,r:0,g:235,b:255},{v:-10,r:0,g:255,b:150},
    {v:0,r:0,g:200,b:0},{v:5,r:120,g:255,b:0},{v:10,r:255,g:255,b:0},
    {v:15,r:255,g:200,b:0},{v:20,r:255,g:140,b:0},{v:25,r:255,g:70,b:0},
    {v:30,r:255,g:0,b:0},{v:38,r:150,g:0,b:150}
];

const STOPS_VENT = [
    {v:0,r:200,g:200,b:255},{v:5,r:150,g:200,b:255},{v:10,r:100,g:180,b:255},
    {v:15,r:50,g:150,b:255},{v:20,r:0,g:120,b:255},{v:25,r:0,g:200,b:200},
    {v:30,r:0,g:255,b:100},{v:35,r:100,g:255,b:0},{v:40,r:200,g:255,b:0},
    {v:45,r:255,g:200,b:0},{v:50,r:255,g:150,b:0},{v:55,r:255,g:100,b:0},
    {v:60,r:255,g:50,b:0},{v:70,r:255,g:0,b:0},{v:80,r:200,g:0,b:100}
];

const STOPS_VENT_ALT = [
    {v:0,r:200,g:200,b:255},{v:10,r:100,g:180,b:255},{v:20,r:0,g:150,b:255},
    {v:40,r:0,g:220,b:150},{v:60,r:100,g:255,b:0},{v:80,r:255,g:255,b:0},
    {v:100,r:255,g:180,b:0},{v:130,r:255,g:80,b:0},{v:160,r:255,g:0,b:0},
    {v:200,r:180,g:0,b:150}
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

const STOPS_PRESSIO_MSL = [
    {v:980,r:0,g:0,b:200},{v:990,r:0,g:100,b:255},{v:995,r:0,g:200,b:255},
    {v:1000,r:100,g:255,b:200},{v:1005,r:255,g:255,b:150},{v:1010,r:255,g:200,b:100},
    {v:1015,r:255,g:150,b:50},{v:1020,r:255,g:80,b:0},{v:1025,r:200,g:30,b:0},
    {v:1030,r:150,g:0,b:0},{v:1040,r:100,g:0,b:50}
];

const STOPS_PRESSIO_PA = [
    {v:0,r:45,g:0,b:75},{v:20000,r:0,g:0,b:255},{v:40000,r:0,g:150,b:255},
    {v:60000,r:0,g:220,b:150},{v:70000,r:100,g:255,b:0},{v:80000,r:255,g:255,b:0},
    {v:90000,r:255,g:150,b:0},{v:95000,r:255,g:60,b:0},{v:101325,r:200,g:0,b:0}
];

const STOPS_PRECIP = [
    {v:0,r:0,g:0,b:0,a:0},{v:0.1,r:200,g:230,b:255},{v:0.5,r:100,g:200,b:255},
    {v:1,r:0,g:150,b:255},{v:2,r:0,g:100,b:200},{v:5,r:0,g:200,b:0},
    {v:10,r:100,g:255,b:0},{v:20,r:255,g:255,b:0},{v:30,r:255,g:200,b:0},
    {v:50,r:255,g:100,b:0},{v:75,r:255,g:0,b:0},{v:100,r:200,g:0,b:200}
];

const STOPS_CAPE = [
    {v:0,r:0,g:0,b:0,a:0},{v:50,r:200,g:230,b:255},{v:100,r:100,g:200,b:255},
    {v:250,r:0,g:150,b:200},{v:500,r:0,g:200,b:0},{v:1000,r:200,g:255,b:0},
    {v:1500,r:255,g:200,b:0},{v:2000,r:255,g:100,b:0},{v:3000,r:255,g:0,b:0},
    {v:4000,r:200,g:0,b:200},{v:5000,r:255,g:0,b:255}
];

const STOPS_NUVOLS_BAIXOS = [
    {v:0,r:0,g:0,b:0,a:0},{v:10,r:180,g:180,b:200},{v:30,r:150,g:160,b:200},
    {v:50,r:120,g:140,b:200},{v:70,r:100,g:120,b:200},{v:90,r:80,g:100,b:200},
    {v:100,r:60,g:80,b:200}
];

const STOPS_NUVOLS_MITJANS = [
    {v:0,r:0,g:0,b:0,a:0},{v:10,r:200,g:200,b:180},{v:30,r:200,g:180,b:160},
    {v:50,r:200,g:160,b:140},{v:70,r:200,g:140,b:120},{v:90,r:200,g:120,b:100},
    {v:100,r:200,g:100,b:80}
];

const STOPS_NUVOLS_ALTS = [
    {v:0,r:0,g:0,b:0,a:0},{v:10,r:255,g:255,b:200},{v:30,r:255,g:230,b:160},
    {v:50,r:255,g:200,b:120},{v:70,r:255,g:170,b:80},{v:90,r:255,g:140,b:40},
    {v:100,r:255,g:100,b:0}
];

const STOPS_FRACCIO01 = [
    {v:0,r:0,g:0,b:0,a:0},{v:0.1,r:200,g:200,b:200},{v:0.3,r:180,g:180,b:220},
    {v:0.5,r:140,g:150,b:230},{v:0.7,r:100,g:120,b:240},{v:0.9,r:60,g:90,b:250},
    {v:1,r:30,g:60,b:255}
];

const STOPS_ALTURA_CL = [
    {v:0,r:0,g:0,b:0,a:0},{v:100,r:200,g:200,b:255},{v:200,r:150,g:200,b:255},
    {v:500,r:100,g:180,b:255},{v:1000,r:0,g:200,b:200},{v:1500,r:0,g:255,b:100},
    {v:2000,r:100,g:255,b:0},{v:3000,r:255,g:255,b:0},{v:4000,r:255,g:150,b:0},
    {v:5000,r:255,g:0,b:0}
];

const STOPS_RATXA = [
    {v:0,r:200,g:200,b:255},{v:10,r:100,g:180,b:255},{v:20,r:0,g:150,b:255},
    {v:30,r:0,g:200,b:200},{v:40,r:0,g:255,b:100},{v:50,r:200,g:255,b:0},
    {v:60,r:255,g:200,b:0},{v:70,r:255,g:100,b:0},{v:80,r:255,g:0,b:0},
    {v:100,r:200,g:0,b:100}
];

const STOPS_RADIACIO = [
    {v:0,r:20,g:20,b:60},{v:200000,r:40,g:40,b:150},{v:500000,r:0,g:100,b:220},
    {v:1000000,r:0,g:200,b:200},{v:1500000,r:100,g:255,b:100},{v:2000000,r:255,g:255,b:0},
    {v:2800000,r:255,g:180,b:0},{v:3500000,r:255,g:100,b:0},{v:4000000,r:255,g:0,b:0}
];

const STOPS_RADIACIO_NETA = [
    {v:-1000000,r:0,g:0,b:120},{v:-500000,r:0,g:80,b:200},{v:-100000,r:0,g:180,b:220},
    {v:0,r:200,g:200,b:200},{v:500000,r:255,g:230,b:0},{v:1500000,r:255,g:150,b:0},
    {v:2500000,r:255,g:60,b:0},{v:3500000,r:200,g:0,b:0}
];

const STOPS_FLUX_CALOR = [
    {v:-3000000,r:0,g:0,b:150},{v:-1500000,r:0,g:100,b:220},{v:-500000,r:0,g:200,b:220},
    {v:0,r:230,g:230,b:230},{v:20000,r:255,g:200,b:0},{v:40000,r:255,g:80,b:0}
];

const STOPS_TENSIO = [
    {v:-15000,r:150,g:0,b:150},{v:-5000,r:0,g:0,b:200},{v:-1000,r:0,g:150,b:255},
    {v:0,r:220,g:220,b:220},{v:1000,r:255,g:200,b:0},{v:5000,r:255,g:80,b:0},
    {v:15000,r:200,g:0,b:0}
];

const STOPS_GEOPOTENCIAL = [
    {v:0,r:45,g:0,b:75},{v:5000,r:0,g:0,b:255},{v:15000,r:0,g:150,b:255},
    {v:30000,r:0,g:220,b:150},{v:50000,r:100,g:255,b:0},{v:70000,r:255,g:255,b:0},
    {v:90000,r:255,g:150,b:0},{v:120000,r:255,g:60,b:0},{v:165000,r:200,g:0,b:200}
];

const STOPS_AIGUA_CONTINGUT = [
    {v:0,r:0,g:0,b:0,a:0},{v:0.00005,r:200,g:230,b:255},{v:0.0002,r:100,g:200,b:255},
    {v:0.0005,r:0,g:150,b:255},{v:0.001,r:0,g:220,b:150},{v:0.002,r:100,g:255,b:0},
    {v:0.005,r:255,g:255,b:0},{v:0.01,r:255,g:120,b:0},{v:0.02,r:255,g:0,b:0}
];

const STOPS_HUMITAT_ESPECIFICA = [
    {v:0,r:210,g:180,b:140},{v:0.002,r:200,g:190,b:120},{v:0.005,r:160,g:210,b:100},
    {v:0.008,r:100,g:220,b:80},{v:0.012,r:40,g:210,b:60},{v:0.016,r:0,g:180,b:120},
    {v:0.020,r:0,g:100,b:220}
];

const STOPS_VORTICITAT = [
    {v:-0.0006,r:0,g:0,b:200},{v:-0.0002,r:0,g:150,b:255},{v:0,r:220,g:220,b:220},
    {v:0.0002,r:255,g:180,b:0},{v:0.0006,r:200,g:0,b:0}
];

const STOPS_VORTICITAT_POT = [
    {v:-1e-6,r:0,g:0,b:200},{v:-3e-7,r:0,g:150,b:255},{v:0,r:220,g:220,b:220},
    {v:3e-7,r:255,g:180,b:0},{v:1e-6,r:200,g:0,b:0}
];

const STOPS_VELOCITAT_VERT = [
    {v:-5,r:0,g:0,b:200},{v:-2,r:0,g:150,b:255},{v:-0.5,r:150,g:220,b:255},
    {v:0,r:230,g:230,b:230},{v:0.5,r:255,g:220,b:150},{v:2,r:255,g:120,b:0},
    {v:5,r:200,g:0,b:0}
];

const STOPS_VELOCITAT_VERT_MS = [
    {v:-3,r:0,g:0,b:200},{v:-1,r:0,g:150,b:255},{v:-0.2,r:150,g:220,b:255},
    {v:0,r:230,g:230,b:230},{v:0.2,r:255,g:220,b:150},{v:1,r:255,g:120,b:0},
    {v:3,r:200,g:0,b:0}
];

const STOPS_TKE = [
    {v:0,r:0,g:0,b:0,a:0},{v:0.5,r:200,g:230,b:255},{v:1,r:100,g:200,b:255},
    {v:2,r:0,g:180,b:200},{v:4,r:0,g:220,b:100},{v:6,r:200,g:255,b:0},
    {v:8,r:255,g:150,b:0},{v:10.5,r:255,g:0,b:0}
];

const STOPS_TEMP_POTENCIAL = [
    {v:280,r:0,g:0,b:255},{v:285,r:0,g:180,b:255},{v:290,r:0,g:230,b:150},
    {v:293,r:150,g:255,b:0},{v:296,r:255,g:230,b:0},{v:298,r:255,g:100,b:0}
];

const STOPS_PRECIP_INTEGRAL = STOPS_PRECIP;

// ═══════════════════════════════════════════════════════════════════════
//  MAPA CLAU_BASE -> PALETA + TÍTOL + GRUP (per a la barra lateral Pivotal)
// ═══════════════════════════════════════════════════════════════════════

const PALETES = {
    u10:    { titol: 'VENT U 10m', unitat: 'm/s', stops: STOPS_VENT_UV },
    v10:    { titol: 'VENT V 10m', unitat: 'm/s', stops: STOPS_VENT_UV },
    si10:   { titol: 'VENT 10m', unitat: 'm/s', stops: STOPS_VENT },
    wdir10: { titol: 'DIRECCIÓ VENT 10m', unitat: '°', stops: STOPS_VENT },
    t2m:    { titol: 'TEMPERATURA 2m', unitat: '°C', stops: STOPS_TEMP },
    r2:     { titol: 'HUMITAT RELATIVA 2m', unitat: '%', stops: STOPS_HUMITAT },
    fg10:   { titol: 'RATXA MÀXIMA 10m', unitat: 'm/s', stops: STOPS_RATXA },
    efg10:  { titol: 'RATXA VENT U 10m', unitat: 'm/s', stops: STOPS_VENT_UV },
    nfg10:  { titol: 'RATXA VENT V 10m', unitat: 'm/s', stops: STOPS_VENT_UV },
    prmsl:  { titol: 'PRESSIÓ NIVELL DEL MAR', unitat: 'Pa', stops: STOPS_PRESSIO_MSL.map(s => ({...s, v: s.v * 100})) },
    ssrd:   { titol: 'RADIACIÓ SOLAR DESCENDENT', unitat: 'J/m²', stops: STOPS_RADIACIO },
    tp:     { titol: 'PRECIPITACIÓ TOTAL', unitat: 'kg/m²', stops: STOPS_PRECIP },
    tgrp:   { titol: 'PRECIPITACIÓ CALAMARSA', unitat: 'kg/m²', stops: STOPS_PRECIP },
    tsnowp: { titol: 'PRECIPITACIÓ NEU', unitat: 'kg/m²', stops: STOPS_PRECIP },

    d2m:      { titol: 'PUNT DE ROSADA 2m', unitat: '°C', stops: STOPS_TEMP },
    sh2:      { titol: 'HUMITAT ESPECÍFICA 2m', unitat: 'kg/kg', stops: STOPS_HUMITAT_ESPECIFICA },
    mx2t:     { titol: 'TEMPERATURA MÀXIMA 2m', unitat: '°C', stops: STOPS_TEMP },
    mn2t:     { titol: 'TEMPERATURA MÍNIMA 2m', unitat: '°C', stops: STOPS_TEMP },
    t_sp2:    { titol: 'TEMPERATURA SUPERFÍCIE', unitat: '°C', stops: STOPS_TEMP },
    sp:       { titol: 'PRESSIÓ SUPERFÍCIE', unitat: 'Pa', stops: STOPS_PRESSIO_PA },
    blh:      { titol: 'ALTURA CAPA LÍMIT', unitat: 'm', stops: STOPS_ALTURA_CL },
    h:        { titol: 'ALÇADA GEOMÈTRICA', unitat: 'm', stops: STOPS_ALTURA_CL },
    lcc:      { titol: 'NUVOLOSITAT BAIXA', unitat: '%', stops: STOPS_NUVOLS_BAIXOS },
    mcc:      { titol: 'NUVOLOSITAT MITJANA', unitat: '%', stops: STOPS_NUVOLS_MITJANS },
    hcc:      { titol: 'NUVOLOSITAT ALTA', unitat: '%', stops: STOPS_NUVOLS_ALTS },
    tirf:     { titol: 'INTEGRAL FLUX DE PLUJA', unitat: 'kg/m²', stops: STOPS_PRECIP_INTEGRAL },
    CAPE_INS: { titol: 'CAPE', unitat: 'J/kg', stops: STOPS_CAPE },

    sshf: { titol: 'FLUX CALOR SENSIBLE', unitat: 'J/m²', stops: STOPS_FLUX_CALOR },
    slhf: { titol: 'FLUX CALOR LATENT', unitat: 'J/m²', stops: STOPS_FLUX_CALOR },
    strd: { titol: 'RADIACIÓ OL DESCENDENT', unitat: 'J/m²', stops: STOPS_RADIACIO },
    ssr:  { titol: 'RADIACIÓ SOLAR NETA', unitat: 'J/m²', stops: STOPS_RADIACIO_NETA },
    str:  { titol: 'RADIACIÓ OL NETA', unitat: 'J/m²', stops: STOPS_RADIACIO_NETA },
    ssrc: { titol: 'RAD. SOLAR NETA CEL SERÈ', unitat: 'J/m²', stops: STOPS_RADIACIO_NETA },
    strc: { titol: 'RAD. OL NETA CEL SERÈ', unitat: 'J/m²', stops: STOPS_RADIACIO_NETA },
    iews: { titol: 'TENSIÓ SUPERFICIAL U', unitat: 'N/m²', stops: STOPS_TENSIO },
    inss: { titol: 'TENSIÓ SUPERFICIAL V', unitat: 'N/m²', stops: STOPS_TENSIO },

    z_ip1: { titol: 'GEOPOTENCIAL', unitat: 'm²/s²', stops: STOPS_GEOPOTENCIAL },
    t_ip1: { titol: 'TEMPERATURA', unitat: '°C', stops: STOPS_TEMP_ALT },
    u_ip1: { titol: 'VENT U', unitat: 'm/s', stops: STOPS_VENT_UV },
    v_ip1: { titol: 'VENT V', unitat: 'm/s', stops: STOPS_VENT_UV },
    r_ip1: { titol: 'HUMITAT RELATIVA', unitat: '%', stops: STOPS_HUMITAT },

    crwc: { titol: 'AIGUA PLUJA', unitat: 'kg/kg', stops: STOPS_AIGUA_CONTINGUT },
    cswc: { titol: 'AIGUA NEU', unitat: 'kg/kg', stops: STOPS_AIGUA_CONTINGUT },
    clwc: { titol: 'AIGUA LÍQUIDA NÚVOL', unitat: 'kg/kg', stops: STOPS_AIGUA_CONTINGUT },
    ciwc: { titol: 'GEL NÚVOL', unitat: 'kg/kg', stops: STOPS_AIGUA_CONTINGUT },
    cc:   { titol: 'FRACCIÓ COBERTURA NÚVOLS', unitat: '0-1', stops: STOPS_FRACCIO01 },

    ws_ip3:   { titol: 'VELOCITAT VENT', unitat: 'm/s', stops: STOPS_VENT_ALT },
    pv:       { titol: 'VORTICITAT POTENCIAL', unitat: 'K m²/kg/s', stops: STOPS_VORTICITAT_POT },
    q_ip3:    { titol: 'HUMITAT ESPECÍFICA', unitat: 'kg/kg', stops: STOPS_HUMITAT_ESPECIFICA },
    w:        { titol: 'VELOCITAT VERTICAL', unitat: 'Pa/s', stops: STOPS_VELOCITAT_VERT },
    dpt_ip3:  { titol: 'PUNT DE ROSADA', unitat: 'K', stops: STOPS_TEMP_K },
    wdir_ip3: { titol: 'DIRECCIÓ VENT', unitat: '°', stops: STOPS_VENT },
    wz:       { titol: 'VELOCITAT VERTICAL GEOMÈTRICA', unitat: 'm/s', stops: STOPS_VELOCITAT_VERT_MS },

    tke_ip4: { titol: 'ENERGIA CINÈTICA TURBULENTA', unitat: 'J/kg', stops: STOPS_TKE },

    vo:    { titol: 'VORTICITAT RELATIVA', unitat: '1/s', stops: STOPS_VORTICITAT },
    absv:  { titol: 'VORTICITAT ABSOLUTA', unitat: '1/s', stops: STOPS_VORTICITAT },
    papt:  { titol: 'TEMP. POTENCIAL PSEUDOADIABÀTICA', unitat: 'K', stops: STOPS_TEMP_POTENCIAL },
    z_ip5: { titol: 'GEOPOTENCIAL', unitat: 'm²/s²', stops: STOPS_GEOPOTENCIAL },
    u_ip5: { titol: 'VENT U', unitat: 'm/s', stops: STOPS_VENT_UV },
    v_ip5: { titol: 'VENT V', unitat: 'm/s', stops: STOPS_VENT_UV },

    ws_hp1:     { titol: 'VELOCITAT VENT', unitat: 'm/s', stops: STOPS_VENT_ALT },
    u_hp1:      { titol: 'VENT U', unitat: 'm/s', stops: STOPS_VENT_UV },
    v_hp1:      { titol: 'VENT V', unitat: 'm/s', stops: STOPS_VENT_UV },
    wdir_hp1:   { titol: 'DIRECCIÓ VENT', unitat: '°', stops: STOPS_VENT },
    pres:       { titol: 'PRESSIÓ', unitat: 'Pa', stops: STOPS_PRESSIO_PA },
    t_hp1:      { titol: 'TEMPERATURA', unitat: '°C', stops: STOPS_TEMP_ALT },
    r_hp1:      { titol: 'HUMITAT RELATIVA', unitat: '%', stops: STOPS_HUMITAT },
    u10_hp1:    { titol: 'VENT U 10m', unitat: 'm/s', stops: STOPS_VENT_UV },
    v10_hp1:    { titol: 'VENT V 10m', unitat: 'm/s', stops: STOPS_VENT_UV },
    si10_hp1:   { titol: 'VELOCITAT VENT 10m', unitat: 'm/s', stops: STOPS_VENT },
    wdir10_hp1: { titol: 'DIRECCIÓ VENT 10m', unitat: '°', stops: STOPS_VENT },

    crwc_hp2: { titol: 'AIGUA PLUJA', unitat: 'kg/kg', stops: STOPS_AIGUA_CONTINGUT },
    cswc_hp2: { titol: 'AIGUA NEU', unitat: 'kg/kg', stops: STOPS_AIGUA_CONTINGUT },
    z_hp2:    { titol: 'GEOPOTENCIAL', unitat: 'm²/s²', stops: STOPS_GEOPOTENCIAL },
    q_hp2:    { titol: 'HUMITAT ESPECÍFICA', unitat: 'kg/kg', stops: STOPS_HUMITAT_ESPECIFICA },
    clwc_hp2: { titol: 'AIGUA LÍQUIDA NÚVOL', unitat: 'kg/kg', stops: STOPS_AIGUA_CONTINGUT },
    ciwc_hp2: { titol: 'GEL NÚVOL', unitat: 'kg/kg', stops: STOPS_AIGUA_CONTINGUT },
    cc_hp2:   { titol: 'FRACCIÓ COBERTURA NÚVOLS', unitat: '0-1', stops: STOPS_FRACCIO01 },
    dpt_hp2:  { titol: 'PUNT DE ROSADA', unitat: 'K', stops: STOPS_TEMP_K },
    tke_hp2:  { titol: 'ENERGIA CINÈTICA TURBULENTA', unitat: 'J/kg', stops: STOPS_TKE },
};

// Grups per organitzar el panell lateral estil Pivotal
const GRUPS_VARIABLES = {
    'Superfície — Vent i pressió': ['u10','v10','si10','wdir10','fg10','efg10','nfg10','prmsl'],
    'Superfície — Temperatura i humitat': ['t2m','r2','d2m','sh2','mx2t','mn2t','t_sp2'],
    'Superfície — Precipitació i convecció': ['tp','tgrp','tsnowp','CAPE_INS','tirf'],
    'Superfície — Núvols i capa límit': ['lcc','mcc','hcc','blh','h','sp'],
    'Superfície — Radiació i fluxos': ['ssrd','sshf','slhf','strd','ssr','str','ssrc','strc','iews','inss'],
    'Nivells de pressió — Dinàmica': ['z_ip1','t_ip1','u_ip1','v_ip1','r_ip1'],
    'Nivells de pressió — Núvols/aigua': ['crwc','cswc','clwc','ciwc','cc'],
    'Nivells de pressió — Vent i vertical': ['ws_ip3','pv','q_ip3','w','dpt_ip3','wdir_ip3','wz'],
    'Nivells de pressió — Turbulència': ['tke_ip4'],
    'Nivells de pressió — Vorticitat': ['vo','absv','papt','z_ip5','u_ip5','v_ip5'],
    'Nivells d\'alçada — Vent i temp.': ['ws_hp1','u_hp1','v_hp1','wdir_hp1','pres','t_hp1','r_hp1','u10_hp1','v10_hp1','si10_hp1','wdir10_hp1'],
    'Nivells d\'alçada — Núvols/aigua': ['crwc_hp2','cswc_hp2','z_hp2','q_hp2','clwc_hp2','ciwc_hp2','cc_hp2','dpt_hp2','tke_hp2'],
};

let variableActiva = 't2m';

function claueBase(clauCompleta) {
    if (PALETES[clauCompleta]) return clauCompleta;
    const m = clauCompleta.match(/^(.+)_(-?\d+)$/);
    if (m && PALETES[m[1]]) return m[1];
    return clauCompleta;
}

function getPaletaPer(clau) {
    return PALETES[claueBase(clau)] || PALETES.t2m;
}

function getColor(pal, v) {
    const s = pal.stops;
    if (v === null || v === undefined || isNaN(v)) return { r:0, g:0, b:0, a:0 };
    if (v <= s[0].v) return { r:s[0].r, g:s[0].g, b:s[0].b, a: s[0].a ?? 220 };
    if (v >= s[s.length-1].v) return { r:s[s.length-1].r, g:s[s.length-1].g, b:s[s.length-1].b, a: s[s.length-1].a ?? 220 };
    for (let i = 0; i < s.length - 1; i++) {
        if (v >= s[i].v && v <= s[i+1].v) {
            const t = (v - s[i].v) / (s[i+1].v - s[i].v);
            const lr = (a, b) => Math.round(a + (b - a) * t);
            return {
                r: lr(s[i].r, s[i+1].r),
                g: lr(s[i].g, s[i+1].g),
                b: lr(s[i].b, s[i+1].b),
                a: lr(s[i].a ?? 220, s[i+1].a ?? 220)
            };
        }
    }
    return { r:0, g:0, b:0, a:0 };
}

// ═══════════════════════════════════════════════════════════════════════
//  SISTEMA DE VENT (streamlines + partícules)
// ═══════════════════════════════════════════════════════════════════════

// Configuració global del vent
window.ventEnabled = true;
window.ventMode = 'streamlines'; // 'streamlines' | 'particles'

const wCfg = {
    // Streamlines
    streamlineColor: 'white',
    streamlineOpacity: 0.7,
    streamlineWidth: 1.2,
    // Partícules
    particleColor: 'white',
    particleOpacity: 0.8,
    numParticles: 3000,
    particleSpeed: 1.0,
    particleTail: 0.75,
};

// ─── Dades de vent per a la superfície ──────────────────────────────
window.SFC_DATA = null; // { u10, v10, lat, lon, Nlat, Nlon }

function _extreureVentSuperficie(hourIdx) {
    const item = totesLesHores[hourIdx];
    if (!item) return null;

    const data = item.data;
    const coords = data.coordenadas;

    // Buscar u10 i v10
    const uInfo = data.variables['u10'];
    const vInfo = data.variables['v10'];

    if (!uInfo || !vInfo || !uInfo.datos || !vInfo.datos) {
        // Intentar amb si10 i wdir10
        const siInfo = data.variables['si10'];
        const wdirInfo = data.variables['wdir10'];
        if (!siInfo || !wdirInfo) return null;

        const speed = siInfo.datos;
        const dir = wdirInfo.datos;
        const N = speed.length;

        // Convertir velocitat + direcció a components u, v
        const u10 = new Float32Array(N);
        const v10 = new Float32Array(N);

        for (let i = 0; i < N; i++) {
            const spd = speed[i];
            const ang = dir[i]; // graus meteorològics (0=N, 90=E)
            if (spd === null || isNaN(spd) || ang === null || isNaN(ang)) {
                u10[i] = NaN;
                v10[i] = NaN;
                continue;
            }
            // Convertir de graus meteorològics a radiants matemàtics
            // Vent: direcció DES D'ON ve → angle + 180° per direcció CAP A ON va
            const rad = ((ang + 180) % 360) * Math.PI / 180;
            u10[i] = -spd * Math.sin(rad); // component Est (+)
            v10[i] = -spd * Math.cos(rad); // component Nord (+)
        }

        window.SFC_DATA = {
            u10, v10,
            lat: coords.lat,
            lon: coords.lon,
            Nlat: coords.lat.length,
            Nlon: coords.lon.length,
        };
    } else {
        // Tenim u10 i v10 directament
        const u10 = new Float32Array(uInfo.datos);
        const v10 = new Float32Array(vInfo.datos);
        window.SFC_DATA = {
            u10, v10,
            lat: coords.lat,
            lon: coords.lon,
            Nlat: coords.lat.length,
            Nlon: coords.lon.length,
        };
    }

    return window.SFC_DATA;
}

function _teDadesVent() {
    return window.SFC_DATA !== null;
}

// ─── Interpolació bilineal de vent ──────────────────────────────────
function _getUVFromLatLon(lat, lon, windData) {
    const { u10, v10, lat: lats, lon: lons, Nlat, Nlon } = windData;

    // Trobar índexs de latitud (decreixent: [0]=més alt, [Nlat-1]=més baix)
    let i0, i1;
    if (lat >= lats[0]) { i0 = 0; i1 = 1; }
    else if (lat <= lats[Nlat-1]) { i0 = Nlat-2; i1 = Nlat-1; }
    else {
        // Cerca binària (lats ordenats decreixent)
        let lo = 0, hi = Nlat - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (lats[mid] >= lat) lo = mid;
            else hi = mid;
        }
        i0 = lo; i1 = hi;
    }

    // Trobar índexs de longitud (creixent: [0]=més oest, [Nlon-1]=més est)
    let j0, j1;
    if (lon <= lons[0]) { j0 = 0; j1 = 1; }
    else if (lon >= lons[Nlon-1]) { j0 = Nlon-2; j1 = Nlon-1; }
    else {
        let lo = 0, hi = Nlon - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (lons[mid] <= lon) lo = mid;
            else hi = mid;
        }
        j0 = lo; j1 = hi;
    }

    // Fraccions
    const t_lat = (lat - lats[i0]) / (lats[i1] - lats[i0]);
    const t_lon = (lon - lons[j0]) / (lons[j1] - lons[j0]);

    // Índexs plans
    const idx00 = i0 * Nlon + j0;
    const idx01 = i0 * Nlon + j1;
    const idx10 = i1 * Nlon + j0;
    const idx11 = i1 * Nlon + j1;

    // Comprovar NaN
    if (isNaN(u10[idx00]) || isNaN(u10[idx01]) || isNaN(u10[idx10]) || isNaN(u10[idx11]) ||
        isNaN(v10[idx00]) || isNaN(v10[idx01]) || isNaN(v10[idx10]) || isNaN(v10[idx11])) {
        return null;
    }

    // Interpolació bilineal
    const u = (1 - t_lat) * (1 - t_lon) * u10[idx00] +
              (1 - t_lat) * t_lon * u10[idx01] +
              t_lat * (1 - t_lon) * u10[idx10] +
              t_lat * t_lon * u10[idx11];

    const v = (1 - t_lat) * (1 - t_lon) * v10[idx00] +
              (1 - t_lat) * t_lon * v10[idx01] +
              t_lat * (1 - t_lon) * v10[idx10] +
              t_lat * t_lon * v10[idx11];

    const speed = Math.hypot(u, v);

    return { u, v, speed };
}

function _getUVFromPixel(px, py, windData, map) {
    const latlng = map.containerPointToLatLng(L.point(px, py));
    return _getUVFromLatLon(latlng.lat, latlng.lng, windData);
}

// ═══════════════════════════════════════════════════════════════════════
//  DIBUIX DE STREAMLINES
// ═══════════════════════════════════════════════════════════════════════

function _drawStreamlines(ctx, hourIdx, map) {
    const windData = window.SFC_DATA;
    if (!windData) return;

    const { Nlat, Nlon, lat, lon } = windData;

    // Calcular els límits de la graella en coordenades de pantalla
    const latMin = lat[Nlat - 1];
    const latMax = lat[0];
    const lonMin = lon[0];
    const lonMax = lon[Nlon - 1];

    const nw = map.latLngToContainerPoint(L.latLng(latMax, lonMin));
    const se = map.latLngToContainerPoint(L.latLng(latMin, lonMax));

    const graellaX = nw.x;
    const graellaY = nw.y;
    const graellaW = se.x - nw.x;
    const graellaH = se.y - nw.y;

    function sampleUV(px, py) {
        // Comprovar si el punt està dins de la graella
        if (px < graellaX || px > graellaX + graellaW ||
            py < graellaY || py > graellaY + graellaH) return null;

        // Convertir de píxels a coordenades de la graella
        const fracLon = (px - graellaX) / graellaW;
        const fracLat = (py - graellaY) / graellaH;

        const lonPt = lonMin + fracLon * (lonMax - lonMin);
        const latPt = latMin + (1 - fracLat) * (latMax - latMin); // lat inversa en pantalla

        const uv = _getUVFromLatLon(latPt, lonPt, windData);
        if (!uv || uv.speed < 0.15) return null;

        // Escalar segons la projecció del mapa
        // Convertir lat/lon a píxels per obtenir l'escala local
        const pt = map.latLngToContainerPoint(L.latLng(latPt, lonPt));
        const ptDx = map.latLngToContainerPoint(L.latLng(latPt, lonPt + 0.01));
        const ptDy = map.latLngToContainerPoint(L.latLng(latPt + 0.01, lonPt));

        const scaleX = (ptDx.x - pt.x) * 100; // píxels per grau (×100 per 0.01°)
        const scaleY = (ptDy.y - pt.y) * 100; // píxels per grau (negatiu perquè Y va cap avall)

        const pixU = uv.u * scaleX;
        const pixV = -uv.v * Math.abs(scaleY); // invertir signe de lat

        return { u: pixU, v: pixV, speed: Math.hypot(pixU, pixV) };
    }

    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    const STEP = 14;           // Distància entre seeds
    const STEP_LEN = 1.4;      // Pas d'integració
    const MAX_STEPS = 80;      // Màxim passos per línia
    const GRID = 4;            // Resolució de la graella de visitats
    const MIN_POINTS = 10;     // Mínim de punts per dibuixar una línia

    const gw = Math.floor(W / GRID) + 1;
    const gh = Math.floor(H / GRID) + 1;
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

    // Generar seeds en ordre aleatori
    const seeds = [];
    for (let py = 0; py < H; py += STEP) {
        for (let px = 0; px < W; px += STEP) {
            seeds.push([px + (Math.random() - 0.5) * STEP * 0.8,
                        py + (Math.random() - 0.5) * STEP * 0.8]);
        }
    }
    // Fisher-Yates shuffle
    for (let i = seeds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
    }

    for (const [sx, sy] of seeds) {
        const gx0 = Math.floor(sx / GRID), gy0 = Math.floor(sy / GRID);
        if (gy0 < 0 || gy0 >= gh || gx0 < 0 || gx0 >= gw) continue;
        if (visited[gy0 * gw + gx0]) continue;

        const fwd = [], back = [];
        let cx = sx, cy = sy;

        // Endavant
        for (let s = 0; s < MAX_STEPS; s++) {
            const uv = sampleUV(cx, cy);
            if (!uv || uv.speed < 0.15) break;
            const mag = uv.speed;
            cx += (uv.u / mag) * STEP_LEN;
            cy += (uv.v / mag) * STEP_LEN;

            if (cx < 0 || cx >= W || cy < 0 || cy >= H) break;

            const gx = Math.floor(cx / GRID), gy = Math.floor(cy / GRID);
            if (gy < 0 || gy >= gh || gx < 0 || gx >= gw) break;
            if (visited[gy * gw + gx]) break;
            fwd.push([cx, cy]);
        }

        // Enrere
        cx = sx; cy = sy;
        for (let s = 0; s < MAX_STEPS; s++) {
            const uv = sampleUV(cx, cy);
            if (!uv || uv.speed < 0.15) break;
            const mag = uv.speed;
            cx -= (uv.u / mag) * STEP_LEN;
            cy -= (uv.v / mag) * STEP_LEN;

            if (cx < 0 || cx >= W || cy < 0 || cy >= H) break;

            const gx = Math.floor(cx / GRID), gy = Math.floor(cy / GRID);
            if (gy < 0 || gy >= gh || gx < 0 || gx >= gw) break;
            if (visited[gy * gw + gx]) break;
            back.push([cx, cy]);
        }

        const line = [...back.reverse(), [sx, sy], ...fwd];
        if (line.length <= MIN_POINTS) continue;

        // Marcar visitats
        for (let i = 0; i < line.length; i += 3) {
            const gx = Math.floor(line[i][0] / GRID), gy = Math.floor(line[i][1] / GRID);
            if (gy >= 0 && gy < gh && gx >= 0 && gx < gw) visited[gy * gw + gx] = 1;
        }

        // Dibuixar la línia amb corbes suaus
        ctx.beginPath();
        ctx.moveTo(line[0][0], line[0][1]);

        if (line.length === 2) {
            ctx.lineTo(line[1][0], line[1][1]);
        } else {
            for (let i = 1; i < line.length - 1; i++) {
                const mx = (line[i][0] + line[i + 1][0]) / 2;
                const my = (line[i][1] + line[i + 1][1]) / 2;
                ctx.quadraticCurveTo(line[i][0], line[i][1], mx, my);
            }
            // Últim punt
            ctx.lineTo(line[line.length - 1][0], line[line.length - 1][1]);
        }
        ctx.stroke();

        // Fletxes de direcció
        if (line.length > 30) {
            const step = Math.floor(line.length / 5);
            for (let i = step; i < line.length - 3; i += step) {
                const p0 = line[i], p1 = line[i + 2];
                if (p0 && p1) {
                    const dx = p1[0] - p0[0];
                    const dy = p1[1] - p0[1];
                    const a = Math.atan2(dy, dx);

                    const arrowLen = 5;
                    const arrowAngle = 0.5;

                    ctx.beginPath();
                    ctx.moveTo(p0[0], p0[1]);
                    ctx.lineTo(
                        p0[0] - arrowLen * Math.cos(a - arrowAngle),
                        p0[1] - arrowLen * Math.sin(a - arrowAngle)
                    );
                    ctx.moveTo(p0[0], p0[1]);
                    ctx.lineTo(
                        p0[0] - arrowLen * Math.cos(a + arrowAngle),
                        p0[1] - arrowLen * Math.sin(a + arrowAngle)
                    );
                    ctx.stroke();
                }
            }
        }
    }

    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════
//  PARTÍCULES DE VENT (animades)
// ═══════════════════════════════════════════════════════════════════════

const _particles = {
    canvas: null,
    ctx: null,
    running: false,
    animFrame: null,
    particles: [],
    lastHourIdx: -1,
    lastMap: null,
    lastLevel: null,
};

function _createParticleCanvas(map) {
    if (_particles.canvas) {
        map.getPane('paneVent').removeChild(_particles.canvas);
    }
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    map.getPane('paneVent').appendChild(c);
    _particles.canvas = c;
    _particles.ctx = c.getContext('2d');
}

function _initParticles(map) {
    const w = map.getSize().x;
    const h = map.getSize().y;
    _particles.canvas.width = w;
    _particles.canvas.height = h;

    _particles.particles = [];
    const n = wCfg.numParticles;

    const windData = window.SFC_DATA;
    if (!windData) return;

    const { lat, lon, Nlat, Nlon } = windData;
    const latMin = lat[Nlat - 1], latMax = lat[0];
    const lonMin = lon[0], lonMax = lon[Nlon - 1];

    for (let i = 0; i < n; i++) {
        // Generar partícules dins dels límits de la graella
        const fracLat = Math.random();
        const fracLon = Math.random();
        const pLat = latMin + fracLat * (latMax - latMin);
        const pLon = lonMin + fracLon * (lonMax - lonMin);

        const pt = map.latLngToContainerPoint(L.latLng(pLat, pLon));

        _particles.particles.push({
            x: pt.x,
            y: pt.y,
            age: Math.random() * 100,
            maxAge: 80 + Math.random() * 60,
        });
    }
}

function _animateParticles(timestamp) {
    if (!_particles.running || !_particles.canvas || !_particles.ctx) return;

    const map = _particles.lastMap;
    if (!map) return;

    const windData = window.SFC_DATA;
    if (!windData) return;

    const ctx = _particles.ctx;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    // Semi-esborrar per efecte de cua
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - wCfg.particleTail})`;
    ctx.fillRect(0, 0, W, H);

    const { lat, lon, Nlat, Nlon } = windData;
    const latMin = lat[Nlat - 1], latMax = lat[0];
    const lonMin = lon[0], lonMax = lon[Nlon - 1];

    const nw = map.latLngToContainerPoint(L.latLng(latMax, lonMin));
    const se = map.latLngToContainerPoint(L.latLng(latMin, lonMax));
    const gx = nw.x, gy = nw.y;
    const gw = se.x - nw.x, gh = se.y - nw.y;

    const color = wCfg.particleColor === 'white'
        ? `rgba(255, 255, 255, ${wCfg.particleOpacity})`
        : `rgba(0, 0, 0, ${wCfg.particleOpacity})`;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    for (const p of _particles.particles) {
        p.age++;

        // Reubicar partícula si ha expirat o està fora dels límits
        if (p.age > p.maxAge || p.x < gx - 10 || p.x > gx + gw + 10 ||
            p.y < gy - 10 || p.y > gy + gh + 10) {
            const fracLat = Math.random();
            const fracLon = Math.random();
            const pLat = latMin + fracLat * (latMax - latMin);
            const pLon = lonMin + fracLon * (lonMax - lonMin);
            const pt = map.latLngToContainerPoint(L.latLng(pLat, pLon));
            p.x = pt.x;
            p.y = pt.y;
            p.age = 0;
            p.maxAge = 80 + Math.random() * 60;
            continue;
        }

        // Obtenir vent a la posició actual
        const fracLon = (p.x - gx) / gw;
        const fracLat = 1 - (p.y - gy) / gh;
        const pLon = lonMin + fracLon * (lonMax - lonMin);
        const pLat = latMin + fracLat * (latMax - latMin);

        const uv = _getUVFromLatLon(pLat, pLon, windData);
        if (!uv || uv.speed < 0.1) {
            // Sense vent significatiu: moure lentament en direcció aleatòria
            p.x += (Math.random() - 0.5) * 0.5;
            p.y += (Math.random() - 0.5) * 0.5;
        } else {
            // Escalar velocitat a píxels
            const pt = map.latLngToContainerPoint(L.latLng(pLat, pLon));
            const ptDx = map.latLngToContainerPoint(L.latLng(pLat, pLon + 0.01));
            const ptDy = map.latLngToContainerPoint(L.latLng(pLat + 0.01, pLon));
            const scaleX = (ptDx.x - pt.x) * 100;
            const scaleY = (ptDy.y - pt.y) * 100;

            const pixU = uv.u * scaleX * wCfg.particleSpeed * 0.015;
            const pixV = -uv.v * Math.abs(scaleY) * wCfg.particleSpeed * 0.015;

            p.x += pixU;
            p.y += pixV;
        }

        // Dibuixar partícula
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    _particles.animFrame = requestAnimationFrame(_animateParticles);
}

function _startParticleAnimation(hourIdx, map, level) {
    _stopParticles();

    if (!_teDadesVent()) return;

    _createParticleCanvas(map);
    _initParticles(map);

    _particles.running = true;
    _particles.lastHourIdx = hourIdx;
    _particles.lastMap = map;
    _particles.lastLevel = level;

    const pos = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(_particles.canvas, pos);

    _particles.animFrame = requestAnimationFrame(_animateParticles);
}

function _stopParticles() {
    _particles.running = false;
    if (_particles.animFrame) {
        cancelAnimationFrame(_particles.animFrame);
        _particles.animFrame = null;
    }
    if (_particles.canvas && _particles.canvas.parentNode) {
        _particles.canvas.parentNode.removeChild(_particles.canvas);
        _particles.canvas = null;
        _particles.ctx = null;
    }
    _particles.particles = [];
}

// ═══════════════════════════════════════════════════════════════════════
//  API pública de dibuix de vent
// ═══════════════════════════════════════════════════════════════════════

window.drawVent = function (ctx, hourIdx, map, level = 'surface') {
    if (!window.ventEnabled || !_teDadesVent()) {
        _stopParticles();
        return;
    }

    if (window.ventMode === 'particles') {
        const sameContext =
            _particles.lastHourIdx === hourIdx &&
            _particles.lastMap === map &&
            _particles.lastLevel === level;

        if (!_particles.running || !sameContext) {
            _startParticleAnimation(hourIdx, map, level);
        } else if (_particles.canvas) {
            const pos = map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(_particles.canvas, pos);
        }
    } else {
        _stopParticles();
        if (ctx) _drawStreamlines(ctx, hourIdx, map);
    }
};

window.toggleVentMode = function () {
    window.ventMode = window.ventMode === 'streamlines' ? 'particles' : 'streamlines';
    if (window.ventMode === 'streamlines') _stopParticles();
    if (window._canvasLayer) {
        window._canvasLayer._needsRedraw = true;
        window._canvasLayer._render();
    }
    return window.ventMode;
};

window.setStreamlineWidth = function (v) {
    wCfg.streamlineWidth = Math.min(3, Math.max(0.5, v));
    if (window._canvasLayer) {
        window._canvasLayer._needsRedraw = true;
        window._canvasLayer._render();
    }
};

window.setStreamlineOpacity = function (v) {
    wCfg.streamlineOpacity = Math.min(1, Math.max(0.3, v));
    if (window._canvasLayer) {
        window._canvasLayer._needsRedraw = true;
        window._canvasLayer._render();
    }
};

// ═══════════════════════════════════════════════════════════════════════
//  CANVAS LAYER FLUID
// ═══════════════════════════════════════════════════════════════════════

const CanvasLayer = L.Layer.extend({
    initialize: function() {
        this._canvas = null;
        this._data = null;
        this._hourIdx = 0;
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

    setData: function(data, horaIdx) {
        this._data = data;
        this._hourIdx = horaIdx;
        this._needsRedraw = true;

        // Extreure dades de vent si estan disponibles
        if (_teDadesVent() === false || window.SFC_DATA === null) {
            _extreureVentSuperficie(horaIdx);
        }

        this._render();
    },

    _drawOffscreen: function() {
        if (!this._data) return;

        const lats = this._data.coordenadas.lat;
        const lons = this._data.coordenadas.lon;
        const Nlat = lats.length;
        const Nlon = lons.length;

        const varInfo = this._data.variables[variableActiva];
        if (!varInfo || !varInfo.datos) return;

        const dades = varInfo.datos;
        const pal = getPaletaPer(variableActiva);

        if (!this._offscreen || this._offscreen.width !== Nlon || this._offscreen.height !== Nlat) {
            this._offscreen = document.createElement('canvas');
            this._offscreen.width = Nlon;
            this._offscreen.height = Nlat;
        }

        const ctx = this._offscreen.getContext('2d');
        const imgData = ctx.createImageData(Nlon, Nlat);
        const d = imgData.data;

        for (let i = 0; i < Nlat; i++) {
            for (let j = 0; j < Nlon; j++) {
                const valor = dades[i * Nlon + j];
                const ii = (i * Nlon + j) * 4;
                if (valor === null || isNaN(valor)) {
                    d[ii+3] = 0;
                } else {
                    const c = getColor(pal, valor);
                    d[ii] = c.r;
                    d[ii+1] = c.g;
                    d[ii+2] = c.b;
                    d[ii+3] = c.a;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);
        this._needsRedraw = false;
    },

    _render: function() {
        if (!this._data || !this._map) return;

        if (this._needsRedraw) {
            this._drawOffscreen();
        }

        const map = this._map;
        const size = map.getSize();
        const canvas = this._canvas;
        canvas.width = size.x;
        canvas.height = size.y;
        const ctx = canvas.getContext('2d');
        L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0,0]));

        const lats = this._data.coordenadas.lat;
        const lons = this._data.coordenadas.lon;
        const latMin = lats[lats.length - 1];
        const latMax = lats[0];
        const lonMin = lons[0];
        const lonMax = lons[lons.length - 1];

        const nw = map.latLngToContainerPoint(L.latLng(latMax, lonMin));
        const se = map.latLngToContainerPoint(L.latLng(latMin, lonMax));

        const x = nw.x;
        const y = nw.y;
        const w = se.x - nw.x;
        const h = se.y - nw.y;

        if (this._offscreen) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(this._offscreen, x, y, w, h);
        }

        // ─── DIBUIXAR VENT SOBRE EL CANVAS ───
        if (window.ventEnabled && window.ventMode === 'streamlines' &&
            typeof window.drawVent === 'function' && window.SFC_DATA) {
            window.drawVent(ctx, this._hourIdx, map, 'surface');
        }

        this._drawLegend(ctx, getPaletaPer(variableActiva));
        actualitzarCapcaleraParametre();
    },

    _drawLegend: function(ctx, pal) {
        const s = pal.stops;
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;
        const bw = 25;
        const x0 = W - bw - 15;
        const y0 = H - s.length * 3 - 25;

        ctx.save();
        ctx.fillStyle = 'rgba(10,16,26,0.75)';
        ctx.fillRect(x0 - 5, y0 - 18, bw + 10, s.length * 3 + 22);

        s.forEach((st, i) => {
            const y = y0 + i * 3;
            ctx.fillStyle = `rgb(${st.r},${st.g},${st.b})`;
            ctx.fillRect(x0, y, bw, 3);
        });

        ctx.fillStyle = '#fff';
        ctx.font = '9px Arial';
        ctx.textAlign = 'right';
        const fmt = (v) => (Math.abs(v) >= 10000 || (Math.abs(v) < 0.01 && v !== 0)) ? v.toExponential(1) : v;
        ctx.fillText(fmt(s[s.length-1].v), x0 - 3, y0 + 10);
        ctx.fillText(fmt(s[0].v), x0 - 3, y0 + s.length * 3 + 2);
        ctx.restore();
    }
});

const canvasLayer = new CanvasLayer();
canvasLayer.addTo(map);
window._canvasLayer = canvasLayer;

// ═══════════════════════════════════════════════════════════════════════
//  CAPES DE LÍMITS ADMINISTRATIUS (GeoJSON)
// ═══════════════════════════════════════════════════════════════════════

let capaProvincies = null;
let capaComarques = null;
let geojsonProvincies = null;
let geojsonComarques = null;

const ZOOM_MINIM_COMARQUES = 9;

let _colorGeoJSON = '#000000';
let _opacitatGeoJSON = 80;

function estilLimits() {
    return {
        color: _colorGeoJSON,
        weight: 1.3,
        opacity: _opacitatGeoJSON / 100,
        fillOpacity: 0
    };
}

function carregarCapesGeografiques() {
    fetch('dades/espanya_provincies.geojson')
        .then(r => r.ok ? r.json() : null)
        .then(geojson => {
            if (!geojson) return;
            geojsonProvincies = geojson;
            capaProvincies = L.geoJSON(geojson, {
                pane: 'paneLimits',
                interactive: false,
                style: estilLimits
            }).addTo(map);
        })
        .catch(err => console.warn('[GeoJSON] No s\'han pogut carregar les províncies:', err));

    fetch('dades/girona_comarques.geojson')
        .then(r => r.ok ? r.json() : null)
        .then(geojson => {
            if (!geojson) return;
            geojsonComarques = geojson;
            capaComarques = L.geoJSON(geojson, {
                pane: 'paneLimits',
                interactive: false,
                style: estilLimits
            });
            actualitzarVisibilitatComarques();
        })
        .catch(err => console.warn('[GeoJSON] No s\'han pogut carregar les comarques:', err));
}

function actualitzarVisibilitatComarques() {
    if (!capaComarques) return;
    const visible = map.getZoom() >= ZOOM_MINIM_COMARQUES;
    if (visible && !map.hasLayer(capaComarques)) {
        capaComarques.addTo(map);
    } else if (!visible && map.hasLayer(capaComarques)) {
        map.removeLayer(capaComarques);
    }
}

function actualitzarEstilLimits() {
    if (capaProvincies) capaProvincies.setStyle(estilLimits());
    if (capaComarques) capaComarques.setStyle(estilLimits());
}

map.on('zoomend', actualitzarVisibilitatComarques);

// ═══════════════════════════════════════════════════════════════════════
//  CLICK AL MAPA — llegir el valor de la variable activa al punt clicat
// ═══════════════════════════════════════════════════════════════════════

function trobarIndexMesProper(array, valor, descendent) {
    let millor = 0, millorDiff = Infinity;
    for (let i = 0; i < array.length; i++) {
        const diff = Math.abs(array[i] - valor);
        if (diff < millorDiff) { millorDiff = diff; millor = i; }
    }
    return millor;
}

function llegirValorAlPunt(lat, lon) {
    const item = totesLesHores[curIdx];
    if (!item) return null;

    const data = item.data;
    const lats = data.coordenadas.lat;
    const lons = data.coordenadas.lon;
    const varInfo = data.variables[variableActiva];
    if (!varInfo || !varInfo.datos) return null;

    const latMin = Math.min(lats[0], lats[lats.length - 1]);
    const latMax = Math.max(lats[0], lats[lats.length - 1]);
    const lonMin = Math.min(lons[0], lons[lons.length - 1]);
    const lonMax = Math.max(lons[0], lons[lons.length - 1]);
    if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) return null;

    const i = trobarIndexMesProper(lats, lat);
    const j = trobarIndexMesProper(lons, lon);
    const Nlon = lons.length;
    const valor = varInfo.datos[i * Nlon + j];

    return (valor === null || isNaN(valor)) ? null : valor;
}

let marcadorClic = null;

map.on('click', function(e) {
    const { lat, lng } = e.latlng;
    const valor = llegirValorAlPunt(lat, lng);
    const pal = getPaletaPer(variableActiva);

    const contingut = valor === null
        ? `<div class="popup-clic-titol">${pal.titol}</div><div class="popup-clic-valor">Sense dades</div>`
        : `<div class="popup-clic-titol">${pal.titol}</div>
           <div><span class="popup-clic-valor">${formatarValorPopup(valor)}</span><span class="popup-clic-unitat">${pal.unitat}</span></div>`;

    const html = `${contingut}<div class="popup-clic-coords">${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E</div>`;

    if (marcadorClic) map.removeLayer(marcadorClic);
    marcadorClic = L.popup({ closeButton: true, className: 'popup-clic' })
        .setLatLng(e.latlng)
        .setContent(html)
        .openOn(map);
});

function formatarValorPopup(v) {
    if (Math.abs(v) >= 10000 || (Math.abs(v) < 0.001 && v !== 0)) return v.toExponential(2);
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════════
//  SELECTOR ESTIL WINDOWS 95/98 — mapa de fons + color/opacitat de línies + vent
// ═══════════════════════════════════════════════════════════════════════

function construirSelectorWin95() {
    const runInfo = document.querySelector('.topnav-run');
    if (!runInfo || !runInfo.parentElement) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'win95-selector';
    wrapper.innerHTML = `
        <button id="win95-toggle">🗺 Mapa i eines ▾</button>
        <div id="win95-panel">
            <div class="win95-titlebar">
                <span>Configuració del mapa</span>
                <div class="close" id="win95-close">×</div>
            </div>
            <div class="win95-body">
                <div class="win95-section-label">Mapa de fons</div>
                <div class="win95-basemap-list" id="win95-basemap-list"></div>

                <div class="win95-section-label">Línies (comarques / províncies)</div>
                <div class="win95-row">
                    <span>Color:</span>
                    <input type="color" id="win95-color" value="${_colorGeoJSON}">
                    <span>Opacitat:</span>
                    <input type="range" id="win95-opacitat" min="0" max="100" value="${_opacitatGeoJSON}">
                    <span class="valor-num" id="win95-opacitat-valor">${_opacitatGeoJSON}%</span>
                </div>

                <div class="win95-section-label">Vent (streamlines / partícules)</div>
                <div class="win95-row">
                    <button id="win95-vent-toggle" class="win95-btn">${window.ventEnabled ? '✅ Vent: Actiu' : '❌ Vent: Inactiu'}</button>
                    <button id="win95-vent-mode" class="win95-btn">Mode: ${window.ventMode === 'streamlines' ? 'Streamlines' : 'Partícules'}</button>
                </div>
                <div class="win95-row">
                    <span>Color:</span>
                    <select id="win95-vent-color">
                        <option value="white" ${wCfg.streamlineColor === 'white' ? 'selected' : ''}>Blanc</option>
                        <option value="black" ${wCfg.streamlineColor === 'black' ? 'selected' : ''}>Negre</option>
                    </select>
                    <span>Gruix:</span>
                    <input type="range" id="win95-vent-width" min="0.5" max="3" step="0.1" value="${wCfg.streamlineWidth}">
                    <span class="valor-num" id="win95-vent-width-valor">${wCfg.streamlineWidth}</span>
                </div>
                <div class="win95-row">
                    <span>Opacitat:</span>
                    <input type="range" id="win95-vent-opacity" min="0.3" max="1" step="0.05" value="${wCfg.streamlineOpacity}">
                    <span class="valor-num" id="win95-vent-opacity-valor">${Math.round(wCfg.streamlineOpacity * 100)}%</span>
                </div>
            </div>
        </div>
    `;

    runInfo.parentElement.insertBefore(wrapper, runInfo);

    // Omplir llista de mapes de fons
    const llista = wrapper.querySelector('#win95-basemap-list');
    Object.entries(MAPES_FONS).forEach(([clau, entrada]) => {
        const item = document.createElement('div');
        item.className = 'win95-basemap-item' + (clau === mapaFonsActiu ? ' actiu' : '');
        item.dataset.clau = clau;
        item.textContent = entrada.nom;
        item.onclick = () => {
            activarMapaFons(clau);
            llista.querySelectorAll('.win95-basemap-item').forEach(el => {
                el.classList.toggle('actiu', el.dataset.clau === clau);
            });
        };
        llista.appendChild(item);
    });

    // Toggle obrir/tancar panell
    const toggle = wrapper.querySelector('#win95-toggle');
    const panel = wrapper.querySelector('#win95-panel');
    toggle.onclick = (e) => {
        e.stopPropagation();
        panel.classList.toggle('oberto');
    };
    wrapper.querySelector('#win95-close').onclick = () => panel.classList.remove('oberto');
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) panel.classList.remove('oberto');
    });

    // Color de les línies
    wrapper.querySelector('#win95-color').addEventListener('input', (e) => {
        _colorGeoJSON = e.target.value;
        actualitzarEstilLimits();
    });

    // Opacitat de les línies
    const rangOpacitat = wrapper.querySelector('#win95-opacitat');
    const valorOpacitat = wrapper.querySelector('#win95-opacitat-valor');
    rangOpacitat.addEventListener('input', (e) => {
        _opacitatGeoJSON = parseInt(e.target.value, 10);
        valorOpacitat.textContent = _opacitatGeoJSON + '%';
        actualitzarEstilLimits();
    });

    // ─── Controls de vent ───
    const btnVentToggle = wrapper.querySelector('#win95-vent-toggle');
    btnVentToggle.addEventListener('click', () => {
        window.ventEnabled = !window.ventEnabled;
        btnVentToggle.textContent = window.ventEnabled ? '✅ Vent: Actiu' : '❌ Vent: Inactiu';
        if (!window.ventEnabled) _stopParticles();
        if (window._canvasLayer) {
            window._canvasLayer._needsRedraw = true;
            window._canvasLayer._render();
        }
    });

    const btnVentMode = wrapper.querySelector('#win95-vent-mode');
    btnVentMode.addEventListener('click', () => {
        window.toggleVentMode();
        btnVentMode.textContent = 'Mode: ' + (window.ventMode === 'streamlines' ? 'Streamlines' : 'Partícules');
    });

    // Color del vent
    wrapper.querySelector('#win95-vent-color').addEventListener('change', (e) => {
        wCfg.streamlineColor = e.target.value;
        wCfg.particleColor = e.target.value;
        if (window._canvasLayer) {
            window._canvasLayer._needsRedraw = true;
            window._canvasLayer._render();
        }
    });

    // Gruix del vent (streamlines)
    const rangVentWidth = wrapper.querySelector('#win95-vent-width');
    const valorVentWidth = wrapper.querySelector('#win95-vent-width-valor');
    rangVentWidth.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        wCfg.streamlineWidth = v;
        valorVentWidth.textContent = v;
        if (window._canvasLayer) {
            window._canvasLayer._needsRedraw = true;
            window._canvasLayer._render();
        }
    });

    // Opacitat del vent
    const rangVentOpacity = wrapper.querySelector('#win95-vent-opacity');
    const valorVentOpacity = wrapper.querySelector('#win95-vent-opacity-valor');
    rangVentOpacity.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        wCfg.streamlineOpacity = v;
        wCfg.particleOpacity = v;
        valorVentOpacity.textContent = Math.round(v * 100) + '%';
        if (window._canvasLayer) {
            window._canvasLayer._needsRedraw = true;
            window._canvasLayer._render();
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════
//  CÀRREGA DE JSONs
// ═══════════════════════════════════════════════════════════════════════

let totesLesHores = [];
let curIdx = 0;

async function carregarTotsJSONs() {
    const base = 'web_data/';
    const promises = [];

    for (let i = 0; i < 52; i++) {
        const url = base + String(i).padStart(2, '0') + '.json';
        promises.push(fetch(url).then(r => r.ok ? r.json() : null).catch(() => null));
    }

    const results = await Promise.all(promises);
    totesLesHores = results.filter(d => d !== null).map(d => ({
        data: d,
        dateObj: new Date(d.hora_utc)
    }));
    totesLesHores.sort((a, b) => a.dateObj - b.dateObj);

    console.log(`[JSON] ${totesLesHores.length} hores carregades`);

    ocultarCarregant();

    if (totesLesHores.length > 0) {
        const ara = new Date();
        let best = 0, bestDiff = Infinity;
        totesLesHores.forEach((item, i) => {
            const diff = Math.abs(item.dateObj - ara);
            if (diff < bestDiff) { bestDiff = diff; best = i; }
        });
        construirGraellaHores();
        construirPanellParametres();
        mostrarHora(best);
    }
}

function ocultarCarregant() {
    const el = document.getElementById('loading_overlay');
    if (el) el.style.display = 'none';
}

function mostrarHora(idx) {
    if (!totesLesHores[idx]) return;
    curIdx = idx;

    // Extreure vent abans de renderitzar
    _extreureVentSuperficie(idx);

    canvasLayer.setData(totesLesHores[idx].data, idx);

    // Les partícules s'actualitzen dins de setData → _render
    // Però necessitem assegurar-nos que el canvas de partícules es redimensiona
    if (window.ventEnabled && window.ventMode === 'particles' && window.SFC_DATA) {
        window.drawVent(null, idx, map, 'surface');
    }

    document.querySelectorAll('.fh-cell').forEach((el) => {
        el.classList.toggle('fh-selected', parseInt(el.dataset.idx, 10) === idx);
    });

    const activa = document.querySelector('.fh-cell.fh-selected');
    if (activa) activa.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const d = totesLesHores[idx].dateObj;
    const dataStr = d.toLocaleDateString('ca-ES', {weekday:'short', day:'numeric', month:'short'});
    const localStr = String(d.getHours()).padStart(2,'0') + ':00';
    const utcStr = String(d.getUTCHours()).padStart(2,'0') + 'Z';

    const elDate = document.getElementById('overlay-date');
    const elLocal = document.getElementById('overlay-local');
    const elUtc = document.getElementById('overlay-utc');
    if (elDate) elDate.textContent = dataStr.toUpperCase();
    if (elLocal) elLocal.textContent = localStr;
    if (elUtc) elUtc.textContent = utcStr;

    const validText = document.getElementById('fh_validtime');
    if (validText) validText.textContent = `${dataStr} · ${localStr} local / ${utcStr}`;
}

// ─── Graella de forecast hours ───────────────────────────────────────
function construirGraellaHores() {
    const grid = document.getElementById('fh_grid');
    if (!grid) return;
    grid.innerHTML = '';

    const PER_FILA = 8;
    let filaActual = null;

    totesLesHores.forEach((item, i) => {
        if (i % PER_FILA === 0) {
            filaActual = document.createElement('div');
            filaActual.className = 'fh-row';
            grid.appendChild(filaActual);
        }
        const d = item.dateObj;
        const h = String(d.getHours()).padStart(2, '0');
        const cell = document.createElement('div');
        cell.className = 'fh-cell';
        cell.dataset.idx = i;
        cell.title = d.toLocaleString('ca-ES');
        cell.innerHTML = `<div class="fh-cell-inner">${h}h</div>`;
        cell.onclick = () => mostrarHora(i);
        filaActual.appendChild(cell);
    });
}

// ─── Panell lateral de paràmetres ───────────────────────────────────
function construirPanellParametres() {
    const cont = document.getElementById('parameter_selection');
    if (!cont || !totesLesHores[0]) return;
    cont.innerHTML = '';

    const totesLesClausDisponibles = Object.keys(totesLesHores[0].data.variables);

    Object.entries(GRUPS_VARIABLES).forEach(([nomGrup, clausBase]) => {
        const entrades = [];

        clausBase.forEach(clauBase => {
            if (totesLesClausDisponibles.includes(clauBase)) {
                entrades.push(clauBase);
            }
            const clausNivell = totesLesClausDisponibles
                .filter(c => c.startsWith(clauBase + '_'))
                .sort((a, b) => {
                    const na = parseFloat(a.slice(clauBase.length + 1));
                    const nb = parseFloat(b.slice(clauBase.length + 1));
                    return nb - na;
                });
            clausNivell.forEach(c => entrades.push(c));
        });

        if (entrades.length === 0) return;

        const h3 = document.createElement('h3');
        h3.className = 'param-group-title';
        h3.textContent = nomGrup;
        cont.appendChild(h3);

        const llista = document.createElement('div');
        llista.className = 'param-group-list';

        entrades.forEach(clau => {
            const info = totesLesHores[0].data.variables[clau];
            const row = document.createElement('div');
            row.className = 'param-row';
            row.dataset.clau = clau;
            row.innerHTML = `<div class="param-link">${info.nombre} <span class="param-unit">(${info.unidades})</span></div>`;
            row.onclick = () => seleccionarVariable(clau);
            llista.appendChild(row);
        });

        cont.appendChild(llista);
    });

    if (totesLesClausDisponibles.includes('t2m')) {
        seleccionarVariable('t2m', true);
    }
}

function seleccionarVariable(clau, silenciós) {
    variableActiva = clau;

    document.querySelectorAll('.param-row').forEach(el => {
        el.classList.toggle('param-selected', el.dataset.clau === clau);
    });

    canvasLayer._needsRedraw = true;
    canvasLayer._render();

    if (!silenciós) {
        const actiu = document.querySelector('.param-row.param-selected');
        if (actiu) actiu.scrollIntoView({ block: 'nearest' });
    }
}

function actualitzarCapcaleraParametre() {
    const pal = getPaletaPer(variableActiva);
    const label = document.getElementById('parameter_menu_link');
    if (label) label.textContent = `${pal.titol} (${pal.unitat})`;
}

// ═══════════════════════════════════════════════════════════════════════
//  CONTROLS
// ═══════════════════════════════════════════════════════════════════════

document.getElementById('btnPrev').addEventListener('click', () => {
    mostrarHora((curIdx - 1 + totesLesHores.length) % totesLesHores.length);
});
document.getElementById('btnNext').addEventListener('click', () => {
    mostrarHora((curIdx + 1) % totesLesHores.length);
});

let animTimer = null, isPlaying = false;
document.getElementById('btnPlay').addEventListener('click', function() {
    if (isPlaying) {
        clearInterval(animTimer);
        isPlaying = false;
        this.textContent = '▶ Animació';
    } else {
        isPlaying = true;
        this.textContent = '⏹ Aturar';
        animTimer = setInterval(() => {
            mostrarHora((curIdx + 1) % totesLesHores.length);
        }, 600);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') mostrarHora((curIdx - 1 + totesLesHores.length) % totesLesHores.length);
    if (e.key === 'ArrowRight') mostrarHora((curIdx + 1) % totesLesHores.length);
});

// ─── Cercador de paràmetres ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const cercador = document.getElementById('parameter_search');
    if (!cercador) return;
    cercador.addEventListener('input', () => {
        const q = cercador.value.trim().toLowerCase();
        document.querySelectorAll('.param-row').forEach(row => {
            const match = row.textContent.toLowerCase().includes(q);
            row.style.display = match ? '' : 'none';
        });
        document.querySelectorAll('.param-group-title').forEach(title => {
            const llista = title.nextElementSibling;
            const teVisibles = llista && Array.from(llista.children).some(r => r.style.display !== 'none');
            title.style.display = teVisibles ? '' : 'none';
            if (llista) llista.style.display = teVisibles ? '' : 'none';
        });
    });
});

// ─── INICI ──────────────────────────────────────────────────────────
carregarCapesGeografiques();
construirSelectorWin95();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarTotsJSONs);
} else {
    carregarTotsJSONs();
}

// Netejar partícules en canviar de pàgina o tancar
window.addEventListener('beforeunload', _stopParticles);