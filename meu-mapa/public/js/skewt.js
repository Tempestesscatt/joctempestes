// ═══════════════════════════════════════════════════════════════════════
//  skewt.js — Modal Skew-T complet (estil NSHARP/SHARPpy)
//  Requereix: skewt-engine.js carregat abans, i mapa.js (window.totesLesHores)
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── ESTAT ────────────────────────────────────────────────────────
    let modalCreat = false;
    let temaActual = localStorage.getItem('skewt_tema') || 'fosc'; // 'fosc' | 'clar'
    let unitatVent = 'kt'; // 'kt' | 'kmh' | 'ms'
    let perfilActual = null;
    let indexsActual = null;
    let ventActual = null;
    let puntActual = null;

const TEMES = {
    fosc: {
        fons: '#000000',
        fonsPanell: '#0a0a0a',
        grid: '#2a2a2a',
        gridForta: '#3a3a3a',
        isoterma: '#3a5a3a',
        isobara: '#4a4a4a',
        adiabaticaSeca: '#8a5a2a',
        adiabaticaHumida: '#2a6a5a',
        mescla: '#2a5a2a',
        temperatura: '#ff2020',
        rosada: '#20ff20',
        rosadaBlava: '#3090ff',
        parcela: '#ffff00',
        vent: '#ffffff',
        text: '#cfe0ee',
        textDim: '#7f9bb3',
        capeArea: 'rgba(255,60,60,0.18)',
        cinArea: 'rgba(60,120,255,0.22)',
        hodografRing: '#3a3a3a',
        hodograf0_1: '#ff3030',
        hodograf1_3: '#ffb030',
        hodograf3_6: '#30b0ff',
        hodograf6_9: '#b030ff',
        hodograf9_12: '#30ff80',
        bunkersR: '#ff40ff',
        bunkersL: '#40ffff',
    },
    clar: {
        fons: '#f4f6f8',
        fonsPanell: '#ffffff',
        grid: '#d8dee5',
        gridForta: '#b8c2cc',
        isoterma: '#a8d0a8',
        isobara: '#c0c8d0',
        adiabaticaSeca: '#e0b080',
        adiabaticaHumida: '#80c0b0',
        mescla: '#a0d0a0',
        temperatura: '#d00000',
        rosada: '#008000',
        rosadaBlava: '#2060c0',
        parcela: '#c09000',
        vent: '#202020',
        text: '#1a2632',
        textDim: '#5a6a7a',
        capeArea: 'rgba(255,60,60,0.12)',
        cinArea: 'rgba(60,120,255,0.15)',
        hodografRing: '#c0c8d0',
        hodograf0_1: '#d00000',
        hodograf1_3: '#d08000',
        hodograf3_6: '#0060c0',
        hodograf6_9: '#8000c0',
        hodograf9_12: '#00a050',
        bunkersR: '#c000c0',
        bunkersL: '#00a0a0',
    }
};

    function tema() { return TEMES[temaActual]; }

    // ─── CSS INJECTAT ────────────────────────────────────────────────────
    function injectarCSS() {
        if (document.getElementById('skewtStyles')) return;
        const css = `
        .skewt-modal-overlay {
            display: none;
            position: fixed; inset: 0; z-index: 9000;
            background: rgba(0,0,0,0.75);
            align-items: center; justify-content: center;
        }
        .skewt-modal-overlay.active { display: flex; }
        .skewt-modal {
            width: 96vw; height: 94vh;
            max-width: 1500px;
            background: var(--skewt-fons-panell, #0a0a0a);
            border: 1px solid #33475b;
            border-radius: 8px;
            display: flex; flex-direction: column;
            overflow: hidden;
            box-shadow: 0 8px 40px rgba(0,0,0,0.6);
            font-family: 'Segoe UI', Arial, sans-serif;
        }
        .skewt-modal-header {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 14px;
            background: #0a101a;
            border-bottom: 1px solid #33475b;
            flex: 0 0 auto;
        }
        .skewt-modal-header h3 {
            margin: 0; font-size: 14px; color: #cfe0ee; flex: 1;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .skewt-modal-header .skewt-loc {
            font-size: 11px; color: #7f9bb3; margin-right: 8px;
        }
        .skewt-btn {
            background: #141c2a; color: #cfe0ee; border: 1px solid #2a3a5a;
            border-radius: 4px; padding: 5px 10px; font-size: 11px; cursor: pointer;
            display: flex; align-items: center; gap: 5px; white-space: nowrap;
        }
        .skewt-btn:hover { background: #1c2838; }
        .skewt-btn.active { background: #2a5a8a; }
        .skewt-modal-close {
            background: transparent; border: none; color: #cfe0ee;
            font-size: 18px; cursor: pointer; padding: 2px 8px; line-height: 1;
        }
        .skewt-modal-close:hover { color: #ff6060; }
        .skewt-modal-body {
            flex: 1; display: flex; overflow: hidden; min-height: 0;
        }
        .skewt-col-main {
            flex: 1 1 auto; display: flex; overflow: hidden; min-width: 0;
        }
        .skewt-col-side {
            flex: 0 0 300px; display: flex; flex-direction: column;
            border-left: 1px solid #33475b; overflow-y: auto; min-width: 0;
        }
        .skewt-canvas-wrap {
            flex: 1 1 auto; position: relative; min-width: 0; overflow: hidden;
        }
        .skewt-canvas-wrap canvas { display: block; width: 100%; height: 100%; }
        .skewt-hodo-wrap {
            flex: 0 0 300px; position: relative; border-left: 1px solid #222;
        }
        .skewt-hodo-wrap canvas { display: block; width: 100%; height: 100%; }
        .skewt-table-section {
            padding: 8px 10px; border-bottom: 1px solid #222;
        }
        .skewt-table-title {
            font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
            color: #7f9bb3; text-transform: uppercase; margin-bottom: 5px;
        }
        .skewt-table {
            width: 100%; border-collapse: collapse; font-size: 11px;
        }
        .skewt-table td {
            padding: 2px 4px; color: #cfe0ee; border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .skewt-table td.lbl { color: #7f9bb3; }
        .skewt-table td.val { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
        .skewt-loading {
            display: flex; align-items: center; justify-content: center;
            height: 100%; color: #7f9bb3; font-size: 13px; flex-direction: column; gap: 10px;
        }
        .skewt-spinner {
            width: 28px; height: 28px; border: 3px solid #2a3a5a;
            border-top-color: #FFD700; border-radius: 50%;
            animation: skewt-spin 0.8s linear infinite;
        }
        @keyframes skewt-spin { to { transform: rotate(360deg); } }
        .skewt-modal.tema-clar {
            background: #ffffff;
        }
        .skewt-modal.tema-clar .skewt-modal-header { background: #eef1f4; border-color: #d0d6dc; }
        .skewt-modal.tema-clar .skewt-modal-header h3 { color: #1a2632; }
        .skewt-modal.tema-clar .skewt-loc { color: #5a6a7a; }
        .skewt-modal.tema-clar .skewt-btn { background: #eef1f4; color: #1a2632; border-color: #c0c8d0; }
        .skewt-modal.tema-clar .skewt-btn:hover { background: #e0e6ec; }
        .skewt-modal.tema-clar .skewt-modal-close { color: #1a2632; }
        .skewt-modal.tema-clar .skewt-col-side { border-color: #d0d6dc; }
        .skewt-modal.tema-clar .skewt-table-section { border-color: #e4e8ec; }
        .skewt-modal.tema-clar .skewt-table td { color: #1a2632; border-color: #eee; }
        .skewt-modal.tema-clar .skewt-table td.lbl { color: #5a6a7a; }
        .skewt-modal.tema-clar .skewt-hodo-wrap { border-color: #d0d6dc; }
        @media (max-width: 900px) {
            .skewt-modal { width: 100vw; height: 100vh; border-radius: 0; }
            .skewt-modal-body { flex-direction: column; overflow-y: auto; }
            .skewt-col-side { flex: 0 0 auto; border-left: none; border-top: 1px solid #33475b; }
            .skewt-hodo-wrap { flex: 0 0 260px; border-left: none; border-top: 1px solid #222; }
        }
        `;
        const style = document.createElement('style');
        style.id = 'skewtStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ─── CONSTRUCCIÓ DEL DOM DEL MODAL ─────────────────────────────────
    function crearModal() {
        if (modalCreat) return;
        injectarCSS();

        const overlay = document.createElement('div');
        overlay.id = 'skewtModalOverlay';
        overlay.className = 'skewt-modal-overlay';
        overlay.innerHTML = `
            <div class="skewt-modal" id="skewtModal">
                <div class="skewt-modal-header">
                    <h3><i class="fas fa-chart-line"></i> Skew-T / Log-P  powered by @Tempestes.cat/Tempest.strike</h3>
                    <span class="skewt-loc" id="skewtLocLabel">—</span>
                    <button class="skewt-btn" id="skewtBtnTema" title="Canviar tema">
                        <i class="fas fa-adjust"></i> <span id="skewtTemaLabel">Fosc</span>
                    </button>
                    <button class="skewt-btn" id="skewtBtnUnitat" title="Unitat de vent">
                        <i class="fas fa-wind"></i> <span id="skewtUnitatLabel">kt</span>
                    </button>
                    <button class="skewt-modal-close" id="skewtBtnClose">✕</button>
                </div>
                <div class="skewt-modal-body" id="skewtBody">
                    <div class="skewt-loading" id="skewtLoading">
                        <div class="skewt-spinner"></div>
                        <div>Calculant sondeig...</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        modalCreat = true;

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) tancarSkewtModal();
        });
        document.getElementById('skewtBtnClose').addEventListener('click', tancarSkewtModal);
        document.getElementById('skewtBtnTema').addEventListener('click', toggleTema);
        document.getElementById('skewtBtnUnitat').addEventListener('click', toggleUnitatVent);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('active')) tancarSkewtModal();
        });
    }

    function toggleTema() {
        temaActual = temaActual === 'fosc' ? 'clar' : 'fosc';
        localStorage.setItem('skewt_tema', temaActual);
        const modal = document.getElementById('skewtModal');
        modal.classList.toggle('tema-clar', temaActual === 'clar');
        document.getElementById('skewtTemaLabel').textContent = temaActual === 'fosc' ? 'Fosc' : 'Clar';
        redibuixarTot();
    }

    function toggleUnitatVent() {
        const ordre = ['kt', 'kmh', 'ms'];
        unitatVent = ordre[(ordre.indexOf(unitatVent) + 1) % ordre.length];
        document.getElementById('skewtUnitatLabel').textContent = unitatVent;
        redibuixarTot();
    }

    function tancarSkewtModal() {
        const overlay = document.getElementById('skewtModalOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    // ─── PUNT D'ENTRADA PRINCIPAL (cridat pel menú contextual del mapa) ──
    window.openSkewtModal = function () {
        crearModal();
        const overlay = document.getElementById('skewtModalOverlay');
        const modal = document.getElementById('skewtModal');
        modal.classList.toggle('tema-clar', temaActual === 'clar');
        document.getElementById('skewtTemaLabel').textContent = temaActual === 'fosc' ? 'Fosc' : 'Clar';
        document.getElementById('skewtUnitatLabel').textContent = unitatVent;
        overlay.classList.add('active');

        const pos = window.lastRightClickPos;
        if (!pos) {
            mostrarError('No hi ha cap punt seleccionat al mapa.');
            return;
        }

        const hourIdx = (typeof window.skewtHourIndex === 'number') ?
            window.skewtHourIndex :
            (typeof window.curIdx === 'number' ? window.curIdx : 0);

        const hores = window.totesLesHores;
        if (!hores || !hores[hourIdx]) {
            mostrarError('Encara no hi ha dades carregades per aquesta hora.');
            return;
        }

        calcularIObrirSondeig(hores[hourIdx], pos.lat, pos.lng, hourIdx);
    };

    function mostrarError(msg) {
        const body = document.getElementById('skewtBody');
        body.innerHTML = `<div class="skewt-loading"><i class="fas fa-triangle-exclamation" style="font-size:22px;color:#e0a030;"></i><div>${msg}</div></div>`;
    }

    function calcularIObrirSondeig(horaItem, lat, lon, hourIdx) {
    const E = window.SkewtEngine;
    if (!E) { mostrarError('Motor de càlcul (skewt-engine.js) no carregat.'); return; }

    const data = horaItem.data;
    
    // Comprovar si el punt està dins del domini
    const coords = data.coordenadas;
    if (!coords || !coords.lat || !coords.lon) {
        mostrarError('No hi ha dades de coordenades disponibles.');
        return;
    }
    
    const latMin = Math.min(coords.lat[0], coords.lat[coords.lat.length - 1]);
    const latMax = Math.max(coords.lat[0], coords.lat[coords.lat.length - 1]);
    const lonMin = Math.min(coords.lon[0], coords.lon[coords.lon.length - 1]);
    const lonMax = Math.max(coords.lon[0], coords.lon[coords.lon.length - 1]);
    
    if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) {
        mostrarError(
            'Fora del domini del model.\n' +
            'Lat: ' + latMin.toFixed(1) + ' a ' + latMax.toFixed(1) + '\n' +
            'Lon: ' + lonMin.toFixed(1) + ' a ' + lonMax.toFixed(1)
        );
        return;
    }
    
    const perfil = E.extreurePerfil(data, lat, lon, null);
    if (!perfil) {
        mostrarError('No hi ha prou dades de sondeig en aquest punt.\nPossiblement sobre el mar o zona sense cobertura.');
        return;
    }

    const indexs = E.calcularIndexsTermo(perfil);
    const addicionals = E.indexsAddicionals(perfil);
    const nivellsVent = perfil.p.map((p, i) => ({ z: perfil.z[i], u: perfil.u[i], v: perfil.v[i] }));
    const ventComposite = E.calcularVentComposite(nivellsVent, perfil.z[0]);

    perfilActual = perfil;
    indexsActual = Object.assign({}, indexs, addicionals);
    ventActual = ventComposite;
    puntActual = { lat, lon, hourIdx, horaItem };

    muntarLayout();
    redibuixarTot();
}

function mostrarError(msg) {
    const body = document.getElementById('skewtBody');
    body.innerHTML = `
        <div class="skewt-loading" style="flex-direction:column; gap:12px; padding:30px;">
            <div style="font-size:40px; opacity:0.6;">!</div>
            <div style="font-size:13px; color:#cfe0ee; text-align:center; line-height:1.5; white-space:pre-line;">${msg}</div>
        </div>
    `;
}

    function esFinit(v) { return v !== null && v !== undefined && !isNaN(v) && isFinite(v); }

    // ─── LAYOUT (crida les seccions 2 i 3, definides més avall al fitxer) ─
    function muntarLayout() {
        const body = document.getElementById('skewtBody');
        body.innerHTML = `
            <div class="skewt-col-main">
                <div class="skewt-canvas-wrap" id="skewtCanvasWrap">
                    <canvas id="skewtCanvas"></canvas>
                </div>
                <div class="skewt-hodo-wrap" id="skewtHodoWrap">
                    <canvas id="skewtHodoCanvas"></canvas>
                </div>
            </div>
            <div class="skewt-col-side" id="skewtSideCol"></div>
        `;

        const item = puntActual.horaItem;
        const d = item.dateObj;
        const dataStr = d.toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' });
        const horaStr = String(d.getHours()).padStart(2, '0') + ':00';
        document.getElementById('skewtLocLabel').textContent =
            puntActual.lat.toFixed(3) + '°N, ' + puntActual.lon.toFixed(3) + '°E · ' + dataStr + ' ' + horaStr;

        if (window.construirTaulaIndexsSkewt) window.construirTaulaIndexsSkewt();

        window.addEventListener('resize', onResizeSkewt);
    }

    let resizeTimeout = null;
    function onResizeSkewt() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(redibuixarTot, 120);
    }

    function redibuixarTot() {
        if (!perfilActual) return;
        if (window.dibuixarSkewtCanvas) window.dibuixarSkewtCanvas();
        if (window.dibuixarHodografCanvas) window.dibuixarHodografCanvas();
        if (window.construirTaulaIndexsSkewt) window.construirTaulaIndexsSkewt();
    }

    // ─── EXPORT INTERN (perquè les properes seccions del fitxer hi accedeixin) ─
    window._skewtInternal = {
        tema, TEMES,
        get perfilActual() { return perfilActual; },
        get indexsActual() { return indexsActual; },
        get ventActual() { return ventActual; },
        get puntActual() { return puntActual; },
        get unitatVent() { return unitatVent; },
        esFinit
    };


    // ═══════════════════════════════════════════════════════════════════
    //  SECCIÓ 2 — DIBUIX DEL SKEW-T (Canvas)
    // ═══════════════════════════════════════════════════════════════════

    // Rang del diagrama
    const P_TOP = 100;      // hPa
    const P_BOT = 1050;     // hPa
    const T_MIN = -40;      // °C (a la base, escala esbiaixada)
    const T_MAX = 60;       // °C (a la base)
    const SKEW = 45;        // graus d'esbiaixament (skew) — pendent de les isotermes

    // Projecció log-p per l'eix vertical.
    // Superfície (P_BOT, pressió alta) ha d'anar AVALL (y gran, prop de h-padBot).
    // Cim (P_TOP, pressió baixa) ha d'anar A DALT (y petit, prop de padTop).
    function yPerP(p, h, padTop, padBot) {
        const logTop = Math.log(P_TOP), logBot = Math.log(P_BOT);
        // frac=0 a la superfície (p=P_BOT), frac=1 al cim (p=P_TOP)
        const frac = (logBot - Math.log(p)) / (logBot - logTop);
        // frac=0 -> y = h-padBot (avall); frac=1 -> y = padTop (amunt)
        return (h - padBot) - frac * (h - padTop - padBot);
    }
    function pPerY(y, h, padTop, padBot) {
        const logTop = Math.log(P_TOP), logBot = Math.log(P_BOT);
        const frac = ((h - padBot) - y) / (h - padTop - padBot);
        return Math.exp(logBot - frac * (logBot - logTop));
    }

    // Projecció X esbiaixada: a cada pressió, la isoterma es desplaça cap
    // a la dreta com més amunt (menys pressió) més esbiaix.
    function xPerT(tC, p, w, h, padLeft, padRight, padTop, padBot) {
        const y = yPerP(p, h, padTop, padBot);
        const skewPerPx = Math.tan(SKEW * Math.PI / 180);
        const yBase = yPerP(P_BOT, h, padTop, padBot);
        const dxSkew = (yBase - y) * skewPerPx;
        const fracT = (tC - T_MIN) / (T_MAX - T_MIN);
        const xBase = padLeft + fracT * (w - padLeft - padRight);
        return xBase + dxSkew;
    }
    // Invers aproximat: dada una x,y retorna la T equivalent (per hover futura)
    function tPerXY(x, y, w, h, padLeft, padRight, padTop, padBot) {
        const skewPerPx = Math.tan(SKEW * Math.PI / 180);
        const yBase = yPerP(P_BOT, h, padTop, padBot);
        const dxSkew = (yBase - y) * skewPerPx;
        const xBase = x - dxSkew;
        const fracT = (xBase - padLeft) / (w - padLeft - padRight);
        return T_MIN + fracT * (T_MAX - T_MIN);
    }

    function dibuixarSkewtCanvas() {
        const wrap = document.getElementById('skewtCanvasWrap');
        const canvas = document.getElementById('skewtCanvas');
        if (!wrap || !canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const w = wrap.clientWidth, h = wrap.clientHeight;
        canvas.width = w * dpr; canvas.height = h * dpr;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const T = tema();
        ctx.fillStyle = T.fons;
        ctx.fillRect(0, 0, w, h);

        const padLeft = 42, padRight = 18, padTop = 10, padBot = 26;
        const proj = {
            x: (tC, p) => xPerT(tC, p, w, h, padLeft, padRight, padTop, padBot),
            y: (p) => yPerP(p, h, padTop, padBot)
        };

        dibuixarGraella(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj);
        dibuixarAreesCapeCin(ctx, T, proj);
        dibuixarLiniesEstat(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj);
        dibuixarNivellsClau(ctx, w, padRight, T, proj);
        dibuixarBarbesVent(ctx, w, padRight, T, proj);
        dibuixarEtiquetesEix(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj);
    }
    window.dibuixarSkewtCanvas = dibuixarSkewtCanvas;

    // ─── GRAELLA DE FONS: isobares, isotermes, adiabàtiques, mescla ────
    function dibuixarGraella(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(padLeft, padTop, w - padLeft - padRight, h - padTop - padBot);
        ctx.clip();

        // Isobares horitzontals (cada 100 hPa, més fortes a 1000/850/700/500/300)
        const isobares = [1000, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100];
        isobares.forEach(p => {
            const y = proj.y(p);
            ctx.strokeStyle = [1000, 850, 700, 500, 300].includes(p) ? T.gridForta : T.isobara;
            ctx.lineWidth = [1000, 850, 700, 500, 300].includes(p) ? 1 : 0.6;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(w - padRight, y);
            ctx.stroke();
        });

        // Isotermes esbiaixades (cada 10°C)
        ctx.strokeStyle = T.isoterma;
        ctx.lineWidth = 0.7;
        for (let tC = -100; tC <= 50; tC += 10) {
            ctx.beginPath();
            let started = false;
            for (let p = P_BOT; p >= P_TOP; p -= 10) {
                const x = proj.x(tC, p);
                const y = proj.y(p);
                if (x < padLeft - 60 || x > w - padRight + 60) { started = false; continue; }
                if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
            }
            ctx.stroke();
        }

        // Isoterma dels 0°C destacada
        ctx.strokeStyle = T.hodograf3_6 || '#3090ff';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        let started0 = false;
        for (let p = P_BOT; p >= P_TOP; p -= 10) {
            const x = proj.x(0, p), y = proj.y(p);
            if (!started0) { ctx.moveTo(x, y); started0 = true; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Adiabàtiques seques (des de base a diverses temperatures potencials)
        ctx.strokeStyle = T.adiabaticaSeca;
        ctx.lineWidth = 0.6;
        const RD_CP = 287.05 / 1004.6;
        for (let tPot = -30; tPot <= 200; tPot += 10) {
            ctx.beginPath();
            let started2 = false;
            for (let p = P_BOT; p >= P_TOP; p -= 15) {
                const tK = (tPot + 273.15) * Math.pow(p / 1000, RD_CP);
                const tC = tK - 273.15;
                const x = proj.x(tC, p), y = proj.y(p);
                if (x < padLeft - 100 || x > w - padRight + 100) { started2 = false; continue; }
                if (!started2) { ctx.moveTo(x, y); started2 = true; } else { ctx.lineTo(x, y); }
            }
            ctx.stroke();
        }

        // Adiabàtiques humides (pseudoadiabàtiques) aproximades
        ctx.strokeStyle = T.adiabaticaHumida;
        ctx.lineWidth = 0.6;
        const E = window.SkewtEngine;
        for (let tStart = -20; tStart <= 32; tStart += 4) {
            ctx.beginPath();
            let started3 = false;
            let p = 1000, t = tStart;
            for (; p >= P_TOP; p -= 15) {
                if (p < 1000) {
                    const gamma = E.gradientHumit(t, p + 7.5);
                    t = t - gamma * 15;
                }
                const x = proj.x(t, p), y = proj.y(p);
                if (x < padLeft - 100 || x > w - padRight + 100) { started3 = false; continue; }
                if (!started3) { ctx.moveTo(x, y); started3 = true; } else { ctx.lineTo(x, y); }
            }
            ctx.stroke();
        }

        // Línies de ràtio de mescla (mescla constant, discontínues, subtils)
        ctx.strokeStyle = T.mescla;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        [1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32].forEach(wg => {
            ctx.beginPath();
            let started4 = false;
            for (let p = P_BOT; p >= 400; p -= 20) {
                // w = eps*e/(p-e) → resoldre e, després Td des de e (aprox amb T de mescla)
                const wKg = wg / 1000;
                const e = (wKg * p) / (0.6219707 + wKg);
                const tC = (243.5 * Math.log(e / 6.112)) / (17.67 - Math.log(e / 6.112));
                const x = proj.x(tC, p), y = proj.y(p);
                if (x < padLeft - 40 || x > w - padRight + 40) { started4 = false; continue; }
                if (!started4) { ctx.moveTo(x, y); started4 = true; } else { ctx.lineTo(x, y); }
            }
            ctx.stroke();
        });
        ctx.setLineDash([]);

        ctx.restore();

        // Marc
        ctx.strokeStyle = T.gridForta;
        ctx.lineWidth = 1;
        ctx.strokeRect(padLeft, padTop, w - padLeft - padRight, h - padTop - padBot);
    }

    // ─── LÍNIA DE TEMPERATURA/PARCEL·LA (traçada per calcularIndexsTermo) ─
    function dibuixarLiniesEstat(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj) {
        const perfil = perfilActual, idx = indexsActual;
        if (!perfil) return;

        // Línia de la parcel·la (groga), des del LCL cap amunt
        if (idx && idx.tParcela) {
            ctx.strokeStyle = T.parcela;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < perfil.p.length; i++) {
                const tp = idx.tParcela[i];
                if (tp === null) continue;
                const x = proj.x(tp, perfil.p[i]), y = proj.y(perfil.p[i]);
                if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
            }
            ctx.stroke();
        }

        // Punt de rosada (verda)
        ctx.strokeStyle = T.rosada;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        perfil.p.forEach((p, i) => {
            const x = proj.x(perfil.td[i], p), y = proj.y(p);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Temperatura (vermella)
        ctx.strokeStyle = T.temperatura;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        perfil.p.forEach((p, i) => {
            const x = proj.x(perfil.t[i], p), y = proj.y(p);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }


    // ─── LÍNIA MIXED LAYER (ML) ──────────────────────────────────────
function dibuixarLiniesEstat(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj) {
    const perfil = perfilActual, idx = indexsActual;
    if (!perfil) return;

    // Línia de la parcel·la (groga), des del LCL cap amunt
    if (idx && idx.tParcela) {
        ctx.strokeStyle = T.parcela;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < perfil.p.length; i++) {
            const tp = idx.tParcela[i];
            if (tp === null) continue;
            const x = proj.x(tp, perfil.p[i]), y = proj.y(perfil.p[i]);
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
    }
    
    // ─── NOU: Mixed Layer (ML) - línia taronja discontínua ────────
    const E = window.SkewtEngine;
    if (E && E.perfilMixedLayer) {
        const ml = E.perfilMixedLayer(perfil, 100);
        if (ml && ml.valors) {
            ctx.strokeStyle = '#ff8c00'; // Taronja
            ctx.lineWidth = 1.4;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            let startedML = false;
            for (let i = 0; i < perfil.p.length; i++) {
                const tp = ml.valors[i];
                if (tp === null) continue;
                const x = proj.x(tp, perfil.p[i]), y = proj.y(perfil.p[i]);
                if (!startedML) { ctx.moveTo(x, y); startedML = true; }
                else { ctx.lineTo(x, y); }
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // Punt de rosada (blava)
    ctx.strokeStyle = T.rosadaBlava || '#3090ff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    perfil.p.forEach((p, i) => {
        const x = proj.x(perfil.td[i], p), y = proj.y(p);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Temperatura (vermella)
    ctx.strokeStyle = T.temperatura;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    perfil.p.forEach((p, i) => {
        const x = proj.x(perfil.t[i], p), y = proj.y(p);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

    // ─── ÀREES CAPE (vermell, entre LFC i EL) i CIN (blau, sota LFC) ────
    function dibuixarAreesCapeCin(ctx, T, proj) {
        const perfil = perfilActual, idx = indexsActual;
        if (!perfil || !idx || !idx.tParcela) return;

        function areaEntre(pIni, pFi, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            let first = true;
            for (let i = 0; i < perfil.p.length; i++) {
                const p = perfil.p[i];
                if (p > pIni || p < pFi) continue;
                const tp = idx.tParcela[i];
                if (tp === null) continue;
                const x = proj.x(tp, p), y = proj.y(p);
                if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
            }
            for (let i = perfil.p.length - 1; i >= 0; i--) {
                const p = perfil.p[i];
                if (p > pIni || p < pFi) continue;
                const x = proj.x(perfil.t[i], p), y = proj.y(p);
                ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        }

        if (idx.lfc_p && idx.el_p) {
            areaEntre(idx.lfc_p, idx.el_p, T.capeArea);
        }
        if (idx.lfc_p) {
            areaEntre(perfil.p[0], idx.lfc_p, T.cinArea);
        }
    }


    // ═══════════════════════════════════════════════════════════════════════
//  SECCIÓ 2 — DIBUIX DEL SKEW-T (Canvas) - MODIFICACIONES
// ═══════════════════════════════════════════════════════════════════════

// Añadir esta nueva función después de dibuixarAreesCapeCin
function dibuixarTerreny(ctx, T, proj) {
    const perfil = perfilActual;
    if (!perfil || !perfil.p || perfil.p.length === 0) return;
    
    const pSurface = perfil.p[0]; // Presión en superficie (primer punto del sondeo)
    
    // Si la presión de superficie es la máxima del rango, no hay terreno que pintar
    if (pSurface >= P_BOT) return;
    
    // Área verde bajo la superficie
    ctx.fillStyle = 'rgba(34, 139, 34, 0.3)'; // Verde semi-transparente
    ctx.beginPath();
    
    // Borde izquierdo del área de dibujo
    const ySurface = proj.y(pSurface);
    const yBottom = proj.y(P_BOT);
    
    // Dibujar rectángulo desde la superficie hasta abajo
    ctx.moveTo(42, ySurface); // padLeft
    ctx.lineTo(42, yBottom);
    
    // Línea inferior (P_BOT)
    const w = ctx.canvas.width / (window.devicePixelRatio || 1);
    const padRight = 18;
    ctx.lineTo(w - padRight, yBottom);
    ctx.lineTo(w - padRight, ySurface);
    
    ctx.closePath();
    ctx.fill();
    
    // Línea de superficie más destacada
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(42, ySurface);
    ctx.lineTo(w - padRight, ySurface);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Etiqueta de elevación
    ctx.fillStyle = '#228B22';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'right';
    const elevation = perfil.z[0]; // Altura del terreno en metros
    ctx.fillText(` ${elevation.toFixed(0)}m`, w - padRight - 10, ySurface - 5);
}

// Modificar dibuixarLiniesEstat para que empiece desde la superficie
function dibuixarLiniesEstat(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj) {
    const perfil = perfilActual, idx = indexsActual;
    if (!perfil) return;

    // Línea de la parcel·la (groga), des del LCL cap amunt
    if (idx && idx.tParcela) {
        ctx.strokeStyle = T.parcela;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < perfil.p.length; i++) {
            const tp = idx.tParcela[i];
            if (tp === null) continue;
            const x = proj.x(tp, perfil.p[i]), y = proj.y(perfil.p[i]);
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
    }

    // Punt de rosada (verda)
    ctx.strokeStyle = T.rosada;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    perfil.p.forEach((p, i) => {
        const x = proj.x(perfil.td[i], p), y = proj.y(p);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Temperatura (vermella)
    ctx.strokeStyle = T.temperatura;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    perfil.p.forEach((p, i) => {
        const x = proj.x(perfil.t[i], p), y = proj.y(p);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

// Modificar dibuixarAreesCapeCin para que empiece desde superficie
function dibuixarAreesCapeCin(ctx, T, proj) {
    const perfil = perfilActual, idx = indexsActual;
    if (!perfil || !idx || !idx.tParcela) return;

    function areaEntre(pIni, pFi, color) {
        // Asegurar que empezamos desde la presión de superficie como mínimo
        const pStart = Math.min(pIni, perfil.p[0]);
        const pEnd = Math.max(pFi, 100); // No ir más arriba de 100 hPa
        
        ctx.fillStyle = color;
        ctx.beginPath();
        let first = true;
        for (let i = 0; i < perfil.p.length; i++) {
            const p = perfil.p[i];
            if (p > pStart || p < pEnd) continue;
            const tp = idx.tParcela[i];
            if (tp === null) continue;
            const x = proj.x(tp, p), y = proj.y(p);
            if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
        }
        for (let i = perfil.p.length - 1; i >= 0; i--) {
            const p = perfil.p[i];
            if (p > pStart || p < pEnd) continue;
            const x = proj.x(perfil.t[i], p), y = proj.y(p);
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }

    if (idx.lfc_p && idx.el_p) {
        areaEntre(idx.lfc_p, idx.el_p, T.capeArea);
    }
    if (idx.lfc_p) {
        areaEntre(perfil.p[0], idx.lfc_p, T.cinArea);
    }
}

function dibuixarSkewtCanvas() {
    const wrap = document.getElementById('skewtCanvasWrap');
    const canvas = document.getElementById('skewtCanvas');
    if (!wrap || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const T = tema();
    ctx.fillStyle = T.fons;
    ctx.fillRect(0, 0, w, h);

    const padLeft = 42, padRight = 18, padTop = 10, padBot = 26;
    const proj = {
        x: (tC, p) => xPerT(tC, p, w, h, padLeft, padRight, padTop, padBot),
        y: (p) => yPerP(p, h, padTop, padBot)
    };

    dibuixarGraella(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj);
    dibuixarTerreny(ctx, T, proj);
    dibuixarAreesCapeCin(ctx, T, proj);
    dibuixarLiniesEstat(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj);
    dibuixarNivellsClau(ctx, w, padRight, T, proj);
    dibuixarBarbesVent(ctx, w, padRight, T, proj);
    dibuixarEtiquetesEix(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj);

    // ─── TOOLTIP INTERACTIU ────────────────────────────────────────
    
    if (canvas._skewtMouseMove) canvas.removeEventListener('mousemove', canvas._skewtMouseMove);
    if (canvas._skewtMouseLeave) canvas.removeEventListener('mouseleave', canvas._skewtMouseLeave);
    
    let tooltip = document.getElementById('skewtTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'skewtTooltip';
        tooltip.style.cssText = `
            position:absolute; background:rgba(10,16,26,0.95); border:1px solid #556;
            border-radius:4px; padding:5px 8px; font-family:'Segoe UI',Arial,sans-serif;
            font-size:10px; color:#cde; pointer-events:none; z-index:1000; display:none;
            white-space:nowrap; line-height:1.5; box-shadow:0 2px 8px rgba(0,0,0,0.5);
        `;
        wrap.appendChild(tooltip);
    }
    
    let currentMouseY = null;
    const colorT = T.temperatura;
    const colorTd = T.rosadaBlava || '#3090ff';
    
    function fmtVent(mps) {
        const f = unitatVent === 'kt' ? 1.94384 : (unitatVent === 'kmh' ? 3.6 : 1);
        return (mps * f).toFixed(0) + ' ' + unitatVent;
    }
    
function dirVent(u, v) {
    let d = Math.atan2(-u, -v) * 180 / Math.PI;
    if (d < 0) d += 360;
    const sec = ['Nord', 'Nord-est', 'Est', 'Sud-est', 'Sud', 'Sud-oest', 'Oest', 'Nord-oest'];
    const index = Math.round(d / 45) % 8;
    return sec[index] + ' ' + d.toFixed(0) + '°';
}
    
    function calcHR(tC, tdC) {
        const es = 6.112 * Math.exp((17.67 * tC) / (tC + 243.5));
        const e = 6.112 * Math.exp((17.67 * tdC) / (tdC + 243.5));
        return Math.min(100, Math.max(0, (e / es) * 100));
    }
    
    function calcLI(pNiv, tAmb) {
        const pf = perfilActual;
        if (!pf || pNiv >= pf.p[0]) return null;
        const E = window.SkewtEngine;
        if (!E) return null;
        const tp = E.perfilParcela(pf.t[0], pf.td[0], pf.p[0], [pNiv]);
        return (tp && tp.valors[0] !== null) ? tAmb - tp.valors[0] : null;
    }
    
    function redrawWithLine(my) {
        if (my === null) { dibuixarSkewtCanvas(); return; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = T.fons; ctx.fillRect(0, 0, w, h);
        dibuixarGraella(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj);
        dibuixarTerreny(ctx, T, proj);
        dibuixarAreesCapeCin(ctx, T, proj);
        dibuixarLiniesEstat(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj);
        dibuixarNivellsClau(ctx, w, padRight, T, proj);
        dibuixarBarbesVent(ctx, w, padRight, T, proj);
        dibuixarEtiquetesEix(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(padLeft, my); ctx.lineTo(w - padRight, my); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(padLeft - 2, my, 2.5, 0, 2 * Math.PI); ctx.fill();
    }
    
    canvas._skewtMouseMove = function(e) {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        
        if (mx < padLeft - 8 || mx > w - padRight + 8 || my < padTop || my > h - padBot) {
            tooltip.style.display = 'none';
            if (currentMouseY !== null) { currentMouseY = null; redrawWithLine(null); }
            return;
        }
        
        if (currentMouseY !== my) { currentMouseY = my; redrawWithLine(my); }
        
        const p = pPerY(my, h, padTop, padBot);
        const pf = perfilActual;
        if (!pf) { tooltip.style.display = 'none'; return; }
        
        let bi = 0, bd = Infinity;
        for (let i = 0; i < pf.p.length; i++) {
            const d = Math.abs(pf.p[i] - p);
            if (d < bd) { bd = d; bi = i; }
        }
        if (bd > 25) { tooltip.style.display = 'none'; return; }
        
        const tC = pf.t[bi], tdC = pf.td[bi], pN = pf.p[bi], zM = pf.z[bi];
        const u = pf.u[bi], v = pf.v[bi];
        const spd = Math.sqrt(u * u + v * v);
        const hr = calcHR(tC, tdC);
        const li = calcLI(pN, tC);
        
        let liTxt = '--', liClr = '#888';
        if (li !== null && isFinite(li)) {
            liTxt = li.toFixed(1);
            liClr = li < -6 ? '#f44' : li < -3 ? '#f84' : li < 0 ? '#fb4' : li < 3 ? '#8cf' : '#48f';
        }
        
        let hrClr = hr < 30 ? '#f84' : hr < 50 ? '#fb4' : hr < 70 ? '#8cf' : hr < 90 ? '#48f' : '#28f';
        
        tooltip.innerHTML = `
            <div style="font-weight:600;color:#fff;margin-bottom:2px;">${pN.toFixed(0)} hPa &middot; ${zM.toFixed(0)} m</div>
            <span style="color:${colorT};">T ${tC.toFixed(1)}°C</span>
            <span style="color:${colorTd};margin-left:10px;">Td ${tdC.toFixed(1)}°C</span>
            <span style="color:${hrClr};margin-left:10px;">${hr.toFixed(0)}%</span><br>
            <span style="color:#bbb;">${fmtVent(spd)} ${dirVent(u, v)}</span>
            <span style="color:${liClr};margin-left:8px;">LI ${liTxt}</span>
        `;
        
        const wr = wrap.getBoundingClientRect();
        let tx = e.clientX - wr.left + 14, ty = e.clientY - wr.top - 36;
        const tw = 210, th = 50;
        if (tx + tw > w) tx = e.clientX - wr.left - tw - 14;
        if (tx < 4) tx = 4;
        if (ty < 2) ty = e.clientY - wr.top + 14;
        if (ty + th > h) ty = h - th - 4;
        
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
        tooltip.style.display = 'block';
    };
    
    canvas._skewtMouseLeave = function() {
        tooltip.style.display = 'none';
        if (currentMouseY !== null) { currentMouseY = null; redrawWithLine(null); }
    };
    
    canvas.addEventListener('mousemove', canvas._skewtMouseMove);
    canvas.addEventListener('mouseleave', canvas._skewtMouseLeave);
}

    // ─── ETIQUETES DE NIVELLS CLAU (LCL, LFC, EL, 0°C) ──────────────────
    function dibuixarNivellsClau(ctx, w, padRight, T, proj) {
        const idx = indexsActual, perfil = perfilActual;
        if (!idx || !perfil) return;
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';

        function marca(pHpa, text, color) {
            if (!pHpa) return;
            const y = proj.y(pHpa);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(w, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = color;
            ctx.fillText(text, w - padRight - 74, y - 2);
        }

        marca(idx.lcl_p, 'LCL ' + idx.lcl_p.toFixed(0), '#40c0ff');
        marca(idx.lfc_p, 'LFC ' + (idx.lfc_p ? idx.lfc_p.toFixed(0) : ''), '#ff9040');
        marca(idx.el_p, 'EL ' + (idx.el_p ? idx.el_p.toFixed(0) : ''), '#c060ff');

        // Nivell de congelació (0°C) — cerquem el primer nivell on t creua 0
        for (let i = 1; i < perfil.p.length; i++) {
            if ((perfil.t[i - 1] >= 0) !== (perfil.t[i] >= 0)) {
                const frac = perfil.t[i - 1] / (perfil.t[i - 1] - perfil.t[i]);
                const pCross = perfil.p[i - 1] + frac * (perfil.p[i] - perfil.p[i - 1]);
                marca(pCross, '0°C ' + pCross.toFixed(0), '#3090ff');
                break;
            }
        }
    }

    // ─── BARBES DE VENT (columna lateral dreta del diagrama) ───────────
    function dibuixarBarbesVent(ctx, w, padRight, T, proj) {
        const perfil = perfilActual;
        if (!perfil) return;
        const xBarb = w - padRight - 24;

        // Mostregem cada ~50hPa per no saturar
        const mostrats = [];
        let lastP = Infinity;
        perfil.p.forEach((p, i) => {
            if (lastP - p >= 45 || i === 0) {
                mostrats.push(i);
                lastP = p;
            }
        });

        mostrats.forEach(i => {
            const p = perfil.p[i];
            const y = proj.y(p);
            const uKt = perfil.u[i] * 1.94384;
            const vKt = perfil.v[i] * 1.94384;
            dibuixarBarba(ctx, xBarb, y, uKt, vKt, T.vent);
        });
    }

    // (u, v) és el vector cap on VA l'aire (component Est, component Nord).
    // Una barba de vent es dibuixa com una asta que apunta cap a la direcció
    // D'ON VE el vent (és a dir, cap a -(u, v)), amb les banderetes penjant
    // cap a la dreta de l'asta (mirant des del punt de dades cap enfora).
    //
    // L'asta es construeix per defecte apuntant "cap amunt" en l'espai local
    // (0,0) → (0,-shaftLen), amb les banderes cap a +X (dreta). En canvas,
    // ctx.rotate(θ) gira aquest sistema θ radians en sentit horari des de
    // l'eix +X. Per tant, si volem que un vent del Nord pur (u=0, v=-spd,
    // "d'on ve" = Nord = amunt) quedi amb l'asta apuntant amunt sense girar
    // (θ=0), l'angle de rotació ha de ser exactament la direcció compàs
    // (horari des del Nord) d'on ve el vent: atan2(-u, -v).
    function dibuixarBarba(ctx, x, y, uKt, vKt, color) {
        const spd = Math.sqrt(uKt * uKt + vKt * vKt);
        if (spd < 1) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.stroke();
            return;
        }
        // Angle de rotació = direcció compàs (horari des de N) d'on ve el vent.
        const drawAngle = Math.atan2(-uKt, -vKt);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(drawAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;

        const shaftLen = 22;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -shaftLen);
        ctx.stroke();

        let restant = spd;
        let pos = -shaftLen;
        const pasBarbaLlarga = 10; // 10kt
        const pasBarbaCurta = 5;   // 5kt
        const pasTriangle = 50;    // 50kt

        while (restant >= pasTriangle) {
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(8, pos + 4);
            ctx.lineTo(0, pos + 8);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            pos += 8;
            restant -= pasTriangle;
        }
        while (restant >= pasBarbaLlarga) {
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(9, pos - 3);
            ctx.stroke();
            pos += 4;
            restant -= pasBarbaLlarga;
        }
        if (restant >= pasBarbaCurta) {
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(5, pos - 1.5);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ─── ETIQUETES D'EIXOS ──────────────────────────────────────────────
    function dibuixarEtiquetesEix(ctx, w, h, padLeft, padRight, padTop, padBot, T, proj) {
        ctx.fillStyle = T.text;
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        [1000, 900, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100].forEach(p => {
            const y = proj.y(p);
            ctx.fillText(String(p), padLeft - 4, y + 3);
        });
        ctx.textAlign = 'center';
        ctx.fillStyle = T.textDim;
        ctx.font = '9px Arial';
        for (let tC = -60; tC <= 70; tC += 10) {
            const x = proj.x(tC, P_BOT);
            ctx.fillText(tC + '°', x, h - padBot + 14);
        }
    }

function dibuixarHodografCanvas() {
    const wrap = document.getElementById('skewtHodoWrap');
    const canvas = document.getElementById('skewtHodoCanvas');
    if (!wrap || !canvas || !ventActual) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const T = tema();
    ctx.fillStyle = T.fons;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const niv = ventActual.niv;
    const factor = unitatVent === 'kt' ? 1.94384 : (unitatVent === 'kmh' ? 3.6 : 1);

    // Escala
    let maxSpd = 10;
    niv.forEach(n => {
        const s = Math.sqrt(n.u * n.u + n.v * n.v) * factor;
        if (s > maxSpd) maxSpd = s;
    });
    maxSpd = Math.ceil(maxSpd / 10) * 10 + 10;
    const pxPerUnit = (Math.min(w, h) / 2 - 40) / maxSpd;

    // Anells concentrics
    for (let r = 10; r <= maxSpd; r += 10) {
        ctx.strokeStyle = T.hodografRing;
        ctx.lineWidth = (r % 50 === 0) ? 0.8 : 0.4;
        ctx.beginPath();
        ctx.arc(cx, cy, r * pxPerUnit, 0, Math.PI * 2);
        ctx.stroke();
        if (r % 20 === 0) {
            ctx.fillStyle = T.textDim;
            ctx.font = '8px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(r, cx + 3, cy - r * pxPerUnit - 2);
        }
    }

    // Eixos N-S, E-W
    ctx.strokeStyle = T.gridForta;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - maxSpd * pxPerUnit - 8, cy);
    ctx.lineTo(cx + maxSpd * pxPerUnit + 8, cy);
    ctx.moveTo(cx, cy - maxSpd * pxPerUnit - 8);
    ctx.lineTo(cx, cy + maxSpd * pxPerUnit + 8);
    ctx.stroke();

    // Cardinals
    ctx.fillStyle = T.textDim;
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - maxSpd * pxPerUnit - 12);
    ctx.fillText('S', cx, cy + maxSpd * pxPerUnit + 18);
    ctx.fillText('E', cx + maxSpd * pxPerUnit + 16, cy + 4);
    ctx.fillText('W', cx - maxSpd * pxPerUnit - 16, cy + 4);

    // Funció per convertir (u,v) a coordenades canvas
    function pt(u, v) {
        return { x: cx + u * factor * pxPerUnit, y: cy - v * factor * pxPerUnit };
    }

    // Trams de colors
    const trams = [
        { min: 0, max: 1000, color: T.hodograf0_1 },
        { min: 1000, max: 3000, color: T.hodograf1_3 },
        { min: 3000, max: 6000, color: T.hodograf3_6 },
        { min: 6000, max: 9000, color: T.hodograf6_9 },
        { min: 9000, max: 12000, color: T.hodograf9_12 }
    ];

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Dibuixar cada tram
    trams.forEach(tram => {
        const puntsTram = [];
        
        // Recollir punts dins del tram (incloent el punt anterior al inici per continuïtat)
        for (let i = 0; i < niv.length; i++) {
            if (niv[i].z >= tram.min && niv[i].z <= tram.max) {
                if (puntsTram.length === 0 && i > 0) {
                    puntsTram.push(niv[i - 1]);
                }
                puntsTram.push(niv[i]);
            }
        }

        if (puntsTram.length < 2) return;

        ctx.strokeStyle = tram.color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();

        // Primer punt
        const p0 = pt(puntsTram[0].u, puntsTram[0].v);
        ctx.moveTo(p0.x, p0.y);

        // Dibuixar amb espaiat variable segons velocitat
        for (let i = 1; i < puntsTram.length; i++) {
            const n0 = puntsTram[i - 1];
            const n1 = puntsTram[i];
            
            const spd0 = Math.sqrt(n0.u * n0.u + n0.v * n0.v) * factor;
            const spd1 = Math.sqrt(n1.u * n1.u + n1.v * n1.v) * factor;
            const spdMitjana = (spd0 + spd1) / 2;
            
            const nPassos = Math.max(1, Math.floor(spdMitjana / 5));
            
            for (let k = 1; k <= nPassos; k++) {
                const frac = k / nPassos;
                const u = n0.u + (n1.u - n0.u) * frac;
                const v = n0.v + (n1.v - n0.v) * frac;
                const p = pt(u, v);
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.stroke();
    });

    // Storm motion (Bunkers)
    if (ventActual.bunkers) {
        // Right-mover
        if (ventActual.bunkers.right) {
            const pr = pt(ventActual.bunkers.right.u, ventActual.bunkers.right.v);
            ctx.fillStyle = T.bunkersR;
            ctx.beginPath();
            ctx.arc(pr.x, pr.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = T.text;
            ctx.font = '9px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('RM', pr.x + 7, pr.y + 3);
        }
        
        // Left-mover
        if (ventActual.bunkers.left) {
            const pl = pt(ventActual.bunkers.left.u, ventActual.bunkers.left.v);
            ctx.fillStyle = T.bunkersL;
            ctx.beginPath();
            ctx.arc(pl.x, pl.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = T.text;
            ctx.font = '9px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('LM', pl.x + 7, pl.y + 3);
        }
    }

    // Llegenda de trams
    ctx.font = '8px Arial';
    let llegendaY = h - 60;
    
    const tramsLlegenda = [
        { label: '0-1 km', color: T.hodograf0_1 },
        { label: '1-3 km', color: T.hodograf1_3 },
        { label: '3-6 km', color: T.hodograf3_6 },
        { label: '6-9 km', color: T.hodograf6_9 },
        { label: '9-12 km', color: T.hodograf9_12 }
    ];
    
    tramsLlegenda.forEach(tram => {
        ctx.fillStyle = tram.color;
        ctx.fillRect(10, llegendaY - 4, 14, 5);
        ctx.fillStyle = T.textDim;
        ctx.textAlign = 'left';
        ctx.fillText(tram.label, 28, llegendaY);
        llegendaY += 12;
    });

    // Títol
    ctx.fillStyle = T.textDim;
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Hodograf (' + unitatVent + ')', 10, 16);
}
window.dibuixarHodografCanvas = dibuixarHodografCanvas;

    // ─── TAULA D'ÍNDEXS ──────────────────────────────────────────────────

    function fmt(v, dec, unitat) {
        if (v === null || v === undefined || isNaN(v)) return '—';
        return v.toFixed(dec !== undefined ? dec : 0) + (unitat || '');
    }

    function colorPerCape(cape) {
        if (cape === null || cape === undefined) return null;
        if (cape < 300) return '#7f9bb3';
        if (cape < 1000) return '#e0d040';
        if (cape < 2500) return '#e08030';
        return '#e03030';
    }

    function convertirVent(mps) {
        const factor = unitatVent === 'kt' ? 1.94384 : (unitatVent === 'kmh' ? 3.6 : 1);
        return mps * factor;
    }

    function construirTaulaIndexsSkewt() {
        const side = document.getElementById('skewtSideCol');
        if (!side || !indexsActual) return;
        const idx = indexsActual;
        const vent = ventActual;

        function fila(label, valor, color) {
            return `<tr><td class="lbl">${label}</td><td class="val"${color ? ' style="color:' + color + '"' : ''}>${valor}</td></tr>`;
        }

        let html = '';

        // ── Termodinàmica ──
        html += `<div class="skewt-table-section"><div class="skewt-table-title">Termodinàmica</div><table class="skewt-table">`;
        html += fila('CAPE', fmt(idx.cape, 0, ' J/kg'), colorPerCape(idx.cape));
        html += fila('CIN', fmt(idx.cin, 0, ' J/kg'), idx.cin < -100 ? '#4090ff' : null);
        html += fila('LI', fmt(idx.li, 1), idx.li !== null && idx.li < -4 ? '#e03030' : null);
        html += fila('Showalter', fmt(idx.showalter, 1));
        html += fila('K-Index', fmt(idx.kIndex, 0));
        html += fila('Totals Totals', fmt(idx.totalsTotals, 0));
        html += `</table></div>`;

        // ── Nivells clau ──
        html += `<div class="skewt-table-section"><div class="skewt-table-title">Nivells</div><table class="skewt-table">`;
        html += fila('LCL', fmt(idx.lcl_p, 0, ' hPa') + ' · ' + fmt(idx.lcl_z, 0, ' m'));
        html += fila('LFC', idx.lfc_p ? fmt(idx.lfc_p, 0, ' hPa') + ' · ' + fmt(idx.lfc_z, 0, ' m') : '—');
        html += fila('EL', idx.el_p ? fmt(idx.el_p, 0, ' hPa') + ' · ' + fmt(idx.el_z, 0, ' m') : '—');
        html += `</table></div>`;

        // ── Vent / cisallament ──
        if (vent) {
            html += `<div class="skewt-table-section"><div class="skewt-table-title">Cisallament (Bulk Shear)</div><table class="skewt-table">`;
            html += fila('0–1 km', fmt(convertirVent(vent.shear01), 0, ' ' + unitatVent));
            html += fila('0–3 km', fmt(convertirVent(vent.shear03), 0, ' ' + unitatVent));
            html += fila('0–6 km', fmt(convertirVent(vent.shear06), 0, ' ' + unitatVent), vent.shear06 > 20 ? '#e08030' : null);
            html += fila('0–8 km', fmt(convertirVent(vent.shear08), 0, ' ' + unitatVent));
            html += `</table></div>`;

            html += `<div class="skewt-table-section"><div class="skewt-table-title">Helicitat (SRH)</div><table class="skewt-table">`;
            html += fila('0–1 km', fmt(vent.srh01, 0, ' m²/s²'), Math.abs(vent.srh01) > 150 ? '#e03030' : null);
            html += fila('0–3 km', fmt(vent.srh03, 0, ' m²/s²'), Math.abs(vent.srh03) > 250 ? '#e03030' : null);
            html += `</table></div>`;

            html += `<div class="skewt-table-section"><div class="skewt-table-title">Moviment de la tempesta</div><table class="skewt-table">`;
            const rmSpd = Math.sqrt(vent.bunkers.right.u ** 2 + vent.bunkers.right.v ** 2);
            const lmSpd = Math.sqrt(vent.bunkers.left.u ** 2 + vent.bunkers.left.v ** 2);
            html += fila('Right-mover (RM)', fmt(convertirVent(rmSpd), 0, ' ' + unitatVent));
            html += fila('Left-mover (LM)', fmt(convertirVent(lmSpd), 0, ' ' + unitatVent));
            html += `</table></div>`;

            // ── Índexs compostos derivats (STP simplificat, EHI) ──
            const cape = idx.cape || 0;
            const srh01 = vent.srh01 || 0;
            const shear06Kt = convertirVentAKt(vent.shear06);
            const shearTerm = Math.max(0, Math.min(shear06Kt / 20, 1.5));
            const lclTerm = idx.lcl_z !== null ? Math.max(0, Math.min((2000 - idx.lcl_z) / 1000, 1)) : 0;
            const cinTerm = idx.cin !== null ? Math.max(0, Math.min((idx.cin + 200) / 150, 1)) : 1;
            const stpAprox = (cape / 1500) * (srh01 / 150) * shearTerm * lclTerm * cinTerm;
            const ehi01 = (cape * srh01) / 160000;

            html += `<div class="skewt-table-section"><div class="skewt-table-title">Índexs compostos (aprox.)</div><table class="skewt-table">`;
            html += fila('STP (aprox.)', fmt(Math.max(0, stpAprox), 2));
            html += fila('EHI 0–1km', fmt(ehi01, 2));
            html += `</table></div>`;
        }

        // ── Superfície ──
        const perfil = perfilActual;
        if (perfil) {
            html += `<div class="skewt-table-section"><div class="skewt-table-title">Superfície</div><table class="skewt-table">`;
            html += fila('Temperatura', fmt(perfil.t[0], 1, ' °C'));
            html += fila('Punt de rosada', fmt(perfil.td[0], 1, ' °C'));
            html += fila('Pressió', fmt(perfil.p[0], 1, ' hPa'));
            if (vent) {
                const spdSfc = Math.sqrt(perfil.u[0] ** 2 + perfil.v[0] ** 2);
                html += fila('Vent', fmt(convertirVent(spdSfc), 0, ' ' + unitatVent));
            }
            html += `</table></div>`;
        }

const dataAvui = new Date().toLocaleDateString('ca-ES', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
});

html += `<div class="skewt-table-section" style="opacity:0.5;">
    <div class="skewt-table-title">Avís legal</div>
    <div style="font-size:9px; color:${tema().textDim}; line-height:1.4;">
        Dades amb finalitat informativa. No ens fem responsables 
        de l'ús que es faci d'aquesta informació.
        <br><br>
        Avís declarat el ${dataAvui}.
    </div>
</div>`;

        side.innerHTML = html;
    }
    window.construirTaulaIndexsSkewt = construirTaulaIndexsSkewt;

    function convertirVentAKt(mps) { return mps * 1.94384; }

})();
