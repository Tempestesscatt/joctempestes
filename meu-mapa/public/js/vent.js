const Vent = (function () {

    // ─── Configuració per defecte ──────────────────────────────────────
    const cfg = {
        color: '#ffffff',
        opacitat: 0.75,
        midaParticula: 1.6,
        numParticules: 1400,
        velocitatFactor: 1.0,
        vidaMinima: 40,
        vidaMaxima: 110,
        estelaAlpha: 0.90,
    };

    let canvas = null;
    let ctx = null;
    let particules = [];
    let animFrame = null;
    let actiu = false;
    let ventDataCache = null;
    let ultimIdxCache = -1;
    let ultimaClauVariable = null;  // ← NUEVO: para detectar cambios de nivel

    // ─── Utilitats ──────────────────────────────────────────────────────
    function hexToRgb(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 255, g: 255, b: 255 };
    }

    function obtenirCanvasVent() {
        if (canvas) return canvas;
        if (typeof map === 'undefined' || !map.getPane) return null;
        const pane = map.getPane('paneVent');
        if (!pane) return null;

        canvas = document.createElement('canvas');
        canvas.id = 'canvasParticulesVent';
        canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
        pane.appendChild(canvas);
        ctx = canvas.getContext('2d');

        const resize = () => {
            if (!canvas || !map) return;
            const size = map.getSize();
            canvas.width = size.x;
            canvas.height = size.y;
            L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
        };
        resize();
        map.on('move moveend zoomend resize', resize);
        map.on('zoomstart', () => { particules = []; });

        return canvas;
    }

    // ─── Obtenir dades de vent (reutilitza la funció ja existent) ───────
    function obtenirDadesVentActuals() {
        if (typeof totesLesHores === 'undefined' || typeof curIdx === 'undefined') return null;
        const item = totesLesHores[curIdx];
        if (!item || !item.data) return null;

        if (ventDataCache && ultimIdxCache === curIdx) return ventDataCache;

        if (typeof obtenirVentPerStreamlines !== 'function') return null;
        const clau = (typeof variableActiva !== 'undefined') ? variableActiva : 'st';
        const vd = obtenirVentPerStreamlines(item.data, clau);
        if (vd) {
            ventDataCache = vd;
            ultimIdxCache = curIdx;
        }
        return vd;
    }

    function invalidarCache() {
        ventDataCache = null;
        ultimIdxCache = -1;
    }

    // ─── Mostreig bilineal U/V en un punt de pantalla ───────────────────
    function sampleUV(px, py, ventData) {
        const { Nlat, Nlon, speed, dir, extent } = ventData;
        if (px < 0 || px > canvas.width || py < 0 || py > canvas.height) return null;

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

    // ─── Gestió de partícules ────────────────────────────────────────────
    function novaParticula(ventData) {
        const w = canvas.width, h = canvas.height;
        const x = Math.random() * w;
        const y = Math.random() * h;
        return {
            x, y,
            edat: 0,
            vida: cfg.vidaMinima + Math.random() * (cfg.vidaMaxima - cfg.vidaMinima),
        };
    }

    function reomplirParticules(ventData) {
        while (particules.length < cfg.numParticules) {
            particules.push(novaParticula(ventData));
        }
        if (particules.length > cfg.numParticules) {
            particules.length = cfg.numParticules;
        }
    }

    // 🔥 NUEVO: Función para reiniciar completamente las partículas
    function reiniciarComplet() {
        particules = [];
        invalidarCache();
        if (actiu && canvas) {
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    function pas() {
        if (!actiu || !canvas || !ctx) return;

        const ventData = obtenirDadesVentActuals();
        if (!ventData) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            animFrame = requestAnimationFrame(pas);
            return;
        }

        reomplirParticules(ventData);

        // Esvaïment de l'estela (rastre suau)
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = `rgba(0,0,0,${cfg.estelaAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';

        const rgb = hexToRgb(cfg.color);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${cfg.opacitat})`;

        for (let i = 0; i < particules.length; i++) {
            const p = particules[i];
            const uv = sampleUV(p.x, p.y, ventData);

            if (!uv || (Math.abs(uv.u) < 0.05 && Math.abs(uv.v) < 0.05)) {
                const np = novaParticula(ventData);
                particules[i] = np;
                continue;
            }

            const mag = Math.hypot(uv.u, uv.v);
            const factor = 0.045 * cfg.velocitatFactor;
            p.x += uv.u * factor;
            p.y -= uv.v * factor;
            p.edat++;

            if (p.edat > p.vida || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                particules[i] = novaParticula(ventData);
                continue;
            }

            const midaFinal = cfg.midaParticula * Math.min(1.4, 0.6 + mag / 60);
            ctx.beginPath();
            ctx.arc(p.x, p.y, midaFinal, 0, Math.PI * 2);
            ctx.fill();
        }

        animFrame = requestAnimationFrame(pas);
    }

    // ─── API pública ─────────────────────────────────────────────────────
    function iniciar() {
        if (actiu) return;
        obtenirCanvasVent();
        if (!canvas) return;
        actiu = true;
        reiniciarComplet();
        if (!animFrame) animFrame = requestAnimationFrame(pas);
    }

    function aturar() {
        actiu = false;
        if (animFrame) {
            cancelAnimationFrame(animFrame);
            animFrame = null;
        }
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
        particules = [];
    }

    function estaActiu() {
        return actiu;
    }

    function configurar(opcions) {
        Object.assign(cfg, opcions || {});
    }

    function reiniciarParticules() {
        particules = [];
    }

    function obtenirConfig() {
        return { ...cfg };
    }

    function notificarCanviHora() {
        invalidarCache();
        if (actiu) {
            reiniciarComplet();
        }
    }

    // 🔥 NUEVO: Notificar cambio de variable (nivel)
    function notificarCanviVariable(novaClau) {
        // Si la variable ha cambiado de nivel (ej: wind_speed_850 → wind_speed_300)
        // o si es una variable diferente que puede tener viento diferente
        const baseAnterior = ultimaClauVariable ? clauBase(ultimaClauVariable) : null;
        const baseNova = clauBase(novaClau);
        
        // Si cambia la base o si es una variable de nivel diferente
        if (baseAnterior !== baseNova || novaClau !== ultimaClauVariable) {
            ultimaClauVariable = novaClau;
            invalidarCache();
            if (actiu) {
                reiniciarComplet();
                // Forzar un paso inmediato
                if (animFrame) {
                    cancelAnimationFrame(animFrame);
                    animFrame = null;
                }
                animFrame = requestAnimationFrame(pas);
            }
        }
    }

    // Función auxiliar para obtener la base de una variable (como clauBase en mapa.js)
    function clauBase(c) {
        if (typeof window.clauBase === 'function') return window.clauBase(c);
        // Fallback simple
        const m = c.match(/^(.+)_(-?\d+)$/);
        return m ? m[1] : c;
    }

    return {
        iniciar,
        aturar,
        estaActiu,
        configurar,
        obtenirConfig,
        notificarCanviHora,
        reiniciarParticules,
        notificarCanviVariable,  // ← NUEVO
    };
})();

window.Vent = Vent;