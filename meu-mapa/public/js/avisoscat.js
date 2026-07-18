// ═══════════════════════════════════════════════════════════════════════════
//  SISTEMA D'AVISOS METEOROLOGICS - AVISOSCAT
//  Versio: 9.0 - Estil modern fosc
// ═══════════════════════════════════════════════════════════════════════════

const VELOCITAT_TICKER = {
    pluja:    700,
    vent:     700,
    neu:      700,
    fred:     850,
    calor:    750,
    tempesta: 650,
    shear:    700,
    nit:      750,
};

const GEOJSON_FONTS = {
    espanya: 'dadesESP/avis.geojson',
    france:  'dadesFR/avis.geojson'
};

window._avisosGeoJSON    = null;
window._avisosCentreMapa = { lat: 41.5, lon: 2.0 };

function _getFeatureId(feature, fallbackIdx) {
    return feature.id
        ?? feature.properties?.id
        ?? feature.properties?.code
        ?? feature.properties?.cartodb_id
        ?? feature.properties?.COD_MUN
        ?? feature.properties?.CODINE
        ?? String(fallbackIdx);
}

function _getFeatureNom(feature, id) {
    return feature.properties?.nom
        ?? feature.properties?.nameunit
        ?? feature.properties?.name
        ?? feature.properties?.NAMEUNIT
        ?? String(id);
}

// ─── DEFINICIONS DE TIPUS D'AVIS ───────────────────────────────────────────

const TIPUS_AVIS = {
    pluja: {
        nom: 'PLUJA (mm/h)',
        unitat: 'mm/h',
        descripcio: 'Pluja maxima horaria rain_1h',
        nivells: [
            { nivell: 1, label: 'Verd',    color: 'rgba(60,180,60,0.46)',  llindar: 4   },
            { nivell: 2, label: 'Groc',    color: 'rgb(255,217,0)',        llindar: 10  },
            { nivell: 3, label: 'Taronja', color: 'rgb(255,140,0)',        llindar: 25  },
            { nivell: 4, label: 'Vermell', color: 'rgb(220,30,30)',        llindar: 50  },
            { nivell: 5, label: 'Lila',    color: 'rgb(161,50,220)',       llindar: 100 }
        ]
    },
    vent: {
        nom: 'VENT',
        unitat: 'km/h',
        descripcio: 'Vent maxim / rafegues',
        nivells: [
            { nivell: 1, label: 'Verd',    color: 'rgba(3,154,3,0.47)',   llindar: 40  },
            { nivell: 2, label: 'Groc',    color: 'rgb(255,230,80)',       llindar: 60  },
            { nivell: 3, label: 'Taronja', color: 'rgb(255,160,40)',       llindar: 80  },
            { nivell: 4, label: 'Vermell', color: 'rgb(240,60,40)',        llindar: 100 },
            { nivell: 5, label: 'Lila',    color: 'rgb(180,60,200)',       llindar: 130 }
        ]
    },
    neu: {
        nom: 'NEU',
        unitat: 'cm',
        descripcio: 'Acumulacio de neu',
        nivells: [
            { nivell: 1, label: 'Verd',    color: 'rgba(150,210,250,0.43)', llindar: 2  },
            { nivell: 2, label: 'Groc',    color: 'rgb(200,220,255)',        llindar: 5  },
            { nivell: 3, label: 'Taronja', color: 'rgb(255,200,200)',        llindar: 10 },
            { nivell: 4, label: 'Vermell', color: 'rgb(255,150,150)',        llindar: 20 },
            { nivell: 5, label: 'Lila',    color: 'rgb(200,120,220)',        llindar: 40 }
        ]
    },
    fred: {
        nom: 'FRED',
        unitat: 'C',
        descripcio: 'Temperatura minima 2m',
        nivells: [
            { nivell: 1, label: 'Verd',    color: 'rgba(180,220,255,0.43)', llindar: -2  },
            { nivell: 2, label: 'Groc',    color: 'rgb(160,200,255)',        llindar: -5  },
            { nivell: 3, label: 'Taronja', color: 'rgb(130,170,255)',        llindar: -8  },
            { nivell: 4, label: 'Vermell', color: 'rgb(100,140,255)',        llindar: -12 },
            { nivell: 5, label: 'Lila',    color: 'rgb(80,100,255)',         llindar: -15 }
        ]
    },
    calor: {
        nom: 'CALOR',
        unitat: 'C',
        descripcio: 'Temperatura maxima 2m',
        nivells: [
            { nivell: 1, label: 'Verd',    color: 'rgba(255,220,150,0.47)', llindar: 30 },
            { nivell: 2, label: 'Groc',    color: 'rgb(255,200,100)',        llindar: 34 },
            { nivell: 3, label: 'Taronja', color: 'rgb(255,160,60)',         llindar: 37 },
            { nivell: 4, label: 'Vermell', color: 'rgb(255,100,50)',         llindar: 40 },
            { nivell: 5, label: 'Lila',    color: 'rgb(220,80,180)',         llindar: 43 }
        ]
    },
    tempesta: {
        nom: 'TEMPESTA SEVERA',
        unitat: 'idx',
        descripcio: 'Index combinat rain_1h + llamps/km2',
        nivells: [
            { nivell: 1, label: 'Verd',    color: 'rgba(60,180,60,0.46)',  llindar: 2.0 },
            { nivell: 2, label: 'Groc',    color: 'rgb(255,217,0)',        llindar: 3.5 },
            { nivell: 3, label: 'Taronja', color: 'rgb(255,140,0)',        llindar: 5.5 },
            { nivell: 4, label: 'Vermell', color: 'rgb(220,30,30)',        llindar: 7.5 },
            { nivell: 5, label: 'Lila',    color: 'rgb(161,50,220)',       llindar: 9.5 }
        ]
    },
    shear: {
        nom: 'SHEAR 0-6km',
        unitat: 'kt',
        descripcio: 'Cizalladura vertical 0-6km',
        nivells: [
            { nivell: 1, label: 'Moderat', color: 'rgba(100,200,255,0.45)', llindar: 20 },
            { nivell: 2, label: 'Fort',    color: 'rgb(0,180,255)',          llindar: 30 },
            { nivell: 3, label: 'Intens',  color: 'rgb(255,220,0)',          llindar: 40 },
            { nivell: 4, label: 'Extrem',  color: 'rgb(255,80,0)',           llindar: 50 },
            { nivell: 5, label: 'Supercel',color: 'rgb(220,0,220)',          llindar: 60 }
        ]
    },
    nit: {
        nom: 'NITS TROPICALS',
        unitat: 'C',
        descripcio: 'Tmin nocturna 00-06h (hora Madrid)',
        nivells: [
            { nivell: 2, label: 'Tropical',  color: 'rgb(255,217,0)',   llindar: 20 },
            { nivell: 3, label: 'Torrida',   color: 'rgb(255,140,0)',   llindar: 25 },
            { nivell: 4, label: 'Canicular', color: 'rgb(255, 0, 0)',   llindar: 28 }
        ]
    }
};

const DIES_SETMANA = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];

window._avisosActiu         = false;
window._avisosLayer         = null;
window._avisosResultats     = null;
window._avisosTipusActiu    = 'pluja';
window._avisosPeriode       = 'avui';
window._avisosCanvasGuardat = null;

// ═══════════════════════════════════════════════════════════════════════════
//  CSS MODERN FOSC
// ═══════════════════════════════════════════════════════════════════════════

function _injectarCssTicker() {
    if (document.getElementById('avisos-ticker-style')) return;
    const css = `
        #avisos-ticker {
            position: fixed; top: 0; left: 0; right: 0; z-index: 10001;
            background: var(--bg-secondary, #111827);
            border-bottom: 1px solid var(--border-light, #2a3d58);
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            overflow: hidden; height: 36px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.4);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        .avisos-ticker-track {
            display: flex; align-items: center; height: 100%;
            width: max-content; animation: tickerScroll 80s linear infinite;
            padding: 0 20px; gap: 6px;
        }
        #avisos-ticker:hover .avisos-ticker-track { animation-play-state: paused; }
        .avisos-ticker-item {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 4px 14px; background: var(--bg-tertiary, #182235);
            border: 1px solid var(--border, #1e2e45); border-radius: 6px;
            font-size: 11px; font-weight: 500; white-space: nowrap; cursor: pointer;
            transition: all 0.12s ease; color: var(--text-secondary, #94a9c7);
        }
        .avisos-ticker-item:hover {
            background: var(--accent, #5b9bd5); color: #ffffff;
            border-color: var(--accent, #5b9bd5);
        }
        .avisos-ticker-item[data-nivell="1"] { border-left: 3px solid #4caf50; }
        .avisos-ticker-item[data-nivell="2"] { border-left: 3px solid #ffc107; }
        .avisos-ticker-item[data-nivell="3"] { border-left: 3px solid #ff9800; }
        .avisos-ticker-item[data-nivell="4"] { border-left: 3px solid #f44336; }
        .avisos-ticker-item[data-nivell="5"] { border-left: 3px solid #9c27b0; }
        .avisos-ticker-valor {
            font-family: 'SF Mono', 'Consolas', monospace; font-size: 10px;
            padding: 2px 8px; background: var(--bg-input, #0d1522);
            border: 1px solid var(--border, #1e2e45); border-radius: 4px;
            color: var(--accent-light, #70b0e6); font-weight: 600;
        }
        .avisos-ticker-item:hover .avisos-ticker-valor {
            background: rgba(255,255,255,0.15); color: #ffffff; border-color: rgba(255,255,255,0.3);
        }
        .avisos-ticker-separador { color: var(--text-muted, #556680); font-size: 12px; margin: 0 4px; }
        @keyframes tickerScroll {
            0%   { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
        }
        #avisos-loading {
            position: fixed; inset: 0; background: rgba(4, 8, 16, 0.85);
            z-index: 10000; display: flex; justify-content: center; align-items: center;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
        }
        #avisos-loading > div {
            background: var(--bg-secondary, #111827);
            border: 1px solid var(--border-light, #2a3d58);
            border-radius: 12px; padding: 24px 32px; min-width: 320px;
            text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.55);
            animation: fadeInMod 0.5s ease-out;
        }
        @keyframes fadeInMod {
            from { opacity: 0; transform: translateY(-16px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        #avisos-loading .progress-bar {
            width: 100%; height: 5px; background: var(--border, #1e2e45);
            border-radius: 3px; margin: 12px 0; overflow: hidden;
        }
        #avisos-loading .progress-fill {
            width: 0%; height: 100%; background: var(--accent, #5b9bd5);
            transition: width 0.2s ease; border-radius: 3px;
        }
        #avisos-legenda-dreta {
            position: fixed; right: 14px; top: 50%; transform: translateY(-50%);
            background: var(--bg-secondary, #111827);
            border: 1px solid var(--border-light, #2a3d58);
            border-radius: 10px; padding: 12px; z-index: 1000; min-width: 130px;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-size: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            animation: slideRightMod 0.5s ease-out;
        }
        @keyframes slideRightMod {
            from { opacity: 0; transform: translateY(-50%) translateX(40px); }
            to   { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
        #avisos-panell {
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: var(--bg-secondary, #111827);
            border: 1px solid var(--border-light, #2a3d58);
            border-radius: 10px; padding: 10px 16px; z-index: 1500;
            display: flex; gap: 12px; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-size: 11px; box-shadow: 0 4px 24px rgba(0,0,0,0.55);
            pointer-events: auto; animation: slideUpMod 0.5s ease-out;
            flex-wrap: wrap; max-width: 96vw; backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        @keyframes slideUpMod {
            from { opacity: 0; transform: translateX(-50%) translateY(40px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        #avisos-panell select, #avisos-panell button {
            background: var(--bg-tertiary, #182235);
            border: 1px solid var(--border, #1e2e45);
            padding: 5px 10px; font-family: inherit; font-size: 11px;
            cursor: pointer; border-radius: 5px; color: var(--text-secondary, #94a9c7);
            transition: all 0.12s ease;
        }
        #avisos-panell select:hover, #avisos-panell button:hover {
            background: var(--bg-hover, #1d2a3f); color: var(--text, #e5ecf4);
        }
        #avisos-panell button {
            background: var(--danger, #e05555); color: #ffffff;
            border-color: var(--danger, #e05555); font-weight: 600;
        }
        #avisos-panell button:hover {
            background: var(--danger-light, #f07070);
            border-color: var(--danger-light, #f07070);
        }
        .custom-weather-popup .leaflet-popup-content-wrapper {
            background: var(--bg-secondary, #111827);
            border: 1px solid var(--border-light, #2a3d58);
            border-radius: 10px; padding: 0; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            color: var(--text, #e5ecf4);
        }
        .custom-weather-popup .leaflet-popup-tip {
            background: var(--bg-secondary, #111827);
            border: 1px solid var(--border-light, #2a3d58);
        }
        .custom-weather-popup .leaflet-popup-close-button {
            color: var(--text-muted, #556680) !important;
        }
        .custom-weather-popup .leaflet-popup-close-button:hover {
            color: var(--danger, #e05555) !important;
        }
        @media (max-width: 768px) {
            #avisos-ticker { height: 30px; }
            .avisos-ticker-item { padding: 2px 10px; font-size: 9px; }
            .avisos-ticker-valor { font-size: 8px; padding: 1px 6px; }
            #avisos-panell { padding: 8px 12px; gap: 6px; font-size: 9px; bottom: 10px; }
            #avisos-panell select, #avisos-panell button { padding: 3px 8px; font-size: 9px; }
        }
    `;
    const style = document.createElement('style');
    style.id = 'avisos-ticker-style';
    style.textContent = css;
    document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════════════════
//  LOADING
// ═══════════════════════════════════════════════════════════════════════════

let _loadingOverlay = null;

function _mostrarLoading(text) {
    _amagarLoading();
    _loadingOverlay = document.createElement('div');
    _loadingOverlay.id = 'avisos-loading';
    _loadingOverlay.innerHTML = `
        <div>
            <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--text, #e5ecf4);">
                SISTEMA D'AVISOS METEOROLOGICS
            </div>
            <div id="loading-stage" style="font-size:11px;margin-bottom:8px;color:var(--text-secondary, #94a9c7);">
                ${text || 'Carregant...'}
            </div>
            <div id="loading-detail" style="font-size:9px;margin-bottom:8px;color:var(--text-muted, #556680);"></div>
            <div class="progress-bar"><div class="progress-fill" id="loading-progress-fill"></div></div>
            <div id="loading-percent" style="font-size:10px;margin-top:6px;color:var(--text-secondary, #94a9c7);">0%</div>
            <div style="font-size:8px;margin-top:8px;color:var(--text-muted, #556680);">si us plau, esperi...</div>
        </div>
    `;
    document.body.appendChild(_loadingOverlay);
}

function _amagarLoading() {
    _loadingOverlay?.remove();
    _loadingOverlay = null;
}

function _actualitzarProgres(percent, stageText, detailText) {
    const pb = document.getElementById('loading-progress-fill');
    const pt = document.getElementById('loading-percent');
    const st = document.getElementById('loading-stage');
    const dt = document.getElementById('loading-detail');
    if (pb) pb.style.width = Math.min(100, Math.max(0, percent)) + '%';
    if (pt) pt.textContent = Math.round(percent) + '%';
    if (st && stageText) st.textContent = stageText;
    if (dt && detailText !== undefined) dt.textContent = detailText || '';
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUXILIARS
// ═══════════════════════════════════════════════════════════════════════════

function _formatDate(timestamp) {
    const d = new Date(timestamp);
    return `${DIES_SETMANA[d.getUTCDay()]} ${d.getUTCDate()}`;
}

function _formatHour(timestamp) {
    const d = new Date(timestamp);
    return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`;
}

function _centroide(geom) {
    let coords = [];
    if (geom.type === 'Polygon') {
        coords = geom.coordinates[0];
    } else if (geom.type === 'MultiPolygon') {
        let maxLen = 0;
        for (const p of geom.coordinates) {
            if (p[0].length > maxLen) { maxLen = p[0].length; coords = p[0]; }
        }
    }
    if (!coords.length) return null;
    let sLon = 0, sLat = 0;
    for (const [lo, la] of coords) { sLon += lo; sLat += la; }
    return { lat: sLat / coords.length, lon: sLon / coords.length };
}

function _obtenirHoresPerPeriode(periode) {
    if (!window.totesLesHores?.length) return [];
    const ara = new Date();
    const avuiUTC = new Date(Date.UTC(ara.getUTCFullYear(), ara.getUTCMonth(), ara.getUTCDate()));
    const demaUTC = new Date(Date.UTC(ara.getUTCFullYear(), ara.getUTCMonth(), ara.getUTCDate() + 1));
    const fiAvuiUTC = new Date(avuiUTC.getTime() + 24 * 3600000 - 1);
    const fiDemaUTC = new Date(demaUTC.getTime() + 24 * 3600000 - 1);
    if (periode === 'avui') return window.totesLesHores.filter(i => { const d = new Date(i.timestamp); return d >= avuiUTC && d <= fiAvuiUTC; });
    if (periode === 'dema') return window.totesLesHores.filter(i => { const d = new Date(i.timestamp); return d >= demaUTC && d <= fiDemaUTC; });
    return [...window.totesLesHores];
}

function _interpolarValor(arr, N, ext, lat, lon) {
    if (!arr) return 0;
    const [lonMin, lonMax, latMin, latMax] = ext;
    const fx = ((lon - lonMin) / (lonMax - lonMin)) * (N - 1);
    const fy = ((latMax - lat) / (latMax - latMin)) * (N - 1);
    if (fx < 0 || fx > N - 1 || fy < 0 || fy > N - 1) return 0;
    const x0 = Math.max(0, Math.min(N - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(N - 2, Math.floor(fy)));
    const tx = fx - x0, ty = fy - y0;
    const v00 = arr[y0 * N + x0]           || 0;
    const v10 = arr[y0 * N + x0 + 1]       || 0;
    const v01 = arr[(y0 + 1) * N + x0]     || 0;
    const v11 = arr[(y0 + 1) * N + x0 + 1] || 0;
    return (1 - ty) * ((1 - tx) * v00 + tx * v10) + ty * ((1 - tx) * v01 + tx * v11);
}

function _esPeriodeNocturnMadrid(timestamp) {
    const d = new Date(timestamp);
    const any = d.getUTCFullYear();
    const marcFi = new Date(Date.UTC(any, 2, 31));
    marcFi.setUTCDate(31 - marcFi.getUTCDay());
    const octFi = new Date(Date.UTC(any, 9, 31));
    octFi.setUTCDate(31 - octFi.getUTCDay());
    const esDST = (d >= marcFi && d < octFi);
    const offsetH = esDST ? 2 : 1;
    const horaMadrid = (d.getUTCHours() + offsetH) % 24;
    return horaMadrid >= 0 && horaMadrid < 6;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CARREGA GEOJSON
// ═══════════════════════════════════════════════════════════════════════════

async function _carregarGeoJSON() {
    if (window._avisosGeoJSON?._font === 'espfr') return window._avisosGeoJSON;
    try {
        const [rEsp, rFr] = await Promise.all([
            fetch(GEOJSON_FONTS.espanya + '?v=' + Date.now()),
            fetch(GEOJSON_FONTS.france  + '?v=' + Date.now())
        ]);
        const [dEsp, dFr] = await Promise.all([
            rEsp.ok ? rEsp.json() : null,
            rFr.ok  ? rFr.json()  : null
        ]);
        const featuresEsp = (dEsp?.features ?? []).map((f, i) => ({
            ...f, _avisos_id: 'esp_' + _getFeatureId(f, i), _avisos_nom: _getFeatureNom(f, i)
        }));
        const featuresFr = (dFr?.features ?? []).map((f, i) => ({
            ...f, _avisos_id: 'fr_' + _getFeatureId(f, i), _avisos_nom: _getFeatureNom(f, i)
        }));
        window._avisosGeoJSON = {
            type: 'FeatureCollection',
            features: [...featuresEsp, ...featuresFr],
            _font: 'espfr'
        };
        return window._avisosGeoJSON;
    } catch (e) {
        console.error('[AVISOS] Error carregant GeoJSON:', e);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CALCULAR MAXIMS
// ═══════════════════════════════════════════════════════════════════════════

async function calcularMaximsPerTipus(periode, onProgress) {
    const presData = window.PRES_DATA;
    if (!presData) return null;

    const hores = _obtenirHoresPerPeriode(periode);
    if (hores.length === 0) return null;

    const N    = presData.meta.n_grid;
    const extP = presData.meta.extent;

    const maxPluja       = new Float32Array(N * N);
    const maxVent        = new Float32Array(N * N);
    const maxNeu         = new Float32Array(N * N);
    const minTemp        = new Float32Array(N * N);
    const maxTemp        = new Float32Array(N * N);
    const maxLlamps      = new Float32Array(N * N);
    const maxTempestaIdx = new Float32Array(N * N);
    const maxShear       = new Float32Array(N * N);
    const minTempNit     = new Float32Array(N * N);

    const horaPluja    = new Array(N * N).fill(null);
    const horaVent     = new Array(N * N).fill(null);
    const horaNeu      = new Array(N * N).fill(null);
    const horaFred     = new Array(N * N).fill(null);
    const horaCalor    = new Array(N * N).fill(null);
    const horaTempesta = new Array(N * N).fill(null);
    const horaShear    = new Array(N * N).fill(null);
    const horaNit      = new Array(N * N).fill(null);

    for (let i = 0; i < N * N; i++) {
        minTemp[i]    = 999;
        maxTemp[i]    = -999;
        minTempNit[i] = 999;
    }

    function _sfcVal(sfcBloc, sfcHIdx, varName, presIdx) {
        const sfc = sfcBloc?.hourly?.surface;
        if (!sfc) return null;
        const arr = sfc[varName];
        if (!arr) return null;
        const Ns   = sfcBloc.meta.n_grid;
        const extS = sfcBloc.meta.extent;
        const row  = Math.floor(presIdx / N);
        const col  = presIdx % N;
        const lat  = extP[3] - (row / (N - 1)) * (extP[3] - extP[2]);
        const lon  = extP[0] + (col / (N - 1)) * (extP[1] - extP[0]);
        if (N === Ns &&
            Math.abs(extP[0]-extS[0])<0.001 && Math.abs(extP[1]-extS[1])<0.001 &&
            Math.abs(extP[2]-extS[2])<0.001 && Math.abs(extP[3]-extS[3])<0.001) {
            const v = arr[presIdx]?.[sfcHIdx];
            return v != null ? v : null;
        }
        const fx = ((lon - extS[0]) / (extS[1] - extS[0])) * (Ns - 1);
        const fy = ((extS[3] - lat) / (extS[3] - extS[2])) * (Ns - 1);
        if (fx < 0 || fx > Ns-1 || fy < 0 || fy > Ns-1) return null;
        const x0 = Math.max(0, Math.min(Ns-2, Math.floor(fx)));
        const y0 = Math.max(0, Math.min(Ns-2, Math.floor(fy)));
        const tx = fx - x0, ty = fy - y0;
        const gv = (x, y) => { const v = arr[y*Ns+x]?.[sfcHIdx]; return v != null ? v : null; };
        const v00 = gv(x0, y0); if (v00 === null) return null;
        const v10 = gv(x0+1, y0) ?? v00;
        const v01 = gv(x0, y0+1) ?? v00;
        const v11 = gv(x0+1, y0+1) ?? v00;
        return (1-ty)*((1-tx)*v00+tx*v10)+ty*((1-tx)*v01+tx*v11);
    }

    let processades = 0;

    for (let hi = 0; hi < hores.length; hi++) {
        const hora      = hores[hi];
        const timestamp = hora.timestamp;
        const sfcBloc   = hora.bloc ?? null;
        const sfcHIdx   = hora.idx  ?? 0;
        if (!sfcBloc) continue;

        const hIdxPres     = presData.meta.hours_utc?.indexOf(timestamp) ?? -1;
        const esNocturna   = _esPeriodeNocturnMadrid(timestamp);

        for (let i = 0; i < N * N; i++) {
            let rain = _sfcVal(sfcBloc, sfcHIdx, 'rain_1h', i);
            if (rain == null) rain = _sfcVal(sfcBloc, sfcHIdx, 'rain', i);
            if (rain != null && rain > maxPluja[i]) {
                maxPluja[i] = rain; horaPluja[i] = timestamp;
            }
        }

        for (let i = 0; i < N * N; i++) {
            let ll = _sfcVal(sfcBloc, sfcHIdx, 'lightning_1h', i);
            if (ll == null) ll = _sfcVal(sfcBloc, sfcHIdx, 'lightning', i);
            if (ll != null && ll > maxLlamps[i]) maxLlamps[i] = ll;
        }

        for (let i = 0; i < N * N; i++) {
            const rain  = _sfcVal(sfcBloc, sfcHIdx, 'rain_1h', i) ?? _sfcVal(sfcBloc, sfcHIdx, 'rain', i) ?? 0;
            const llamp = _sfcVal(sfcBloc, sfcHIdx, 'lightning_1h', i) ?? _sfcVal(sfcBloc, sfcHIdx, 'lightning', i) ?? 0;
            const sc = Math.log2(1 + rain / 5) * 3 + Math.log2(1 + llamp) * 2;
            if (sc > maxTempestaIdx[i]) { maxTempestaIdx[i] = sc; horaTempesta[i] = timestamp; }
        }

        for (let i = 0; i < N * N; i++) {
            let vm = 0;
            const spd  = _sfcVal(sfcBloc, sfcHIdx, 'wind_speed', i);
            const gust = _sfcVal(sfcBloc, sfcHIdx, 'wind_gusts', i);
            if (spd  != null && spd  > vm) vm = spd;
            if (gust != null && gust > vm) vm = gust;
            if (vm > maxVent[i]) { maxVent[i] = vm; horaVent[i] = timestamp; }
        }

        for (let i = 0; i < N * N; i++) {
            const neu = _sfcVal(sfcBloc, sfcHIdx, 'snowfall', i) ?? _sfcVal(sfcBloc, sfcHIdx, 'snowfall_1h', i);
            if (neu != null && neu > maxNeu[i]) { maxNeu[i] = neu; horaNeu[i] = timestamp; }
        }

        for (let i = 0; i < N * N; i++) {
            let temp = _sfcVal(sfcBloc, sfcHIdx, 'temperature', i);
            if (temp == null) continue;
            if (temp > 150) temp -= 273.15;
            if (temp > maxTemp[i]) { maxTemp[i] = temp; horaCalor[i] = timestamp; }
            if (temp < minTemp[i]) { minTemp[i] = temp; horaFred[i]  = timestamp; }
            if (esNocturna && temp < minTempNit[i]) {
                minTempNit[i] = temp;
                horaNit[i]    = timestamp;
            }
        }

        if (hIdxPres >= 0 && typeof window.calcularShear6 === 'function') {
            const shearArr = window.calcularShear6(presData, hIdxPres, N);
            if (shearArr) {
                for (let i = 0; i < N * N; i++) {
                    const v = shearArr[i];
                    if (!isNaN(v) && v > maxShear[i]) { maxShear[i] = v; horaShear[i] = timestamp; }
                }
            }
        }

        processades++;
        if (onProgress) {
            const pct = 20 + (processades / hores.length) * 60;
            onProgress(pct, `Processant hora ${processades}/${hores.length}`, '');
        }
    }

    return {
        pluja: maxPluja, vent: maxVent, neu: maxNeu,
        fred: minTemp, calor: maxTemp,
        tempesta: maxTempestaIdx, llamps: maxLlamps,
        shear: maxShear,
        nit: minTempNit,
        horaPluja, horaVent, horaNeu, horaFred, horaCalor,
        horaTempesta, horaShear, horaNit
    };
}

// ═══════════════════════════════════════════════════════════════════════════
//  CALCULAR AVISOS PER MUNICIPI
// ═══════════════════════════════════════════════════════════════════════════

async function calcularAvisosMunicipis(periode, tipusKey, onProgress) {
    const geojson = await _carregarGeoJSON();
    if (!geojson?.features) return {};

    const maxims = await calcularMaximsPerTipus(periode, onProgress);
    if (!maxims) return {};

    const presData = window.PRES_DATA;
    if (!presData) return {};

    const N   = presData.meta.n_grid;
    const ext = presData.meta.extent;
    const tipus = TIPUS_AVIS[tipusKey];
    const resultats = {};
    const totalFeatures = geojson.features.length;

    const horesPeriode = _obtenirHoresPerPeriode(periode);
    const labelPeriode = horesPeriode.length > 0 ? _formatDate(horesPeriode[0].timestamp) : '';

    const LIMIT = { latMin: 35.0, latMax: 51.5, lonMin: -10.0, lonMax: 9.0 };

    const _gridIdx = (lat, lon) => {
        const row = Math.round(((ext[3] - lat) / (ext[3] - ext[2])) * (N - 1));
        const col = Math.round(((lon - ext[0]) / (ext[1] - ext[0])) * (N - 1));
        return Math.max(0, Math.min(N*N-1, row * N + col));
    };

    for (let fi = 0; fi < totalFeatures; fi++) {
        const feature = geojson.features[fi];
        try {
            const id  = feature._avisos_id  ?? _getFeatureId(feature, fi);
            const nom = feature._avisos_nom  ?? _getFeatureNom(feature, id);
            const centre = _centroide(feature.geometry);
            if (!centre) continue;
            if (centre.lat < LIMIT.latMin || centre.lat > LIMIT.latMax ||
                centre.lon < LIMIT.lonMin || centre.lon > LIMIT.lonMax) continue;

            const gridIdx = _gridIdx(centre.lat, centre.lon);
            let valor = 0, horaMaxim = null, extraInfo = {};

            if (tipusKey === 'pluja') {
                valor    = _interpolarValor(maxims.pluja, N, ext, centre.lat, centre.lon);
                horaMaxim = maxims.horaPluja[gridIdx];
            } else if (tipusKey === 'vent') {
                valor    = _interpolarValor(maxims.vent, N, ext, centre.lat, centre.lon);
                horaMaxim = maxims.horaVent[gridIdx];
            } else if (tipusKey === 'neu') {
                valor    = _interpolarValor(maxims.neu, N, ext, centre.lat, centre.lon);
                horaMaxim = maxims.horaNeu[gridIdx];
            } else if (tipusKey === 'fred') {
                valor    = _interpolarValor(maxims.fred, N, ext, centre.lat, centre.lon);
                horaMaxim = maxims.horaFred[gridIdx];
            } else if (tipusKey === 'calor') {
                valor    = _interpolarValor(maxims.calor, N, ext, centre.lat, centre.lon);
                horaMaxim = maxims.horaCalor[gridIdx];
            } else if (tipusKey === 'tempesta') {
                valor    = _interpolarValor(maxims.tempesta, N, ext, centre.lat, centre.lon);
                horaMaxim = maxims.horaTempesta[gridIdx];
                extraInfo = {
                    rain1h:   Math.round(_interpolarValor(maxims.pluja,  N, ext, centre.lat, centre.lon) * 10) / 10,
                    llamps1h: Math.round(_interpolarValor(maxims.llamps, N, ext, centre.lat, centre.lon) * 10) / 10
                };
            } else if (tipusKey === 'shear') {
                valor    = _interpolarValor(maxims.shear, N, ext, centre.lat, centre.lon);
                horaMaxim = maxims.horaShear[gridIdx];
            } else if (tipusKey === 'nit') {
                const rawNit = _interpolarValor(maxims.nit, N, ext, centre.lat, centre.lon);
                valor    = rawNit >= 999 ? -99 : rawNit;
                horaMaxim = maxims.horaNit[gridIdx];
            }

            let nivell = 0;
            for (let i = tipus.nivells.length - 1; i >= 0; i--) {
                if (tipusKey === 'fred') {
                    if (valor <= tipus.nivells[i].llindar) { nivell = tipus.nivells[i].nivell; break; }
                } else if (tipusKey === 'nit') {
                    if (valor >= -50 && valor >= tipus.nivells[i].llindar) { nivell = tipus.nivells[i].nivell; break; }
                } else {
                    if (valor >= tipus.nivells[i].llindar) { nivell = tipus.nivells[i].nivell; break; }
                }
            }

            if (nivell > 0) {
                resultats[id] = {
                    nivell,
                    valor:     Math.round(valor * 10) / 10,
                    nom,
                    llindar:   tipus.nivells[nivell - 1].llindar,
                    label:     tipus.nivells[nivell - 1].label,
                    horaMaxim: horaMaxim ? _formatHour(horaMaxim) : '---',
                    dataAvis:  labelPeriode,
                    unitat:    tipus.unitat,
                    tipusNom:  tipus.nom,
                    ...extraInfo
                };
            }

            if (onProgress && fi % 100 === 0) {
                const pct = 85 + (fi / totalFeatures) * 10;
                onProgress(pct, `Analitzant ${fi}/${totalFeatures}`, '');
            }
        } catch (e) {
            console.warn('[AVISOS] Error feature:', e);
        }
    }

    return resultats;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CAPA LEAFLET
// ═══════════════════════════════════════════════════════════════════════════

async function _crearCapaMunicipis() {
    const mapa  = window._mapInstance;
    const geo   = await _carregarGeoJSON();
    const res   = window._avisosResultats;
    const tipus = TIPUS_AVIS[window._avisosTipusActiu];
    if (!mapa || !geo || !res || !tipus) return;
    if (window._avisosLayer) mapa.removeLayer(window._avisosLayer);

    const capa = L.geoJSON(geo, {
        style: (feat) => {
            const id = feat._avisos_id ?? _getFeatureId(feat, 0);
            const r  = res?.[id];
            if (!r) return {
                fillColor: 'rgba(0,0,0,0)', fillOpacity: 0,
                color: 'rgba(100,100,120,0.15)', weight: 0.6, opacity: 0.3
            };
            const ni = tipus.nivells.find(n => n.nivell === r.nivell);
            if (!ni) return {};
            return { fillColor: ni.color, fillOpacity: 0.7, color: 'rgba(255,255,255,0.4)', weight: 1, opacity: 0.8 };
        },
        pane: 'overlayPane',
        onEachFeature: (feat, capFeat) => {
            capFeat.on('click', (evt) => {
                L.DomEvent.stopPropagation(evt);
                const id = feat._avisos_id ?? _getFeatureId(feat, 0);
                const r  = res[id];
                if (!r) return;
                const ni = tipus.nivells[r.nivell - 1];
                const tipusKey = window._avisosTipusActiu;

                let valorInfo = `${r.valor} ${r.unitat}`;
                let extHtml   = '';

                if (tipusKey === 'pluja') {
                    valorInfo = `${r.valor} mm/h (max. horari rain_1h)`;
                } else if (tipusKey === 'vent') {
                    valorInfo = `${r.valor} km/h (10m SFC)`;
                } else if (tipusKey === 'fred') {
                    valorInfo = `${r.valor} C (min. 2m SFC)`;
                } else if (tipusKey === 'calor') {
                    valorInfo = `${r.valor} C (max. 2m SFC)`;
                } else if (tipusKey === 'tempesta') {
                    valorInfo = `Index: ${r.valor}`;
                    extHtml = `
                        <div style="margin-top:8px;background:var(--bg-tertiary, #182235);
                            border:1px solid var(--border, #1e2e45); border-radius:6px;
                            padding:8px 10px;font-size:10px;">
                            <div style="color:var(--text-secondary, #94a9c7);">Pluja max: <strong style="color:var(--text, #e5ecf4);">${r.rain1h ?? '--'} mm/h</strong></div>
                            <div style="color:var(--text-secondary, #94a9c7);">Llamps max: <strong style="color:var(--text, #e5ecf4);">${r.llamps1h ?? '--'} /km2</strong></div>
                        </div>`;
                } else if (tipusKey === 'shear') {
                    valorInfo = `${r.valor} kt (shear 0-6km)`;
                } else if (tipusKey === 'nit') {
                    valorInfo = `${r.valor} C (Tmin nocturna 00-06h Madrid)`;
                }

                L.popup({
                    className: 'custom-weather-popup',
                    closeButton: true, autoPan: false, offset: [0, -8]
                })
                .setLatLng(evt.latlng)
                .setContent(`
                    <div style="font-family:'Segoe UI',system-ui,sans-serif;min-width:280px;padding:0;">
                        <div style="font-weight:700;font-size:14px;color:var(--accent-light, #70b0e6);
                            border-bottom:1px solid var(--border, #1e2e45);margin-bottom:12px;padding-bottom:8px;">
                            ${r.nom}
                        </div>
                        <div style="margin:8px 0;padding:12px;background:var(--bg-tertiary, #182235);
                            border-left:4px solid ${ni?.color || '#ccc'}; border-radius:6px;">
                            <div style="font-size:13px;font-weight:700;color:var(--text, #e5ecf4);margin-bottom:8px;">
                                ${r.label}
                            </div>
                            <div style="font-size:12px;margin-bottom:4px;color:var(--text-secondary, #94a9c7);">
                                <span>${r.tipusNom}:</span>
                                <span style="font-weight:700;margin-left:6px;color:var(--text, #e5ecf4);">${valorInfo}</span>
                            </div>
                            <div style="font-size:10px;color:var(--text-muted, #556680);">
                                Llindar: ${r.llindar} ${r.unitat}
                            </div>
                            ${extHtml}
                        </div>
                        <div style="font-size:10px;color:var(--text-muted, #556680);margin-top:10px;
                            padding-top:8px;border-top:1px solid var(--border, #1e2e45);
                            display:flex;justify-content:space-between;">
                            <span>${r.dataAvis}</span>
                            <span>Hora pic: ${r.horaMaxim}Z</span>
                        </div>
                    </div>
                `)
                .openOn(mapa);
            });
        }
    });

    window._avisosLayer = capa;
    capa.addTo(mapa);
}

// ═══════════════════════════════════════════════════════════════════════════
//  LEGENDA
// ═══════════════════════════════════════════════════════════════════════════

function _crearLegendaDreta() {
    document.getElementById('avisos-legenda-dreta')?.remove();
    const legenda = document.createElement('div');
    legenda.id = 'avisos-legenda-dreta';
    legenda.innerHTML = `
        <div style="font-weight:700;font-size:9px;text-align:center;margin-bottom:8px;
            padding-bottom:6px;border-bottom:1px solid var(--border, #1e2e45);
            color:var(--text-secondary, #94a9c7);text-transform:uppercase;letter-spacing:0.6px;">AVISOS</div>
        <div id="avisos-legenda-contingut"></div>
        <div style="font-size:7px;text-align:center;margin-top:8px;padding-top:6px;
            border-top:1px solid var(--border, #1e2e45);color:var(--text-muted, #556680);">tempestes.cat</div>
    `;
    document.body.appendChild(legenda);
    _actualitzarLegendaDreta(window._avisosTipusActiu);
}

function _actualitzarLegendaDreta(tipusKey) {
    const tipus = TIPUS_AVIS[tipusKey];
    if (!tipus) return;
    const container = document.getElementById('avisos-legenda-contingut');
    if (!container) return;
    const signe = tipusKey === 'fred' ? '<=' : '>=';
    container.innerHTML = `
        <div style="text-align:center;font-size:8px;font-weight:700;margin-bottom:6px;color:var(--text, #e5ecf4);">
            ${tipus.nom}
        </div>
        <div style="font-size:7px;color:var(--text-muted, #556680);text-align:center;margin-bottom:8px;">
            ${tipus.descripcio}
        </div>
        ${tipus.nivells.map(n => `
            <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
                <div style="width:18px;height:12px;background:${n.color};
                    border:1px solid rgba(255,255,255,0.2);border-radius:2px;flex-shrink:0;"></div>
                <span style="font-size:8px;font-weight:600;min-width:50px;color:var(--text-secondary, #94a9c7);">${n.label}</span>
                <span style="font-size:7px;color:var(--text-muted, #556680);">${signe}${n.llindar}${tipusKey === 'tempesta' ? '' : ' ' + tipus.unitat}</span>
            </div>
        `).join('')}
    `;
}

function _mostrarLegendaDreta(visible) {
    const legenda = document.getElementById('avisos-legenda-dreta');
    if (legenda) legenda.style.display = visible ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
//  PANELL DE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

function _etiquetaDia(offsetDies) {
    const ara = new Date();
    const d = new Date(Date.UTC(ara.getUTCFullYear(), ara.getUTCMonth(), ara.getUTCDate() + offsetDies));
    return `${DIES_SETMANA[d.getUTCDay()]} ${d.getUTCDate()}`;
}

function _mostrarPanellAvisos(visible) {
    let panell = document.getElementById('avisos-panell');
    if (!panell && visible) {
        panell = document.createElement('div');
        panell.id = 'avisos-panell';
        panell.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span style="font-weight:700;font-size:11px;color:var(--text, #e5ecf4);">AVISOS</span>
                <select id="avisos-tipus-select">
                    <option value="pluja">PLUJA (mm/h)</option>
                    <option value="vent">VENT</option>
                    <option value="neu">NEU</option>
                    <option value="fred">FRED</option>
                    <option value="calor">CALOR</option>
                    <option value="tempesta">TEMPESTA SEVERA</option>
                    <option value="shear">SHEAR 0-6km</option>
                    <option value="nit">NITS TROPICALS</option>
                </select>
                <select id="avisos-periode-select">
                    <option value="avui">${_etiquetaDia(0)}</option>
                    <option value="dema">${_etiquetaDia(1)}</option>
                    <option value="48h">48 HORES</option>
                </select>
                <span id="avisos-comptador"
                    style="background:var(--bg-tertiary, #182235);border:1px solid var(--border, #1e2e45);
                    border-radius:5px;padding:5px 10px;font-size:10px;font-weight:600;
                    color:var(--accent-light, #70b0e6);">---</span>
                <button onclick="toggleAvisos()">TANCAR</button>
            </div>
            <div style="display:flex;gap:8px;font-size:8px;margin-left:10px;
                padding-left:10px;border-left:1px solid var(--border, #1e2e45);flex-wrap:wrap;
                color:var(--text-muted, #556680);">
                <span style="color:#4caf50;">* Verd</span>
                <span style="color:#ffc107;">* Groc</span>
                <span style="color:#ff9800;">* Taronja</span>
                <span style="color:#f44336;">* Vermell</span>
                <span style="color:#9c27b0;">* Lila</span>
            </div>
        `;
        document.body.appendChild(panell);
        document.getElementById('avisos-tipus-select').onchange   = function() { canviarTipusAvis(this.value); };
        document.getElementById('avisos-periode-select').onchange = function() { canviarPeriodeAvisos(this.value); };
    }
    if (panell) panell.style.display = visible ? 'flex' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
//  TICKER
// ═══════════════════════════════════════════════════════════════════════════

function _crearTickerAvisos() {
    document.getElementById('avisos-ticker')?.remove();
    const ticker = document.createElement('div');
    ticker.id = 'avisos-ticker';
    ticker.style.display = 'none';
    ticker.innerHTML = `<div class="avisos-ticker-track"></div>`;
    document.body.appendChild(ticker);
}

function _actualitzarTickerAvisos(resultats, tipusKey) {
    if (!resultats || Object.keys(resultats).length === 0) {
        const ticker = document.getElementById('avisos-ticker');
        if (ticker) ticker.style.display = 'none';
        return;
    }

    const tipus     = TIPUS_AVIS[tipusKey];
    const velocitat = VELOCITAT_TICKER[tipusKey] || 80;
    const municipis = Object.entries(resultats).sort((a, b) => b[1].nivell - a[1].nivell);

    const _formatVal = (data) => {
        if (tipusKey === 'tempesta') return `${data.valor.toFixed(1)} idx`;
        if (tipusKey === 'nit')      return `${data.valor} C`;
        return `${data.valor} ${tipus.unitat}`;
    };

    let itemsHtml = municipis.map(([, data], idx) => `
        <div class="avisos-ticker-item" data-nivell="${data.nivell}">
            <span style="font-weight:600;">${data.nom}</span>
            <span class="avisos-ticker-valor">${_formatVal(data)}</span>
        </div>
        ${idx < municipis.length - 1 ? '<span class="avisos-ticker-separador">|</span>' : ''}
    `).join('');

    if (municipis.length < 10) {
        itemsHtml += '<span class="avisos-ticker-separador" style="margin:0 15px;">*</span>' + itemsHtml;
    }

    const ticker = document.getElementById('avisos-ticker');
    if (ticker) {
        const track = ticker.querySelector('.avisos-ticker-track');
        if (track) {
            track.innerHTML = itemsHtml;
            track.style.animationDuration = `${velocitat}s`;
        }
        ticker.style.display = 'block';
    }
}

function _mostrarTickerAvisos(visible) {
    const ticker = document.getElementById('avisos-ticker');
    if (ticker) ticker.style.display = visible ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
//  ACTUALITZAR AVISOS
// ═══════════════════════════════════════════════════════════════════════════

async function actualitzarAvisos(periode, tipusKey) {
    window._avisosPeriode    = periode;
    window._avisosTipusActiu = tipusKey;

    _mostrarLoading(`Calculant: ${TIPUS_AVIS[tipusKey].nom}...`);
    _actualitzarProgres(5, 'Inicialitzant...', 'Carregant dades');
    await new Promise(r => setTimeout(r, 50));

    const resultats = await calcularAvisosMunicipis(periode, tipusKey, (pct, stage) => {
        _actualitzarProgres(pct, stage, '');
    });

    window._avisosResultats = resultats;
    _actualitzarTickerAvisos(resultats, tipusKey);
    _actualitzarProgres(98, 'Dibuixant mapa...', '');
    await _crearCapaMunicipis();
    _actualitzarLegendaDreta(tipusKey);
    _actualitzarProgres(100, 'Completat!', '');
    await new Promise(r => setTimeout(r, 400));
    _amagarLoading();

    const total = Object.keys(resultats).length;
    const comptador = document.getElementById('avisos-comptador');
    if (comptador) comptador.textContent = `${total} municipis`;

    const sel = document.getElementById('avisos-tipus-select');
    if (sel) sel.value = tipusKey;

    console.log(`[AVISOS v9] ${total} municipis | ${TIPUS_AVIS[tipusKey].nom} | ${periode}`);
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONTROLS GLOBALS
// ═══════════════════════════════════════════════════════════════════════════

window.toggleAvisos = function() {
    if (!window._avisosActiu) {
        window._avisosActiu = true;
        if (window._canvasLayer?._map) {
            window._canvasLayer._map.removeLayer(window._canvasLayer);
            window._avisosCanvasGuardat = window._canvasLayer;
        }
        document.body.classList.add('avisos-mode');
        _injectarCssTicker();
        _crearTickerAvisos();
        _crearLegendaDreta();
        _mostrarPanellAvisos(true);
        _mostrarTickerAvisos(true);
        actualitzarAvisos(window._avisosPeriode, window._avisosTipusActiu);
        document.getElementById('btnAvisosMet')?.classList.add('active');
    } else {
        window._avisosActiu = false;
        desactivarAvisos();
        if (window._avisosCanvasGuardat) {
            window._canvasLayer = window._avisosCanvasGuardat;
            window._canvasLayer.addTo(window._mapInstance);
            window._canvasLayer._redraw();
            window._avisosCanvasGuardat = null;
        }
        document.body.classList.remove('avisos-mode');
        _mostrarPanellAvisos(false);
        _mostrarTickerAvisos(false);
        _mostrarLegendaDreta(false);
        document.getElementById('btnAvisosMet')?.classList.remove('active');
        window._canvasLayer?._redraw();
    }
};

function desactivarAvisos() {
    const mapa = window._mapInstance;
    if (!mapa) return;
    if (window._avisosLayer) mapa.removeLayer(window._avisosLayer);
    window._avisosResultats = null;
    _mostrarLegendaDreta(false);
    _mostrarTickerAvisos(false);
    _amagarLoading();
}

window.canviarPeriodeAvisos = function(periode) {
    if (!window._avisosActiu) return;
    actualitzarAvisos(periode, window._avisosTipusActiu);
};

window.canviarTipusAvis = function(tipusKey) {
    if (!window._avisosActiu) return;
    window._avisosTipusActiu = tipusKey;
    actualitzarAvisos(window._avisosPeriode, tipusKey);
};

_injectarCssTicker();
console.log('[AVISOS] v9.0 | modern fosc | nits tropicals (00-06h Madrid) | pluja rain_1h | tempesta | shear');