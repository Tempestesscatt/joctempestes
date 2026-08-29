// ═══════════════════════════════════════════════════
//  previsions.js — Lògica de previsions meteorològiques
//  Amb suport per .json.gz (descompressió)
//  Compatible amb t_final_blindado.py (TOTES les variables)
// ═══════════════════════════════════════════════════

let towns = [], sfcData = null, mapGrid = null;
let selectedTown = null, charts = {}, loading = false, currentMode = 'simple';
let currentHourIndex = -1, mapVariable = 't2m';
let leafletMap = null, heatCanvasLayer = null, heatAnimFrame = null;
let comarquesLayer = null;

const CAT_BOUNDS = [[40.45, 0.05], [42.95, 3.35]];
const CAT_CENTER = [41.72, 1.7];
const MAX_PICK_DISTANCE_KM = 20;

// ═══════════════ FUNCIÓ PER DESCOMPRIMIR GZIP ═══════════════
// Descomprimeix un ArrayBuffer que conté dades gzip
function decompressGzip(buffer) {
    try {
        // Utilitzar l'API DecompressionStream si està disponible (Chrome/Edge)
        if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            writer.write(buffer);
            writer.close();
            return new Response(ds.readable).arrayBuffer();
        }
    } catch (e) {
        console.warn('DecompressionStream no disponible, usant pako.js');
    }

    // Fallback: utilitzar pako.js (llibreria lleugera)
    // Assegura't d'incloure pako.js al HTML:
    // <script src="https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"></script>
    if (typeof pako !== 'undefined') {
        try {
            const uint8Array = new Uint8Array(buffer);
            const decompressed = pako.ungzip(uint8Array);
            return decompressed.buffer;
        } catch (e) {
            console.warn('Error descomprimint amb pako:', e);
        }
    }

    // Si no funciona cap mètode, retornar el buffer original (potser no està comprimit)
    return buffer;
}

// Funció per carregar un fitxer JSON (amb o sense compressió)
async function loadJSONFile(path) {
    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) return null;

        // Comprovar si és .gz
        if (path.endsWith('.gz')) {
            // Llegir com a ArrayBuffer
            const arrayBuffer = await response.arrayBuffer();

            // Intentar descomprimir
            try {
                const decompressed = await decompressGzip(arrayBuffer);
                const text = new TextDecoder('utf-8').decode(decompressed);
                return JSON.parse(text);
            } catch (e) {
                console.warn(`Error descomprimint ${path}:`, e);
                // Si falla, intentar llegir com a text (potser no està comprimit)
                const text = new TextDecoder('utf-8').decode(arrayBuffer);
                return JSON.parse(text);
            }
        } else {
            // JSON normal
            return await response.json();
        }
    } catch (e) {
        console.warn(`Error carregant ${path}:`, e);
        return null;
    }
}

// ═══════════ MAPA DE VARIABLES (Python → JavaScript) ═══════════
const VAR_MAP = {
    // SFC Meteofetch
    'st': { js: 't2m', label: 'Temperatura 2m', unit: '°C', type: 'sfc' },
    'srh': { js: 'humidity', label: 'Humitat 2m', unit: '%', type: 'sfc' },
    'su': { js: 'u_wind', label: 'Vent U 10m', unit: 'm/s', type: 'sfc' },
    'sv': { js: 'v_wind', label: 'Vent V 10m', unit: 'm/s', type: 'sfc' },
    'wind_speed_10m': { js: 'wind', label: 'Vent 10m', unit: 'km/h', type: 'sfc' },
    'wind_gust': { js: 'gust', label: 'Ratxa 10m', unit: 'km/h', type: 'sfc' },
    'pressure_msl': { js: 'pressure_msl', label: 'Pressió MSL', unit: 'hPa', type: 'sfc' },
    'tp': { js: 'rain', label: 'Precip. acumulada', unit: 'mm', type: 'sfc' },
    'tsnowp': { js: 'snow', label: 'Neu acumulada', unit: 'mm', type: 'sfc' },
    'sd': { js: 'dewpoint', label: 'Punt rosada', unit: '°C', type: 'sfc' },
    'cape': { js: 'cape', label: 'CAPE', unit: 'J/kg', type: 'sfc' },
    'spbl': { js: 'pbl', label: 'Capa límit', unit: 'm', type: 'sfc' },
    'high_cloud_cover': { js: 'high_cloud_cover', label: 'Núvols alts', unit: '%', type: 'sfc' },
    'low_cloud_cover': { js: 'low_cloud_cover', label: 'Núvols baixos', unit: '%', type: 'sfc' },
    'medium_cloud_cover': { js: 'medium_cloud_cover', label: 'Núvols mitjans', unit: '%', type: 'sfc' },
    'temp_min2m': { js: 'tmin', label: 'Temp. mínima', unit: '°C', type: 'sfc' },
    'temp_max2m': { js: 'tmax', label: 'Temp. màxima', unit: '°C', type: 'sfc' },
    'sp': { js: 'surface_pressure', label: 'Pressió superfície', unit: 'hPa', type: 'sfc' },

    // WCS 2D
    'BRIGHTNESS_TEMPERATURE__GROUND_OR_WATER_SURFACE': { js: 'bt108', label: 'BT 10.8µm', unit: 'K', type: 'wcs' },
    'BRIGHTNESS_TEMPERATURE_62__GROUND_OR_WATER_SURFACE': { js: 'bt62', label: 'BT 6.2µm', unit: 'K', type: 'wcs' },
    'GEOMETRIC_HEIGHT__GROUND_OR_WATER_SURFACE': { js: 'geopotential', label: 'Altitud geomètrica', unit: 'm', type: 'wcs' },
    'SNOW_DEPTH__GROUND_OR_WATER_SURFACE': { js: 'snow_depth', label: 'Gruix de neu', unit: 'cm', type: 'wcs' },
    'WATER_EQUIVALENT_ACCUMULATED_SNOW__GROUND_OR_WATER_SURFACE': { js: 'swe', label: 'Equivalent aigua neu', unit: 'mm', type: 'wcs' },
    'REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE': { js: 'reflectivity_dbz', label: 'Reflectivitat dBZ', unit: 'dBZ', type: 'wcs' },
    'REFLECTIVITY_MAX__GROUND_OR_WATER_SURFACE': { js: 'reflectivity', label: 'Reflectivitat', unit: 'dBZ', type: 'wcs' },
    'VISIBILITY_MINI_60MIN__GROUND_OR_WATER_SURFACE': { js: 'visibility', label: 'Visibilitat mínima', unit: 'm', type: 'wcs' },
    'CONVECTIVE_AVAILABLE_POTENTIAL_ENERGY__GROUND_OR_WATER_SURFACE': { js: 'cape_wcs', label: 'CAPE (WCS)', unit: 'J/kg', type: 'wcs' },
    'CONVECTIVE_INHIBITION__GROUND_OR_WATER_SURFACE': { js: 'cin', label: 'CIN', unit: 'J/kg', type: 'wcs' },
    'PRECIPITABLE_WATER__GROUND_OR_WATER_SURFACE': { js: 'pw', label: 'Aigua precipitable', unit: 'mm', type: 'wcs' },
    'PRESSURE__GROUND_OR_WATER_SURFACE': { js: 'surface_pressure_wcs', label: 'Pressió superfície', unit: 'hPa', type: 'wcs' },
    'PRESSURE__MEAN_SEA_LEVEL': { js: 'mslp', label: 'Pressió MSL', unit: 'hPa', type: 'wcs' },
    'TEMPERATURE__GROUND_OR_WATER_SURFACE': { js: 'surface_temp', label: 'Temp. superfície', unit: '°C', type: 'wcs' },
    'TOTAL_CLOUD_COVER__GROUND_OR_WATER_SURFACE': { js: 'total_cloud_cover', label: 'Nebulositat total', unit: '%', type: 'wcs' },
    'PLANETARY_BOUNDARY_LAYER_HEIGHT__GROUND_OR_WATER_SURFACE': { js: 'pbl_wcs', label: 'Alçada capa límit', unit: 'm', type: 'wcs' },
    'DIAG_GRELE__GROUND_OR_WATER_SURFACE': { js: 'hail_diag', label: 'Calamarsa (diag)', unit: '', type: 'wcs' },
    'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE': { js: 'precip_rate', label: 'Intensitat precip.', unit: 'mm/h', type: 'wcs' },

    // WCS 3D (mitjanes)
    'CIWC_MITJANA': { js: 'ciwc', label: 'Gel núvols (mitjana)', unit: 'kg/kg', type: 'wcs3d' },
    'CLD_RAIN_MITJANA': { js: 'cld_rain', label: 'Pluja núvols (mitjana)', unit: 'kg/kg', type: 'wcs3d' },
    'TPW_MITJANA': { js: 'tpw', label: 'Aigua precipitable (mitjana)', unit: 'mm', type: 'wcs3d' },

    // WCS 3D PV Surfaces
    'GEOPOTENTIAL_PV1500': { js: 'z_pv1500', label: 'Geopotencial PV=1.5', unit: 'm²/s²', type: 'wcs3d' },
    'GEOPOTENTIAL_PV2000': { js: 'z_pv2000', label: 'Geopotencial PV=2.0', unit: 'm²/s²', type: 'wcs3d' },
    'THETA_PV1500': { js: 'theta_pv1500', label: 'Theta PV=1.5', unit: 'K', type: 'wcs3d' },
    'THETA_PV2000': { js: 'theta_pv2000', label: 'Theta PV=2.0', unit: 'K', type: 'wcs3d' },
    'U_PV1500': { js: 'u_pv1500', label: 'Vent U PV=1.5', unit: 'm/s', type: 'wcs3d' },
    'U_PV2000': { js: 'u_pv2000', label: 'Vent U PV=2.0', unit: 'm/s', type: 'wcs3d' },
    'V_PV1500': { js: 'v_pv1500', label: 'Vent V PV=1.5', unit: 'm/s', type: 'wcs3d' },
    'V_PV2000': { js: 'v_pv2000', label: 'Vent V PV=2.0', unit: 'm/s', type: 'wcs3d' },
    'WIND_PV1500': { js: 'wind_pv1500', label: 'Vent total PV=1.5', unit: 'm/s', type: 'wcs3d' },
    'WIND_PV2000': { js: 'wind_pv2000', label: 'Vent total PV=2.0', unit: 'm/s', type: 'wcs3d' },
    'ALTITUDE_ISOTERMA_0C': { js: 'iso0', label: 'Altitud isoterma 0°C', unit: 'm', type: 'wcs3d' },
    'ALTITUDE_ISOTERMA_M10C': { js: 'iso_m10', label: 'Altitud isoterma -10°C', unit: 'm', type: 'wcs3d' },

    // WCS 3D Isobàriques
    'THETAV_850': { js: 'thetav_850', label: 'Theta virtual 850hPa', unit: 'K', type: 'wcs3d' },

    // Variables calculades
    'srh_01': { js: 'srh_01', label: 'SRH 0-1km', unit: 'm²/s²', type: 'convective' },
    'srh_03': { js: 'srh_03', label: 'SRH 0-3km', unit: 'm²/s²', type: 'convective' },
    'shear_03': { js: 'shear_03', label: 'Shear 0-3km', unit: 'm/s', type: 'convective' },
    'shear_06': { js: 'shear_06', label: 'Shear 0-6km', unit: 'm/s', type: 'convective' },
    'lcl_m': { js: 'lcl', label: 'LCL (alçada)', unit: 'm', type: 'convective' },
    'lfc_m': { js: 'lfc', label: 'LFC (alçada)', unit: 'm', type: 'convective' },
    'lifted_index': { js: 'li', label: 'Lifted Index', unit: '°C', type: 'convective' },
    'el_m': { js: 'el', label: 'Equilibrium Level', unit: 'm', type: 'convective' },
    'scp': { js: 'scp', label: 'Risc supercèl·lula', unit: '', type: 'convective' },
    'hail_cm': { js: 'hail', label: 'Mida potencial calamarsa', unit: 'cm', type: 'convective' },
};

// ═══════════ ICONS METEOCONS ═══════════
const METEOCONS = {
    clearDay: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/clear-day.svg',
    partlyCloudyDay: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/partly-cloudy-day.svg',
    clearNight: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/clear-night.svg',
    partlyCloudyNight: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/partly-cloudy-night.svg',
    overcast: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/overcast.svg',
    overcastNight: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/overcast-night.svg',
    fog: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/fog.svg',
    fogNight: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/extreme-night-fog.svg',
    drizzle: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/drizzle.svg',
    drizzleNight: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/partly-cloudy-night-drizzle.svg',
    rain: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/rain.svg',
    rainNight: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/overcast-night-rain.svg',
    rainHeavy: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/extreme-rain.svg',
    rainNightHeavy: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/extreme-night-rain.svg',
    extremeRain: 'https://cdn.meteocons.com/3.0.0-next.10/svg/monochrome/extreme-rain.svg',
    thunderstorms: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/thunderstorms.svg',
    thunderstormsNight: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/thunderstorms-night.svg',
    thunderstormsSnow: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/thunderstorms-snow.svg',
    snow: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/snow.svg',
    snowNight: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/overcast-night-snow.svg',
    snowHeavy: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/extreme-snow.svg',
    snowNightHeavy: 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill/extreme-night-snow.svg'
};

// ═══════════ MAPA DE LEGENDES ═══════════
const mapLegends = {
    t2m: { min: '-24°C', max: '46°C' },
    rain: { min: '0 mm', max: '100+ mm' },
    humidity: { min: '0%', max: '100%' },
    wind: { min: '0 km/h', max: '300 km/h' },
    cape: { min: '0 J/kg', max: '5000+ J/kg' },
    srh_01: { min: '0 m²/s²', max: '500+ m²/s²' },
    scp: { min: '0', max: '10+' },
    hail: { min: '0 cm', max: '10+ cm' },
    geopotential: { min: '0 m', max: '9000 m' },
    reflectivity_dbz: { min: '0 dBZ', max: '80+ dBZ' },
};

// ═══════════ COLOR STOPS ═══════════
const COLOR_STOPS = {
    t2m: [
        [0.00, [45, 0, 75]], [0.05, [130, 0, 160]], [0.12, [65, 0, 115]],
        [0.20, [0, 0, 255]], [0.28, [0, 135, 255]], [0.35, [0, 235, 255]],
        [0.38, [0, 255, 150]], [0.42, [0, 200, 0]], [0.47, [120, 255, 0]],
        [0.52, [255, 255, 0]], [0.56, [255, 235, 100]], [0.61, [255, 200, 0]],
        [0.66, [255, 140, 0]], [0.71, [255, 70, 0]], [0.76, [255, 0, 0]],
        [0.82, [220, 0, 0]], [0.88, [180, 0, 0]], [0.93, [140, 0, 0]],
        [0.96, [160, 0, 160]], [0.99, [255, 0, 255]], [1.00, [255, 185, 255]]
    ],
rain: [
    [0.00, [0, 0, 0, 0]],          // 0 mm - Transparent
    [0.001, [200, 230, 255, 255]], // 0.1 mm - Blau molt clar
    [0.005, [100, 200, 255, 255]], // 0.5 mm
    [0.01, [0, 150, 255, 255]],    // 1 mm - Blau
    [0.02, [0, 100, 200, 255]],    // 2 mm
    [0.05, [0, 200, 0, 255]],      // 5 mm - Verd
    [0.10, [100, 255, 0, 255]],    // 10 mm - Verd llima
    [0.20, [255, 255, 0, 255]],    // 20 mm - Groc
    [0.30, [255, 200, 0, 255]],    // 30 mm - Taronja
    [0.50, [255, 100, 0, 255]],    // 50 mm - Taronja fosc
    [0.75, [255, 0, 0, 255]],      // 75 mm - Vermell
    [1.00, [200, 0, 200, 255]]     // 100 mm - Porpra/magenta
],
    humidity: [
        [0.00, [210, 180, 140]], [0.10, [200, 160, 100]], [0.20, [180, 140, 80]],
        [0.30, [160, 200, 80]], [0.40, [120, 220, 60]], [0.50, [80, 240, 40]],
        [0.60, [40, 220, 20]], [0.70, [0, 200, 0]], [0.80, [0, 150, 200]],
        [0.90, [0, 80, 240]], [1.00, [0, 0, 200]]
    ],
    wind: [
        [0.00, [200, 200, 255]], [0.02, [150, 200, 255]], [0.03, [100, 180, 255]],
        [0.05, [0, 150, 255]], [0.07, [0, 200, 220]], [0.08, [0, 220, 180]],
        [0.10, [0, 255, 100]], [0.12, [50, 255, 0]], [0.13, [150, 255, 0]],
        [0.15, [220, 255, 0]], [0.17, [255, 255, 0]], [0.18, [255, 230, 0]],
        [0.20, [255, 200, 0]], [0.22, [255, 170, 0]], [0.23, [255, 140, 0]],
        [0.25, [255, 110, 0]], [0.27, [255, 80, 0]], [0.28, [255, 50, 0]],
        [0.30, [255, 20, 0]], [0.32, [255, 0, 0]], [0.33, [230, 0, 0]],
        [0.37, [210, 0, 0]], [0.40, [190, 0, 30]], [0.43, [170, 0, 60]],
        [0.47, [150, 0, 100]], [0.50, [130, 0, 140]], [0.53, [180, 0, 180]],
        [0.57, [200, 0, 200]], [0.60, [220, 20, 220]], [0.63, [240, 50, 240]],
        [0.67, [250, 100, 250]], [0.73, [255, 150, 255]], [0.80, [255, 200, 255]],
        [0.87, [255, 220, 255]], [0.93, [255, 240, 255]], [1.00, [255, 255, 255]]
    ],
    cape: [
        [0.00, [200, 200, 255]], [0.10, [150, 200, 255]], [0.20, [100, 180, 255]],
        [0.30, [0, 150, 255]], [0.40, [0, 200, 220]], [0.50, [0, 220, 180]],
        [0.60, [0, 255, 100]], [0.65, [50, 255, 0]], [0.70, [150, 255, 0]],
        [0.75, [220, 255, 0]], [0.80, [255, 255, 0]], [0.85, [255, 200, 0]],
        [0.90, [255, 140, 0]], [0.95, [255, 70, 0]], [1.00, [255, 0, 0]]
    ],
    scp: [
        [0.00, [200, 200, 200]], [0.10, [150, 200, 220]], [0.20, [100, 200, 255]],
        [0.30, [50, 200, 200]], [0.40, [0, 200, 150]], [0.50, [100, 255, 100]],
        [0.60, [200, 255, 50]], [0.70, [255, 255, 0]], [0.80, [255, 200, 0]],
        [0.90, [255, 100, 0]], [1.00, [255, 0, 0]]
    ],
    hail: [
        [0.00, [200, 200, 200]], [0.10, [200, 220, 200]], [0.20, [200, 240, 150]],
        [0.30, [150, 255, 100]], [0.40, [100, 255, 50]], [0.50, [50, 255, 0]],
        [0.60, [200, 255, 0]], [0.70, [255, 255, 0]], [0.80, [255, 200, 0]],
        [0.90, [255, 100, 0]], [1.00, [255, 0, 0]]
    ],
    reflectivity_dbz: [
        [0.00, [200, 200, 255]], [0.10, [150, 200, 255]], [0.20, [100, 200, 255]],
        [0.30, [50, 200, 255]], [0.40, [0, 200, 255]], [0.50, [0, 255, 200]],
        [0.60, [100, 255, 100]], [0.70, [200, 255, 50]], [0.80, [255, 200, 0]],
        [0.90, [255, 100, 0]], [1.00, [255, 0, 0]]
    ],
    geopotential: [
        [0.00, [100, 150, 50]], [0.10, [150, 180, 80]], [0.20, [200, 200, 100]],
        [0.30, [200, 180, 80]], [0.40, [180, 150, 60]], [0.50, [150, 120, 40]],
        [0.60, [120, 90, 30]], [0.70, [90, 60, 20]], [0.80, [60, 40, 15]],
        [0.90, [30, 20, 10]], [1.00, [0, 0, 0]]
    ]
};

// ═══════════ INICIALITZACIÓ ═══════════
function initTowns() {
    if (typeof TOWNS_CAT !== 'undefined' && TOWNS_CAT.towns) {
        towns = TOWNS_CAT.towns.filter(t => t.t === 'poble' || t.t === 'vila');
    }
}

// ═══════════ SELECTORS ═══════════
function setupSelectors() {
    document.getElementById('chooseByName').onclick = () => {
        document.getElementById('methodChoice').style.display = 'none';
        document.getElementById('searchByNameBlock').style.display = 'block';
        document.getElementById('searchByMapBlock').style.display = 'none';
    };

    document.getElementById('chooseByMap').onclick = () => {
        document.getElementById('methodChoice').style.display = 'none';
        document.getElementById('searchByNameBlock').style.display = 'none';
        document.getElementById('searchByMapBlock').style.display = 'block';
        initMap();
    };

    document.getElementById('backFromName').onclick = showMethodChoice;
    document.getElementById('backFromMap').onclick = showMethodChoice;

    setupMapVariableButtons();

    document.getElementById('searchInput').addEventListener('input', function () {
        const q = this.value.toLowerCase().trim();
        const sugg = document.getElementById('sugg');
        if (q.length < 2) { sugg.classList.remove('on'); return; }
        const m = towns.filter(t => t.n.toLowerCase().includes(q)).slice(0, 10);
        sugg.innerHTML = m.length
            ? m.map(t => `<div data-n="${t.n}" data-la="${t.la}" data-lo="${t.lo}">${t.n}</div>`).join('')
            : '<div style="padding:13px;color:var(--text2)">No trobat</div>';
        sugg.classList.add('on');
    });

    document.getElementById('sugg').addEventListener('click', function (e) {
        const d = e.target.closest('div[data-n]');
        if (!d) return;
        pick(d.dataset.n, +d.dataset.la, +d.dataset.lo);
        this.classList.remove('on');
    });

    document.getElementById('btnSearch').addEventListener('click', () => {
        const q = document.getElementById('searchInput').value.trim();
        const m = towns.find(t => t.n.toLowerCase() === q.toLowerCase());
        if (m) pick(m.n, m.la, m.lo);
    });

    document.getElementById('modeToggle').addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-mode]');
        if (!btn) return;
        currentMode = btn.dataset.mode;
        this.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        document.body.classList.toggle('mode-complex', currentMode === 'complex');
        if (selectedTown) renderAll();
    });

    document.getElementById('btnDownload').addEventListener('click', downloadImage);
}

function setupMapVariableButtons() {
    const container = document.getElementById('mapVariableSelector');
    if (!container) return;

    const vars = [
  
        { key: 'rain', label: ' Pluja' },

        
    
    ];

    container.innerHTML = vars.map(v =>
        `<button data-var="${v.key}" class="${v.key === 't2m' ? 'active' : ''}">${v.label}</button>`
    ).join('');

    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', function () {
            container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            mapVariable = this.dataset.var;
            updateMapLegend();
            requestHeatRedraw();
        });
    });
}

function showMethodChoice() {
    document.getElementById('methodChoice').style.display = 'block';
    document.getElementById('searchByNameBlock').style.display = 'none';
    document.getElementById('searchByMapBlock').style.display = 'none';
}

// ═══════════ UTILITATS GEO ═══════════
function haversineKm(la1, lo1, la2, lo2) {
    const R = 6371;
    const dLa = (la2 - la1) * Math.PI / 180;
    const dLo = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestTown(la, lo) {
    if (!towns.length) return null;
    let best = null, bestD = Infinity;
    for (const t of towns) {
        const d = haversineKm(la, lo, t.la, t.lo);
        if (d < bestD) { bestD = d; best = t; }
    }
    return best ? { town: best, distKm: bestD } : null;
}

// ═══════════ CAPA DE COMARQUES ═══════════
async function carregarComarques() {
    try {
        const resposta = await fetch('dades/girona_comarques.geojson');
        if (!resposta.ok) {
            console.warn('No s\'ha pogut carregar el fitxer de comarques');
            return null;
        }
        const geojson = await resposta.json();

        return L.geoJSON(geojson, {
            style: {
                color: '#000000',
                weight: 1.5,
                opacity: 0.6,
                fillColor: '#f5f5f8',
                fillOpacity: 0.05,
                dashArray: '4, 4'
            },
            onEachFeature: function(feature, layer) {
                const nom = feature.properties.nom || feature.properties.name || feature.properties.NOM || '';
                if (nom) {
                    layer.bindTooltip(nom, {
                        permanent: false,
                        direction: 'center',
                        className: 'comarca-tooltip',
                        opacity: 0.9
                    });
                }

                layer.on({
                    mouseover: function(e) {
                        const l = e.target;
                        l.setStyle({
                            weight: 2.5,
                            opacity: 0.9,
                            fillOpacity: 0.15
                        });
                        l.bringToFront();
                    },
                    mouseout: function(e) {
                        comarquesLayer.resetStyle(e.target);
                    },
                    click: function(e) {
                        leafletMap.fitBounds(e.target.getBounds(), { padding: [50, 50] });
                    }
                });
            }
        });
    } catch (error) {
        console.warn('Error carregant comarques:', error);
        return null;
    }
}

// ═══════════ MAPA ═══════════
function initMap() {
    if (leafletMap) {
        leafletMap.invalidateSize();
        updateMapLegend();
        requestHeatRedraw();
        return;
    }

    leafletMap = L.map('mapContainer', {
        center: CAT_CENTER,
        zoom: 8,
        minZoom: 7,
        maxZoom: 13,
        maxBounds: CAT_BOUNDS,
        maxBoundsViscosity: 1.0,
        zoomControl: true,
        preferCanvas: true
    });

    L.tileLayer('https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/simplificat/MON3857NW/{z}/{x}/{y}.png', {
        attribution: 'ICGC',
        noWrap: true
    }).addTo(leafletMap);

    carregarComarques().then(layer => {
        if (layer) {
            comarquesLayer = layer;
            comarquesLayer.addTo(leafletMap);
            
        }
    });

    leafletMap.fitBounds(CAT_BOUNDS);

    leafletMap.on('click', function (e) {
        const result = findNearestTown(e.latlng.lat, e.latlng.lng);
        if (result && result.distKm <= MAX_PICK_DISTANCE_KM) {
            pick(result.town.n, result.town.la, result.town.lo);
        }
    });

    leafletMap.on('move zoom', requestHeatRedraw);
    leafletMap.on('resize', requestHeatRedraw);

    updateMapLegend();
    if (sfcData) buildMapGrid();
    setTimeout(() => leafletMap.invalidateSize(), 100);
}

function updateMapLegend() {
    const l = mapLegends[mapVariable] || { min: '0', max: '100' };
    document.getElementById('mapLegendMin').textContent = l.min;
    document.getElementById('mapLegendMax').textContent = l.max;

    const stops = COLOR_STOPS[mapVariable] || COLOR_STOPS.t2m;
    const grad = stops.map(([t, c]) => {
        const [r, g, b] = c.length >= 3 ? c.slice(0, 3) : c;
        return `rgba(${r},${g},${b},1) ${Math.round(t * 100)}%`;
    }).join(',');
    document.getElementById('mapLegendBar').style.background = `linear-gradient(to right,${grad})`;
}
// ═══════════════ NORMALITZACIÓ DE VALORS PER VARIABLE ═══════════════
function normalizeValue(v, variable) {
    if (v == null || Number.isNaN(v)) return null;

    const varMap = {
        't2m': 'st',
        'rain': 'tp',
        'humidity': 'srh',
        'wind': 'wind_speed_10m',
        'cape': 'cape',
        'scp': 'scp',
        'hail': 'hail_cm',
        'geopotential': 'GEOMETRIC_HEIGHT__GROUND_OR_WATER_SURFACE',
        'reflectivity_dbz': 'REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE',
        'srh_01': 'srh_01',
    };

    const pythonVar = varMap[variable] || variable;

    switch (pythonVar) {
        case 'st':
        case 't2m':
            return Math.max(0, Math.min(1, (v + 24) / 70));
            
        case 'tp':
        case 'rain':
            // 🔥 CANVI IMPORTANT: Normalitzar per a pluja horària (0-50mm)
            // Si és acumulat total, hauríem de fer diff, però aquí normalitzem directe
            if (v === 0) return 0;
            // Màxim 50mm per a bona visualització (ajusta segons les teves dades)
            return Math.max(0, Math.min(1, v / 50));
            
        case 'srh':
        case 'humidity':
            return Math.max(0, Math.min(1, v / 100));
            
        case 'wind_speed_10m':
        case 'wind':
            return Math.max(0, Math.min(1, v / 300));
            
        case 'cape':
            return Math.max(0, Math.min(1, v / 5000));
            
        case 'scp':
            return Math.max(0, Math.min(1, v / 15));
            
        case 'hail_cm':
            return Math.max(0, Math.min(1, v / 12));
            
        case 'srh_01':
            return Math.max(0, Math.min(1, v / 500));
            
        case 'GEOMETRIC_HEIGHT__GROUND_OR_WATER_SURFACE':
        case 'geopotential':
            return Math.max(0, Math.min(1, v / 9000));
            
        case 'REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE':
        case 'reflectivity_dbz':
            return Math.max(0, Math.min(1, v / 80));
            
        default:
            return Math.max(0, Math.min(1, v / 100));
    }
}

function colorForNorm(norm, variable) {
    const stops = COLOR_STOPS[variable] || COLOR_STOPS.t2m;
    for (let i = 0; i < stops.length - 1; i++) {
        const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
        if (norm >= t0 && norm <= t1) {
            const f = t1 === t0 ? 0 : (norm - t0) / (t1 - t0);
            return [
                Math.round(c0[0] + f * (c1[0] - c0[0])),
                Math.round(c0[1] + f * (c1[1] - c0[1])),
                Math.round(c0[2] + f * (c1[2] - c0[2]))
            ];
        }
    }
    const last = stops[stops.length - 1][1];
    return last.length >= 3 ? last.slice(0, 3) : last;
}

// ═══════════ CONSTRUCCIÓ DE LA GRAELLA AGREGADA ═══════════
function buildMapGrid() {
    if (!sfcData || mapGrid) return;

    const lats = sfcData.lats, lons = sfcData.lons;
    const nlat = lats.length, nlon = lons.length;
    const hours = (sfcData.hours_utc || []).length;
    const n = nlat * nlon;

    const grids = {
        t2m: new Float32Array(n).fill(NaN),
        rain: new Float32Array(n).fill(NaN),
        humidity: new Float32Array(n).fill(NaN),
        wind: new Float32Array(n).fill(NaN),
        cape: new Float32Array(n).fill(NaN),
        scp: new Float32Array(n).fill(NaN),
        hail: new Float32Array(n).fill(NaN),
        srh_01: new Float32Array(n).fill(NaN),
        geopotential: new Float32Array(n).fill(NaN),
        reflectivity_dbz: new Float32Array(n).fill(NaN),
    };

    const varMap = {
        'st': 't2m',
        'tp': 'rain',
        'srh': 'humidity',
        'wind_speed_10m': 'wind',
        'cape': 'cape',
        'scp': 'scp',
        'hail_cm': 'hail',
        'srh_01': 'srh_01',
        'GEOMETRIC_HEIGHT__GROUND_OR_WATER_SURFACE': 'geopotential',
        'REFLECTIVITY_MAX_DBZ__GROUND_OR_WATER_SURFACE': 'reflectivity_dbz',
    };

    for (const [pyVar, jsVar] of Object.entries(varMap)) {
        const arr = sfcData.variables[pyVar];
        if (!arr) continue;

        const grid = grids[jsVar];
        let hasData = false;

        for (let idx = 0; idx < n; idx++) {
            let sum = 0, count = 0;
            for (let h = 0; h < hours; h++) {
                if (arr[h] && arr[h][idx] != null) {
                    sum += arr[h][idx];
                    count++;
                }
            }
            if (count > 0) {
                grid[idx] = sum / count;
                hasData = true;
            }
        }

        if (!hasData) {
            grids[jsVar] = null;
        }
    }

    mapGrid = {
        nlat, nlon, lats, lons,
        t2m: grids.t2m,
        rain: grids.rain,
        humidity: grids.humidity,
        wind: grids.wind,
        cape: grids.cape,
        scp: grids.scp,
        hail: grids.hail,
        srh_01: grids.srh_01,
        geopotential: grids.geopotential,
        reflectivity_dbz: grids.reflectivity_dbz,
    };

    requestHeatRedraw();
}

// ═══════════ HEATMAP FLUID ═══════════
function requestHeatRedraw() {
    if (heatAnimFrame) cancelAnimationFrame(heatAnimFrame);
    heatAnimFrame = requestAnimationFrame(drawFluidHeatmap);
}

function bilinearSample(grid, arr, rowF, colF) {
    const { nlat, nlon } = grid;
    if (rowF < 0 || rowF > nlat - 1 || colF < 0 || colF > nlon - 1) return NaN;

    const r0 = Math.floor(rowF), c0 = Math.floor(colF);
    const r1 = Math.min(r0 + 1, nlat - 1), c1 = Math.min(c0 + 1, nlon - 1);
    const fr = rowF - r0, fc = colF - c0;

    const v00 = arr[r0 * nlon + c0];
    const v01 = arr[r0 * nlon + c1];
    const v10 = arr[r1 * nlon + c0];
    const v11 = arr[r1 * nlon + c1];

    if (Number.isNaN(v00) || Number.isNaN(v01) || Number.isNaN(v10) || Number.isNaN(v11)) {
        const cands = [v00, v01, v10, v11].filter(v => !Number.isNaN(v));
        if (!cands.length) return NaN;
        return cands.reduce((a, b) => a + b, 0) / cands.length;
    }

    const top = v00 + fc * (v01 - v00);
    const bot = v10 + fc * (v11 - v10);
    return top + fr * (bot - top);
}

function drawFluidHeatmap() {
    if (!leafletMap || !mapGrid) return;

    const size = leafletMap.getSize();
    if (size.x === 0 || size.y === 0) return;

    const SCALE = 0.35;
    const w = Math.max(2, Math.round(size.x * SCALE));
    const h = Math.max(2, Math.round(size.y * SCALE));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const grid = mapGrid;
    const arr = grid[mapVariable];
    if (!arr) return;

    const nlat = grid.nlat, nlon = grid.nlon;
    const lat0 = grid.lats[0], lat1 = grid.lats[nlat - 1];
    const lon0 = grid.lons[0], lon1 = grid.lons[nlon - 1];

    const bounds = leafletMap.getBounds();
    const nw = bounds.getNorthWest(), se = bounds.getSouthEast();

    for (let py = 0; py < h; py++) {
        const fracY = py / (h - 1 || 1);
        const lat = nw.lat + fracY * (se.lat - nw.lat);
        const rowF = (lat - lat0) / (lat1 - lat0) * (nlat - 1);

        for (let px = 0; px < w; px++) {
            const fracX = px / (w - 1 || 1);
            const lon = nw.lng + fracX * (se.lng - nw.lng);
            const colF = (lon - lon0) / (lon1 - lon0) * (nlon - 1);

            const idx = (py * w + px) * 4;

            if (colF < -0.5 || colF > nlon - 0.5 || rowF < -0.5 || rowF > nlat - 0.5) {
                data[idx + 3] = 0;
                continue;
            }

            const v = bilinearSample(grid, arr, rowF, colF);
            const norm = normalizeValue(v, mapVariable);
            if (norm == null) {
                data[idx + 3] = 0;
                continue;
            }

            const [r, g, b] = colorForNorm(norm, mapVariable);
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 230;
        }
    }

    ctx.putImageData(imgData, 0, 0);

    const prevLayer = heatCanvasLayer;
    heatCanvasLayer = L.imageOverlay(canvas.toDataURL(), bounds, {
        opacity: 0.85,
        interactive: false,
        className: 'heat-fluid-layer'
    }).addTo(leafletMap);

    if (prevLayer) leafletMap.removeLayer(prevLayer);
}

// ═══════════ PICK ═══════════
function pick(name, la, lo) {
    if (loading) return;
    selectedTown = { name, la, lo };
    document.getElementById('selInfoText').textContent = `${name} · ${la.toFixed(3)}°N, ${lo.toFixed(3)}°E`;
    document.getElementById('selInfo').classList.add('on');
    document.getElementById('btnDownload').classList.add('on');
    document.getElementById('modeToggle').style.display = 'flex';
    loadData();
}

// ═══════════ CÀRREGA DE DADES ═══════════
async function loadData() {
    if (loading) return;
    loading = true;

    if (sfcData) {
        renderAll();
        loading = false;
        return;
    }

    const container = document.getElementById('chartsContainer');
    container.innerHTML = `
        <div class="loading-card">
            <div class="spinner"></div>
            <div class="loading-title">Descarregant dades del model</div>
            <div class="progress-wrap"><div class="progress-bar" id="progressBar"></div></div>
            <div class="progress-text" id="progressText">Buscant fitxers disponibles...</div>
        </div>`;

    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    const steps = [];
    const checkPromises = [];

    // Buscar fitxers SFC
    for (let i = 0; i <= 99; i++) {
        const pad = String(i).padStart(2, '0');
        checkPromises.push(
            fetch(`web_data/sfc_${pad}.json.gz`, { method: 'HEAD', cache: 'no-store' })
                .then(resp => {
                    if (resp.ok) {
                        steps.push(i);
                        console.log(`✅ Trobat: sfc_${pad}.json.gz`);
                    } else {
                        // Comprovar si existeix sense compressió
                        return fetch(`web_data/sfc_${pad}.json`, { method: 'HEAD', cache: 'no-store' })
                            .then(resp2 => {
                                if (resp2.ok) {
                                    steps.push(i);
                                    console.log(`✅ Trobat: sfc_${pad}.json`);
                                }
                            });
                    }
                })
                .catch(() => {})
        );
    }

    await Promise.all(checkPromises);
    steps.sort((a, b) => a - b);

    console.log(`📦 Total fitxers trobats: ${steps.length} (${steps[0] || '?'} a ${steps[steps.length-1] || '?'})`);

    if (progressText) progressText.textContent = `Trobats ${steps.length} fitxers. Descarregant...`;

    if (steps.length === 0) {
        container.innerHTML = '<div class="loading-card"><div style="font-size:48px">📡</div><div class="loading-title">Sense dades</div><p style="color:var(--text2)">No s\'han trobat fitxers sfc_XX.json o sfc_XX.json.gz</p></div>';
        loading = false;
        return;
    }

    const sfcResults = [];
    let carregats = 0;
    const CONCURRENCIA = 10;

    async function carregarUn(i) {
        const pad = String(i).padStart(2, '0');
        try {
            // Intentar .gz primer
            let data = await loadJSONFile(`web_data/sfc_${pad}.json.gz`);
            if (!data) {
                // Si falla, intentar .json
                data = await loadJSONFile(`web_data/sfc_${pad}.json`);
            }
            if (data) {
                sfcResults.push(data);
            } else {
                console.warn(`⚠️ No s'ha pogut carregar sfc_${pad}`);
            }
        } catch (e) {
            console.warn(`Error amb sfc_${pad}:`, e.message);
        }
        carregats++;
        const pct = Math.round((carregats / steps.length) * 100);
        if (progressBar) progressBar.style.width = pct + '%';
        if (progressText) progressText.textContent = `${pct}% · ${carregats} de ${steps.length} hores`;
    }

    for (let i = 0; i < steps.length; i += CONCURRENCIA) {
        const lot = steps.slice(i, i + CONCURRENCIA).map(carregarUn);
        await Promise.all(lot);
    }

    console.log(`✅ Carregats: ${sfcResults.length} fitxers`);

    if (sfcResults.length === 0) {
        container.innerHTML = '<div class="loading-card"><div style="font-size:48px">📡</div><div class="loading-title">Error de càrrega</div><p style="color:var(--text2)">Els fitxers existeixen però no s\'han pogut llegir</p></div>';
        loading = false;
        return;
    }

    sfcResults.sort((a, b) => (a.step || 0) - (b.step || 0));

    let lats = null, lons = null;
    for (const d of sfcResults) {
        if (d.coordenadas?.lat?.length && d.coordenadas?.lon?.length) {
            lats = d.coordenadas.lat;
            lons = d.coordenadas.lon;
            break;
        }
    }

    if (!lats || !lons) {
        container.innerHTML = '<div class="loading-card"><div style="font-size:48px">📡</div><div class="loading-title">Error de graella</div><p style="color:var(--text2)">No s\'ha pogut determinar la graella</p></div>';
        loading = false;
        return;
    }

    sfcData = {
        hours_utc: [],
        lats: lats,
        lons: lons,
        variables: {}
    };

    const allVars = {};
    sfcResults.forEach(d => {
        if (d.variables) {
            Object.keys(d.variables).forEach(k => { allVars[k] = true; });
        }
    });

    Object.keys(allVars).forEach(vn => {
        sfcData.variables[vn] = [];
    });

    sfcResults.forEach(d => {
        sfcData.hours_utc.push(d.hora_utc || d.time || '');
        Object.keys(allVars).forEach(vn => {
            if (d.variables && d.variables[vn] && d.variables[vn].datos) {
                sfcData.variables[vn].push(d.variables[vn].datos);
            } else {
                sfcData.variables[vn].push(null);
            }
        });
    });

    console.log(`📊 Hores carregades: ${sfcData.hours_utc.length}`);
    console.log(`🌡️ Variables: ${Object.keys(allVars).join(', ')}`);

    const now = new Date();
    let nearestIdx = 0, nearestDiff = Infinity;
    for (let h = 0; h < sfcData.hours_utc.length; h++) {
        const dt = new Date(sfcData.hours_utc[h]);
        if (isNaN(dt.getTime())) continue;
        const diff = Math.abs(dt - now);
        if (diff < nearestDiff) { nearestDiff = diff; nearestIdx = h; }
    }
    currentHourIndex = nearestIdx;

    buildMapGrid();
    renderAll();
    loading = false;
}

// ═══════════ FIND INDEX ═══════════
function findIdx(data, la, lo) {
    if (!data?.lats?.length || !data?.lons?.length) return -1;

    const nlat = data.lats.length, nlon = data.lons.length;

    let iBest = 0, dLatMin = Infinity;
    for (let i = 0; i < nlat; i++) {
        const d = Math.abs(data.lats[i] - la);
        if (d < dLatMin) { dLatMin = d; iBest = i; }
    }

    let jBest = 0, dLonMin = Infinity;
    for (let j = 0; j < nlon; j++) {
        const d = Math.abs(data.lons[j] - lo);
        if (d < dLonMin) { dLonMin = d; jBest = j; }
    }

    return iBest * nlon + jBest;
}

// ═══════════ DETECTAR DIA ACTUAL I DEMÀ ═══════════
function getDayBoundaries(hours) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterStart = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);

    const todayIndices = [];
    const tomorrowIndices = [];

    for (let h = 0; h < hours.length; h++) {
        const dt = new Date(hours[h]);
        if (isNaN(dt.getTime())) continue;

        if (dt >= todayStart && dt < tomorrowStart) {
            todayIndices.push(h);
        } else if (dt >= tomorrowStart && dt < dayAfterStart) {
            tomorrowIndices.push(h);
        }
    }

    return { todayIndices, tomorrowIndices };
}

// ═══════════ RESUM PER DIA ═══════════
function generarResumDia(t2m, rain, wind, gust, snow, cloudLow, cloudMed, cloudHigh, cape, diaNom, indices) {
    if (!indices || indices.length === 0) {
        return {
            descripcio: `No hi ha dades disponibles per a <strong>${diaNom}</strong>.`,
            maxT: 0, minT: 0, rainTotal: 0, windMax: 0, snowTotal: 0, capeMax: 0
        };
    }

    const tV = indices.map(i => t2m[i]).filter(v => v != null && !isNaN(v));
    const rV = indices.map(i => rain[i]).filter(v => v != null);
    const wV = indices.map(i => wind[i]).filter(v => v != null && !isNaN(v));
    const gV = indices.map(i => gust[i]).filter(v => v != null && !isNaN(v));
    const sV = indices.map(i => snow[i]).filter(v => v != null);
    const clV = indices.map(i => cloudLow[i]).filter(v => v != null);
    const cmV = indices.map(i => cloudMed[i]).filter(v => v != null);
    const chV = indices.map(i => cloudHigh[i]).filter(v => v != null);
    const cV = indices.map(i => cape[i]).filter(v => v != null && v > 0);

    if (tV.length === 0) {
        return {
            descripcio: `No hi ha dades de temperatura per a <strong>${diaNom}</strong>.`,
            maxT: 0, minT: 0, rainTotal: 0, windMax: 0, snowTotal: 0, capeMax: 0
        };
    }

    const maxT = Math.max(...tV);
    const minT = Math.min(...tV);
    const rainTotal = rV.reduce((a, b) => a + b, 0);
    const snowTotal = sV.reduce((a, b) => a + b, 0);
    const windMax = wV.length ? Math.max(...wV) : 0;
    const avgCL = clV.length ? clV.reduce((a, b) => a + b, 0) / clV.length : 0;
    const avgCM = cmV.length ? cmV.reduce((a, b) => a + b, 0) / cmV.length : 0;
    const avgCH = chV.length ? chV.reduce((a, b) => a + b, 0) / chV.length : 0;
    const capeMax = cV.length ? Math.max(...cV) : 0;

    let d = '';

    if (rainTotal > 50) d = `<strong>Extremadament plujós:</strong> ${rainTotal.toFixed(0)} mm acumulats. `;
    else if (rainTotal > 30) d = `<strong>Molt plujós:</strong> ${rainTotal.toFixed(0)} mm. `;
    else if (rainTotal > 10) d = `<strong>Plujós:</strong> ${rainTotal.toFixed(0)} mm. `;
    else if (rainTotal > 2) d = `<strong>Alguns ruixats</strong> (${rainTotal.toFixed(1)} mm). `;
    else if (rainTotal > 0.2) d = `<strong>Precipitacions febles</strong>. `;
    else d = `<strong>Sense pluges</strong> significatives. `;

    if (snowTotal > 5) d += `<strong>Nevada abundant:</strong> ${snowTotal.toFixed(1)} cm. `;
    else if (snowTotal > 1) d += `<strong>Neu:</strong> ${snowTotal.toFixed(1)} cm. `;

    if (maxT >= 40) d += `Temperatures <strong>extremadament altes</strong> (màx. ${maxT.toFixed(1)}°C). `;
    else if (maxT >= 36) d += `Temperatures <strong>molt altes</strong> (màx. ${maxT.toFixed(1)}°C). `;
    else if (maxT >= 30) d += `Temperatures <strong>càlides</strong> (màx. ${maxT.toFixed(1)}°C). `;
    else if (maxT >= 20) d += `Temperatures <strong>agradables</strong> (${minT.toFixed(0)}–${maxT.toFixed(0)}°C). `;
    else if (maxT >= 10) d += `Temperatures <strong>fresques</strong> (${minT.toFixed(0)}–${maxT.toFixed(0)}°C). `;
    else d += `Temperatures <strong>fredes</strong> (${minT.toFixed(0)}–${maxT.toFixed(0)}°C). `;

    if (windMax >= 90) d += `Vent <strong>huracanat</strong> (${windMax.toFixed(0)} km/h). `;
    else if (windMax >= 50) d += `Vent <strong>fort</strong> (${windMax.toFixed(0)} km/h). `;
    else if (windMax >= 20) d += `Vent <strong>moderat</strong>. `;
    else d += `Vent <strong>fluix</strong>. `;

    if (avgCL > 60) d += `Predomini de <strong>núvols baixos</strong>. `;
    else if (avgCM > 50) d += `Abundants <strong>núvols mitjans</strong>. `;
    else if (avgCH > 50) d += `Cel amb <strong>núvols alts</strong>. `;
    else if (avgCL + avgCM + avgCH < 30) d += `Cel <strong>clar o poc ennuvolat</strong>. `;
    else d += `Cel <strong>parcialment ennuvolat</strong>. `;

    if (capeMax > 2500) d += `<strong>Inestabilitat molt elevada</strong> (CAPE ${capeMax.toFixed(0)} J/kg).`;
    else if (capeMax > 1000) d += `<strong>Inestabilitat moderada</strong> (CAPE ${capeMax.toFixed(0)} J/kg).`;

    return { descripcio: d, maxT, minT, rainTotal, windMax, snowTotal, capeMax };
}

// ═══════════ RENDER PRINCIPAL ═══════════
function renderAll() {
    if (!selectedTown || !sfcData) return;

    const sfcIdx = findIdx(sfcData, selectedTown.la, selectedTown.lo);
    if (sfcIdx < 0) {
        document.getElementById('chartsContainer').innerHTML = '<div class="loading-card"><p>Fora de cobertura</p></div>';
        return;
    }

    const hours = sfcData.hours_utc || [];
    const maxH = hours.length;

    const labels = [], t2m = [], rain = [], windSpeed = [], gust = [];
    const snow = [], rh = [], cape = [], cloudLow = [], cloudMed = [], cloudHigh = [];
    let accRain = 0, accSnow = 0;

    function getVar(names, h) {
        if (typeof names === 'string') names = [names];
        for (const n of names) {
            const arr = sfcData.variables[n];
            if (arr && arr[h] && arr[h][sfcIdx] != null) {
                let v = arr[h][sfcIdx];
                if (v > 100 && ['st', 'sd', 'temperature', 't2m', 'temp_min2m', 'temp_max2m'].includes(n)) {
                    v = +(v - 273.15).toFixed(1);
                }
                return v;
            }
        }
        return null;
    }

    let prevTp = null;
    let prevTsp = null;

    for (let h = 0; h < maxH; h++) {
        const dt = new Date(hours[h]);
        labels.push(String(dt.getHours()).padStart(2, '0') + 'h');

        t2m.push(getVar(['st'], h));

        const tpNow = getVar(['tp'], h);
        let r = 0;
        if (tpNow != null) {
            if (prevTp != null) {
                r = Math.max(0, tpNow - prevTp);
            }
            prevTp = tpNow;
        }
        rain.push(r);

        const u = getVar(['su'], h), v = getVar(['sv'], h);
        let wspd = getVar(['wind_speed_10m'], h);
        if (wspd == null && u != null && v != null) {
            wspd = Math.round(Math.sqrt(u * u + v * v) * 3.6 * 10) / 10;
        }
        windSpeed.push(wspd);
        gust.push(getVar(['wind_gust'], h));

        const tspNow = getVar(['tsnowp'], h);
        let s = 0;
        if (tspNow != null) {
            if (prevTsp != null) {
                s = Math.max(0, tspNow - prevTsp);
            }
            prevTsp = tspNow;
        }
        snow.push(s);

        rh.push(getVar(['srh', 'relative_humidity'], h));
        cape.push(getVar(['cape'], h) || 0);
        cloudLow.push(getVar(['low_cloud_cover'], h) || 0);
        cloudMed.push(getVar(['medium_cloud_cover'], h) || 0);
        cloudHigh.push(getVar(['high_cloud_cover'], h) || 0);
    }

    accRain = prevTp || 0;
    accSnow = prevTsp || 0;

    const { todayIndices, tomorrowIndices } = getDayBoundaries(hours);

    const todayDate = new Date();
    const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);

    const diaAvui = todayDate.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const diaDema = tomorrowDate.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    const resumAvui = generarResumDia(t2m, rain, windSpeed, gust, snow, cloudLow, cloudMed, cloudHigh, cape, diaAvui, todayIndices);
    const resumDema = generarResumDia(t2m, rain, windSpeed, gust, snow, cloudLow, cloudMed, cloudHigh, cape, diaDema, tomorrowIndices);

    document.getElementById('resumContainer').innerHTML = `
        <div class="resum-card">
            <div class="resum-titol"> Previsió per a ${selectedTown.name}</div>

            <div class="resum-dia">
                <div class="resum-dia-header"> ${diaAvui.charAt(0).toUpperCase() + diaAvui.slice(1)}</div>
                <div class="resum-text">${resumAvui.descripcio}</div>
                <div class="resum-detalls">
                    <div class="resum-detall"><div class="val">${resumAvui.maxT.toFixed(0)}°</div><div class="lbl">Màxima</div></div>
                    <div class="resum-detall"><div class="val">${resumAvui.minT.toFixed(0)}°</div><div class="lbl">Mínima</div></div>
                    <div class="resum-detall"><div class="val">${resumAvui.rainTotal.toFixed(1)}</div><div class="lbl">mm pluja</div></div>
                    <div class="resum-detall"><div class="val">${resumAvui.windMax.toFixed(0)}</div><div class="lbl">km/h vent</div></div>
                    ${resumAvui.snowTotal > 0 ? `<div class="resum-detall"><div class="val">${resumAvui.snowTotal.toFixed(1)}</div><div class="lbl">cm neu</div></div>` : ''}
                </div>
            </div>

            <div class="resum-dia" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                <div class="resum-dia-header"> ${diaDema.charAt(0).toUpperCase() + diaDema.slice(1)}</div>
                <div class="resum-text">${resumDema.descripcio}</div>
                <div class="resum-detalls">
                    <div class="resum-detall"><div class="val">${resumDema.maxT.toFixed(0)}°</div><div class="lbl">Màxima</div></div>
                    <div class="resum-detall"><div class="val">${resumDema.minT.toFixed(0)}°</div><div class="lbl">Mínima</div></div>
                    <div class="resum-detall"><div class="val">${resumDema.rainTotal.toFixed(1)}</div><div class="lbl">mm pluja</div></div>
                    <div class="resum-detall"><div class="val">${resumDema.windMax.toFixed(0)}</div><div class="lbl">km/h vent</div></div>
                    ${resumDema.snowTotal > 0 ? `<div class="resum-detall"><div class="val">${resumDema.snowTotal.toFixed(1)}</div><div class="lbl">cm neu</div></div>` : ''}
                </div>
            </div>
        </div>`;

    // Stats grid
    const tV = t2m.filter(v => v != null), wV = windSpeed.filter(v => v != null);
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.classList.add('on');
    document.getElementById('stTmax').textContent = tV.length ? Math.max(...tV).toFixed(1) : '--';
    document.getElementById('stTmin').textContent = tV.length ? Math.min(...tV).toFixed(1) : '--';
    document.getElementById('stRain').textContent = accRain.toFixed(1);
    document.getElementById('stWmax').textContent = wV.length ? Math.max(...wV).toFixed(0) : '--';
    document.getElementById('stSnow').textContent = accSnow.toFixed(1);
    const capeV = cape.filter(v => v != null);
    document.getElementById('stCAPE').textContent = capeV.length ? Math.max(...capeV).toFixed(0) : '--';

    // Alertes
    const alerts = [];
    if (tV.length && Math.max(...tV) >= 40) alerts.push({ type: 'danger', text: 'Calor extrema. Màximes >40°C. Risc molt alt.' });
    else if (tV.length && Math.max(...tV) >= 36) alerts.push({ type: 'danger', text: 'Calor molt intensa. Hidrata\'t i evita el sol.' });
    else if (tV.length && Math.max(...tV) >= 32) alerts.push({ type: 'warning', text: 'Calor notable. Evita activitats al migdia.' });
    if (tV.length && Math.min(...tV) <= -5) alerts.push({ type: 'danger', text: 'Fred extrem. Risc de congelació.' });
    else if (tV.length && Math.min(...tV) <= 0) alerts.push({ type: 'warning', text: 'Gelades. Compte amb el gel a les carreteres.' });
    if (accRain >= 50) alerts.push({ type: 'danger', text: 'Pluja torrencial. Risc d\'inundacions sobtades.' });
    else if (accRain >= 20) alerts.push({ type: 'warning', text: 'Pluja abundant. Possibles acumulacions d\'aigua.' });
    if (wV.length && Math.max(...wV) >= 90) alerts.push({ type: 'danger', text: 'Vent huracanat. Perill extrem.' });
    else if (wV.length && Math.max(...wV) >= 60) alerts.push({ type: 'warning', text: 'Vent fort. Subjecteu objectes exteriors.' });
    if (accSnow > 10) alerts.push({ type: 'warning', text: 'Nevada abundant. Possibles afectacions viàries.' });

    const capeMaxVal = capeV.length ? Math.max(...capeV) : 0;
    if (capeMaxVal > 2500) alerts.push({ type: 'danger', text: `Inestabilitat extrema (CAPE ${capeMaxVal.toFixed(0)} J/kg). Possibles tempestes severes.` });
    else if (capeMaxVal > 1500) alerts.push({ type: 'warning', text: `Inestabilitat alta (CAPE ${capeMaxVal.toFixed(0)} J/kg). Possibles tempestes.` });

    const ac = document.getElementById('alertsContainer');
    if (alerts.length) {
        ac.classList.add('on');
        document.getElementById('alertsGrid').innerHTML = alerts.map(a => {
            const icon = a.type === 'danger' ? '⚠' : a.type === 'warning' ? '⚡' : 'ℹ';
            return `<div class="alert-card alert-${a.type}"><span class="alert-icon">${icon}</span>${a.text}</div>`;
        }).join('');
    } else {
        ac.classList.remove('on');
    }

    // Icones timeline
    let iconsHtml = '';
    for (let h = 0; h < maxH; h++) {
        const totalCloud = Math.max(cloudLow[h] || 0, cloudMed[h] || 0, cloudHigh[h] || 0);
        const hour = parseInt(labels[h]);
        const isNight = (hour >= 21 || hour < 6);
        const isFog = (rh[h] != null && rh[h] > 95);
        const isStorm = (cape[h] != null && cape[h] > 1000 && rain[h] > 0.5);

        let icon;

        if (snow[h] > 1 && isStorm) {
            icon = METEOCONS.thunderstormsSnow;
        } else if (snow[h] > 5) {
            icon = isNight ? METEOCONS.snowNightHeavy : METEOCONS.snowHeavy;
        } else if (snow[h] > 1) {
            icon = isNight ? METEOCONS.snowNight : METEOCONS.snow;
        } else if (isStorm) {
            icon = isNight ? METEOCONS.thunderstormsNight : METEOCONS.thunderstorms;
        } else if (rain[h] > 50) {
            icon = METEOCONS.extremeRain;
        } else if (rain[h] > 10) {
            icon = isNight ? METEOCONS.rainNightHeavy : METEOCONS.rainHeavy;
        } else if (rain[h] > 2) {
            icon = isNight ? METEOCONS.rainNight : METEOCONS.rain;
        } else if (rain[h] > 0.5) {
            icon = isNight ? METEOCONS.drizzleNight : METEOCONS.drizzle;
        } else if (isFog) {
            icon = isNight ? METEOCONS.fogNight : METEOCONS.fog;
        } else if (totalCloud > 70) {
            icon = isNight ? METEOCONS.overcastNight : METEOCONS.overcast;
        } else if (totalCloud > 30) {
            icon = isNight ? METEOCONS.partlyCloudyNight : METEOCONS.partlyCloudyDay;
        } else if (isNight) {
            icon = METEOCONS.clearNight;
        } else {
            icon = METEOCONS.clearDay;
        }

        iconsHtml += `<div class="icon-cell">
            <img src="${icon}" width="28" height="28" onerror="this.style.display='none'">
            <div class="time">${labels[h]}</div>
            <div class="temp">${t2m[h] != null ? Math.round(t2m[h]) + '°' : ''}</div>
        </div>`;
    }
    document.getElementById('iconsTimeline').classList.add('on');
    document.getElementById('iconsScroll').innerHTML = iconsHtml;

    renderCharts(labels, t2m, rain, windSpeed, gust, snow, rh, cape, cloudLow, cloudMed, cloudHigh);
}

// ═══════════ COLOR VENT ═══════════
function ventColor(v) {
    if (v == null) return 'rgba(148,163,184,0.4)';
    if (v < 15) return 'rgba(59,130,246,0.5)';
    if (v < 30) return 'rgba(16,185,129,0.5)';
    if (v < 50) return 'rgba(245,158,11,0.55)';
    if (v < 70) return 'rgba(239,68,68,0.6)';
    if (v < 100) return 'rgba(168,85,247,0.65)';
    return 'rgba(139,92,246,0.75)';
}

// ═══════════ GRÀFICS ═══════════
function renderCharts(labels, t2m, rain, wind, gust, snow, rh, cape, cloudLow, cloudMed, cloudHigh) {
    destroyCharts();

    const TICK = { font: { size: 10 }, color: '#94a3b8', maxRotation: 0, padding: 8 };
    const GRID = { color: 'rgba(0,0,0,0.04)', drawBorder: false };
    const TIP = {
        backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#fff', bodyColor: '#e2e8f0',
        bodyFont: { size: 12 }, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
        padding: 14, cornerRadius: 12, mode: 'index', intersect: false, displayColors: false
    };

    const nowLine = {
        id: 'nowLine',
        afterDatasetsDraw(chart) {
            if (currentHourIndex < 0 || currentHourIndex >= chart.data.labels.length) return;
            const x = chart.scales.x.getPixelForValue(currentHourIndex);
            const ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = 'rgba(99,102,241,0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(x, chart.chartArea.top);
            ctx.lineTo(x, chart.chartArea.bottom);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(99,102,241,0.9)';
            ctx.font = 'bold 10px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Ara', x, chart.chartArea.top - 4);
            ctx.restore();
        }
    };

    let html = '';
    html += '<div class="chart-card"><h3>Temperatura a 2 metres</h3><div class="chart-wrap"><canvas id="cTemp"></canvas></div></div>';
    html += '<div class="chart-card"><h3>Precipitació i humitat</h3><div class="chart-wrap"><canvas id="cRain"></canvas></div></div>';
    html += '<div class="chart-card"><h3>Vent i ratxes</h3><div class="chart-wrap"><canvas id="cWind"></canvas></div></div>';
    html += '<div class="chart-card"><h3>Núvols per capes</h3><div class="chart-wrap"><canvas id="cClouds"></canvas></div></div>';

    if (currentMode === 'complex') {
        html += '<div class="chart-card"><h3>Neu acumulada</h3><div class="chart-wrap"><canvas id="cSnow"></canvas></div></div>';
        html += '<div class="chart-card"><h3>CAPE — Energia convectiva</h3><div class="chart-wrap"><canvas id="cCAPE"></canvas></div></div>';
    }

    document.getElementById('chartsContainer').innerHTML = html;

    if (document.getElementById('cTemp')) {
        charts.temp = new Chart(document.getElementById('cTemp'), {
            type: 'line', plugins: [nowLine],
            data: { labels, datasets: [{ data: t2m, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 3, pointRadius: 0, pointHoverRadius: 6, tension: 0.4, fill: true }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: ctx => ctx.parsed.y.toFixed(1) + ' °C' } } },
                scales: { x: { ticks: { ...TICK, maxTicksLimit: 12 }, grid: GRID }, y: { ticks: { ...TICK, callback: v => v.toFixed(0) + '°' }, grid: GRID } }
            }
        });
    }

    if (document.getElementById('cRain')) {
        charts.rain = new Chart(document.getElementById('cRain'), {
            plugins: [nowLine],
            data: {
                labels, datasets: [
                    { type: 'bar', data: rain, backgroundColor: 'rgba(59,130,246,0.4)', yAxisID: 'yR', borderRadius: 4, borderSkipped: false },
                    { type: 'line', data: rh, borderColor: '#06b6d4', borderWidth: 2.5, pointRadius: 0, tension: 0.4, yAxisID: 'yH' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: ctx => ctx.datasetIndex === 0 ? ctx.parsed.y.toFixed(1) + ' mm' : ctx.parsed.y + '%' } } },
                scales: {
                    x: { ticks: { ...TICK, maxTicksLimit: 12 }, grid: GRID },
                    yR: { position: 'left', title: { display: true, text: 'mm', font: { size: 11, weight: 700 } }, grid: GRID },
                    yH: { position: 'right', max: 100, title: { display: true, text: '%', font: { size: 11, weight: 700 } }, grid: { display: false } }
                }
            }
        });
    }

    if (document.getElementById('cWind')) {
        charts.wind = new Chart(document.getElementById('cWind'), {
            plugins: [nowLine],
            data: {
                labels, datasets: [
                    { type: 'bar', data: wind, backgroundColor: wind.map(v => ventColor(v)), yAxisID: 'yW', borderRadius: 4, borderSkipped: false },
                    { type: 'line', data: gust, borderColor: '#f97316', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: 0.3, yAxisID: 'yW' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: ctx => ctx.parsed.y.toFixed(0) + ' km/h' } } },
                scales: { x: { ticks: { ...TICK, maxTicksLimit: 12 }, grid: GRID }, yW: { title: { display: true, text: 'km/h', font: { size: 11, weight: 700 } }, grid: GRID } }
            }
        });
    }

    if (document.getElementById('cClouds')) {
        charts.clouds = new Chart(document.getElementById('cClouds'), {
            plugins: [nowLine],
            data: {
                labels, datasets: [
                    { type: 'line', label: 'Baixos', data: cloudLow, borderColor: '#64748b', backgroundColor: 'rgba(100,116,139,0.06)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true },
                    { type: 'line', label: 'Mitjans', data: cloudMed, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.04)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true, borderDash: [4, 3] },
                    { type: 'line', label: 'Alts', data: cloudHigh, borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.03)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true, borderDash: [2, 2] }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 20, font: { size: 10 }, color: '#64748b' } }, tooltip: TIP },
                scales: { x: { ticks: { ...TICK, maxTicksLimit: 12 }, grid: GRID }, y: { max: 100, title: { display: true, text: '%', font: { size: 11, weight: 700 } }, grid: GRID } }
            }
        });
    }

    if (currentMode === 'complex') {
        const snowAcc = [];
        let sa = 0;
        snow.forEach(v => { sa += v || 0; snowAcc.push(+sa.toFixed(1)); });

        if (document.getElementById('cSnow')) {
            charts.snow = new Chart(document.getElementById('cSnow'), {
                type: 'line', plugins: [nowLine],
                data: { labels, datasets: [{ data: snowAcc, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.06)', borderWidth: 3, pointRadius: 0, tension: 0.4, fill: true }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: ctx => ctx.parsed.y.toFixed(1) + ' cm' } } },
                    scales: { x: { ticks: { ...TICK, maxTicksLimit: 12 }, grid: GRID }, y: { title: { display: true, text: 'cm', font: { size: 11, weight: 700 } }, grid: GRID } }
                }
            });
        }

        if (document.getElementById('cCAPE')) {
            charts.cape = new Chart(document.getElementById('cCAPE'), {
                type: 'bar', plugins: [nowLine],
                data: { labels, datasets: [{ data: cape, backgroundColor: cape.map(v => v < 500 ? 'rgba(16,185,129,0.35)' : v < 1500 ? 'rgba(245,158,11,0.45)' : v < 3000 ? 'rgba(249,115,22,0.55)' : 'rgba(239,68,68,0.65)'), borderRadius: 4, borderSkipped: false }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: ctx => ctx.parsed.y.toFixed(0) + ' J/kg' } } },
                    scales: { x: { ticks: { ...TICK, maxTicksLimit: 12 }, grid: GRID }, y: { title: { display: true, text: 'J/kg', font: { size: 11, weight: 700 } }, grid: GRID } }
                }
            });
        }
    }
}

function destroyCharts() {
    Object.values(charts).forEach(c => { try { c.destroy(); } catch (e) { } });
    charts = {};
}

// ═══════════ DESCÀRREGA ═══════════
async function downloadImage() {
    if (!selectedTown) return;
    const btn = document.getElementById('btnDownload');
    btn.disabled = true;
    btn.textContent = 'Generant...';

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, 0, 1200, 800);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px Inter';
        ctx.fillText(selectedTown.name + ' · Previsió', 40, 60);

        let yOff = 110;
        for (const chart of Object.values(charts)) {
            if (chart?.canvas) {
                const img = new Image();
                img.src = chart.canvas.toDataURL();
                await new Promise(r => { img.onload = r; });
                ctx.drawImage(img, 40, yOff, 1120, 200);
                yOff += 220;
            }
        }

        const link = document.createElement('a');
        link.download = `previsio_${selectedTown.name.replace(/[^a-z0-9]/gi, '_')}.png`;
        link.href = canvas.toDataURL();
        link.click();
    } catch (e) {
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descarregar';
    }
}

// ═══════════ INICI ═══════════
document.addEventListener('DOMContentLoaded', () => {
    initTowns();
    setupSelectors();
});