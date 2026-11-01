// ═══════════════════════════════════════════════════════════════════════
//  js/outlook.js — Outlook TOTAL agregat (51 h) · només PLUJA i NEU
//
//  · Un únic botó "Outlook total" al panell de variables.
//  · Carrega UN sol PNG: sfc_outlook_total_51h.png
//    (mapa combinat amb el màxim risc de pluja i neu al llarg de 51 h).
//  · Amaga la barra d'hores inferior (#dock) mentre l'outlook és actiu.
//  · En seleccionar una variable normal, restaura el dock i desactiva.
//
//  CÀRREGA: després de mapapngs.js, com a script clàssic.
//      <script src="js/mapapngs.js"></script>
//      <script src="js/outlook.js"></script>
// ═══════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ─── Configuració de l'outlook total (pluja + neu) ─────────────
    const OUTLOOK = {
        clau: 'outlook_total_51h',
        nom: 'Outlook total',
        desc: 'Pluja i neu · 51 h',
        fitxer: 'sfc_outlook_total_51h.png',
        llegenda: {
            titol: 'Outlook pluja i neu (51 h)',
            unitat: 'màxim assolit',
            trams: [
                { color: '#8fd98f', valor: 'Pluja feble' },
                { color: '#2e7d32', valor: 'Pluja moderada' },
                { color: '#f0c32e', valor: 'Pluja alta' },
                { color: '#ff8a2a', valor: 'Pluja molt alta' },
                { color: '#d93a30', valor: 'Pluja extrema' },
                { color: '#d94bd9', valor: 'Pluja excepcional' },
                { color: '#cce5ff', valor: 'Neu feble' },
                { color: '#99ccff', valor: 'Neu moderada' },
                { color: '#66b3ff', valor: 'Neu forta' },
                { color: '#3388ff', valor: 'Neu molt forta' },
                { color: '#0066cc', valor: 'Neu extrema' },
            ],
        },
    };

    // ─── Estat ─────────────────────────────────────────────────────
    let OUTLOOK_ACTIU = false;
    let DOCK_ESTAT_ORIGINAL = null;

    // ─── Utilitats ─────────────────────────────────────────────────
    function baseUrl() {
        if (typeof PNG_BASE !== 'undefined' && PNG_BASE) return PNG_BASE;
        const p = window.location.pathname;
        const base = p.substring(0, p.lastIndexOf('/') + 1);
        return base + 'web_data_NE/imatges/';
    }

    function urlOutlook() {
        const u = baseUrl() + OUTLOOK.fitxer;
        return (typeof ambCb === 'function') ? ambCb(u) : (u + '?_cb=' + Date.now());
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
                claus: [OUTLOOK.clau],
            });
        }
        NOMS_VARIABLES[OUTLOOK.clau] = OUTLOOK.nom;
        if (typeof VARS_SENSE_STREAMLINES !== 'undefined') {
            VARS_SENSE_STREAMLINES.add(OUTLOOK.clau);
        }
        if (typeof VARS_SENSE_ISOLINIES !== 'undefined') {
            VARS_SENSE_ISOLINIES.add(OUTLOOK.clau);
        }
        if (typeof LLEGENDES_CSS !== 'undefined') {
            LLEGENDES_CSS[OUTLOOK.clau] = OUTLOOK.llegenda;
        }
        if (typeof PARAMETRES_LLIURES !== 'undefined') {
            PARAMETRES_LLIURES.add(OUTLOOK.clau);
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
                        <span>Outlook total</span>
                    </div>
                    <div id="ppOutlookBotons"></div>
                    <div id="ppOutlookInfo" class="pp-outlook-info" style="display:none;">
                        Màxim de pluja i neu assolit a cada punt al llarg de les properes 51 h.
                    </div>
                </div>
            `;
            cont.insertBefore(bloc, cont.firstChild);
        }

        const botons = bloc.querySelector('#ppOutlookBotons');
        botons.innerHTML = '';

        const boto = document.createElement('button');
        boto.type = 'button';
        boto.className = 'pp-outlook-boto';
        boto.dataset.clau = OUTLOOK.clau;
        boto.innerHTML = `
            <span class="pp-outlook-boto-nom">${OUTLOOK.desc}</span>
            <span class="pp-outlook-boto-tag">51h</span>
        `;
        boto.addEventListener('click', () => activarOutlook(boto));
        botons.appendChild(boto);

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

            .pp-outlook-info {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(255,255,255,0.08);
                font-size: 10.5px;
                color: #8b949e;
                line-height: 1.4;
            }
        `;
        document.head.appendChild(st);
    }

    // ═══════════════════════════════════════════════════════════════
    //  ACTIVAR OUTLOOK
    // ═══════════════════════════════════════════════════════════════
    function activarOutlook(boto) {
        OUTLOOK_ACTIU = true;

        document.querySelectorAll('#ppOutlookBloc .pp-outlook-boto').forEach(b => {
            b.classList.toggle('actiu', b === boto);
        });

        amagarDock();

        const info = document.getElementById('ppOutlookInfo');
        if (info) info.style.display = 'block';

        mostrarOutlook();
    }

    // ═══════════════════════════════════════════════════════════════
    //  MOSTRAR EL PNG AL MAPA
    // ═══════════════════════════════════════════════════════════════
    function mostrarOutlook() {
        const url = urlOutlook();

        // Netejar capes actives de mapapngs
        if (typeof _capa3DActiva !== 'undefined') _capa3DActiva = null;
        if (typeof _stormActual !== 'undefined') _stormActual = null;
        if (typeof _ventActual !== 'undefined') _ventActual = null;
        if (typeof _isolinesActuals !== 'undefined') _isolinesActuals = null;
        if (typeof variableActiva !== 'undefined') variableActiva = OUTLOOK.clau;

        const img = (typeof imgDades !== 'undefined') ? imgDades : null;
        if (img) {
            const token = (typeof _tokenDades !== 'undefined') ? (++_tokenDades) : 0;
            const pre = new Image();
            pre.decoding = 'async';
            pre.onload = () => {
                if (typeof _tokenDades !== 'undefined' && token !== _tokenDades) return;
                img.src = url;
                img.style.visibility = 'visible';
                if (typeof _urlDades !== 'undefined') _urlDades = url;
            };
            pre.onerror = () => {
                img.style.visibility = 'hidden';
                console.warn('outlook.js: no s\'ha pogut carregar', url);
            };
            pre.src = url;
        }

        const label = document.getElementById('current_time_label');
        if (label) label.textContent = 'Outlook pluja i neu · 51 h';

        if (typeof _mostrarLlegendaCss === 'function') {
            _mostrarLlegendaCss(OUTLOOK.clau);
        }
        if (typeof programarRedibuix === 'function') {
            programarRedibuix();
        }

        amagarDock();
    }

    // ═══════════════════════════════════════════════════════════════
    //  DESACTIVAR OUTLOOK (tornar a SFC)
    // ═══════════════════════════════════════════════════════════════
    function desactivarOutlook() {
        if (!OUTLOOK_ACTIU && DOCK_ESTAT_ORIGINAL === null) return;

        OUTLOOK_ACTIU = false;

        document.querySelectorAll('#ppOutlookBloc .pp-outlook-boto').forEach(b => {
            b.classList.remove('actiu');
        });
        const info = document.getElementById('ppOutlookInfo');
        if (info) info.style.display = 'none';

        restaurarDock();

        if (typeof tornarAModeSFC === 'function') {
            tornarAModeSFC();
        }
    }

    window.desactivarOutlook = desactivarOutlook;
    window.esOutlookActiu = () => OUTLOOK_ACTIU;

    // ═══════════════════════════════════════════════════════════════
    //  DETECTAR QUAN ES SELECCIONA UNA VARIABLE NORMAL
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('click', (e) => {
        if (e.target.closest && e.target.closest('#ppOutlookBloc')) return;

        const fila = e.target.closest && e.target.closest('#ppLlistaVar .param-row');
        if (!fila) return;

        if (OUTLOOK_ACTIU) {
            desactivarOutlook();
        } else {
            restaurarDock();
        }
    }, true);

    window.addEventListener('tc:variableCanviada', () => {
        if (OUTLOOK_ACTIU) desactivarOutlook();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && OUTLOOK_ACTIU) desactivarOutlook();
    });

    // ═══════════════════════════════════════════════════════════════
    //  ARRENCADA
    // ═══════════════════════════════════════════════════════════════
    esperarMapapngs(() => {
        registrarVariables();

        if (typeof construirPanellParametres === 'function') {
            try { construirPanellParametres(); } catch (e) {}
        }

        const injectarAmbReintents = (n) => {
            if (typeof injectarSeccioOutlook === 'function' && injectarSeccioOutlook()) return;
            if (n <= 0) return;
            setTimeout(() => injectarAmbReintents(n - 1), 200);
        };
        injectarAmbReintents(20);

        window.addEventListener('tc:login', () => setTimeout(injectarSeccioOutlook, 300));
        window.addEventListener('tc:logout', () => setTimeout(injectarSeccioOutlook, 300));

        console.log('outlook.js carregat — outlook PLUJA + NEU agregat 51h');
    });

})();