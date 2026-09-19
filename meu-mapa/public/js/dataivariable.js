// ═══════════════════════════════════════════════════════════════════════
//  dataivariable.js  —  v3
//  Afegeix la variable seleccionada + escala de colors al costat de la data.
//  NO toca mapa.js.
// ═══════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const ID_SPAN    = 'variable_activa_label';
    const ID_ESCALA  = 'variable_activa_escala';
    let _ultimText   = '';
    let _ultimaClau  = null;

    // ─── 1. Trobar el label de la data ───────────────────────────────
    function trobarLabelData() {
        let el = document.getElementById('current_time_label');
        if (el) return el;

        el = document.querySelector('.current-time-label');
        if (el) return el;

        const tots = document.querySelectorAll('div, span, p');
        for (const t of tots) {
            const txt = (t.textContent || '').trim();
            if (/^\w+\s+\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}/.test(txt)) {
                return t;
            }
        }
        return null;
    }

    // ─── 2. Crear/obtenir el contenidor que ho engloba tot ───────────
    // Creem un wrapper flex on hi haurà: [· Variable (unitat)] [escala]
    function obtenirContenidor() {
        let contenidor = document.getElementById('variable_activa_wrapper');
        if (contenidor) return contenidor;

        const label = trobarLabelData();
        if (!label) return null;

        contenidor = document.createElement('span');
        contenidor.id = 'variable_activa_wrapper';
        contenidor.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-left: 10px;
            padding-left: 10px;
            border-left: 1px solid rgba(255,255,255,0.2);
            white-space: nowrap;
            vertical-align: middle;
        `;

        // Span del nom de la variable
        const spanNom = document.createElement('span');
        spanNom.id = ID_SPAN;
        spanNom.style.cssText = `
            color: #FFD700;
            font-weight: 600;
            font-size: 11px;
            white-space: nowrap;
        `;
        contenidor.appendChild(spanNom);

        // Span de l'escala de colors
        const spanEscala = document.createElement('span');
        spanEscala.id = ID_ESCALA;
        spanEscala.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 9px;
            color: #8899bb;
            white-space: nowrap;
        `;
        contenidor.appendChild(spanEscala);

        label.parentNode.insertBefore(contenidor, label.nextSibling);
        console.log('[dataivariable] Contenidor creat al costat de:', label.id || label.className);
        return contenidor;
    }

    // ─── 3. Esbrinar quina variable està activa ──────────────────────
    function obtenirClauActiva() {
        if (window.variableActiva) return window.variableActiva;
        if (window._currentParameter) return window._currentParameter;

        const sel = document.querySelector('.param-row.param-selected');
        if (sel && sel.dataset && sel.dataset.clau) return sel.dataset.clau;

        return null;
    }

    // ─── 4. Construir el text bonic ──────────────────────────────────
    function textVariable(clau) {
        if (!clau) return '';

        let titol = clau;
        let unitat = '';

        if (window.PALETES && window.PALETES[clau]) {
            titol = window.PALETES[clau].titol || clau;
            unitat = window.PALETES[clau].unitat || '';
        } else if (typeof window.getPaleta === 'function') {
            try {
                const pal = window.getPaleta(clau);
                if (pal) {
                    titol = pal.titol || clau;
                    unitat = pal.unitat || '';
                }
            } catch (e) {}
        }

        let altura = '';
        if (window.ConvertirAltura && window.ConvertirAltura.textPlanoPerClau) {
            const h = window.ConvertirAltura.textPlanoPerClau(clau);
            if (h) altura = ' ' + h;
        }

        return unitat ? `${titol}${altura} (${unitat})` : `${titol}${altura}`;
    }

    // ─── 5. Obtenir la paleta de la variable ─────────────────────────
    function obtenirPaleta(clau) {
        if (!clau) return null;

        if (typeof window.getPaleta === 'function') {
            try {
                return window.getPaleta(clau);
            } catch (e) {}
        }
        if (window.PALETES && window.PALETES[clau]) {
            return window.PALETES[clau];
        }
        return null;
    }

    // ─── 6. Construir l'escala de colors ─────────────────────────────
    function construirEscala(clau) {
        const pal = obtenirPaleta(clau);
        if (!pal || !pal.stops || pal.stops.length === 0) return null;

        const stops = pal.stops;

        // Container flex
        const wrapper = document.createElement('span');
        wrapper.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 3px;
            vertical-align: middle;
        `;

        // Valor mínim
        const valMin = document.createElement('span');
        valMin.textContent = formatarValor(stops[0].v);
        valMin.style.cssText = 'font-size:9px;color:#8899bb;font-variant-numeric:tabular-nums;';
        wrapper.appendChild(valMin);

        // Barra de gradient
        const barra = document.createElement('span');

        // Construïm el gradient CSS a partir dels stops
        const colors = stops.map(s => {
            const a = (s.a !== undefined && s.a !== null) ? (s.a / 255) : 1;
            return `rgba(${s.r},${s.g},${s.b},${a})`;
        });

        const gradient = `linear-gradient(to right, ${colors.join(', ')})`;

        barra.style.cssText = `
            display: inline-block;
            width: 90px;
            height: 10px;
            border-radius: 2px;
            border: 1px solid rgba(255,255,255,0.2);
            background: ${gradient};
            box-shadow: 0 0 4px rgba(0,0,0,0.4);
            vertical-align: middle;
        `;
        wrapper.appendChild(barra);

        // Valor màxim
        const valMax = document.createElement('span');
        valMax.textContent = formatarValor(stops[stops.length - 1].v);
        valMax.style.cssText = 'font-size:9px;color:#8899bb;font-variant-numeric:tabular-nums;';
        wrapper.appendChild(valMax);

        return wrapper;
    }

    // ─── 7. Format compacte de números ───────────────────────────────
    function formatarValor(v) {
        if (v === null || v === undefined || isNaN(v)) return '—';
        const abs = Math.abs(v);
        if (abs === 0) return '0';
        if (abs >= 10000) return (v / 1000).toFixed(0) + 'k';
        if (abs >= 100) return v.toFixed(0);
        if (abs >= 10) return v.toFixed(1);
        if (abs >= 1) return v.toFixed(2);
        if (abs >= 0.01) return v.toFixed(3);
        return v.toExponential(1);
    }

    // ─── 8. Refresc periòdic ─────────────────────────────────────────
    function refrescar() {
        const contenidor = obtenirContenidor();
        if (!contenidor) return;

        const clau = obtenirClauActiva();
        const spanNom = document.getElementById(ID_SPAN);
        const spanEscala = document.getElementById(ID_ESCALA);

        // Actualitzar text del nom
        const text = textVariable(clau);
        if (text !== _ultimText && spanNom) {
            spanNom.textContent = text || '';
            _ultimText = text;
        }

        // Actualitzar escala només si ha canviat la variable
        if (clau !== _ultimaClau && spanEscala) {
            spanEscala.innerHTML = '';
            const escala = construirEscala(clau);
            if (escala) {
                spanEscala.appendChild(escala);
                spanEscala.style.display = 'inline-flex';
            } else {
                spanEscala.style.display = 'none';
            }
            _ultimaClau = clau;
        }
    }

    // ─── 9. Engegar el polling ───────────────────────────────────────
    function engegar() {
        console.log('[dataivariable] Engegant polling v3 (amb escala)...');
        refrescar();
        setInterval(refrescar, 400);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', engegar);
    } else {
        engegar();
    }

    window.refrescarVariableLabel = refrescar;
})();