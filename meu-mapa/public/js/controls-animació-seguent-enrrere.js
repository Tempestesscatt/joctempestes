/* ════════════════════════════════════════════════════════════════════
   CONTROLS-FIX.JS — Connecta els botons de #controls que no funcionaven
   ════════════════════════════════════════════════════════════════════

   PROBLEMA DETECTAT:
   - btnVent i btnVentMode: la lògica ja existia a mapa.js
     (window.toggleVent / window.toggleVentMode) però el botó no tenia
     cap onclick ni addEventListener que la cridés.
   - btnPrev, btnNext, btnPlay: no existia CAP lògica enlloc. Aquest
     fitxer l'afegeix des de zero, reutilitzant mostrarHora() i
     totesLesHores/curIdx que ja defineix mapa.js.

   COM INSTAL·LAR:
   Puja aquest fitxer a meu-mapa/public/js/controls-fix.js i afegeix-lo
   AL FINAL de tots els altres <script>, just abans de tancar </body>,
   per assegurar que mapa.js ja ha definit mostrarHora/totesLesHores:

       <script src="js/mapa.js"></script>
       ... (resta de scripts existents) ...
       <script src="js/controls-fix.js"></script>
   ════════════════════════════════════════════════════════════════════ */

(function () {

    const VELOCITAT_ANIMACIO_MS = 1500; // 1.5s per hora (normal)

    let animacioActiva = false;
    let intervalAnimacio = null;

    function esperarElement(id, callback, intents) {
        intents = intents || 0;
        const el = document.getElementById(id);
        if (el) {
            callback(el);
            return;
        }
        if (intents > 40) {
            console.warn('[controls-fix] No s\'ha trobat #' + id + ' després de diversos intents');
            return;
        }
        setTimeout(() => esperarElement(id, callback, intents + 1), 250);
    }

    // ═══════════════════════════════════════════════════════════════
    //  LECTURA DE L'HORA ACTUAL — mapa.js NO exposa window.curIdx
    //  (és una variable privada del seu scope), així que llegim
    //  l'índex real des del DOM, mirant quin .fh-item té .active.
    // ═══════════════════════════════════════════════════════════════

    function obtenirIdxActual() {
        const actiu = document.querySelector('.fh-item.active');
        if (actiu && actiu.dataset && actiu.dataset.idx !== undefined) {
            const n = parseInt(actiu.dataset.idx, 10);
            if (!isNaN(n)) return n;
        }
        // Fallback: si window.curIdx existent per alguna versió futura de mapa.js
        if (typeof window.curIdx === 'number') return window.curIdx;
        return 0;
    }

    // ═══════════════════════════════════════════════════════════════
    //  VENT — punt de control ÚNIC que respecta window._ventMode
    //  (la mateixa variable que fa servir el panell d'ajustos), i que
    //  només activa el motor que toca: streamlines O partícules, mai
    //  els dos alhora.
    // ═══════════════════════════════════════════════════════════════

    function ventEstaActiuAra() {
        if (window._ventMode === 'particles') {
            return typeof window.Vent !== 'undefined' && window.Vent.estaActiu();
        }
        return !!window.ventEnabled;
    }

    function apagarTotElVent() {
        // Streamlines
        window.ventEnabled = false;
        if (typeof window.canvasVent !== 'undefined' && window.canvasVent && typeof window.ctxVent !== 'undefined' && window.ctxVent) {
            window.ctxVent.clearRect(0, 0, window.canvasVent.width, window.canvasVent.height);
        }
        // Partícules
        if (typeof window.Vent !== 'undefined' && window.Vent.estaActiu()) {
            window.Vent.aturar();
        }
    }

    // Neteja CONTÍNUA mentre el mode actiu sigui partícules: en comptes de
    // netejar només durant una finestra de temps (que pot no ser suficient
    // si el redraw de streamlines arriba tard), mantenim un bucle que
    // esborra el canvas de streamlines sempre que detecti que no toca
    // mostrar-se — independentment de si el mapa s'ha mogut o no.
    let _rafNetejaVent = null;

    function _bucleNetejaVentSiCal() {
        const tocaStreamlines = window._ventMode !== 'particles' && window.ventEnabled;
        if (!tocaStreamlines) {
            if (typeof window.canvasVent !== 'undefined' && window.canvasVent && typeof window.ctxVent !== 'undefined' && window.ctxVent) {
                // Només netegem si hi ha algun píxel pintat, per no cridar
                // clearRect a cada frame sense necessitat (és barat, però per claredat)
                window.ctxVent.clearRect(0, 0, window.canvasVent.width, window.canvasVent.height);
            }
        }
        _rafNetejaVent = requestAnimationFrame(_bucleNetejaVentSiCal);
    }

    function iniciarBucleNetejaVent() {
        if (_rafNetejaVent) return;
        _rafNetejaVent = requestAnimationFrame(_bucleNetejaVentSiCal);
    }

    // Interceptem la funció real de dibuix de streamlines (si existeix)
    // perquè es negui a dibuixar quan el mode actiu no sigui streamlines.
    // Això evita el problema de fons: mapa.js només la crida en events
    // moveend/zoomend, així que si no interceptem, un redraw tardà pot
    // pintar streamlines encara que haguem canviat a partícules.
    function interceptarDibuixStreamlinesSiCal() {
        if (typeof window._dibuixarStreamlines !== 'function') return false;
        if (window._dibuixarStreamlines.__interceptat) return true;

        const original = window._dibuixarStreamlines;
        const nova = function () {
            if (window._ventMode === 'particles') {
                // No toca dibuixar streamlines: assegurem que el canvas queda net
                if (typeof window.canvasVent !== 'undefined' && window.canvasVent && typeof window.ctxVent !== 'undefined' && window.ctxVent) {
                    window.ctxVent.clearRect(0, 0, window.canvasVent.width, window.canvasVent.height);
                }
                return;
            }
            return original.apply(this, arguments);
        };
        nova.__interceptat = true;
        window._dibuixarStreamlines = nova;
        return true;
    }

    function apagarTotElVent() {
        // Streamlines
        window.ventEnabled = false;
        if (typeof window.canvasVent !== 'undefined' && window.canvasVent && typeof window.ctxVent !== 'undefined' && window.ctxVent) {
            window.ctxVent.clearRect(0, 0, window.canvasVent.width, window.canvasVent.height);
        }
        // Partícules
        if (typeof window.Vent !== 'undefined' && window.Vent.estaActiu()) {
            window.Vent.aturar();
        }
    }

    function apagarTotElVentAmbNetejaForçada() {
        apagarTotElVent();
        iniciarBucleNetejaVent();
    }

    function engegarVentSegonsMode() {
        if (window._ventMode === 'particles') {
            if (typeof window.Vent !== 'undefined') window.Vent.iniciar();
        } else {
            window.ventEnabled = true;
            if (typeof window.redibuixarVent === 'function') window.redibuixarVent();
        }
    }

    function actualitzarBotoVentUI(btn) {
        const actiu = ventEstaActiuAra();
        btn.classList.toggle('active', actiu);
    }

    function actualitzarBotoVentModeUI(btn) {
        const esParticules = window._ventMode === 'particles';
        btn.innerHTML = esParticules ? '✦ Partícules' : '〜 Streamlines';
    }

    // ─── VENT ON/OFF ────────────────────────────────────────────────
    esperarElement('btnVent', function (btn) {
        // Si window._ventMode encara no existeix (panell no inicialitzat), per defecte streamlines
        if (typeof window._ventMode === 'undefined') window._ventMode = 'streamlines';

        actualitzarBotoVentUI(btn);

        btn.addEventListener('click', function () {
            if (ventEstaActiuAra()) {
                apagarTotElVentAmbNetejaForçada();
            } else {
                engegarVentSegonsMode();
            }
            actualitzarBotoVentUI(btn);
        });
    });

    // ─── MODE VENT (streamlines / partícules) ──────────────────────
    esperarElement('btnVentMode', function (btn) {
        if (typeof window._ventMode === 'undefined') window._ventMode = 'streamlines';

        actualitzarBotoVentModeUI(btn);

        btn.addEventListener('click', function () {
            const estavaActiu = ventEstaActiuAra();
            const modeAnterior = window._ventMode;

            // Apaguem el motor actual abans de canviar de mode (amb neteja forçada i prolongada)
            apagarTotElVentAmbNetejaForçada();

            // Canviem de mode
            window._ventMode = window._ventMode === 'particles' ? 'streamlines' : 'particles';

            // Si estava actiu, reengeguem amb el nou mode. Si venim de streamlines
            // cap a partícules, esperem una mica més perquè el canvas de streamlines
            // (canvasVent) i el de partícules (canvasParticulesVent) són elements
            // DOM diferents i no interfereixen entre ells — el retard només cal
            // per no competir amb el propi window.ventEnabled=false just posat.
            if (estavaActiu) {
                setTimeout(function () {
                    engegarVentSegonsMode();
                }, modeAnterior === 'streamlines' ? 120 : 60);
            }

            actualitzarBotoVentModeUI(btn);
            const btnVent = document.getElementById('btnVent');
            if (btnVent) actualitzarBotoVentUI(btnVent);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    //  ANTERIOR / SEGÜENT — respectant el bloqueig de login
    //  (mapa.js: si no hi ha sessió, només es poden veure índexs
    //  múltiples de 3; qualsevol altre dispara loginWithGoogle i surt)
    // ═══════════════════════════════════════════════════════════════

    function hiHaSessio() {
        return !!window._firebaseUser;
    }

    function properIdxLliure(desDe, direccio) {
        // direccio: +1 (següent) o -1 (anterior)
        if (!Array.isArray(window.totesLesHores)) return null;
        const total = window.totesLesHores.length;
        let idx = desDe + direccio;

        if (hiHaSessio()) {
            // Amb sessió, tot és accessible: només comprovem límits
            if (idx < 0 || idx >= total) return null;
            return idx;
        }

        // Sense sessió: només múltiples de 3 són accessibles
        while (idx >= 0 && idx < total) {
            if (idx % 3 === 0) return idx;
            idx += direccio;
        }
        return null;
    }

    // ─── HORA ANTERIOR ──────────────────────────────────────────────
    esperarElement('btnPrev', function (btn) {
        btn.addEventListener('click', function () {
            aturarAnimacio();
            const idxActual = obtenirIdxActual();
            const nouIdx = properIdxLliure(idxActual, -1);
            if (nouIdx === null) return; // ja som al principi (o al primer múltiple de 3 accessible)
            if (typeof window.mostrarHora === 'function') window.mostrarHora(nouIdx);
        });
    });

    // ─── HORA SEGÜENT ───────────────────────────────────────────────
    esperarElement('btnNext', function (btn) {
        btn.addEventListener('click', function () {
            aturarAnimacio();
            const idxActual = obtenirIdxActual();
            const nouIdx = properIdxLliure(idxActual, +1);
            if (nouIdx === null) return; // ja som al final (o a l'últim múltiple de 3 accessible)
            if (typeof window.mostrarHora === 'function') window.mostrarHora(nouIdx);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    //  ANIMACIÓ (play/pausa automàtic) — també respecta el bloqueig
    // ═══════════════════════════════════════════════════════════════

    function aturarAnimacio() {
        if (intervalAnimacio) {
            clearInterval(intervalAnimacio);
            intervalAnimacio = null;
        }
        animacioActiva = false;
        const btn = document.getElementById('btnPlay');
        if (btn) btn.innerHTML = '▶ Animació';
    }

    function iniciarAnimacio() {
        if (!Array.isArray(window.totesLesHores) || window.totesLesHores.length === 0) return;
        animacioActiva = true;
        const btn = document.getElementById('btnPlay');
        if (btn) btn.innerHTML = '⏸ Aturar';

        intervalAnimacio = setInterval(function () {
            if (!Array.isArray(window.totesLesHores)) {
                aturarAnimacio();
                return;
            }
            const idxActual = obtenirIdxActual();
            let seguent = properIdxLliure(idxActual, +1);
            if (seguent === null) {
                // Hem arribat al final accessible: tornem a l'inici (0 sempre és lliure)
                seguent = 0;
            }
            if (typeof window.mostrarHora === 'function') window.mostrarHora(seguent);
        }, VELOCITAT_ANIMACIO_MS);
    }

    esperarElement('btnPlay', function (btn) {
        btn.addEventListener('click', function () {
            if (animacioActiva) {
                aturarAnimacio();
            } else {
                iniciarAnimacio();
            }
        });
    });

    // Aturar l'animació si l'usuari interactua manualment amb el grid d'hores
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.fh-item')) {
            aturarAnimacio();
        }
    });

    

})();