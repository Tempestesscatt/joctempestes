// ═══════════════════════════════════════════════════════════════════════
//  isos.js — GENERADOR D'ISOLÍNIES (Marching Squares)
//
//  DOS MODES:
//  1) FIX — sempre actiu, sense botó. Nomes per a les 4 variables
//     d'altitud/isoterma definides a CLAUS_ISOLINIES (interval fix 200m,
//     colors propis).
//  2) GENÈRIC — activable/desactivable amb el botó "Isolinies ON/OFF"
//     (al costat de "Vent ON/OFF" al panell d'Ajustos). Quan està ON,
//     dibuixa isolínies negres per a QUALSEVOL altra variable seleccionada
//     (excepte els nivells de Temperatura 3D en hPa: t_1000, t_950, ...),
//     amb un interval calculat automàticament segons el rang de dades.
//
//  No té UI pròpia més enllà del botó de toggle (que es crea sol i
//  s'insereix al costat del de Vent). Requereix que mapa.js ja s'hagi
//  carregat (fa servir map, totesLesHores, getCoordenadesPer,
//  clauRealPerLlegir, clauBase, PALETES).
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── MODE FIX: variables amb isolínies sempre actives ─────────────
    // ⚠️ Claus CONFIRMADES contra el data real de mapa.js (PALETES / _currentParameter).
    // Totes negres (com la resta de contorns del mapa), amb etiqueta petita.
    const COLOR_FIX = '#000000';
    const CLAUS_ISOLINIES_FIXES = {
        'ALTITUDE__ISO_T_27315':  { interval: 200, label: 'Isoterma 0°C',              color: COLOR_FIX, decimals: 0, unitat: 'm' },
        'ALTITUDE__ISO_TPW_27315':{ interval: 200, label: 'Punt de rosada 0°C',        color: COLOR_FIX, decimals: 0, unitat: 'm' },
        'ALTITUDE__ISO_TPW_27415':{ interval: 200, label: 'Punt de rosada +1°C',       color: COLOR_FIX, decimals: 0, unitat: 'm' },
        'ALTITUDE__ISO_TPW_27465':{ interval: 200, label: 'Punt de rosada +1.5°C',     color: COLOR_FIX, decimals: 0, unitat: 'm' },
    };

    // ─── MODE GENÈRIC: cap variable exclosa ────────────────────────────
    // Anteriorment s'excloïen els nivells de Temperatura 3D (t, t_1000...
    // t_100); ara també reben isolínies automàtiques com la resta.
    function esVariableExclosaDelGenèric(clauCurta) {
        return false;
    }

    // Color fix per al mode genèric (sempre negre, com la resta de contorns del mapa)
    const COLOR_GENERIC = '#000000';

    // Estat global del toggle "Isolinies ON/OFF" (mode genèric)
    window.isoliniesGenericEnabled = false;

    function esVariableFixa(clauCurta) {
        return Object.prototype.hasOwnProperty.call(CLAUS_ISOLINIES_FIXES, clauCurta);
    }

    // ─── Pane i canvas propis, per sobre de paneDades i per sota de paneVent ──
    let canvasIso = null;
    let ctxIso = null;

    function assegurarPaneICanvas() {
        if (!window.map) return false;
        if (!map.getPane('paneIsolinies')) {
            map.createPane('paneIsolinies');
            map.getPane('paneIsolinies').style.zIndex = 450; // entre dades (400) i vent (500)
            map.getPane('paneIsolinies').style.pointerEvents = 'none';
        }
        if (!canvasIso) {
            canvasIso = document.createElement('canvas');
            canvasIso.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
            map.getPane('paneIsolinies').appendChild(canvasIso);
            ctxIso = canvasIso.getContext('2d');
            map.on('moveend zoomend move', redibuixarIsolinies);
        }
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  MARCHING SQUARES
    // ═══════════════════════════════════════════════════════════════
    // grid: Float32Array (Nlat x Nlon), amb NaN on no hi ha dada.
    // Retorna un array de segments [[x0,y0],[x1,y1]] en coordenades
    // de graella (index fila/columna en punt flotant), per a un nivell.

    function interpolaVora(v0, v1, nivell) {
        if (v0 === v1) return 0.5;
        const t = (nivell - v0) / (v1 - v0);
        return Math.min(1, Math.max(0, t));
    }

    // Taula de casos de marching squares (16 combinacions).
    // Cantonades: tl, tr, br, bl (top-left, top-right, bottom-right, bottom-left)
    // Vores: top(N), right(E), bottom(S), left(W)
    function segmentsPerCasCel(caseIdx, top, right, bottom, left) {
        // Retorna array de parells de vores [ [vA, vB], ... ] a connectar
        switch (caseIdx) {
            case 0: case 15: return [];
            case 1: case 14: return [[left, bottom]];
            case 2: case 13: return [[bottom, right]];
            case 3: case 12: return [[left, right]];
            case 4: case 11: return [[top, right]];
            case 5: return [[left, top], [bottom, right]]; // ambigu
            case 6: case 9: return [[top, bottom]];
            case 7: case 8: return [[left, top]];
            case 10: return [[left, bottom], [top, right]]; // ambigu
            default: return [];
        }
    }

    /**
     * Calcula segments d'isolínia per a un nivell donat.
     * @param {Float32Array|Array} dades  valors en ordre fila (fila 0 = north si latDesc)
     * @param {number} Nlat
     * @param {number} Nlon
     * @param {number} nivell
     * @returns {Array<[[number,number],[number,number]]>} segments en (col, fila) fraccionaris
     */
    function calcularSegmentsIsolinia(dades, Nlat, Nlon, nivell) {
        const segments = [];

        for (let i = 0; i < Nlat - 1; i++) {
            for (let j = 0; j < Nlon - 1; j++) {
                const vTL = dades[i * Nlon + j];
                const vTR = dades[i * Nlon + (j + 1)];
                const vBL = dades[(i + 1) * Nlon + j];
                const vBR = dades[(i + 1) * Nlon + (j + 1)];

                if (isNaN(vTL) || isNaN(vTR) || isNaN(vBL) || isNaN(vBR)) continue;

                const bTL = vTL >= nivell ? 1 : 0;
                const bTR = vTR >= nivell ? 1 : 0;
                const bBR = vBR >= nivell ? 1 : 0;
                const bBL = vBL >= nivell ? 1 : 0;
                const caseIdx = (bTL << 3) | (bTR << 2) | (bBR << 1) | bBL;

                if (caseIdx === 0 || caseIdx === 15) continue;

                // Punts de les 4 vores de la cel·la, interpolats
                const tTop = interpolaVora(vTL, vTR, nivell);
                const tRight = interpolaVora(vTR, vBR, nivell);
                const tBottom = interpolaVora(vBL, vBR, nivell);
                const tLeft = interpolaVora(vTL, vBL, nivell);

                const top = [j + tTop, i];
                const right = [j + 1, i + tRight];
                const bottom = [j + tBottom, i + 1];
                const left = [j, i + tLeft];

                const parells = segmentsPerCasCel(caseIdx, top, right, bottom, left);
                for (const [a, b] of parells) {
                    segments.push([a, b]);
                }
            }
        }
        return segments;
    }

    // ═══════════════════════════════════════════════════════════════
    //  UNIÓ DE SEGMENTS EN POLILÍNIES CONTÍNUES
    // ═══════════════════════════════════════════════════════════════
    // El marching squares dóna segments solts (un per cel·la). Per
    // dibuixar-los com a corbes naturals cal encadenar-los primer en
    // polilíniess llargues, unint els extrems que coincideixen.

    // Precisió d'aparellament (en unitats de graella). Els extrems que
    // vénen de la mateixa vora interpolada haurien de coincidir exactament
    // en punt flotant, però arrodonim per evitar problemes de precisió.
    const DECIMALS_CLAU = 5;

    function clauPunt(p) {
        return p[0].toFixed(DECIMALS_CLAU) + ',' + p[1].toFixed(DECIMALS_CLAU);
    }

    /**
     * Encadena una llista de segments solts en polilínies contínues.
     * @param {Array<[[number,number],[number,number]]>} segments
     * @returns {Array<Array<[number,number]>>} llista de polilínies (cada una és un array de punts)
     */
    function encadenarSegments(segments) {
        if (segments.length === 0) return [];

        // Mapa: clau de punt → llista de {altre extrem, índex de segment, usat}
        const extrems = new Map();
        const usat = new Array(segments.length).fill(false);

        function afegir(clau, entrada) {
            if (!extrems.has(clau)) extrems.set(clau, []);
            extrems.get(clau).push(entrada);
        }

        segments.forEach((seg, idx) => {
            afegir(clauPunt(seg[0]), { idx, extrem: 0 });
            afegir(clauPunt(seg[1]), { idx, extrem: 1 });
        });

        function trobarSegmentNoUsatA(clau) {
            const candidats = extrems.get(clau);
            if (!candidats) return null;
            for (const c of candidats) {
                if (!usat[c.idx]) return c;
            }
            return null;
        }

        const poliLinies = [];

        for (let idx0 = 0; idx0 < segments.length; idx0++) {
            if (usat[idx0]) continue;
            usat[idx0] = true;

            let linia = [segments[idx0][0], segments[idx0][1]];

            // Estenem cap endavant des de l'extrem final
            let seguir = true;
            while (seguir) {
                const puntaClau = clauPunt(linia[linia.length - 1]);
                const cand = trobarSegmentNoUsatA(puntaClau);
                if (!cand) { seguir = false; break; }
                usat[cand.idx] = true;
                const seg = segments[cand.idx];
                const nouPunt = cand.extrem === 0 ? seg[1] : seg[0];
                linia.push(nouPunt);
            }

            // Estenem cap enrere des de l'extrem inicial
            seguir = true;
            while (seguir) {
                const iniciClau = clauPunt(linia[0]);
                const cand = trobarSegmentNoUsatA(iniciClau);
                if (!cand) { seguir = false; break; }
                usat[cand.idx] = true;
                const seg = segments[cand.idx];
                const nouPunt = cand.extrem === 0 ? seg[1] : seg[0];
                linia.unshift(nouPunt);
            }

            poliLinies.push(linia);
        }

        return poliLinies;
    }

    // ═══════════════════════════════════════════════════════════════
    //  DIBUIX
    // ═══════════════════════════════════════════════════════════════

    function obtenirDadesGraella(clauCurta) {
        // ⚠️ 'curIdx' és una variable de mòdul dins mapa.js i NO penja de
        // window (igual que passava amb 'variableActiva'). L'equivalent
        // públic que mapa.js sí actualitza a cada mostrarHora() és
        // window.skewtHourIndex. Fem servir aquest, amb fallback a 0.
        const idx = (typeof window.skewtHourIndex === 'number') ? window.skewtHourIndex : 0;
        const item = window.totesLesHores && window.totesLesHores[idx];
        if (!item || !item.data) return null;
        const data = item.data;

        const coords = getCoordenadesPer(data, clauCurta);
        if (!coords) return null;
        const lats = coords.lat;
        const lons = coords.lon;
        const Nlat = lats.length;
        const Nlon = lons.length;

        const clauLectura = (typeof clauRealPerLlegir === 'function') ? clauRealPerLlegir(clauCurta) : clauCurta;
        const varInfo = data.variables[clauLectura] || data.variables[clauCurta];
        if (!varInfo || !varInfo.datos) return null;

        const dadesOrig = varInfo.datos;
        if (dadesOrig.length !== Nlat * Nlon) return null;

        // Igual que fa CanvasLayer._drawOffscreen: algunes variables de
        // temperatura arriben en Kelvin i cal restar 273.15 per mostrar-les
        // en °C, tal com fa la resta del mapa (relleno de color i popup de clic).
        const CLAUS_TEMP = ['st', 'sd', 't', 'dpt', 'temp_min2m', 'temp_max2m'];
        const baseTemp = (typeof clauBase === 'function') ? clauBase(clauCurta) : clauCurta;
        const esTemperatura = CLAUS_TEMP.includes(baseTemp);

        // La resta del codi (CanvasLayer) inverteix la fila per pintar
        // (filaReal = Nlat-1-i) perquè les dades venen de sud a nord
        // mentre la imatge es pinta de nord a sud. Reordenem aquí igual
        // perquè la graella d'isolínies quedi alineada amb el relleno.
        const reordenat = new Float32Array(Nlat * Nlon);
        for (let i = 0; i < Nlat; i++) {
            const filaReal = Nlat - 1 - i;
            for (let j = 0; j < Nlon; j++) {
                let v = dadesOrig[filaReal * Nlon + j];
                if (v === null || v === undefined || isNaN(v)) {
                    reordenat[i * Nlon + j] = NaN;
                } else {
                    if (esTemperatura && v > 100) v = v - 273.15;
                    reordenat[i * Nlon + j] = v;
                }
            }
        }

        const latMax = Math.max(lats[0], lats[lats.length - 1]);
        const latMin = Math.min(lats[0], lats[lats.length - 1]);
        const lonMin = Math.min(lons[0], lons[lons.length - 1]);
        const lonMax = Math.max(lons[0], lons[lons.length - 1]);

        return { dades: reordenat, Nlat, Nlon, latMin, latMax, lonMin, lonMax };
    }

    function gridToLatLng(gx, gy, info) {
        // gx: columna fraccionaria [0, Nlon-1], gy: fila fraccionaria [0, Nlat-1]
        // fila 0 = latMax (nord), fila Nlat-1 = latMin (sud) — perquè ja hem
        // reordenat les dades a obtenirDadesGraella().
        const lon = info.lonMin + (gx / (info.Nlon - 1)) * (info.lonMax - info.lonMin);
        const lat = info.latMax - (gy / (info.Nlat - 1)) * (info.latMax - info.latMin);
        return L.latLng(lat, lon);
    }

    // ═══════════════════════════════════════════════════════════════
    //  DIBUIX SUAU DE POLILÍNIES (corbes naturals, sense angles durs)
    // ═══════════════════════════════════════════════════════════════
    // Mateixa tècnica que fa servir mapa.js per a les streamlines de vent:
    // en lloc d'unir els punts amb rectes (lineTo), fem servir corbes
    // quadràtiques pels punts mitjos consecutius. Això arrodoneix
    // automàticament els "escalons" típics del marching squares sense
    // desviar la línia del seu recorregut real.

    function dibuixarPoliliniaSuau(liniaGraella, info) {
        if (liniaGraella.length < 2) return;

        // Convertim tots els punts de graella a píxels de pantalla una sola
        // vegada (evita cridar latLngToContainerPoint repetidament dins el bucle).
        const pts = liniaGraella.map(([gx, gy]) => {
            const p = map.latLngToContainerPoint(gridToLatLng(gx, gy, info));
            return [p.x, p.y];
        });

        if (pts.length === 2) {
            // Només 2 punts: no hi ha res a suavitzar, línia recta simple.
            ctxIso.beginPath();
            ctxIso.moveTo(pts[0][0], pts[0][1]);
            ctxIso.lineTo(pts[1][0], pts[1][1]);
            ctxIso.stroke();
            return;
        }

        ctxIso.beginPath();
        ctxIso.moveTo(pts[0][0], pts[0][1]);

        // Corba quadràtica pels punts mitjos: cada segment "real" de la
        // graella esdevé el punt de control, i la línia passa suaument
        // pels punts mitjos entre segments consecutius.
        for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i][0] + pts[i + 1][0]) / 2;
            const my = (pts[i][1] + pts[i + 1][1]) / 2;
            ctxIso.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }

        // Últim tram fins al punt final real
        const last = pts[pts.length - 1];
        ctxIso.lineTo(last[0], last[1]);

        ctxIso.stroke();
    }

    function etiquetaValor(v, cfg) {
        return v.toFixed(cfg.decimals) + (cfg.unitat ? ' ' + cfg.unitat : '');
    }

    // Mida de lletra de les etiquetes: petita, com ha demanat l'usuari
    const MIDA_FONT_ETIQUETA = 8; // px

    /**
     * Tria el millor punt entre tots els segments d'un nivell (el més
     * proper al centre de la zona visible del canvas) i hi dibuixa
     * l'etiqueta, retallant-la perquè mai surti fora del canvas.
     */
    function dibuixarEtiquetaNivell(segments, nivell, cfg, info) {
        if (!segments.length) return;

        const W = canvasIso.width;
        const H = canvasIso.height;
        const marge = 10; // marge de seguretat respecte a la vora del canvas
        const cx = W / 2;
        const cy = H / 2;

        let millorPunt = null;
        let millorDist = Infinity;

        for (const [a, b] of segments) {
            const mx = (a[0] + b[0]) / 2;
            const my = (a[1] + b[1]) / 2;
            const p = map.latLngToContainerPoint(gridToLatLng(mx, my, info));

            // Descartem directament qualsevol candidat que ja quedi fora
            // del canvas (amb marge) — no volem etiquetes penjant del mapa.
            if (p.x < marge || p.x > W - marge || p.y < marge || p.y > H - marge) continue;

            const d = (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy);
            if (d < millorDist) {
                millorDist = d;
                millorPunt = p;
            }
        }

        // Si cap candidat cau dins el viewport (p.ex. la isolínia només
        // passa per zones fora de pantalla), no dibuixem etiqueta per a
        // aquest nivell — es retalla en lloc de sortir del mapa.
        if (!millorPunt) return;

        ctxIso.globalAlpha = 1;
        ctxIso.font = `bold ${MIDA_FONT_ETIQUETA}px Arial`;
        ctxIso.textAlign = 'center';
        ctxIso.textBaseline = 'middle';

        const text = etiquetaValor(nivell, cfg);
        const tw = ctxIso.measureText(text).width;
        const boxW = tw + 6;
        const boxH = MIDA_FONT_ETIQUETA + 4;

        // Recentrem la caixa perquè mai sobresurti del canvas, encara que
        // el punt triat estigui molt a prop d'una vora.
        let bx = millorPunt.x - boxW / 2;
        let by = millorPunt.y - boxH / 2;
        bx = Math.min(Math.max(bx, 2), W - boxW - 2);
        by = Math.min(Math.max(by, 2), H - boxH - 2);
        const textX = bx + boxW / 2;
        const textY = by + boxH / 2;

        ctxIso.fillStyle = 'rgba(255,255,255,0.85)';
        ctxIso.fillRect(bx, by, boxW, boxH);
        ctxIso.fillStyle = cfg.color;
        ctxIso.fillText(text, textX, textY + 0.5);
    }

    // ═══════════════════════════════════════════════════════════════
    //  INTERVAL AUTOMÀTIC (mode genèric)
    // ═══════════════════════════════════════════════════════════════
    // Calcula un "pas bonic" (1, 2 o 5 × 10^n) que doni aproximadament
    // OBJECTIU_LINIES contorns dins el rang [vmin, vmax] de les dades.
    const OBJECTIU_LINIES = 8;

    function calcularIntervalAutomatic(vmin, vmax) {
        const rang = vmax - vmin;
        if (!isFinite(rang) || rang <= 0) return 1;

        const pasBrut = rang / OBJECTIU_LINIES;
        const exponent = Math.floor(Math.log10(pasBrut));
        const base = pasBrut / Math.pow(10, exponent);

        let pasNormalitzat;
        if (base < 1.5) pasNormalitzat = 1;
        else if (base < 3.5) pasNormalitzat = 2;
        else if (base < 7.5) pasNormalitzat = 5;
        else pasNormalitzat = 10;

        const interval = pasNormalitzat * Math.pow(10, exponent);
        return interval > 0 ? interval : 1;
    }

    function decimalsPerInterval(interval) {
        if (interval >= 1) return 0;
        if (interval >= 0.1) return 1;
        if (interval >= 0.01) return 2;
        return 3;
    }

    function redibuixarIsolinies() {
        try {
            _redibuixarIsoliniesIntern();
        } catch (e) {
            console.error('[isos.js] Error redibuixant isolínies:', e);
        }
    }

    function _redibuixarIsoliniesIntern() {
        if (!assegurarPaneICanvas()) return;

        const size = map.getSize();
        canvasIso.width = size.x;
        canvasIso.height = size.y;
        L.DomUtil.setPosition(canvasIso, map.containerPointToLayerPoint([0, 0]));
        ctxIso.clearRect(0, 0, canvasIso.width, canvasIso.height);

        // 'variableActiva' és una variable de mòdul dins mapa.js i NO penja
        // de window (per tant window.variableActiva sempre és undefined).
        // L'equivalent públic que mapa.js sí actualitza és window._currentParameter.
        const clauActiva = window._currentParameter;
        if (!clauActiva) return;

        // Decidim quina configuració fer servir:
        //  a) Si la clau és una de les 4 fixes → sempre es dibuixa (interval fix, negre).
        //  b) Si no, i el toggle genèric està ON → es dibuixa amb interval
        //     automàtic i negre (incloent Temperatura en altura: t, t_850...).
        let cfg = null;

        if (esVariableFixa(clauActiva)) {
            cfg = CLAUS_ISOLINIES_FIXES[clauActiva];
        } else if (window.isoliniesGenericEnabled && !esVariableExclosaDelGenèric(clauActiva)) {
            // clauBase() normalitza sufixos de nivell (p.ex. cape_850 → cape) i
            // alies WCS; útil perquè l'exclusió i qualsevol lògica futura siguin
            // consistents amb com mapa.js tracta la variable a la resta de la UI.
            const base = (typeof clauBase === 'function') ? clauBase(clauActiva) : clauActiva;
            if (!esVariableExclosaDelGenèric(base)) {
                cfg = { interval: null, label: null, color: COLOR_GENERIC, decimals: 0, unitat: '' };
            }
        }

        if (!cfg) return;

        const info = obtenirDadesGraella(clauActiva);
        if (!info) return;

        // Rang de valors present a la graella (per no calcular nivells buits)
        let vmin = Infinity, vmax = -Infinity;
        for (let k = 0; k < info.dades.length; k++) {
            const v = info.dades[k];
            if (!isNaN(v)) {
                if (v < vmin) vmin = v;
                if (v > vmax) vmax = v;
            }
        }
        if (!isFinite(vmin) || !isFinite(vmax)) return;

        // Interval: fix per a les 4 variables d'altitud, automàtic per a la resta
        const interval = cfg.interval !== null ? cfg.interval : calcularIntervalAutomatic(vmin, vmax);
        if (!interval || interval <= 0) return;
        if (cfg.interval === null) cfg.decimals = decimalsPerInterval(interval);

        // Unitat mostrada a l'etiqueta: la pròpia de la paleta si el mode és genèric
        if (cfg.interval === null) {
            const pal = (typeof getPaleta === 'function') ? getPaleta(clauActiva) : null;
            cfg.unitat = pal ? pal.unitat : '';
        }

        const nivellInicial = Math.floor(vmin / interval) * interval;

        ctxIso.save();
        ctxIso.lineJoin = 'round';
        ctxIso.lineCap = 'round';

        for (let nivell = nivellInicial; nivell <= vmax; nivell += interval) {
            const segments = calcularSegmentsIsolinia(info.dades, info.Nlat, info.Nlon, nivell);
            if (segments.length === 0) continue;

            // Encadenem els segments solts en polilíniess contínues abans
            // de dibuixar-les, perquè el suavitzat quedi natural i no
            // trenqui la línia en cada cel·la de la graella.
            const poliLinies = encadenarSegments(segments);

            // Línia principal (cada nivell)
            const esMestra = (Math.round(nivell / (interval * 5)) * (interval * 5)) === nivell;

            ctxIso.strokeStyle = cfg.color;
            ctxIso.lineWidth = esMestra ? 1.6 : 0.9;
            ctxIso.globalAlpha = esMestra ? 0.9 : 0.55;

            for (const linia of poliLinies) {
                dibuixarPoliliniaSuau(linia, info);
            }

            // Etiqueta: triem, entre tots els segments d'aquest nivell mestre,
            // el punt mig més proper al centre de la part VISIBLE del canvas
            // (no del mapa sencer), i només la dibuixem si cau dins la zona
            // amb dades i dins el viewport, retallant-la si cal.
            if (esMestra) {
                dibuixarEtiquetaNivell(segments, nivell, cfg, info);
            }
        }

        ctxIso.restore();
    }

    // ═══════════════════════════════════════════════════════════════
    //  BOTÓ "ISOLINIES ON/OFF" — al costat del botó de Vent
    // ═══════════════════════════════════════════════════════════════

    function actualitzarEstilBotoIsolinies(btn) {
        btn.textContent = window.isoliniesGenericEnabled ? ' Isolinies ON' : ' Isolinies OFF';
        btn.style.background = window.isoliniesGenericEnabled ? '#2a5a8a' : '#141c2a';
    }

    function crearBotoIsolinies() {
        if (document.getElementById('btnIsolinies')) return true;

        const btnVent = document.getElementById('btnVent');
        if (!btnVent || !btnVent.parentElement) return false;

        const btn = document.createElement('button');
        btn.id = 'btnIsolinies';
        btn.style.cssText = btnVent.style.cssText || 'flex:1;padding:4px;border-radius:3px;border:1px solid #2a3a5a;color:#cfe0ee;font-size:10px;cursor:pointer;';
        actualitzarEstilBotoIsolinies(btn);

        btn.addEventListener('click', function () {
            window.isoliniesGenericEnabled = !window.isoliniesGenericEnabled;
            actualitzarEstilBotoIsolinies(btn);
            redibuixarIsolinies();
        });

        // El col·loquem just després del botó de Vent, a la mateixa fila
        btnVent.insertAdjacentElement('afterend', btn);
        return true;
    }

    function assegurarBotoIsolinies() {
        if (!crearBotoIsolinies()) {
            setTimeout(assegurarBotoIsolinies, 300);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  ENGANXAR AL CICLE DE VIDA DE mapa.js
    // ═══════════════════════════════════════════════════════════════
    // No modifiquem mapa.js: interceptem les funcions globals rellevants
    // perquè, cada cop que es dibuixin dades noves o canviï la variable,
    // es torni a calcular la isolínia si escau.

    function embolcallarFuncioGlobal(nom, extra) {
        const original = window[nom];
        if (typeof original !== 'function') return false;
        window[nom] = function (...args) {
            const resultat = original.apply(this, args);
            // Si la funció original és async (retorna Promise), esperem
            if (resultat && typeof resultat.then === 'function') {
                return resultat.then((r) => { extra(); return r; });
            }
            extra();
            return resultat;
        };
        return true;
    }

    function inicialitzar() {
        if (!window.map || typeof window.getCoordenadesPer !== 'function') {
            setTimeout(inicialitzar, 200);
            return;
        }

        assegurarPaneICanvas();
        assegurarBotoIsolinies();

        // seleccionarVariable: canvi de paràmetre → recalcular
        embolcallarFuncioGlobal('seleccionarVariable', redibuixarIsolinies);

        // mostrarHora: canvi d'hora → recalcular
        embolcallarFuncioGlobal('mostrarHora', redibuixarIsolinies);

        // Quan el CanvasLayer torna a dibuixar (p.ex. dades nova hora
        // arribant asíncronament), també volem refrescar
        document.addEventListener('mapa-dades-llestes', redibuixarIsolinies);
        document.addEventListener('mapa-3d-llest', redibuixarIsolinies);

        redibuixarIsolinies();
        
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(inicialitzar, 300);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(inicialitzar, 300));
    }

    // Exposar per depuració / ús extern opcional
    window.redibuixarIsolinies = redibuixarIsolinies;
    window.CLAUS_ISOLINIES_FIXES = CLAUS_ISOLINIES_FIXES;
})();