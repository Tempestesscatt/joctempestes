// ═══════════════════════════════════════════════════════════════════════
//  preferits.js — Destacades + estat guardat + hora actual (Madrid)
//  Complement de mapapngs.js (v5.1). Carrega'l DESPRÉS d'aquest, amb defer.
//
//   1) Pestanya "★ Destacades": estrella a cada variable; en entrar s'obre aquí.
//   2) Recorda l'última capa 3D/columna (la variable de superfície i la
//      resta d'ajustos ja els guarda mapapngs.js).
//   3) En entrar mostra l'hora actual d'Europe/Madrid (CET/CEST automàtic).
// ═══════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    const CLAU_FAV = 'tempestescat_destacades_v1';
    const CLAU_ESTAT = 'tempestescat_estat_v1';

    const llegir = (k, def) => {
        try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; }
        catch { return def; }
    };
    const escriure = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

    let favs = llegir(CLAU_FAV, []);
    favs = Array.isArray(favs) ? favs.filter(x => typeof x === 'string') : [];

    let restaurat = false;     // l'última capa 3D ja s'ha restaurat (o no calia)
    let interactuat = false;   // l'usuari ja ha tocat el panell: ja es pot guardar l'estat
    let autoIdx = -1;          // hora triada automàticament (hora actual de Madrid)
    let obs = null;

    // ─── 1) Hora actual de Madrid ──────────────────────────────────────
    const _fmtHora = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23',
    });
    function horaMadrid() {
        const p = _fmtHora.formatToParts(new Date()).find(x => x.type === 'hour');
        return p ? parseInt(p.value, 10) % 24 : new Date().getHours();
    }

    // Índex (dins totesLesHores) de l'hora d'avui més propera per sota de l'actual.
    // Salta hores sense dades i hores bloquejades (així no surt cap avís de login).
    function indexHoraMadrid() {
        const hs = window.totesLesHores || [];
        const ara = horaMadrid();
        // Mateixa regla que mapapngs: sense sessió només 1 de cada 3 hores
        const permesa = i => !!window._firebaseUser || i % 3 === 0;
        let millor = -1, puntMillor = Infinity;
        for (let i = 0; i < hs.length; i++) {
            const h = hs[i];
            if (!h || h.dia !== 'avui' || !h.variables || !h.variables.length) continue;
            if (!permesa(i)) continue;
            const d = h.hora - ara;
            const punt = d <= 0 ? -d : 1000 + d;   // prefereix l'última hora ja arribada
            if (punt < puntMillor) { puntMillor = punt; millor = i; }
        }
        return millor;
    }
    window.indexHoraMadrid = indexHoraMadrid;

    function aplicarHoraActual() {
        const i = indexHoraMadrid();
        if (i < 0) return;
        autoIdx = i;
        if (typeof window.getCurIdx === 'function' && typeof window.mostrarHoraIdx === 'function'
            && window.getCurIdx() !== i) window.mostrarHoraIdx(i);
    }

    // ─── 2) Estat guardat (capa 3D / columna) ──────────────────────────
    function guardarEstat() {
        if (!restaurat && !interactuat) return;   // no trepitgem l'estat guardat abans d'hora
        const a = typeof window.getCapa3DActiva === 'function' ? window.getCapa3DActiva() : null;
        escriure(CLAU_ESTAT, { capa3D: a ? { var: a.var, nivell: a.nivell } : null });
    }

    function provarRestaurar() {
        if (restaurat) return;
        const s = llegir(CLAU_ESTAT, null);
        const c = s && s.capa3D;
        if (!c || !c.var || c.nivell == null) { restaurat = true; return; }
        if (typeof window.getCapa3DActiva === 'function' && window.getCapa3DActiva()) { restaurat = true; return; }
        // El pla es carrega de forma asíncrona: si encara no hi ha accés, ho reintenta a 'tc:pla'
        if (typeof window.potVeure3D !== 'function' || !window.potVeure3D(c.var, c.nivell)) return;
        restaurat = true;
        const esCol = c.nivell === 'col';
        const el = esCol
            ? document.querySelector('#ppLlistaVar .param-row[data-clau="3d_' + c.var + '_col"]')
            : document.querySelector('#ppLlistaVar .pp3d-chip[data-var="' + c.var + '"][data-niv="' + c.nivell + '"]');
        if (el) el.click();
        else if (typeof window.mostrarCapa3D === 'function') window.mostrarCapa3D(c.var, c.nivell);
    }

    // ─── 3) Destacades ─────────────────────────────────────────────────
    function desarFavs() { escriure(CLAU_FAV, favs); }

    function alternarFav(clau) {
        const i = favs.indexOf(clau);
        if (i >= 0) favs.splice(i, 1); else favs.push(clau);
        desarFavs();
        sincronitzar();
    }

    function crearEstrella(clau) {
        const b = document.createElement('button');
        const on = favs.includes(clau);
        b.type = 'button';
        b.className = 'fav-star' + (on ? ' on' : '');
        b.textContent = on ? '★' : '☆';
        b.title = on ? 'Treure de destacades' : 'Afegir a destacades';
        b.setAttribute('aria-label', b.title);
        b.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            alternarFav(clau);
        });
        return b;
    }

    function filesOriginals() {
        return document.querySelectorAll('#ppLlistaVar .param-row');
    }

    function pintarEstrelles() {
        filesOriginals().forEach(row => {
            const clau = row.dataset.clau;
            if (!clau) return;
            const ant = row.querySelector('.fav-star');
            if (ant) ant.remove();
            row.appendChild(crearEstrella(clau));
        });
    }

    // Fila "mirall": còpia de la fila original que en delega el clic (així es
    // respecta sempre el control de plans, avisos i bloquejos de mapapngs.js)
    function crearMirall(clau, o) {
        const item = document.createElement('div');
        item.className = 'fav-item';

        const row = o.cloneNode(true);
        row.style.display = '';
        row.querySelectorAll('.param-info-btn, .fav-star').forEach(e => e.remove());
        row.addEventListener('click', () => o.click());

        const oi = o.querySelector('.param-info-btn');
        if (oi) {
            const i = document.createElement('button');
            i.type = 'button';
            i.className = 'param-info-btn';
            i.textContent = 'i';
            i.title = oi.title || '';
            i.setAttribute('aria-label', oi.getAttribute('aria-label') || 'Ajuda');
            i.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); oi.click(); });
            row.appendChild(i);
        }
        row.appendChild(crearEstrella(clau));
        item.appendChild(row);

        // Variables per nivell de pressió: xips de nivell sempre visibles
        const bloc = o.closest('.pp3d-bloc');
        if (bloc && o.dataset.v3d && !clau.endsWith('_col')) {
            const w = document.createElement('div');
            w.className = 'fav-niv';
            bloc.querySelectorAll('.pp3d-chip').forEach(c => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'pp3d-chip' + (c.classList.contains('actiu') ? ' actiu' : '')
                    + (c.classList.contains('bloquejat') ? ' bloquejat' : '');
                b.dataset.var = c.dataset.var;
                b.dataset.niv = c.dataset.niv;
                b.textContent = c.textContent;
                b.title = c.title;
                b.addEventListener('click', e => { e.stopPropagation(); c.click(); });
                w.appendChild(b);
            });
            item.appendChild(w);
        }
        return item;
    }

    function pintarDestacades() {
        const cont = document.getElementById('ppLlistaFav');
        if (!cont) return;
        cont.textContent = '';
        const orig = new Map();
        filesOriginals().forEach(r => orig.set(r.dataset.clau, r));
        const frag = document.createDocumentFragment();
        let n = 0;
        for (const clau of favs) {
            const o = orig.get(clau);
            if (!o) continue;
            frag.appendChild(crearMirall(clau, o));
            n++;
        }
        if (!n) {
            const b = document.createElement('div');
            b.className = 'pp-buit';
            b.style.display = 'block';
            b.textContent = 'Encara no tens destacades. Toca l’estrella ☆ de qualsevol variable perquè aparegui aquí.';
            frag.appendChild(b);
        }
        cont.appendChild(frag);
    }

    function sincronitzar() {
        pintarEstrelles();
        pintarDestacades();
        if (obs) obs.takeRecords();   // descarta els canvis propis: evita bucles
    }

    function activarTab(nom) {
        const p = document.getElementById('panell-pro');
        if (!p) return;
        p.querySelectorAll('.pp-tab').forEach(x => x.classList.toggle('actiu', x.dataset.tab === nom));
        p.querySelectorAll('.pp-cos').forEach(c => c.classList.toggle('actiu', c.dataset.cos === nom));
    }

    // ─── UI: pestanya + contenidor ─────────────────────────────────────
    function crearUI() {
        const p = document.getElementById('panell-pro');
        if (!p) return false;
        if (p.querySelector('.pp-tab[data-tab="favorits"]')) return true;
        const tabs = p.querySelector('.pp-tabs');
        const cosVar = p.querySelector('.pp-cos[data-cos="variables"]');
        if (!tabs || !cosVar) return false;

        const tab = document.createElement('button');
        tab.className = 'pp-tab';
        tab.dataset.tab = 'favorits';
        tab.textContent = '★';
        tab.title = 'Destacades';
        tab.setAttribute('aria-label', 'Destacades');
        tab.style.flex = '0 0 34px';
        tab.addEventListener('click', () => activarTab('favorits'));
        tabs.insertBefore(tab, tabs.firstChild);

        const cos = document.createElement('div');
        cos.className = 'pp-cos';
        cos.dataset.cos = 'favorits';
        cos.innerHTML = '<div class="pp-llista" id="ppLlistaFav"></div>';
        cosVar.parentNode.insertBefore(cos, cosVar);
        return true;
    }

    function injectarEstils() {
        if (document.getElementById('preferits-estils')) return;
        const st = document.createElement('style');
        st.id = 'preferits-estils';
        st.textContent = `
            .fav-star{flex:0 0 19px;width:19px;height:19px;padding:0;border:0;background:none;
                color:#8da2bb;font:400 16px/19px system-ui,sans-serif;text-align:center;cursor:pointer;opacity:.75}
            .fav-star:hover,.fav-star:focus-visible{opacity:1;color:#ffc53d;outline:none}
            .fav-star.on{color:#ffc53d;opacity:1}
            #ppLlistaFav .param-row{gap:7px}
            #ppLlistaFav .param-row>span:first-child{flex:1;min-width:0}
            .fav-niv{display:flex;flex-wrap:wrap;gap:5px;padding:3px 12px 9px 22px}
        `;
        document.head.appendChild(st);
    }

    // ─── Arrencada ─────────────────────────────────────────────────────
    function arrencar() {
        injectarEstils();
        if (!crearUI()) return;
        const llista = document.getElementById('ppLlistaVar');

        // El panell es reconstrueix en login/logout/pla: es repinten estrelles i destacades.
        let rafSync = null, tmrGuarda = null;
        obs = new MutationObserver(recs => {
            if (recs.some(r => r.type === 'childList')) {
                if (!rafSync) rafSync = requestAnimationFrame(() => { rafSync = null; sincronitzar(); });
            }
            if (recs.some(r => r.type === 'attributes')) {
                clearTimeout(tmrGuarda);
                tmrGuarda = setTimeout(guardarEstat, 300);
            }
        });
        obs.observe(llista, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

        document.getElementById('panell-pro').addEventListener('pointerdown', () => { interactuat = true; }, true);

        sincronitzar();
        aplicarHoraActual();   // només actua si mapapngs.js no ha triat ja aquesta hora
        provarRestaurar();

        window.addEventListener('tc:pla', provarRestaurar);
        window.addEventListener('tc:login', () => {
            // En iniciar sessió s'obren més hores: si l'usuari no ha canviat d'hora, s'ajusta
            if (typeof window.getCurIdx === 'function' && window.getCurIdx() === autoIdx) aplicarHoraActual();
            provarRestaurar();
        });

        if (favs.length) activarTab('favorits');
    }

    function esperarPanell() {
        let t = 0;
        const iv = setInterval(() => {
            t += 150;
            if (document.querySelector('#ppLlistaVar .param-row')) {
                clearInterval(iv);
                try { arrencar(); console.log('[preferits] actiu'); }
                catch (e) { console.error('[preferits] error', e); }
            }
            else if (t > 60000) { clearInterval(iv); console.warn('[preferits] no s\'ha trobat el panell'); }
        }, 150);
    }

    window.destacades = {
        llista: () => favs.slice(),
        afegir: c => { if (!favs.includes(c)) alternarFav(c); },
        treure: c => { if (favs.includes(c)) alternarFav(c); },
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', esperarPanell);
    else esperarPanell();
})();