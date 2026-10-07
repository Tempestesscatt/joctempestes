// ═══════════════════════════════════════════════════════════════════════
//  js/outlook.js — Outlooks independents (pluja i neu)
//
//  · Targeta d'avisos a dalt del panell de variables.
//  · Cada outlook té la seva pròpia llista d'hores (llegida de
//    manifest_outlook.json o per autodescoberta).
//  · Independents de les hores SFC de mapapngs.
//  · Amaga la barra d'hores inferior (#dock) mentre un outlook és actiu.
//  · QUAN ES SELECCIONA UNA VARIABLE NORMAL AL PANELL, RESTAURA EL DOCK.
//
//  CÀRREGA: després de mapapngs.js, com a script clàssic.
//      <script src="js/mapapngs.js"></script>
//      <script src="js/outlook.js"></script>
// ═══════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ─── Configuració dels outlooks ────────────────────────────────
    const OUTLOOKS = [
        {
            clau: 'outlook_pluja6h',
            nom: 'Outlook — Risc d\'inundacions',
            desc: 'Pluja acumulada (6 h)',
            unitat: 'mm / 6 h',
            tipus: 'horari',
            llegenda: {
                titol: 'Pluja acumulada 6 h',
                unitat: 'mm / 6 h',
                trams: [
                    { color: '#8fd98f', valor: 'Baix · 10-20' },
                    { color: '#2e7d32', valor: 'Moderat · 20-40' },
                    { color: '#f0c32e', valor: 'Alt · 40-60' },
                    { color: '#ff8a2a', valor: 'Molt alt · 60-100' },
                    { color: '#d93a30', valor: 'Extrem · 100-150' },
                    { color: '#d94bd9', valor: 'Excepcional · >150' },
                ],
            },
        },
        {
            clau: 'outlook_neu6h',
            nom: 'Outlook — Neu',
            desc: 'Neu acumulada (6 h)',
            unitat: 'cm / 6 h',
            tipus: 'horari',
            llegenda: {
                titol: 'Neu acumulada 6 h',
                unitat: 'cm / 6 h',
                trams: [
                    { color: '#cce5ff', valor: 'Feble · ≥2' },
                    { color: '#99ccff', valor: 'Moderat · ≥5' },
                    { color: '#66b3ff', valor: 'Fort · ≥10' },
                    { color: '#3388ff', valor: 'Molt fort · ≥20' },
                    { color: '#0066cc', valor: 'Extrem · ≥40' },
                ],
            },
        },
    ];

    // ─── Estat ─────────────────────────────────────────────────────
    let OUTLOOK_ACTIU = null;
    let HORES_OUTLOOK = [];
    let idxOutlook = 0;
    let DOCK_ESTAT_ORIGINAL = null;

    // ─── Utilitats ─────────────────────────────────────────────────
    function baseUrl() {
        if (typeof PNG_BASE !== 'undefined' && PNG_BASE) return PNG_BASE;
        const p = window.location.pathname;
        const base = p.substring(0, p.lastIndexOf('/') + 1);
        return base + 'web_data_NE/imatges/';
    }

    function urlPng(clau, hora, dia) {
        const base = baseUrl();
        const ol = OUTLOOKS.find(o => o.clau === clau);
        let u;
        if (ol && ol.tipus === 'diari') {
            u = `${base}sfc_${dia}_${clau}.png`;
        } else {
            const h = String(hora).padStart(2, '0');
            u = `${base}sfc_${h}_${dia}_${clau}.png`;
        }
        return (typeof ambCb === 'function') ? ambCb(u) : (u + '?_cb=' + Date.now());
    }

    function ordreDia(dia) {
        const fixos = { 'ahir': 0, 'avui': 1, 'dema': 2, 'dema_passat': 3 };
        return (dia in fixos) ? fixos[dia] : 99;
    }

    function nomDia(dia) {
        const noms = {
            'ahir': 'Ahir',
            'avui': 'Avui',
            'dema': 'Demà',
            'dema_passat': 'Demà passat',
        };
        return noms[dia] || dia;
    }

    // ═══════════════════════════════════════════════════════════════
    //  DESCOBRIR HORES
    // ═══════════════════════════════════════════════════════════════
    async function descobrirHores(outlook) {
        // 1) Intentar manifest_outlook.json
        try {
            const base = baseUrl();
            const r = await fetch(base + 'manifest_outlook.json?_cb=' + Date.now(), { cache: 'no-store' });
            if (r.ok) {
                const ct = r.headers.get('content-type') || '';
                if (!ct.includes('text/html')) {
                    const m = await r.json();
                    if (m && m.hores && Array.isArray(m.hores)) {
                        const hores = m.hores
                            .filter(h => h.clau === outlook.clau)
                            .map((h, i) => ({
                                hora: h.hora,
                                dia: h.dia,
                                step: i,
                                url: urlPng(h.clau, h.hora, h.dia),
                            }));
                        if (hores.length) return hores;
                    }
                }
            }
        } catch (e) { /* seguim */ }

        // 2) Autodescoberta
        const dies = ['ahir', 'avui', 'dema', 'dema_passat'];
        const hores = [];
        if (outlook.tipus === 'diari') {
            for (const dia of dies) {
                const url = baseUrl() + `sfc_${dia}_${outlook.clau}.png`;
                try {
                    const r = await fetch(url + '?_cb=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
                    if (r.ok) {
                        hores.push({ hora: 12, dia, step: hores.length, url: urlPng(outlook.clau, 12, dia) });
                    }
                } catch (e) { /* no existeix */ }
            }
        } else {
            for (const dia of dies) {
                for (let h = 0; h < 24; h++) {
                    const url = baseUrl() + `sfc_${String(h).padStart(2, '0')}_${dia}_${outlook.clau}.png`;
                    try {
                        const r = await fetch(url + '?_cb=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
                        if (r.ok) {
                            hores.push({ hora: h, dia, step: hores.length, url: urlPng(outlook.clau, h, dia) });
                        }
                    } catch (e) { /* no existeix */ }
                }
            }
        }
        return hores;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ESPERAR MAPAPNGS
    // ═══════════════════════════════════════════════════════════════
    function esperarMapapngs(cb, intents) {
        intents = intents || 0;
        if (intents > 100) return;
        if (typeof SECCIONS !== 'undefined' &&
            typeof NOMS_VARIABLES !== 'undefined' &&
            typeof construirPanellParametres === 'function') {
            cb();
            return;
        }
        setTimeout(() => esperarMapapngs(cb, intents + 1), 100);
    }

    // ═══════════════════════════════════════════════════════════════
    //  REGISTRAR VARIABLES
    // ═══════════════════════════════════════════════════════════════
    function registrarVariables() {
        if (!SECCIONS.some(s => s.id === 'outlook')) {
            SECCIONS.unshift({
                id: 'outlook',
                nom: 'Outlook',
                color: '#ff4d4f',
                claus: OUTLOOKS.map(o => o.clau),
            });
        }
        for (const o of OUTLOOKS) {
            NOMS_VARIABLES[o.clau] = o.nom;
            if (typeof VARS_SENSE_STREAMLINES !== 'undefined') {
                VARS_SENSE_STREAMLINES.add(o.clau);
            }
            if (typeof VARS_SENSE_ISOLINIES !== 'undefined') {
                VARS_SENSE_ISOLINIES.add(o.clau);
            }
            if (typeof LLEGENDES_CSS !== 'undefined') {
                LLEGENDES_CSS[o.clau] = o.llegenda;
            }
            if (typeof PARAMETRES_LLIURES !== 'undefined') {
                PARAMETRES_LLIURES.add(o.clau);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  DOCK (#dock) — amagar / restaurar
    // ═══════════════════════════════════════════════════════════════
    function amagarDock() {
        const dock = document.getElementById('dock');
        if (!dock) return;
        if (DOCK_ESTAT_ORIGINAL === null) {
            DOCK_ESTAT_ORIGINAL = {
                display: dock.style.display,
                opacity: dock.style.opacity,
                pointerEvents: dock.style.pointerEvents,
                transform: dock.style.transform,
            };
        }
        dock.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        dock.style.opacity = '0';
        dock.style.pointerEvents = 'none';
        dock.style.transform = 'translateY(140%)';
        setTimeout(() => {
            if (dock.style.opacity === '0') dock.style.display = 'none';
        }, 220);
    }

    function restaurarDock() {
        const dock = document.getElementById('dock');
        if (!dock) return;
        dock.style.display = DOCK_ESTAT_ORIGINAL ? DOCK_ESTAT_ORIGINAL.display : '';
        dock.style.pointerEvents = DOCK_ESTAT_ORIGINAL ? DOCK_ESTAT_ORIGINAL.pointerEvents : '';
        dock.style.transform = DOCK_ESTAT_ORIGINAL ? DOCK_ESTAT_ORIGINAL.transform : '';
        void dock.offsetHeight;
        dock.style.opacity = '1';
        DOCK_ESTAT_ORIGINAL = null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  INJECTAR TARGETA
    // ═══════════════════════════════════════════════════════════════
    function injectarSeccioOutlook() {
        const cont = document.getElementById('ppLlistaVar');
        if (!cont) return false;

        let bloc = document.getElementById('ppOutlookBloc');

        const secNormal = cont.querySelector('.sec[data-sec="outlook"]');
        if (secNormal) secNormal.style.display = 'none';

        if (!bloc) {
            bloc = document.createElement('div');
            bloc.id = 'ppOutlookBloc';
            bloc.innerHTML = `
                <div class="pp-outlook-card">
                    <div class="pp-outlook-cap">
                        <span class="pp-outlook-ico" aria-hidden="true"></span>
                        <span>Avisos i outlook</span>
                    </div>
                    <div id="ppOutlookBotons"></div>
                    <div id="ppOutlookHores" class="pp-outlook-hores" style="display:none;">
                        <div class="pp-outlook-hores-titol">Franges disponibles</div>
                        <div id="ppOutlookHoresGrid" class="pp-outlook-hores-grid"></div>
                    </div>
                </div>
            `;
            cont.insertBefore(bloc, cont.firstChild);
        }

        const botons = bloc.querySelector('#ppOutlookBotons');
        botons.innerHTML = '';

        for (const o of OUTLOOKS) {
            const boto = document.createElement('button');
            boto.type = 'button';
            boto.className = 'pp-outlook-boto';
            boto.dataset.clau = o.clau;
            boto.innerHTML = `
                <span class="pp-outlook-boto-nom">${o.desc}</span>
                <span class="pp-outlook-boto-tag">${o.tipus === 'diari' ? 'diari' : '6h'}</span>
            `;
            boto.addEventListener('click', () => activarOutlook(o, boto));
            botons.appendChild(boto);
        }

        injectarEstils();
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ESTILS
    // ═══════════════════════════════════════════════════════════════
    function injectarEstils() {
        if (document.getElementById('ppOutlookEstils')) return;
        const st = document.createElement('style');
        st.id = 'ppOutlookEstils';
        st.textContent = `
            .pp-outlook-card {
                margin: 6px 8px 10px;
                padding: 10px 12px 10px;
                border-radius: 10px;
                background: linear-gradient(135deg, rgba(255,77,79,0.10), rgba(255,138,42,0.06));
                border: 1px solid rgba(255,77,79,0.35);
                box-shadow: 0 2px 10px rgba(255,77,79,0.10);
            }
            .pp-outlook-cap {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 11.5px;
                font-weight: 700;
                color: #ff8a8c;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                margin-bottom: 8px;
            }
            .pp-outlook-ico {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #ff4d4f;
                box-shadow: 0 0 8px rgba(255,77,79,0.8);
                animation: ppOutlookPols 2s ease-in-out infinite;
            }
            @keyframes ppOutlookPols {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
            .pp-outlook-boto {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                padding: 8px 10px;
                margin-bottom: 5px;
                border-radius: 7px;
                cursor: pointer;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.12);
                color: var(--text-2, #c9d1d9);
                font-family: inherit;
                font-size: 12px;
                font-weight: 600;
                text-align: left;
                transition: all 0.15s ease;
            }
            .pp-outlook-boto:hover {
                background: rgba(255,77,79,0.15);
                border-color: rgba(255,77,79,0.5);
                color: #fff;
            }
            .pp-outlook-boto.actiu {
                background: rgba(255,77,79,0.24);
                border-color: rgba(255,77,79,0.75);
                color: #fff;
            }
            .pp-outlook-boto-nom { flex: 1; }
            .pp-outlook-boto-tag {
                font-size: 9px;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .pp-outlook-boto.actiu .pp-outlook-boto-tag { color: rgba(255,255,255,0.85); }

            .pp-outlook-hores {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(255,255,255,0.08);
            }
            .pp-outlook-hores-titol {
                font-size: 9.5px;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 6px;
            }
            .pp-outlook-hores-grid {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .pp-outlook-dia {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .pp-outlook-dia-titol {
                font-size: 9px;
                font-weight: 700;
                color: #8b949e;
                text-transform: uppercase;
                letter-spacing: 0.6px;
            }
            .pp-outlook-dia-fila {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 3px;
            }
            .pp-outlook-hora {
                padding: 6px 2px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 10px;
                font-weight: 600;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                color: #c9d1d9;
                font-family: inherit;
                transition: all 0.12s ease;
                text-align: center;
                line-height: 1;
                min-width: 0;
            }
            .pp-outlook-hora:hover {
                background: rgba(255,77,79,0.15);
                border-color: rgba(255,77,79,0.5);
                color: #fff;
            }
            .pp-outlook-hora.actiu {
                background: rgba(255,77,79,0.3);
                border-color: rgba(255,77,79,0.75);
                color: #fff;
            }
        `;
        document.head.appendChild(st);
    }

    // ═══════════════════════════════════════════════════════════════
    //  ACTIVAR OUTLOOK
    // ═══════════════════════════════════════════════════════════════
    async function activarOutlook(outlook, boto) {
        OUTLOOK_ACTIU = outlook;

        // Marcar botó com actiu
        document.querySelectorAll('#ppOutlookBloc .pp-outlook-boto').forEach(b => {
            b.classList.toggle('actiu', b === boto);
        });

        // Amagar el dock (barra d'hores SFC)
        amagarDock();

        const blocHores = document.getElementById('ppOutlookHores');
        const gridHores = document.getElementById('ppOutlookHoresGrid');
        if (!blocHores || !gridHores) return;

        blocHores.style.display = 'block';
        gridHores.innerHTML = '<div style="font-size:10px;color:#8b949e;padding:4px 0;">Carregant franges…</div>';

        HORES_OUTLOOK = await descobrirHores(outlook);

        if (!HORES_OUTLOOK.length) {
            gridHores.innerHTML = '<div style="font-size:10px;color:#8b949e;padding:4px 0;">Sense franges disponibles</div>';
            return;
        }

        HORES_OUTLOOK.sort((a, b) => {
            const dd = ordreDia(a.dia) - ordreDia(b.dia);
            if (dd !== 0) return dd;
            return a.hora - b.hora;
        });

        idxOutlook = 0;
        pintarHoresOutlook(gridHores);
        mostrarHoraOutlook(0);
    }

    // ═══════════════════════════════════════════════════════════════
    //  PINTAR FRANGES (agrupades per dia)
    // ═══════════════════════════════════════════════════════════════
    function pintarHoresOutlook(grid) {
        grid.innerHTML = '';

        const perDia = new Map();
        HORES_OUTLOOK.forEach((h, i) => {
            if (!perDia.has(h.dia)) perDia.set(h.dia, []);
            perDia.get(h.dia).push({ ...h, _idx: i });
        });

        const diesOrdenats = [...perDia.keys()].sort((a, b) => ordreDia(a) - ordreDia(b));

        for (const dia of diesOrdenats) {
            const horesDia = perDia.get(dia).sort((a, b) => a.hora - b.hora);

            const blocDia = document.createElement('div');
            blocDia.className = 'pp-outlook-dia';

            const titol = document.createElement('div');
            titol.className = 'pp-outlook-dia-titol';
            titol.textContent = nomDia(dia);
            blocDia.appendChild(titol);

            const fila = document.createElement('div');
            fila.className = 'pp-outlook-dia-fila';

            for (const h of horesDia) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'pp-outlook-hora';
                b.dataset.idx = h._idx;
                const hh = String(h.hora).padStart(2, '0');
                b.textContent = `${hh}h`;
                b.title = `${nomDia(dia)} ${hh}:00`;
                b.addEventListener('click', () => mostrarHoraOutlook(h._idx));
                fila.appendChild(b);
            }
            blocDia.appendChild(fila);
            grid.appendChild(blocDia);
        }
    }

    function resaltarHoraOutlook() {
        const grid = document.getElementById('ppOutlookHoresGrid');
        if (!grid) return;
        grid.querySelectorAll('.pp-outlook-hora').forEach(b => {
            const actiu = Number(b.dataset.idx) === idxOutlook;
            b.classList.toggle('actiu', actiu);
            if (actiu) b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  MOSTRAR FRANJA AL MAPA
    // ═══════════════════════════════════════════════════════════════
    function mostrarHoraOutlook(i) {
        if (i < 0 || i >= HORES_OUTLOOK.length) return;
        idxOutlook = i;
        const h = HORES_OUTLOOK[i];

        if (typeof _capa3DActiva !== 'undefined') _capa3DActiva = null;
        if (typeof _stormActual !== 'undefined') _stormActual = null;
        if (typeof _ventActual !== 'undefined') _ventActual = null;
        if (typeof _isolinesActuals !== 'undefined') _isolinesActuals = null;
        if (typeof variableActiva !== 'undefined') variableActiva = OUTLOOK_ACTIU.clau;

        const img = (typeof imgDades !== 'undefined') ? imgDades : null;
        if (img) {
            const token = (typeof _tokenDades !== 'undefined') ? (++_tokenDades) : 0;
            const pre = new Image();
            pre.decoding = 'async';
            pre.onload = () => {
                if (typeof _tokenDades !== 'undefined' && token !== _tokenDades) return;
                img.src = h.url;
                img.style.visibility = 'visible';
                if (typeof _urlDades !== 'undefined') _urlDades = h.url;
            };
            pre.onerror = () => {
                img.style.visibility = 'hidden';
            };
            pre.src = h.url;
        }

        const label = document.getElementById('current_time_label');
        if (label) {
            const hh = String(h.hora).padStart(2, '0');
            label.textContent = `${hh}:00 - ${nomDia(h.dia)}`;
        }

        if (typeof _mostrarLlegendaCss === 'function') {
            _mostrarLlegendaCss(OUTLOOK_ACTIU.clau);
        }
        if (typeof programarRedibuix === 'function') {
            programarRedibuix();
        }

        resaltarHoraOutlook();
        // Assegurar que el dock segueix amagat
        amagarDock();
    }

    // ═══════════════════════════════════════════════════════════════
    //  DESACTIVAR OUTLOOK (tornar a SFC)
    // ═══════════════════════════════════════════════════════════════
    function desactivarOutlook() {
        if (!OUTLOOK_ACTIU && DOCK_ESTAT_ORIGINAL === null) return;

        OUTLOOK_ACTIU = null;
        HORES_OUTLOOK = [];
        idxOutlook = 0;

        document.querySelectorAll('#ppOutlookBloc .pp-outlook-boto').forEach(b => {
            b.classList.remove('actiu');
        });
        const blocHores = document.getElementById('ppOutlookHores');
        if (blocHores) blocHores.style.display = 'none';

        restaurarDock();

        if (typeof tornarAModeSFC === 'function') {
            tornarAModeSFC();
        }
    }

    // Exposem la funció per si algú la vol cridar
    window.desactivarOutlook = desactivarOutlook;
    window.esOutlookActiu = () => !!OUTLOOK_ACTIU;

    // ═══════════════════════════════════════════════════════════════
    //  DETECTAR QUAN ES SELECCIONA UNA VARIABLE NORMAL
    //  → Desactivar outlook i restaurar dock
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('click', (e) => {
        // Si el clic és dins del bloc d'outlook, ignorem
        if (e.target.closest && e.target.closest('#ppOutlookBloc')) return;

        // Si el clic és en una fila de variable normal (.param-row)
        const fila = e.target.closest && e.target.closest('#ppLlistaVar .param-row');
        if (!fila) return;

        // Si estem en outlook actiu, el desactivem i restaurem el dock
        if (OUTLOOK_ACTIU) {
            desactivarOutlook();
        } else {
            // Encara que no hi hagi outlook actiu, per si el dock estava amagat
            restaurarDock();
        }
    }, true);

    // Escoltar canvi de variable des de mapapngs.js (event custom si existeix)
    window.addEventListener('tc:variableCanviada', () => {
        if (OUTLOOK_ACTIU) desactivarOutlook();
    });

    // Tecla Escape per desactivar outlook
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && OUTLOOK_ACTIU) desactivarOutlook();
    });

    // Si l'usuari clica el botó "Menú" del panell o canvia de pestanya, no fem res
    // (l'outlook segueix actiu fins que es canviï de variable)

    // ═══════════════════════════════════════════════════════════════
    //  ARRENCADA
    // ═══════════════════════════════════════════════════════════════
    esperarMapapngs(() => {
        registrarVariables();

        if (typeof construirPanellParametres === 'function') {
            try { construirPanellParametres(); } catch (e) {}
        }

        const injectarAmbReintents = (n) => {
            if (injectarSeccioOutlook()) return;
            if (n <= 0) return;
            setTimeout(() => injectarAmbReintents(n - 1), 200);
        };
        injectarAmbReintents(20);

        window.addEventListener('tc:login', () => setTimeout(injectarSeccioOutlook, 300));
        window.addEventListener('tc:logout', () => setTimeout(injectarSeccioOutlook, 300));

        console.log('outlook.js carregat — 2 outlooks (pluja, neu) + restauració automàtica del dock');
    });

})();