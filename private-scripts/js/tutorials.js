/* ════════════════════════════════════════════════════════════════════
   TUTORIALS.JS — Botó "Veure tutorials" + Modal selecció d'idioma + YouTube
   ════════════════════════════════════════════════════════════════════

   COM INSTAL·LAR:
   1. Puja aquest fitxer a: meu-mapa/public/js/tutorials.js
   2. Al index.html (o mapa.html), afegeix aquesta línia DESPRÉS de
      la resta de <script src="js/..."></script>:
         <script src="js/tutorials.js"></script>
   3. Ja està. El script crea el botó i el modal automàticament,
      sense haver de tocar l'HTML existent.

   CANVIAR ELS VÍDEOS:
   Només cal editar els dos IDs de YouTube aquí sota. L'ID és la part
   final de la URL: https://youtu.be/AIXO_ES_L_ID
   ════════════════════════════════════════════════════════════════════ */

(function () {

    // ─── CONFIGURA AQUÍ ELS TEUS VÍDEOS ───────────────────────────────
    const VIDEO_CATALA = '9kg5RI2yfAU';       // https://youtu.be/9kg5RI2yfAU
    const VIDEO_CASTELLA = 'mZozN_xF87k';     // https://youtu.be/mZozN_xF87k
    // ────────────────────────────────────────────────────────────────

    function crearBotoTutorials() {
        const botoRadar = document.getElementById('btnRadarLive');
        if (!botoRadar) return;

        const boto = document.createElement('button');
        boto.type = 'button';
        boto.className = 'topnav-radar-btn';
        boto.id = 'btnTutorials';
        boto.title = 'Veure tutorials';
        boto.style.marginRight = '12px';
        boto.innerHTML = '<i class="fas fa-graduation-cap"></i> Veure tutorials';
        boto.addEventListener('click', obrirModalTutorials);

        botoRadar.insertAdjacentElement('afterend', boto);
    }

    function crearModalTutorials() {
        if (document.getElementById('tutorialsModal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'tutorialsModal';
        overlay.className = 'tutorials-modal-overlay';

        overlay.innerHTML = `
            <div class="tutorials-modal">
                <div class="tutorials-modal-header">
                    <h3><i class="fas fa-graduation-cap"></i> Tutorials</h3>
                    <button class="tutorials-modal-close" id="tutorialsModalClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="tutorials-modal-body">

                    <!-- PANTALLA 1: SELECCIÓ D'IDIOMA -->
                    <div id="tutorialsSeleccio" class="tutorials-seleccio">
                        <p class="tutorials-subtitol">Selecciona l'idioma del tutorial</p>
                        <div class="tutorials-opcions">
                            <button class="tutorials-opcio" data-idioma="catala">
                                <img class="tutorials-bandera-img" src="https://www.bing.com/th/id/OIP.I563r_JsKN-kxNrfRekpEAHaG2?w=193&h=179&c=8&rs=1&qlt=90&o=6&pid=ImgAns&rm=2" alt="Bandera catalana">
                                <span class="tutorials-nom-idioma">Català</span>
                            </button>
                            <button class="tutorials-opcio" data-idioma="castella">
                                <img class="tutorials-bandera-img" src="https://th.bing.com/th/id/OIP.Bzco_ig7FaZ3CewT9GLY8AHaEv?w=276&h=180&c=7&r=0&o=7&pid=1.7&rm=3" alt="Bandera espanyola">
                                <span class="tutorials-nom-idioma">Castellano</span>
                            </button>
                        </div>
                    </div>

                    <!-- PANTALLA 2: REPRODUCTOR -->
                    <div id="tutorialsPlayer" class="tutorials-player" style="display:none;">
                        <button class="tutorials-tornar" id="tutorialsTornar">
                            <i class="fas fa-arrow-left"></i> Canviar idioma
                        </button>
                        <div class="tutorials-video-wrapper">
                            <iframe id="tutorialsIframe"
                                    src=""
                                    title="Tutorial"
                                    frameborder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowfullscreen>
                            </iframe>
                        </div>
                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Tancar
        document.getElementById('tutorialsModalClose').addEventListener('click', tancarModalTutorials);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) tancarModalTutorials();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') tancarModalTutorials();
        });

        // Selecció d'idioma → reproduir directament
        overlay.querySelectorAll('.tutorials-opcio').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const idioma = btn.getAttribute('data-idioma');
                reproduirTutorial(idioma);
            });
        });

        // Botó "Canviar idioma"
        document.getElementById('tutorialsTornar').addEventListener('click', tornarASeleccio);
    }

    function reproduirTutorial(idioma) {
        const videoId = idioma === 'castella' ? VIDEO_CASTELLA : VIDEO_CATALA;
        const iframe = document.getElementById('tutorialsIframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

        document.getElementById('tutorialsSeleccio').style.display = 'none';
        document.getElementById('tutorialsPlayer').style.display = 'block';
    }

    function tornarASeleccio() {
        // Aturem el vídeo buidant el src
        document.getElementById('tutorialsIframe').src = '';
        document.getElementById('tutorialsPlayer').style.display = 'none';
        document.getElementById('tutorialsSeleccio').style.display = 'block';
    }

    function obrirModalTutorials() {
        crearModalTutorials();
        tornarASeleccio(); // sempre comença per la selecció d'idioma
        document.getElementById('tutorialsModal').classList.add('active');
    }

    function tancarModalTutorials() {
        const overlay = document.getElementById('tutorialsModal');
        if (!overlay) return;
        overlay.classList.remove('active');
        // Aturem el vídeo en tancar
        const iframe = document.getElementById('tutorialsIframe');
        if (iframe) iframe.src = '';
    }

    // ─── ESTILS ────────────────────────────────────────────────────────
    function injectarEstils() {
        const css = `
            .tutorials-modal-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.7);
                z-index: 10001;
                align-items: center;
                justify-content: center;
                padding: 16px;
            }
            .tutorials-modal-overlay.active {
                display: flex;
            }
            .tutorials-modal {
                background: #0d1a2b;
                border-radius: 10px;
                width: 100%;
                max-width: 640px;
                border: 1px solid rgba(255, 140, 0, 0.15);
                box-shadow: 0 12px 40px rgba(0,0,0,0.5);
                overflow: hidden;
            }
            .tutorials-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: #101d2e;
                border-bottom: 1px solid #223247;
            }
            .tutorials-modal-header h3 {
                margin: 0;
                font-size: 14px;
                color: #e6edf3;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .tutorials-modal-header h3 i {
                color: #FF8C00;
            }
            .tutorials-modal-close {
                background: transparent;
                border: none;
                color: #9fb0c3;
                font-size: 16px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .tutorials-modal-close:hover {
                background: #1a2a3d;
                color: #fff;
            }
            .tutorials-modal-body {
                padding: 20px;
            }
            .tutorials-subtitol {
                text-align: center;
                color: #9fb0c3;
                font-size: 13px;
                margin: 0 0 18px;
            }
            .tutorials-opcions {
                display: flex;
                gap: 14px;
                justify-content: center;
            }
            .tutorials-opcio {
                flex: 1;
                max-width: 220px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 24px 16px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            .tutorials-opcio:hover {
                background: rgba(255, 140, 0, 0.1);
                border-color: rgba(255, 140, 0, 0.4);
                transform: translateY(-2px);
            }
            .tutorials-bandera-img {
                width: 48px;
                height: 36px;
                object-fit: cover;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.15);
            }
            .tutorials-nom-idioma {
                font-size: 13px;
                font-weight: 700;
                color: #e6edf3;
            }
            .tutorials-tornar {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.1);
                color: #9fb0c3;
                font-size: 11px;
                font-weight: 600;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                margin-bottom: 12px;
                font-family: inherit;
            }
            .tutorials-tornar:hover {
                background: rgba(255,255,255,0.1);
                color: #fff;
            }
            .tutorials-video-wrapper {
                position: relative;
                width: 100%;
                padding-bottom: 56.25%; /* 16:9 */
                background: #000;
                border-radius: 8px;
                overflow: hidden;
            }
            .tutorials-video-wrapper iframe {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                border: none;
            }

            @media (max-width: 480px) {
                .tutorials-opcions {
                    flex-direction: column;
                    align-items: stretch;
                }
                .tutorials-opcio {
                    max-width: none;
                    flex-direction: row;
                    justify-content: center;
                    padding: 14px;
                }
                .tutorials-bandera-img {
                    width: 32px;
                    height: 24px;
                }
            }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ─── INICIALITZACIÓ ─────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        injectarEstils();
        crearBotoTutorials();
    });

    // Exposar per si cal obrir-lo des d'un altre lloc
    window.obrirModalTutorials = obrirModalTutorials;
    window.tancarModalTutorials = tancarModalTutorials;

})();