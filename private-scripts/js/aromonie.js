/**
 * aromonie.js - Mapa HARMONIE-AROME
 * Versió reescrita per evitar errors de pila
 */

// ============================================================
// CONFIGURACIÓ
// ============================================================

const CONFIG = {
    DATA_PATH: 'web_data_armonie/',

    // Sufixos per a cada variable
    SUFFIXES: {
        'temperatura': '_11',
        'viento': '_32',
        'nubosidad': '_71',
        'precipitacion': '_207',
        'precipitacion_3h': '_207_3HH',
        'precipitacion_6h': '_207_6HH',
        'racha': '_228',
        'racha_3h': '_228_3HH',
        'descargas_1h': '_61_1HH',
        'descargas_3h': '_61_3HH',
        'descargas_6h': '_61_6HH',
    },

    // Noms per al selector
    LABELS: {
        'temperatura': 'Temperatura (°C)',
        'viento': 'Vent (m/s)',
        'nubosidad': 'Nubositat (%)',
        'precipitacion': 'Precipitació (mm)',
        'precipitacion_3h': 'Precipitació 3h (mm)',
        'precipitacion_6h': 'Precipitació 6h (mm)',
        'racha': 'Racha màxima (m/s)',
        'racha_3h': 'Racha màxima 3h (m/s)',
        'descargas_1h': 'Descàrregues 1h (rayos/km²)',
        'descargas_3h': 'Descàrregues 3h (rayos/km²)',
        'descargas_6h': 'Descàrregues 6h (rayos/km²)',
    },

    // Paleta per a temperatura
    PALETTE_TEMP: [
        { v: -24, r: 45, g: 0, b: 75 },
        { v: -20, r: 130, g: 0, b: 160 },
        { v: -15, r: 65, g: 0, b: 115 },
        { v: -10, r: 0, g: 0, b: 255 },
        { v: -5, r: 0, g: 135, b: 255 },
        { v: 0, r: 0, g: 235, b: 255 },
        { v: 2, r: 0, g: 255, b: 150 },
        { v: 5, r: 0, g: 200, b: 0 },
        { v: 8, r: 120, g: 255, b: 0 },
        { v: 11, r: 255, g: 255, b: 0 },
        { v: 14, r: 255, g: 255, b: 170 },
        { v: 17, r: 255, g: 235, b: 100 },
        { v: 20, r: 255, g: 200, b: 0 },
        { v: 23, r: 255, g: 140, b: 0 },
        { v: 26, r: 255, g: 70, b: 0 },
        { v: 29, r: 255, g: 0, b: 0 },
        { v: 32, r: 180, g: 0, b: 0 },
        { v: 35, r: 90, g: 0, b: 0 },
        { v: 38, r: 150, g: 0, b: 150 },
        { v: 42, r: 255, g: 0, b: 255 },
        { v: 46, r: 255, g: 185, b: 255 }
    ],
};

// ============================================================
// ESTAT
// ============================================================

const state = {
    map: null,
    rasterData: null,
    currentVar: 'temperatura',
    currentDate: '2026-08-04',
    currentHour: '12',
    isLoading: false,
    horesDisponibles: [],
};

// ============================================================
// ELEMENTS DOM
// ============================================================

const $ = (id) => document.getElementById(id);
const selDate = $('sel-date');
const selHour = $('sel-hour');
const selVar = $('sel-var');
const statusBadge = $('status-badge');
const loadingOverlay = $('loading-overlay');
const legendValue = $('legend-value');

// ============================================================
// FUNCIONS AUXILIARS
// ============================================================

function setStatus(text, type = 'loading') {
    if (statusBadge) {
        statusBadge.textContent = text;
        statusBadge.className = type;
    }
}

function getDataUrl(varName, date, hour) {
    const suffix = CONFIG.SUFFIXES[varName] || '';
    return `${CONFIG.DATA_PATH}down_${date}T${hour}_00_00+00_00${suffix}.json.gz`;
}

// ============================================================
// INTERPOLACIÓ DE COLOR (SENSE RECURSIÓ)
// ============================================================

function interpolarColor(valor) {
    const palette = CONFIG.PALETTE_TEMP;
    
    if (valor <= palette[0].v) return { r: palette[0].r, g: palette[0].g, b: palette[0].b };
    if (valor >= palette[palette.length - 1].v) {
        const last = palette[palette.length - 1];
        return { r: last.r, g: last.g, b: last.b };
    }
    
    for (let i = 0; i < palette.length - 1; i++) {
        const v1 = palette[i].v;
        const v2 = palette[i + 1].v;
        if (valor >= v1 && valor <= v2) {
            const t = (valor - v1) / (v2 - v1);
            return {
                r: Math.round(palette[i].r + t * (palette[i + 1].r - palette[i].r)),
                g: Math.round(palette[i].g + t * (palette[i + 1].g - palette[i].g)),
                b: Math.round(palette[i].b + t * (palette[i + 1].b - palette[i].b))
            };
        }
    }
    return { r: 128, g: 128, b: 128 };
}

// ============================================================
// CONVERTIR DADES A IMATGE (SENSE RECURSIÓ)
// ============================================================

function crearImatge(data2D) {
    const rows = data2D.length;
    const cols = data2D[0]?.length || 0;
    
    if (rows === 0 || cols === 0) {
        return crearImatgeProva(200, 200);
    }
    
    // Recollir valors vàlids
    const valors = [];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const val = data2D[i]?.[j];
            if (val !== null && typeof val === 'number' && isFinite(val)) {
                valors.push(val);
            }
        }
    }
    
    if (valors.length === 0) {
        return crearImatgeProva(cols, rows);
    }
    
    const minVal = Math.min(...valors);
    const maxVal = Math.max(...valors);
    const range = maxVal - minVal || 1;
    
    // Crear imatge
    const imageData = new Uint8Array(cols * rows * 4);
    let idx = 0;
    const isTemp = state.currentVar === 'temperatura';
    
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const val = data2D[i]?.[j];
            let r, g, b;
            
            if (val !== null && typeof val === 'number' && isFinite(val)) {
                if (isTemp) {
                    const color = interpolarColor(val);
                    r = color.r;
                    g = color.g;
                    b = color.b;
                } else {
                    const norm = (val - minVal) / range;
                    const pixel = Math.round(Math.max(0, Math.min(1, norm)) * 255);
                    r = pixel;
                    g = pixel;
                    b = pixel;
                }
            } else {
                r = 128;
                g = 128;
                b = 128;
            }
            
            const pos = idx * 4;
            imageData[pos] = r;
            imageData[pos + 1] = g;
            imageData[pos + 2] = b;
            imageData[pos + 3] = 255;
            idx++;
        }
    }
    
    // Actualitzar llegenda
    if (legendValue) {
        const label = CONFIG.LABELS[state.currentVar] || state.currentVar;
        legendValue.textContent = `${minVal.toFixed(1)} - ${maxVal.toFixed(1)} ${label.split('(')[1]?.replace(')', '') || ''}`;
    }
    
    // Convertir a PNG
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(cols, rows);
    imgData.data.set(imageData);
    ctx.putImageData(imgData, 0, 0);
    
    return canvas.toDataURL('image/png');
}

// ============================================================
// IMATGE DE PROVA
// ============================================================

function crearImatgeProva(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width || 200;
    canvas.height = height || 200;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0000ff');
    gradient.addColorStop(0.5, '#ffffff');
    gradient.addColorStop(1, '#ff0000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL('image/png');
}

// ============================================================
// LLEGIR JSON COMPRIMIT
// ============================================================

async function loadJSONGZ(url) {
    console.log(`📥 Carregant: ${url}`);
    setStatus('⏳ Carregant...', 'loading');
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const decompressedStream = blob.stream().pipeThrough(
        new DecompressionStream('gzip')
    );
    const text = await new Response(decompressedStream).text();
    return JSON.parse(text);
}

// ============================================================
// CARREGAR RASTER
// ============================================================

async function loadRaster(varName, date, hour) {
    if (state.isLoading) return;
    state.isLoading = true;
    
    const url = getDataUrl(varName, date, hour);
    
    try {
        const data = await loadJSONGZ(url);
        state.rasterData = data;
        setStatus(`✅ ${varName}`, 'ready');
        state.isLoading = false;
        return data;
    } catch (e) {
        console.error('❌ Error:', e);
        setStatus(`❌ ${e.message}`, 'error');
        state.isLoading = false;
        throw e;
    }
}

// ============================================================
// ACTUALITZAR MAPA
// ============================================================

function updateMap() {
    if (!state.rasterData || !state.map) {
        console.warn('⚠️ No hi ha dades');
        return;
    }
    
    const data2D = state.rasterData.data;
    const rows = data2D.length;
    const cols = data2D[0]?.length || 0;
    
    if (rows === 0 || cols === 0) {
        console.warn('⚠️ Dades buides');
        return;
    }
    
    // Bounds de la Península
    const bounds = { west: -10.0, east: 4.0, south: 36.0, north: 44.0 };
    
    try {
        const pngDataUrl = crearImatge(data2D);
        
        // Eliminar capa anterior
        if (state.map.getSource('raster-source')) {
            state.map.removeLayer('raster-layer');
            state.map.removeSource('raster-source');
        }
        
        state.map.addSource('raster-source', {
            type: 'image',
            url: pngDataUrl,
            coordinates: [
                [bounds.west, bounds.south],
                [bounds.east, bounds.south],
                [bounds.east, bounds.north],
                [bounds.west, bounds.north]
            ]
        });
        
        state.map.addLayer({
            id: 'raster-layer',
            type: 'raster',
            source: 'raster-source',
            paint: { 'raster-opacity': 0.75 }
        });
        
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
        
        console.log('✅ Mapa actualitzat');
        
    } catch (e) {
        console.error('❌ Error:', e);
        setStatus(`❌ ${e.message}`, 'error');
    }
}

// ============================================================
// CARREGAR HORES DISPONIBLES
// ============================================================

async function carregarHoresDisponibles() {
    try {
        const response = await fetch('web_data_armonie/index.json');
        if (response.ok) {
            const index = await response.json();
            const hores = new Set();
            for (const arxiu of index.arxius) {
                if (arxiu.variable === 'temperatura') {
                    hores.add(arxiu.hora);
                }
            }
            state.horesDisponibles = Array.from(hores).sort();
            return state.horesDisponibles;
        }
    } catch (e) {
        console.warn('No s\'ha pogut carregar index.json');
    }
    
    state.horesDisponibles = ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'];
    return state.horesDisponibles;
}

// ============================================================
// INICIALITZAR MAPA
// ============================================================

function initMap() {
    console.log('🗺️ Inicialitzant mapa...');
    
    state.map = new maplibregl.Map({
        container: 'map',
        style: 'https://demotiles.maplibre.org/style.json',
        center: [-3.7, 40.4],
        zoom: 5.5,
        maxZoom: 12,
        minZoom: 4,
    });
    
    state.map.on('load', async () => {
        console.log('🗺️ Mapa carregat');
        
        await carregarHoresDisponibles();
        
        // Omplir selector de variables
        if (selVar) {
            selVar.innerHTML = Object.entries(CONFIG.LABELS)
                .map(([key, label]) => `<option value="${key}">${label}</option>`)
                .join('');
            selVar.value = state.currentVar;
        }
        
        // Omplir selector de dates
        if (selDate) {
            const dates = ['2026-08-04', '2026-08-05', '2026-08-06'];
            selDate.innerHTML = dates.map(d => 
                `<option value="${d}">${d}</option>`
            ).join('');
            selDate.value = state.currentDate;
        }
        
        // Omplir selector d'hores
        if (selHour) {
            const hores = state.horesDisponibles.length > 0 ? state.horesDisponibles : ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'];
            selHour.innerHTML = hores.map(h => 
                `<option value="${h}">${h}:00</option>`
            ).join('');
            
            if (hores.includes('12')) {
                selHour.value = '12';
                state.currentHour = '12';
            } else if (hores.length > 0) {
                selHour.value = hores[0];
                state.currentHour = hores[0];
            }
        }
        
        try {
            await loadRaster(state.currentVar, state.currentDate, state.currentHour);
            updateMap();
        } catch (e) {
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    });
}

// ============================================================
// EVENT LISTENERS
// ============================================================

if (selVar) {
    selVar.addEventListener('change', async () => {
        state.currentVar = selVar.value;
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
        try {
            await loadRaster(state.currentVar, state.currentDate, state.currentHour);
            updateMap();
        } catch (e) {
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    });
}

if (selDate) {
    selDate.addEventListener('change', async () => {
        state.currentDate = selDate.value;
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
        try {
            await loadRaster(state.currentVar, state.currentDate, state.currentHour);
            updateMap();
        } catch (e) {
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    });
}

if (selHour) {
    selHour.addEventListener('change', async () => {
        state.currentHour = selHour.value;
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
        try {
            await loadRaster(state.currentVar, state.currentDate, state.currentHour);
            updateMap();
        } catch (e) {
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    });
}

// ============================================================
// INICIAR APLICACIÓ
// ============================================================

console.log('🚀 Iniciant HARMONIE-AROME Viewer');
document.addEventListener('DOMContentLoaded', () => {
    initMap();
});