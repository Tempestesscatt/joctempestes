// ═══════════════════════════════════════════════════════════════════
//  offline.js — Descàrrega de dades per a ús sense connexió
//  Carregar DESPRÉS de mapapngs.js:  <script defer src="js/offline.js"></script>
//  Utilitza globals de mapapngs.js (PNG_BASE, VERSIO, ambCb, totesLesHores...)
// ═══════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    const PREFIX = 'tc-data-';
    const PARAL = 16;                      // descàrregues en paral·lel (HTTP/2 ho aguanta bé)
    let enCurs = false, cancel = false;

    // ─── Registre del Service Worker ───────────────────────────────
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(e => console.warn('[sw]', e));
        });
    }

    const $ = id => document.getElementById(id);
    const versio = () => (typeof VERSIO !== 'undefined' ? VERSIO : '');
    const nomCache = () => PREFIX + versio();
    const pad = n => String(n).padStart(2, '0');

    // ─── Llista de fitxers a descarregar ──────────────────────────
    function llistaFitxers() {
        const urls = new Set();
        const hores = window.totesLesHores || [];
        const logat = usuariLoguejat();
        const cfg = (typeof window.getConfigPla === 'function') ? window.getConfigPla() : {};
        const bloq = (v) => typeof window.variableBloquejada === 'function'
            && window.variableBloquejada(v, nomVariable(v));
        const valida = (v) => {
            const k = normClau(v);
            return NOMS_VARIABLES[k] && !OCULTES_SFC.has(k) && potVeureVariable(v) && !bloq(v);
        };

        // Fitxers estàtics del visor
        urls.add(_basePath + 'dades/relleu.png');
        urls.add(PNG_BASE + 'vores.png');
        ['noms.js', 'lineas.js', 'comarques.js'].forEach(f => urls.add(_basePath + 'dades/' + f));

        hores.forEach((h, i) => {
            if (!h.variables || !h.variables.length) return;
            if (!logat && i % 3 !== 0) return;
            const base = `${pad(h.hora)}_${h.dia}`;
            urls.add(`${PNG_BASE}vent_${base}.js`);
            const vars = h.variables;
            for (const v of vars) {
                if (!h.variables.includes(v) || !valida(v)) continue;
                urls.add(`${PNG_BASE}sfc_${base}_${v}.png`);
                urls.add(`${PNG_BASE}isolines_${base}_${v}.js`);
                urls.add(`${PNG_BASE}legend_${v}.png`);
            }
        });

        // 3D (només Professional)
        if (logat && cfg.parametres3D) {
            const set3D = new Set((typeof hores3D !== 'undefined' ? hores3D : [])
                .map(h => (h && typeof h === 'object') ? `${pad(h.hora)}_${h.dia}` : String(h)));
            hores.forEach((h, i) => {
                if (!h.variables || !h.variables.length) return;
                const base = `${pad(h.hora)}_${h.dia}`;
                if (set3D.size && !set3D.has(base)) return;
                urls.add(`${BASE_3D}sondeig_${base}.msgpack.gz`);
                urls.add(`${BASE_3D}stormmotion_${base}.js`);
                for (const n of NIVELLS_3D) urls.add(`${BASE_3D}vent3d_${base}_${n}.bin`);
                for (const c of CATALEG_3D_NIVELL) {
                    urls.add(`${BASE_3D}legend_3d_${c.var}.png`);
                    for (const n of NIVELLS_3D) {
                        urls.add(`${BASE_3D}3d_${base}_${c.var}_${n}.png`);
                        urls.add(`${BASE_3D}isolines_3d_${base}_${c.var}_${n}.js`);
                    }
                }
                for (const c of CATALEG_3D_COLUMNA) {
                    urls.add(`${BASE_3D}legend_3d_${c.var}.png`);
                    urls.add(`${BASE_3D}3d_${base}_${c.var}_${NIVELL_COLUMNA}.png`);
                    urls.add(`${BASE_3D}isolines_3d_${base}_${c.var}_${NIVELL_COLUMNA}.js`);
                }
            });
        }
        return [...urls];
    }

    // ─── Descàrrega ────────────────────────────────────────────────
    async function descarrega(urls, onProg) {
        const cache = await caches.open(nomCache());
        // Una sola consulta (en comptes d'una per fitxer): salta el que ja tenim
        const tinc = new Set((await cache.keys()).map(k => k.url));
        const abs = r => new URL(r, location.href).href;
        const llista = urls.map(u => ambCb(typeof urlNB === 'function' ? urlNB(u) : u));  // MATEIXA URL que demana el visor
        const pendents = llista.filter(r => !tinc.has(abs(r)));

        const total = llista.length;
        let fets = total - pendents.length, errors = 0, i = 0, tUlt = 0;
        const avisa = (final) => {
            const t = performance.now();
            if (final || t - tUlt > 150) { tUlt = t; onProg(fets, total, errors); }
        };
        avisa(true);

        async function worker() {
            while (!cancel) {
                const req = pendents[i++];
                if (!req) return;
                try {
                    // La capçalera indica al SW que no guardi: ho fem nosaltres (evita escriure dues vegades)
                    const r = await fetch(req, { headers: { 'X-TC-Descarrega': '1' } });
                    if (r.ok) await cache.put(req, r);
                    else if (r.status !== 404) errors++;   // 404 = no existeix per a aquesta variable/hora
                } catch { errors++; }
                fets++;
                avisa(false);
            }
        }
        await Promise.all(Array.from({ length: PARAL }, worker));
        avisa(true);
    }

    async function netejaVelles() {
        if (!versio()) return false;
        let hiHavia = false;
        for (const k of await caches.keys()) {
            if (k.startsWith(PREFIX) && k !== nomCache()) { await caches.delete(k); hiHavia = true; }
        }
        return hiHavia;
    }

    async function nFitxersGuardats() {
        try {
            if (!versio() || !(await caches.has(nomCache()))) return 0;
            return (await (await caches.open(nomCache())).keys()).length;
        } catch { return 0; }
    }

    // ─── UI (s'injecta a la pestanya "Capes") ──────────────────────
    function estat(txt, cls) {
        const el = $('ppOffEstat');
        if (!el) return;
        el.textContent = txt;
        el.className = 'sistema-estat' + (cls ? ' ' + cls : '');
    }
    function barra(p) { const b = $('ppOffBarra'); if (b) b.style.width = Math.round(p * 100) + '%'; }

    async function refrescarEstatInicial() {
        const n = await nFitxersGuardats();
        estat(n ? 'Dades descarregades ✓' : 'Cap dada descarregada', n ? 'ok' : '');
    }

    async function iniciar() {
        if (enCurs) { cancel = true; return; }
        if (!versio()) { estat('El manifest no té "versio": no es pot descarregar.', 'error'); return; }
        const urls = llistaFitxers();
        if (!urls.length) { estat('No hi ha res per descarregar.', 'error'); return; }
        if (!confirm('Es descarregaran les dades del teu pla per a ús sense connexió. Millor amb Wi-Fi. Continuar?')) return;

        try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch {}
        await netejaVelles();

        enCurs = true; cancel = false;
        const btn = $('ppOffBtn');
        btn.querySelector('.txt').textContent = 'Cancel·lar descàrrega';
        btn.classList.add('carregant');
        try {
            await descarrega(urls, (f, t, err) => {
                barra(f / t);
                estat(`Descarregant… ${Math.floor(f / t * 100)}%`, 'comprovant');
            });
            if (cancel) estat('Descàrrega cancel·lada (el que ja s\'ha baixat es manté).', '');
            else estat('Llest · 100% ✓', 'ok');
        } catch (e) {
            estat('Error: ' + e.message, 'error');
        } finally {
            enCurs = false; cancel = false;
            btn.querySelector('.txt').textContent = 'Descarregar tot (segons el teu pla)';
            btn.classList.remove('carregant');
            if (cancel) barra(0);
        }
    }

    async function esborrar() {
        if (enCurs) return;
        for (const k of await caches.keys()) if (k.startsWith(PREFIX)) await caches.delete(k);
        barra(0);
        estat('Dades descarregades esborrades.', '');
    }

    function injectarUI() {
        const cont = document.querySelector('#panell-pro .capes-cos');
        if (!cont || $('ppOffline')) return !!$('ppOffline');
        const bloc = document.createElement('div');
        bloc.id = 'ppOffline';
        bloc.innerHTML = `
            <div class="cap-titol" style="margin-top:22px;border-top:1px solid var(--line);padding-top:14px;">Mode sense connexió</div>
            <div style="font-size:10.5px;color:var(--muted);line-height:1.5;margin:2px 0 6px;">Descarrega totes les hores i variables incloses al teu pla.</div>
            <button class="sistema-btn" id="ppOffBtn" type="button">
                <span class="ico">⬇</span><span class="txt">Descarregar tot (segons el teu pla)</span>
            </button>
            <div style="height:4px;margin-top:8px;border-radius:2px;background:var(--panel-2);overflow:hidden;">
                <div id="ppOffBarra" style="height:100%;width:0;background:var(--accent);transition:width .2s;"></div>
            </div>
            <div class="sistema-estat" id="ppOffEstat"></div>
            <button class="cap-reset" id="ppOffEsborra" type="button">Esborrar dades descarregades</button>`;
        cont.appendChild(bloc);
        $('ppOffBtn').addEventListener('click', iniciar);
        $('ppOffEsborra').addEventListener('click', esborrar);
        refrescarEstatInicial();
        return true;
    }

    // El panell el crea mapapngs.js; esperem que existeixi
    let intents = 0;
    const tmr = setInterval(() => {
        if (injectarUI() || ++intents > 80) clearInterval(tmr);
    }, 300);

    // Neteja de versions velles quan ja es coneix VERSIO
    let intV = 0;
    const tmrV = setInterval(async () => {
        if (versio()) {
            clearInterval(tmrV);
            const hiHavia = await netejaVelles();
            if (hiHavia && typeof window.mostrarToast === 'function') {
                window.mostrarToast('Hi ha dades noves: torna a descarregar per a ús offline');
            }
            refrescarEstatInicial();
        } else if (++intV > 100) clearInterval(tmrV);
    }, 500);

    window.addEventListener('offline', () => {
        if (typeof window.mostrarToast === 'function') window.mostrarToast('Sense connexió: es mostren les dades descarregades');
    });
})();