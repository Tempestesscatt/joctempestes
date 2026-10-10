// ═══════════════════════════════════════════════════════════════════
//  models.js — Pestanya "Models" per canviar AROME ↔ GFS
//
//  S'injecta sola al panell del visor (mapapngs.js o gfspngs.js)
//  entre les pestanyes "Variables" i "Ciutats".
//
//  Ús: afegir al final del <body>, DESPRÉS del mapapngs.js/gfspngs.js:
//      <script src="js/models.js"></script>
// ═══════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── Configuració dels models ───────────────────────────────────
    const MODELS = {
        arome: {
            nom: 'AROME 0025',
            desc: 'Alta resolució · NE Espanya · 51h',
            pagina: 'arome-cat.html',
            clau: 'arome',
        },
        gfs: {
            nom: 'GFS Global',
            desc: 'Món sencer · Atlàntic Nord · 384h',
            pagina: 'gfs-europe.html',
            clau: 'gfs',
        },
    };

    // ─── Detectar model actiu ───────────────────────────────────────
    // 1) Si som a gfs-europe.html → GFS
    // 2) Si som a arome-cat.html o index.html → AROME
    // 3) Es pot sobreescriure amb ?model=xxx o localStorage
    function detectarModel() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('gfs-europe')) return 'gfs';
        if (path.includes('arome-cat')) return 'arome';
        try {
            const p = new URLSearchParams(window.location.search).get('model');
            if (p && MODELS[p]) return p;
        } catch (e) {}
        try {
            const m = localStorage.getItem('tempestescat_model');
            if (m && MODELS[m]) return m;
        } catch (e) {}
        return 'arome';
    }

    const MODEL_ACTIU = detectarModel();

    // ─── Estils ─────────────────────────────────────────────────────
    function injectarEstils() {
        if (document.getElementById('models-estils')) return;
        const st = document.createElement('style');
        st.id = 'models-estils';
        st.textContent = [
            '.models-cos{padding:14px 14px 18px;overflow-y:auto;-webkit-overflow-scrolling:touch;min-height:0;flex:1 1 0;}',
            '.models-titol{font-size:9.5px;font-weight:700;color:var(--muted,#8b949e);text-transform:uppercase;letter-spacing:.8px;margin:0 0 10px;}',
            '.models-info{font-size:11px;color:var(--muted,#8b949e);line-height:1.55;margin:0 0 14px;padding:9px 11px;background:rgba(255,255,255,.025);border:1px solid var(--line,rgba(240,246,252,.07));border-radius:6px;}',
            '.models-btn{display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;margin-bottom:6px;background:var(--panel-2,#161b22);border:1px solid var(--line,rgba(240,246,252,.07));border-radius:7px;color:var(--text-2,#c9d1d9);font-family:inherit;cursor:pointer;text-align:left;transition:background .15s ease,border-color .15s ease,color .15s ease;text-decoration:none;}',
            '.models-btn:hover{background:var(--panel-hover,#1c2128);border-color:var(--line-strong,rgba(240,246,252,.15));color:var(--text,#f0f6fc);}',
            '.models-btn.actiu{background:rgba(88,166,255,.08);border-color:rgba(88,166,255,.4);color:var(--accent,#58a6ff);box-shadow:inset 3px 0 0 var(--accent,#58a6ff);}',
            '.models-btn.actiu.models-gfs{background:rgba(63,185,80,.08);border-color:rgba(63,185,80,.4);color:var(--ok,#3fb950);box-shadow:inset 3px 0 0 var(--ok,#3fb950);}',
            '.models-text{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;}',
            '.models-nom{font-size:13px;font-weight:700;letter-spacing:.2px;}',
            '.models-desc{font-size:10.5px;color:var(--muted,#8b949e);font-weight:500;line-height:1.35;}',
            '.models-btn.actiu .models-desc{color:var(--accent,#58a6ff);opacity:.8;}',
            '.models-btn.actiu.models-gfs .models-desc{color:var(--ok,#3fb950);opacity:.8;}',
            '.models-check{font-size:13px;color:var(--accent,#58a6ff);opacity:0;flex-shrink:0;transition:opacity .15s ease;}',
            '.models-btn.actiu .models-check{opacity:1;}',
            '.models-btn.actiu.models-gfs .models-check{color:var(--ok,#3fb950);}',
        ].join('\n');
        document.head.appendChild(st);
    }

    // ─── Injectar la pestanya "Models" ──────────────────────────────
    function injectarPestanya() {
        const tabs = document.querySelector('#panell-pro .pp-tabs');
        if (!tabs) return false;
        if (tabs.querySelector('[data-tab="models"]')) return true;

        // ── Botó "Models" ───────────────────────────────────────────
        const btn = document.createElement('button');
        btn.className = 'pp-tab';
        btn.dataset.tab = 'models';
        btn.textContent = 'Models';

        // Inserir entre "variables" i "ciutats"
        const btnCiutats = tabs.querySelector('[data-tab="ciutats"]');
        const btnCapes = tabs.querySelector('[data-tab="capes"]');
        if (btnCiutats) tabs.insertBefore(btn, btnCiutats);
        else if (btnCapes) tabs.insertBefore(btn, btnCapes);
        else tabs.appendChild(btn);

        // ── Contingut de la pestanya ────────────────────────────────
        const cos = document.createElement('div');
        cos.className = 'pp-cos';
        cos.dataset.cos = 'models';

        const inner = document.createElement('div');
        inner.className = 'models-cos';

        const titol = document.createElement('div');
        titol.className = 'models-titol';
        titol.textContent = 'Model meteorològic';
        inner.appendChild(titol);

        const info = document.createElement('div');
        info.className = 'models-info';
        info.textContent = 'Tria el model per veure\'n les dades. Cada model té la seva pròpia resolució i abast temporal.';
        inner.appendChild(info);

        // Botons de model
        for (const clau in MODELS) {
            const cfg = MODELS[clau];
            const boto = document.createElement('a');
            boto.href = cfg.pagina;
            boto.className = 'models-btn'
                + (clau === MODEL_ACTIU ? ' actiu' : '')
                + (clau === 'gfs' ? ' models-gfs' : '');

            const text = document.createElement('span');
            text.className = 'models-text';

            const nom = document.createElement('span');
            nom.className = 'models-nom';
            nom.textContent = cfg.nom;
            text.appendChild(nom);

            const desc = document.createElement('span');
            desc.className = 'models-desc';
            desc.textContent = cfg.desc;
            text.appendChild(desc);

            boto.appendChild(text);

            const check = document.createElement('span');
            check.className = 'models-check';
            check.textContent = '✓';
            boto.appendChild(check);

            boto.addEventListener('click', (e) => {
                // Guardem el model triat a localStorage
                try { localStorage.setItem('tempestescat_model', clau); } catch (err) {}
                // Si és el mateix model, no fem res
                if (clau === MODEL_ACTIU) {
                    e.preventDefault();
                }
            });

            inner.appendChild(boto);
        }

        cos.appendChild(inner);

        // Inserir el contingut al lloc correcte
        const cosVariables = document.querySelector('#panell-pro .pp-cos[data-cos="variables"]');
        if (cosVariables && cosVariables.parentNode) {
            cosVariables.parentNode.insertBefore(cos, cosVariables.nextSibling);
        } else {
            const panell = document.getElementById('panell-pro');
            if (panell) panell.appendChild(cos);
        }

        // ── Click a la pestanya ─────────────────────────────────────
        btn.addEventListener('click', () => {
            if (typeof window.activarPestanya === 'function') {
                try {
                    window.activarPestanya('models');
                    tabs.querySelectorAll('.pp-tab').forEach(x =>
                        x.classList.toggle('actiu', x === btn));
                    return;
                } catch (e) {}
            }
            tabs.querySelectorAll('.pp-tab').forEach(x =>
                x.classList.toggle('actiu', x === btn));
            const panell = document.getElementById('panell-pro');
            if (panell) {
                panell.querySelectorAll('.pp-cos').forEach(c =>
                    c.classList.toggle('actiu', c.dataset.cos === 'models'));
            }
        });

        // ── Reconnectar els altres botons de pestanya ────────────────
        tabs.querySelectorAll('.pp-tab').forEach(b => {
            if (b === btn) return;
            if (b.dataset._models_ok) return;
            b.dataset._models_ok = '1';
            b.addEventListener('click', () => {
                const panell = document.getElementById('panell-pro');
                if (panell) {
                    const cosModels = panell.querySelector('.pp-cos[data-cos="models"]');
                    if (cosModels) cosModels.classList.remove('actiu');
                }
            });
        });

        return true;
    }

    // ─── Inicialització (amb reintents) ─────────────────────────────
    function init() {
        injectarEstils();
        injectarPestanya();
    }

    let intents = 0;
    const MAX_INTENTS = 100;
    function intentar() {
        intents++;
        const panell = document.getElementById('panell-pro');
        const tabs = document.querySelector('#panell-pro .pp-tabs');
        if (panell && tabs) { init(); return; }
        if (intents < MAX_INTENTS) setTimeout(intentar, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(intentar, 50));
    } else {
        setTimeout(intentar, 50);
    }

    console.log('[models.js] Inicialitzat. Model actiu:', MODEL_ACTIU);
})();