// ═══════════════════════════════════════════════════════════════════════
//  SELECTOR DE MODE DE CÀRREGA — PÀGINA D'ENTRADA
//
//  Aquest fitxer només s'usa a selector.html.
//  Mostra el modal, l'usuari tria, i redirigeix al visor corresponent.
//
//  FLUX:
//    selector.html  →  visor.html   (mode "normal"  = per hora)
//    selector.html  →  visor2.html  (mode "massiu"  = totes de cop)
// ═══════════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    // ─── Estils ────────────────────────────────────────────────────
    function injectarEstils() {
        if (document.getElementById('estils-mode-selector')) return;
        const style = document.createElement('style');
        style.id = 'estils-mode-selector';
        style.textContent = `
            #modeSelectorOverlay {
                position: fixed;
                inset: 0;
                background: rgba(6, 12, 20, 0.92);
                backdrop-filter: blur(10px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                opacity: 0;
                transition: opacity 0.4s ease;
            }
            #modeSelectorOverlay.visible { opacity: 1; }

            #modeSelectorBox {
                background: linear-gradient(160deg, #0f1a2a 0%, #0a1220 100%);
                border: 1px solid rgba(255, 215, 0, 0.18);
                border-radius: 18px;
                max-width: 560px;
                width: 100%;
                padding: 36px 32px 26px;
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.75);
                transform: translateY(24px) scale(0.98);
                transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
                color: #e0e8f0;
                max-height: 92vh;
                overflow-y: auto;
            }
            #modeSelectorOverlay.visible #modeSelectorBox {
                transform: translateY(0) scale(1);
            }

            #modeSelectorBox .ms-logo {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                margin-bottom: 24px;
                font-size: 15px;
                font-weight: 800;
                color: #fff;
                letter-spacing: 0.5px;
            }
            #modeSelectorBox .ms-logo span {
                color: #FFD700;
            }

            #modeSelectorBox .ms-titol {
                font-size: 24px;
                font-weight: 800;
                color: #FFD700;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                letter-spacing: -0.3px;
                text-align: center;
            }
            #modeSelectorBox .ms-subtitol {
                font-size: 13.5px;
                color: #8aa3be;
                margin-bottom: 28px;
                line-height: 1.55;
                text-align: center;
            }

            #modeSelectorBox .ms-opcions {
                display: flex;
                flex-direction: column;
                gap: 14px;
                margin-bottom: 22px;
            }

            #modeSelectorBox .ms-opcio {
                display: flex;
                align-items: flex-start;
                gap: 16px;
                padding: 18px 20px;
                background: rgba(255, 255, 255, 0.03);
                border: 1.5px solid rgba(255, 255, 255, 0.07);
                border-radius: 14px;
                cursor: pointer;
                transition: all 0.22s cubic-bezier(0.22, 1, 0.36, 1);
                text-align: left;
                color: inherit;
                font-family: inherit;
                width: 100%;
            }
            #modeSelectorBox .ms-opcio:hover {
                background: rgba(255, 255, 255, 0.07);
                border-color: rgba(255, 215, 0, 0.4);
                transform: translateY(-3px);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }
            #modeSelectorBox .ms-opcio:active {
                transform: translateY(-1px);
            }
            #modeSelectorBox .ms-opcio-icona {
                width: 48px;
                height: 48px;
                flex-shrink: 0;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
            }
            #modeSelectorBox .ms-opcio-icona.normal {
                background: linear-gradient(135deg, #1e4a7a, #2a5a8a);
                color: #7ab8ff;
                box-shadow: 0 4px 16px rgba(122, 184, 255, 0.15);
            }
            #modeSelectorBox .ms-opcio-icona.massiu {
                background: linear-gradient(135deg, #7a3a1e, #8a4a2a);
                color: #ffb87a;
                box-shadow: 0 4px 16px rgba(255, 184, 122, 0.15);
            }
            #modeSelectorBox .ms-opcio-contingut {
                flex: 1;
                min-width: 0;
            }
            #modeSelectorBox .ms-opcio-titol {
                font-size: 16px;
                font-weight: 700;
                color: #fff;
                margin-bottom: 5px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            #modeSelectorBox .ms-opcio-desc {
                font-size: 12.5px;
                color: #8aa3be;
                line-height: 1.55;
            }
            #modeSelectorBox .ms-opcio-badge {
                display: inline-block;
                font-size: 9px;
                padding: 3px 9px;
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

            #modeSelectorBox .ms-peu {
                text-align: center;
                font-size: 11.5px;
                color: #556680;
                padding-top: 18px;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                flex-wrap: wrap;
                line-height: 1.6;
            }
            #modeSelectorBox .ms-peu i {
                color: #556680;
            }

            @media (max-width: 480px) {
                #modeSelectorBox {
                    padding: 26px 20px 20px;
                }
                #modeSelectorBox .ms-titol { font-size: 19px; }
                #modeSelectorBox .ms-subtitol { font-size: 12.5px; }
                #modeSelectorBox .ms-opcio { padding: 14px 16px; }
                #modeSelectorBox .ms-opcio-icona {
                    width: 42px;
                    height: 42px;
                    font-size: 18px;
                }
                #modeSelectorBox .ms-opcio-titol { font-size: 14.5px; }
                #modeSelectorBox .ms-opcio-desc { font-size: 11.5px; }
            }
        `;
        document.head.appendChild(style);
    }

    // ─── Redirigir segons el mode ──────────────────────────────────
    function redirigir(mode) {
        if (mode === 'massiu') {
            console.log('[Mode] Redirigint a visor2.html (mode massiu)');
            window.location.href = 'visor2.html';
        } else {
            console.log('[Mode] Redirigint a visor.html (mode normal)');
            window.location.href = 'visor.html';
        }
    }

    // ─── Crear el modal ────────────────────────────────────────────
    function crearModal() {
        injectarEstils();

        const overlay = document.createElement('div');
        overlay.id = 'modeSelectorOverlay';
        overlay.innerHTML = `
            <div id="modeSelectorBox">
                <div class="ms-logo">
                    TEMPESTES<span>·CAT</span>
                </div>

                <div class="ms-titol">
                    <i class="fas fa-cloud-download-alt"></i>
                    Com vols carregar les dades?
                </div>
                <div class="ms-subtitol">
                    Escull com vols descarregar les hores de previsió.<br>
                    Ho podràs canviar quan vulguis tornant a aquesta pàgina.
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
                                Recomanat amb WiFi i si vols tenir-ho tot llest.
                            </div>
                        </div>
                    </button>
                </div>

                <div class="ms-peu">
                    <i class="fas fa-info-circle"></i>
                    <span>Pots tornar aquí sempre que vulguis canviar de mode</span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // ─── Events dels botons ────────────────────────────────────
        overlay.querySelectorAll('.ms-opcio').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;

                // Efecte visual abans de redirigir
                btn.style.borderColor = 'rgba(255, 215, 0, 0.7)';
                btn.style.background = 'rgba(255, 215, 0, 0.08)';

                // Desactivar clics posteriors
                overlay.querySelectorAll('.ms-opcio').forEach(b => {
                    b.style.pointerEvents = 'none';
                });

                // Petita animació i redirigir
                setTimeout(() => {
                    redirigir(mode);
                }, 220);
            });
        });

        // ─── Animació d'entrada ────────────────────────────────────
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
    }

    // ─── Arrancar ──────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', crearModal);
    } else {
        crearModal();
    }

    // ─── Exposar per si es vol reobrir programàticament ────────────
    window.ModeSelector = {
        obrir: function() {
            const existent = document.getElementById('modeSelectorOverlay');
            if (existent) existent.remove();
            crearModal();
        }
    };

})();