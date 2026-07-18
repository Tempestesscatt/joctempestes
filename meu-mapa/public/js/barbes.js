// ═══════════════════════════════════════════════════════════════════════════
//  BARBES DE VENT - VERSIÓ INTEGRADA AMB EL BOTÓ DE VENT
//  Cicla entre: Streamlines → Partícules → Barbes
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. VARIABLES GLOBALS ────────────────────────────────────────────────────
window.barbesVentActiu = false;
let _barbesCanvas = null;
let _barbesCtx = null;
let _barbesInterval = null;

// ── 2. FUNCIÓ PER DIBUIXAR UNA BARBA DE VENT ─────────────────────────────
function dibuixarBarba(ctx, x, y, velocitat_kt, direccio_graus, color = '#000000', escala = 1.0) {
    const v = Math.round(velocitat_kt);
    if (v < 1) return;
    
    const long = 20 * escala;
    const gros = 2.0 * escala;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((direccio_graus) * Math.PI / 180);
    
    // Línia principal
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -long);
    ctx.strokeStyle = color;
    ctx.lineWidth = gros;
    ctx.stroke();
    
    let velRestant = v;
    let offsetY = -long;
    
    // Barres de 50 kt (bandera)
    while (velRestant >= 50) {
        ctx.beginPath();
        ctx.moveTo(0, offsetY);
        ctx.lineTo(-long * 0.7, offsetY - long * 0.25);
        ctx.strokeStyle = color;
        ctx.lineWidth = gros;
        ctx.stroke();
        velRestant -= 50;
        offsetY += long * 0.15;
    }
    
    // Barres de 10 kt
    while (velRestant >= 10) {
        ctx.beginPath();
        ctx.moveTo(0, offsetY);
        ctx.lineTo(-long * 0.5, offsetY - long * 0.15);
        ctx.strokeStyle = color;
        ctx.lineWidth = gros;
        ctx.stroke();
        velRestant -= 10;
        offsetY += long * 0.15;
    }
    
    // Barres de 5 kt (mig)
    if (velRestant >= 5) {
        ctx.beginPath();
        ctx.moveTo(0, offsetY);
        ctx.lineTo(-long * 0.3, offsetY - long * 0.08);
        ctx.strokeStyle = color;
        ctx.lineWidth = gros;
        ctx.stroke();
    }
    
    ctx.restore();
}

// ── 3. FUNCIÓ PER DIBUIXAR TOTES LES BARBES ─────────────────────────────
function dibuixarBarbesVent() {
    const map = window._mapInstance;
    if (!map) return;
    
    // Crear canvas si no existeix
    let canvas = document.getElementById('barbes-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'barbes-canvas';
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 415;
            width: 100%;
            height: 100%;
        `;
        const wrap = document.getElementById('canvas-wrap') || document.body;
        wrap.appendChild(canvas);
    }
    
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!window.barbesVentActiu) return;
    
    // ── OBTENIR DADES DE VENT ──────────────────────────────────────────────
    const presData = window.PRES_DATA;
    const curItem = window.totesLesHores?.[window.curIdx];
    if (!presData || !curItem) return;
    
    const ts = curItem.timestamp;
    const hIdx = presData.meta.hours_utc?.indexOf(ts) ?? 0;
    if (hIdx < 0) return;
    
    // Nivell de vent: 850 hPa (o el que estigui seleccionat)
    const nivell = window._canvasLayer?._levelKey || '850hPa';
    const layer = presData.hourly?.[nivell];
    if (!layer) return;
    
    const spdArr = layer.wind_speed || layer.wind;
    const dirArr = layer.wind_direction;
    if (!spdArr || !dirArr) return;
    
    const N = presData.meta.n_grid;
    const ext = presData.meta.extent;
    
    // ── DENSITAT SEGONS ZOOM ──────────────────────────────────────────────
    const zoom = map.getZoom();
    let step = 4;
    if (zoom < 8) step = 8;
    else if (zoom < 10) step = 5;
    else if (zoom < 12) step = 3;
    else step = 2;
    
    const escala = Math.min(1.4, Math.max(0.7, zoom / 10));
    
    for (let row = 0; row < N; row += step) {
        for (let col = 0; col < N; col += step) {
            const idx = row * N + col;
            
            const spd = spdArr[idx]?.[hIdx] ?? 0;
            const dir = dirArr[idx]?.[hIdx] ?? 0;
            
            // Convertir a kt (si ve en km/h)
            let kt = spd;
            if (spd > 50) kt = spd / 1.852;
            if (kt < 3) continue;
            
            // Posició al mapa
            const lat = ext[3] - (row / (N - 1)) * (ext[3] - ext[2]);
            const lon = ext[0] + (col / (N - 1)) * (ext[1] - ext[0]);
            const pt = map.latLngToContainerPoint(L.latLng(lat, lon));
            
            // Saltar si està fora de pantalla
            if (pt.x < -50 || pt.x > canvas.width + 50 || 
                pt.y < -50 || pt.y > canvas.height + 50) continue;
            
            dibuixarBarba(ctx, pt.x, pt.y, kt, dir, '#000000', escala);
        }
    }
}

// ── 4. FUNCIÓ PER ACTIVAR/DESACTIVAR BARBES ─────────────────────────────
function toggleBarbesVent(activar) {
    if (activar === undefined) {
        window.barbesVentActiu = !window.barbesVentActiu;
    } else {
        window.barbesVentActiu = activar;
    }
    
    if (window.barbesVentActiu) {
        setTimeout(dibuixarBarbesVent, 100);
        
        const map = window._mapInstance;
        if (map) {
            map.on('moveend zoomend', dibuixarBarbesVent);
        }
        
        if (_barbesInterval) clearInterval(_barbesInterval);
        _barbesInterval = setInterval(dibuixarBarbesVent, 2000);
        
    } else {
        const canvas = document.getElementById('barbes-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        const map = window._mapInstance;
        if (map) {
            map.off('moveend zoomend', dibuixarBarbesVent);
        }
        if (_barbesInterval) {
            clearInterval(_barbesInterval);
            _barbesInterval = null;
        }
    }
}

// ── 5. FUNCIÓ PER AFEGIR EL BOTÓ (ara integrat amb el de vent) ──────────
function afegirBotoBarbes() {
    if (document.getElementById('btnBarbes')) return;
    
    // Buscar el botó de vent existent
    const btnVent = document.getElementById('btnVentMode') || 
                    document.querySelector('[id*="VentMode"]') ||
                    document.getElementById('toggleVent');
    
    if (btnVent) {
        // Modificar el botó existent perquè cicli entre 3 opcions
        const textOriginal = btnVent.textContent;
        btnVent.style.cursor = 'pointer';
        
        // Guardar referència a la funció original
        const clickOriginal = btnVent.onclick;
        
        btnVent.onclick = function(e) {
            e.stopPropagation();
            
            // Ciclar modes: streamlines → particles → barbes → streamlines
            const modeActual = window.ventMode || 'streamlines';
            let nouMode;
            
            if (modeActual === 'streamlines') {
                nouMode = 'particles';
                // Desactivar barbes
                if (window.barbesVentActiu) toggleBarbesVent(false);
            } else if (modeActual === 'particles') {
                nouMode = 'barbes';
                // Activar barbes
                if (!window.barbesVentActiu) toggleBarbesVent(true);
            } else if (modeActual === 'barbes') {
                nouMode = 'streamlines';
                // Desactivar barbes
                if (window.barbesVentActiu) toggleBarbesVent(false);
            }
            
            window.ventMode = nouMode;
            
            // Actualitzar text del botó
            const icons = {
                'streamlines': '〰️',
                'particles': '✦',
                'barbes': '🏴'
            };
            const labels = {
                'streamlines': 'Streamlines',
                'particles': 'Partícules',
                'barbes': 'Barbes'
            };
            btnVent.textContent = icons[nouMode] + ' ' + labels[nouMode];
            
            // Actualitzar estil
            if (nouMode === 'barbes') {
                btnVent.style.background = '#2c3e50';
                btnVent.style.color = '#ffffff';
                btnVent.style.borderColor = '#5a8ab0';
            } else {
                btnVent.style.background = '';
                btnVent.style.color = '';
                btnVent.style.borderColor = '';
            }
            
            // Cridar la funció original si existeix
            if (typeof clickOriginal === 'function') {
                clickOriginal.call(btnVent, e);
            }
            
            // Redibuixar el mapa
            if (window._canvasLayer) {
                window._canvasLayer._redraw();
            }
            
            console.log('[Barbes] Mode canviat a:', nouMode);
        };
        
        console.log('[Barbes] Botó de vent modificat per incloure barbes ✅');
        return;
    }
    
    // Si no troba el botó de vent, crear un de nou
    let controls = document.querySelector('.controls-row') || 
                   document.querySelector('.control-group') ||
                   document.getElementById('controls');
    
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'controls-row';
        controls.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            display: flex;
            gap: 6px;
            background: rgba(10,16,24,0.85);
            padding: 6px 12px;
            border-radius: 8px;
            backdrop-filter: blur(8px);
            border: 1px solid #2a4560;
            flex-wrap: wrap;
            justify-content: center;
        `;
        document.body.appendChild(controls);
    }
    
    const btn = document.createElement('button');
    btn.id = 'btnBarbes';
    btn.style.cssText = `
        background: transparent;
        border: 1px solid #2a4560;
        color: #8ab3cc;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-family: 'Courier New', monospace;
        font-size: 10px;
        font-weight: 500;
        transition: all 0.2s;
        letter-spacing: 0.5px;
    `;
    btn.textContent = '🏴 Barbes';
    btn.title = 'Mostra/amaga barbes de vent';
    btn.onclick = function(e) {
        e.stopPropagation();
        toggleBarbesVent();
        this.textContent = window.barbesVentActiu ? '🏴 Barbes ON' : '🏴 Barbes';
        this.style.background = window.barbesVentActiu ? '#2c3e50' : '';
        this.style.color = window.barbesVentActiu ? '#ffffff' : '';
    };
    controls.appendChild(btn);
    
    console.log('[Barbes] Botó independent creat ✅');
}

// ── 6. EXPORTAR ─────────────────────────────────────────────────────────────
window.afegirBotoBarbes = afegirBotoBarbes;
window.dibuixarBarbesVent = dibuixarBarbesVent;
window.toggleBarbesVent = toggleBarbesVent;

console.log('[Barbes] Sistema carregat ✅');