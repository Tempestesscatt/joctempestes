/* ════════════════════════════════════════════════════════════════════
   TOUR-GUIAT.JS — Tour interactiu guiat pel visor (CA / ES)
   ════════════════════════════════════════════════════════════════════

   COM INSTAL·LAR:
   1. Puja aquest fitxer a: meu-mapa/public/js/tour-guiat.js
   2. Al HTML, afegeix-lo DESPRÉS de tutorials.js:
        <script src="js/tutorials.js"></script>
        <script src="js/tour-guiat.js"></script>
   3. Aquest script afegeix automàticament un botó "Tutorial automàtic"
      dins del modal de Tutorials (no cal tocar tutorials.js ni l'HTML).

   COM FUNCIONA:
   - En clicar el botó, primer es mostra un selector d'idioma
     (Català / Castellano), igual que el dels vídeos.
   - Un cop triat l'idioma, comença el tour amb els textos en aquell
     idioma: es ressalta cada element real de la interfície amb un
     requadre lluminós i apareix un quadre de text amb l'explicació
     + botons Anterior / Següent / Sortir.
   - Si l'element necessita que s'obri alguna cosa abans (p.ex. el
     sidebar de paràmetres), el pas pot definir una funció "abans"
     que s'executa just abans de ressaltar-lo.

   PER EDITAR TEXTOS O PASSOS: mira la llista PASSOS_TOUR més avall.
   Cada pas té titol/text en "ca" i en "es".
   ════════════════════════════════════════════════════════════════════ */

(function () {

    // ═══════════════════════════════════════════════════════════════
    //  DEFINICIÓ DELS PASSOS DEL TOUR (bilingüe: ca / es)
    // ═══════════════════════════════════════════════════════════════

    const PASSOS_TOUR = [
        {
            selector: '#sidebar-toggle-btn',
            abans: function () { if (typeof window.tancarSidebar === 'function') window.tancarSidebar(); },
            posicio: 'right',
            ca: { titol: 'Menú de paràmetres', text: 'Aquest botó obre el panell lateral amb tots els paràmetres meteorològics disponibles: temperatura, vent, precipitació, pressió i molts més.' },
            es: { titol: 'Menú de parámetros', text: 'Este botón abre el panel lateral con todos los parámetros meteorológicos disponibles: temperatura, viento, precipitación, presión y muchos más.' }
        },
        {
            selector: '#parameter_search',
            abans: function () { if (typeof window.obrirSidebar === 'function') window.obrirSidebar(); },
            posicio: 'right',
            ca: { titol: 'Cercador de paràmetres', text: 'Escriu aquí el nom d\'un paràmetre per trobar-lo ràpidament sense haver de buscar per les categories.' },
            es: { titol: 'Buscador de parámetros', text: 'Escribe aquí el nombre de un parámetro para encontrarlo rápidamente sin tener que buscar por categorías.' }
        },
        {
            selector: '#parameter_selection',
            abans: function () { if (typeof window.obrirSidebar === 'function') window.obrirSidebar(); },
            posicio: 'right',
            ca: { titol: 'Llista de paràmetres', text: 'Aquí trobaràs totes les variables organitzades per categories: temperatura, vent, núvols, precipitació i molt més. Clica qualsevol per veure-la al mapa.' },
            es: { titol: 'Lista de parámetros', text: 'Aquí encontrarás todas las variables organizadas por categorías: temperatura, viento, nubes, precipitación y mucho más. Haz clic en cualquiera para verla en el mapa.' }
        },
        {
            selector: '#map',
            abans: function () { if (typeof window.tancarSidebar === 'function') window.tancarSidebar(); },
            posicio: 'top',
            ca: { titol: 'El mapa interactiu', text: 'Aquí es mostren les dades meteorològiques sobre el mapa de Catalunya. Pots fer zoom, moure\'t i clicar per veure valors concrets.' },
            es: { titol: 'El mapa interactivo', text: 'Aquí se muestran los datos meteorológicos sobre el mapa de Catalunya. Puedes hacer zoom, moverte y hacer clic para ver valores concretos.' }
        },
        {
            selector: '#fh_valid_outer',
            posicio: 'bottom',
            ca: { titol: 'Data i hora del mapa', text: 'Aquí veus la data i hora exacta a la qual corresponen les dades que estàs veient al mapa en aquest moment.' },
            es: { titol: 'Fecha y hora del mapa', text: 'Aquí ves la fecha y hora exacta a la que corresponden los datos que estás viendo en el mapa en este momento.' }
        },
        {
            selector: '#fh_grid',
            posicio: 'top',
            ca: { titol: 'Selector d\'hores', text: 'Desplaça\'t per aquesta franja per veure la previsió a diferents hores. Clica qualsevol hora per saltar-hi directament.' },
            es: { titol: 'Selector de horas', text: 'Desplázate por esta franja para ver la previsión a distintas horas. Haz clic en cualquier hora para saltar directamente a ella.' }
        },
        {
            selector: '#btnVent',
            posicio: 'top',
            ca: { titol: 'Capa de vent', text: 'Activa o desactiva la visualització del vent sobre el mapa.' },
            es: { titol: 'Capa de viento', text: 'Activa o desactiva la visualización del viento sobre el mapa.' }
        },
        {
            selector: '#btnVentMode',
            posicio: 'top',
            ca: { titol: 'Mode de visualització del vent', text: 'Canvia entre diferents estils de representació del vent (línies de flux, fletxes, etc.).' },
            es: { titol: 'Modo de visualización del viento', text: 'Cambia entre diferentes estilos de representación del viento (líneas de flujo, flechas, etc.).' }
        },
        {
            selector: '#btnPlay',
            posicio: 'top',
            ca: { titol: 'Animació', text: 'Prem aquí per reproduir automàticament totes les hores de previsió, com una animació del temps.' },
            es: { titol: 'Animación', text: 'Pulsa aquí para reproducir automáticamente todas las horas de previsión, como una animación del tiempo.' }
        },
        {
            selector: '#btnPrev',
            posicio: 'top',
            ca: { titol: 'Hora anterior', text: 'Retrocedeix una hora a la previsió.' },
            es: { titol: 'Hora anterior', text: 'Retrocede una hora en la previsión.' }
        },
        {
            selector: '#btnNext',
            posicio: 'top',
            ca: { titol: 'Hora següent', text: 'Avança una hora a la previsió.' },
            es: { titol: 'Hora siguiente', text: 'Avanza una hora en la previsión.' }
        },
        {
            selector: '#btnRadarLive',
            posicio: 'bottom',
            ca: { titol: 'Radar en temps real', text: 'Obre el radar meteorològic en directe, amb la reflectivitat actualitzada minut a minut.' },
            es: { titol: 'Radar en tiempo real', text: 'Abre el radar meteorológico en directo, con la reflectividad actualizada minuto a minuto.' }
        },
        {
            selector: '#btnTutorials',
            posicio: 'bottom',
            ca: { titol: 'Tutorials', text: 'Des d\'aquí sempre pots tornar a veure els vídeos explicatius o repetir aquest mateix tour guiat.' },
            es: { titol: 'Tutoriales', text: 'Desde aquí siempre puedes volver a ver los vídeos explicativos o repetir este mismo tour guiado.' }
        },
        {
            selector: '#btnXat',
            posicio: 'bottom',
            ca: { titol: 'Xat en directe', text: 'Parla amb altres usuaris de la comunitat en temps real, comenta la previsió i comparteix el que veus al cel.' },
            es: { titol: 'Chat en directo', text: 'Habla con otros usuarios de la comunidad en tiempo real, comenta la previsión y comparte lo que ves en el cielo.' }
        },
        {
            selector: '#btnGoogleLogin',
            posicio: 'bottom',
            ca: { titol: 'Iniciar sessió', text: 'Inicia sessió amb el teu compte de Google per desbloquejar paràmetres exclusius, xatejar i personalitzar el teu perfil.' },
            es: { titol: 'Iniciar sesión', text: 'Inicia sesión con tu cuenta de Google para desbloquear parámetros exclusivos, chatear y personalizar tu perfil.' }
        },
        {
            selector: '#map',
            posicio: 'top',
            ca: { titol: 'Truc final: Skew-T', text: 'Fes clic dret a qualsevol punt del mapa i selecciona "Obrir Skew-T" per veure el sondeig atmosfèric complet d\'aquell punt.' },
            es: { titol: 'Truco final: Skew-T', text: 'Haz clic derecho en cualquier punto del mapa y selecciona "Obrir Skew-T" para ver el sondeo atmosférico completo de ese punto.' }
        }
    ];

    // Textos fixos de la interfície del tour (botons, etc.)
    const TEXTOS_UI = {
        ca: { anterior: 'Anterior', seguent: 'Següent', finalitzar: 'Finalitzar', sortir: 'Sortir del tour', selecciona: 'Selecciona l\'idioma del tutorial guiat' },
        es: { anterior: 'Anterior', seguent: 'Siguiente', finalitzar: 'Finalizar', sortir: 'Salir del tour', selecciona: 'Selecciona el idioma del tutorial guiado' }
    };

    let pasActual = 0;
    let tourActiu = false;
    let idiomaActual = 'ca';

    // ═══════════════════════════════════════════════════════════════
    //  CREACIÓ DELS ELEMENTS DEL TOUR (selecció idioma + overlay + tooltip)
    // ═══════════════════════════════════════════════════════════════

    function crearElementsTour() {
        if (document.getElementById('tourOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'tourOverlay';
        overlay.className = 'tour-overlay';

        overlay.innerHTML = `
            <div class="tour-lang-modal" id="tourLangModal">
                <p class="tour-lang-titol" id="tourLangTitol"></p>
                <div class="tour-lang-opcions">
                    <button class="tour-lang-opcio" data-idioma="ca">
                        <img src="https://www.bing.com/th/id/OIP.I563r_JsKN-kxNrfRekpEAHaG2?w=193&h=179&c=8&rs=1&qlt=90&o=6&pid=ImgAns&rm=2" alt="Català">
                        <span>Català</span>
                    </button>
                    <button class="tour-lang-opcio" data-idioma="es">
                        <img src="https://th.bing.com/th/id/OIP.Bzco_ig7FaZ3CewT9GLY8AHaEv?w=276&h=180&c=7&r=0&o=7&pid=1.7&rm=3" alt="Castellano">
                        <span>Castellano</span>
                    </button>
                </div>
            </div>
            <div class="tour-highlight-box" id="tourHighlightBox"></div>
            <div class="tour-tooltip" id="tourTooltip" style="display:none;">
                <div class="tour-tooltip-header">
                    <span class="tour-tooltip-pas" id="tourPasNum">1 / ${PASSOS_TOUR.length}</span>
                    <button class="tour-tooltip-close" id="tourClose" title="Sortir">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <h4 class="tour-tooltip-titol" id="tourTitol"></h4>
                <p class="tour-tooltip-text" id="tourText"></p>
                <div class="tour-tooltip-footer">
                    <button class="tour-btn tour-btn-secundari" id="tourAnterior">
                        <i class="fas fa-arrow-left"></i> <span id="tourTextAnterior">Anterior</span>
                    </button>
                    <button class="tour-btn tour-btn-primari" id="tourSeguent">
                        <span id="tourTextSeguent">Següent</span> <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('tourClose').addEventListener('click', sortirTour);
        document.getElementById('tourAnterior').addEventListener('click', pasAnterior);
        document.getElementById('tourSeguent').addEventListener('click', pasSeguent);

        overlay.querySelectorAll('.tour-lang-opcio').forEach(function (btn) {
            btn.addEventListener('click', function () {
                idiomaActual = btn.getAttribute('data-idioma');
                document.getElementById('tourLangModal').style.display = 'none';
                document.getElementById('tourTooltip').style.display = 'block';
                comencarPassos();
            });
        });

        window.addEventListener('resize', function () {
            if (tourActiu) posicionarPas(pasActual);
        });
        document.addEventListener('keydown', function (e) {
            if (!tourActiu) return;
            if (e.key === 'Escape') sortirTour();
            if (e.key === 'ArrowRight') pasSeguent();
            if (e.key === 'ArrowLeft') pasAnterior();
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  LÒGICA DEL TOUR
    // ═══════════════════════════════════════════════════════════════

    function iniciarTour() {
        crearElementsTour();

        if (typeof window.tancarModalTutorials === 'function') {
            window.tancarModalTutorials();
        }

        tourActiu = true;
        document.body.style.overflow = 'hidden';

        const overlay = document.getElementById('tourOverlay');
        overlay.classList.add('active');

        // Sempre comencem mostrant la selecció d'idioma
        document.getElementById('tourLangModal').style.display = 'flex';
        document.getElementById('tourTooltip').style.display = 'none';
        document.getElementById('tourHighlightBox').style.display = 'none';
        document.getElementById('tourLangTitol').textContent =
            'Selecciona l\'idioma del tutorial guiat / Selecciona el idioma del tutorial guiado';
    }

    function comencarPassos() {
        pasActual = 0;
        actualitzarTextosUI();
        mostrarPas(0);
    }

    function actualitzarTextosUI() {
        const t = TEXTOS_UI[idiomaActual] || TEXTOS_UI.ca;
        document.getElementById('tourTextAnterior').textContent = t.anterior;
        const btnSeguent = document.getElementById('tourSeguent');
        btnSeguent.querySelector('#tourTextSeguent') &&
            (btnSeguent.querySelector('#tourTextSeguent').textContent = t.seguent);
        document.getElementById('tourClose').title = t.sortir;
    }

    function sortirTour() {
        tourActiu = false;
        const overlay = document.getElementById('tourOverlay');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function pasSeguent() {
        if (pasActual < PASSOS_TOUR.length - 1) {
            pasActual++;
            mostrarPas(pasActual);
        } else {
            sortirTour();
        }
    }

    function pasAnterior() {
        if (pasActual > 0) {
            pasActual--;
            mostrarPas(pasActual);
        }
    }

    function mostrarPas(index) {
        const pas = PASSOS_TOUR[index];
        if (!pas) return;
        const t = TEXTOS_UI[idiomaActual] || TEXTOS_UI.ca;
        const contingut = pas[idiomaActual] || pas.ca;

        if (typeof pas.abans === 'function') {
            try { pas.abans(); } catch (e) { console.warn('[Tour] Error executant "abans":', e); }
        }

        setTimeout(function () {
            posicionarPas(index);
        }, pas.abans ? 350 : 0);

        document.getElementById('tourPasNum').textContent = `${index + 1} / ${PASSOS_TOUR.length}`;
        document.getElementById('tourTitol').textContent = contingut.titol;
        document.getElementById('tourText').textContent = contingut.text;

        const btnAnterior = document.getElementById('tourAnterior');
        const btnSeguent = document.getElementById('tourSeguent');
        btnAnterior.style.visibility = index === 0 ? 'hidden' : 'visible';

        const spanSeguent = document.getElementById('tourTextSeguent');
        if (spanSeguent) {
            spanSeguent.textContent = index === PASSOS_TOUR.length - 1 ? t.finalitzar : t.seguent;
        }
    }

    function posicionarPas(index) {
        const pas = PASSOS_TOUR[index];
        const el = document.querySelector(pas.selector);
        const box = document.getElementById('tourHighlightBox');
        const tooltip = document.getElementById('tourTooltip');

        if (!el) {
            box.style.display = 'none';
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
            return;
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        setTimeout(function () {
            const rect = el.getBoundingClientRect();
            const marge = 8;

            box.style.display = 'block';
            box.style.top = (rect.top - marge) + 'px';
            box.style.left = (rect.left - marge) + 'px';
            box.style.width = (rect.width + marge * 2) + 'px';
            box.style.height = (rect.height + marge * 2) + 'px';

            posicionarTooltip(rect, pas.posicio || 'auto', tooltip);
        }, 300);
    }

    function posicionarTooltip(rect, posicioPreferida, tooltip) {
        tooltip.style.transform = 'none';
        const ampleTooltip = tooltip.offsetWidth || 300;
        const altTooltip = tooltip.offsetHeight || 160;
        const marge = 16;
        const finestraW = window.innerWidth;
        const finestraH = window.innerHeight;

        let posicio = posicioPreferida;
        if (posicio === 'auto') {
            posicio = rect.top > finestraH / 2 ? 'top' : 'bottom';
        }

        let top, left;

        switch (posicio) {
            case 'top':
                top = rect.top - altTooltip - marge;
                left = rect.left + rect.width / 2 - ampleTooltip / 2;
                break;
            case 'bottom':
                top = rect.bottom + marge;
                left = rect.left + rect.width / 2 - ampleTooltip / 2;
                break;
            case 'left':
                top = rect.top + rect.height / 2 - altTooltip / 2;
                left = rect.left - ampleTooltip - marge;
                break;
            case 'right':
                top = rect.top + rect.height / 2 - altTooltip / 2;
                left = rect.right + marge;
                break;
            default:
                top = rect.bottom + marge;
                left = rect.left;
        }

        if (left + ampleTooltip > finestraW - 8 || left < 8) {
            left = Math.max(8, Math.min(finestraW - ampleTooltip - 8, rect.left));
        }
        if (top < 8) {
            top = rect.bottom + marge;
        }
        if (top + altTooltip > finestraH - 8) {
            top = Math.max(8, rect.top - altTooltip - marge);
        }

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
    }

    // ═══════════════════════════════════════════════════════════════
    //  BOTÓ "TUTORIAL AUTOMÀTIC" DINS DEL MODAL DE TUTORIALS
    // ═══════════════════════════════════════════════════════════════

    function afegirBotoDinsTutorials() {
        const observer = new MutationObserver(function () {
            const seleccio = document.getElementById('tutorialsSeleccio');
            if (seleccio && !document.getElementById('btnTourAutomatic')) {
                const btn = document.createElement('button');
                btn.id = 'btnTourAutomatic';
                btn.className = 'tour-boto-automatic';
                btn.innerHTML = '<i class="fas fa-route"></i> Tutorial automàtic / Tutorial automático';
                btn.addEventListener('click', iniciarTour);
                seleccio.appendChild(btn);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ═══════════════════════════════════════════════════════════════
    //  ESTILS
    // ═══════════════════════════════════════════════════════════════

    function injectarEstils() {
        const css = `
            .tour-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(5, 10, 18, 0.72);
                z-index: 20000;
                backdrop-filter: blur(1px);
            }
            .tour-overlay.active {
                display: block;
            }

            /* Selecció d'idioma */
            .tour-lang-modal {
                display: none;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #0d1a2b;
                border: 1px solid rgba(255, 140, 0, 0.2);
                border-radius: 12px;
                box-shadow: 0 16px 50px rgba(0,0,0,0.6);
                padding: 24px 26px;
                z-index: 20003;
                flex-direction: column;
                align-items: center;
                max-width: 420px;
                width: 92vw;
            }
            .tour-lang-titol {
                margin: 0 0 18px;
                color: #e6edf3;
                font-size: 13px;
                text-align: center;
                line-height: 1.5;
            }
            .tour-lang-opcions {
                display: flex;
                gap: 14px;
                width: 100%;
                justify-content: center;
            }
            .tour-lang-opcio {
                flex: 1;
                max-width: 160px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 18px 12px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            .tour-lang-opcio:hover {
                background: rgba(255, 140, 0, 0.1);
                border-color: rgba(255, 140, 0, 0.4);
                transform: translateY(-2px);
            }
            .tour-lang-opcio img {
                width: 48px;
                height: 36px;
                object-fit: cover;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.15);
            }
            .tour-lang-opcio span {
                font-size: 12.5px;
                font-weight: 700;
                color: #e6edf3;
            }

            .tour-highlight-box {
                position: fixed;
                display: none;
                border: 2px solid #FFD700;
                border-radius: 8px;
                box-shadow: 0 0 0 4000px rgba(5, 10, 18, 0.72), 0 0 24px rgba(255, 215, 0, 0.35);
                pointer-events: none;
                transition: top 0.35s cubic-bezier(0.22,1,0.36,1), left 0.35s cubic-bezier(0.22,1,0.36,1),
                            width 0.35s cubic-bezier(0.22,1,0.36,1), height 0.35s cubic-bezier(0.22,1,0.36,1);
                z-index: 20001;
                animation: tourPulse 1.8s infinite;
            }
            @keyframes tourPulse {
                0%, 100% { border-color: #FFD700; }
                50% { border-color: #fff3b0; }
            }
            .tour-tooltip {
                position: fixed;
                width: 300px;
                max-width: 88vw;
                background: #0d1a2b;
                border: 1px solid rgba(255, 215, 0, 0.25);
                border-radius: 12px;
                box-shadow: 0 16px 50px rgba(0,0,0,0.6);
                z-index: 20002;
                padding: 14px 16px 16px;
                transition: top 0.35s cubic-bezier(0.22,1,0.36,1), left 0.35s cubic-bezier(0.22,1,0.36,1);
            }
            .tour-tooltip-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 6px;
            }
            .tour-tooltip-pas {
                font-size: 10px;
                font-weight: 700;
                color: #FFD700;
                letter-spacing: 0.4px;
                text-transform: uppercase;
            }
            .tour-tooltip-close {
                background: none;
                border: none;
                color: #556680;
                font-size: 14px;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .tour-tooltip-close:hover {
                color: #fff;
                background: rgba(255,255,255,0.08);
            }
            .tour-tooltip-titol {
                margin: 0 0 6px;
                font-size: 15px;
                font-weight: 700;
                color: #e6edf3;
            }
            .tour-tooltip-text {
                margin: 0 0 14px;
                font-size: 12.5px;
                line-height: 1.5;
                color: #b7c4d1;
            }
            .tour-tooltip-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            .tour-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 7px 14px;
                border-radius: 7px;
                font-size: 11.5px;
                font-weight: 700;
                cursor: pointer;
                border: none;
                font-family: inherit;
                transition: all 0.2s ease;
            }
            .tour-btn-primari {
                background: linear-gradient(135deg, #FFD700, #F5A623);
                color: #0d1a2b;
                margin-left: auto;
            }
            .tour-btn-primari:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 16px rgba(255, 215, 0, 0.3);
            }
            .tour-btn-secundari {
                background: rgba(255,255,255,0.06);
                color: #9fb0c3;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .tour-btn-secundari:hover {
                background: rgba(255,255,255,0.1);
                color: #fff;
            }

            .tour-boto-automatic {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: 100%;
                margin-top: 16px;
                padding: 11px 16px;
                background: linear-gradient(135deg, rgba(255, 140, 0, 0.12), rgba(255, 140, 0, 0.04));
                border: 1px solid rgba(255, 140, 0, 0.25);
                border-radius: 8px;
                color: #FF8C00;
                font-size: 12.5px;
                font-weight: 700;
                cursor: pointer;
                font-family: inherit;
                transition: all 0.25s ease;
            }
            .tour-boto-automatic:hover {
                background: linear-gradient(135deg, rgba(255, 140, 0, 0.2), rgba(255, 140, 0, 0.08));
                border-color: rgba(255, 140, 0, 0.5);
                transform: translateY(-1px);
            }

            @media (max-width: 480px) {
                .tour-tooltip {
                    width: 260px;
                }
                .tour-lang-opcio {
                    max-width: 130px;
                    padding: 14px 8px;
                }
                .tour-lang-opcio img {
                    width: 36px;
                    height: 27px;
                }
            }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ═══════════════════════════════════════════════════════════════
    //  INICIALITZACIÓ
    // ═══════════════════════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', function () {
        injectarEstils();
        afegirBotoDinsTutorials();
    });

    window.iniciarTourGuiat = iniciarTour;

})();