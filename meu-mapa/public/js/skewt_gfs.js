// ═══════════════════════════════════════════════════════════════════════
//  skewt_gfs.js — Skew-T / Log-P per a GFS Global
//  VERSIÓ AMB PRESSIÓ DE SUPERFÍCIE REAL (GFS) + TOOLTIP INTERACTIU
//  El perfil comença directament al primer nivell de pressió estàndard
//  (T i Td d'aquell nivell, sense afegir cap punt sintètic de 2m).
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    console.log('[SkewT] 🚀 Carregant skewt_gfs.js...');

    // ─── PRESSIÓ DE SUPERFÍCIE REAL (GFS) ─────────────────────────────
    let _elevationData = null;
    const ELEVATION_PATH = './dades/elevation_global.json';

    async function carregarElevacio() {
        if (_elevationData) return _elevationData;
        try {
            const resp = await fetch(ELEVATION_PATH);
            if (!resp.ok) { console.warn('[SkewT] No sha trobat elevation_global.json'); return null; }
            const json = await resp.json();
            const sp = json?.variables?.surface_pressure;
            if (!sp || !sp.datos || !json.coordenadas) {
                console.warn('[SkewT] Format inesperat a elevation_global.json (esperava variables.surface_pressure.datos)');
                return null;
            }
            _elevationData = { coordenadas: json.coordenadas, surfacePressure: sp.datos };
            const valids = sp.datos.filter(v => v !== null && v !== undefined);
            console.log('[SkewT] 🌡️ Pressió de superfície carregada | Min:', Math.min(...valids).toFixed(0), 'hPa | Max:', Math.max(...valids).toFixed(0), 'hPa');
            return _elevationData;
        } catch (e) { console.warn('[SkewT] Error carregant pressió de superfície:', e.message); return null; }
    }

    function getPressioSuperficieReal(lat, lon) {
        if (!_elevationData || !_elevationData.surfacePressure) return null;
        const lats = _elevationData.coordenadas.lat;
        const lons = _elevationData.coordenadas.lon;
        let iB = 0, dL = Infinity;
        for (let i = 0; i < lats.length; i++) { const d = Math.abs(lats[i] - lat); if (d < dL) { dL = d; iB = i; } }
        let jB = 0; dL = Infinity;
        for (let j = 0; j < lons.length; j++) { const d = Math.abs(lons[j] - lon); if (d < dL) { dL = d; jB = j; } }
        const Nlon = lons.length;
        const flatIdx = iB * Nlon + jB;
        const v = _elevationData.surfacePressure[flatIdx];
        return (v !== null && v !== undefined && isFinite(v)) ? v : null;
    }

    // ─── ESTAT ────────────────────────────────────────────────────────
    let modalCreat = false;
    let temaActual = localStorage.getItem('skewt_tema') || 'fosc';
    let unitatVent = localStorage.getItem('skewt_unitat_vent') || 'kmh';
    let origenParcelaActual = localStorage.getItem('skewt_origen_parcela') || 'sfc';
    let pressioManualActual = parseFloat(localStorage.getItem('skewt_pressio_manual')) || 850;
    let perfilActual = null;
    let indexsActual = null;
    let ventActual = null;
    let puntActual = null;
    let alcadaHoverActual = null;
    let _canvasDrawing = false;

    const ORIGENS_PARCELA = ['sfc', 'ml', 'manual'];
    const ETIQUETES_ORIGEN = {
        'sfc': 'Superfície',
        'ml': 'Mixed-Layer',
        'manual': 'Manual'
    };

    const TEMES = {
        fosc: {
            fons: '#000000', fonsPanell: '#0a0a0a', grid: '#2a2a2a', gridForta: '#3a3a3a',
            isoterma: '#3a5a3a', isobara: '#4a4a4a', adiabaticaSeca: '#8a5a2a', adiabaticaHumida: '#2a6a5a',
            mescla: '#2a5a2a', temperatura: '#ff2020', rosada: '#20ff20', rosadaBlava: '#3090ff',
            parcela: '#ffff00', parcelaML: '#ff8c00', vent: '#ffffff', text: '#cfe0ee', textDim: '#7f9bb3',
            capeArea: 'rgba(255,60,60,0.18)', cinArea: 'rgba(60,120,255,0.22)',
            hodografRing: '#3a3a3a', hodografRingForta: '#4d4d4d',
            hodograf0_1: '#ff3030', hodograf1_3: '#ffb030', hodograf3_6: '#30b0ff',
            hodograf6_9: '#b030ff', hodograf9_12: '#30ff80', hodograf12_15: '#ffd700',
            bunkersR: '#ff40ff', bunkersL: '#40ffff',
        },
        clar: {
            fons: '#f4f6f8', fonsPanell: '#ffffff', grid: '#d8dee5', gridForta: '#b8c2cc',
            isoterma: '#a8d0a8', isobara: '#c0c8d0', adiabaticaSeca: '#e0b080', adiabaticaHumida: '#80c0b0',
            mescla: '#a0d0a0', temperatura: '#d00000', rosada: '#008000', rosadaBlava: '#2060c0',
            parcela: '#c09000', parcelaML: '#cc6000', vent: '#202020', text: '#1a2632', textDim: '#5a6a7a',
            capeArea: 'rgba(255,60,60,0.12)', cinArea: 'rgba(60,120,255,0.15)',
            hodografRing: '#c0c8d0', hodografRingForta: '#a8b2bc',
            hodograf0_1: '#d00000', hodograf1_3: '#d08000', hodograf3_6: '#0060c0',
            hodograf6_9: '#8000c0', hodograf9_12: '#00a050', hodograf12_15: '#c0a000',
            bunkersR: '#c000c0', bunkersL: '#00a0a0',
        }
    };

    function tema() { return TEMES[temaActual]; }
    function esFinit(v) { return v !== null && v !== undefined && !isNaN(v) && isFinite(v); }

    // ─── CSS ────────────────────────────────────────────────────────────
    function injectarCSS() {
        if (document.getElementById('skewtStyles')) return;
        const css = `
        .skewt-modal-overlay{display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.75);align-items:center;justify-content:center}
        .skewt-modal-overlay.active{display:flex}
        .skewt-modal{width:96vw;height:94vh;max-width:1500px;background:var(--skewt-fons-panell,#0a0a0a);border:1px solid #33475b;border-radius:8px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.6);font-family:'Segoe UI',Arial,sans-serif}
        .skewt-modal-header{display:flex;align-items:center;gap:10px;padding:8px 14px;background:#0a101a;border-bottom:1px solid #33475b;flex:0 0 auto}
        .skewt-modal-header h3{margin:0;font-size:14px;color:#cfe0ee;flex:1}
        .skewt-loc{font-size:11px;color:#7f9bb3;margin-right:8px}
        .skewt-btn{background:#141c2a;color:#cfe0ee;border:1px solid #2a3a5a;border-radius:4px;padding:5px 10px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap}
        .skewt-btn:hover{background:#1c2838}
        .skewt-btn.active{background:#2a5a8a}
        .skewt-modal-close{background:transparent;border:none;color:#cfe0ee;font-size:18px;cursor:pointer;padding:2px 8px}
        .skewt-modal-close:hover{color:#ff6060}
        .skewt-modal-body{flex:1;display:flex;overflow:hidden;min-height:0}
        .skewt-col-main{flex:1 1 auto;display:flex;overflow:hidden;min-width:0}
        .skewt-col-side{flex:0 0 300px;display:flex;flex-direction:column;border-left:1px solid #33475b;overflow-y:auto;min-width:0}
        .skewt-canvas-wrap{flex:1 1 auto;position:relative;min-width:0;overflow:hidden}
        .skewt-canvas-wrap canvas{display:block;width:100%;height:100%}
        .skewt-table-section{padding:8px 10px;border-bottom:1px solid #222}
        .skewt-table-title{font-size:10px;font-weight:700;letter-spacing:0.5px;color:#7f9bb3;text-transform:uppercase;margin-bottom:5px}
        .skewt-table{width:100%;border-collapse:collapse;font-size:11px}
        .skewt-table td{padding:2px 4px;color:#cfe0ee;border-bottom:1px solid rgba(255,255,255,0.04)}
        .skewt-table td.lbl{color:#7f9bb3}
        .skewt-table td.val{text-align:right;font-weight:600}
        .skewt-loading{display:flex;align-items:center;justify-content:center;height:100%;color:#7f9bb3;font-size:13px;flex-direction:column;gap:10px}
        .skewt-spinner{width:28px;height:28px;border:3px solid #2a3a5a;border-top-color:#FFD700;border-radius:50%;animation:skewt-spin 0.8s linear infinite}
        @keyframes skewt-spin{to{transform:rotate(360deg)}}
        @media(max-width:900px){.skewt-modal{width:100vw;height:100vh;border-radius:0}.skewt-modal-body{flex-direction:column;overflow-y:auto}.skewt-col-side{flex:0 0 auto;border-left:none;border-top:1px solid #33475b}}
        `;
        const style = document.createElement('style');
        style.id = 'skewtStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ─── MODAL ──────────────────────────────────────────────────────────
    function crearModal() {
        if (modalCreat) return;
        injectarCSS();
        const overlay = document.createElement('div');
        overlay.id = 'skewtModalOverlay';
        overlay.className = 'skewt-modal-overlay';
        overlay.innerHTML = `
            <div class="skewt-modal" id="skewtModal">
                <div class="skewt-modal-header">
                    <h3><i class="fas fa-chart-line"></i> Skew-T / Log-P · GFS Global</h3>
                    <span class="skewt-loc" id="skewtLocLabel">—</span>
                    <button class="skewt-btn" id="skewtBtnOrigen"><i class="fas fa-cloud-upload-alt"></i> <span id="skewtOrigenLabel">Superfície</span></button>
                    <span id="skewtManualPressioWrap" style="display:none">
                        <input type="number" id="skewtInputPressio" value="850" min="100" max="1050" step="5" style="width:52px;height:26px;background:#141c2a;color:#cfe0ee;border:1px solid #2a3a5a;border-radius:4px;padding:2px 4px;font-size:11px;text-align:center">
                        <span style="color:#7f9bb3;font-size:10px;margin-left:2px">hPa</span>
                    </span>
                    <button class="skewt-btn" id="skewtBtnTema"><i class="fas fa-adjust"></i> <span id="skewtTemaLabel">Fosc</span></button>
                    <button class="skewt-btn" id="skewtBtnUnitat"><i class="fas fa-wind"></i> <span id="skewtUnitatLabel">km/h</span></button>
                    <button class="skewt-modal-close" id="skewtBtnClose">✕</button>
                </div>
                <div class="skewt-modal-body" id="skewtBody">
                    <div class="skewt-loading"><div class="skewt-spinner"></div><div>Calculant sondeig...</div></div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        modalCreat = true;

        overlay.addEventListener('click', e => { if (e.target === overlay) tancarSkewtModal(); });
        document.getElementById('skewtBtnClose').addEventListener('click', tancarSkewtModal);
        document.getElementById('skewtBtnTema').addEventListener('click', toggleTema);
        document.getElementById('skewtBtnUnitat').addEventListener('click', toggleUnitatVent);
        document.getElementById('skewtBtnOrigen').addEventListener('click', toggleOrigenParcela);

        const inputPressio = document.getElementById('skewtInputPressio');
        if (inputPressio) {
            inputPressio.addEventListener('change', function() {
                if (origenParcelaActual === 'manual') {
                    pressioManualActual = parseFloat(this.value) || 850;
                    localStorage.setItem('skewt_pressio_manual', pressioManualActual);
                    recalcularAmbNouOrigen();
                }
            });
        }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') tancarSkewtModal(); });
    }

    // ─── TOGGLES ─────────────────────────────────────────────────────────
    function toggleTema() {
        temaActual = temaActual === 'fosc' ? 'clar' : 'fosc';
        localStorage.setItem('skewt_tema', temaActual);
        document.getElementById('skewtModal').classList.toggle('tema-clar', temaActual === 'clar');
        document.getElementById('skewtTemaLabel').textContent = temaActual === 'fosc' ? 'Fosc' : 'Clar';
        redibuixarTot();
    }
    function toggleUnitatVent() {
        const o = ['kmh', 'kt', 'ms'];
        unitatVent = o[(o.indexOf(unitatVent) + 1) % o.length];
        localStorage.setItem('skewt_unitat_vent', unitatVent);
        document.getElementById('skewtUnitatLabel').textContent = unitatVent === 'kmh' ? 'km/h' : unitatVent === 'kt' ? 'kt' : 'm/s';
        redibuixarTot();
    }
    function aplicarMillorNivellManual() {
        if (!perfilActual) return;
        const E = window.SkewtEngine;
        if (!E || !E.millorOrigenParcela) return;
        const r = E.millorOrigenParcela(perfilActual, { pMinim: 500 });
        if (!r || !esFinit(r.p)) return;
        pressioManualActual = Math.round(r.p);
        localStorage.setItem('skewt_pressio_manual', pressioManualActual);
        const inp = document.getElementById('skewtInputPressio');
        if (inp) inp.value = pressioManualActual;
    }
    function toggleOrigenParcela() {
        const idx = ORIGENS_PARCELA.indexOf(origenParcelaActual);
        origenParcelaActual = ORIGENS_PARCELA[(idx + 1) % ORIGENS_PARCELA.length];
        localStorage.setItem('skewt_origen_parcela', origenParcelaActual);
        document.getElementById('skewtOrigenLabel').textContent = ETIQUETES_ORIGEN[origenParcelaActual];
        const btn = document.getElementById('skewtBtnOrigen');
        if (btn) btn.classList.toggle('active', origenParcelaActual !== 'sfc');
        document.getElementById('skewtManualPressioWrap').style.display = origenParcelaActual === 'manual' ? 'inline' : 'none';
        if (origenParcelaActual === 'manual') aplicarMillorNivellManual();
        recalcularAmbNouOrigen();
    }
    function recalcularAmbNouOrigen() {
        if (!perfilActual) return;
        const E = window.SkewtEngine;
        if (!E) return;
        let pManual = null;
        if (origenParcelaActual === 'manual') {
            const inp = document.getElementById('skewtInputPressio');
            pManual = inp ? parseFloat(inp.value) : pressioManualActual;
            if (!esFinit(pManual) || pManual < 100 || pManual > 1050) { pManual = 850; if (inp) inp.value = 850; }
            pressioManualActual = pManual;
        }
        const nousIndexs = E.calcularIndexsTermo(perfilActual, { origenParcela: origenParcelaActual, pManual, dpMix: 100 });
        if (!nousIndexs) return;
        const add = E.indexsAddicionals(perfilActual);
        indexsActual = Object.assign({}, nousIndexs, add);
        redibuixarTot();
    }
    function tancarSkewtModal() {
        document.getElementById('skewtModalOverlay').classList.remove('active');
    }

    // ─── ENTRY POINT ────────────────────────────────────────────────────
    window.openSkewtModal = function() {
        crearModal();
        const overlay = document.getElementById('skewtModalOverlay');
        document.getElementById('skewtModal').classList.toggle('tema-clar', temaActual === 'clar');
        document.getElementById('skewtTemaLabel').textContent = temaActual === 'fosc' ? 'Fosc' : 'Clar';
        document.getElementById('skewtUnitatLabel').textContent = unitatVent === 'kmh' ? 'km/h' : unitatVent === 'kt' ? 'kt' : 'm/s';
        document.getElementById('skewtOrigenLabel').textContent = ETIQUETES_ORIGEN[origenParcelaActual];
        document.getElementById('skewtBtnOrigen').classList.toggle('active', origenParcelaActual !== 'sfc');
        document.getElementById('skewtManualPressioWrap').style.display = origenParcelaActual === 'manual' ? 'inline' : 'none';
        if (origenParcelaActual === 'manual') document.getElementById('skewtInputPressio').value = pressioManualActual;
        overlay.classList.add('active');

        const pos = window.lastRightClickPos;
        if (!pos) { mostrarError('No hi ha cap punt seleccionat.'); return; }
        mostrarCarregant();
        carregarElevacio();
        esperarDadesIObrir(pos, 0);
    };

    const SKEWT_MAX_INTENTS = 30, SKEWT_INTERVAL_MS = 200;
    function esperarDadesIObrir(pos, intent) {
        const hourIdx = window.skewtHourIndex ?? window.curIdx ?? 0;
        const hores = window.totesLesHores;
        if (hores && hores[hourIdx]) { calcularIObrirSondeig(hores[hourIdx], pos.lat, pos.lng, hourIdx); return; }
        if (intent >= SKEWT_MAX_INTENTS) { mostrarError('Dades no disponibles.'); return; }
        setTimeout(() => esperarDadesIObrir(pos, intent + 1), SKEWT_INTERVAL_MS);
    }
    function mostrarCarregant() {
        document.getElementById('skewtBody').innerHTML = '<div class="skewt-loading"><div class="skewt-spinner"></div><div>Calculant sondeig...</div></div>';
    }
    function mostrarError(msg) {
        document.getElementById('skewtBody').innerHTML = `<div class="skewt-loading" style="flex-direction:column;gap:12px;padding:30px"><div style="font-size:40px;opacity:0.6">⚠️</div><div style="font-size:13px;color:#cfe0ee;text-align:center;line-height:1.5;white-space:pre-line">${msg}</div></div>`;
    }

    /**
     * Extreu el perfil vertical per a un punt donat.
     * El perfil comença directament al primer nivell de pressió estàndard
     * (t_XXX / r_XXX) que quedi per SOBRE de la pressió de superfície real
     * (és a dir, el primer nivell amb p <= pressioSuperficie). S'utilitzen
     * la T i Td d'aquell nivell tal qual, sense afegir cap punt sintètic
     * de 2m ni fer descensos adiabàtics. Els nivells per sota del terreny
     * es descarten completament (no s'afegeixen com a null).
     */
    function extreurePerfilGFS(data, lat, lon) {
        const vars = data.variables || {};
        const coords = data.coordenadas;
        if (!coords) return null;

        // ── 1. OBTENIR PRESSIÓ DE SUPERFÍCIE REAL (GFS) ──────────────
        const pressioSuperficieReal = getPressioSuperficieReal(lat, lon);
        const pressioTerreny = esFinit(pressioSuperficieReal) ? pressioSuperficieReal : 1013.25;

        // ── 2. BUSCAR ÍNDEX FLAT ──────────────────────────────────────
        let lats = data.coordenadas_pres?.lat || coords.lat_pres || coords.lat || coords.lat_sfc;
        let lons = data.coordenadas_pres?.lon || coords.lon_pres || coords.lon || coords.lon_sfc;
        if (!lats || !lons) return null;
        if (!Array.isArray(lats)) lats = Array.from(lats);
        if (!Array.isArray(lons)) lons = Array.from(lons);

        const Nlat = lats.length, Nlon = lons.length;
        const latNord = lats[0] > lats[Nlat - 1];

        let iB = 0, bDL = Infinity;
        for (let i = 0; i < Nlat; i++) { const d = Math.abs(lats[i] - lat); if (d < bDL) { bDL = d; iB = i; } }
        let jB = 0; bDL = Infinity;
        for (let j = 0; j < Nlon; j++) { const d = Math.abs(lons[j] - lon); if (d < bDL) { bDL = d; jB = j; } }
        const filaReal = latNord ? Nlat - 1 - iB : iB;
        let idxFlat = filaReal * Nlon + jB;

        // Comprovar dimensions reals
        const var3dTest = Object.keys(vars).find(k => k.match(/^t_\d+$/));
        if (var3dTest && vars[var3dTest].datos) {
            if (vars[var3dTest].datos.length !== Nlat * Nlon) {
                const NlatR = Math.round(Math.sqrt(vars[var3dTest].datos.length));
                const NlonR = Math.round(vars[var3dTest].datos.length / NlatR);
                const latsR = [], lonsR = [];
                for (let i = 0; i < NlatR; i++) latsR.push(-90 + (i / (NlatR - 1)) * 180);
                for (let j = 0; j < NlonR; j++) lonsR.push(-180 + (j / (NlonR - 1)) * 360);
                let iR = 0; bDL = Infinity;
                for (let i = 0; i < NlatR; i++) { const d = Math.abs(latsR[i] - lat); if (d < bDL) { bDL = d; iR = i; } }
                let jR = 0; bDL = Infinity;
                for (let j = 0; j < NlonR; j++) { const d = Math.abs(lonsR[j] - lon); if (d < bDL) { bDL = d; jR = j; } }
                const latNordR = latsR[0] > latsR[NlatR - 1];
                idxFlat = (latNordR ? NlatR - 1 - iR : iR) * NlonR + jR;
            }
        }

        // ── 3. EXTREURE NIVELLS 3D — NOMÉS els que quedin per SOBRE del terreny ──
        const out = { p: [], t: [], td: [], u: [], v: [] };

        const nivellsTrobats = [];
        Object.keys(vars).forEach(k => {
            const m = k.match(/^t_(\d+)$/);
            if (m) nivellsTrobats.push(parseInt(m[1]));
        });
        nivellsTrobats.sort((a, b) => b - a);

        for (const niv of nivellsTrobats) {
            // Descartar nivells per SOTA del terreny:
            // el perfil ha de començar just al primer nivell útil
            // (pressió del nivell <= pressió del terreny)
            if (niv > pressioTerreny) continue;

            const kt = 't_' + niv, kr = 'r_' + niv, ku = 'u_' + niv, kv = 'v_' + niv;
            if (!vars[kt]?.datos || vars[kt].datos.length <= idxFlat) continue;
            const tVal = vars[kt].datos[idxFlat];
            if (!esFinit(tVal)) continue;

            let tdVal = null;
            if (vars[kr]?.datos && vars[kr].datos.length > idxFlat) {
                const rh = vars[kr].datos[idxFlat];
                if (esFinit(rh) && rh >= 0 && rh <= 100) {
                    const es = 6.112 * Math.exp((17.67 * tVal) / (tVal + 243.5));
                    tdVal = (243.5 * Math.log(es * rh / 100 / 6.112)) / (17.67 - Math.log(es * rh / 100 / 6.112));
                }
            }
            if (!esFinit(tdVal)) continue;

            let uVal = 0, vVal = 0;
            if (vars[ku]?.datos && vars[ku].datos.length > idxFlat && esFinit(vars[ku].datos[idxFlat])) uVal = vars[ku].datos[idxFlat];
            if (vars[kv]?.datos && vars[kv].datos.length > idxFlat && esFinit(vars[kv].datos[idxFlat])) vVal = vars[kv].datos[idxFlat];

            out.p.push(niv);
            out.t.push(tVal);
            out.td.push(tdVal);
            out.u.push(uVal);
            out.v.push(vVal);
        }

        if (out.p.length < 3) return null;

        // Ordenar (de més pressió a menys, és a dir de superfície cap amunt)
        const idxO = out.p.map((_, i) => i).sort((a, b) => out.p[b] - out.p[a]);
        const net = { p: [], t: [], td: [], u: [], v: [] };
        for (const i of idxO) {
            net.p.push(out.p[i]);
            net.t.push(out.t[i]);
            net.td.push(out.td[i]);
            net.u.push(out.u[i]);
            net.v.push(out.v[i]);
        }

        // Altituds
        net.z = net.p.map(p => {
            const T0 = 288.15, p0 = 1013.25, lapse = 0.0065;
            return (T0 / lapse) * (1.0 - Math.pow(p / p0, 287.05 * lapse / 9.80665));
        });

        net.pressioSuperficieReal = pressioSuperficieReal;
        net.pressioTerreny = pressioTerreny;

        console.log('[SkewT] 🌡️ Terreny a', pressioTerreny.toFixed(0) + 'hPa | Primer nivell del perfil:',
                    net.p[0] + 'hPa | Nivells totals:', net.p.length);

        return net;
    }

    // ─── CALCULAR I OBRIR ──────────────────────────────────────────────
    function calcularIObrirSondeig(horaItem, lat, lon, hourIdx) {
        const E = window.SkewtEngine;
        if (!E) { mostrarError('Motor no carregat.'); return; }

        const data = horaItem.data;
        const perfil = extreurePerfilGFS(data, lat, lon);
        if (!perfil) { mostrarError('No hi ha prou dades.'); return; }
        perfilActual = perfil;

        if (origenParcelaActual === 'manual') aplicarMillorNivellManual();

        let pManual = origenParcelaActual === 'manual' ? pressioManualActual : null;
        const indexs = E.calcularIndexsTermo(perfil, { origenParcela: origenParcelaActual, pManual, dpMix: 100 });
        if (!indexs) { mostrarError('Error calculant índexs.'); return; }

        const add = E.indexsAddicionals(perfil);
        const nivellsVent = perfil.p.map((p, i) => ({ z: perfil.z[i], u: perfil.u[i], v: perfil.v[i] }));
        const ventComposite = E.calcularVentComposite(nivellsVent, perfil.z[0]);

        indexsActual = Object.assign({}, indexs, add);
        ventActual = ventComposite;

        // Poble proper
        let pp = null;
        if (window.TOWNS_CAT?.towns) {
            let millor = null, md = Infinity;
            for (const t of window.TOWNS_CAT.towns) {
                if (t.t !== 'poble' && t.t !== 'vila') continue;
                if (!esFinit(t.la) || !esFinit(t.lo)) continue;
                const d = Math.hypot((t.la - lat) * 111, (t.lo - lon) * 111 * Math.cos(lat * Math.PI / 180));
                if (d < md) { md = d; millor = t; }
            }
            if (millor) pp = { nom: millor.n, altitud: millor.a, distanciaKm: md };
        }
        puntActual = { lat, lon, hourIdx, horaItem, pobleProper: pp };

        document.getElementById('skewtOrigenLabel').textContent = ETIQUETES_ORIGEN[origenParcelaActual];
        document.getElementById('skewtBtnOrigen').classList.toggle('active', origenParcelaActual !== 'sfc');
        document.getElementById('skewtManualPressioWrap').style.display = origenParcelaActual === 'manual' ? 'inline' : 'none';
        if (origenParcelaActual === 'manual') document.getElementById('skewtInputPressio').value = pressioManualActual;

        muntarLayout();
        redibuixarTot();
    }

    function muntarLayout() {
        const body = document.getElementById('skewtBody');
        body.innerHTML = `<div class="skewt-col-main"><div class="skewt-canvas-wrap" id="skewtCanvasWrap"><canvas id="skewtCanvas"></canvas></div></div><div class="skewt-col-side" id="skewtSideCol"></div>`;

        const d = puntActual.horaItem.dateObj;
        const ds = d.toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' });
        const hs = String(d.getHours()).padStart(2, '0') + ':00';
        const pp = puntActual.pobleProper;
        const pSfc = perfilActual?.p?.[0];
        let loc = puntActual.lat.toFixed(3) + '°N, ' + puntActual.lon.toFixed(3) + '°E · ' + ds + ' ' + hs;
        if (pp?.nom) loc = pp.nom + (pSfc ? ' (' + pSfc.toFixed(0) + ' hPa)' : '') + ' · ' + ds + ' ' + hs;
        else if (pSfc) loc = puntActual.lat.toFixed(3) + '°N, ' + puntActual.lon.toFixed(3) + '°E (' + pSfc.toFixed(0) + ' hPa) · ' + ds + ' ' + hs;
        document.getElementById('skewtLocLabel').textContent = loc;

        if (window.construirTaulaIndexsSkewt) window.construirTaulaIndexsSkewt();
        window.addEventListener('resize', () => { clearTimeout(window._skewtResizeTO); window._skewtResizeTO = setTimeout(redibuixarTot, 120); });
    }

    function redibuixarTot() {
        if (!perfilActual) return;
        if (window.dibuixarSkewtCanvas) window.dibuixarSkewtCanvas();
        if (window.construirTaulaIndexsSkewt) window.construirTaulaIndexsSkewt();
    }

    // ─── EXPORT ──────────────────────────────────────────────────────────
    window._skewtInternal = { tema, TEMES, get perfilActual() { return perfilActual; }, get indexsActual() { return indexsActual; }, get ventActual() { return ventActual; }, get puntActual() { return puntActual; }, get unitatVent() { return unitatVent; }, get origenParcelaActual() { return origenParcelaActual; }, esFinit };

    // ═══════════════════════════════════════════════════════════════════
    //  DIBUIX DEL SKEW-T + TOOLTIP + CLIC MANUAL
    // ═══════════════════════════════════════════════════════════════════

    const P_TOP = 100, P_BOT = 1050, T_MIN = -25, T_MAX = 70, SKEW = 50;

    function yPerP(p, h, padTop, padBot) {
        const lt = Math.log(P_TOP), lb = Math.log(P_BOT);
        return (h - padBot) - ((lb - Math.log(p)) / (lb - lt)) * (h - padTop - padBot);
    }
    function pPerY(y, h, padTop, padBot) {
        const lt = Math.log(P_TOP), lb = Math.log(P_BOT);
        return Math.exp(lb - ((h - padBot - y) / (h - padTop - padBot)) * (lb - lt));
    }
    function xPerT(tC, p, w, h, pl, pr, pt, pb) {
        const y = yPerP(p, h, pt, pb);
        const skewPx = Math.tan(SKEW * Math.PI / 180);
        const yBase = yPerP(P_BOT, h, pt, pb);
        const dxSkew = (yBase - y) * skewPx;
        return pl + ((tC - T_MIN) / (T_MAX - T_MIN)) * (w - pl - pr) + dxSkew;
    }

    window.dibuixarSkewtCanvas = function() {
        if (_canvasDrawing) return;
        _canvasDrawing = true;
        try {
            const wrap = document.getElementById('skewtCanvasWrap');
            const canvas = document.getElementById('skewtCanvas');
            if (!wrap || !canvas) { _canvasDrawing = false; return; }

            const dpr = window.devicePixelRatio || 1;
            const wTotal = wrap.clientWidth, hTotal = wrap.clientHeight;
            if (wTotal === 0 || hTotal === 0) { _canvasDrawing = false; return; }

            canvas.width = wTotal * dpr; canvas.height = hTotal * dpr;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, wTotal, hTotal);

            const T = tema();
            ctx.fillStyle = T.fons; ctx.fillRect(0, 0, wTotal, hTotal);

            const hodoAmple = Math.min(340, Math.max(230, hTotal * 0.42), wTotal * 0.42);
            const skewtAmple = wTotal - hodoAmple;
            const w = skewtAmple, h = hTotal;
            const pl = 42, pr = 18, pt = 10, pb = 26;
            const proj = { x: (tC, p) => xPerT(tC, p, w, h, pl, pr, pt, pb), y: (p) => yPerP(p, h, pt, pb) };

            // Dibuixar gràfic
            dibuixarGraella(ctx, w, h, pl, pr, pt, pb, T, proj);
            dibuixarTerreny(ctx, T, proj, w, pr);
            dibuixarAreesCapeCin(ctx, T, proj);
            dibuixarLiniesEstat(ctx, proj, T);
            dibuixarNivellsClau(ctx, w, pr, T, proj);
            dibuixarBarbesVent(ctx, w, pr, T, proj);
            dibuixarEtiquetesEix(ctx, w, h, pl, pr, pt, pb, T, proj);

            ctx.strokeStyle = T.gridForta; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(skewtAmple + 0.5, 0); ctx.lineTo(skewtAmple + 0.5, hTotal); ctx.stroke();

            const hodoGeom = dibuixarHodografEnCanvas(ctx, T, skewtAmple, 0, hodoAmple, hTotal);

            // ─── TOOLTIP + CLIC ──────────────────────────────────────
            let tooltip = document.getElementById('skewtTooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'skewtTooltip';
                tooltip.style.cssText = 'position:absolute;background:rgba(10,16,26,0.95);border:1px solid #556;border-radius:4px;padding:5px 8px;font-family:Segoe UI,Arial,sans-serif;font-size:10px;color:#cde;pointer-events:none;z-index:1000;display:none;white-space:nowrap;line-height:1.5;box-shadow:0 2px 8px rgba(0,0,0,0.5);';
                wrap.appendChild(tooltip);
            }

            let currentMouseY = null;

            function fmtVent(mps) { const f = unitatVent === 'kt' ? 1.94384 : (unitatVent === 'kmh' ? 3.6 : 1); return (mps * f).toFixed(0) + ' ' + (unitatVent === 'kmh' ? 'km/h' : unitatVent === 'kt' ? 'kt' : 'm/s'); }
            function dirVent(u, v) { let dg = Math.atan2(-u, -v) * 180 / Math.PI; if (dg < 0) dg += 360; const sec = ['N','NE','E','SE','S','SW','W','NW']; return sec[Math.round(dg / 45) % 8] + ' ' + dg.toFixed(0) + '°'; }
            function calcHR(tC, tdC) { const es = 6.112 * Math.exp((17.67 * tC) / (tC + 243.5)); const e = 6.112 * Math.exp((17.67 * tdC) / (tdC + 243.5)); return Math.min(100, Math.max(0, (e / es) * 100)); }

            function calcLI(pNiv, tAmb) {
                const pf = perfilActual, idx = indexsActual;
                if (!pf || !idx || pNiv >= pf.p[0]) return null;
                const E = window.SkewtEngine;
                if (!E) return null;
                const pOrig = esFinit(idx.pOrigenParcela) ? idx.pOrigenParcela : pf.p[0];
                const tOrig = esFinit(idx.tOrigenParcela) ? idx.tOrigenParcela : pf.t[0];
                const tdOrig = esFinit(idx.tdOrigenParcela) ? idx.tdOrigenParcela : pf.td[0];
                if (pNiv >= pOrig) return null;
                const tp = E.perfilParcela(tOrig, tdOrig, pOrig, [pNiv]);
                return (tp && tp.valors[0] !== null) ? tAmb - tp.valors[0] : null;
            }

            function redrawWithLine(my) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, wTotal, hTotal);
                ctx.fillStyle = T.fons; ctx.fillRect(0, 0, wTotal, hTotal);
                dibuixarGraella(ctx, w, h, pl, pr, pt, pb, T, proj);
                dibuixarTerreny(ctx, T, proj, w, pr);
                dibuixarAreesCapeCin(ctx, T, proj);
                dibuixarLiniesEstat(ctx, proj, T);
                dibuixarNivellsClau(ctx, w, pr, T, proj);
                dibuixarBarbesVent(ctx, w, pr, T, proj);
                dibuixarEtiquetesEix(ctx, w, h, pl, pr, pt, pb, T, proj);
                if (my !== null) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 4]);
                    ctx.beginPath(); ctx.moveTo(pl, my); ctx.lineTo(w - pr, my); ctx.stroke();
                    ctx.setLineDash([]);
                }
                ctx.strokeStyle = T.gridForta; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(skewtAmple + 0.5, 0); ctx.lineTo(skewtAmple + 0.5, hTotal); ctx.stroke();
                dibuixarHodografEnCanvas(ctx, T, skewtAmple, 0, hodoAmple, hTotal, alcadaHoverActual);
            }

            canvas.onmousemove = function(e) {
                const r = canvas.getBoundingClientRect();
                const mx = e.clientX - r.left, my = e.clientY - r.top;

                if (mx >= 0 && mx <= w && mx >= pl - 8 && mx <= w - pr + 8 && my >= pt && my <= h - pb) {
                    if (currentMouseY !== my) { currentMouseY = my; }
                    const p = pPerY(my, h, pt, pb);
                    const pf = perfilActual;
                    if (!pf) { tooltip.style.display = 'none'; return; }

                    let bi = 0, bd = Infinity;
                    for (let i = 0; i < pf.p.length; i++) { const dd = Math.abs(pf.p[i] - p); if (dd < bd) { bd = dd; bi = i; } }
                    if (bd > 25) { tooltip.style.display = 'none'; alcadaHoverActual = null; redrawWithLine(my); return; }

                    alcadaHoverActual = pf.z[bi];
                    redrawWithLine(my);

                    const tC = pf.t[bi], tdC = pf.td[bi], pN = pf.p[bi], zM = pf.z[bi];
                    const u = pf.u[bi], v = pf.v[bi], spd = Math.sqrt(u * u + v * v);
                    const hr = calcHR(tC, tdC);
                    const li = calcLI(pN, tC);
                    const liTxt = li !== null && isFinite(li) ? li.toFixed(1) : '--';
                    const liClr = li !== null ? (li < -6 ? '#f44' : li < -3 ? '#f84' : li < 0 ? '#fb4' : li < 3 ? '#8cf' : '#48f') : '#888';
                    const hrClr = hr < 30 ? '#f84' : hr < 50 ? '#fb4' : hr < 70 ? '#8cf' : hr < 90 ? '#48f' : '#28f';
                    const pSfcTxt = pf.p[0] ? pf.p[0].toFixed(0) + 'hPa' : '';

                    tooltip.innerHTML = `<div style="font-weight:600;color:#fff;margin-bottom:2px">${pN.toFixed(0)} hPa · ${zM.toFixed(0)} m ${pSfcTxt && bi===0 ? '🌡️'+pSfcTxt : ''}</div><span style="color:#ff2020">T ${tC.toFixed(1)}°C</span> <span style="color:#3090ff;margin-left:8px">Td ${tdC.toFixed(1)}°C</span> <span style="color:${hrClr};margin-left:8px">${hr.toFixed(0)}%</span><br><span style="color:#bbb">${fmtVent(spd)} ${dirVent(u, v)}</span> <span style="color:${liClr};margin-left:8px">LI ${liTxt}</span>`;

                    const wr = wrap.getBoundingClientRect();
                    let tx = e.clientX - wr.left + 14, ty = e.clientY - wr.top - 36;
                    if (tx + 220 > wTotal) tx = e.clientX - wr.left - 220 - 14;
                    if (tx < 4) tx = 4;
                    if (ty < 2) ty = e.clientY - wr.top + 14;
                    if (ty + 60 > hTotal) ty = hTotal - 64;
                    tooltip.style.left = tx + 'px'; tooltip.style.top = ty + 'px';
                    tooltip.style.display = 'block';
                } else {
                    tooltip.style.display = 'none';
                    if (currentMouseY !== null || alcadaHoverActual !== null) { currentMouseY = null; alcadaHoverActual = null; redrawWithLine(null); }
                }
            };

            canvas.onmouseleave = function() {
                tooltip.style.display = 'none';
                if (currentMouseY !== null || alcadaHoverActual !== null) { currentMouseY = null; alcadaHoverActual = null; redrawWithLine(null); }
            };

            // 🔥 CLIC PER FIXAR PRESSIÓ MANUAL
            canvas.onclick = function(e) {
                if (origenParcelaActual !== 'manual') return;
                const r = canvas.getBoundingClientRect();
                const mx = e.clientX - r.left, my = e.clientY - r.top;
                if (mx < pl - 8 || mx > w - pr + 8 || my < pt || my > h - pb) return;
                const pClic = pPerY(my, h, pt, pb);
                if (!esFinit(pClic) || pClic < 100 || pClic > 1050) return;
                pressioManualActual = Math.round(pClic);
                localStorage.setItem('skewt_pressio_manual', pressioManualActual);
                const inp = document.getElementById('skewtInputPressio');
                if (inp) inp.value = pressioManualActual;
                recalcularAmbNouOrigen();
            };

        } catch (e) { console.error('[SkewT] Error:', e); }
        _canvasDrawing = false;
    };

    // ─── FUNCIONS DE DIBUIX ──────────────────────────────────────────
    function dibuixarGraella(ctx, w, h, pl, pr, pt, pb, T, proj) {
        ctx.save(); ctx.beginPath(); ctx.rect(pl, pt, w - pl - pr, h - pt - pb); ctx.clip();
        [1000, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100].forEach(p => {
            const y = proj.y(p);
            ctx.strokeStyle = [1000, 850, 700, 500, 300].includes(p) ? T.gridForta : T.isobara;
            ctx.lineWidth = [1000, 850, 700, 500, 300].includes(p) ? 1 : 0.6;
            ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(w - pr, y); ctx.stroke();
        });
        ctx.strokeStyle = T.isoterma; ctx.lineWidth = 0.7;
        for (let tC = -100; tC <= 50; tC += 10) {
            ctx.beginPath(); let st = false;
            for (let p = P_BOT; p >= P_TOP; p -= 10) {
                const x = proj.x(tC, p), y = proj.y(p);
                if (x < pl - 60 || x > w - pr + 60) { st = false; continue; }
                if (!st) { ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.strokeStyle = T.hodograf3_6 || '#3090ff'; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]);
        ctx.beginPath(); let st0 = false;
        for (let p = P_BOT; p >= P_TOP; p -= 10) {
            const x = proj.x(0, p), y = proj.y(p);
            if (!st0) { ctx.moveTo(x, y); st0 = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = T.adiabaticaSeca; ctx.lineWidth = 0.6;
        const RD_CP = 0.286;
        for (let tPot = -30; tPot <= 200; tPot += 10) {
            ctx.beginPath(); let st2 = false;
            for (let p = P_BOT; p >= P_TOP; p -= 15) {
                const tC = (tPot + 273.15) * Math.pow(p / 1000, RD_CP) - 273.15;
                const x = proj.x(tC, p), y = proj.y(p);
                if (x < pl - 100 || x > w - pr + 100) { st2 = false; continue; }
                if (!st2) { ctx.moveTo(x, y); st2 = true; } else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = T.gridForta; ctx.lineWidth = 1;
        ctx.strokeRect(pl, pt, w - pl - pr, h - pt - pb);
    }

    function dibuixarTerreny(ctx, T, proj, w, pr) {
        const pf = perfilActual;
        if (!pf?.p?.length) return;
        const pSfc = pf.p[0];
        if (pSfc >= P_BOT) return;
        ctx.fillStyle = 'rgba(34,139,34,0.3)'; ctx.beginPath();
        const ySfc = proj.y(pSfc), yBot = proj.y(P_BOT);
        ctx.moveTo(42, ySfc); ctx.lineTo(42, yBot); ctx.lineTo(w - pr, yBot); ctx.lineTo(w - pr, ySfc); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#228B22'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
        ctx.beginPath(); ctx.moveTo(42, ySfc); ctx.lineTo(w - pr, ySfc); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#228B22'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'right';
        ctx.fillText(`${pf.z[0].toFixed(0)}m`, w - pr - 10, ySfc - 5);
    }

    function dibuixarLiniesEstat(ctx, proj, T) {
        const pf = perfilActual, idx = indexsActual;
        if (!pf) return;
        if (idx?.tParcela) {
            ctx.strokeStyle = T.parcela; ctx.lineWidth = 1.8; ctx.beginPath();
            let st = false;
            for (let i = 0; i < pf.p.length; i++) {
                if (idx.tParcela[i] === null) continue;
                const x = proj.x(idx.tParcela[i], pf.p[i]), y = proj.y(pf.p[i]);
                if (!st) { ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.strokeStyle = T.rosadaBlava; ctx.lineWidth = 2.2; ctx.beginPath();
        pf.p.forEach((p, i) => { const x = proj.x(pf.td[i], p), y = proj.y(p); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.stroke();
        ctx.strokeStyle = T.temperatura; ctx.lineWidth = 2.2; ctx.beginPath();
        pf.p.forEach((p, i) => { const x = proj.x(pf.t[i], p), y = proj.y(p); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.stroke();
    }

    function dibuixarAreesCapeCin(ctx, T, proj) {
        const pf = perfilActual, idx = indexsActual;
        if (!pf || !idx?.tParcela) return;
        function area(pIni, pFi, color) {
            const pS = Math.min(pIni, pf.p[0]), pE = Math.max(pFi, 100);
            const ptsP = [], ptsA = [];
            for (let i = 0; i < pf.p.length; i++) {
                if (pf.p[i] > pS || pf.p[i] < pE) continue;
                if (idx.tParcela[i] === null || !esFinit(idx.tParcela[i])) continue;
                ptsP.push({ x: proj.x(idx.tParcela[i], pf.p[i]), y: proj.y(pf.p[i]) });
                ptsA.push({ x: proj.x(pf.t[i], pf.p[i]), y: proj.y(pf.p[i]) });
            }
            if (ptsP.length < 2) return;
            ctx.fillStyle = color; ctx.beginPath();
            ptsP.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
            for (let i = ptsA.length - 1; i >= 0; i--) ctx.lineTo(ptsA[i].x, ptsA[i].y);
            ctx.closePath(); ctx.fill();
        }
        if (idx.lfc_p && idx.el_p) area(idx.lfc_p, idx.el_p, T.capeArea);
        if (idx.lfc_p) area(pf.p[0], idx.lfc_p, T.cinArea);
    }

    function dibuixarNivellsClau(ctx, w, pr, T, proj) {
        const idx = indexsActual, pf = perfilActual;
        if (!idx || !pf) return;
        ctx.font = '10px Arial'; ctx.textAlign = 'left';
        function marca(pHpa, txt, color) {
            if (!pHpa) return;
            const y = proj.y(pHpa);
            ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = color; ctx.fillText(txt, w - pr - 74, y - 2);
        }
        marca(idx.lcl_p, 'LCL ' + idx.lcl_p.toFixed(0), '#40c0ff');
        marca(idx.lfc_p, 'LFC ' + (idx.lfc_p ? idx.lfc_p.toFixed(0) : ''), '#ff9040');
        marca(idx.el_p, 'EL ' + (idx.el_p ? idx.el_p.toFixed(0) : ''), '#c060ff');
        for (let i = 1; i < pf.p.length; i++) {
            if ((pf.t[i - 1] >= 0) !== (pf.t[i] >= 0)) {
                const f = pf.t[i - 1] / (pf.t[i - 1] - pf.t[i]);
                marca(pf.p[i - 1] + f * (pf.p[i] - pf.p[i - 1]), '0°C', '#3090ff');
                break;
            }
        }
    }

    function dibuixarBarbesVent(ctx, w, pr, T, proj) {
        const pf = perfilActual;
        if (!pf) return;
        const xB = w - pr - 24;
        const mostrats = [];
        let lastP = Infinity;
        pf.p.forEach((p, i) => { if (lastP - p >= 45 || i === 0) { mostrats.push(i); lastP = p; } });
        mostrats.forEach(i => {
            const y = proj.y(pf.p[i]);
            const uKt = pf.u[i] * 1.94384, vKt = pf.v[i] * 1.94384;
            dibuixarBarba(ctx, xB, y, uKt, vKt, T.vent);
        });
    }

    function dibuixarBarba(ctx, x, y, uKt, vKt, color) {
        const spd = Math.sqrt(uKt * uKt + vKt * vKt);
        if (spd < 1) { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke(); return; }
        const ang = Math.atan2(-uKt, -vKt);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.strokeStyle = color; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke();
        let rest = spd, pos = -22;
        while (rest >= 50) { ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(8, pos + 4); ctx.lineTo(0, pos + 8); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); pos += 8; rest -= 50; }
        while (rest >= 10) { ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(9, pos - 3); ctx.stroke(); pos += 4; rest -= 10; }
        if (rest >= 5) { ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(5, pos - 1.5); ctx.stroke(); }
        ctx.restore();
    }

    function dibuixarEtiquetesEix(ctx, w, h, pl, pr, pt, pb, T, proj) {
        ctx.fillStyle = T.text; ctx.font = '10px Arial'; ctx.textAlign = 'right';
        [1000, 900, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100].forEach(p => ctx.fillText(String(p), pl - 4, proj.y(p) + 3));
        ctx.textAlign = 'center'; ctx.fillStyle = T.textDim; ctx.font = '9px Arial';
        for (let tC = -60; tC <= 70; tC += 10) ctx.fillText(tC + '°', proj.x(tC, P_BOT), h - pb + 14);
    }

    function ventInterpolatAAlcada(z) {
        if (!ventActual?.niv || ventActual.niv.length < 2) return null;
        const niv = ventActual.niv;
        for (let i = 0; i < niv.length - 1; i++) {
            if (z >= niv[i].z && z <= niv[i + 1].z) {
                const f = (z - niv[i].z) / ((niv[i + 1].z - niv[i].z) || 1);
                return { u: niv[i].u + f * (niv[i + 1].u - niv[i].u), v: niv[i].v + f * (niv[i + 1].v - niv[i].v) };
            }
        }
        return null;
    }

    function dibuixarHodografEnCanvas(ctx, T, ox, oy, ample, alt, alcadaHoverOvr) {
        if (!ventActual) return null;
        const alcadaHover = alcadaHoverOvr !== undefined ? alcadaHoverOvr : alcadaHoverActual;
        ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, ample, alt); ctx.clip(); ctx.translate(ox, oy);
        const w = ample, h = alt, padT = 20, padL = 46;
        const cx = w / 2, cy = padT + (h - padT - padL) / 2;
        // ⚠️ PROTECCIÓ: rDisp no pot ser negatiu (evita error de radi negatiu a ctx.arc)
        const rDisp = Math.max(1, Math.min((w - 30) / 2, (h - padT - padL) / 2 - 6));
        const niv = ventActual.niv;
        const factor = unitatVent === 'kt' ? 1.94384 : (unitatVent === 'kmh' ? 3.6 : 1);
        let maxSpd = 10;
        niv.forEach(n => { const s = Math.sqrt(n.u * n.u + n.v * n.v) * factor; if (s > maxSpd) maxSpd = s; });
        maxSpd = Math.ceil(maxSpd / 10) * 10 + 10;
        // ⚠️ PROTECCIÓ: evitar divisió per zero
        const pxPerU = rDisp / Math.max(maxSpd, 1);
        const pasA = maxSpd > 80 ? 20 : 10;
        for (let rv = pasA; rv <= maxSpd; rv += pasA) {
            const esF = (rv % (pasA * 2) === 0);
            ctx.strokeStyle = esF ? (T.hodografRingForta || T.gridForta) : T.hodografRing;
            ctx.lineWidth = esF ? 1.1 : 0.6;
            ctx.beginPath(); ctx.arc(cx, cy, rv * pxPerU, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.strokeStyle = T.gridForta; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(cx - maxSpd * pxPerU - 6, cy); ctx.lineTo(cx + maxSpd * pxPerU + 6, cy);
        ctx.moveTo(cx, cy - maxSpd * pxPerU - 6); ctx.lineTo(cx, cy + maxSpd * pxPerU + 6); ctx.stroke();
        ctx.fillStyle = T.textDim; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
        ctx.fillText('N', cx, cy - maxSpd * pxPerU - 10);
        ctx.fillText('S', cx, cy + maxSpd * pxPerU + 18);
        ctx.textAlign = 'left'; ctx.fillText('E', cx + maxSpd * pxPerU + 8, cy + 4);
        ctx.textAlign = 'right'; ctx.fillText('W', cx - maxSpd * pxPerU - 8, cy + 4);
        function pt(u, v) { return { x: cx + u * factor * pxPerU, y: cy - v * factor * pxPerU }; }
        const trams = [{ min: 0, max: 1000, color: T.hodograf0_1 }, { min: 1000, max: 3000, color: T.hodograf1_3 }, { min: 3000, max: 6000, color: T.hodograf3_6 }, { min: 6000, max: 9000, color: T.hodograf6_9 }, { min: 9000, max: 12000, color: T.hodograf9_12 }, { min: 12000, max: 15000, color: T.hodograf12_15 }];
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        trams.forEach(tram => {
            const ptsT = [];
            for (let i = 0; i < niv.length; i++) { if (niv[i].z >= tram.min && niv[i].z <= tram.max) { if (ptsT.length === 0 && i > 0) ptsT.push(niv[i - 1]); ptsT.push(niv[i]); } }
            if (ptsT.length < 2) return;
            ctx.strokeStyle = tram.color; ctx.lineWidth = 2.6; ctx.beginPath();
            const p0 = pt(ptsT[0].u, ptsT[0].v); ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < ptsT.length; i++) { const p = pt(ptsT[i].u, ptsT[i].v); ctx.lineTo(p.x, p.y); }
            ctx.stroke();
        });
        if (ventActual.bunkers?.right) { const pr = pt(ventActual.bunkers.right.u, ventActual.bunkers.right.v); ctx.fillStyle = T.bunkersR; ctx.beginPath(); ctx.arc(pr.x, pr.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = T.text; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'left'; ctx.fillText('RM', pr.x + 7, pr.y + 3); }
        if (ventActual.bunkers?.left) { const pl = pt(ventActual.bunkers.left.u, ventActual.bunkers.left.v); ctx.fillStyle = T.bunkersL; ctx.beginPath(); ctx.arc(pl.x, pl.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = T.text; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'left'; ctx.fillText('LM', pl.x + 7, pl.y + 3); }
        if (alcadaHover !== null && alcadaHover !== undefined) { const vi = ventInterpolatAAlcada(alcadaHover); if (vi) { const pm = pt(vi.u, vi.v); ctx.beginPath(); ctx.arc(pm.x, pm.y, 7, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.stroke(); } }
        ctx.fillStyle = T.textDim; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Hodògraf (' + (unitatVent === 'kmh' ? 'km/h' : unitatVent === 'kt' ? 'kt' : 'm/s') + ')', 10, 15);
        ctx.restore();
        return { cx: cx + ox, cy: cy + oy, pxPerUnit: pxPerU };
    }

    // ─── TAULA D'ÍNDEXS ──────────────────────────────────────────────────
    window.construirTaulaIndexsSkewt = function() {
        const side = document.getElementById('skewtSideCol');
        if (!side || !indexsActual) return;
        const idx = indexsActual, vent = ventActual;
        const uv = unitatVent === 'kmh' ? 'km/h' : unitatVent === 'kt' ? 'kt' : 'm/s';
        function fila(l, v, c) { return `<tr><td class="lbl">${l}</td><td class="val"${c?' style="color:'+c+'"':''}>${v}</td></tr>`; }
        function fmt(v, d, u) { return (v === null || v === undefined || isNaN(v)) ? '—' : v.toFixed(d !== undefined ? d : 0) + (u || ''); }
        function cCape(v) { return v === null ? null : v < 300 ? '#7f9bb3' : v < 1000 ? '#e0d040' : v < 2500 ? '#e08030' : '#e03030'; }
        function cv(mps) { const f = unitatVent === 'kt' ? 1.94384 : (unitatVent === 'kmh' ? 3.6 : 1); return mps * f; }

        let html = '';
        html += `<div class="skewt-table-section"><div class="skewt-table-title">Origen</div><table class="skewt-table">${fila('Tipus', ETIQUETES_ORIGEN[idx.origenParcela] || '—')}${fila('Pressió', fmt(idx.origenParcelaInfo?.p, 0, ' hPa'))}${fila('T inicial', fmt(idx.origenParcelaInfo?.t, 1, '°C'))}${fila('Td inicial', fmt(idx.origenParcelaInfo?.td, 1, '°C'))}</table></div>`;
        html += `<div class="skewt-table-section"><div class="skewt-table-title">Termodinàmica</div><table class="skewt-table">${fila('CAPE', fmt(idx.cape, 0, ' J/kg'), cCape(idx.cape))}${fila('CIN', fmt(idx.cin, 0, ' J/kg'), idx.cin === 0 ? '#7f9bb3' : (idx.cin < -100 ? '#4090ff' : null))}${fila('LI', fmt(idx.li, 1), idx.li !== null && idx.li < -4 ? '#e03030' : null)}${fila('K-Index', fmt(idx.kIndex, 0))}${fila('PWAT', fmt(idx.pwat, 1, ' mm'))}</table></div>`;
        html += `<div class="skewt-table-section"><div class="skewt-table-title">Nivells</div><table class="skewt-table">${fila('LCL', fmt(idx.lcl_p, 0, ' hPa') + ' · ' + fmt(idx.lcl_z, 0, ' m'))}${fila('LFC', idx.lfc_p ? fmt(idx.lfc_p, 0, ' hPa') + ' · ' + fmt(idx.lfc_z, 0, ' m') : '—')}${fila('EL', idx.el_p ? fmt(idx.el_p, 0, ' hPa') + ' · ' + fmt(idx.el_z, 0, ' m') : '—')}</table></div>`;
        if (vent) {
            html += `<div class="skewt-table-section"><div class="skewt-table-title">Shear</div><table class="skewt-table">${fila('0–1 km', fmt(cv(vent.shear01), 0, ' ' + uv))}${fila('0–3 km', fmt(cv(vent.shear03), 0, ' ' + uv))}${fila('0–6 km', fmt(cv(vent.shear06), 0, ' ' + uv), vent.shear06 > 20 ? '#e08030' : null)}</table></div>`;
            html += `<div class="skewt-table-section"><div class="skewt-table-title">SRH</div><table class="skewt-table">${fila('0–1 km', fmt(vent.srh01, 0, ' m²/s²'), Math.abs(vent.srh01) > 150 ? '#e03030' : null)}${fila('0–3 km', fmt(vent.srh03, 0, ' m²/s²'), Math.abs(vent.srh03) > 250 ? '#e03030' : null)}</table></div>`;
        }
        side.innerHTML = html;
    };

    console.log('[SkewT] ✅ Tot carregat correctament');

})();