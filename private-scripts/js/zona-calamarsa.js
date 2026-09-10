// ═══════════════════════════════════════════════════════════════════
//  ZONA DE CONGELACIÓ / CREIXEMENT DE CALAMARSA (-10°C a -20°C)
//  ZONA VERTICAL ENTRE Td i T seguint el perfil
//  Sense etiquetes, mantenint l'estil original
// ═══════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    const P_TOP = 100, P_BOT = 1050;
    const T_MIN = -32, T_MAX = 50;
    const SKEW = 50;

    function yPerP(p, h, padTop, padBot) {
        const logTop = Math.log(P_TOP), logBot = Math.log(P_BOT);
        const frac = (logBot - Math.log(p)) / (logBot - logTop);
        return (h - padBot) - frac * (h - padTop - padBot);
    }

    function xPerT(tC, p, w, h, padLeft, padRight, padTop, padBot) {
        const y = yPerP(p, h, padTop, padBot);
        const skewPerPx = Math.tan(SKEW * Math.PI / 180);
        const yBase = yPerP(P_BOT, h, padTop, padBot);
        const dxSkew = (yBase - y) * skewPerPx;
        const fracT = (tC - T_MIN) / (T_MAX - T_MIN);
        const xBase = padLeft + fracT * (w - padLeft - padRight);
        return xBase + dxSkew;
    }

    function trobaPressioPerTemp(perfil, tObjectiu) {
        if (!perfil || !perfil.p || perfil.p.length < 2) return null;
        const p = perfil.p, t = perfil.t;
        for (let i = 1; i < p.length; i++) {
            const t0 = t[i - 1], t1 = t[i];
            if ((t0 - tObjectiu) === 0) return p[i - 1];
            if ((t0 - tObjectiu > 0) !== (t1 - tObjectiu > 0)) {
                const frac = (t0 - tObjectiu) / (t0 - t1);
                return p[i - 1] + frac * (p[i] - p[i - 1]);
            }
        }
        return null;
    }

    function interpolarValor(perfil, pTarget, key) {
        const p = perfil.p, v = perfil[key];
        if (pTarget > p[0] || pTarget < p[p.length - 1]) return null;
        for (let i = 0; i < p.length - 1; i++) {
            if (p[i] >= pTarget && p[i + 1] <= pTarget) {
                const denom = (p[i] - p[i + 1]) || 1;
                const f = (p[i] - pTarget) / denom;
                return v[i] + f * (v[i + 1] - v[i]);
            }
        }
        return null;
    }

    function assegurarCapa() {
        const wrap = document.getElementById('skewtCanvasWrap');
        if (!wrap) return null;
        let capa = document.getElementById('skewtCalamarsaCanvas');
        if (!capa) {
            capa = document.createElement('canvas');
            capa.id = 'skewtCalamarsaCanvas';
            capa.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:5;';
            wrap.appendChild(capa);
        }
        return capa;
    }

    function dibuixar() {
        const overlay = document.getElementById('skewtModalOverlay');
        if (!overlay || !overlay.classList.contains('active')) return;

        const wrap = document.getElementById('skewtCanvasWrap');
        const internal = window._skewtInternal;
        if (!wrap || !internal) return;

        const perfil = internal.perfilActual;
        if (!perfil) return;

        const wTotal = wrap.clientWidth, hTotal = wrap.clientHeight;
        if (wTotal < 50 || hTotal < 50) return;

        const capa = assegurarCapa();
        if (!capa) return;

        const dpr = window.devicePixelRatio || 1;
        capa.width = wTotal * dpr;
        capa.height = hTotal * dpr;
        capa.style.width = wTotal + 'px';
        capa.style.height = hTotal + 'px';

        const ctx = capa.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, wTotal, hTotal);

        const hodoAmpleIdeal = Math.min(340, Math.max(230, hTotal * 0.42));
        const hodoAmple = Math.min(hodoAmpleIdeal, wTotal * 0.42);
        const skewtAmple = wTotal - hodoAmple;
        const padLeft = 42, padRight = 38, padTop = 10, padBot = 26;
        const w = skewtAmple, h = hTotal;

        const p10 = trobaPressioPerTemp(perfil, -10);
        const p20 = trobaPressioPerTemp(perfil, -20);
        if (!p10 || !p20) return;

        const pTop = Math.min(p10, p20);
        const pBot = Math.max(p10, p20);

        ctx.save();
        ctx.beginPath();
        ctx.rect(padLeft, padTop, w - padLeft - padRight, h - padTop - padBot);
        ctx.clip();

        // ── 1. ZONA VERTICAL ENTRE Td i T (seguint el perfil) ──
        const pasPressio = 2;
        const puntsEsquerra = [];
        const puntsDreta = [];

        for (let p = pBot; p >= pTop; p -= pasPressio) {
            const tC = interpolarValor(perfil, p, 't');
            const tdC = interpolarValor(perfil, p, 'td');
            if (tC === null || tdC === null) continue;
            
            const y = yPerP(p, h, padTop, padBot);
            const xT = xPerT(tC, p, w, h, padLeft, padRight, padTop, padBot);
            const xTd = xPerT(tdC, p, w, h, padLeft, padRight, padTop, padBot);
            
            // Assegurar que Td < T (esquerra < dreta)
            const xEsq = Math.min(xT, xTd);
            const xDreta = Math.max(xT, xTd);
            
            puntsEsquerra.push({ x: xEsq, y: y });
            puntsDreta.push({ x: xDreta, y: y });
        }

        if (puntsEsquerra.length >= 2) {
            ctx.fillStyle = 'rgba(136, 123, 250, 0.21)';
            ctx.beginPath();
            puntsEsquerra.forEach((pt, i) => {
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });
            for (let i = puntsDreta.length - 1; i >= 0; i--) {
                ctx.lineTo(puntsDreta[i].x, puntsDreta[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }

        // ── 2. Isotermes -10°C i -20°C NOMÉS ENTRE Td i T ──
        function dibuixarIsoterma(tC, color) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.3;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            let started = false;
            
            for (let p = pBot; p >= pTop; p -= 2) {
                const t = interpolarValor(perfil, p, 't');
                const td = interpolarValor(perfil, p, 'td');
                if (t === null || td === null) continue;
                
                // Només dibuixar si la isoterma està entre Td i T
                if (td < tC && tC < t) {
                    const x = xPerT(tC, p, w, h, padLeft, padRight, padTop, padBot);
                    const y = yPerP(p, h, padTop, padBot);
                    
                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                } else {
                    started = false;
                }
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        dibuixarIsoterma(-10, '#dacaf9e4');
        dibuixarIsoterma(-20, '#a879eaca');

        ctx.restore();
    }

    function bucle() {
        dibuixar();
        requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);

})();