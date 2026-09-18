// ═══════════════════════════════════════════════════════════════════════
//  SELECTOR DE MODE DE CÀRREGA
//  Mostra un modal a l'usuari preguntant com vol carregar les dades.
//  Si l'usuari marca "No tornar a preguntar", es guarda per sempre.
//
//  FLUX:
//    - visor.html  → mapa.js   (mode "normal"  = per hora / sota demanda)
//    - visor2.html → mapa2.js  (mode "massiu"  = totes de cop)
//
//  El modal apareix a TOTES dues pàgines si no hi ha "no preguntar".
//  En clicar una opció, es redirigeix a la pàgina corresponent.
// ═══════════════════════════════════════════════════════════════════════

(function() {
    'use strict';

const CLAU_STORAGE_MODE = 'tempestescat_mode_carrega_v1';
const CLAU_STORAGE_NO_PREGUNTAR = 'tempestescat_no_preguntar_v1';
const CLAU_SESSION_JA_ELEGIT = 'tempestescat_ja_elegit_sessio';   // ← NUEVA

    // ─── Detectar en quina pàgina estem ────────────────────────────
    function estemAVisor2() {
        return window.location.pathname.toLowerCase().includes('visor2.html');
    }

    function estemAVisor1() {
        return !estemAVisor2() &&
               window.location.pathname.toLowerCase().includes('visor.html');
    }

    // ─── URL objectiu segons mode ──────────────────────────────────
    function urlPerMode(mode) {
        return mode === 'massiu' ? 'visor2.html' : 'visor.html';
    }

    // ─── Carregar el JS o redirigir ─────────────────────────────────
    function carregarMapa(mode) {
        if (window._mapaJaCarregat) {
            console.log('[Mode] Mapa ja carregat, no es torna a carregar');
            return;
        }

        const esVisor2 = estemAVisor2();
        const esVisor1 = estemAVisor1();

        // ─── Mode NORMAL (per hora) ────────────────────────────────
        if (mode === 'normal') {
            if (esVisor2) {
                // Estem a visor2.html però volem mode normal → redirigim
                console.log('[Mode] Redirigint a visor.html (mode normal)');
                window.location.href = 'visor.html';
                return;
            }
            // Ja estem a visor.html (o pàgina equivalent) → carreguem mapa.js
            window._mapaJaCarregat = true;
            const script = document.createElement('script');
            script.src = 'mapa.js';
            script.async = false;
            document.body.appendChild(script);
            console.log('[Mode] Carregant mapa.js (mode normal)');
            return;
        }

        // ─── Mode MASSIU (totes de cop) ────────────────────────────
        if (mode === 'massiu') {
            if (!esVisor2) {
                // Estem a visor.html (o equivalent) però volem massiu → redirigim
                console.log('[Mode] Redirigint a visor2.html (mode massiu)');
                window.location.href = 'visor2.html';
                return;
            }
            // Ja estem a visor2.html → carreguem mapa2.js
            window._mapaJaCarregat = true;
            const script = document.createElement('script');
            script.src = 'mapa2.js';
            script.async = false;
            document.body.appendChild(script);
            console.log('[Mode] Carregant mapa2.js (mode massiu)');
            return;
        }

        console.warn('[Mode] Mode desconegut:', mode);
    }

    // ─── Estils del modal ──────────────────────────────────────────
    function injectarEstils() {
        if (document.getElementById('estils-mode-selector')) return;
        const style = document.createElement('style');
        style.id = 'estils-mode-selector';
        style.textContent = `
            #modeSelectorOverlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(8px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            #modeSelectorOverlay.visible { opacity: 1; }

            #modeSelectorBox {
                background: linear-gradient(160deg, #0f1a2a 0%, #0a1220 100%);
                border: 1px solid rgba(255, 215, 0, 0.15);
                border-radius: 16px;
                max-width: 540px;
                width: 100%;
                padding: 32px 28px 24px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
                transform: translateY(20px);
                transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
                color: #e0e8f0;
                max-height: 92vh;
                overflow-y: auto;
            }
            #modeSelectorOverlay.visible #modeSelectorBox {
                transform: translateY(0);
            }

            #modeSelectorBox .ms-titol {
                font-size: 22px;
                font-weight: 800;
                color: #FFD700;
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 10px;
                letter-spacing: -0.3px;
            }
            #modeSelectorBox .ms-subtitol {
                font-size: 13px;
                color: #8aa3be;
                margin-bottom: 22px;
                line-height: 1.5;
            }

            #modeSelectorBox .ms-opcions {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 20px;
            }

            #modeSelectorBox .ms-opcio {
                display: flex;
                align-items: flex-start;
                gap: 14px;
                padding: 16px 18px;
                background: rgba(255, 255, 255, 0.03);
                border: 1.5px solid rgba(255, 255, 255, 0.06);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: left;
                color: inherit;
                font-family: inherit;
                width: 100%;
            }
            #modeSelectorBox .ms-opcio:hover {
                background: rgba(255, 255, 255, 0.06);
                border-color: rgba(255, 215, 0, 0.35);
                transform: translateY(-2px);
            }
            #modeSelectorBox .ms-opcio:active {
                transform: translateY(0);
            }
            #modeSelectorBox .ms-opcio-icona {
                width: 42px;
                height: 42px;
                flex-shrink: 0;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }
            #modeSelectorBox .ms-opcio-icona.normal {
                background: linear-gradient(135deg, #1e4a7a, #2a5a8a);
                color: #7ab8ff;
            }
            #modeSelectorBox .ms-opcio-icona.massiu {
                background: linear-gradient(135deg, #7a3a1e, #8a4a2a);
                color: #ffb87a;
            }
            #modeSelectorBox .ms-opcio-contingut {
                flex: 1;
                min-width: 0;
            }
            #modeSelectorBox .ms-opcio-titol {
                font-size: 15px;
                font-weight: 700;
                color: #fff;
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            #modeSelectorBox .ms-opcio-desc {
                font-size: 12.5px;
                color: #8aa3be;
                line-height: 1.5;
            }
            #modeSelectorBox .ms-opcio-badge {
                display: inline-block;
                font-size: 9px;
                padding: 2px 8px;
                border-radius: 10px;
                background: rgba(67, 233, 123, 0.15);
                color: #43e97b;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            #modeSelectorBox .ms-opcio-badge.warn {
                background: rgba(255, 180, 0, 0.15);
                color: #ffb400;
            }

            #modeSelectorBox .ms-no-preguntar-wrap {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 12px 14px;
                background: rgba(255, 215, 0, 0.04);
                border: 1px solid rgba(255, 215, 0, 0.12);
                border-radius: 10px;
                margin-bottom: 18px;
                cursor: pointer;
                transition: all 0.2s;
                user-select: none;
            }
            #modeSelectorBox .ms-no-preguntar-wrap:hover {
                background: rgba(255, 215, 0, 0.08);
                border-color: rgba(255, 215, 0, 0.25);
            }
            #modeSelectorBox .ms-no-preguntar-wrap input[type="checkbox"] {
                width: 18px;
                height: 18px;
                margin-top: 1px;
                flex-shrink: 0;
                cursor: pointer;
                accent-color: #FFD700;
            }
            #modeSelectorBox .ms-no-preguntar-label {
                font-size: 12.5px;
                color: #c8d8e8;
                line-height: 1.5;
                cursor: pointer;
            }
            #modeSelectorBox .ms-no-preguntar-label strong {
                color: #FFD700;
                font-weight: 700;
            }
            #modeSelectorBox .ms-no-preguntar-hint {
                display: block;
                font-size: 11px;
                color: #667788;
                margin-top: 3px;
                font-weight: 400;
            }

            #modeSelectorBox .ms-peu {
                text-align: center;
                font-size: 11px;
                color: #556680;
                padding-top: 14px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            #modeSelectorBox .ms-peu a {
                color: #7ab8ff;
                text-decoration: none;
                cursor: pointer;
            }
            #modeSelectorBox .ms-peu a:hover { text-decoration: underline; }

            #modeAutoBanner {
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%) translateY(-20px);
                background: rgba(10, 16, 26, 0.95);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 215, 0, 0.2);
                border-radius: 10px;
                padding: 10px 18px;
                color: #c8d8e8;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                font-size: 12px;
                z-index: 9998;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
                display: flex;
                align-items: center;
                gap: 12px;
                max-width: 92vw;
            }
            #modeAutoBanner.visible {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            #modeAutoBanner strong {
                color: #FFD700;
            }
            #modeAutoBanner .mb-canviar {
                color: #7ab8ff;
                text-decoration: none;
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
            }
            #modeAutoBanner .mb-canviar:hover {
                text-decoration: underline;
            }
            #modeAutoBanner .mb-tancar {
                background: none;
                border: none;
                color: #556680;
                font-size: 14px;
                cursor: pointer;
                padding: 0 4px;
                line-height: 1;
            }
            #modeAutoBanner .mb-tancar:hover { color: #fff; }

            @media (max-width: 480px) {
                #modeSelectorBox {
                    padding: 24px 18px 20px;
                }
                #modeSelectorBox .ms-titol { font-size: 18px; }
                #modeSelectorBox .ms-opcio { padding: 12px 14px; }
                #modeAutoBanner {
                    font-size: 11px;
                    padding: 8px 12px;
                    top: 70px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ─── Crear el modal ────────────────────────────────────────────
    function crearModal() {
        injectarEstils();

        const overlay = document.createElement('div');
        overlay.id = 'modeSelectorOverlay';
        overlay.innerHTML = `
            <div id="modeSelectorBox">
                <div class="ms-titol">
                    <i class="fas fa-cloud-download-alt"></i>
                    Com vols carregar les dades?
                </div>
                <div class="ms-subtitol">
                    Escull com vols descarregar les hores de previsió. Ho pots canviar si recarregues la pàgina.
                </div>

                <div class="ms-opcions">
                    <button class="ms-opcio" data-mode="normal">
                        <div class="ms-opcio-icona normal">
                            <i class="fas fa-hourglass-half"></i>
                        </div>
                        <div class="ms-opcio-contingut">
                            <div class="ms-opcio-titol">
                                Carregar per hora
                                <span class="ms-opcio-badge">Recomanat</span>
                            </div>
                            <div class="ms-opcio-desc">
                                Les dades es descarreguen només quan cliques cada hora.
                                Bona connexió = càrrega ràpida i poc consum de dades.
                                Ideal per navegar a poc a poc.
                            </div>
                        </div>
                    </button>

                    <button class="ms-opcio" data-mode="massiu">
                        <div class="ms-opcio-icona massiu">
                            <i class="fas fa-bolt"></i>
                        </div>
                        <div class="ms-opcio-contingut">
                            <div class="ms-opcio-titol">
                                Carregar totes de cop
                                <span class="ms-opcio-badge warn">~200/500 MB</span>
                            </div>
                            <div class="ms-opcio-desc">
                                Descarrega TOTES les hores d'una sola vegada en segon pla.
                                Pot trigar força estona i consumir moltes dades.
                                Recomanat amb WiFi lent i si vols tenir-ho tot llest.
                            </div>
                        </div>
                    </button>
                </div>

           

                <div class="ms-peu">
                    <span><i class="fas fa-info-circle"></i> Sense marcar, es preguntarà cada visita</span>
                    <a id="msReset" style="display:none;">Esborrar preferència</a>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // ─── Events dels botons de mode ────────────────────────────
        overlay.querySelectorAll('.ms-opcio').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                const noPreguntar = document.getElementById('msNoPreguntar').checked;
                seleccionarMode(mode, noPreguntar);
            });
        });

        // ─── Botó de reset (només si hi ha preferència guardada) ───
        const teNoPreguntarGuardat = localStorage.getItem(CLAU_STORAGE_NO_PREGUNTAR) === 'true';
        const msReset = document.getElementById('msReset');
        if (teNoPreguntarGuardat) {
            msReset.style.display = 'inline';
        }
        msReset.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                localStorage.removeItem(CLAU_STORAGE_MODE);
                localStorage.removeItem(CLAU_STORAGE_NO_PREGUNTAR);
            } catch (err) {}
            alert('Preferència esborrada. Es tornarà a preguntar la propera vegada.');
        });

        // ─── Animació d'entrada ────────────────────────────────────
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });

        return overlay;
    }

function seleccionarMode(mode, noPreguntar) {
    try {
        localStorage.setItem(CLAU_STORAGE_MODE, mode);
        if (noPreguntar) {
            localStorage.setItem(CLAU_STORAGE_NO_PREGUNTAR, 'true');
        } else {
            localStorage.removeItem(CLAU_STORAGE_NO_PREGUNTAR);
        }
        // ✅ Marcar que ya ha elegido en esta sesión
        sessionStorage.setItem(CLAU_SESSION_JA_ELEGIT, mode);
    } catch (e) {}

    const overlay = document.getElementById('modeSelectorOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
    }

    carregarMapa(mode);
}

    // ─── Comprovem si hi ha preferència guardada ───────────────────
    function getModeGuardat() {
        try {
            return localStorage.getItem(CLAU_STORAGE_MODE);
        } catch (e) {
            return null;
        }
    }

    function teNoPreguntarGuardat() {
        try {
            return localStorage.getItem(CLAU_STORAGE_NO_PREGUNTAR) === 'true';
        } catch (e) {
            return false;
        }
    }

    // ─── Banner informatiu quan es carrega automàticament ──────────
    function mostrarBannerAuto(mode) {
        injectarEstils();

        const banner = document.createElement('div');
        banner.id = 'modeAutoBanner';
        banner.innerHTML = `
            <span>
                Mode <strong>${mode === 'massiu' ? 'càrrega massiva' : 'per hora'}</strong> actiu
            </span>
            <a class="mb-canviar" id="mbCanviar">Canviar</a>
            <button class="mb-tancar" id="mbTancar" title="Tancar">✕</button>
        `;
        document.body.appendChild(banner);

        setTimeout(() => banner.classList.add('visible'), 400);

        const tancarBanner = () => {
            banner.classList.remove('visible');
            setTimeout(() => banner.remove(), 400);
        };

        document.getElementById('mbTancar').addEventListener('click', tancarBanner);

        document.getElementById('mbCanviar').addEventListener('click', () => {
            try {
                localStorage.removeItem(CLAU_STORAGE_MODE);
                localStorage.removeItem(CLAU_STORAGE_NO_PREGUNTAR);
            } catch (e) {}
            location.reload();
        });

        setTimeout(tancarBanner, 8000);
    }

    // ─── Inicialitzar ──────────────────────────────────────────────
    function inicialitzar() {
        const modeGuardat = getModeGuardat();
        const noPreguntar = teNoPreguntarGuardat();
        const esVisor2 = estemAVisor2();
        const esVisor1 = estemAVisor1();

        console.log(`[Mode] modeGuardat=${modeGuardat} noPreguntar=${noPreguntar} visor1=${esVisor1} visor2=${esVisor2}`);

        // ─── Cas 1: L'usuari ja va dir "no preguntar" ──────────────
        if (noPreguntar && (modeGuardat === 'normal' || modeGuardat === 'massiu')) {
            console.log(`[Mode] Carregant directament mode: ${modeGuardat}`);
            carregarMapa(modeGuardat);
            mostrarBannerAuto(modeGuardat);
            return;
        }

        // ─── Cas 2: Sempre preguntem (a visor.html I a visor2.html) ─
        console.log('[Mode] Mostrant selector');
        crearModal();
    }

    // ─── Exposar funcions globals ──────────────────────────────────
    window.ModeCarrega = {
        canviar: function(mode) {
            if (mode !== 'normal' && mode !== 'massiu') return;
            try {
                localStorage.setItem(CLAU_STORAGE_MODE, mode);
            } catch (e) {}
            // Si estem a la pàgina equivocada, redirigim
            const esVisor2 = estemAVisor2();
            if (mode === 'massiu' && !esVisor2) {
                window.location.href = 'visor2.html';
            } else if (mode === 'normal' && esVisor2) {
                window.location.href = 'visor.html';
            } else {
                location.reload();
            }
        },
        actual: function() {
            return getModeGuardat();
        },
        noPreguntarActiu: function() {
            return teNoPreguntarGuardat();
        },
        reset: function() {
            try {
                localStorage.removeItem(CLAU_STORAGE_MODE);
                localStorage.removeItem(CLAU_STORAGE_NO_PREGUNTAR);
            } catch (e) {}
        },
        obrirSelector: function() {
            try {
                localStorage.removeItem(CLAU_STORAGE_MODE);
                localStorage.removeItem(CLAU_STORAGE_NO_PREGUNTAR);
            } catch (e) {}
            // Tornem sempre a visor.html per mostrar el selector net
            window.location.href = 'visor.html';
        }
    };

    // ─── Arrancar quan el DOM estigui llest ────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicialitzar);
    } else {
        inicialitzar();
    }

})();