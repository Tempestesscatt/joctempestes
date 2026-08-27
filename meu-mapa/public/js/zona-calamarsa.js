// ═══════════════════════════════════════════════════════════════════
//  ZONA DE CONGELACIÓ / CREIXEMENT DE CALAMARSA (-10°C a -20°C)
//  Dibuixa les isotermes de -10° i -20° INCLINADES (seguint l'skew,
//  igual que les isotermes de fons) i ombreja només la franja
//  vertical (en pressió) entre -10° i -20°, limitada horitzontalment
//  a la zona al voltant de les corbes T/Td (una mica abans de la
//  rosada i una mica després de la temperatura).
//  Pinta en un <canvas> propi, superposat, que no depèn dels
//  redibuixos interns de skewt.js (hover, etc.), així que mai
//  desapareix.
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

    // Valor (T o Td) interpolat del perfil a una pressió donada.
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

        // Ha de coincidir amb la geometria real del Skew-T dins skewt.js
        const hodoAmpleIdeal = Math.min(340, Math.max(230, hTotal * 0.42));
        const hodoAmple = Math.min(hodoAmpleIdeal, wTotal * 0.42);
        const skewtAmple = wTotal - hodoAmple;
        const padLeft = 42, padRight = 38, padTop = 10, padBot = 26;
        const w = skewtAmple, h = hTotal;

        const p10 = trobaPressioPerTemp(perfil, -10);
        const p20 = trobaPressioPerTemp(perfil, -20);
        if (!p10 || !p20) return;

        const pTop = Math.min(p10, p20);   // pressió més baixa (més amunt, -20°C)
        const pBot = Math.max(p10, p20);   // pressió més alta (més avall, -10°C)

        ctx.save();
        ctx.beginPath();
        ctx.rect(padLeft, padTop, w - padLeft - padRight, h - padTop - padBot);
        ctx.clip();

        // ── 1. Ombrejat de la franja, seguint EL PERFIL (no un rectangle) ──
        // Recorrem els nivells del perfil entre pTop i pBot, agafant per a
        // cada nivell un marge horitzontal: una mica abans de Td i una
        // mica després de T. Aquest polígon "flueix" amb el perfil real.
        const MARGE_T = 4;   // °C més enllà de la línia de temperatura
        const MARGE_TD = 3;  // °C abans de la línia de rosada

        const puntsDreta = []; // vora dreta del polígon (costat T, pujant en alçada)
        const puntsEsquerra = []; // vora esquerra (costat Td)

        // Nivells reals del perfil dins el rang, més els dos límits exactes
        const nivellsRang = [pBot];
        perfil.p.forEach(p => { if (p < pBot && p > pTop) nivellsRang.push(p); });
        nivellsRang.push(pTop);
        // pBot té pressió més gran -> ha d'anar primer (part baixa, més avall al gràfic)
        nivellsRang.sort((a, b) => b - a);

        nivellsRang.forEach(p => {
            const tC = interpolarValor(perfil, p, 't');
            const tdC = interpolarValor(perfil, p, 'td');
            if (tC === null || tdC === null) return;
            const y = yPerP(p, h, padTop, padBot);
            const xDreta = xPerT(tC + MARGE_T, p, w, h, padLeft, padRight, padTop, padBot);
            const xEsq = xPerT(tdC - MARGE_TD, p, w, h, padLeft, padRight, padTop, padBot);
            puntsDreta.push({ x: xDreta, y });
            puntsEsquerra.push({ x: xEsq, y });
        });

        if (puntsDreta.length >= 2) {
            ctx.fillStyle = 'rgba(180, 220, 255, 0.16)';
            ctx.beginPath();
            puntsEsquerra.forEach((pt, i) => {
                if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            });
            for (let i = puntsDreta.length - 1; i >= 0; i--) {
                ctx.lineTo(puntsDreta[i].x, puntsDreta[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }

        // ── 2. Isotermes -10°C i -20°C INCLINADES (seguint l'skew) ──
        function dibuixarIsotermaInclinada(tC, color, etiqueta) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.3;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            let started = false;
            for (let p = P_BOT; p >= P_TOP; p -= 10) {
                const x = xPerT(tC, p, w, h, padLeft, padRight, padTop, padBot);
                const y = yPerP(p, h, padTop, padBot);
                if (x < padLeft - 60 || x > w - padRight + 60) { started = false; continue; }
                if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Etiqueta al costat dret, a l'alçada on la isoterma creua el perfil
            const pCreua = tC === -10 ? p10 : p20;
            if (pCreua) {
                const y = yPerP(pCreua, h, padTop, padBot);
                ctx.fillStyle = color;
                ctx.font = '10px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(tC + '°C ' + pCreua.toFixed(0), w - padRight - 74, y - 2);
            }
        }

        dibuixarIsotermaInclinada(-10, '#4302bc00');
        dibuixarIsotermaInclinada(-20, '#7f6f95bb');

        ctx.restore();
    }

    // Redibuixem en bucle lleuger (requestAnimationFrame) mentre el
    // modal estigui obert. És econòmic i garanteix que mai
    // "desapareix", independentment de què faci skewt.js internament
    // (hover, resize, canvi de tema, etc.).
    function bucle() {
        dibuixar();
        requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);

})();