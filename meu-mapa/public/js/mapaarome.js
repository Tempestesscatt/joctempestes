// ═══════════════════════════════════════════════════════════════════════
//  mapaarome.js — VERSIÓ FUNCIONAL (Sense Memory Manager)
// ═══════════════════════════════════════════════════════════════════════

const REGION = {
    name: "Europa Occidental",
    lon_min: -10.0,
    lon_max: 12.0,
    lat_min: 38.0,
    lat_max: 55.0
};

const MAX_STEPS = 52;
const DADES_PATH = 'web_data_arome';

const VARS_SENSE_VENT = [
    'rain', 'rain_1h', 'snow', 'graupel', 
    'tp', 'tgrp', 'tsnowp', 'precip_water',
    'low_cloud_cover', 'medium_cloud_cover', 'high_cloud_cover',
    'spbl', 'cin',
    'pressure_msl', 'sp',
    'el_m', 'reflectivity_dbz', 'lightning','lcl_m','lfc_m',
    'geopotencial_500', 'temperatura_500','cape'
];

window.ventEnabled = true;
window.ventMode = 'streamlines';

const wCfg = {
    streamlineColor: 'black',
    streamlineOpacity: 0.7,
    streamlineWidth: 1.2,
};

const BOUNDS_MAPA_BASE = [[38.0, -10.0], [55.0, 12.0]];
const MAPES_BASE = { cartopy: { nom: 'Mapa físic (Cartopy)' } };
let mapaBaseActiva = 'cartopy';

const map = L.map('map', {
    crs: L.CRS.EPSG3857,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    minZoom: 4,
    maxZoom: 19,
}).setView([46.5, 2.0], 5);

let capaMapaBase = L.imageOverlay('web_data_arome/mapa_base.png', BOUNDS_MAPA_BASE, {
    opacity: 1
}).addTo(map);

map.createPane('paneDades');
map.getPane('paneDades').style.zIndex = 400;
map.getPane('paneDades').style.pointerEvents = 'none';

map.createPane('paneVent');
map.getPane('paneVent').style.zIndex = 500;
map.getPane('paneVent').style.pointerEvents = 'none';

map.createPane('paneIsohipses');
map.getPane('paneIsohipses').style.zIndex = 600;
map.getPane('paneIsohipses').style.pointerEvents = 'none';

map.createPane('paneGeojson');
map.getPane('paneGeojson').style.zIndex = 700;
map.getPane('paneGeojson').style.pointerEvents = 'none';

// ═══════════════════════════════════════════════════════════════════════
//  PALETES (COMPLETES)
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
    {v:-5,r:200,g:0,b:0},{v:-2,r:255,g:120,b:0},{v:-0.5,r:255,g:220,b:150},
    {v:0,r:230,g:230,b:230},{v:0.5,r:150,g:220,b:255},{v:2,r:0,g:150,b:255},
    {v:5,r:0,g:0,b:200}
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
    {v:0,r:0,g:0,b:0,a:0},{v:0.1,r:255,g:255,b:180},{v:0.5,r:255,g:255,b:120},
    {v:1,r:255,g:255,b:0},{v:2,r:255,g:210,b:0},{v:5,r:255,g:170,b:0},
    {v:10,r:255,g:120,b:0},{v:20,r:255,g:60,b:0},{v:35,r:230,g:0,b:0},
    {v:50,r:180,g:0,b:60},{v:75,r:150,g:0,b:140},{v:100,r:130,g:0,b:200}
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
    {v:-1500,r:0,g:0,b:40},{v:-1000,r:0,g:0,b:120},{v:-800,r:20,g:0,b:180},
    {v:-600,r:60,g:0,b:200},{v:-500,r:100,g:0,b:140},{v:-400,r:140,g:0,b:80},
    {v:-350,r:170,g:0,b:30},{v:-300,r:200,g:0,b:0},{v:-275,r:230,g:0,b:0},
    {v:-250,r:255,g:30,b:0},{v:-225,r:255,g:80,b:0},{v:-200,r:255,g:130,b:0},
    {v:-175,r:255,g:180,b:0},{v:-150,r:255,g:220,b:0},{v:-125,r:255,g:255,b:0},
    {v:-100,r:200,g:255,b:0},{v:-75,r:0,g:255,b:0},{v:-50,r:100,g:255,b:100},
    {v:-25,r:180,g:255,b:180},{v:0,r:255,g:255,b:255},{v:25,r:180,g:255,b:180},
    {v:50,r:100,g:255,b:100},{v:75,r:0,g:255,b:0},{v:100,r:200,g:255,b:0},
    {v:125,r:255,g:255,b:0},{v:150,r:255,g:220,b:0},{v:175,r:255,g:180,b:0},
    {v:200,r:255,g:130,b:0},{v:225,r:255,g:80,b:0},{v:250,r:255,g:30,b:0},
    {v:275,r:230,g:0,b:0},{v:300,r:200,g:0,b:0},{v:350,r:170,g:0,b:30},
    {v:400,r:140,g:0,b:80},{v:500,r:100,g:0,b:140},{v:600,r:60,g:0,b:200},
    {v:800,r:20,g:0,b:180},{v:1000,r:0,g:0,b:120},{v:1500,r:0,g:0,b:40}
];

const STOPS_SHEAR = [
    {v:0,r:0,g:0,b:255},{v:2,r:0,g:200,b:255},{v:4,r:0,g:255,b:200},
    {v:6,r:0,g:255,b:100},{v:8,r:0,g:255,b:0},{v:10,r:150,g:255,b:0},
    {v:12,r:220,g:255,b:0},{v:14,r:255,g:255,b:0},{v:16,r:255,g:220,b:0},
    {v:18,r:255,g:180,b:0},{v:20,r:255,g:140,b:0},{v:22,r:255,g:90,b:0},
    {v:24,r:255,g:40,b:0},{v:26,r:255,g:0,b:0},{v:28,r:230,g:0,b:30},
    {v:30,r:210,g:0,b:80},{v:32,r:180,g:0,b:140},{v:34,r:150,g:0,b:200},
    {v:36,r:120,g:0,b:240},{v:38,r:80,g:0,b:255},{v:40,r:40,g:0,b:255},
    {v:44,r:0,g:0,b:220},{v:48,r:0,g:0,b:180},{v:52,r:20,g:0,b:130},
    {v:56,r:40,g:0,b:80},{v:60,r:60,g:0,b:0},{v:70,r:0,g:0,b:0}
];

const PALETES = {
    st: {titol:'Temperatura 2m', unitat:'°C', stops:STOPS_TEMP},
    sd: {titol:'Punt rosada 2m', unitat:'°C', stops:STOPS_TEMP},
    srh: {titol:'Humitat 2m', unitat:'%', stops:STOPS_HUMITAT},
    temp_min2m: {titol:'Temp. mín. 2m', unitat:'°C', stops:STOPS_TEMP},
    temp_max2m: {titol:'Temp. màx. 2m', unitat:'°C', stops:STOPS_TEMP},
    su: {titol:'Vent U 10m', unitat:'m/s', stops:STOPS_VENT_UV},
    sv: {titol:'Vent V 10m', unitat:'m/s', stops:STOPS_VENT_UV},
    wind_speed_10m: {titol:'Vent 10m', unitat:'km/h', stops:STOPS_RATXA},
    sp: {titol:'Pressió superf.', unitat:'hPa', stops:STOPS_PRESSIO},
    pressure_msl: {titol:'Pressió MSL', unitat:'hPa', stops:STOPS_PRESSIO},
    cape: {titol:'CAPE', unitat:'J/kg', stops:STOPS_CAPE},
    cin: {titol:'CIN', unitat:'J/kg', stops:STOPS_CIN},
    spbl: {titol:'Capa límit', unitat:'m', stops:STOPS_ALTURA_CL},
    wind_gust: {titol:'Ratxa 10m', unitat:'km/h', stops:STOPS_RATXA},
    low_cloud_cover: {titol:'Nuvols baixos', unitat:'%', stops:STOPS_NUVOLS},
    medium_cloud_cover: {titol:'Nuvols mitjans', unitat:'%', stops:STOPS_NUVOLS},
    high_cloud_cover: {titol:'Nuvols alts', unitat:'%', stops:STOPS_NUVOLS},
    rain: {titol:'Pluja 1h (WCS)', unitat:'mm', stops:STOPS_PRECIP},
    rain_1h: {titol:'Pluja acum. 1h', unitat:'mm', stops:STOPS_PRECIP},
    snow: {titol:'Neu 1h (WCS)', unitat:'mm', stops:STOPS_PRECIP},
    graupel: {titol:'Calamarsa 1h (WCS)', unitat:'mm', stops:STOPS_PRECIP},
    tp: {titol:'Precip. total acum.', unitat:'mm', stops:STOPS_PRECIP},
    tgrp: {titol:'Calamarsa/graupel acum.', unitat:'mm', stops:STOPS_PRECIP},
    tsnowp: {titol:'Neu total acum.', unitat:'mm', stops:STOPS_PRECIP},
    precip_water: {titol:'Aigua precipitable', unitat:'mm', stops:STOPS_HUMITAT},
    reflectivity_dbz: {titol:'Reflectivitat', unitat:'dBZ', stops:STOPS_DBZ},
    lightning: {titol:'Llamps acum. 1h', unitat:'imp./m²', stops:STOPS_LLAMPS},
    geopotencial_500: {titol:'Geopotencial 500hPa', unitat:'dam', stops:STOPS_GEO500},
    temperatura_500: {titol:'Temperatura 500hPa', unitat:'°C', stops:STOPS_T500},
    t: {titol:'Temperatura', unitat:'°C', stops:STOPS_TEMP_ALT},
    u: {titol:'Vent U', unitat:'m/s', stops:STOPS_VENT_UV},
    v: {titol:'Vent V', unitat:'m/s', stops:STOPS_VENT_UV},
    wind_speed: {titol:'Vent', unitat:'km/h', stops:STOPS_RATXA},
    r: {titol:'Humitat', unitat:'%', stops:STOPS_HUMITAT},
    w: {titol:'Vel. vertical', unitat:'Pa/s', stops:STOPS_VEL_VERT},
    dpt: {titol:'Punt rosada', unitat:'°C', stops:STOPS_TEMP_ALT},
    pv: {titol:'Vort. potencial', unitat:'PVU', stops:STOPS_VORT_POT},
    lcl_m: {titol:'LCL (alçada)', unitat:'m', stops:STOPS_ALTURA_CL},
    lfc_m: {titol:'LFC (alçada)', unitat:'m', stops:STOPS_ALTURA_CL},
    lifted_index: {titol:'Lifted Index', unitat:'°C', stops:STOPS_LI},
    el_m: {titol:'Equilibrium Level', unitat:'m', stops:STOPS_ALTURA_CL},
    srh_01: {titol:'SRH 0-1km', unitat:'m²/s²', stops:STOPS_SRH},
    srh_03: {titol:'SRH 0-3km', unitat:'m²/s²', stops:STOPS_SRH},
    shear_03: {titol:'Shear 0-3km', unitat:'m/s', stops:STOPS_SHEAR},
    shear_06: {titol:'Shear 0-6km', unitat:'m/s', stops:STOPS_SHEAR}
};

const GRUP_PRINCIPAL = ['st', 'sd', 'srh', 'temp_min2m', 'temp_max2m'];

const GRUPS_SIMPLES = {
    'Vent superfície': ['wind_speed_10m', 'wind_gust'],
    'Pressió': ['pressure_msl', 'sp'],
    'Precipitació': ['rain', 'tp', 'tgrp', 'tsnowp'],
    'Núvols': ['low_cloud_cover', 'medium_cloud_cover', 'high_cloud_cover'],
    'Inestabilitat': ['cape', 'spbl', 'lcl_m', 'lfc_m', 'lifted_index', 'el_m'],
    'Reflectivitat i llamps': ['reflectivity_dbz', 'lightning'],
    'Humitat': ['precip_water'],
    '500 hPa': ['geopotencial_500', 'temperatura_500'],
    'Severitat': ['srh_01', 'srh_03', 'shear_03', 'shear_06']
};

const GRUPS_ACORDIO = {
    'Temperatura': ['t'],
    'Punt rosada': ['dpt'],
    'Humitat': ['r'],
    'Vent (nivells)': ['wind_speed'],
    'Vel. vertical': ['w'],
    'Vort. potencial': ['pv']
};

const CLAUS_3D = new Set(['t','u','v','r','w','dpt','pv','wind_speed']);
const VARIABLES_AMAGADES = new Set(['su','sv','u','v','sh2','geo_h']);

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
    if (PALETES[c]) return c;
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

function calcularVelocitatVent(variables) {
    if (variables['su'] && variables['sv']) {
        const u = variables['su'].datos;
        const v = variables['sv'].datos;
        if (u.length === v.length) {
            variables['wind_speed_10m'] = {
                nombre: 'Vent 10m', unidades: 'km/h',
                datos: u.map((valU, i) => {
                    if (valU === null || v[i] === null || isNaN(valU) || isNaN(v[i])) return null;
                    return Math.round(Math.sqrt(valU*valU + v[i]*v[i]) * 3.6 * 10) / 10;
                })
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
                variables[`wind_speed_${nivell}`] = {
                    nombre: `Vent @ ${nivell}hPa`, unidades: 'km/h',
                    datos: u.map((valU, i) => {
                        if (valU === null || v[i] === null || isNaN(valU) || isNaN(v[i])) return null;
                        return Math.round(Math.sqrt(valU*valU + v[i]*v[i]) * 3.6 * 10) / 10;
                    })
                };
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════
//  OBTENIR VENT PER STREAMLINES
// ═══════════════════════════════════════════════════════════════════════

function obtenirVentPerStreamlines(data, clau) {
    const coords = getCoordenadesPer(data, clau);
    if (!coords) return null;
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
        'temp_min2m','temp_max2m',
        'geopotencial_500','temperatura_500'
    ];

    if (varsSuperficie.includes(base) || varsSuperficie.includes(clau)) {
        clauU = 'su'; clauV = 'sv';
    } else if (base === 'wind_speed') {
        const m = clau.match(/_(\d+)$/);
        if (m) { clauU = `u_${m[1]}`; clauV = `v_${m[1]}`; }
    } else {
        const m = clau.match(/_(\d+)$/);
        if (m) { clauU = `u_${m[1]}`; clauV = `v_${m[1]}`; }
        else { clauU = 'su'; clauV = 'sv'; }
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
    return { lats, lons, Nlat, Nlon, speed, dir, extent: [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)] };
}

// ═══════════════════════════════════════════════════════════════════════
//  CANVAS VENT + STREAMLINES
// ═══════════════════════════════════════════════════════════════════════

let canvasVent = null;
let ctxVent = null;
let canvasIsohipses = null;
let ctxIsohipses = null;

function _hauriaDeDibuixarVent() {
    if (!window.ventEnabled) return false;
    if (!totesLesHores[curIdx] || !totesLesHores[curIdx].data) return false;
    const base = clauBase(variableActiva);
    for (const v of VARS_SENSE_VENT) {
        if (base === v) return false;
        if (variableActiva.startsWith(v + '_')) return false;
    }
    const data = totesLesHores[curIdx].data;
    return !!(data.variables && (data.variables['su'] || data.variables['u']));
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
    if (!data || !data.variables) return;
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
            u: (1-ty)*((1-tx)*a.u+tx*b.u) + ty*((1-tx)*c.u+tx*d.u),
            v: (1-ty)*((1-tx)*a.v+tx*b.v) + ty*((1-tx)*c.v+tx*d.v)
        };
    }

    const STEP = 28, STEP_LEN = 2.5, MAX_STEPS_LINE = 45, GRID = 8;
    const gw = Math.floor(w / GRID) + 1;
    const gh = Math.floor(h / GRID) + 1;
    const visited = new Uint8Array(gw * gh);
    const strokeColor = wCfg.streamlineColor === 'white' 
        ? `rgba(255,255,255,${wCfg.streamlineOpacity})` 
        : `rgba(0,0,0,${wCfg.streamlineOpacity})`;

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = wCfg.streamlineWidth;
    ctx.strokeStyle = strokeColor;

    for (let py = 0; py < h; py += STEP) {
        for (let px = 0; px < w; px += STEP) {
            let sx = px + (Math.random()-0.5)*STEP*0.6;
            let sy = py + (Math.random()-0.5)*STEP*0.6;
            const gx0 = Math.floor(sx/GRID), gy0 = Math.floor(sy/GRID);
            if (gy0<0||gy0>=gh||gx0<0||gx0>=gw) continue;
            if (visited[gy0*gw+gx0]) continue;

            const fwd=[], back=[];
            let cx=sx, cy=sy;
            for (let s=0; s<MAX_STEPS_LINE; s++) {
                const uv=sampleUV(cx,cy);
                if (!uv) break;
                const mag=Math.hypot(uv.u,uv.v);
                if (mag<0.2) break;
                cx+=(uv.u/mag)*STEP_LEN; cy-=(uv.v/mag)*STEP_LEN;
                const gx=Math.floor(cx/GRID), gy=Math.floor(cy/GRID);
                if (gy<0||gy>=gh||gx<0||gx>=gw) break;
                if (visited[gy*gw+gx]) break;
                fwd.push([cx,cy]);
            }
            cx=sx; cy=sy;
            for (let s=0; s<MAX_STEPS_LINE; s++) {
                const uv=sampleUV(cx,cy);
                if (!uv) break;
                const mag=Math.hypot(uv.u,uv.v);
                if (mag<0.2) break;
                cx-=(uv.u/mag)*STEP_LEN; cy+=(uv.v/mag)*STEP_LEN;
                const gx=Math.floor(cx/GRID), gy=Math.floor(cy/GRID);
                if (gy<0||gy>=gh||gx<0||gx>=gw) break;
                if (visited[gy*gw+gx]) break;
                back.push([cx,cy]);
            }
            const line=[...back.reverse(),[sx,sy],...fwd];
            if (line.length<=12) continue;
            for (let i=0; i<line.length; i+=3) {
                const gx=Math.floor(line[i][0]/GRID), gy=Math.floor(line[i][1]/GRID);
                if (gy>=0&&gy<gh&&gx>=0&&gx<gw) visited[gy*gw+gx]=1;
            }
            ctx.beginPath(); ctx.moveTo(line[0][0],line[0][1]);
            for (let i=1; i<line.length-1; i++) {
                const mx=(line[i][0]+line[i+1][0])/2, my=(line[i][1]+line[i+1][1])/2;
                ctx.quadraticCurveTo(line[i][0],line[i][1],mx,my);
            }
            ctx.stroke();
            if (line.length>25) {
                const step=Math.floor(line.length/4);
                for (let i=step; i<line.length-3; i+=step) {
                    const p0=line[i], p1=line[i+2];
                    if (p0&&p1) {
                        const a=Math.atan2(p1[1]-p0[1],p1[0]-p0[0]);
                        ctx.beginPath();
                        ctx.moveTo(p0[0],p0[1]);
                        ctx.lineTo(p0[0]-4*Math.cos(a-0.6),p0[1]-4*Math.sin(a-0.6));
                        ctx.moveTo(p0[0],p0[1]);
                        ctx.lineTo(p0[0]-4*Math.cos(a+0.6),p0[1]-4*Math.sin(a+0.6));
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
    map.on('moveend', _redibuixarCanvasVent);
    map.on('zoomend', _redibuixarCanvasVent);
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

function redibuixarVent() { _redibuixarCanvasVent(); }

window.toggleVent = function() {
    window.ventEnabled = !window.ventEnabled;
    const btn = document.getElementById('btnVent');
    if (btn) {
        btn.textContent = window.ventEnabled ? '🔵 Vent ON' : '⚪ Vent OFF';
        btn.style.background = window.ventEnabled ? '#2a5a8a' : '#141c2a';
    }
    if (!window.ventEnabled && canvasVent) ctxVent.clearRect(0, 0, canvasVent.width, canvasVent.height);
    if (window.ventEnabled) _redibuixarCanvasVent();
    return window.ventEnabled;
};

window.toggleVentMode = function() {
    window.ventMode = window.ventMode === 'streamlines' ? 'particles' : 'streamlines';
    const btn = document.getElementById('btnVentMode');
    if (btn) btn.textContent = window.ventMode === 'streamlines' ? '〜 Streamlines' : '• Partícules';
    if (window.ventMode !== 'streamlines' && canvasVent) ctxVent.clearRect(0, 0, canvasVent.width, canvasVent.height);
    _redibuixarCanvasVent();
    return window.ventMode;
};

// ═══════════════════════════════════════════════════════════════════════
//  CANVAS LAYER (DADES)
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
        if (!this._data || !this._data.variables) return;
        const coords = getCoordenadesPer(this._data, variableActiva);
        if (!coords) return;
        const lats = coords.lat, lons = coords.lon;
        const Nlat = lats.length, Nlon = lons.length;
        const varInfo = this._data.variables[variableActiva];
        if (!varInfo || !varInfo.datos) { this._needsRedraw = false; return; }
        const dades = varInfo.datos;
        if (dades.length !== Nlat * Nlon) { this._needsRedraw = false; return; }
        const pal = getPaleta(variableActiva);
        if (!this._offscreen || this._offscreen.width !== Nlon || this._offscreen.height !== Nlat) {
            this._offscreen = document.createElement('canvas');
            this._offscreen.width = Nlon;
            this._offscreen.height = Nlat;
        }
        const ctx = this._offscreen.getContext('2d');
        const imgData = ctx.createImageData(Nlon, Nlat);
        const d = imgData.data;
        const CLAUS_TEMP = ['st','sd','t','dpt','temp_min2m','temp_max2m','temperatura_500'];
        const base = clauBase(variableActiva);
        const esTemperatura = CLAUS_TEMP.includes(base);
        for (let i = 0; i < Nlat; i++) {
            const filaReal = (Nlat - 1 - i);
            for (let j = 0; j < Nlon; j++) {
                let v = dades[filaReal * Nlon + j];
                if (esTemperatura && v !== null && !isNaN(v) && v > 100) v = v - 273.15;
                const ii = (i * Nlon + j) * 4;
                if (v === null || isNaN(v)) { d[ii+3] = 0; }
                else {
                    const c = getColor(pal, v);
                    d[ii]=c.r; d[ii+1]=c.g; d[ii+2]=c.b; d[ii+3]=c.a;
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
        canvas.width = size.x; canvas.height = size.y;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0,0]));
        if (!this._offscreen) return;
        const coords = getCoordenadesPer(this._data, variableActiva);
        if (!coords) return;
        const lats = coords.lat, lons = coords.lon;
        const Nlat = lats.length, Nlon = lons.length;
        const offCtx = this._offscreen.getContext('2d');
        const imgData = offCtx.getImageData(0, 0, Nlon, Nlat);
        const outputImgData = ctx.createImageData(size.x, size.y);
        const outData = outputImgData.data;
        const latMin = lats[0], latMax = lats[Nlat-1], lonMin = lons[0], lonMax = lons[Nlon-1];
        for (let py = 0; py < size.y; py++) {
            for (let px = 0; px < size.x; px++) {
                const latlng = map.containerPointToLatLng([px, py]);
                const lat = latlng.lat, lng = latlng.lng;
                if (lng < lonMin || lng > lonMax || lat < Math.min(latMin,latMax) || lat > Math.max(latMin,latMax)) continue;
                const fx = ((lng-lonMin)/(lonMax-lonMin))*(Nlon-1);
                const fy = ((latMax-lat)/(latMax-latMin))*(Nlat-1);
                const x0=Math.floor(fx), y0=Math.floor(fy);
                const x1=Math.min(x0+1,Nlon-1), y1=Math.min(y0+1,Nlat-1);
                const tx=fx-x0, ty=fy-y0;
                const src00=(y0*Nlon+x0)*4, src10=(y0*Nlon+x1)*4;
                const src01=(y1*Nlon+x0)*4, src11=(y1*Nlon+x1)*4;
                const dstIdx=(py*size.x+px)*4;
                for (let c=0; c<4; c++) {
                    const val = (1-ty)*((1-tx)*imgData.data[src00+c]+tx*imgData.data[src10+c]) + ty*((1-tx)*imgData.data[src01+c]+tx*imgData.data[src11+c]);
                    outData[dstIdx+c] = Math.round(val);
                }
            }
        }
        ctx.putImageData(outputImgData, 0, 0);
        this._drawLegend(ctx, getPaleta(variableActiva));
        actualitzarCapcaleraParametre();
        redibuixarVent();
        _redibuixarIsohipses();
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
        ctx.fillStyle = '#fff'; ctx.font = '9px Arial'; ctx.textAlign = 'right';
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
    { id: 'costa', nom: 'Costa', arxiu: 'costa.geojson', color: '#4a7a9a', gruix: 2.0 },
    { id: 'fronteres_paisos', nom: 'Països', arxiu: 'fronteres_paisos.geojson', color: '#5a6a7a', gruix: 1.2 },
    { id: 'fronteres_regions', nom: 'Regions', arxiu: 'fronteres_regions.geojson', color: '#3a4a5a', gruix: 0.6 },
    { id: 'comarques', nom: 'Províncies', arxiu: 'comarques.geojson', color: '#000000', gruix: 0.4 }
];

const capaInstancies = {};

function estilCapa(def) { return { color: def.color, weight: def.gruix, opacity: 0.9, fill: false, interactive: false }; }

async function carregarCapaGeojson(def) {
    try {
        const r = await fetch(`${DADES_PATH}/${def.arxiu}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const geojson = await r.json();
        const capa = L.geoJSON(geojson, { pane: 'paneGeojson', style: () => estilCapa(def), interactive: false });
        capaInstancies[def.id] = capa;
        capa.addTo(map);
    } catch (err) { console.warn('[GeoJSON] ' + def.nom + ': ' + err.message); }
}

async function inicialitzarGeojson() { await Promise.all(GEOJSON_CAPES.map(def => carregarCapaGeojson(def))); }

// ═══════════════════════════════════════════════════════════════════════
//  ISOHIPSES
// ═══════════════════════════════════════════════════════════════════════

function _dibuixarIsohipses() {
    if (!canvasIsohipses) return;
    const ctx = ctxIsohipses;
    const w = canvasIsohipses.width, h = canvasIsohipses.height;
    ctx.clearRect(0, 0, w, h);
    if (variableActiva !== 'temperatura_500') return;
    if (!totesLesHores[curIdx] || !totesLesHores[curIdx].data) return;
    const data = totesLesHores[curIdx].data;
    if (!data || !data.variables || !data.variables['geopotencial_500']) return;
    const geoVar = data.variables['geopotencial_500'];
    if (!geoVar || !geoVar.datos) return;
    const coords = data.coordenadas;
    if (!coords) return;
    const lats = coords.lat, lons = coords.lon;
    const Nlat = lats.length, Nlon = lons.length;
    if (geoVar.datos.length !== Nlat * Nlon) return;
    const geo = new Float32Array(Nlat * Nlon);
    for (let i = 0; i < Nlat; i++) {
        const filaReal = (Nlat - 1 - i);
        for (let j = 0; j < Nlon; j++) {
            const v = geoVar.datos[filaReal * Nlon + j];
            geo[i * Nlon + j] = (v !== null && !isNaN(v) && v > 400 && v < 700) ? v : NaN;
        }
    }
    const nivells = [];
    for (let n = 480; n <= 630; n += 6) nivells.push(n);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const latMax = Math.max(lats[0], lats[Nlat-1]);
    const latMin = Math.min(lats[0], lats[Nlat-1]);
    const lonMin = Math.min(lons[0], lons[Nlon-1]);
    const lonMax = Math.max(lons[0], lons[Nlon-1]);
    for (const nivell of nivells) {
        const punts = marchingSquaresSimple(geo, Nlon, Nlat, nivell);
        if (punts.length < 2) continue;
        ctx.beginPath();
        let first = true;
        for (const pt of punts) {
            const lng = lonMin + (pt.x / (Nlon - 1)) * (lonMax - lonMin);
            const lat = latMax - (pt.y / (Nlat - 1)) * (latMax - latMin);
            const px = map.latLngToContainerPoint(L.latLng(lat, lng));
            if (first) { ctx.moveTo(px.x, px.y); first = false; }
            else ctx.lineTo(px.x, px.y);
        }
        ctx.stroke();
    }
}

function marchingSquaresSimple(data, w, h, nivell) {
    const punts = [];
    for (let y = 0; y < h - 1; y++) {
        for (let x = 0; x < w - 1; x++) {
            const v00 = data[y*w+x], v10 = data[y*w+x+1], v11 = data[(y+1)*w+x+1], v01 = data[(y+1)*w+x];
            if (isNaN(v00)||isNaN(v10)||isNaN(v11)||isNaN(v01)) continue;
            let cas = 0;
            if (v00 >= nivell) cas |= 1;
            if (v10 >= nivell) cas |= 2;
            if (v11 >= nivell) cas |= 4;
            if (v01 >= nivell) cas |= 8;
            if (cas === 0 || cas === 15) continue;
            const pc = [];
            if ((cas&1) !== ((cas&2)>>1)) { const t=(nivell-v00)/(v10-v00); pc.push({x:x+t,y:y}); }
            if ((cas&2) !== ((cas&4)>>1)) { const t=(nivell-v10)/(v11-v10); pc.push({x:x+1,y:y+t}); }
            if (((cas&4)>>2) !== ((cas&8)>>3)) { const t=(nivell-v01)/(v11-v01); pc.push({x:x+(1-t),y:y+1}); }
            if (((cas&8)>>3) !== (cas&1)) { const t=(nivell-v00)/(v01-v00); pc.push({x:x,y:y+t}); }
            if (pc.length >= 2) { punts.push(pc[0]); punts.push(pc[pc.length-1]); }
        }
    }
    return punts;
}

function inicialitzarCanvasIsohipses() {
    if (canvasIsohipses) return;
    canvasIsohipses = document.createElement('canvas');
    canvasIsohipses.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    map.getPane('paneIsohipses').appendChild(canvasIsohipses);
    ctxIsohipses = canvasIsohipses.getContext('2d');
    map.on('moveend', _redibuixarIsohipses);
    map.on('zoomend', _redibuixarIsohipses);
}

function _redibuixarIsohipses() {
    if (!canvasIsohipses) return;
    const size = map.getSize();
    canvasIsohipses.width = size.x;
    canvasIsohipses.height = size.y;
    L.DomUtil.setPosition(canvasIsohipses, map.containerPointToLayerPoint([0, 0]));
    _dibuixarIsohipses();
}

// ═══════════════════════════════════════════════════════════════════════
//  CLICK AL MAPA
// ═══════════════════════════════════════════════════════════════════════

function trobarIndexMesProper(arr, val) {
    let best=0, bestDiff=Infinity;
    for (let i=0;i<arr.length;i++) { const d=Math.abs(arr[i]-val); if (d<bestDiff){bestDiff=d;best=i;} }
    return best;
}

let marcadorClic = null;
map.on('click', function(e) {
    const {lat, lng} = e.latlng;
    const item = totesLesHores[curIdx];
    if (!item || !item.data || !item.data.variables) return;
    const data = item.data;
    const coords = getCoordenadesPer(data, variableActiva);
    if (!coords) return;
    const lats = coords.lat, lons = coords.lon;
    const varInfo = data.variables[variableActiva];
    if (!varInfo || !varInfo.datos) return;
    const latMin = Math.min(lats[0], lats[lats.length-1]), latMax = Math.max(lats[0], lats[lats.length-1]);
    const lonMin = Math.min(lons[0], lons[lons.length-1]), lonMax = Math.max(lons[0], lons[lons.length-1]);
    if (lat<latMin||lat>latMax||lng<lonMin||lng>lonMax) return;
    const i = trobarIndexMesProper(lats, lat), j = trobarIndexMesProper(lons, lng);
    const Nlon = lons.length;
    if (varInfo.datos.length !== lats.length * Nlon) return;
    const latNord = lats[0] > lats[lats.length-1];
    const filaReal = latNord ? (lats.length - 1 - i) : i;
    let v = varInfo.datos[filaReal * Nlon + j];
    const CLAUS_TEMP = ['st','sd','t','dpt','temp_min2m','temp_max2m','temperatura_500'];
    const base = clauBase(variableActiva);
    if (CLAUS_TEMP.includes(base) && v !== null && !isNaN(v) && v > 100) v = v - 273.15;
    const pal = getPaleta(variableActiva);
    const vt = v===null||isNaN(v) ? '—' : (Math.abs(v)>=10000||(Math.abs(v)<0.001&&v!==0)) ? v.toExponential(2) : Number.isInteger(v) ? v.toString() : v.toFixed(1);
    const html = `<div class="popup-meteo"><div class="popup-meteo-header">${pal.titol}</div><div class="popup-meteo-value"><span class="popup-meteo-number">${vt}</span><span class="popup-meteo-unit">${pal.unitat}</span></div><div class="popup-meteo-coords">${lat.toFixed(4)}°N &nbsp;·&nbsp; ${lng.toFixed(4)}°E</div></div>`;
    if (marcadorClic) map.removeLayer(marcadorClic);
    marcadorClic = L.popup({ closeButton: true, className: 'popup-clic', offset: [0, -8] }).setLatLng(e.latlng).setContent(html).openOn(map);
});

// ═══════════════════════════════════════════════════════════════════════
//  CÀRREGA DE JSONs (VERSIÓ ORIGINAL FUNCIONAL)
// ═══════════════════════════════════════════════════════════════════════

let totesLesHores = [];
let curIdx = 0;

async function carregarUnStep(i) {
    const base = `${DADES_PATH}/${String(i).padStart(2,'0')}/`;
    try {
        const statusRes = await fetch(`${base}status.json`);
        if (!statusRes.ok) return null;
        const status = await statusRes.json();
        const fitxers = status.variables_disponibles;
        if (!fitxers || fitxers.length === 0) return null;
        const promeses = fitxers.map(f => fetch(`${base}${f}.js`).then(r => r.ok ? r.json() : null).catch(() => null));
        const resultats = await Promise.all(promeses);
        const variables = {};
        let coordenadas = null, coordenadas_3d = null;
        for (const data of resultats) {
            if (!data || !data.variables) continue;
            if (!coordenadas && data.coordenadas) coordenadas = data.coordenadas;
            if (!coordenadas_3d && data.tipo === '3d' && data.coordenadas) coordenadas_3d = data.coordenadas;
            Object.assign(variables, data.variables);
        }
        if (Object.keys(variables).length === 0) return null;
        calcularVelocitatVent(variables);
        return {
            step: status.step,
            dateObj: new Date(status.hora_utc + 'Z'),
            data: { step: status.step, hora_utc: status.hora_utc, variables, coordenadas, coordenadas_3d }
        };
    } catch (e) { console.error(`Error carregant hora ${i}:`, e); return null; }
}

function afegirHoraCarregada(item) {
    if (!item) return;
    if (totesLesHores.some(h => h.data.step === item.step)) return;
    let idxInsercio = totesLesHores.findIndex(h => h.dateObj > item.dateObj);
    if (idxInsercio === -1) idxInsercio = totesLesHores.length;
    totesLesHores.splice(idxInsercio, 0, item);
    construirGraellaHores();
    if (totesLesHores.length === 1) { construirPanellParametres(); mostrarHora(0); }
    else if (idxInsercio <= curIdx) curIdx++;
}

async function carregarTotsJSONs() {
    const TIEMPO_INICIO = Date.now();
    const TIEMPO_MINIMO = 5000;
    let carregats = 0;
    actualitzarBarraProgress(0, 1);
    const esperaMinima = new Promise(resolve => setTimeout(resolve, TIEMPO_MINIMO));
    const horesExistents = [];
    for (let i = 0; i < MAX_STEPS; i++) {
        const horaStr = String(i).padStart(2, '0');
        try {
            const resp = await fetch(`${DADES_PATH}/${horaStr}/status.json`);
            if (resp.ok) {
                const status = await resp.json();
                horesExistents.push({ index: i, status });
            }
        } catch(e) {}
    }
    if (horesExistents.length === 0) {
        console.error('[Loading] No s\'ha trobat cap hora');
        return;
    }
    const total = horesExistents.length;
    actualitzarBarraProgress(0, total);
    for (const { index } of horesExistents) {
        const item = await carregarUnStep(index);
        if (item) {
            afegirHoraCarregada(item);
            carregats++;
            actualitzarBarraProgress(carregats, total);
        }
    }
    if (totesLesHores.length === 0) {
        console.error('[Loading] No s\'ha pogut carregar cap hora');
        return;
    }
    await esperaMinima;
    construirPanellParametres();
    if (totesLesHores.length > 0) mostrarHora(0);
    await new Promise(resolve => setTimeout(resolve, 400));
    const loadingOverlay = document.getElementById('loading_overlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    console.log('[Loading] Temps total: ' + ((Date.now() - TIEMPO_INICIO) / 1000).toFixed(1) + 's | Hores carregades: ' + totesLesHores.length);
    setTimeout(() => {
        if (totesLesHores && totesLesHores.length > 0) {
            window.totesLesHores = totesLesHores;
            window.skewtHourIndex = 0;
            document.dispatchEvent(new CustomEvent('mapa-dades-llestes', { detail: { totesLesHores: totesLesHores } }));
        }
    }, 1000);
}

function actualitzarBarraProgress(carregats, total) {
    const pct = Math.round((carregats / total) * 100);
    const barra = document.getElementById('loading_progress_bar'), text = document.getElementById('loading_progress_text');
    if (barra) barra.style.width = pct + '%';
    if (text) text.textContent = carregats + ' / ' + total + ' hores (' + pct + '%)';
}

function mostrarHora(idx) {
    if (idx < 0 || idx >= totesLesHores.length) return;
    if (!totesLesHores[idx]) return;
    const user = window._firebaseUser || null;
    if (!user && (idx % 3 !== 0)) { if (typeof loginWithGoogle === 'function') loginWithGoogle(); return; }
    curIdx = idx;
    window.skewtHourIndex = idx;
    if (canvasLayer) canvasLayer.setData(totesLesHores[idx].data);
    const grid = document.getElementById('fh_grid');
    if (grid) {
        grid.querySelectorAll('.fh-item').forEach((el, i) => {
            el.classList.toggle('active', i === idx);
            el.style.color = i === idx ? '#FFD700' : '#556680';
            el.style.background = i === idx ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.03)';
            el.style.borderColor = i === idx ? 'rgba(255,215,0,0.3)' : 'transparent';
        });
        setTimeout(() => { const active = grid.querySelector('.fh-item.active'); if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 100);
    }
    const d = totesLesHores[idx].dateObj;
    const ds = d.toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    const ls = String(d.getHours()).padStart(2, '0') + ':00', us = String(d.getUTCHours()).padStart(2, '0') + 'Z';
    ['overlay-date','overlay-local','overlay-utc'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = id==='overlay-date' ? ds.toUpperCase() : id==='overlay-local' ? ls : us; });
    const fhValidTime = document.getElementById('fh_validtime');
    if (fhValidTime) fhValidTime.textContent = ds + ' · ' + ls + ' local / ' + us;
    if (window.ventEnabled && typeof redibuixarVent === 'function') redibuixarVent();
}

function construirGraellaHores() {
    const grid = document.getElementById('fh_grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!totesLesHores || totesLesHores.length === 0) { grid.innerHTML = '<div style="color:#556680;padding:6px 12px;font-size:11px;text-align:center;">Carregant dades...</div>'; return; }
    const user = window._firebaseUser || null;
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;gap:3px;align-items:center;padding:2px 4px;overflow-x:auto;';
    totesLesHores.forEach((item, i) => {
        const d = item.dateObj;
        const horaStr = String(d.getHours()).padStart(2, '0') + 'h';
        const isActive = i === curIdx, bloquejat = !user && (i % 3 !== 0);
        const cell = document.createElement('div');
        cell.className = 'fh-item' + (isActive ? ' active' : '');
        cell.dataset.idx = i;
        cell.style.cssText = `flex:0 0 auto;padding:2px 8px;border-radius:3px;cursor:${bloquejat?'not-allowed':'pointer'};font-size:11px;font-weight:500;color:${isActive?'#FFD700':'#556680'};background:${isActive?'rgba(255,215,0,0.12)':'rgba(255,255,255,0.03)'};border:${isActive?'1px solid rgba(255,215,0,0.3)':'1px solid transparent'};text-align:center;min-width:32px;opacity:${bloquejat?'0.3':'1'};`;
        cell.innerHTML = bloquejat ? `<span style="font-size:12px;font-weight:600;">${horaStr}</span><span style="position:absolute;top:-2px;right:-1px;font-size:7px;color:#FF6B35;"><i class="fas fa-lock"></i></span>` : `<span style="font-size:12px;font-weight:600;">${horaStr}</span>`;
        if (!bloquejat) {
            cell.addEventListener('mouseenter', function() { if (!this.classList.contains('active')) { this.style.background='rgba(255,255,255,0.08)'; this.style.color='#c8d8e8'; } });
            cell.addEventListener('mouseleave', function() { if (!this.classList.contains('active')) { this.style.background='rgba(255,255,255,0.03)'; this.style.color='#556680'; } });
        }
        cell.onclick = function(e) { e.stopPropagation(); const idx = parseInt(this.dataset.idx); if (!user && idx%3!==0) { if (typeof loginWithGoogle==='function') loginWithGoogle(); return; } mostrarHora(idx); };
        container.appendChild(cell);
    });
    grid.appendChild(container);
    setTimeout(() => { const active = grid.querySelector('.fh-item.active'); if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 150);
}

// ═══════════════════════════════════════════════════════════════════════
//  PANELL DE PARÀMETRES
// ═══════════════════════════════════════════════════════════════════════

function tancarTotsAcordions(excepteClauBase) {
    document.querySelectorAll('.param-acordio-cap').forEach(capcal => {
        const clauB = capcal.dataset.clauBase;
        if (clauB === excepteClauBase) return;
        estatAcordio[`acordio_${clauB}`] = false;
        capcal.querySelector('.param-acordio-fletxa').textContent = '▸';
        const cos = capcal.nextElementSibling;
        if (cos && cos.classList.contains('param-acordio-cos')) cos.style.display = 'none';
    });
}

function ordenarClausPerNivell(claus) { return claus.slice().sort((a,b) => parseFloat(b.split('_').pop()) - parseFloat(a.split('_').pop())); }

const estatAcordio = {};

function construirPanellParametres() {
    const cont = document.getElementById('parameter_selection');
    if (!cont || !totesLesHores[0]) return;
    cont.innerHTML = '';
    const totesVariables = new Set(), infoVariables = {};
    totesLesHores.forEach(hora => {
        if (hora.data && hora.data.variables) Object.keys(hora.data.variables).forEach(clau => { totesVariables.add(clau); if (!infoVariables[clau]) infoVariables[clau] = hora.data.variables[clau]; });
    });
    const clausUsades = new Set();
    GRUP_PRINCIPAL.forEach(clauB => { if (totesVariables.has(clauB) && !esVariableAmagada(clauB)) { clausUsades.add(clauB); const info = infoVariables[clauB]; if (info) { const row = document.createElement('div'); row.className = 'param-row param-row-principal'; row.dataset.clau = clauB; row.innerHTML = `<div class="param-link">${info.nombre} <span class="param-unit">(${info.unidades})</span></div>`; row.onclick = () => seleccionarVariable(clauB); cont.appendChild(row); } } });
    if (clausUsades.size > 0) { const sep = document.createElement('div'); sep.className = 'param-separador'; sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:6px 12px;'; cont.appendChild(sep); }
    Object.entries(GRUPS_SIMPLES).forEach(([nomGrup, clausGrup]) => {
        const entrades = [];
        clausGrup.forEach(clauB => { if (totesVariables.has(clauB) && !esVariableAmagada(clauB)) entrades.push(clauB); });
        totesVariables.forEach(clau => { if (!entrades.includes(clau) && !clausUsades.has(clau)) { for (const clauB of clausGrup) { if (clau.startsWith(clauB+'_')) { entrades.push(clau); break; } } } });
        entrades.sort((a,b) => a.localeCompare(b));
        if (entrades.length === 0) return;
        const h3 = document.createElement('h3'); h3.className = 'param-group-title'; h3.textContent = nomGrup + ' (' + entrades.length + ')'; cont.appendChild(h3);
        entrades.forEach(clau => { const info = infoVariables[clau]; if (!info) return; clausUsades.add(clau); const row = document.createElement('div'); row.className = 'param-row'; row.dataset.clau = clau; row.innerHTML = `<div class="param-link">${info.nombre} <span class="param-unit">(${info.unidades})</span></div>`; row.onclick = () => seleccionarVariable(clau); cont.appendChild(row); });
    });
    Object.entries(GRUPS_ACORDIO).forEach(([nomGrupTitol, clausBase]) => {
        clausBase.forEach(clauB => {
            const nivellsClaus = [...totesVariables].filter(c => !clausUsades.has(c) && c.startsWith(clauB+'_') && /^\d+$/.test(c.slice(clauB.length+1)));
            if (nivellsClaus.length === 0) return;
            const nivellsOrdenats = ordenarClausPerNivell(nivellsClaus), paletaBase = PALETES[clauB], nomBase = paletaBase ? paletaBase.titol : clauB;
            const clauEstat = `acordio_${clauB}`; if (!(clauEstat in estatAcordio)) estatAcordio[clauEstat] = false;
            const capcal = document.createElement('div'); capcal.className = 'param-acordio-cap'; capcal.dataset.clauBase = clauB;
            capcal.innerHTML = `<span class="param-acordio-fletxa">${estatAcordio[clauEstat]?'▾':'▸'}</span> ${nomBase} <span class="param-unit">(${nivellsOrdenats.length} nivells)</span>`; cont.appendChild(capcal);
            const cosContenidor = document.createElement('div'); cosContenidor.className = 'param-acordio-cos'; cosContenidor.style.display = estatAcordio[clauEstat]?'block':'none';
            nivellsOrdenats.forEach(clau => { const info = infoVariables[clau]; if (!info) return; clausUsades.add(clau); const row = document.createElement('div'); row.className = 'param-row param-row-nivell'; row.dataset.clau = clau; row.innerHTML = `<div class="param-link">${info.nombre} <span class="param-unit">(${info.unidades})</span></div>`; row.onclick = () => seleccionarVariable(clau); cosContenidor.appendChild(row); });
            cont.appendChild(cosContenidor);
            capcal.addEventListener('click', () => { const obert = estatAcordio[clauEstat]; tancarTotsAcordions(clauB); estatAcordio[clauEstat] = !obert; capcal.querySelector('.param-acordio-fletxa').textContent = !obert?'▾':'▸'; cosContenidor.style.display = !obert?'block':'none'; });
        });
    });
    const sobrants = [...totesVariables].filter(c => !clausUsades.has(c) && !esVariableAmagada(c));
    if (sobrants.length > 0) { const h3 = document.createElement('h3'); h3.className = 'param-group-title'; h3.textContent = 'Altres (' + sobrants.length + ')'; cont.appendChild(h3); sobrants.sort((a,b)=>a.localeCompare(b)).forEach(clau => { const info = infoVariables[clau]; if (!info) return; const row = document.createElement('div'); row.className = 'param-row'; row.dataset.clau = clau; row.innerHTML = `<div class="param-link">${info.nombre} <span class="param-unit">(${info.unidades})</span></div>`; row.onclick = () => seleccionarVariable(clau); cont.appendChild(row); }); }
    seleccionarVariable('st', true);
}

function seleccionarVariable(clau, silenciós) {
    if (variableActiva === clau && !silenciós) return;
    const user = window._firebaseUser || null;
    if (!user && isParamBloquejat(clau)) { window._currentParameter = clau; actualitzarBloqueigMapa(); return; }
    variableActiva = clau; window._currentParameter = clau;
    document.querySelectorAll('.param-row').forEach(el => el.classList.toggle('param-selected', el.dataset.clau === clau));
    const base = clauBase(clau), clauEstat = `acordio_${base}`;
    if (clauEstat in estatAcordio && !estatAcordio[clauEstat] && clau !== base) { tancarTotsAcordions(base); estatAcordio[clauEstat] = true; const capcal = document.querySelector(`.param-acordio-cap[data-clau-base="${base}"]`); if (capcal) { capcal.querySelector('.param-acordio-fletxa').textContent = '▾'; const cos = capcal.nextElementSibling; if (cos && cos.classList.contains('param-acordio-cos')) cos.style.display = 'block'; } }
    canvasLayer._needsRedraw = true; canvasLayer._render();
    if (!silenciós) { const actiu = document.querySelector('.param-row.param-selected'); if (actiu) actiu.scrollIntoView({block:'nearest'}); }
    actualitzarBloqueigMapa();
}

function actualitzarCapcaleraParametre() { const pal = getPaleta(variableActiva); const label = document.getElementById('parameter_menu_link'); if (label) label.textContent = pal.titol + ' (' + pal.unitat + ')'; }

const PARAMETRES_LLIURES = ['st', 'sd', 'srh', 'temp_min2m', 'temp_max2m'];
function isParamBloquejat(p) { if (!p) return false; const b = clauBase(p.toLowerCase().trim()); return !(PARAMETRES_LLIURES.includes(p) || PARAMETRES_LLIURES.includes(b)); }
window.tancarBloqueig = function() { const o = document.getElementById('mapLockOverlay'); if (o) { o.classList.remove('visible'); document.getElementById('map').style.opacity = '1'; } };
function actualitzarBloqueigMapa() { /* mateixa lògica */ }

// ═══════════════════════════════════════════════════════════════════════
//  CONTROLS
// ═══════════════════════════════════════════════════════════════════════

document.getElementById('btnVent').addEventListener('click', () => window.toggleVent());
document.getElementById('btnVentMode').addEventListener('click', () => window.toggleVentMode());
document.getElementById('btnPrev').addEventListener('click', () => mostrarHora((curIdx-1+totesLesHores.length)%totesLesHores.length));
document.getElementById('btnNext').addEventListener('click', () => mostrarHora((curIdx+1)%totesLesHores.length));
let animTimer=null, isPlaying=false;
document.getElementById('btnPlay').addEventListener('click', function() { if (isPlaying) { clearInterval(animTimer); isPlaying=false; this.textContent='▶ Animació'; } else { isPlaying=true; this.textContent='⏹ Aturar'; animTimer=setInterval(()=>mostrarHora((curIdx+1)%totesLesHores.length), 600); } });
document.addEventListener('keydown', (e) => { if (e.key==='ArrowLeft') mostrarHora((curIdx-1+totesLesHores.length)%totesLesHores.length); if (e.key==='ArrowRight') mostrarHora((curIdx+1)%totesLesHores.length); });

// ═══════════════════════════════════════════════════════════════════════
//  INICI
// ═══════════════════════════════════════════════════════════════════════

inicialitzarGeojson();
inicialitzarCanvasVent();
inicialitzarCanvasIsohipses();
carregarTotsJSONs();
setTimeout(() => { window._currentParameter = variableActiva || 'st'; actualitzarBloqueigMapa(); }, 2000);