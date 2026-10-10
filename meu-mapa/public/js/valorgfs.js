// ═══════════════════════════════════════════════════════════════════
//  valor.js — Clic esquerre per llegir el valor del píxel (GFS)
//  Llegeix la imatge ORIGINAL (window.getDadesOriginals) i fa servir
//  window.PALETES_GFS generat pel generar_paletes_gfs.py.
// ═══════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const N = 256;
    let _tip = null;
    let _cv = null, _cx = null, _cvImg = null;
    const _luts = new Map();
    let _down = null;

    const normClau = s => String(s || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

    // ─── TOOLTIP ─────────────────────────────────────────────────────
    function tooltip() {
        if (_tip) return _tip;
        _tip = document.createElement('div');
        _tip.id = 'valorTooltip';
        _tip.style.cssText = `
            position: fixed; z-index: 8600;
            background: rgba(13,17,23,0.96);
            border: 1px solid rgba(255,255,255,0.18);
            border-radius: 8px; padding: 8px 12px;
            font: 600 12px 'Inter', system-ui, sans-serif;
            color: #f0f6fc; pointer-events: none;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            display: none; white-space: nowrap; line-height: 1.4;`;
        document.body.appendChild(_tip);
        return _tip;
    }
    function mostrar(x, y, html) {
        const t = tooltip();
        t.innerHTML = html;
        t.style.display = 'block';
        const r = t.getBoundingClientRect();
        let tx = x + 14, ty = y - 40;
        if (tx + r.width > window.innerWidth - 8) tx = x - r.width - 14;
        if (ty < 8) ty = y + 18;
        if (ty + r.height > window.innerHeight - 8) ty = window.innerHeight - r.height - 8;
        t.style.left = tx + 'px';
        t.style.top = ty + 'px';
    }
    function amagar() { if (_tip) _tip.style.display = 'none'; }

    const titol = t => '<div style="color:#7f9bb3;font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">' + t + '</div>';
    const petit = t => '<div style="color:#7f9bb3;font-size:10px;font-weight:500;margin-top:2px;">' + t + '</div>';

    // ─── GENERAR LUT A PARTIR DELS STOPS (interpolació) ──────────────
    function construirLUT(stops) {
        // stops: [[valor, r, g, b, a], ...]
        if (!stops || stops.length < 2) return null;
        const lut = new Uint8Array(N * 4);
        const vmin = stops[0][0];
        const vmax = stops[stops.length - 1][0];
        const span = (vmax - vmin) || 1;

        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);
            const valor = vmin + t * span;

            // Trobar el segment
            let a = stops[0], b = stops[stops.length - 1];
            for (let k = 0; k < stops.length - 1; k++) {
                if (valor >= stops[k][0] && valor <= stops[k + 1][0]) {
                    a = stops[k];
                    b = stops[k + 1];
                    break;
                }
            }
            const rang = (b[0] - a[0]) || 1;
            const f = rang > 0 ? (valor - a[0]) / rang : 0;

            lut[i * 4]     = Math.round(a[1] + (b[1] - a[1]) * f);
            lut[i * 4 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
            lut[i * 4 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
            lut[i * 4 + 3] = Math.round((a[4] !== undefined ? a[4] : 255) +
                              ((b[4] !== undefined ? b[4] : 255) -
                               (a[4] !== undefined ? a[4] : 255)) * f);
        }
        return lut;
    }

    function lutDe(clau, stops) {
        const key = clau + '|' + stops.length + '|' + stops[0][0] + '|' + stops[stops.length - 1][0];
        if (_luts.has(key)) return _luts.get(key);
        const lut = construirLUT(stops);
        _luts.set(key, lut);
        return lut;
    }

    // ─── IMATGE DE DADES (la del DOM, només per a la geometria) ──────
    function trobarImgDades() {
        const imgs = document.querySelectorAll('#map img');
        for (const im of imgs) if (String(im.style.zIndex) === '2') return im;
        return imgs[1] || null;
    }

    // ─── LLEGIR PÍXEL ORIGINAL ───────────────────────────────────────
    function llegirPixel(img, fx, fy) {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) return null;
        if (_cvImg !== img) {
            if (!_cv) {
                _cv = document.createElement('canvas');
                _cx = _cv.getContext('2d', { willReadFrequently: true });
            }
            _cv.width = w; _cv.height = h;
            _cx.clearRect(0, 0, w, h);
            _cx.drawImage(img, 0, 0);
            _cvImg = img;
        }
        const px = Math.min(w - 1, Math.max(0, Math.floor(fx * w)));
        const py = Math.min(h - 1, Math.max(0, Math.floor(fy * h)));
        const d = _cx.getImageData(px, py, 1, 1).data;
        return [d[0], d[1], d[2], d[3]];
    }

    // ─── QUINA PALETA I RANG ─────────────────────────────────────────
    function resoldre(clau) {
        const P = window.PALETES_GFS;
        if (!P) return { error: 'Falta dades/paletesgfs.js. Executa generar_paletes_gfs.py.' };

        // Provar la clau directament
        if (P[clau]) return { e: P[clau], clau };

        // Provar la base (per si és t_850 → t)
        const base = clau.replace(/_\d+$/, '');
        if (P[base]) return { e: P[base], clau: base };

        // Provar normClau
        const k = normClau(clau);
        if (P[k]) return { e: P[k], clau: k };

        return { error: 'No hi ha paleta per a «' + clau + '»' };
    }

    // ─── COLOR → ÍNDEX DE LUT ────────────────────────────────────────
    function cercar(lut, r, g, b) {
        const d = new Float64Array(N);
        let best = Infinity, arg = 0;
        for (let i = 0; i < N; i++) {
            const dr = r - lut[i * 4], dg = g - lut[i * 4 + 1], db = b - lut[i * 4 + 2];
            const v = dr * dr + dg * dg + db * db;
            d[i] = v;
            if (v < best) { best = v; arg = i; }
        }
        const tied = [];
        for (let i = 0; i < N; i++) if (d[i] <= best + 1.5) tied.push(i);
        if (!tied.length) return { best: Infinity, i0: 0, i1: 0, ambigu: false };
        const runs = [];
        let cur = [tied[0]];
        for (let k = 1; k < tied.length; k++) {
            if (tied[k] === tied[k - 1] + 1) cur.push(tied[k]);
            else { runs.push(cur); cur = [tied[k]]; }
        }
        runs.push(cur);
        const run = runs.find(r => r.includes(arg)) || runs[0];
        return { best, i0: run[0], i1: run[run.length - 1], ambigu: runs.length > 1 };
    }

    function fmt(v, dec) {
        const z = Math.pow(10, -dec) / 2;
        return (Math.abs(v) < z ? 0 : v).toFixed(dec);
    }

    function capcalera() {
        const n = document.getElementById('ppActualNom');
        const u = document.getElementById('ppActualUnitat');
        return {
            nom: n ? n.textContent.trim() : '',
            unitat: u ? u.textContent.trim() : ''
        };
    }

    // ─── CLIC ────────────────────────────────────────────────────────
    function gestionarClic(e) {
        if (e.button !== 0) return;
        if (_down && Math.hypot(e.clientX - _down.x, e.clientY - _down.y) > 5) return;

        const orig = typeof window.getDadesOriginals === 'function'
            ? window.getDadesOriginals() : null;
        const imgDom = trobarImgDades();
        if (!orig || !orig.img || !imgDom || imgDom.style.visibility === 'hidden') {
            amagar(); return;
        }

        const r = imgDom.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width;
        const fy = (e.clientY - r.top) / r.height;
        if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) { amagar(); return; }

        const cap = capcalera();
        const clauActiva = orig.clau || (typeof window.variableActiva !== 'undefined'
            ? window.variableActiva : 'st');

        // Si tenim clau del canvas 3D, la fem servir
        const clau = clauActiva;

        const px = llegirPixel(orig.img, fx, fy);
        if (!px) return;

        if (px[3] === 0) {
            mostrar(e.clientX, e.clientY,
                titol(cap.nom || clau) +
                '<div style="color:#ffd700;font-size:15px;">Sense dades</div>' +
                petit('transparent: valor mínim o fora de cobertura'));
            return;
        }

        const res = resoldre(clau);
        if (res.error) {
            mostrar(e.clientX, e.clientY,
                titol('Valor') +
                '<div style="color:#ff8080;">' + res.error + '</div>');
            return;
        }

        const lut = lutDe(res.clau, res.e.stops);
        if (!lut) {
            mostrar(e.clientX, e.clientY,
                titol('Valor') +
                '<div style="color:#ff8080;">LUT invàlida. Regenera paletesgfs.js.</div>');
            return;
        }

        const m = cercar(lut, px[0], px[1], px[2], px[3]);
        if (m.best > 400) {
            mostrar(e.clientX, e.clientY,
                titol(cap.nom || clau) +
                '<div style="color:#ff8080;">El color no coincideix amb la paleta</div>' +
                petit('regenera paletesgfs.js i recarrega (Ctrl+Shift+R)'));
            return;
        }

        const vmin = res.e.vmin, vmax = res.e.vmax;
        const span = vmax - vmin, step = span / N;
        const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
        const lo = vmin + m.i0 * step, hi = vmin + (m.i1 + 1) * step;

        let text, marge = '';
        if (m.i0 === 0 && m.i1 === N - 1) text = '—';
        else if (m.i0 === 0) text = '≤ ' + fmt(hi, dec);
        else if (m.i1 === N - 1) text = '≥ ' + fmt(lo, dec);
        else if (m.i1 - m.i0 + 1 > 3) text = fmt(lo, dec) + ' – ' + fmt(hi, dec);
        else {
            text = fmt((lo + hi) / 2, dec);
            marge = '± ' + fmt((hi - lo) / 2, Math.min(3, dec + 1));
        }

        const unitat = cap.unitat || res.e.unitat || '';
        let extra = marge ? petit(marge + ' (resolució del mapa)') : '';
        if (m.ambigu) extra += petit('color repetit a la paleta: valor ambigu');

        mostrar(e.clientX, e.clientY,
            titol(cap.nom || res.e.nom || clau) +
            '<div style="color:#ffd700;font-size:15px;">' + text +
            (unitat ? ' ' + unitat : '') + '</div>' + extra);
    }

    // ─── INIT ────────────────────────────────────────────────────────
    function init() {
        const viewport = document.getElementById('map');
        if (!viewport) { setTimeout(init, 200); return; }
        viewport.addEventListener('pointerdown', e => {
            _down = { x: e.clientX, y: e.clientY };
            amagar();
        });
        viewport.addEventListener('click', gestionarClic);
        viewport.addEventListener('wheel', amagar, { passive: true });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') amagar();
        });
        console.log('✅ valor.js carregat — clic esquerre per llegir el valor (GFS)');
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();