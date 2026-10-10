// ═══════════════════════════════════════════════════════════════════════
//  novetats.js — Popup de novetats al carregar la pàgina
//  Mostra un modal amb un vídeo (intocable, com un GIF) i les novetats.
//  Surt SEMPRE que s'obre la web.
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── CONFIGURACIÓ ────────────────────────────────────────────────
    const VIDEO_URL = 'dades/gfs.mp4';

    const CONTINGUT = {
        titol: 'Novetats al visor',
        subtitol: 'Ara amb model GFS global',
        descripcio: `
            <p>Hem afegit un <strong>nou selector de models</strong> al visor.
            Per veure la previsió global, ves a la pestanya <strong>Models</strong>
            i selecciona <strong>GFS</strong>.</p>

            <p>El <strong>GFS</strong> (Global Forecast System) és el model
            meteorològic global de la NOAA (Estats Units). Es basa en una
            graella de <strong>0,25° de resolució</strong> (uns 25 km) que cobreix
            tot el planeta, amb <strong>4 actualitzacions diàries</strong>
            (00, 06, 12 i 18 UTC) i previsió fins a 16 dies.</p>

            <p>A diferència dels models regionals com l'AROME, el GFS
            dona una visió de gran escala ideal per seguir
            <strong>tempestes, borrasques i fronts</strong> a tot el món.</p>

            <ul style="margin:8px 0 0 18px; padding:0; font-size:12.5px;">
                <li>Canvia de model des de la pestanya <strong>Models</strong></li>
                <li>Clic dret (o tap llarg al mòbil) al mapa per obrir el Skew-T del punt</li>
                <li>Els sondejos ara comencen a l'altitud real del terreny</li>
                <li>Properament: ICON-EU, UKMO, ARPEGE i més!</li>
            </ul>
        `,
        botoPrincipal: 'Ok, entès!',
    };

    // ─── INJECTAR CSS ────────────────────────────────────────────────
    function injectarCSS() {
        if (document.getElementById('novetatsStyles')) return;

        const css = `
        #novetatsOverlay {
            display: none;
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(0, 0, 0, 0.82);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            align-items: center; justify-content: center;
            padding: 16px;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        #novetatsOverlay.visible { display: flex; }
        #novetatsOverlay.animat { opacity: 1; }

        .novetats-modal {
            width: 100%; max-width: 720px;
            max-height: calc(100vh - 32px);
            background: #0d1117;
            border: 1px solid rgba(240, 246, 252, 0.15);
            border-radius: 14px;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.7);
            display: flex; flex-direction: column;
            overflow: hidden;
            transform: scale(0.94);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        #novetatsOverlay.animat .novetats-modal { transform: scale(1); }

        .novetats-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px 12px;
            border-bottom: 1px solid rgba(240, 246, 252, 0.08);
            flex-shrink: 0;
        }
        .novetats-titol {
            font-size: 17px; font-weight: 700;
            color: #f0f6fc;
            letter-spacing: -0.2px;
        }
        .novetats-subtitol {
            font-size: 11.5px; color: #58a6ff;
            font-weight: 600; margin-top: 3px;
            text-transform: uppercase; letter-spacing: 0.5px;
        }
        .novetats-tanca {
            background: transparent; border: none;
            color: #8b949e; font-size: 22px; cursor: pointer;
            width: 32px; height: 32px; border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            line-height: 1; padding: 0;
            transition: all 0.15s ease;
            flex-shrink: 0;
        }
        .novetats-tanca:hover {
            background: rgba(240, 246, 252, 0.08);
            color: #f0f6fc;
        }

        .novetats-cos {
            padding: 0;
            overflow-y: auto;
            flex: 1 1 auto;
            -webkit-overflow-scrolling: touch;
        }
        .novetats-cos::-webkit-scrollbar { width: 6px; }
        .novetats-cos::-webkit-scrollbar-thumb {
            background: rgba(240, 246, 252, 0.15);
            border-radius: 3px;
        }

        /* ─── Vídeo intocable ─── */
        .novetats-video-wrap {
            width: 100%;
            background: #000;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden;
            position: relative;
            aspect-ratio: 16 / 9;
            max-height: 45vh;
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
        }
        .novetats-video-wrap video {
            width: 100%; height: 100%;
            object-fit: contain;
            display: block;
            background: #000;
            pointer-events: none;    /* ← no es pot clicar */
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
        }
        .novetats-video-error {
            display: none;
            color: #8b949e; font-size: 12px;
            padding: 40px 20px;
            text-align: center;
        }

        .novetats-text {
            padding: 18px 22px 20px;
            color: #c9d1d9;
            font-size: 13.5px;
            line-height: 1.6;
        }
        .novetats-text p { margin: 0 0 10px; }
        .novetats-text p:last-child { margin-bottom: 0; }
        .novetats-text strong { color: #f0f6fc; font-weight: 600; }
        .novetats-text ul {
            margin: 10px 0 0 18px;
            padding: 0;
        }
        .novetats-text li {
            margin-bottom: 5px;
            color: #8b949e;
        }
        .novetats-text li::marker { color: #58a6ff; }

        .novetats-peu {
            padding: 14px 20px;
            border-top: 1px solid rgba(240, 246, 252, 0.08);
            display: flex; align-items: center; gap: 10px;
            justify-content: flex-end;
            flex-shrink: 0;
            flex-wrap: wrap;
        }
        .novetats-boto {
            background: linear-gradient(135deg, #58a6ff, #1f6feb);
            color: white; border: none;
            padding: 10px 22px;
            border-radius: 8px;
            font-size: 13px; font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            letter-spacing: 0.2px;
            transition: all 0.15s ease;
            box-shadow: 0 4px 14px rgba(88, 166, 255, 0.3);
            white-space: nowrap;
        }
        .novetats-boto:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(88, 166, 255, 0.4);
        }
        .novetats-boto:active { transform: translateY(0); }

        @media (max-width: 600px) {
            #novetatsOverlay { padding: 0; }
            .novetats-modal {
                max-width: 100%;
                max-height: 100vh;
                height: 100vh;
                border-radius: 0;
                border: none;
            }
            .novetats-header { padding: 14px 16px 10px; }
            .novetats-titol { font-size: 15px; }
            .novetats-text {
                padding: 14px 16px 16px;
                font-size: 13px;
            }
            .novetats-peu {
                padding: 12px 16px;
                padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
            }
            .novetats-boto {
                padding: 11px 20px;
                flex: 1 1 100%;
            }
        }
        `;

        const style = document.createElement('style');
        style.id = 'novetatsStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ─── CREAR EL MODAL ──────────────────────────────────────────────
    function crearModal() {
        injectarCSS();

        const overlay = document.createElement('div');
        overlay.id = 'novetatsOverlay';
        overlay.innerHTML = `
            <div class="novetats-modal" role="dialog" aria-modal="true">
                <div class="novetats-header">
                    <div>
                        <div class="novetats-titol">${CONTINGUT.titol}</div>
                        <div class="novetats-subtitol">${CONTINGUT.subtitol}</div>
                    </div>
                    <button class="novetats-tanca" id="novetatsTanca" aria-label="Tancar">X</button>
                </div>
                <div class="novetats-cos">
                    <div class="novetats-video-wrap" id="novetatsVideoWrap">
                        <video id="novetatsVideo"
                               autoplay loop muted playsinline
                               preload="auto"
                               disablepictureinpicture
                               disableremoteplayback
                               controlslist="nodownload nofullscreen noremoteplayback noplaybackrate">
                            <source src="${VIDEO_URL}" type="video/mp4">
                        </video>
                        <div class="novetats-video-error" id="novetatsVideoError">
                            (No s'ha pogut carregar el video de novetats)
                        </div>
                    </div>
                    <div class="novetats-text">
                        ${CONTINGUT.descripcio}
                    </div>
                </div>
                <div class="novetats-peu">
                    <button class="novetats-boto" id="novetatsBoto">
                        ${CONTINGUT.botoPrincipal}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        return overlay;
    }

    // ─── MOSTRAR ─────────────────────────────────────────────────────
    function mostrar() {
        if (document.getElementById('novetatsOverlay')) return;

        const overlay = crearModal();

        const video = document.getElementById('novetatsVideo');
        const videoWrap = document.getElementById('novetatsVideoWrap');
        const videoErr = document.getElementById('novetatsVideoError');

        if (video) {
            // ─── BLOQUEJAR INTERACCIÓ ─────────────────────────────
            // Clic dret
            video.addEventListener('contextmenu', e => e.preventDefault());
            // Intent de pausa (si algú ho intenta per consola, es torna a engegar)
            video.addEventListener('pause', () => {
                if (overlay.classList.contains('animat')) {
                    setTimeout(() => video.play().catch(() => {}), 50);
                }
            });
            // Intent de canviar el temps
            video.addEventListener('seeking', () => {
                if (video.currentTime > 0.5 && overlay.classList.contains('animat')) {
                    // Si l'usuari mira d'avançar o enrere, ho ignorem
                    // (no podem bloquejar-ho del tot, però el pointer-events: none ho evita)
                }
            });
            // Error del vídeo
            video.addEventListener('error', () => {
                video.style.display = 'none';
                videoErr.style.display = 'block';
            });

            // ─── AUTO-PLAY ────────────────────────────────────────
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    // Si l'autoplay falla, intentem forçar-lo igualment
                    // (alguns navegadors requereixen muted, ja ho està)
                    video.muted = true;
                    video.play().catch(() => {});
                });
            }
        }

        // Bloquejar clic dret sobre TOT el vídeo wrap
        if (videoWrap) {
            videoWrap.addEventListener('contextmenu', e => e.preventDefault());
        }

        // ─── MOSTRAR ──────────────────────────────────────────────
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
            requestAnimationFrame(() => overlay.classList.add('animat'));
        });

        const scrollPrevi = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // ─── TANCAR ───────────────────────────────────────────────
        function tancar() {
            if (video) {
                try {
                    video.pause();
                    video.currentTime = 0;
                    video.removeAttribute('src');
                    video.load();
                } catch (e) {}
            }
            overlay.classList.remove('animat');
            setTimeout(() => {
                overlay.classList.remove('visible');
                overlay.remove();
                document.body.style.overflow = scrollPrevi;
            }, 300);
        }

        document.getElementById('novetatsTanca').addEventListener('click', tancar);
        document.getElementById('novetatsBoto').addEventListener('click', tancar);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) tancar();
        });

        function onEsc(e) {
            if (e.key === 'Escape') {
                tancar();
                document.removeEventListener('keydown', onEsc);
            }
        }
        document.addEventListener('keydown', onEsc);
    }

    // ─── INICIALITZAR ────────────────────────────────────────────────
    function inicialitzar() {
        setTimeout(() => {
            const loading = document.getElementById('loading_overlay');
            if (loading && !loading.classList.contains('hidden')) {
                const interval = setInterval(() => {
                    if (loading.classList.contains('hidden')) {
                        clearInterval(interval);
                        setTimeout(mostrar, 400);
                    }
                }, 200);
                setTimeout(() => {
                    clearInterval(interval);
                    if (!document.getElementById('novetatsOverlay')) mostrar();
                }, 5000);
            } else {
                setTimeout(mostrar, 400);
            }
        }, 600);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicialitzar);
    } else {
        inicialitzar();
    }

    window.mostrarNovetats = function () {
        mostrar();
    };
})();