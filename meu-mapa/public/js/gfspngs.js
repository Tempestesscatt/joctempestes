// ═══════════════════════════════════════════════════════════════════════
//  gfspngs.js — Visor GFS (Atlàntic Nord + Europa) — versió completa
//  Estil idèntic al mapapngs.js (AROME) + Skew-T adaptat al GFS
// ═══════════════════════════════════════════════════════════════════════

const FIT = 'contain';

// ─── Accés: variables lliures (sense login) ────────────────────────
const PARAMETRES_LLIURES = new Set([
    'st', 'sd', 'srh',
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
function usuariLoguejat() { return !!(window._firebaseUser); }
function potVeureVariable(clau) {
    if (esParametreLliure(clau)) return true;
    return usuariLoguejat();
}

// ─── Configuració persistent ───────────────────────────────────────
const CLAU_CFG = 'tempestescat_visor_gfs_v1';
function cfgLlegir() {
    try { return JSON.parse(localStorage.getItem(CLAU_CFG)) || {}; } catch { return {}; }
}
let _cfg = cfgLlegir();
function cfgGuardar(obj) {
    Object.assign(_cfg, obj);
    try { localStorage.setItem(CLAU_CFG, JSON.stringify(_cfg)); } catch {}
}

let OPACITAT_DADES = (typeof _cfg.opacitat === 'number' && _cfg.opacitat >= 0.2 && _cfg.opacitat <= 1)
    ? _cfg.opacitat : 0.85;

const VENT_INVERTIR_V = false;
const NEGRE_A_BLANC = true;
const LLINDAR_NEGRE = 50;

const MAX_CACHE_BLANQUES = 30;
const MAX_CACHE_ISOLINES = 20;
const MAX_CACHE_VENT = 30;
const MAX_CACHE_SONDEIGS = 8;

const ES_MOBIL = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// ─── Rutes ─────────────────────────────────────────────────────────
const _pathActual = window.location.pathname;
const _basePath = _pathActual.substring(0, _pathActual.lastIndexOf('/') + 1);

const CARPETES_CANDIDATES = [
    './web_data_GFS/imatges/',           // ← RELATIVA PRIMER (la que et funciona!)
    _basePath + 'web_data_GFS/imatges/',
    '/web_data_GFS/imatges/',
    '/public/web_data_GFS/imatges/',
    '/meu-mapa/public/web_data_GFS/imatges/',
];
let PNG_BASE = CARPETES_CANDIDATES[0];
let BASE_3D = CARPETES_CANDIDATES[0];

const CARPETES_NOMS = [
    _basePath + 'dades/',
    _basePath + 'web_data_GFS/imatges/',
    '/dades/',
    '/public/dades/',
];

const FONS_URL = 'dades/fonsGFS.png';
const VORES_URL = 'dades/voresGFS.png';

// ─── Cache-busting ─────────────────────────────────────────────────
function ambCb(url) {
    if (!url) return url;
    if (url.includes('?_cb=') || url.includes('&_cb=')) return url;
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + '_cb=' + Date.now();
}
function fetchFresc(url, opts) {
    return fetch(ambCb(url), Object.assign({ cache: 'no-store' }, opts || {}));
}

// ─── Capes visibles ────────────────────────────────────────────────
window.MOSTRAR_VENT = true;
window.MOSTRAR_ISOLINIES = false;
window.MOSTRAR_CIUTATS = true;
const PROPS_CAPES = ['MOSTRAR_VENT', 'MOSTRAR_ISOLINIES', 'MOSTRAR_CIUTATS'];

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

// ─── Icones ────────────────────────────────────────────────────────
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
window.totesLesHores = totesLesHores;
let infoVariables = {};
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

let _isolinesActuals = null;
let _ventActual = null;
let _ciutats = [];
let _ciutatSel = null;
let _animVista = null;
let _vistaPermesGuardar = false;
let _tmrVista = null;
let _origDades = null;
window.getDadesOriginals = () => _origDades;

window._extentManifest = null;
const vista = { k: 1, x: 0, y: 0 };

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
    st: 'Temperatura (2 m)', sd: 'Punt de rosada (2 m)',
    srh: 'Humitat relativa (2 m)',
    wind_speed_10m: 'Velocitat del vent (10 m)',
    wind_gust: 'Ratxa de vent',
    pressure_msl: 'Pressió al nivell del mar',
    sp: 'Pressió en superfície',
    tp: 'Precipitació acumulada',
    tsnowp: 'Neu acumulada',
    snow_depth: 'Gruix de neu',
    low_cloud_cover: 'Núvols baixos',
    medium_cloud_cover: 'Núvols mitjans',
    high_cloud_cover: 'Núvols alts',
    cape: 'Energia convectiva (CAPE)',
    cin: 'Inhibició convectiva (CIN)',
    helicite: 'Helicitat',
    lifted_index: 'Lifted Index',
    reflectivity: 'Reflectivitat (dBZ)',
    spbl: 'Capa límit',
    pw: 'Aigua precipitable',
};

const NOMS_VARIABLES_3D = {
    t: 'Temperatura', r: 'Humitat relativa',
    hgt: 'Geopotencial', wind_speed: 'Velocitat del vent',
};

function normClau(clau) {
    return String(clau).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
function nrm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function nomVariable(clau) {
    const m = String(clau).match(/^(.+?)_(\d+)$/);
    if (m && NOMS_VARIABLES_3D[m[1]]) {
        return `${NOMS_VARIABLES_3D[m[1]]} @ ${m[2]} hPa`;
    }
    const k = normClau(clau);
    if (NOMS_VARIABLES[k]) return NOMS_VARIABLES[k];
    const inf = infoVariables[clau];
    if (inf && inf.nom) return inf.nom;
    return k.replace(/_+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function seccioDe(clau) {
    const m = String(clau).match(/^(.+?)_(\d+)$/);
    if (m) return '3d';
    const k = normClau(clau);
    if (/snow|neige|precip|^tp$|tsnowp|reflectivity/.test(k)) return 'prec';
    if (/cloud/.test(k)) return 'nuvols';
    if (/cape|inhibition|^cin$|helicite|lifted/.test(k)) return 'conv';
    if (/wind|gust/.test(k)) return 'vent';
    if (/press|^sp$/.test(k)) return 'pres';
    if (/^t|^s[dh]|^srh/.test(k)) return 'temp';
    if (/spbl|pw/.test(k)) return 'atmo';
    return 'altres';
}
function ordreDinsSeccio(sec, clau) {
    const i = sec.claus.indexOf(clau);
    return i === -1 ? 999 : i;
}
function prioritatClau(clau) {
    const id = seccioDe(clau);
    const s = SECCIONS.find(x => x.id === id) || SECCIONS[SECCIONS.length - 1];
    return ordreDinsSeccio(s, clau);
}

const VARS_SENSE_STREAMLINES = new Set([
    'tp', 'tsnowp', 'snow_depth', 'reflectivity',
    'low_cloud_cover', 'medium_cloud_cover', 'high_cloud_cover',
    'st', 'sd', 'srh',
    'pressure_msl', 'sp', 'cape', 'cin', 'lifted_index',
]);

const VARS_SENSE_ISOLINIES = new Set([
    'reflectivity',
    'low_cloud_cover', 'medium_cloud_cover', 'high_cloud_cover',
]);

function variableActivaTeStreamlines() {
    const m = String(variableActiva).match(/^(.+?)_(\d+)$/);
    if (m) return true;
    const k = normClau(variableActiva);
    return !VARS_SENSE_STREAMLINES.has(k);
}
function variableActivaTeIsolines() {
    const k = normClau(variableActiva);
    return !VARS_SENSE_ISOLINIES.has(k);
}
window.variableActivaTeIsolines = variableActivaTeIsolines;
window.variableActivaTeStreamlines = variableActivaTeStreamlines;

const SECCIONS = [
    { id: 'temp', nom: 'Temperatura i humitat', color: '#ff7a45',
      claus: ['st', 'sd', 'srh'] },
    { id: 'vent', nom: 'Vent', color: '#36cfc9',
      claus: ['wind_speed_10m', 'wind_gust'] },
    { id: 'pres', nom: 'Pressió', color: '#9254de',
      claus: ['pressure_msl', 'sp'] },
    { id: 'prec', nom: 'Precipitació i neu', color: '#4096ff',
      claus: ['reflectivity', 'tp', 'tsnowp', 'snow_depth'] },
    { id: 'nuvols', nom: 'Núvols', color: '#bfbfbf',
      claus: ['low_cloud_cover', 'medium_cloud_cover', 'high_cloud_cover'] },
    { id: 'conv', nom: 'Convecció i tempestes', color: '#ffc53d',
      claus: ['cape', 'cin', 'helicite', 'lifted_index'] },
    { id: 'atmo', nom: 'Atmosfera', color: '#73d13d',
      claus: ['spbl', 'pw'] },
    { id: '3d', nom: 'Nivells de pressió', color: '#ff7ad9',
      claus: ['t', 'r', 'hgt', 'wind_speed'] },
    { id: 'altres', nom: 'Altres', color: '#8899bb', claus: [] },
];

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

    imgFons.src = ambCb(FONS_URL);
    imgVores.src = ambCb(VORES_URL);

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
    const puntersActius = new Set();

    viewport.addEventListener('pointerdown', e => {
        puntersActius.add(e.pointerId);
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
        if (e.pointerId !== pointerActiu) return;
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
        vista.x += g.cx - cPrev.x;
        vista.y += g.cy - cPrev.y;
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

// ═══════════════════════════════════════════════════════════════════
//  MENÚ CONTEXTUAL + SKEW-T
// ═══════════════════════════════════════════════════════════════════
let _menuCtx = null;
function obrirMenuContextual(px, py, clientX, clientY) {
    tancarMenuContextual();
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
            <span class="menu-ctx-ico"></span>
            <span>Skew-T (sondeig vertical)</span>
        </button>
    `;
    document.body.appendChild(menu);
    _menuCtx = menu;
    const r = menu.getBoundingClientRect();
    let mx = clientX + 8;
    let my = clientY + 8;
    if (mx + r.width > window.innerWidth - 8) mx = clientX - r.width - 8;
    if (my + r.height > window.innerHeight - 8) my = clientY - r.height - 8;
    menu.style.left = mx + 'px';
    menu.style.top = my + 'px';
    const boto = menu.querySelector('#menuCtxSkewt');
    boto.addEventListener('click', () => {
        const posClic = { x: clientX, y: clientY };
        tancarMenuContextual();
        obrirSkewTFlotant(lat, lon, posClic);
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

let _skewtFlotant = null;
let _skewtPerfil = null;
let _skewtPunt = null;

function obrirSkewTFlotant(lat, lon, posClic) {
    window.lastRightClickPos = { lat, lng: lon };
    if (typeof window.openSkewtModal === 'function') {
        window.openSkewtModal(lat, lon);
    } else {
        console.warn('skewt-modal.js no carregat');
    }
}

function tancarSkewTFlotant() {
    if (_skewtFlotant) {
        _skewtFlotant.remove();
        _skewtFlotant = null;
    }
}
window.tancarSkewTFlotant = tancarSkewTFlotant;

function posicionarSkewTFlotant(el, posClic) {
    const ample = Math.min(640, window.innerWidth - 24);
    const alt = Math.min(760, window.innerHeight - 24);
    el.style.width = ample + 'px';
    el.style.height = alt + 'px';
    if (window.innerWidth <= 860) return;
    let x = posClic.x + 12;
    let y = posClic.y - 40;
    if (x + ample > window.innerWidth - 12) x = posClic.x - ample - 12;
    if (y + alt > window.innerHeight - 12) y = window.innerHeight - alt - 12;
    if (y < 12) y = 12;
    if (x < 12) x = 12;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

function ferArrossegable(el, cap) {
    if (!cap) return;
    let arrossegant = false;
    let ox = 0, oy = 0;
    let x0 = 0, y0 = 0;
    cap.addEventListener('pointerdown', e => {
        if (e.target.closest && e.target.closest('button')) return;
        if (window.innerWidth <= 860) return;
        arrossegant = true;
        ox = e.clientX; oy = e.clientY;
        const r = el.getBoundingClientRect();
        x0 = r.left; y0 = r.top;
        cap.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    cap.addEventListener('pointermove', e => {
        if (!arrossegant) return;
        const dx = e.clientX - ox;
        const dy = e.clientY - oy;
        let nx = x0 + dx;
        let ny = y0 + dy;
        const r = el.getBoundingClientRect();
        if (nx < 0) nx = 0;
        if (ny < 0) ny = 0;
        if (nx + r.width > window.innerWidth) nx = window.innerWidth - r.width;
        if (ny + r.height > window.innerHeight) ny = window.innerHeight - r.height;
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
    });
    const fi = e => {
        if (!arrossegant) return;
        arrossegant = false;
        try { cap.releasePointerCapture(e.pointerId); } catch {}
    };
    cap.addEventListener('pointerup', fi);
    cap.addEventListener('pointercancel', fi);
}

async function carregarSondeig(hora, dia) {
    const clau = `${String(hora).padStart(2, '0')}_${dia}`;
    
    // Si ja està a la caché I no és null, retornem
    if (_cacheSondeigs.has(clau)) {
        const cached = _cacheSondeigs.get(clau);
        if (cached) return cached;
        // Si és null, esborrem i reintentem
        _cacheSondeigs.delete(clau);
    }
    
    const rutes = [
        BASE_3D,
        './web_data_GFS/imatges/',
        _basePath + 'web_data_GFS/imatges/',
        '/web_data_GFS/imatges/',
        '/public/web_data_GFS/imatges/',
        '/meu-mapa/public/web_data_GFS/imatges/',
    ];
    
    for (const base of rutes) {
        if (!base) continue;
        const url = `${base}sondeig_${clau}.msgpack.gz`;
        try {
            console.log('[sondeig] Provant:', url);
            const r = await fetch(url);
            if (!r.ok) {
                console.log('[sondeig] ✗ ' + r.status + ' a ' + url);
                continue;
            }
            const buf = await r.arrayBuffer();
            console.log('[sondeig] Baixat:', buf.byteLength, 'bytes');
            
            // Descomprimir
            let u8;
            if (typeof pako !== 'undefined' && pako.inflate) {
                u8 = pako.inflate(new Uint8Array(buf));
            } else {
                const ds = new DecompressionStream('gzip');
                const stream = new Blob([buf]).stream().pipeThrough(ds);
                u8 = new Uint8Array(await new Response(stream).arrayBuffer());
            }
            console.log('[sondeig] Descomprimit:', u8.byteLength, 'bytes');
            
            // Decodificar msgpack
            const dades = msgpack.decode(u8);
            console.log('[sondeig] ✅ OK de:', url);
            console.log('[sondeig] Nivells:', dades.pressions?.length);
            
            _cacheSondeigs.set(clau, dades);
            _llevarCache(_cacheSondeigs, MAX_CACHE_SONDEIGS);
            return dades;
        } catch (e) {
            console.warn('[sondeig] ✗ Error a ' + url + ':', e.message);
            continue;
        }
    }
    
    console.warn('[sondeig] ❌ Cap ruta ha funcionat per a', clau);
    // NO guardem null a la caché per poder reintentar
    return null;
}

// ─────────────────────────────────────────────────────────────
//  Altitud del terreny des de altitudegfs.js
// ─────────────────────────────────────────────────────────────
function obtenirAltitud(lat, lon) {
    const A = window.ALTITUD_GFS;
    if (!A || !A.alt || !A.nlat || !A.nlon) return 0;

    const dLat = (A.lat1 - A.lat0) / (A.nlat - 1);
    const dLon = (A.lon1 - A.lon0) / (A.nlon - 1);

    let iLat = Math.round((lat - A.lat0) / dLat);
    let iLon = Math.round((lon - A.lon0) / dLon);

    iLat = Math.max(0, Math.min(A.nlat - 1, iLat));
    iLon = Math.max(0, Math.min(A.nlon - 1, iLon));

    const idx = iLat * A.nlon + iLon;
    const alt = A.alt[idx];
    return (typeof alt === 'number' && isFinite(alt)) ? alt : 0;
}
window.obtenirAltitud = obtenirAltitud;

// ─────────────────────────────────────────────────────────────
//  Càrrega del perfil amb altitud
// ─────────────────────────────────────────────────────────────
async function carregarPerfilGFS(lat, lon, idxHora) {
    const idx = (typeof idxHora === 'number') ? idxHora : curIdx;
    const info = totesLesHores[idx];
    if (!info) {
        console.warn('[skewt] info null per idx', idx);
        return null;
    }
    const sondeig = await carregarSondeig(info.hora, info.dia);
    if (!sondeig) {
        console.warn('[skewt] sondeig null per', info.hora, info.dia);
        return null;
    }
    const E = window.SkewTGFS_Engine;
    if (!E || !E.extreurePerfilGFS) {
        console.error('[skewt] SkewTGFS_Engine no carregat o sense extreurePerfilGFS');
        return null;
    }

    // ⭐ OBTENIR L'ALTITUD DEL TERRENY
    const altitud = obtenirAltitud(lat, lon);
    console.log('[skewt] Altitud terreny:', altitud, 'm a', lat, lon);

    // ⭐ PASSAR-LA AL MOTOR
    const perfil = E.extreurePerfilGFS(sondeig, lat, lon, altitud);
    if (!perfil) {
        console.warn('[skewt] extreurePerfilGFS ha retornat null');
        return null;
    }

    console.log('[skewt] Perfil OK:', {
        altitudTerreny: perfil.altitudTerreny,
        p0: perfil.p[0],
        nivells: perfil.p.length
    });

    return perfil;
}
window.carregarPerfilGFS = carregarPerfilGFS;

// ═══════════════════════════════════════════════════════════════════
//  DESCOMPRESSIÓ / MSGPACK
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

// ═══════════════════════════════════════════════════════════════════
//  DIBUIX SKEW-T (motor propi, minimalista)
// ═══════════════════════════════════════════════════════════════════
function dibuixarSkewTGFS(canvas, perfil, idx, vent, lat, lon) {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const wTotal = wrap.clientWidth || 600;
    const hTotal = wrap.clientHeight || 500;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = wTotal * dpr;
    canvas.height = hTotal * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const T = {
        fons: '#0b0f17',
        grid: '#1f2937',
        gridForta: '#334155',
        text: '#c9d1d9',
        textDim: '#8b949e',
        isoterma: '#3a5a3a',
        adiabaticaSeca: '#8a5a2a',
        adiabaticaHumida: '#2a6a5a',
        temperatura: '#ff3030',
        rosada: '#20ff20',
        parcela: '#ffffff',
        capeArea: 'rgba(91, 247, 0, 0.15)',
        cinArea: 'rgba(50, 50, 51, 0.5)',
    };

    ctx.fillStyle = T.fons;
    ctx.fillRect(0, 0, wTotal, hTotal);

    const padL = 40, padR = 40, padT = 20, padB = 30;
    const w = wTotal - padL - padR;
    const h = hTotal - padT - padB;

    const P_TOP = 100, P_BOT = 1050;
    const T_MIN = -40, T_MAX = 40;
    const SKEW = 45;

    const logTop = Math.log(P_TOP), logBot = Math.log(P_BOT);
    function yPerP(p) {
        const frac = (logBot - Math.log(p)) / (logBot - logTop);
        return padT + (1 - frac) * h;
    }
    function pPerY(y) {
        const frac = 1 - (y - padT) / h;
        return Math.exp(logBot - frac * (logBot - logTop));
    }
    function xPerT(tC, p) {
        const y = yPerP(p);
        const skewPerPx = Math.tan(SKEW * Math.PI / 180);
        const yBase = yPerP(P_BOT);
        const dxSkew = (yBase - y) * skewPerPx;
        const fracT = (tC - T_MIN) / (T_MAX - T_MIN);
        return padL + fracT * w + dxSkew;
    }

    // Graella isobares
    ctx.strokeStyle = T.grid;
    ctx.lineWidth = 0.6;
    [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100].forEach(p => {
        const y = yPerP(p);
        const fort = [1000, 850, 700, 500, 300].includes(p);
        ctx.strokeStyle = fort ? T.gridForta : T.grid;
        ctx.lineWidth = fort ? 0.9 : 0.5;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + w, y);
        ctx.stroke();
    });

    // Isotermes
    ctx.strokeStyle = T.isoterma;
    ctx.lineWidth = 0.5;
    for (let t = -100; t <= 50; t += 10) {
        ctx.beginPath();
        let started = false;
        for (let p = P_BOT; p >= P_TOP; p *= 0.98) {
            const x = xPerT(t, p), y = yPerP(p);
            if (x < padL - 60 || x > padL + w + 60) { started = false; continue; }
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Adiabàtiques seques
    ctx.strokeStyle = T.adiabaticaSeca;
    ctx.lineWidth = 0.4;
    const RD_CP = 287.05 / 1004.6;
    for (let tPot = -40; tPot <= 200; tPot += 10) {
        ctx.beginPath();
        let started = false;
        for (let p = P_BOT; p >= P_TOP; p *= 0.97) {
            const tK = (tPot + 273.15) * Math.pow(p / 1000, RD_CP);
            const tC = tK - 273.15;
            const x = xPerT(tC, p), y = yPerP(p);
            if (x < padL - 80 || x > padL + w + 80) { started = false; continue; }
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Adiabàtiques humides
    const E = window.SkewtEngine;
    if (E && E.gradientHumit) {
        ctx.strokeStyle = T.adiabaticaHumida;
        ctx.lineWidth = 0.4;
        for (let tStart = -20; tStart <= 36; tStart += 4) {
            ctx.beginPath();
            let started = false;
            let p = 1000, t = tStart;
            for (; p >= P_TOP; p *= 0.97) {
                if (p < 1000) {
                    const gamma = E.gradientHumit(t, p);
                    t = t - gamma * (p * 0.03);
                }
                const x = xPerT(t, p), y = yPerP(p);
                if (x < padL - 80 || x > padL + w + 80) { started = false; continue; }
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }

    // Zona CAPE/CIN
    if (idx && idx.tParcela) {
        // CIN
        if (idx.lfc_p) {
            ctx.fillStyle = T.cinArea;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < perfil.p.length; i++) {
                if (perfil.p[i] > perfil.p[0] || perfil.p[i] < idx.lfc_p) continue;
                const tp = idx.tParcela[i];
                if (tp === null) continue;
                const x = xPerT(tp, perfil.p[i]), y = yPerP(perfil.p[i]);
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            }
            for (let i = perfil.p.length - 1; i >= 0; i--) {
                if (perfil.p[i] > perfil.p[0] || perfil.p[i] < idx.lfc_p) continue;
                const x = xPerT(perfil.t[i], perfil.p[i]), y = yPerP(perfil.p[i]);
                ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        }
        // CAPE
        if (idx.lfc_p && idx.el_p) {
            ctx.fillStyle = T.capeArea;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < perfil.p.length; i++) {
                if (perfil.p[i] > idx.lfc_p || perfil.p[i] < idx.el_p) continue;
                const tp = idx.tParcela[i];
                if (tp === null) continue;
                const x = xPerT(tp, perfil.p[i]), y = yPerP(perfil.p[i]);
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            }
            for (let i = perfil.p.length - 1; i >= 0; i--) {
                if (perfil.p[i] > idx.lfc_p || perfil.p[i] < idx.el_p) continue;
                const x = xPerT(perfil.t[i], perfil.p[i]), y = yPerP(perfil.p[i]);
                ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    // Temperatura ambient
    ctx.strokeStyle = T.temperatura;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    perfil.p.forEach((p, i) => {
        const x = xPerT(perfil.t[i], p), y = yPerP(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Punt de rosada
    ctx.strokeStyle = T.rosada;
    ctx.lineWidth = 2;
    ctx.beginPath();
    perfil.p.forEach((p, i) => {
        const x = xPerT(perfil.td[i], p), y = yPerP(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Parcel·la
    if (idx && idx.tParcela) {
        ctx.strokeStyle = T.parcela;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < perfil.p.length; i++) {
            const tp = idx.tParcela[i];
            if (tp === null) continue;
            const x = xPerT(tp, perfil.p[i]), y = yPerP(perfil.p[i]);
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Etiquetes eix Y (pressió)
    ctx.fillStyle = T.text;
    ctx.font = '10px Inter, Arial, sans-serif';
    ctx.textAlign = 'right';
    [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100].forEach(p => {
        const y = yPerP(p);
        ctx.fillText(String(p), padL - 4, y + 3);
    });

    // Etiquetes eix X (temperatura)
    ctx.textAlign = 'center';
    ctx.font = '9px Inter, Arial, sans-serif';
    ctx.fillStyle = T.textDim;
    for (let t = -40; t <= 40; t += 10) {
        const x = xPerT(t, P_BOT);
        if (x < padL - 6 || x > padL + w + 6) continue;
        ctx.fillText(t + '°', x, padT + h + 16);
    }

    // Marc
    ctx.strokeStyle = T.gridForta;
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, padT, w, h);
}

// ═══════════════════════════════════════════════════════════════════
//  ÍNDEXS AL PEU
// ═══════════════════════════════════════════════════════════════════
function pintarIndexsGFS(el, idx, vent) {
    if (!el) return;
    function fmt(v, d, u) {
        if (v === null || v === undefined || isNaN(v)) return '—';
        return v.toFixed(d !== undefined ? d : 0) + (u || '');
    }
    let h = '';
    h += `<span style="color:#ffc53d;">CAPE</span> ${fmt(idx.cape, 0, ' J/kg')} · `;
    h += `<span style="color:#ffc53d;">CIN</span> ${fmt(idx.cin, 0, ' J/kg')} · `;
    h += `<span style="color:#ffc53d;">LI</span> ${fmt(idx.li, 1)} · `;
    h += `<span style="color:#58a6ff;">LCL</span> ${fmt(idx.lcl_z, 0, ' m')} · `;
    h += `<span style="color:#ff9040;">LFC</span> ${fmt(idx.lfc_z, 0, ' m')} · `;
    h += `<span style="color:#c060ff;">EL</span> ${fmt(idx.el_z, 0, ' m')}`;
    if (vent) {
        h += ` · <span style="color:#3fb950;">Shear 0-6km</span> ${fmt(vent.shear06, 1, ' m/s')}`;
        h += ` · <span style="color:#3fb950;">SRH 0-3km</span> ${fmt(vent.srh03, 0, ' m²/s²')}`;
    }
    el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════════
//  PANELL LATERAL
// ═══════════════════════════════════════════════════════════════════
let _filesVariables = [];
const _seccionsObertes = new Set();

function activarPestanya(nom, enfocar) {
    const p = document.getElementById('panell-pro');
    if (!p) return;
    p.querySelectorAll('.pp-tab').forEach(x => x.classList.toggle('actiu', x.dataset.tab === nom));
    p.querySelectorAll('.pp-cos').forEach(c => c.classList.toggle('actiu', c.dataset.cos === nom));
    cfgGuardar({ pestanya: nom });
    if (nom === 'ciutats') {
        renderCiutats();
        if (enfocar) setTimeout(() => p.querySelector('#ppCercaCiu')?.focus(), 30);
    }
    if (nom === 'variables' && enfocar) setTimeout(() => p.querySelector('#ppCercaVar')?.focus(), 30);
}
window.activarPestanya = activarPestanya;

function crearPanell() {
    if (document.getElementById('panell-pro')) return;
    const p = document.createElement('div');
    p.id = 'panell-pro';
    p.innerHTML = `
        <div class="pp-cap">
            <div>
                <div class="pp-titol">TEMPESTES.CAT</div>
                <div class="pp-sub">Model GFS · Global</div>
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
                <input id="ppCercaVar" type="text" placeholder="Cercar paràmetre..." autocomplete="off">
                <button class="esb" id="ppEsbVar" title="Esborra">${ICO.tanca}</button>
            </div>
            <div class="pp-llista" id="ppLlistaVar"></div>
        </div>
        <div class="pp-cos" data-cos="ciutats">
            <div class="pp-cerca">
                <span class="ico">${ICO.pin}</span>
                <input id="ppCercaCiu" type="text" placeholder="Cercar ciutat..." autocomplete="off">
                <button class="esb" id="ppEsbCiu" title="Esborra">${ICO.tanca}</button>
            </div>
            <button class="ciu-treu" id="ppTreuCiu">${ICO.tanca}<span>Treure el marcador</span></button>
            <div class="ciu-info" id="ppCiuInfo"></div>
            <div class="pp-llista" id="ppLlistaCiu"></div>
        </div>
        <div class="pp-cos" data-cos="capes">
            <div class="capes-cos">
                <div class="cap-titol">Capes</div>
                <div class="cap-fila" data-prop="MOSTRAR_VENT"><span>Vent (streamlines)</span><span class="interruptor"></span></div>
                <div class="cap-fila" data-prop="MOSTRAR_ISOLINIES"><span>Isolínies</span><span class="interruptor"></span></div>
                <div class="cap-fila" data-prop="MOSTRAR_CIUTATS"><span>Ciutats</span><span class="interruptor"></span></div>
                <div class="cap-titol">Densitat de noms</div>
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
        document.body.classList.toggle('panell-plegat', v);
        cfgGuardar({ plegat: v });
    };
    p.querySelector('#ppPlega').addEventListener('click', () => plega(true));
    obrir.addEventListener('click', () => plega(false));
    const plegatInici = (typeof _cfg.plegat === 'boolean') ? _cfg.plegat : (window.innerWidth <= 860);
    p.classList.toggle('plegat', plegatInici);
    obrir.classList.toggle('visible', plegatInici);
    document.body.classList.toggle('panell-plegat', plegatInici);

    p.querySelectorAll('.pp-tab').forEach(b => b.addEventListener('click', () => activarPestanya(b.dataset.tab, true)));
    if (['variables', 'ciutats', 'capes'].includes(_cfg.pestanya)) activarPestanya(_cfg.pestanya, false);

    const inpVar = p.querySelector('#ppCercaVar');
    const esbVar = p.querySelector('#ppEsbVar');
    inpVar.addEventListener('input', () => {
        esbVar.style.display = inpVar.value ? 'flex' : 'none';
        filtrarVariables(inpVar.value);
    });
    esbVar.addEventListener('click', () => { inpVar.value = ''; inpVar.dispatchEvent(new Event('input')); inpVar.focus(); });

    const inpCiu = p.querySelector('#ppCercaCiu');
    const esbCiu = p.querySelector('#ppEsbCiu');
    inpCiu.addEventListener('input', () => {
        esbCiu.style.display = inpCiu.value ? 'flex' : 'none';
        renderCiutats();
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
                if (!window[prop]) { _ventActual = null; programarRedibuix(); }
                else { carregarVent(curIdx).then(v => { _ventActual = v; programarRedibuix(); }); }
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
        try { localStorage.removeItem(CLAU_CFG); } catch {}
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

function construirPanellParametres() {
    const cont = document.getElementById('ppLlistaVar');
    if (!cont) return;
    cont.innerHTML = '';
    _filesVariables = [];
    const totes = new Set();
    for (const h of totesLesHores) for (const v of h.variables) totes.add(v);
    const visibles = new Set();
    const nomsVistos = new Set();
    [...totes]
        .sort((a, b) => (prioritatClau(a) - prioritatClau(b)) || a.localeCompare(b))
        .forEach(clau => {
            const nom = nomVariable(clau);
            const nk = nrm(nom);
            if (nomsVistos.has(nk)) return;
            nomsVistos.add(nk);
            visibles.add(clau);
        });
    if (visibles.size) {
        if (_cfg.variable && visibles.has(_cfg.variable)) variableActiva = _cfg.variable;
        if (!visibles.has(variableActiva)) {
            if (visibles.has('st')) variableActiva = 'st';
            else variableActiva = [...visibles].sort()[0];
        }
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
                const bloquejat = !potVeureVariable(clau);
                const row = document.createElement('div');
                row.className = 'param-row'
                    + (clau === variableActiva ? ' param-selected' : '')
                    + (bloquejat ? ' premium-bloquejat' : '');
                row.dataset.clau = clau;
                row.title = bloquejat
                    ? 'Inicia sessió per veure aquesta variable'
                    : (unitat ? `${nom} (${unitat})` : nom);
                const cadenat = bloquejat ? ' <span style="opacity:0.7;">🔒</span>' : '';
                row.innerHTML = `<span>${nom}${cadenat}</span>${unitat ? `<span class="unitat">${unitat}</span>` : ''}`;
                row.addEventListener('click', () => {
                    if (bloquejat) {
                        if (typeof window.mostrarAvisLogin === 'function') window.mostrarAvisLogin(clau);
                        else if (typeof window.obrirModal === 'function') window.obrirModal('modalLogin');
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
    const buit = document.createElement('div');
    buit.className = 'pp-buit';
    buit.id = 'ppBuitVar';
    buit.style.display = 'none';
    buit.textContent = 'Cap paràmetre coincideix';
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

function actualitzarCapcaleraVariable() {
    const n = document.getElementById('ppActualNom');
    const u = document.getElementById('ppActualUnitat');
    if (!n) return;
    n.textContent = nomVariable(variableActiva);
    const inf = infoVariables[variableActiva];
    u.textContent = (inf && inf.unitat) ? inf.unitat : '';
}

function seleccionarVariable(clau) {
    if (!potVeureVariable(clau)) {
        if (typeof window.mostrarAvisLogin === 'function') window.mostrarAvisLogin(clau);
        else if (typeof window.obrirModal === 'function') window.obrirModal('modalLogin');
        return;
    }
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
        info.textContent = `${_ciutats.length} ciutats`;
    } else {
        const mots = q.split(/\s+/);
        res = _ciutats.filter(c => mots.every(m => c._n.includes(m)));
        res.sort((a, b) => (b._n.startsWith(q) - a._n.startsWith(q)) || ((b.poblacio || 0) - (a.poblacio || 0)));
        info.textContent = `${res.length} resultats`;
        res = res.slice(0, 60);
    }
    llista.innerHTML = '';
    if (!res.length) {
        llista.innerHTML = '<div class="pp-buit">Cap resultat</div>';
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
    const r = await fetchFresc(base + 'manifest.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const m = await r.json();
    if (!m.hores || !Array.isArray(m.hores)) throw new Error('Sense clau hores');
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
            manifest.hores.sort((a, b) => {
                const dd = ordreDia(a.dia) - ordreDia(b.dia);
                if (dd !== 0) return dd;
                return a.hora - b.hora;
            });
            totesLesHores = manifest.hores.map((h, i) => ({
                step: i, hora: h.hora, dia: h.dia, variables: h.variables || []
            }));
            window.totesLesHores = totesLesHores;
            return totesLesHores;
        } catch (e) { errors.push(e.message); }
    }
    _errorManifest = errors.join(' | ');
    return [];
}

// ═══════════════════════════════════════════════════════════════════
//  DADES
// ═══════════════════════════════════════════════════════════════════
function prefixPng(clau) {
    return /_\d+$/.test(clau) ? 'alt' : 'sfc';
}
function construirUrlPng(idx, clau) {
    if (idx < 0 || idx >= totesLesHores.length) return null;
    const info = totesLesHores[idx];
    const prefix = prefixPng(clau);
    return `${PNG_BASE}${prefix}_${String(info.hora).padStart(2, '0')}_${info.dia}_${clau}.png`;
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
    const url = construirUrlPng(curIdx, variableActiva);
    const token = ++_tokenDades;
    const clauSnap = variableActiva;
    if (!url) { imgDades.style.visibility = 'hidden'; _urlDades = null; _origDades = null; return; }
    if (url === _urlDades) return;
    const pre = new Image();
    pre.decoding = 'async';
    pre.onload = () => {
        if (token !== _tokenDades) return;
        _origDades = { img: pre, clau: clauSnap, url };
        imgDades.src = NEGRE_A_BLANC ? negreABlanc(pre, url) : url;
        imgDades.style.visibility = 'visible';
        _urlDades = url;
    };
    pre.onerror = () => {
        if (token !== _tokenDades) return;
        _origDades = null;
        imgDades.style.visibility = 'hidden';
        _urlDades = null;
    };
    pre.src = ambCb(url);
}
function actualitzarLlegenda() {
    imgLlegenda.onload = () => { imgLlegenda.style.display = 'block'; };
    imgLlegenda.onerror = () => { imgLlegenda.style.display = 'none'; };
    imgLlegenda.src = ambCb(`${PNG_BASE}legend_${variableActiva}.png`);
}

// ═══════════════════════════════════════════════════════════════════
//  CÀRREGA DE FITXERS
// ═══════════════════════════════════════════════════════════════════
function carregarScript(url, opcional) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = ambCb(url);
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
        return null;
    }
}
async function carregarVent(idx) {
    if (idx < 0 || idx >= totesLesHores.length) return null;
    const info = totesLesHores[idx];
    const hora = String(info.hora).padStart(2, '0');
    const m = String(variableActiva).match(/_(\d+)$/);
    const sufixNivell = m ? `_${m[1]}` : '';
    const clauFitxer = `${hora}_${info.dia}${sufixNivell}`;
    if (_cacheVent.has(clauFitxer)) return _cacheVent.get(clauFitxer);
    try {
        await carregarScript(`${PNG_BASE}vent_${clauFitxer}.js`);
        const dades = (window.VENT && window.VENT[clauFitxer]) || null;
        _cacheVent.set(clauFitxer, dades);
        _llevarCache(_cacheVent, MAX_CACHE_VENT);
        return dades;
    } catch (e) {
        _cacheVent.set(clauFitxer, null);
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
            await carregarScript(base + 'nomsGFS.js', true);
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

// ═══════════════════════════════════════════════════════════════════
//  VORES
// ═══════════════════════════════════════════════════════════════════
function dibuixarVores() {
    if (!canvasVores) return;
    prepararCtx(canvasVores);
    return;
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
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
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
    if (!variableActivaTeIsolines()) return;
    if (!_isolinesActuals || !Array.isArray(_isolinesActuals.nivells)) return;
    ctx.save();
    retallarAImatge(ctx);
    let salt = Math.max(1, Math.round(ISO_CFG.decimacioBase / Math.max(1, vista.k)));
    if (vista.k >= 4) salt = 1;
    const gruix = ISO_CFG.amplada * Math.min(2.0, Math.max(0.7, Math.sqrt(vista.k)));
    const esGeo = /^hgt_/.test(variableActiva);
    ctx.strokeStyle = esGeo ? 'rgba(0, 0, 0, 0.9)' : ISO_CFG.color;
    ctx.lineWidth = esGeo ? gruix * 0.9 : gruix;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
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
//  VENT (STREAMLINES)
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
    if (!variableActivaTeStreamlines()) return;
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
//  HORES I ANIMACIÓ
// ═══════════════════════════════════════════════════════════════════
function mostrarHora(idx) {
    if (idx < 0 || idx >= totesLesHores.length) return;
    if (!usuariLoguejat() && idx % 3 !== 0) {
        if (typeof window.mostrarAvisLogin === 'function') window.mostrarAvisLogin('aquesta hora');
        else if (typeof window.obrirModal === 'function') window.obrirModal('modalLogin');
        return;
    }
    curIdx = idx;
    if (!_animacioActiva) {
        const h = totesLesHores[idx];
        cfgGuardar({ hora: { hora: h.hora, dia: h.dia } });
    }
    actualitzarDades();
    resaltarHoraEnGrid(idx);
    actualitzarEtiquetaHora();
    precarregarSeguent();
    refrescarVentIsolines();
}
function precarregarSeguent() {
    if (!totesLesHores.length) return;
    const next = construirUrlPng((curIdx + 1) % totesLesHores.length, variableActiva);
    if (next) {
        const im = new Image();
        im.decoding = 'async';
        im.src = ambCb(next);
    }
}
async function refrescarVentIsolines() {
    const token = ++_tokenVI;
    const idx = curIdx, clau = variableActiva;
    _isolinesActuals = null;
    const volVent = variableActivaTeStreamlines();
    if (!volVent) _ventActual = null;
    const m = String(variableActiva).match(/^hgt_(\d+)$/);
    if (m) window.MOSTRAR_ISOLINIES = true;
    const volIso = variableActivaTeIsolines();
    if (!volIso) _isolinesActuals = null;
    programarRedibuix();
    const [vent, iso] = await Promise.all([
        volVent ? carregarVent(idx) : Promise.resolve(null),
        (window.MOSTRAR_ISOLINIES && volIso) ? carregarIsolines(idx, clau) : Promise.resolve(null),
    ]);
    if (token !== _tokenVI) return;
    _ventActual = vent;
    _isolinesActuals = iso;
    programarRedibuix();
}
function resaltarHoraEnGrid(idx) {
    document.querySelectorAll('.fh-item').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
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
    if (!totesLesHores.length) return;
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
                if (typeof window.mostrarAvisLogin === 'function') window.mostrarAvisLogin(`hora ${hora}h ${textDia}`);
                else if (typeof window.obrirModal === 'function') window.obrirModal('modalLogin');
                return;
            }
            mostrarHora(i);
        });
        container.appendChild(cell);
    });
    grid.appendChild(container);
}

let _animacioActiva = false;
let _intervalAnimacio = null;
let VELOCITAT_ANIMACIO = 1200;

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
        if (typeof window.mostrarAvisLogin === 'function') window.mostrarAvisLogin('l\'animació');
        else if (typeof window.obrirModal === 'function') window.obrirModal('modalLogin');
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
function canviarVelocitatAnimacio(ms) {
    VELOCITAT_ANIMACIO = ms;
    if (_animacioActiva) {
        clearInterval(_intervalAnimacio);
        _intervalAnimacio = setInterval(() => {
            mostrarHora((curIdx + 1) % totesLesHores.length);
        }, VELOCITAT_ANIMACIO);
    }
    cfgGuardar({ velocitatAnimacio: ms });
}
window.canviarVelocitatAnimacio = canviarVelocitatAnimacio;

(function () {
    if (typeof _cfg.velocitatAnimacio === 'number') {
        VELOCITAT_ANIMACIO = _cfg.velocitatAnimacio;
    }
})();

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
    if (!hores.length) return;
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
    await Promise.all([carregarNoms()]);
    if (_cfg.ciutat) {
        const q = nrm(_cfg.ciutat);
        _ciutatSel = _ciutats.find(c => c._n === q) || null;
    }
    renderCiutats();
    programarRedibuix();
    if (typeof actualitzarControlsDock === 'function') actualitzarControlsDock();
}

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

window.canviarHora = function (delta) {
    if (!totesLesHores.length) return;
    let nou = curIdx + delta;
    if (nou < 0) nou = 0;
    if (nou >= totesLesHores.length) nou = totesLesHores.length - 1;
    mostrarHora(nou);
};
window.mostrarHoraIdx = function (idx) { if (typeof mostrarHora === 'function') mostrarHora(idx); };
window.getCurIdx = function () { return curIdx; };
window.getTotalHores = function () { return totesLesHores.length; };
window.esAnimacioActiva = function () { return _animacioActiva; };
window.getVelocitatAnimacio = function () { return VELOCITAT_ANIMACIO; };

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicialitzar);
} else {
    inicialitzar();
}

console.log('✅ gfspngs.js carregat — Visor GFS + Skew-T');