// ═══════════════════════════════════════════════════════════════════════
//  mapapngs.js — Visor AROME (lògica essencial + accés restringit)
//  Capes: fons.png < dades PNG < vores (vectorials) < isolínies < vent/barbes < ciutats
//  La UI i el disseny viuen a l'HTML (style + estructura semàntica)
//
//  NOVETATS:
//   - Llista 3D curada (CATALEG_3D_*): sense duplicats, sense u/v ni camps tècnics.
//     Ja NO depèn de manifest.variables_3d (el script 3D no l'escriu).
//   - Variables per nivell: una sola fila + "chips" de nivell (1000…200 hPa).
//   - Variables de columna (fitxer ..._col.png): Shear, SRH, DCAPE, LI, LCL, storm motion.
//   - Storm motion: PNG de velocitat + barbes vectorials (stormmotion_HH_dia.js).
//   - Accés restringit: variables bàsiques lliures; resta requereix login.
//   - Optimitzacions mòbil: cache limitat, debounce, pointer capture correcte.
// ═══════════════════════════════════════════════════════════════════════

const FIT = 'contain';

// ═══════════════════════════════════════════════════════════════════════
//  ACCÉS: VARIABLES LLIURES (sense login)
// ═══════════════════════════════════════════════════════════════════════
const PARAMETRES_LLIURES = new Set([
    'st', 'sd', 'srh',
    'temp_min2m', 'temp_max2m',
    'wind_speed_10m', 'wind_gust',
]);

function clauBaseLliure(clau) {
    if (!clau) return '';
    return String(clau).replace(/_\d+$/, '');
}
function esParametreLliure(clau) {
    if (!clau) return false;
    const base = clauBaseLliure(clau);
    return PARAMETRES_LLIURES.has(clau) || PARAMETRES_LLIURES.has(base);
}
function usuariLoguejat() {
    return !!(window._firebaseUser);
}
function potVeureVariable(clau) {
    if (esParametreLliure(clau)) return true;
    return usuariLoguejat();
}

// ─── Configuració persistent ───────────────────────────────────────
const CLAU_CFG = 'tempestescat_visor_v2';
function cfgLlegir() {
    try { return JSON.parse(localStorage.getItem(CLAU_CFG)) || {}; } catch { return {}; }
}
let _cfg = cfgLlegir();
function cfgGuardar(obj) {
    Object.assign(_cfg, obj);
    try { localStorage.setItem(CLAU_CFG, JSON.stringify(_cfg)); } catch {}
}

// ─── Opacitat ──────────────────────────────────────────────────────
let OPACITAT_DADES = (typeof _cfg.opacitat === 'number' && _cfg.opacitat >= 0.2 && _cfg.opacitat <= 1)
    ? _cfg.opacitat : 0.85;

// ─── Constants de tractament d'imatge ──────────────────────────────
const VENT_INVERTIR_V = false;
const NEGRE_A_BLANC = true;
const LLINDAR_NEGRE = 50;

// ─── Límits de memòria dels caches ─────────────────────────────────
const MAX_CACHE_BLANQUES = 30;
const MAX_CACHE_ISOLINES = 20;
const MAX_CACHE_VENT = 20;
const MAX_CACHE_SONDEIGS = 8;

// ─── Detecció de dispositiu ────────────────────────────────────────
const ES_MOBIL = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// ─── Rutes ─────────────────────────────────────────────────────────
const _pathActual = window.location.pathname;
const _basePath = _pathActual.substring(0, _pathActual.lastIndexOf('/') + 1);

const CARPETES_CANDIDATES = [
    _basePath + 'web_data_NE/imatges/',
    './web_data_NE/imatges/',
    '/web_data_NE/imatges/',
    '/public/web_data_NE/imatges/',
];
let PNG_BASE = CARPETES_CANDIDATES[0];
let BASE_3D = CARPETES_CANDIDATES[0];

const CARPETES_NOMS = [
    _basePath + 'dades/',
    _basePath + 'web_data_NE/imatges/',
    '/dades/',
    '/public/dades/',
];

// ─── Capes visibles (estat) ────────────────────────────────────────
window.MOSTRAR_VENT = true;
window.MOSTRAR_BARBES = true;
window.MOSTRAR_ISOLINIES = false;
window.MOSTRAR_CIUTATS = true;
window.MOSTRAR_FRONTERES = true;
window.MOSTRAR_PROVINCIES = true;

const PROPS_CAPES = ['MOSTRAR_VENT', 'MOSTRAR_BARBES', 'MOSTRAR_ISOLINIES', 'MOSTRAR_FRONTERES', 'MOSTRAR_PROVINCIES'];
if (_cfg.capes) {
    for (const p of PROPS_CAPES) {
        if (typeof _cfg.capes[p] === 'boolean') window[p] = _cfg.capes[p];
    }
}
function guardarCapes() {
    const o = {};
    for (const p of PROPS_CAPES) o[p] = !!window[p];
    cfgGuardar({ capes: o });
}

// ─── Densitat de ciutats ───────────────────────────────────────────
const DENSITAT_CIUTATS = {
    molt_dens: { minPoblacio: 0 },
    dens:      { minPoblacio: 500 },
    normal:    { minPoblacio: 2000 },
    poc_dens:  { minPoblacio: 20000 },
    poques:    { minPoblacio: 100000 },
    cap:       { minPoblacio: Infinity },
};
window.DENSITAT_CIUTATS_ACTIVA = 'dens';
(function () {
    let g = _cfg.densitat;
    if (!g) { try { g = localStorage.getItem('tempestescat_densitat_ciutats'); } catch {} }
    if (g && DENSITAT_CIUTATS[g]) {
        window.DENSITAT_CIUTATS_ACTIVA = g;
        window.MOSTRAR_CIUTATS = g !== 'cap';
    }
})();

// ─── Paràmetres visuals ────────────────────────────────────────────
const VENT_CFG = {
    color: 'rgba(0,0,0,0.72)',
    amplada: 0.7,
    separacio: ES_MOBIL ? 45 : 34,
    longitudPas: 3.0,
    maxPassos: ES_MOBIL ? 28 : 40,
    gridVisitat: 10,
    midaFletxa: 5.0,
    angleFletxa: 0.45,
};

// Barbes de storm motion (nusos)
const MS_A_KT = 1.94384;
const BARBES_CFG = {
    llargada: 26,
    separacioMin: 38,
};

const BARBES_PASSADES = [
    ['rgba(15,15,25,0.95)', 1.3],
];

const ISO_CFG = {
    color: 'rgba(20,20,30,0.85)',
    colorEtiqueta: 'rgba(255,255,255,0.95)',
    ombraEtiqueta: 'rgba(0,0,0,0.85)',
    amplada: 0.9,
    midaFont: 8.5,
    gruixOmbra: 2.5,
    decimacioBase: 6,
    minPuntsPerEtiqueta: 25,
    distMinEtiquetes: 46,
};

const CIUTATS_CFG = {
    colorText: 'rgba(255,255,255,0.98)',
    colorTextCapital: 'rgba(255,220,120,1.0)',
    ombra: 'rgba(0,0,0,0.9)',
    colorPunt: 'rgba(20,20,30,0.9)',
    colorPuntCapital: 'rgba(255,200,60,1.0)',
    midaFontBase: 10,
    midaPuntBase: 3,
    maxVisibles: ES_MOBIL ? 300 : 800,
};

const VORES_CFG = {
    fronteraColor: 'rgba(10,14,24,0.95)',
    fronteraHalo: 'rgba(255,255,255,0.80)',
    fronteraAmplada: 1.8,
    fronteraHaloExtra: 2.2,
    provinciaColor: 'rgba(30,35,55,0.75)',
    provinciaHalo: 'rgba(255,255,255,0.45)',
    provinciaAmplada: 0.9,
    provinciaHaloExtra: 1.6,
};

// ─── Icones SVG ────────────────────────────────────────────────────
const svgBase = (w, cos, extra) =>
    `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${cos}</svg>`;
const ICO = {
    cerca:  svgBase(14, '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>'),
    pin:    svgBase(14, '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
    plega:  svgBase(14, '<path d="M15 5l-7 7 7 7"/>'),
    menu:   svgBase(15, '<path d="M4 7h16M4 12h16M4 17h16"/>'),
    tanca:  svgBase(12, '<path d="M6 6l12 12M18 6L6 18"/>'),
    fletxa: svgBase(10, '<path d="M9 5l7 7-7 7"/>'),
    play:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
    stop:   '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
};

// ─── Estat global ──────────────────────────────────────────────────
let totesLesHores = [];
let infoVariables = {};
let infoVariables3D = {};
let hores3D = [];
let aspecte = 0.95;
let aspecteDelManifest = false;
let curIdx = 0;
let variableActiva = 'st';
let _errorManifest = '';

let viewport, stage, imgFons, imgDades, imgVores, imgLlegenda;
let canvasVores, canvasIsolines, canvasVent, canvasNoms;

let _tokenDades = 0;
let _urlDades = null;
let _tokenVI = 0;

const _cacheIsolines = new Map();
const _cacheVent = new Map();
const _cacheDadesBlanques = new Map();
const _cacheSondeigs = new Map();
const _cacheCapes3D = new Map();
const _cacheVent3D = new Map();
const _cacheStorm = new Map();

let _isolinesActuals = null;
let _ventActual = null;
let _stormActual = null;
let _ciutats = [];
let _linies = null;
let _ciutatSel = null;
let _animVista = null;
let _vistaPermesGuardar = false;
let _tmrVista = null;
let _capa3DActiva = null;

const ultimNivell3D = {};

window._extentManifest = null;
const vista = { k: 1, x: 0, y: 0 };

// ─── Redraw amb debounce ───────────────────────────────────────────
let _rafPendent = null;
let _darrerRedibuix = 0;
const INTERVAL_MIN_REDRAW = 33;

function _llevarCache(map, max) {
    if (map.size <= max) return;
    const extra = map.size - max;
    let i = 0;
    for (const k of map.keys()) {
        if (i++ >= extra) break;
        map.delete(k);
    }
}

function programarRedibuix() {
    guardarVistaDiferit();
    if (_rafPendent) return;

    const ara = performance.now();
    const delta = ara - _darrerRedibuix;

    if (delta < INTERVAL_MIN_REDRAW) {
        _rafPendent = requestAnimationFrame(() => {
            _rafPendent = null;
            _darrerRedibuix = performance.now();
            redibuixarTot();
        });
        return;
    }

    _rafPendent = requestAnimationFrame(() => {
        _rafPendent = null;
        _darrerRedibuix = performance.now();
        redibuixarTot();
    });
}

function redibuixarTot() {
    dibuixarVores();
    dibuixarIsolines();
    dibuixarVent();
    dibuixarCiutats();
}

// ═══════════════════════════════════════════════════════════════════
//  NOMS I SECCIONS
// ═══════════════════════════════════════════════════════════════════
const NOMS_VARIABLES = {
    st: 'Temperatura (2 m)', feels_like: 'Sensació tèrmica',
    sd: 'Punt de rosada (2 m)', srh: 'Humitat relativa (2 m)',
    sh2: 'Humitat específica (2 m)',
    temp_min2m: 'Temperatura mínima (2 m)', temp_max2m: 'Temperatura màxima (2 m)',
    wind_speed_10m: 'Velocitat del vent (10 m)',
    wind_speed_gust_specific_height_level_above_ground: 'Ratxa de vent (10 m)',
    su: 'Vent, component est-oest (10 m)', sv: 'Vent, component nord-sud (10 m)',
    pressure_msl: 'Pressió al nivell del mar', sp: 'Pressió en superfície',
    tp: 'Precipitació acumulada', precip_ground: 'Precipitació (1 h)',
    tsnowp: 'Neu acumulada', neige_ground: 'Neu (1 h)',
    snow_depth_ground_or_water_surface: 'Gruix de neu',
    water_equivalent_accumulated_snow_ground_or_water_surface: 'Equivalent en aigua de la neu',
    hteurneige_ground: 'Alçada de la neu', hteuneige_ground: 'Alçada de la neu',
    hterneige_ground: 'Alçada de la neu', neige_sc_ground: 'Neu a la superfície',
    resr_neige_ground: 'Reserva de neu', rr_sol_gele_ground: 'Pluja gelada',
    total_cloud_cover_ground_or_water_surface: 'Nuvolositat total',
    low_cloud_cover: 'Núvols baixos', medium_cloud_cover: 'Núvols mitjans',
    high_cloud_cover: 'Núvols alts', base_nuage_ground: 'Base dels núvols',
    plafond_ground: 'Sostre dels núvols',
    bt_channels_108: 'Satèl·lit infraroig (10,8 µm)',
    bt_channels_62: "Satèl·lit vapor d'aigua (6,2 µm)",
    reflectivity_max_dbz_ground_or_water_surface: 'Radar simulat (dBZ)',
    cape: 'Energia convectiva (CAPE)',
    convective_inhibition_ground_or_water_surface: 'Inhibició convectiva (CIN)',
    diag_ehi_ground: "Índex d'helicitat (EHI)", diag_scp_ground: 'Supercèl·lula (SCP)',
    diag_stp_ground: 'Tornado significatiu (STP)',
    diag_grele_ground: 'Risc de calamarsa', helicite_ground: 'Helicitat',
    spbl: 'Alçada de la capa límit',
    altitude_iso_t_27315: 'Isoterma de 0 °C',
    altitude_iso_tpw_27315: 'Altitud del punt de rosada 0 °C',
    altitude_iso_tpw_27415: 'Altitud del punt de rosada +1 °C',
    altitude_iso_tpw_27465: 'Altitud del punt de rosada +1,5 °C',
    tpw_isobaric_850: 'Aigua precipitable (850 hPa)',
    thetav_isobaric_850: 'Temperatura potencial virtual (850 hPa)',
};

const NOMS_VARIABLES_3D = {
    t: 'Temperatura', dpt: 'Punt de rosada',
    u: 'Vent U', v: 'Vent V', r: 'Humitat relativa',
    w: 'Velocitat vertical', pv: 'Vorticitat potencial',
    wind_speed: 'Velocitat del vent', wind_dir: 'Direcció del vent',
    shear_01: 'Shear 0-1 km', shear_03: 'Shear 0-3 km', shear_06: 'Shear 0-6 km',
    srh_01: 'SRH 0-1 km', srh_03: 'SRH 0-3 km',
    dcape: 'DCAPE', lifted_index: 'Lifted Index', lcl_m: 'Base del núvol (LCL)',
    hail_cm: 'Calamarsa potencial', storm_speed: 'Moviment de tempestes (storm motion)',
};

// ─── Catàleg 3D CURAT ──────────────────────────────────────────────
const NIVELL_COLUMNA = 'col';
const NIVELLS_3D = [1000, 925, 850, 700, 500, 300, 200];

const CATALEG_3D_NIVELL = [
    { var: 't',          nom: 'Temperatura',         unitat: '°C' },
    { var: 'dpt',        nom: 'Punt de rosada',      unitat: '°C' },
    { var: 'r',          nom: 'Humitat relativa',    unitat: '%' },
    { var: 'wind_speed', nom: 'Velocitat del vent',  unitat: 'km/h' },
    { var: 'w',          nom: 'Velocitat vertical',  unitat: 'Pa/s' },
];

const CATALEG_3D_COLUMNA = [
    { var: 'shear_01',     nom: 'Shear 0-1 km',                       unitat: 'm/s' },
    { var: 'shear_03',     nom: 'Shear 0-3 km',                       unitat: 'm/s' },
    { var: 'shear_06',     nom: 'Shear 0-6 km',                       unitat: 'm/s' },
    { var: 'srh_01',       nom: 'Helicitat SRH 0-1 km',               unitat: 'm²/s²' },
    { var: 'srh_03',       nom: 'Helicitat SRH 0-3 km',               unitat: 'm²/s²' },
    { var: 'dcape',        nom: 'DCAPE (corrents descendents)',       unitat: 'J/kg' },
    { var: 'lifted_index', nom: 'Lifted Index',                       unitat: '°C' },
    { var: 'lcl_m',        nom: 'Base del núvol (LCL)',               unitat: 'm' },
    { var: 'storm_speed',  nom: 'Moviment de tempestes (barbes)',     unitat: 'km/h' },
];

function info3D(v) {
    return CATALEG_3D_NIVELL.find(c => c.var === v) || CATALEG_3D_COLUMNA.find(c => c.var === v) || null;
}

const OCULTES_SFC = new Set(['su', 'sv']);

const SECCIONS = [
    { id: 'temp', nom: 'Temperatura i humitat', color: '#ff7a45',
      claus: ['st', 'feels_like', 'temp_min2m', 'temp_max2m', 'sd', 'srh', 'sh2'] },
    { id: 'vent', nom: 'Vent', color: '#36cfc9',
      claus: ['wind_speed_10m', 'wind_speed_gust_specific_height_level_above_ground', 'su', 'sv'] },
    { id: 'pres', nom: 'Pressió', color: '#9254de',
      claus: ['pressure_msl', 'sp'] },
    { id: 'prec', nom: 'Precipitació i neu', color: '#4096ff',
      claus: ['reflectivity_max_dbz_ground_or_water_surface', 'precip_ground', 'tp', 'tsnowp', 'neige_ground',
              'snow_depth_ground_or_water_surface', 'water_equivalent_accumulated_snow_ground_or_water_surface',
              'hteuneige_ground', 'hteurneige_ground', 'hterneige_ground', 'neige_sc_ground',
              'resr_neige_ground', 'rr_sol_gele_ground'] },
    { id: 'nuvols', nom: 'Núvols i satèl·lit', color: '#bfbfbf',
      claus: ['total_cloud_cover_ground_or_water_surface', 'low_cloud_cover', 'medium_cloud_cover',
              'high_cloud_cover', 'base_nuage_ground', 'plafond_ground', 'bt_channels_108', 'bt_channels_62'] },
    { id: 'conv', nom: 'Convecció i tempestes', color: '#ffc53d',
      claus: ['cape', 'convective_inhibition_ground_or_water_surface', 'diag_ehi_ground', 'diag_scp_ground',
              'diag_stp_ground', 'diag_grele_ground', 'helicite_ground'] },
    { id: 'atmo', nom: 'Atmosfera i alçades', color: '#73d13d',
      claus: ['spbl', 'altitude_iso_t_27315', 'altitude_iso_tpw_27315', 'altitude_iso_tpw_27415',
              'altitude_iso_tpw_27465', 'tpw_isobaric_850', 'thetav_isobaric_850'] },
    { id: 'altres', nom: 'Altres', color: '#8899bb', claus: [] },
];

function normClau(clau) {
    return String(clau).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
function nrm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function nomVariable(clau) {
    const k = normClau(clau);
    if (NOMS_VARIABLES[k]) return NOMS_VARIABLES[k];
    if (NOMS_VARIABLES_3D[k]) return NOMS_VARIABLES_3D[k];
    const inf = infoVariables[clau];
    if (inf && inf.nom) return inf.nom;
    const net = k.replace(/_+/g, ' ').trim();
    return net.charAt(0).toUpperCase() + net.slice(1);
}
function seccioDe(clau) {
    const k = normClau(clau);
    for (const s of SECCIONS) if (s.claus.includes(k)) return s.id;
    if (/snow|neige|gele|precip|reflectivity|^tp$|tsnowp/.test(k)) return 'prec';
    if (/cloud|nuage|plafond|^bt_/.test(k)) return 'nuvols';
    if (/cape|inhibition|^diag_|helicite/.test(k)) return 'conv';
    if (/wind|^su$|^sv$/.test(k)) return 'vent';
    if (/press|^sp$/.test(k)) return 'pres';
    if (/^t|^s[dh]|^srh|feels/.test(k)) return 'temp';
    if (/altitude|tpw|thetav|pbl/.test(k)) return 'atmo';
    return 'altres';
}
function ordreDinsSeccio(sec, clau) {
    const i = sec.claus.indexOf(normClau(clau));
    return i === -1 ? 999 : i;
}
function prioritatClau(clau) {
    const id = seccioDe(clau);
    const s = SECCIONS.find(x => x.id === id) || SECCIONS[SECCIONS.length - 1];
    return ordreDinsSeccio(s, clau);
}

// ═══════════════════════════════════════════════════════════════════
//  ESCENA
// ═══════════════════════════════════════════════════════════════════
function crearImatge(z, extra) {
    const im = document.createElement('img');
    im.draggable = false;
    im.decoding = 'async';
    im.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;'
        + 'user-select:none;pointer-events:none;z-index:' + z + ';' + (extra || '');
    return im;
}
function crearCanvas(z) {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:' + z + ';will-change:contents;';
    viewport.appendChild(c);
    return c;
}
function crearEscena() {
    viewport = document.getElementById('map');
    viewport.innerHTML = '';
    Object.assign(viewport.style, {
        position: 'absolute', inset: '0', overflow: 'hidden',
        background: '#1b2330', touchAction: 'none', cursor: 'grab', zIndex: '0',
        WebkitTapHighlightColor: 'transparent',
    });

    stage = document.createElement('div');
    stage.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;'
        + 'will-change:transform;backface-visibility:hidden;';

    imgFons = crearImatge(1);
    imgDades = crearImatge(2, `opacity:${OPACITAT_DADES};visibility:hidden;image-rendering:auto;`);
    imgVores = crearImatge(3);
    stage.append(imgFons, imgDades, imgVores);
    viewport.appendChild(stage);

    canvasVores = crearCanvas(9);
    canvasIsolines = crearCanvas(10);
    canvasVent = crearCanvas(11);
    canvasNoms = crearCanvas(12);

    imgLlegenda = document.createElement('img');
    imgLlegenda.className = 'llegenda-mapa';
    document.body.appendChild(imgLlegenda);

    imgFons.onload = () => {
        if (!aspecteDelManifest && imgFons.naturalHeight) {
            aspecte = imgFons.naturalWidth / imgFons.naturalHeight;
            ajustarVista(true);
        }
    };

    activarInteraccio();
    activarInteraccioPinca();

    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => ajustarVista(true));
        ro.observe(viewport);
    } else {
        window.addEventListener('resize', () => ajustarVista(true));
    }

    ajustarVista(false);
    crearPanell();
}

function centreLonLat() {
    const ext = window._extentManifest;
    if (!ext || !viewport) return null;
    const { sw, sh } = dimensionsStage();
    if (!sw || !sh) return null;
    const W = viewport.clientWidth, H = viewport.clientHeight;
    const xs = (W / 2 - vista.x) / vista.k;
    const ys = (H / 2 - vista.y) / vista.k;
    return [
        ext.lon_w + (xs / sw) * (ext.lon_e - ext.lon_w),
        ext.lat_n - (ys / sh) * (ext.lat_n - ext.lat_s),
    ];
}
function posarCentre(lon, lat, k) {
    const ext = window._extentManifest;
    if (!ext) return;
    const { sw, sh } = dimensionsStage();
    const W = viewport.clientWidth, H = viewport.clientHeight;
    const xs = ((lon - ext.lon_w) / (ext.lon_e - ext.lon_w)) * sw;
    const ys = ((ext.lat_n - lat) / (ext.lat_n - ext.lat_s)) * sh;
    vista.k = k;
    vista.x = W / 2 - xs * k;
    vista.y = H / 2 - ys * k;
}
function ajustarVista(mantenir) {
    const W = viewport.clientWidth, H = viewport.clientHeight;
    if (!W || !H) return;
    let prev = null;
    if (mantenir === true && window._extentManifest) {
        const c = centreLonLat();
        if (c) prev = { c, k: vista.k };
    }
    let sw = Math.min(W, H * aspecte);
    if (FIT === 'cover') sw = Math.max(W, H * aspecte);
    const sh = sw / aspecte;
    stage.style.width = sw + 'px';
    stage.style.height = sh + 'px';
    if (prev) posarCentre(prev.c[0], prev.c[1], prev.k);
    else { vista.k = 1; vista.x = (W - sw) / 2; vista.y = (H - sh) / 2; }
    aplicarTransform();
    redimensionarCanvas();
    programarRedibuix();
}
function aplicarTransform() {
    stage.style.transform = `translate3d(${vista.x}px,${vista.y}px,0) scale(${vista.k})`;
}
function guardarVistaDiferit() {
    if (!_vistaPermesGuardar) return;
    clearTimeout(_tmrVista);
    _tmrVista = setTimeout(() => {
        const c = centreLonLat();
        if (!c || !isFinite(c[0]) || !isFinite(c[1])) return;
        cfgGuardar({ vista: { k: vista.k, lon: c[0], lat: c[1] } });
    }, 600);
}
function restaurarVista() {
    const v = _cfg.vista;
    if (v && isFinite(v.k) && isFinite(v.lon) && isFinite(v.lat)) {
        posarCentre(v.lon, v.lat, Math.min(12, Math.max(0.5, v.k)));
        aplicarTransform();
    }
    _vistaPermesGuardar = true;
}
function redimensionarCanvas() {
    const W = viewport.clientWidth, H = viewport.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    [canvasVores, canvasIsolines, canvasVent, canvasNoms].forEach(c => {
        const nw = Math.max(1, Math.round(W * dpr));
        const nh = Math.max(1, Math.round(H * dpr));
        if (c.width !== nw || c.height !== nh) { c.width = nw; c.height = nh; }
        c.style.width = W + 'px';
        c.style.height = H + 'px';
    });
}
function prepararCtx(canvas) {
    const W = parseFloat(canvas.style.width) || 0;
    const H = parseFloat(canvas.style.height) || 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W, H };
}
function dimensionsStage() {
    return { sw: parseFloat(stage.style.width) || 0, sh: parseFloat(stage.style.height) || 0 };
}
function lonLatAPantalla(lon, lat) {
    const ext = window._extentManifest;
    if (!ext) return null;
    const { sw, sh } = dimensionsStage();
    const xs = ((lon - ext.lon_w) / (ext.lon_e - ext.lon_w)) * sw;
    const ys = ((ext.lat_n - lat) / (ext.lat_n - ext.lat_s)) * sh;
    return [vista.x + xs * vista.k, vista.y + ys * vista.k];
}
function pantallaALonLat(px, py) {
    const ext = window._extentManifest;
    if (!ext) return null;
    const { sw, sh } = dimensionsStage();
    if (!sw || !sh) return null;
    const xs = (px - vista.x) / vista.k;
    const ys = (py - vista.y) / vista.k;
    return [
        ext.lon_w + (xs / sw) * (ext.lon_e - ext.lon_w),
        ext.lat_n - (ys / sh) * (ext.lat_n - ext.lat_s),
    ];
}
function retallarAImatge(ctx) {
    const { sw, sh } = dimensionsStage();
    ctx.beginPath();
    ctx.rect(vista.x, vista.y, sw * vista.k, sh * vista.k);
    ctx.clip();
}
function activarInteraccio() {
    viewport.addEventListener('wheel', e => {
        e.preventDefault();
        _animVista = null;
        const r = viewport.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const nk = Math.min(12, Math.max(0.5, vista.k * Math.exp(-e.deltaY * 0.0015)));
        const q = nk / vista.k;
        vista.x = mx - (mx - vista.x) * q;
        vista.y = my - (my - vista.y) * q;
        vista.k = nk;
        aplicarTransform();
        programarRedibuix();
    }, { passive: false });

    let arrossegant = false, ox = 0, oy = 0, mogut = false;
    let pointerActiu = null;
    // 🔑 Comptador de punters actius (per detectar pinch)
    let puntersActius = new Set();

    viewport.addEventListener('pointerdown', e => {
        puntersActius.add(e.pointerId);

        // 🔑 Si hi ha 2+ punters, cancel·lem el drag (és un pinch)
        if (puntersActius.size >= 2) {
            arrossegant = false;
            if (pointerActiu !== null) {
                try { viewport.releasePointerCapture(pointerActiu); } catch {}
                pointerActiu = null;
            }
            return;
        }

        if (pointerActiu !== null && pointerActiu !== e.pointerId) return;
        pointerActiu = e.pointerId;
        _animVista = null;
        arrossegant = true; ox = e.clientX; oy = e.clientY; mogut = false;
        try { viewport.setPointerCapture(e.pointerId); } catch {}
        viewport.style.cursor = 'grabbing';
    });

    viewport.addEventListener('pointermove', e => {
        // 🔑 Si hi ha 2+ punters, no fem drag
        if (puntersActius.size >= 2) return;
        if (!arrossegant || e.pointerId !== pointerActiu) return;
        const dx = e.clientX - ox, dy = e.clientY - oy;
        if (Math.abs(dx) + Math.abs(dy) > 3) mogut = true;
        vista.x += dx; vista.y += dy;
        ox = e.clientX; oy = e.clientY;
        aplicarTransform();
        programarRedibuix();
    });

    const fi = (e) => {
        puntersActius.delete(e.pointerId);

        if (e.pointerId !== pointerActiu) {
            // Si era el segon dit, no toquem res
            return;
        }

        const esClicDret = e.button === 2;
        const esTactil = e.pointerType === 'touch' && e.button === 0;
        if (arrossegant && !mogut && puntersActius.size === 0 && (esClicDret || esTactil)) {
            const r = viewport.getBoundingClientRect();
            const px = e.clientX - r.left, py = e.clientY - r.top;
            obrirMenuContextual(px, py, e.clientX, e.clientY);
        }
        arrossegant = false;
        pointerActiu = null;
        try { viewport.releasePointerCapture(e.pointerId); } catch {}
        viewport.style.cursor = 'grab';
    };
    viewport.addEventListener('pointerup', fi);
    viewport.addEventListener('pointercancel', e => {
        puntersActius.delete(e.pointerId);
        if (e.pointerId !== pointerActiu) return;
        arrossegant = false;
        pointerActiu = null;
        try { viewport.releasePointerCapture(e.pointerId); } catch {}
        viewport.style.cursor = 'grab';
    });
    viewport.addEventListener('dblclick', () => ajustarVista(false));

    viewport.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('contextmenu', e => {
        if (viewport && viewport.contains(e.target)) e.preventDefault();
    });
}

function activarInteraccioPinca() {
    const punts = new Map();
    let dPrev = 0;
    let cPrev = { x: 0, y: 0 };
    let actiu = false;

    function calcular() {
        const arr = [...punts.values()];
        const a = arr[0], b = arr[1];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        return { d, cx, cy };
    }

    viewport.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'touch') return;
        punts.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (punts.size === 2) {
            actiu = true;
            e.stopImmediatePropagation();
            e.preventDefault();
            const g = calcular();
            dPrev = g.d;
            cPrev = { x: g.cx, y: g.cy };
            _animVista = null;
        }
    }, { capture: true, passive: false });

    viewport.addEventListener('pointermove', e => {
        if (e.pointerType !== 'touch') return;
        if (!punts.has(e.pointerId)) return;

        punts.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (!actiu || punts.size !== 2) return;

        e.stopImmediatePropagation();
        e.preventDefault();

        const g = calcular();
        const r = viewport.getBoundingClientRect();

        // Pan del centre del pinch
        vista.x += g.cx - cPrev.x;
        vista.y += g.cy - cPrev.y;

        // Zoom pel canvi de distància
        if (dPrev > 0) {
            const factor = g.d / dPrev;
            const nk = Math.min(12, Math.max(0.5, vista.k * factor));
            const q = nk / vista.k;
            const mx = g.cx - r.left;
            const my = g.cy - r.top;
            vista.x = mx - (mx - vista.x) * q;
            vista.y = my - (my - vista.y) * q;
            vista.k = nk;
        }

        dPrev = g.d;
        cPrev = { x: g.cx, y: g.cy };

        aplicarTransform();
        programarRedibuix();
    }, { capture: true, passive: false });

    const deixa = e => {
        if (e.pointerType !== 'touch') return;
        punts.delete(e.pointerId);

        if (punts.size < 2) {
            actiu = false;
            dPrev = 0;
            cPrev = { x: 0, y: 0 };
        }

      
    };
    viewport.addEventListener('pointerup', deixa, { capture: true });
    viewport.addEventListener('pointercancel', deixa, { capture: true });
}

function volarA(lon, lat, kFinal) {
    const ext = window._extentManifest;
    if (!ext) return;
    const { sw, sh } = dimensionsStage();
    const W = viewport.clientWidth, H = viewport.clientHeight;
    const xs = ((lon - ext.lon_w) / (ext.lon_e - ext.lon_w)) * sw;
    const ys = ((ext.lat_n - lat) / (ext.lat_n - ext.lat_s)) * sh;
    const k1 = Math.min(12, Math.max(0.5, kFinal));
    const pan = document.getElementById('panell-pro');
    const desp = (pan && !pan.classList.contains('plegat') && W > 860) ? (pan.offsetWidth + 14) / 2 : 0;
    const x1 = (W / 2 + desp) - xs * k1;
    const y1 = H / 2 - ys * k1;
    const x0 = vista.x, y0 = vista.y, k0 = vista.k;
    const t0 = performance.now(), dur = 650;
    const id = {};
    _animVista = id;
    function pas(t) {
        if (_animVista !== id) return;
        const p = Math.min(1, (t - t0) / dur);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        vista.k = k0 + (k1 - k0) * e;
        vista.x = x0 + (x1 - x0) * e;
        vista.y = y0 + (y1 - y0) * e;
        aplicarTransform();
        programarRedibuix();
        if (p < 1) requestAnimationFrame(pas); else _animVista = null;
    }
    requestAnimationFrame(pas);
}

// ═══════════════════════════════════════════════════════════════════
//  MENÚ CONTEXTUAL (Skew-T)
// ═══════════════════════════════════════════════════════════════════
let _menuCtx = null;

function obrirMenuContextual(px, py, clientX, clientY) {
    tancarMenuContextual();

    if (!usuariLoguejat()) {
        if (typeof window.mostrarAvisLogin === 'function') {
            window.mostrarAvisLogin('Skew-T');
        } else if (typeof window.obrirModal === 'function') {
            window.obrirModal('modalLogin');
        }
        return;
    }

    const ll = pantallaALonLat(px, py);
    if (!ll) return;
    const [lon, lat] = ll;
    const ext = window._extentManifest;
    if (ext && (lon < ext.lon_w || lon > ext.lon_e || lat < ext.lat_s || lat > ext.lat_n)) return;

    const menu = document.createElement('div');
    menu.id = 'menuCtxMapa';
    menu.className = 'menu-ctx';
    menu.innerHTML = `
        <div class="menu-ctx-cap">${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E</div>
        <button id="menuCtxSkewt" class="menu-ctx-boto">
            <span class="menu-ctx-ico">📈</span>
            <span>Skew-T (sondeig vertical)</span>
        </button>
    `;
    document.body.appendChild(menu);
    _menuCtx = menu;

    const boto = menu.querySelector('#menuCtxSkewt');
    boto.addEventListener('click', () => {
        tancarMenuContextual();
        confirmarSkewT(lat, lon);
    });

    setTimeout(() => {
        document.addEventListener('pointerdown', _tancaMenuFora, true);
    }, 0);
}
function _tancaMenuFora(e) {
    if (_menuCtx && !_menuCtx.contains(e.target)) tancarMenuContextual();
}
function tancarMenuContextual() {
    if (_menuCtx) {
        _menuCtx.remove();
        _menuCtx = null;
        document.removeEventListener('pointerdown', _tancaMenuFora, true);
    }
}

function confirmarSkewT(lat, lon) {
    const dlg = document.createElement('div');
    dlg.id = 'skewtConfirmaDlg';
    dlg.className = 'skewt-dlg';
    dlg.innerHTML = `
        <div class="skewt-dlg-cos">
            <div class="skewt-dlg-titol">📈 Skew-T</div>
            <div class="skewt-dlg-text">
                Vols generar el sondeig vertical per aquest punt?<br>
                <span class="skewt-dlg-coord">${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E</span>
            </div>
            <div class="skewt-dlg-botons">
                <button id="skewtNo" class="skewt-btn skewt-btn-no">No</button>
                <button id="skewtSi" class="skewt-btn skewt-btn-si">Sí, Skew-T</button>
            </div>
        </div>
    `;
    document.body.appendChild(dlg);

    const tancar = () => dlg.remove();
    dlg.querySelector('#skewtNo').addEventListener('click', tancar);
    dlg.addEventListener('click', e => { if (e.target === dlg) tancar(); });

    dlg.querySelector('#skewtSi').addEventListener('click', async () => {
        tancar();
        mostrarCarregantSkewt(lat, lon);
        try {
            const perfil = await construirPerfilPerSkewT(lat, lon);
            if (!perfil) {
                mostrarErrorSkewt('No s\'ha pogut carregar el sondeig.\nProva-ho d\'aquí uns segons.');
                return;
            }
            amagarCarregantSkewt();
            window._skewtPerfilPrecarregat = perfil;
            window._skewtPuntPrecarregat = { lat, lon, hourIdx: curIdx };
            if (typeof window.openSkewtModal === 'function') {
                window.openSkewtModal();
            } else {
                mostrarErrorSkewt('El mòdul Skew-T no està disponible encara.');
            }
        } catch (e) {
            console.error('[skewt]', e);
            mostrarErrorSkewt('Error carregant el sondeig: ' + e.message);
        }
    });
}

function mostrarCarregantSkewt(lat, lon) {
    const ov = document.createElement('div');
    ov.id = 'skewtCarregantOverlay';
    ov.className = 'skewt-carregant';
    ov.innerHTML = `
        <div class="skewt-spinner"></div>
        <div class="skewt-carregant-text">Carregant sondeig...</div>
        <div class="skewt-carregant-coord">${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E</div>
    `;
    document.body.appendChild(ov);
}
function amagarCarregantSkewt() {
    const ov = document.getElementById('skewtCarregantOverlay');
    if (ov) ov.remove();
}
function mostrarErrorSkewt(msg) {
    amagarCarregantSkewt();
    const ov = document.createElement('div');
    ov.className = 'skewt-error';
    ov.innerHTML = `
        <div class="skewt-error-cos">
            <div class="skewt-error-ico">⚠️</div>
            <div class="skewt-error-text">${msg}</div>
            <button class="skewt-error-btn" onclick="this.parentElement.parentElement.remove()">Tanca</button>
        </div>
    `;
    document.body.appendChild(ov);
}
async function construirPerfilPerSkewT(lat, lon) {
    const hora = totesLesHores[curIdx] ? totesLesHores[curIdx].hora : null;
    const dia = totesLesHores[curIdx] ? totesLesHores[curIdx].dia : null;
    if (hora == null || !dia) return null;

    const sondeig = await carregarSondeig(hora, dia);
    if (!sondeig) return null;

    const perfil = obtenirPerfilSondeig(sondeig, lat, lon);
    if (!perfil) return null;

    const t_arr = perfil.t, td_arr = perfil.dpt, u_arr = perfil.u, v_arr = perfil.v, p_arr = perfil.pressions;
    if (!t_arr || !td_arr || !u_arr || !v_arr) return null;

    const z = p_arr.map(p => 44330 * (1 - Math.pow(p / 1013.25, 0.1903)));
    const p_out = [], t_out = [], td_out = [], u_out = [], v_out = [], z_out = [];
    for (let i = 0; i < p_arr.length; i++) {
        if (t_arr[i] == null || td_arr[i] == null || u_arr[i] == null || v_arr[i] == null) continue;
        p_out.push(p_arr[i]); t_out.push(t_arr[i]); td_out.push(td_arr[i]);
        u_out.push(u_arr[i]); v_out.push(v_arr[i]); z_out.push(z[i]);
    }
    const ordre = p_out.map((_, i) => i).sort((a, b) => p_out[b] - p_out[a]);
    return {
        p: ordre.map(i => p_out[i]), z: ordre.map(i => z_out[i]),
        t: ordre.map(i => t_out[i]), td: ordre.map(i => td_out[i]),
        u: ordre.map(i => u_out[i]), v: ordre.map(i => v_out[i]),
    };
}

// ═══════════════════════════════════════════════════════════════════
//  3D + SONDEJOS
// ═══════════════════════════════════════════════════════════════════

async function descomprimirGzip(buf) {
    if (typeof pako !== 'undefined' && pako.inflate) {
        try { return pako.inflate(new Uint8Array(buf)); } catch {}
    }
    if (typeof DecompressionStream !== 'undefined') {
        try {
            const ds = new DecompressionStream('gzip');
            const stream = new Blob([buf]).stream().pipeThrough(ds);
            return new Uint8Array(await new Response(stream).arrayBuffer());
        } catch {}
    }
    throw new Error('Cal pako o DecompressionStream per llegir .msgpack.gz');
}

async function decodificarMsgpack(u8) {
    if (typeof msgpack !== 'undefined' && msgpack.decode) {
        try { return msgpack.decode(u8); } catch {}
    }
    return _msgpackDecodeMinim(u8);
}

function _msgpackDecodeMinim(u8) {
    let pos = 0;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const td = new TextDecoder('utf-8');
    function llegir() {
        const b = u8[pos++];
        if (b <= 0x7f) return b;
        if (b >= 0xe0) return b - 0x100;
        if (b >= 0x80 && b <= 0x8f) { const n = b - 0x80; const o = {}; for (let i = 0; i < n; i++) { const k = llegir(); o[k] = llegir(); } return o; }
        if (b >= 0x90 && b <= 0x9f) { const n = b - 0x90; const a = []; for (let i = 0; i < n; i++) a.push(llegir()); return a; }
        if (b >= 0xa0 && b <= 0xbf) { const n = b - 0xa0; const s = td.decode(u8.subarray(pos, pos + n)); pos += n; return s; }
        switch (b) {
            case 0xc0: return null;
            case 0xc2: return false;
            case 0xc3: return true;
            case 0xc4: { const n = u8[pos++]; const s = u8.subarray(pos, pos + n); pos += n; return s; }
            case 0xc5: { const n = dv.getUint16(pos); pos += 2; const s = u8.subarray(pos, pos + n); pos += n; return s; }
            case 0xc6: { const n = dv.getUint32(pos); pos += 4; const s = u8.subarray(pos, pos + n); pos += n; return s; }
            case 0xca: { const v = dv.getFloat32(pos); pos += 4; return v; }
            case 0xcb: { const v = dv.getFloat64(pos); pos += 8; return v; }
            case 0xcc: { const v = u8[pos]; pos += 1; return v; }
            case 0xcd: { const v = dv.getUint16(pos); pos += 2; return v; }
            case 0xce: { const v = dv.getUint32(pos); pos += 4; return v; }
            case 0xcf: { const v = Number(dv.getBigUint64(pos)); pos += 8; return v; }
            case 0xd0: { const v = dv.getInt8(pos); pos += 1; return v; }
            case 0xd1: { const v = dv.getInt16(pos); pos += 2; return v; }
            case 0xd2: { const v = dv.getInt32(pos); pos += 4; return v; }
            case 0xd3: { const v = Number(dv.getBigInt64(pos)); pos += 8; return v; }
            case 0xd9: { const n = u8[pos++]; const s = td.decode(u8.subarray(pos, pos + n)); pos += n; return s; }
            case 0xda: { const n = dv.getUint16(pos); pos += 2; const s = td.decode(u8.subarray(pos, pos + n)); pos += n; return s; }
            case 0xdb: { const n = dv.getUint32(pos); pos += 4; const s = td.decode(u8.subarray(pos, pos + n)); pos += n; return s; }
            case 0xdc: { const n = dv.getUint16(pos); pos += 2; const a = []; for (let i = 0; i < n; i++) a.push(llegir()); return a; }
            case 0xdd: { const n = dv.getUint32(pos); pos += 4; const a = []; for (let i = 0; i < n; i++) a.push(llegir()); return a; }
            case 0xde: { const n = dv.getUint16(pos); pos += 2; const o = {}; for (let i = 0; i < n; i++) { const k = llegir(); o[k] = llegir(); } return o; }
            case 0xdf: { const n = dv.getUint32(pos); pos += 4; const o = {}; for (let i = 0; i < n; i++) { const k = llegir(); o[k] = llegir(); } return o; }
        }
        throw new Error('msgpack: byte desconegut 0x' + b.toString(16));
    }
    return llegir();
}

async function carregarSondeig(hora, dia) {
    const clau = `${String(hora).padStart(2, '0')}_${dia}`;
    if (_cacheSondeigs.has(clau)) return _cacheSondeigs.get(clau);
    const url = `${BASE_3D}sondeig_${clau}.msgpack.gz?_cb=${Date.now()}`;
    try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = await r.arrayBuffer();
        const u8 = await descomprimirGzip(buf);
        const dades = await decodificarMsgpack(u8);
        _cacheSondeigs.set(clau, dades);
        _llevarCache(_cacheSondeigs, MAX_CACHE_SONDEIGS);
        return dades;
    } catch (e) {
        _cacheSondeigs.set(clau, null);
        _llevarCache(_cacheSondeigs, MAX_CACHE_SONDEIGS);
        return null;
    }
}

function obtenirPerfilSondeig(sondeig, lat, lon) {
    if (!sondeig || !sondeig.lats || !sondeig.lons) return null;
    const nLon = sondeig.lons.length;
    const nLat = sondeig.lats.length;
    const iLat = Math.max(0, Math.min(nLat - 1, Math.round((lat - sondeig.lats[0]) / (sondeig.lats[nLat - 1] - sondeig.lats[0]) * (nLat - 1))));
    const iLon = Math.max(0, Math.min(nLon - 1, Math.round((lon - sondeig.lons[0]) / (sondeig.lons[nLon - 1] - sondeig.lons[0]) * (nLon - 1))));
    const idx = iLat * nLon + iLon;
    const pressions = sondeig.pressions || [];
    const t = [], dpt = [], u = [], v = [], speed = [], dir = [];
    for (let k = 0; k < pressions.length; k++) {
        const tk = sondeig.t[k] ? sondeig.t[k][idx] : null;
        const dk = sondeig.dpt[k] ? sondeig.dpt[k][idx] : null;
        const uk = sondeig.u[k] ? sondeig.u[k][idx] : null;
        const vk = sondeig.v[k] ? sondeig.v[k][idx] : null;
        t.push(tk); dpt.push(dk); u.push(uk); v.push(vk);
        if (uk != null && vk != null) {
            speed.push(Math.hypot(uk, vk));
            dir.push((270 - Math.atan2(vk, uk) * 180 / Math.PI + 360) % 360);
        } else {
            speed.push(null); dir.push(null);
        }
    }
    return { lat: sondeig.lats[iLat], lon: sondeig.lons[iLon], idx, pressions, t, dpt, u, v, speed, dir };
}

async function obtenirSondeigPunt(hora, dia, lat, lon) {
    const sondeig = await carregarSondeig(hora, dia);
    if (!sondeig) return null;
    return obtenirPerfilSondeig(sondeig, lat, lon);
}

async function carregarVent3D(hora, dia, nivell) {
    const clau = `${String(hora).padStart(2, '0')}_${dia}_${nivell}`;
    if (_cacheVent3D.has(clau)) return _cacheVent3D.get(clau);

    const sondeig = await carregarSondeig(hora, dia);
    if (!sondeig || !sondeig.pressions) {
        _cacheVent3D.set(clau, null);
        return null;
    }
    const idxNivell = sondeig.pressions.indexOf(nivell);
    if (idxNivell < 0) {
        _cacheVent3D.set(clau, null);
        return null;
    }
    const u_flat = sondeig.u[idxNivell] || [];
    const v_flat = sondeig.v[idxNivell] || [];
    if (!u_flat.length || u_flat.length !== v_flat.length) {
        _cacheVent3D.set(clau, null);
        return null;
    }

    let lats = sondeig.lats;
    let lons = sondeig.lons;
    if (!lats || !lons) {
        const ext = window._extentManifest;
        if (!ext) { _cacheVent3D.set(clau, null); return null; }
        const nPunts = u_flat.length;
        let nLon = 130, nLat = 120;
        const candidats = [[130, 120], [128, 122], [120, 130], [156, 100], [156, 120]];
        for (const [nL, nT] of candidats) {
            if (nL * nT === nPunts) { nLon = nL; nLat = nT; break; }
        }
        if (nLon * nLat !== nPunts) {
            for (let nL = 100; nL <= 200; nL++) {
                if (nPunts % nL === 0) {
                    const nT = nPunts / nL;
                    if (nT > 50 && nT < 250) { nLon = nL; nLat = nT; break; }
                }
            }
        }
        lons = Array.from({length: nLon}, (_, i) =>
            ext.lon_w + (i / (nLon - 1)) * (ext.lon_e - ext.lon_w));
        lats = Array.from({length: nLat}, (_, i) =>
            ext.lat_n - (i / (nLat - 1)) * (ext.lat_n - ext.lat_s));
    }

    const nLon = lons.length;
    const nLat = lats.length;
    const u = [], v = [];
    for (let i = 0; i < nLat; i++) {
        u.push(u_flat.slice(i * nLon, (i + 1) * nLon));
        v.push(v_flat.slice(i * nLon, (i + 1) * nLon));
    }
    const camp = { lats, lons, u, v, _nivell: nivell };
    _cacheVent3D.set(clau, camp);
    _llevarCache(_cacheVent3D, MAX_CACHE_VENT);
    return camp;
}

// Storm motion: u/v decimats (stormmotion_HH_dia.js) per dibuixar barbes
async function carregarStorm(hora, dia) {
    const clau = `${String(hora).padStart(2, '0')}_${dia}`;
    if (_cacheStorm.has(clau)) return _cacheStorm.get(clau);
    try {
        await carregarScript(`${BASE_3D}stormmotion_${clau}.js`);
        const dades = (window.STORMMOTION && window.STORMMOTION[clau]) || null;
        _cacheStorm.set(clau, dades);
        _llevarCache(_cacheStorm, MAX_CACHE_VENT);
        return dades;
    } catch (e) {
        _cacheStorm.set(clau, null);
        _llevarCache(_cacheStorm, MAX_CACHE_VENT);
        return null;
    }
}

async function mostrarCapa3D(var3d, nivell) {
    if (!var3d || !nivell) return false;

    // 🔒 Requereix login
    if (!usuariLoguejat()) {
        if (typeof window.mostrarAvisLogin === 'function') {
            window.mostrarAvisLogin(var3d);
        } else if (typeof window.obrirModal === 'function') {
            window.obrirModal('modalLogin');
        }
        return false;
    }

    const hora = totesLesHores[curIdx] ? totesLesHores[curIdx].hora : null;
    const dia = totesLesHores[curIdx] ? totesLesHores[curIdx].dia : null;
    if (hora == null || !dia) return false;

    const clau = `${String(hora).padStart(2, '0')}_${dia}_${var3d}_${nivell}`;
    const urlPng = `${BASE_3D}3d_${clau}.png`;

    _capa3DActiva = { var: var3d, nivell, hora, dia, urlPng };

    const token = ++_tokenDades;
    const pre = new Image();
    pre.decoding = 'async';
    pre.onload = () => {
        if (token !== _tokenDades) return;
        imgDades.src = NEGRE_A_BLANC ? negreABlanc(pre, urlPng) : urlPng;
        imgDades.style.visibility = 'visible';
        _urlDades = urlPng;
    };
    pre.onerror = () => {
        if (token !== _tokenDades) return;
        imgDades.style.visibility = 'hidden';
        _urlDades = null;
    };
    pre.src = urlPng;

    const esVent = nivell !== NIVELL_COLUMNA && ['wind_speed', 'wind_dir', 'u', 'v'].includes(var3d);
    if (esVent) {
        if (window.MOSTRAR_VENT) {
            const camp = await carregarVent3D(hora, dia, nivell);
            if (token !== _tokenDades) return false;
            _ventActual = camp;
        } else {
            _ventActual = null;
        }
    } else {
        _ventActual = null;
    }
const VARS_AMB_BARBES = ['storm_speed', 'shear_01', 'shear_03', 'shear_06'];
if (VARS_AMB_BARBES.includes(var3d)) {
    const s = window.MOSTRAR_BARBES ? await carregarStorm(hora, dia) : null;
    if (token !== _tokenDades) return false;
    _stormActual = s;
} else {
    _stormActual = null;
}

    if (window.MOSTRAR_ISOLINIES) {
        const iso = await carregarIsolines3D(clau);
        if (token !== _tokenDades) return false;
        _isolinesActuals = iso;
    } else {
        _isolinesActuals = null;
    }

    actualitzarLlegenda();
    programarRedibuix();
    return true;
}

function tornarAModeSFC() {
    _capa3DActiva = null;
    _stormActual = null;
    actualitzarDades();
    actualitzarLlegenda();
    refrescarVentIsolines();
    actualitzarCapcaleraVariable();
}

async function carregarIsolines3D(clau) {
    if (_cacheCapes3D.has('iso_' + clau)) return _cacheCapes3D.get('iso_' + clau);
    try {
        await carregarScript(`${BASE_3D}isolines_3d_${clau}.js`);
        const dades = (window.ISOLINIES && window.ISOLINIES['3d_' + clau]) || null;
        _cacheCapes3D.set('iso_' + clau, dades);
        _llevarCache(_cacheCapes3D, MAX_CACHE_ISOLINES);
        return dades;
    } catch (e) {
        _cacheCapes3D.set('iso_' + clau, null);
        _llevarCache(_cacheCapes3D, MAX_CACHE_ISOLINES);
        return null;
    }
}

window.carregarSondeig = carregarSondeig;
window.obtenirPerfilSondeig = obtenirPerfilSondeig;
window.obtenirSondeigPunt = obtenirSondeigPunt;
window.mostrarCapa3D = mostrarCapa3D;
window.tornarAModeSFC = tornarAModeSFC;
window.carregarIsolines3D = carregarIsolines3D;

// ═══════════════════════════════════════════════════════════════════
//  PANELL LATERAL
// ═══════════════════════════════════════════════════════════════════
let _filesVariables = [];
const _seccionsObertes = new Set();

function injectarEstils3D() {
    if (document.getElementById('pp3d-estils')) return;
    const st = document.createElement('style');
    st.id = 'pp3d-estils';
    st.textContent = `
        .pp3d-chips{display:none;flex-wrap:wrap;gap:5px;padding:3px 12px 9px 22px}
        .pp3d-bloc.obert .pp3d-chips{display:flex}
        .pp3d-chip{font:600 10.5px 'Inter',system-ui,sans-serif;padding:3px 9px;border-radius:999px;
            border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#c9d4e6;cursor:pointer}
        .pp3d-chip:hover{background:rgba(255,255,255,.15)}
        .pp3d-chip.actiu{background:#ff7ad9;border-color:#ff7ad9;color:#1b1030}
    `;
    document.head.appendChild(st);
}

function ocultarUIAntiga() {
    const antiga = document.getElementById('parameter_selection');
    if (antiga) antiga.style.display = 'none';
    const inp = document.querySelector('input[placeholder^="Cercar par"], input[placeholder^="Buscar par"]');
    if (inp && !inp.closest('#panell-pro')) {
        let cont = inp.parentElement;
        const grid = document.getElementById('fh_grid');
        if (!cont || cont === document.body || (grid && cont.contains(grid)) || cont.contains(viewport)) cont = inp;
        cont.style.display = 'none';
    }
    const oldCtrl = document.getElementById('controls-png');
    if (oldCtrl) oldCtrl.remove();
}

function activarPestanya(nom, enfocar) {
    const p = document.getElementById('panell-pro');
    if (!p) return;
    p.querySelectorAll('.pp-tab').forEach(x => x.classList.toggle('actiu', x.dataset.tab === nom));
    p.querySelectorAll('.pp-cos').forEach(c => c.classList.toggle('actiu', c.dataset.cos === nom));
    cfgGuardar({ pestanya: nom });
    if (nom === 'ciutats') {
        renderCiutats();
        if (enfocar) setTimeout(() => p.querySelector('#ppCercaCiu').focus(), 30);
    }
    if (nom === 'variables' && enfocar) setTimeout(() => p.querySelector('#ppCercaVar').focus(), 30);
}

function crearPanell() {
    if (document.getElementById('panell-pro')) return;
    ocultarUIAntiga();
    injectarEstils3D();

    const p = document.createElement('div');
    p.id = 'panell-pro';
    p.innerHTML = `
        <div class="pp-cap">
            <div>
                <div class="pp-titol">TEMPESTES.CAT</div>
                <div class="pp-sub">Model numèric d'alta resolució</div>
            </div>
            <button class="pp-plega" id="ppPlega" title="Plega el panell">${ICO.plega}</button>
        </div>
        <div class="pp-user-bar" id="ppUserBar">
            <button id="ppBtnLogin" class="primary" onclick="if(typeof window.loginWithGoogle==='function')window.loginWithGoogle();">
                <i class="fab fa-google"></i>
                <span>Iniciar sessió</span>
            </button>
            <button id="ppBtnPerfil" style="display:none;" onclick="if(typeof window.openProfile==='function')window.openProfile();">
                <span class="avatar">U</span>
                <span>Perfil</span>
            </button>
        </div>
        <div class="pp-actual"><span id="ppActualNom">-</span><span id="ppActualUnitat"></span></div>
        <div class="pp-tabs">
            <button class="pp-tab actiu" data-tab="variables">Variables</button>
            <button class="pp-tab" data-tab="ciutats">Ciutats</button>
            <button class="pp-tab" data-tab="capes">Capes</button>
        </div>
        <div class="pp-cos actiu" data-cos="variables">
            <div class="pp-cerca">
                <span class="ico">${ICO.cerca}</span>
                <input id="ppCercaVar" type="text" placeholder="Cercar paràmetre...  ( / )" autocomplete="off">
                <button class="esb" id="ppEsbVar" title="Esborra">${ICO.tanca}</button>
            </div>
            <div class="pp-llista" id="ppLlistaVar"></div>
        </div>
        <div class="pp-cos" data-cos="ciutats">
            <div class="pp-cerca">
                <span class="ico">${ICO.pin}</span>
                <input id="ppCercaCiu" type="text" placeholder="Cercar ciutat o poble..." autocomplete="off">
                <button class="esb" id="ppEsbCiu" title="Esborra">${ICO.tanca}</button>
            </div>
            <button class="ciu-treu" id="ppTreuCiu">${ICO.tanca}<span>Treure el marcador</span></button>
            <div class="ciu-info" id="ppCiuInfo"></div>
            <div class="pp-llista" id="ppLlistaCiu"></div>
        </div>
        <div class="pp-cos" data-cos="capes">
            <div class="capes-cos">
                <div class="cap-titol" style="margin-top:2px">Vores</div>
                <div class="cap-fila" data-prop="MOSTRAR_FRONTERES"><span>Fronteres</span><span class="interruptor"></span></div>
                <div class="cap-fila" data-prop="MOSTRAR_PROVINCIES"><span>Províncies</span><span class="interruptor"></span></div>
                <div class="cap-titol">Superposicions</div>
                <div class="cap-fila" data-prop="MOSTRAR_ISOLINIES"><span>Isolínies</span><span class="interruptor"></span></div>
                <div class="cap-fila" data-prop="MOSTRAR_VENT"><span>Línies de corrent del vent</span><span class="interruptor"></span></div>
                <div class="cap-fila" data-prop="MOSTRAR_BARBES"><span>Barbes de storm motion</span><span class="interruptor"></span></div>
                <div class="cap-titol">Ciutats</div>
                <label class="ctrl-label">Densitat de noms</label>
                <select id="selDensitatCiutats" class="ctrl-select">
                    <option value="molt_dens">Molt dens</option>
                    <option value="dens">Dens</option>
                    <option value="normal">Normal</option>
                    <option value="poc_dens">Poc dens</option>
                    <option value="poques">Poques</option>
                    <option value="cap">Cap</option>
                </select>
                <div class="cap-titol">Dades</div>
                <label class="ctrl-label">Opacitat de la capa</label>
                <input type="range" id="rngOpacitat" min="20" max="100" value="${Math.round(OPACITAT_DADES * 100)}">
                <button class="cap-reset" id="btnReset">Restablir ajustos i vista</button>
            </div>
        </div>`;
    document.body.appendChild(p);

    const obrir = document.createElement('button');
    obrir.id = 'btn-obrir-panell';
    obrir.innerHTML = `${ICO.menu}<span>Menú</span>`;
    document.body.appendChild(obrir);

    const plega = (v) => {
        p.classList.toggle('plegat', v);
        obrir.classList.toggle('visible', v);
        cfgGuardar({ plegat: v });
    };
    p.querySelector('#ppPlega').addEventListener('click', () => plega(true));
    obrir.addEventListener('click', () => plega(false));
    const plegatInici = (typeof _cfg.plegat === 'boolean') ? _cfg.plegat : (window.innerWidth <= 860);
    p.classList.toggle('plegat', plegatInici);
    obrir.classList.toggle('visible', plegatInici);

    p.querySelectorAll('.pp-tab').forEach(b => b.addEventListener('click', () => activarPestanya(b.dataset.tab, true)));
    if (['variables', 'ciutats', 'capes'].includes(_cfg.pestanya)) activarPestanya(_cfg.pestanya, false);

    const inpVar = p.querySelector('#ppCercaVar');
    const esbVar = p.querySelector('#ppEsbVar');
    inpVar.addEventListener('input', () => {
        esbVar.style.display = inpVar.value ? 'flex' : 'none';
        filtrarVariables(inpVar.value);
    });
    inpVar.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const f = _filesVariables.find(x => x.el.style.display !== 'none');
            if (f) f.el.click();
        }
        if (e.key === 'Escape') { inpVar.value = ''; inpVar.dispatchEvent(new Event('input')); inpVar.blur(); }
    });
    esbVar.addEventListener('click', () => { inpVar.value = ''; inpVar.dispatchEvent(new Event('input')); inpVar.focus(); });

    document.addEventListener('keydown', e => {
        if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) {
            e.preventDefault();
            plega(false);
            activarPestanya('variables', true);
        }
    });

    const inpCiu = p.querySelector('#ppCercaCiu');
    const esbCiu = p.querySelector('#ppEsbCiu');
    inpCiu.addEventListener('input', () => {
        esbCiu.style.display = inpCiu.value ? 'flex' : 'none';
        renderCiutats();
    });
    inpCiu.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const primera = p.querySelector('#ppLlistaCiu .ciu-fila');
            if (primera) primera.click();
        }
        if (e.key === 'Escape') { inpCiu.value = ''; inpCiu.dispatchEvent(new Event('input')); inpCiu.blur(); }
    });
    esbCiu.addEventListener('click', () => { inpCiu.value = ''; inpCiu.dispatchEvent(new Event('input')); inpCiu.focus(); });
    p.querySelector('#ppTreuCiu').addEventListener('click', () => {
        _ciutatSel = null;
        cfgGuardar({ ciutat: null });
        renderCiutats();
        programarRedibuix();
    });

    p.querySelectorAll('.cap-fila').forEach(f => {
        const prop = f.dataset.prop;
        f.classList.toggle('on', !!window[prop]);
        f.addEventListener('click', () => {
            window[prop] = !window[prop];
            f.classList.toggle('on', !!window[prop]);
            guardarCapes();
            if (prop === 'MOSTRAR_ISOLINIES' && window[prop]) refrescarVentIsolines();
            else if (prop === 'MOSTRAR_VENT') {
                if (!window[prop]) {
                    _ventActual = null;
                    programarRedibuix();
                } else {
                    if (_capa3DActiva && _capa3DActiva.nivell !== NIVELL_COLUMNA &&
                        ['wind_speed','wind_dir','u','v'].includes(_capa3DActiva.var)) {
                        carregarVent3D(_capa3DActiva.hora, _capa3DActiva.dia, _capa3DActiva.nivell)
                            .then(c => { _ventActual = c; programarRedibuix(); });
                    } else if (!_capa3DActiva) {
                        carregarVent(curIdx).then(v => { _ventActual = v; programarRedibuix(); });
                    }
                }
            } else if (prop === 'MOSTRAR_BARBES') {
                const VARS_AMB_BARBES = ['storm_speed', 'shear_01', 'shear_03', 'shear_06'];
                if (window[prop] && _capa3DActiva && VARS_AMB_BARBES.includes(_capa3DActiva.var)) {
                    carregarStorm(_capa3DActiva.hora, _capa3DActiva.dia)
                        .then(s => { _stormActual = s; programarRedibuix(); });
                } else if (!window[prop]) {
                    _stormActual = null;
                    programarRedibuix();
                } else programarRedibuix();
            } else programarRedibuix();
        });
    });

    const sel = p.querySelector('#selDensitatCiutats');
    sel.value = window.DENSITAT_CIUTATS_ACTIVA;
    sel.addEventListener('change', () => {
        const v = sel.value;
        if (!DENSITAT_CIUTATS[v]) return;
        window.DENSITAT_CIUTATS_ACTIVA = v;
        window.MOSTRAR_CIUTATS = v !== 'cap';
        cfgGuardar({ densitat: v });
        programarRedibuix();
    });

    const rng = p.querySelector('#rngOpacitat');
    rng.addEventListener('input', e => {
        OPACITAT_DADES = e.target.value / 100;
        imgDades.style.opacity = OPACITAT_DADES;
    });
    rng.addEventListener('change', () => cfgGuardar({ opacitat: OPACITAT_DADES }));

    p.querySelector('#btnReset').addEventListener('click', () => {
        try { localStorage.removeItem(CLAU_CFG); localStorage.removeItem('tempestescat_densitat_ciutats'); } catch {}
        location.reload();
    });
}

function crearSeccioPanell(id, nom, color, n) {
    const sec = document.createElement('div');
    sec.className = 'sec';
    sec.dataset.sec = id;
    sec.innerHTML = `
        <button class="sec-cap">
            <span class="sec-punt" style="background:${color}"></span>
            <span class="sec-nom">${nom}</span>
            <span class="sec-n">${n}</span>
            <span class="sec-fletxa">${ICO.fletxa}</span>
        </button>
        <div class="sec-cos"></div>`;
    sec.querySelector('.sec-cap').addEventListener('click', () => {
        const oberta = sec.classList.toggle('oberta');
        if (oberta) _seccionsObertes.add(id); else _seccionsObertes.delete(id);
    });
    return { sec, cos: sec.querySelector('.sec-cos') };
}

function seleccionar3D(v, nivell) {
    const p = mostrarCapa3D(v, nivell);
    actualitzarCapcaleraVariable();
    return p;
}

function construirSeccions3D(cont) {
    // ── 1) Variables per nivell de pressió: una fila + chips de nivell ──
    const nivell = crearSeccioPanell('3d', 'Altura (nivells de pressió)', '#ff7ad9', CATALEG_3D_NIVELL.length);
    CATALEG_3D_NIVELL.forEach(c => {
        const bloc = document.createElement('div');
        bloc.className = 'pp3d-bloc';
        bloc.dataset.var = c.var;

        const row = document.createElement('div');
        row.className = 'param-row';
        row.dataset.clau = '3d_' + c.var;
        row.dataset.v3d = c.var;
        row.title = `${c.nom} (${c.unitat}) — tria el nivell`;
        row.innerHTML = `<span>${c.nom}</span><span class="unitat">${c.unitat}</span>`;
        row.addEventListener('click', () => {
            const n = ultimNivell3D[c.var] || 850;
            ultimNivell3D[c.var] = n;
            seleccionar3D(c.var, n);
        });

        const chips = document.createElement('div');
        chips.className = 'pp3d-chips';
        NIVELLS_3D.forEach(n => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'pp3d-chip';
            b.dataset.var = c.var;
            b.dataset.niv = String(n);
            b.textContent = n + ' hPa';
            b.addEventListener('click', e => {
                e.stopPropagation();
                ultimNivell3D[c.var] = n;
                seleccionar3D(c.var, n);
            });
            chips.appendChild(b);
        });

        bloc.append(row, chips);
        bloc.click = () => row.click();
        nivell.cos.appendChild(bloc);
        _filesVariables.push({
            clau: '3d_' + c.var, seccio: '3d',
            nomN: nrm(`${c.nom} ${c.var} 3d altura nivell pressio hpa`),
            el: bloc,
        });
    });
    cont.appendChild(nivell.sec);

    // ── 2) Variables de columna (tempestes severes) ──
    const col = crearSeccioPanell('3dcol', 'Tempestes severes (índexs)', '#ff4d4f', CATALEG_3D_COLUMNA.length);
    CATALEG_3D_COLUMNA.forEach(c => {
        const row = document.createElement('div');
        row.className = 'param-row';
        row.dataset.clau = '3d_' + c.var + '_' + NIVELL_COLUMNA;
        row.dataset.v3d = c.var;
        row.title = `${c.nom} (${c.unitat})`;
        row.innerHTML = `<span>${c.nom}</span><span class="unitat">${c.unitat}</span>`;
        row.addEventListener('click', () => seleccionar3D(c.var, NIVELL_COLUMNA));
        col.cos.appendChild(row);
        _filesVariables.push({
            clau: '3d_' + c.var, seccio: '3dcol',
            nomN: nrm(`${c.nom} ${c.var} 3d tempestes severes cisallament shear helicitat storm motion barbes`),
            el: row,
        });
    });
    cont.appendChild(col.sec);
}

function construirPanellParametres() {
    const cont = document.getElementById('ppLlistaVar');
    if (!cont) return;
    cont.innerHTML = '';
    _filesVariables = [];

    // ── Superfície ──
    const totes = new Set();
    for (const h of totesLesHores) for (const v of h.variables) {
        if (!OCULTES_SFC.has(normClau(v))) totes.add(v);
    }
    const visibles = new Set();
    const nomsVistos = new Set();
    [...totes]
        .sort((a, b) => (prioritatClau(a) - prioritatClau(b)) || a.localeCompare(b))
        .forEach(clau => {
            const nk = nrm(nomVariable(clau));
            if (nomsVistos.has(nk)) return;
            nomsVistos.add(nk);
            visibles.add(clau);
        });

    if (visibles.size) {
        if (_cfg.variable && visibles.has(_cfg.variable)) variableActiva = _cfg.variable;
        if (!visibles.has(variableActiva)) variableActiva = [...visibles].sort()[0];

        const perSeccio = new Map(SECCIONS.map(s => [s.id, []]));
        for (const clau of visibles) perSeccio.get(seccioDe(clau)).push(clau);

        for (const s of SECCIONS) {
            const claus = perSeccio.get(s.id);
            if (!claus.length) continue;
            claus.sort((a, b) => {
                const d = ordreDinsSeccio(s, a) - ordreDinsSeccio(s, b);
                return d !== 0 ? d : nomVariable(a).localeCompare(nomVariable(b), 'ca');
            });

            const { sec, cos } = crearSeccioPanell(s.id, s.nom, s.color, claus.length);

            claus.forEach(clau => {
                const nom = nomVariable(clau);
                const unitat = infoVariables[clau] && infoVariables[clau].unitat;

                // 🔒 Comprovar accés
                const bloquejat = !potVeureVariable(clau);

                const row = document.createElement('div');
                row.className = 'param-row'
                    + (clau === variableActiva ? ' param-selected' : '')
                    + (bloquejat ? ' premium-bloquejat' : '');
                row.dataset.clau = clau;
                row.dataset.nom = nom.toLowerCase();
                row.title = bloquejat
                    ? 'Inicia sessió per veure aquesta variable'
                    : (unitat ? `${nom} (${unitat})` : nom);

                const cadenat = bloquejat ? ' <span style="opacity:0.7;">🔒</span>' : '';
                row.innerHTML = `<span>${nom}${cadenat}</span>${unitat ? `<span class="unitat">${unitat}</span>` : ''}`;

                row.addEventListener('click', () => {
                    if (bloquejat) {
                        if (typeof window.mostrarAvisLogin === 'function') {
                            window.mostrarAvisLogin(clau);
                        } else if (typeof window.obrirModal === 'function') {
                            window.obrirModal('modalLogin');
                        }
                        return;
                    }
                    seleccionarVariable(clau);
                });

                cos.appendChild(row);
                _filesVariables.push({ clau, seccio: s.id, nomN: nrm(nom + ' ' + clau + ' ' + s.nom), el: row });
            });
            cont.appendChild(sec);
        }
    }

    // ── 3D (catàleg curat; no depèn del manifest) ──
    construirSeccions3D(cont);

    const buit = document.createElement('div');
    buit.className = 'pp-buit';
    buit.id = 'ppBuitVar';
    buit.style.display = 'none';
    buit.textContent = 'Cap paràmetre coincideix amb la cerca';
    cont.appendChild(buit);

    _seccionsObertes.clear();
    _seccionsObertes.add(seccioDe(variableActiva));
    restaurarSeccions();
    actualitzarCapcaleraVariable();
}

function restaurarSeccions() {
    document.querySelectorAll('#ppLlistaVar .sec').forEach(sec => {
        sec.classList.toggle('oberta', _seccionsObertes.has(sec.dataset.sec));
    });
}

function filtrarVariables(text) {
    const q = nrm(text);
    const cont = document.getElementById('ppLlistaVar');
    if (!cont) return;

    if (!q) {
        _filesVariables.forEach(f => f.el.style.display = '');
        cont.querySelectorAll('.sec').forEach(s => s.style.display = '');
        restaurarSeccions();
        const b = document.getElementById('ppBuitVar'); if (b) b.style.display = 'none';
        return;
    }
    const mots = q.split(/\s+/);
    const visibles = {};
    let total = 0;
    _filesVariables.forEach(f => {
        const ok = mots.every(m => f.nomN.includes(m));
        f.el.style.display = ok ? '' : 'none';
        if (ok) { visibles[f.seccio] = (visibles[f.seccio] || 0) + 1; total++; }
    });
    cont.querySelectorAll('.sec').forEach(s => {
        const n = visibles[s.dataset.sec] || 0;
        s.style.display = n ? '' : 'none';
        s.classList.toggle('oberta', n > 0);
    });
    const b = document.getElementById('ppBuitVar'); if (b) b.style.display = total ? 'none' : 'block';
}

function marcarSeleccio3D() {
    const a = _capa3DActiva;
    document.querySelectorAll('#panell-pro .param-row').forEach(el => {
        if (el.dataset.v3d) el.classList.toggle('param-selected', !!a && el.dataset.v3d === a.var);
        else if (a) el.classList.remove('param-selected');
    });
    document.querySelectorAll('#panell-pro .pp3d-bloc').forEach(b => {
        b.classList.toggle('obert', !!a && b.dataset.var === a.var);
    });
    document.querySelectorAll('#panell-pro .pp3d-chip').forEach(c => {
        c.classList.toggle('actiu', !!a && c.dataset.var === a.var && String(a.nivell) === c.dataset.niv);
    });
}

function actualitzarCapcaleraVariable() {
    const n = document.getElementById('ppActualNom');
    const u = document.getElementById('ppActualUnitat');
    if (!n) return;
    if (_capa3DActiva) {
        const a = _capa3DActiva;
        const nm = NOMS_VARIABLES_3D[a.var] || a.var;
        const inf = info3D(a.var);
        n.textContent = a.nivell === NIVELL_COLUMNA ? nm : `${nm} @ ${a.nivell} hPa`;
        u.textContent = (inf && inf.unitat) ? inf.unitat : '3D';
    } else {
        n.textContent = nomVariable(variableActiva);
        const inf = infoVariables[variableActiva];
        u.textContent = (inf && inf.unitat) ? inf.unitat : '';
    }
    marcarSeleccio3D();
}

function seleccionarVariable(clau) {
    if (!potVeureVariable(clau)) {
        if (typeof window.mostrarAvisLogin === 'function') {
            window.mostrarAvisLogin(clau);
        } else if (typeof window.obrirModal === 'function') {
            window.obrirModal('modalLogin');
        }
        return;
    }
    _capa3DActiva = null;
    _stormActual = null;
    variableActiva = clau;
    document.querySelectorAll('#panell-pro .param-row').forEach(el => {
        el.classList.toggle('param-selected', el.dataset.clau === clau);
    });
    cfgGuardar({ variable: clau });
    actualitzarCapcaleraVariable();
    actualitzarDades();
    actualitzarLlegenda();
    refrescarVentIsolines();
}

function formatarPoblacio(n) {
    if (!n) return '';
    return n.toLocaleString('ca-ES') + ' hab.';
}

function renderCiutats() {
    const llista = document.getElementById('ppLlistaCiu');
    const info = document.getElementById('ppCiuInfo');
    const treu = document.getElementById('ppTreuCiu');
    const inp = document.getElementById('ppCercaCiu');
    if (!llista) return;

    treu.style.display = _ciutatSel ? 'flex' : 'none';

    if (!_ciutats.length) {
        info.textContent = '';
        llista.innerHTML = '<div class="pp-buit">Carregant ciutats...</div>';
        return;
    }

    const q = nrm(inp.value);
    let res;
    if (!q) {
        res = _ciutats.slice(0, 15);
        info.textContent = `${_ciutats.length} ciutats disponibles - les més poblades`;
    } else {
        const mots = q.split(/\s+/);
        res = _ciutats.filter(c => mots.every(m => c._n.includes(m)));
        res.sort((a, b) => (b._n.startsWith(q) - a._n.startsWith(q)) || ((b.poblacio || 0) - (a.poblacio || 0)));
        info.textContent = `${res.length} resultat${res.length === 1 ? '' : 's'}`;
        res = res.slice(0, 60);
    }

    llista.innerHTML = '';
    if (!res.length) {
        llista.innerHTML = '<div class="pp-buit">Cap ciutat coincideix amb la cerca</div>';
        return;
    }
    res.forEach(c => {
        const f = document.createElement('div');
        const sel = _ciutatSel && _ciutatSel === c;
        f.className = 'ciu-fila' + (sel ? ' sel' : '');
        f.innerHTML = `<span class="ciu-pin${c.capital ? ' cap' : ''}"></span>
            <span class="ciu-nom">${c.nom}</span>
            <span class="ciu-pob">${formatarPoblacio(c.poblacio)}</span>`;
        f.addEventListener('click', () => {
            _ciutatSel = c;
            cfgGuardar({ ciutat: c.nom });
            volarA(c.lon, c.lat, Math.max(vista.k, 5));
            renderCiutats();
            programarRedibuix();
        });
        llista.appendChild(f);
    });
}

// ═══════════════════════════════════════════════════════════════════
//  MANIFEST
// ═══════════════════════════════════════════════════════════════════
function ordreDia(dia) {
    const fixos = { ahir: -1, avui: 0, dema: 1, dema_passat: 2 };
    return (dia in fixos) ? fixos[dia] : 99;
}

async function provarManifest(base) {
    const r = await fetch(base + 'manifest.json?_cb=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' a ' + base);
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('text/html')) throw new Error('HTML en lloc de JSON a ' + base);
    const m = await r.json();
    if (!m.hores || !Array.isArray(m.hores)) throw new Error('El manifest no té la clau hores');
    return m;
}

async function carregarManifest() {
    const errors = [];
    for (const base of CARPETES_CANDIDATES) {
        try {
            const manifest = await provarManifest(base);
            PNG_BASE = base;
            BASE_3D = base;
            if (manifest.aspect) { aspecte = manifest.aspect; aspecteDelManifest = true; }
            if (manifest.extent) window._extentManifest = manifest.extent;
            infoVariables = manifest.variables || {};
            infoVariables3D = manifest.variables_3d || {};
            hores3D = manifest.hores_3d || [];

            manifest.hores.sort((a, b) => {
                const dd = ordreDia(a.dia) - ordreDia(b.dia);
                if (dd !== 0) return dd;
                if (ordreDia(a.dia) === 99 && a.dia !== b.dia) return String(a.dia).localeCompare(String(b.dia));
                return a.hora - b.hora;
            });

            totesLesHores = manifest.hores.map((h, i) => ({
                step: i, hora: h.hora, dia: h.dia, variables: h.variables || []
            }));
            return totesLesHores;
        } catch (e) {
            errors.push(e.message);
        }
    }
    _errorManifest = errors.join(' | ');
    console.error('[manifest]', _errorManifest);
    totesLesHores = [];
    return [];
}

// ═══════════════════════════════════════════════════════════════════
//  DADES
// ═══════════════════════════════════════════════════════════════════
function construirUrlPng(idx, clau) {
    if (idx < 0 || idx >= totesLesHores.length) return null;
    const info = totesLesHores[idx];
    return `${PNG_BASE}sfc_${String(info.hora).padStart(2, '0')}_${info.dia}_${clau}.png`;
}

function negreABlanc(img, url) {
    if (_cacheDadesBlanques.has(url)) return _cacheDadesBlanques.get(url);
    let resultat = url;
    try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (w && h) {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const cx = c.getContext('2d', { willReadFrequently: true });
            cx.drawImage(img, 0, 0);
            const id = cx.getImageData(0, 0, w, h);
            const d = id.data;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] === 0) continue;
                if (Math.max(d[i], d[i + 1], d[i + 2]) <= LLINDAR_NEGRE) {
                    d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
                }
            }
            cx.putImageData(id, 0, 0);
            resultat = c.toDataURL('image/png');
        }
    } catch (e) { resultat = url; }
    _cacheDadesBlanques.set(url, resultat);
    _llevarCache(_cacheDadesBlanques, MAX_CACHE_BLANQUES);
    return resultat;
}

function actualitzarDades() {
    if (_capa3DActiva) return;
    const url = construirUrlPng(curIdx, variableActiva);
    const token = ++_tokenDades;
    if (!url) { imgDades.style.visibility = 'hidden'; _urlDades = null; return; }
    if (url === _urlDades) return;

    const pre = new Image();
    pre.decoding = 'async';
    pre.onload = () => {
        if (token !== _tokenDades) return;
        imgDades.src = NEGRE_A_BLANC ? negreABlanc(pre, url) : url;
        imgDades.style.visibility = 'visible';
        _urlDades = url;
    };
    pre.onerror = () => {
        if (token !== _tokenDades) return;
        imgDades.style.visibility = 'hidden';
        _urlDades = null;
    };
    pre.src = url;
}

function precarregarSeguent() {
    if (!totesLesHores.length) return;
    if (_capa3DActiva) return;
    const next = construirUrlPng((curIdx + 1) % totesLesHores.length, variableActiva);
    if (next) {
        const im = new Image();
        im.decoding = 'async';
        im.src = next;
    }
}

function actualitzarLlegenda() {
    // 🔽 Primer comprova si tenim llegenda CSS definida
    const clauLlegenda = _capa3DActiva ? _capa3DActiva.var : variableActiva;
    if (mostrarLlegendaCss(clauLlegenda)) return;

    // Si no, comportament original (PNG)
    eliminarLlegendaCss();
    imgLlegenda.onload = () => { imgLlegenda.style.display = 'block'; };
    imgLlegenda.onerror = () => { imgLlegenda.style.display = 'none'; };
    if (_capa3DActiva) {
        imgLlegenda.src = `${BASE_3D}legend_3d_${_capa3DActiva.var}.png`;
    } else {
        imgLlegenda.src = `${PNG_BASE}legend_${variableActiva}.png`;
    }
}

// ═══════════════════════════════════════════════════════════════════
//  CÀRREGA DE FITXERS .js
// ═══════════════════════════════════════════════════════════════════
function carregarScript(url, opcional) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url + '?_cb=' + Date.now();
        s.async = true;
        s.onload = () => { s.remove(); resolve(); };
        s.onerror = () => {
            s.remove();
            if (opcional) resolve();
            else reject(new Error('No s\'ha pogut carregar ' + url));
        };
        document.head.appendChild(s);
    });
}

async function carregarIsolines(idx, clau) {
    if (idx < 0 || idx >= totesLesHores.length) return null;
    if (_capa3DActiva) return null;
    const info = totesLesHores[idx];
    const hora = String(info.hora).padStart(2, '0');
    const clauFitxer = `${hora}_${info.dia}_${clau}`;
    if (_cacheIsolines.has(clauFitxer)) return _cacheIsolines.get(clauFitxer);
    try {
        await carregarScript(`${PNG_BASE}isolines_${clauFitxer}.js`);
        const dades = (window.ISOLINIES && window.ISOLINIES[clauFitxer]) || null;
        _cacheIsolines.set(clauFitxer, dades);
        _llevarCache(_cacheIsolines, MAX_CACHE_ISOLINES);
        return dades;
    } catch (e) {
        _cacheIsolines.set(clauFitxer, null);
        _llevarCache(_cacheIsolines, MAX_CACHE_ISOLINES);
        return null;
    }
}

async function carregarVent(idx) {
    if (idx < 0 || idx >= totesLesHores.length) return null;
    const info = totesLesHores[idx];
    const hora = String(info.hora).padStart(2, '0');
    const clauFitxer = `${hora}_${info.dia}`;
    if (_cacheVent.has(clauFitxer)) return _cacheVent.get(clauFitxer);
    try {
        await carregarScript(`${PNG_BASE}vent_${clauFitxer}.js`);
        const dades = (window.VENT && window.VENT[clauFitxer]) || null;
        _cacheVent.set(clauFitxer, dades);
        _llevarCache(_cacheVent, MAX_CACHE_VENT);
        return dades;
    } catch (e) {
        _cacheVent.set(clauFitxer, null);
        _llevarCache(_cacheVent, MAX_CACHE_VENT);
        return null;
    }
}

async function carregarNoms() {
    if (_ciutats.length) return _ciutats;
    const fonts = [...CARPETES_NOMS, PNG_BASE];
    const mapa = new Map();
    for (const base of fonts) {
        try {
            window.NOMS_MAPA = undefined;
            await carregarScript(base + 'noms.js', true);
            const dades = (window.NOMS_MAPA && window.NOMS_MAPA.ciutats) || [];
            for (const c of dades) {
                if (!c || !c.nom || !isFinite(c.lon) || !isFinite(c.lat)) continue;
                const clau = nrm(c.nom);
                const ex = mapa.get(clau);
                if (!ex) mapa.set(clau, Object.assign({}, c));
                else {
                    ex.poblacio = Math.max(ex.poblacio || 0, c.poblacio || 0);
                    ex.capital = ex.capital || !!c.capital;
                }
            }
        } catch (e) {}
    }
    _ciutats = [...mapa.values()];
    _ciutats.forEach(c => { c._n = nrm(c.nom); });
    _ciutats.sort((a, b) => (b.poblacio || 0) - (a.poblacio || 0));
    return _ciutats;
}

async function carregarLinies() {
    if (_linies) return _linies;
    for (const base of CARPETES_NOMS) {
        try {
            await carregarScript(base + 'lineas.js', true);
            const d = window.LINEAS_MAPA;
            if (d && ((d.fronteres && d.fronteres.length) || (d.provincies && d.provincies.length))) {
                _linies = { fronteres: d.fronteres || [], provincies: d.provincies || [] };
                if (imgVores) imgVores.style.visibility = 'hidden';
                return _linies;
            }
        } catch (e) {}
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════════
//  VORES
// ═══════════════════════════════════════════════════════════════════
function traçarPolilinies(ctx, polilinies, W, H) {
    ctx.beginPath();
    for (const lin of polilinies) {
        if (!Array.isArray(lin) || lin.length < 2) continue;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const proj = new Array(lin.length);
        for (let i = 0; i < lin.length; i++) {
            const p = lonLatAPantalla(lin[i][0], lin[i][1]);
            if (!p) { proj.length = 0; break; }
            proj[i] = p;
            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[1] > maxY) maxY = p[1];
        }
        if (proj.length < 2) continue;
        if (maxX < 0 || minX > W || maxY < 0 || minY > H) continue;
        ctx.moveTo(proj[0][0], proj[0][1]);
        for (let i = 1; i < proj.length; i++) ctx.lineTo(proj[i][0], proj[i][1]);
    }
}
function pintarTraç(ctx, polilinies, W, H, color, amplada, colorHalo, ampladaHalo) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    traçarPolilinies(ctx, polilinies, W, H);
    ctx.strokeStyle = colorHalo; ctx.lineWidth = ampladaHalo; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = amplada; ctx.stroke();
}
function dibuixarVores() {
    if (!canvasVores) return;
    const { ctx, W, H } = prepararCtx(canvasVores);
    if (!_linies || !window._extentManifest) return;
    const esc = Math.min(1.8, Math.max(0.8, Math.sqrt(vista.k)));
    ctx.save();
    retallarAImatge(ctx);
    if (window.MOSTRAR_PROVINCIES && _linies.provincies.length) {
        const tot = [];
        for (const p of _linies.provincies) for (const l of (p.linies || [])) tot.push(l);
        const a = VORES_CFG.provinciaAmplada * esc;
        pintarTraç(ctx, tot, W, H, VORES_CFG.provinciaColor, a,
            VORES_CFG.provinciaHalo, a + VORES_CFG.provinciaHaloExtra * esc);
    }
    if (window.MOSTRAR_FRONTERES && _linies.fronteres.length) {
        const a = VORES_CFG.fronteraAmplada * esc;
        pintarTraç(ctx, _linies.fronteres, W, H, VORES_CFG.fronteraColor, a,
            VORES_CFG.fronteraHalo, a + VORES_CFG.fronteraHaloExtra * esc);
    }
    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
//  ISOLÍNIES
// ═══════════════════════════════════════════════════════════════════
function segmentsDeNivell(nivell) {
    const p = nivell && nivell.punts;
    if (!Array.isArray(p) || !p.length) return [];
    if (Array.isArray(p[0]) && Array.isArray(p[0][0])) return p.filter(s => Array.isArray(s) && s.length >= 2);
    const segs = []; let cur = [];
    for (const pt of p) {
        if (!Array.isArray(pt) || !isFinite(pt[0]) || !isFinite(pt[1])) {
            if (cur.length >= 2) segs.push(cur);
            cur = [];
        } else cur.push(pt);
    }
    if (cur.length >= 2) segs.push(cur);
    return segs;
}
function dibuixarLiniaSuau(ctx, punts, salt) {
    const n = punts.length;
    if (n < 2) return;
    const tancada = n > 3 && Math.abs(punts[0][0] - punts[n - 1][0]) < 0.5 && Math.abs(punts[0][1] - punts[n - 1][1]) < 0.5;
    const s = n < 80 ? 1 : salt;
    const pts = [];
    const fi = tancada ? n - 1 : n;
    for (let i = 0; i < fi; i += s) pts.push(punts[i]);
    if (!tancada && pts[pts.length - 1] !== punts[n - 1]) pts.push(punts[n - 1]);
    if (pts.length < 2) return;
    ctx.beginPath();
    if (pts.length < 3) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
        return;
    }
    const m = pts.length;
    const at = i => tancada ? pts[((i % m) + m) % m] : pts[Math.max(0, Math.min(m - 1, i))];
    const tram = tancada ? m : m - 1;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < tram; i++) {
        const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
        ctx.bezierCurveTo(
            p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
            p2[0], p2[1]
        );
    }
    if (tancada) ctx.closePath();
    ctx.stroke();
}
function numEtiquetesPerSegment() {
    const z = vista.k;
    if (z < 1.5) return 0;
    if (z < 2.5) return 1;
    if (z < 4) return 2;
    return 3;
}
function formatarNivell(v) {
    if (Math.abs(v) < 1e-9) return '0';
    const a = Math.abs(v);
    if (a >= 100) return Math.round(v).toString();
    if (a >= 1) return (Math.round(v * 10) / 10).toString();
    if (a >= 0.01) return v.toFixed(2);
    return v.toExponential(1);
}
function dibuixarIsolines() {
    if (!canvasIsolines) return;
    const { ctx, W, H } = prepararCtx(canvasIsolines);
    if (!window.MOSTRAR_ISOLINIES || !window._extentManifest) return;
    if (!_isolinesActuals || !Array.isArray(_isolinesActuals.nivells)) return;

    ctx.save();
    retallarAImatge(ctx);
    let salt = Math.max(1, Math.round(ISO_CFG.decimacioBase / Math.max(1, vista.k)));
    if (vista.k >= 4) salt = 1;
    if (vista.k < 0.7) salt = Math.round(ISO_CFG.decimacioBase * 1.5);

    const gruix = ISO_CFG.amplada * Math.min(2.0, Math.max(0.7, Math.sqrt(vista.k)));
    ctx.strokeStyle = ISO_CFG.color;
    ctx.lineWidth = gruix;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const etiquetesPendents = [];
    const nEtiq = numEtiquetesPerSegment();

    for (const nivell of _isolinesActuals.nivells) {
        const segs = segmentsDeNivell(nivell);
        for (const seg of segs) {
            const proj = [];
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const pt of seg) {
                const p = lonLatAPantalla(pt[0], pt[1]);
                if (!p) continue;
                proj.push(p);
                if (p[0] < minX) minX = p[0];
                if (p[0] > maxX) maxX = p[0];
                if (p[1] < minY) minY = p[1];
                if (p[1] > maxY) maxY = p[1];
            }
            if (proj.length < 2) continue;
            if (maxX < 0 || minX > W || maxY < 0 || minY > H) continue;
            dibuixarLiniaSuau(ctx, proj, salt);
            if (nEtiq > 0 && proj.length >= ISO_CFG.minPuntsPerEtiqueta) {
                for (let k = 1; k <= nEtiq; k++) {
                    const i = Math.floor((k / (nEtiq + 1)) * proj.length);
                    const p = proj[i];
                    if (p && p[0] > 10 && p[0] < W - 10 && p[1] > 10 && p[1] < H - 10) {
                        etiquetesPendents.push({ x: p[0], y: p[1], text: formatarNivell(nivell.v) });
                    }
                }
            }
        }
    }
    if (etiquetesPendents.length) {
        const mida = ISO_CFG.midaFont * Math.min(1.5, Math.max(0.85, Math.sqrt(vista.k)));
        ctx.font = `${mida}px 'Inter', system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = ISO_CFG.gruixOmbra;
        ctx.strokeStyle = ISO_CFG.ombraEtiqueta;
        ctx.fillStyle = ISO_CFG.colorEtiqueta;
        const posades = [];
        const d2 = ISO_CFG.distMinEtiquetes * ISO_CFG.distMinEtiquetes;
        for (const e of etiquetesPendents) {
            let ocupat = false;
            for (const q of posades) {
                const dx = q.x - e.x, dy = q.y - e.y;
                if (dx * dx + dy * dy < d2) { ocupat = true; break; }
            }
            if (ocupat) continue;
            posades.push(e);
            ctx.strokeText(e.text, e.x, e.y);
            ctx.fillText(e.text, e.x, e.y);
        }
    }
    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
//  BARBES DE STORM MOTION
// ═══════════════════════════════════════════════════════════════════
function ferBarba(ctx, x, y, u, v, L) {
    const mag = Math.hypot(u, v);
    const sp = Math.round(mag * MS_A_KT / 5) * 5;

    if (sp < 5 || mag < 1e-6) {
        for (const [col, lw] of BARBES_PASSADES) {
            ctx.beginPath();
            ctx.arc(x, y, 2.6, 0, Math.PI * 2);
            ctx.lineWidth = lw; ctx.strokeStyle = col;
            ctx.stroke();
        }
        return;
    }

    const dx = -u / mag, dy = v / mag;
    const ex = x + dx * L, ey = y + dy * L;
    const px = -dy, py = dx;
    const fl = L * 0.45, pas = L * 0.13;

    const n50 = Math.floor(sp / 50);
    const r = sp - n50 * 50;
    const n10 = Math.floor(r / 10);
    const n5 = (r - n10 * 10) >= 5 ? 1 : 0;

    const pt = t => [ex - dx * t, ey - dy * t];

    const traç = () => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        let t = 0;
        for (let i = 0; i < n50; i++) {
            const a = pt(t), b = pt(t + pas * 1.5);
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(a[0] + px * fl, a[1] + py * fl);
            ctx.lineTo(b[0], b[1]);
            ctx.closePath();
            t += pas * 1.9;
        }
        for (let i = 0; i < n10; i++) {
            const a = pt(t);
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(a[0] + px * fl + dx * fl * 0.3, a[1] + py * fl + dy * fl * 0.3);
            t += pas;
        }
        if (n5) {
            if (n50 === 0 && n10 === 0) t = pas;
            const a = pt(t);
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(a[0] + px * fl * 0.5 + dx * fl * 0.15, a[1] + py * fl * 0.5 + dy * fl * 0.15);
        }
    };

    for (const [col, lw] of BARBES_PASSADES) {
        traç();
        ctx.lineWidth = lw;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.stroke();
        ctx.fill();
    }
}

function dibuixarBarbesStorm(ctx, W, H) {
    const sd = _stormActual;
    if (!sd || !sd.lats || !sd.lons || !sd.u || !sd.v) return;
    const nLat = sd.lats.length, nLon = sd.lons.length;
    if (nLat < 2 || nLon < 2) return;

    const pa = lonLatAPantalla(sd.lons[0], sd.lats[0]);
    const pb = lonLatAPantalla(sd.lons[1], sd.lats[0]);
    const pc = lonLatAPantalla(sd.lons[0], sd.lats[1]);
    if (!pa || !pb || !pc) return;
    const sep = Math.max(Math.abs(pb[0] - pa[0]), Math.abs(pc[1] - pa[1]), 1);
    const salt = Math.max(1, Math.ceil(BARBES_CFG.separacioMin / sep));
    const L = BARBES_CFG.llargada * Math.min(1.25, Math.max(0.85, Math.sqrt(vista.k)));

    ctx.save();
    retallarAImatge(ctx);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < nLat; i += salt) {
        const filaU = sd.u[i], filaV = sd.v[i];
        if (!filaU || !filaV) continue;
        for (let j = 0; j < nLon; j += salt) {
            const u = filaU[j], v = filaV[j];
            if (u == null || v == null) continue;
            const p = lonLatAPantalla(sd.lons[j], sd.lats[i]);
            if (!p) continue;
            if (p[0] < -40 || p[0] > W + 40 || p[1] < -40 || p[1] > H + 40) continue;
            ferBarba(ctx, p[0], p[1], u, v, L);
        }
    }
    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
//  VENT (streamlines) + BARBES
// ═══════════════════════════════════════════════════════════════════
function crearAleatori(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function dibuixarFletxa(ctx, x, y, ang, mida) {
    const a1 = ang - VENT_CFG.angleFletxa;
    const a2 = ang + VENT_CFG.angleFletxa;
    ctx.beginPath();
    ctx.moveTo(x - mida * Math.cos(a1), y - mida * Math.sin(a1));
    ctx.lineTo(x, y);
    ctx.lineTo(x - mida * Math.cos(a2), y - mida * Math.sin(a2));
    ctx.stroke();
}
function dibuixarVent() {
    if (!canvasVent) return;
    const { ctx, W, H } = prepararCtx(canvasVent);

const VARS_AMB_BARBES = ['storm_speed', 'shear_01', 'shear_03', 'shear_06'];
if (_capa3DActiva && VARS_AMB_BARBES.includes(_capa3DActiva.var)) {
    if (window.MOSTRAR_BARBES && window._extentManifest) dibuixarBarbesStorm(ctx, W, H);
    return;
}

    if (!window.MOSTRAR_VENT || !window._extentManifest) return;
    const vd = _ventActual;
    if (!vd || !vd.u || !vd.v || !vd.lats || !vd.lons) return;
    const Nlat = vd.lats.length, Nlon = vd.lons.length;
    if (Nlat < 2 || Nlon < 2) return;

    const lat0 = vd.lats[0], lat1 = vd.lats[Nlat - 1];
    const lon0 = vd.lons[0], lon1 = vd.lons[Nlon - 1];
    const dLat = lat1 - lat0, dLon = lon1 - lon0;
    if (!dLat || !dLon) return;

    const ext = window._extentManifest;
    const { sw, sh } = dimensionsStage();
    const signeV = VENT_INVERTIR_V ? -1 : 1;

    function mostra(px, py) {
        const xs = (px - vista.x) / vista.k;
        const ys = (py - vista.y) / vista.k;
        if (xs < 0 || xs > sw || ys < 0 || ys > sh) return null;
        const lon = ext.lon_w + (xs / sw) * (ext.lon_e - ext.lon_w);
        const lat = ext.lat_n - (ys / sh) * (ext.lat_n - ext.lat_s);
        const fx = ((lon - lon0) / dLon) * (Nlon - 1);
        const fy = ((lat - lat0) / dLat) * (Nlat - 1);
        if (fx < 0 || fx > Nlon - 1 || fy < 0 || fy > Nlat - 1) return null;
        const x0 = Math.min(Nlon - 2, fx | 0), y0 = Math.min(Nlat - 2, fy | 0);
        const tx = fx - x0, ty = fy - y0;
        const x1 = x0 + 1, y1 = y0 + 1;
        const u00 = vd.u[y0][x0], u10 = vd.u[y0][x1], u01 = vd.u[y1][x0], u11 = vd.u[y1][x1];
        const v00 = vd.v[y0][x0], v10 = vd.v[y0][x1], v01 = vd.v[y1][x0], v11 = vd.v[y1][x1];
        if (u00 == null || u10 == null || u01 == null || u11 == null ||
            v00 == null || v10 == null || v01 == null || v11 == null) return null;
        return {
            u: (1 - ty) * ((1 - tx) * u00 + tx * u10) + ty * ((1 - tx) * u01 + tx * u11),
            v: signeV * ((1 - ty) * ((1 - tx) * v00 + tx * v10) + ty * ((1 - tx) * v01 + tx * v11)),
        };
    }

    const fz = Math.sqrt(vista.k);
    const STEP = Math.max(16, VENT_CFG.separacio / fz);
    const STEP_LEN = VENT_CFG.longitudPas * (1 / fz) * 1.6;
    const MAX_STEPS = Math.round(VENT_CFG.maxPassos * fz);
    const GRID = VENT_CFG.gridVisitat;
    const gw = Math.floor(W / GRID) + 1;
    const gh = Math.floor(H / GRID) + 1;
    const visitat = new Uint8Array(gw * gh);
    const rnd = crearAleatori(12345);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = VENT_CFG.amplada;
    ctx.strokeStyle = VENT_CFG.color;

    function caminar(sx, sy, dir) {
        const pts = [];
        let cx = sx, cy = sy;
        for (let s = 0; s < MAX_STEPS; s++) {
            const uv = mostra(cx, cy);
            if (!uv) break;
            const mag = Math.hypot(uv.u, uv.v);
            if (mag < 0.05) break;
            cx += dir * (uv.u / mag) * STEP_LEN;
            cy -= dir * (uv.v / mag) * STEP_LEN;
            const gx = Math.floor(cx / GRID), gy = Math.floor(cy / GRID);
            if (gy < 0 || gy >= gh || gx < 0 || gx >= gw) break;
            if (visitat[gy * gw + gx]) break;
            pts.push([cx, cy]);
        }
        return pts;
    }

    for (let py = 0; py < H; py += STEP) {
        for (let px = 0; px < W; px += STEP) {
            const sx = px + (rnd() - 0.5) * STEP * 0.5;
            const sy = py + (rnd() - 0.5) * STEP * 0.5;
            const gx0 = Math.floor(sx / GRID), gy0 = Math.floor(sy / GRID);
            if (gy0 < 0 || gy0 >= gh || gx0 < 0 || gx0 >= gw) continue;
            if (visitat[gy0 * gw + gx0]) continue;
            const fwd = caminar(sx, sy, 1);
            const back = caminar(sx, sy, -1);
            const linia = [...back.reverse(), [sx, sy], ...fwd];
            if (linia.length <= 8) continue;
            for (let i = 0; i < linia.length; i += 3) {
                const gx = Math.floor(linia[i][0] / GRID), gy = Math.floor(linia[i][1] / GRID);
                if (gy >= 0 && gy < gh && gx >= 0 && gx < gw) visitat[gy * gw + gx] = 1;
            }
            ctx.beginPath();
            ctx.moveTo(linia[0][0], linia[0][1]);
            for (let i = 1; i < linia.length; i++) ctx.lineTo(linia[i][0], linia[i][1]);
            ctx.stroke();
            if (linia.length > 12) {
                [0.4, 0.75].forEach(f => {
                    const idx = Math.floor(linia.length * f);
                    if (idx < 1 || idx >= linia.length) return;
                    const p0 = linia[idx - 1], p1 = linia[idx];
                    dibuixarFletxa(ctx, p1[0], p1[1],
                        Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), VENT_CFG.midaFletxa);
                });
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
//  CIUTATS
// ═══════════════════════════════════════════════════════════════════
function llindarPoblacio() {
    const dens = DENSITAT_CIUTATS[window.DENSITAT_CIUTATS_ACTIVA] || DENSITAT_CIUTATS.dens;
    if (dens.minPoblacio === Infinity) return Infinity;
    const z = vista.k;
    let llindarZoom;
    if (z < 1.2) llindarZoom = 50000;
    else if (z < 2.0) llindarZoom = 15000;
    else if (z < 3.5) llindarZoom = 5000;
    else if (z < 6) llindarZoom = 1000;
    else llindarZoom = 0;
    return Math.max(dens.minPoblacio, llindarZoom);
}
function pintarCiutat(ctx, p, c, midaPunt, midaFont, destacada) {
    const capital = !!c.capital;
    const rP = destacada ? midaPunt + 2 : midaPunt;
    if (destacada) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], rP + 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,215,0,0.18)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,215,0,0.95)';
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p[0], p[1], rP, 0, Math.PI * 2);
    ctx.fillStyle = (capital || destacada) ? CIUTATS_CFG.colorPuntCapital : CIUTATS_CFG.colorPunt;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    const tx = p[0] + rP + 3 + (destacada ? 8 : 0), ty = p[1];
    if (destacada) ctx.font = `700 ${midaFont * 1.25}px 'Inter', system-ui, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = CIUTATS_CFG.ombra;
    ctx.strokeText(c.nom, tx, ty);
    ctx.fillStyle = (capital || destacada) ? CIUTATS_CFG.colorTextCapital : CIUTATS_CFG.colorText;
    ctx.fillText(c.nom, tx, ty);
    if (destacada) ctx.font = `600 ${midaFont}px 'Inter', system-ui, sans-serif`;
}
function dibuixarCiutats() {
    if (!canvasNoms) return;
    const { ctx, W, H } = prepararCtx(canvasNoms);
    if (!_ciutats.length || !window._extentManifest) return;
    const sq = Math.sqrt(vista.k);
    const midaFont = CIUTATS_CFG.midaFontBase * Math.min(1.4, Math.max(0.85, sq));
    const midaPunt = CIUTATS_CFG.midaPuntBase * Math.min(1.4, Math.max(0.9, sq));
    ctx.font = `600 ${midaFont}px 'Inter', system-ui, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const ocupats = [];
    const xoca = r => {
        for (const o of ocupats) {
            if (r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]) return true;
        }
        return false;
    };
    if (_ciutatSel) {
        const p = lonLatAPantalla(_ciutatSel.lon, _ciutatSel.lat);
        if (p && p[0] > -80 && p[0] < W + 80 && p[1] > -80 && p[1] < H + 80) {
            const tw = ctx.measureText(_ciutatSel.nom).width * 1.25;
            ocupats.push([p[0] - 16, p[1] - midaFont, p[0] + 24 + tw, p[1] + midaFont]);
            pintarCiutat(ctx, p, _ciutatSel, midaPunt, midaFont, true);
        }
    }
    if (!window.MOSTRAR_CIUTATS) return;
    const llindar = llindarPoblacio();
    if (llindar === Infinity) return;
    let n = 0;
    for (const c of _ciutats) {
        if (n >= CIUTATS_CFG.maxVisibles) break;
        if (c === _ciutatSel) continue;
        if ((c.poblacio || 0) < llindar) continue;
        const p = lonLatAPantalla(c.lon, c.lat);
        if (!p) continue;
        if (p[0] < -80 || p[0] > W + 80 || p[1] < -80 || p[1] > H + 80) continue;
        const tw = ctx.measureText(c.nom).width;
        const rect = [p[0] - midaPunt - 1, p[1] - midaFont / 2 - 1,
                      p[0] + midaPunt + 4 + tw, p[1] + midaFont / 2 + 1];
        if (xoca(rect)) continue;
        ocupats.push(rect);
        pintarCiutat(ctx, p, c, midaPunt, midaFont, false);
        n++;
    }
}

// ═══════════════════════════════════════════════════════════════════
//  HORES
// ═══════════════════════════════════════════════════════════════════
function mostrarHora(idx) {
    if (idx < 0 || idx >= totesLesHores.length) return;

    // 🔒 Hores bloquejades sense login (1 de cada 3)
    if (!usuariLoguejat() && idx % 3 !== 0) {
        if (typeof window.mostrarAvisLogin === 'function') {
            window.mostrarAvisLogin('aquesta hora');
        } else if (typeof window.obrirModal === 'function') {
            window.obrirModal('modalLogin');
        }
        return;
    }

    curIdx = idx;
    if (!_animacioActiva) {
        const h = totesLesHores[idx];
        cfgGuardar({ hora: { hora: h.hora, dia: h.dia } });
    }
    if (_capa3DActiva) {
        mostrarCapa3D(_capa3DActiva.var, _capa3DActiva.nivell);
    } else {
        actualitzarDades();
    }
    resaltarHoraEnGrid(idx);
    actualitzarEtiquetaHora();
    precarregarSeguent();
    refrescarVentIsolines();
}

async function refrescarVentIsolines() {
    const token = ++_tokenVI;
    const idx = curIdx, clau = variableActiva;
    _isolinesActuals = null;
    programarRedibuix();

    if (_capa3DActiva) {
        const iso = window.MOSTRAR_ISOLINIES
            ? await carregarIsolines3D(`${String(_capa3DActiva.hora).padStart(2, '0')}_${_capa3DActiva.dia}_${_capa3DActiva.var}_${_capa3DActiva.nivell}`)
            : null;
        if (token !== _tokenVI) return;
        _isolinesActuals = iso;
        programarRedibuix();
        return;
    }
    const [vent, iso] = await Promise.all([
        carregarVent(idx),
        window.MOSTRAR_ISOLINIES ? carregarIsolines(idx, clau) : Promise.resolve(null),
    ]);
    if (token !== _tokenVI) return;
    _ventActual = vent;
    _isolinesActuals = iso;
    programarRedibuix();
}

function resaltarHoraEnGrid(idx) {
    document.querySelectorAll('.fh-item').forEach((el, i) => {
        const actiu = i === idx;
        el.classList.toggle('active', actiu);
    });
    const act = document.querySelector('.fh-item.active');
    if (act) act.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}
function actualitzarEtiquetaHora() {
    const label = document.getElementById('current_time_label');
    if (!label) return;
    const info = totesLesHores[curIdx];
    label.textContent = info ? `${String(info.hora).padStart(2, '0')}:00 - ${info.dia}` : '';
}
function construirGraellaHores() {
    const grid = document.getElementById('fh_grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!totesLesHores.length) {
        grid.innerHTML = '<div style="color:#556680;padding:6px 12px;font-size:11px;">Sense hores</div>';
        return;
    }
    const container = document.createElement('div');
    container.className = 'fh-scroll';
    totesLesHores.forEach((item, i) => {
        const hora = String(item.hora).padStart(2, '0');
        const dia = item.dia;
        let classeDia = '';
        let textDia = dia;
        if (dia === 'ahir') { classeDia = 'fh-ahir'; textDia = 'ahir'; }
        else if (dia === 'avui') { classeDia = 'fh-avui'; textDia = 'avui'; }
        else if (dia === 'dema') { classeDia = 'fh-dema'; textDia = 'dema'; }
        else if (dia === 'dema_passat') { classeDia = 'fh-dema2'; textDia = 'd+2'; }
        const actiu = i === curIdx;
        const bloquejada = !usuariLoguejat() && (i % 3 !== 0);

        const cell = document.createElement('div');
        cell.className = 'fh-item' + (actiu ? ' active' : '') + (bloquejada ? ' locked' : '');
        cell.dataset.idx = i;
        cell.title = bloquejada ? 'Inicia sessió per veure aquesta hora' : '';
        cell.innerHTML = `
            <div class="fh-hora ${classeDia}">${hora}h</div>
            <div class="fh-dia ${classeDia}">${textDia}</div>
        `;
        cell.addEventListener('click', () => {
            if (bloquejada) {
                if (typeof window.mostrarAvisLogin === 'function') {
                    window.mostrarAvisLogin(`hora ${hora}h ${textDia}`);
                } else if (typeof window.obrirModal === 'function') {
                    window.obrirModal('modalLogin');
                }
                return;
            }
            mostrarHora(i);
        });
        container.appendChild(cell);
    });
    grid.appendChild(container);
}

// ═══════════════════════════════════════════════════════════════════
//  ANIMACIÓ
// ═══════════════════════════════════════════════════════════════════
let _animacioActiva = false;
let _intervalAnimacio = null;
const VELOCITAT_ANIMACIO = 1200;

function pintarBotoPlay() {
    const btn = document.getElementById('btnPlay');
    if (!btn) return;
    if (_animacioActiva) {
        btn.innerHTML = `${ICO.stop}<span>Aturar</span>`;
        btn.classList.add('actiu');
    } else {
        btn.innerHTML = `${ICO.play}<span>Animació</span>`;
        btn.classList.remove('actiu');
    }
}
function toggleAnimacio() {
    if (!totesLesHores.length) return;
    if (!usuariLoguejat()) {
        if (typeof window.mostrarAvisLogin === 'function') {
            window.mostrarAvisLogin('l\'animació');
        } else if (typeof window.obrirModal === 'function') {
            window.obrirModal('modalLogin');
        }
        return;
    }
    if (_animacioActiva) {
        clearInterval(_intervalAnimacio);
        _animacioActiva = false;
        pintarBotoPlay();
        const h = totesLesHores[curIdx];
        if (h) cfgGuardar({ hora: { hora: h.hora, dia: h.dia } });
    } else {
        _animacioActiva = true;
        pintarBotoPlay();
        _intervalAnimacio = setInterval(() => {
            mostrarHora((curIdx + 1) % totesLesHores.length);
        }, VELOCITAT_ANIMACIO);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  INICIALITZACIÓ
// ═══════════════════════════════════════════════════════════════════
async function inicialitzar() {
    const btnPlay = document.getElementById('btnPlay');
    if (btnPlay) btnPlay.addEventListener('click', toggleAnimacio);
    pintarBotoPlay();

    crearEscena();

    const hores = await carregarManifest();

    const overlay = document.getElementById('loading_overlay');
    if (overlay) overlay.classList.add('hidden');

    if (!hores.length) {
        const grid = document.getElementById('fh_grid');
        if (grid) {
            grid.innerHTML = '<div style="color:#ff6b6b;padding:8px 12px;font-size:11px;">Sense dades: '
                + (_errorManifest || 'manifest buit') + '</div>';
        }
        return;
    }

    imgFons.src = PNG_BASE + 'fons.png';
    imgVores.src = PNG_BASE + 'vores.png';
    ajustarVista(false);
    restaurarVista();

    let idx0 = 0;
    if (_cfg.hora) {
        const i = totesLesHores.findIndex(h => h.hora === _cfg.hora.hora && h.dia === _cfg.hora.dia);
        if (i >= 0) idx0 = i;
    }
    if (!usuariLoguejat() && idx0 % 3 !== 0) idx0 = 0;
    curIdx = idx0;

    construirPanellParametres();
    construirGraellaHores();
    mostrarHora(idx0);
    actualitzarLlegenda();

    await Promise.all([carregarNoms(), carregarLinies()]);

    if (_cfg.ciutat) {
        const q = nrm(_cfg.ciutat);
        _ciutatSel = _ciutats.find(c => c._n === q) || null;
    }
    renderCiutats();
    programarRedibuix();
}

// ═══════════════════════════════════════════════════════════════════
//  EVENTS LOGIN / LOGOUT
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('tc:login', () => {
    if (typeof construirPanellParametres === 'function') construirPanellParametres();
    if (typeof construirGraellaHores === 'function') construirGraellaHores();
});
window.addEventListener('tc:logout', () => {
    if (typeof construirPanellParametres === 'function') construirPanellParametres();
    if (typeof construirGraellaHores === 'function') construirGraellaHores();
    if (!esParametreLliure(variableActiva)) {
        variableActiva = 'st';
        actualitzarDades();
        actualitzarLlegenda();
    }
    if (curIdx % 3 !== 0) mostrarHora(0);
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicialitzar);
} else {
    inicialitzar();
}

// ═══════════════════════════════════════════════════════════════════
//  LLEGENDES CSS (per variables sense PNG de llegenda)
// ═══════════════════════════════════════════════════════════════════

// Defineix aquí les escales de color per cada variable que no tinguis en PNG
const LLEGENDES_CSS = {
    // Exemple per índex convectiu (ajusta colors i valors als teus)
    'convective_index': {
        titol: 'Índex convectiu',
        unitat: '',
        trams: [
            { color: '#4a90e2', valor: '< 1' },
            { color: '#7ed321', valor: '1 - 2' },
            { color: '#f5a623', valor: '2 - 3' },
            { color: '#e94b3c', valor: '3 - 4' },
            { color: '#8b1a1a', valor: '> 4' },
        ],
    },

    // Exemple CAPE (per si el vols tenir també en CSS)
    'cape': {
        titol: 'CAPE',
        unitat: 'J/kg',
        trams: [
            { color: '#3b6fd4', valor: '0 - 500' },
            { color: '#4fc3f7', valor: '500 - 1000' },
            { color: '#aed581', valor: '1000 - 1500' },
            { color: '#ffeb3b', valor: '1500 - 2500' },
            { color: '#ff9800', valor: '2500 - 3500' },
            { color: '#e53935', valor: '> 3500' },
        ],
    },
};

let _llegendaCssEl = null;

function eliminarLlegendaCss() {
    if (_llegendaCssEl) {
        _llegendaCssEl.remove();
        _llegendaCssEl = null;
    }
}

function mostrarLlegendaCss(clau, titolCustom, unitatCustom) {
    eliminarLlegendaCss();
    const def = LLEGENDES_CSS[clau];
    if (!def) return false;

    const el = document.createElement('div');
    el.className = 'llegenda-css';
    const titol = titolCustom || def.titol || clau;
    const unitat = unitatCustom || def.unitat || '';

    let html = `<div class="lc-titol">${titol}${unitat ? `<span class="lc-unitat">${unitat}</span>` : ''}</div>`;
    for (const t of def.trams) {
        html += `<div class="lc-fila">
            <span class="lc-color" style="background:${t.color}"></span>
            <span class="lc-valor">${t.valor}</span>
        </div>`;
    }
    el.innerHTML = html;
    document.body.appendChild(el);
    _llegendaCssEl = el;

    // Amagar el PNG de llegenda perquè no es superposin
    if (imgLlegenda) imgLlegenda.style.display = 'none';
    return true;
}



console.log('✅ mapapngs.js carregat — accés restringit (login obligatori excepte bàsics)');