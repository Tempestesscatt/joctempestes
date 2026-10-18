// precarregar.js
// Sistema de precàrrega massiva per a dades 3D de Tempestes.cat

(function() {
    if (typeof window.totesLesHores === 'undefined') return;

    let _precarregant = false;

    // Icones SVG per evitar problemes amb els emojis
    const icoDescarrega = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    const icoCarregant = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: gira 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
    const icoOk = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    // 1. Estils per al botó flotant
    const estil = document.createElement('style');
    estil.textContent = `
        #prec-flotant {
            position: fixed;
            top: calc(14px + var(--safe-top));
            right: calc(16px + var(--safe-right));
            z-index: 960;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: rgba(13, 17, 23, 0.95);
            border: 1px solid var(--line-strong);
            border-radius: 999px;
            color: var(--text-2);
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.3px;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            transition: all 0.2s ease;
            text-transform: uppercase;
        }
        #prec-flotant:hover {
            background: var(--panel-hover);
            border-color: var(--accent);
            color: var(--accent);
        }
        #prec-flotant.carregant {
            border-color: var(--accent);
            color: var(--accent);
            cursor: wait;
        }
        #prec-flotant.completat {
            border-color: #4ade80;
            color: #4ade80;
        }
        
        /* Barra de progrés interna */
        .prec-barra-bg {
            width: 40px;
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            overflow: hidden;
            display: none;
            margin: 0 4px;
        }
        #prec-flotant.carregant .prec-barra-bg { display: block; }
        .prec-barra-fill {
            height: 100%;
            width: 0%;
            background: var(--accent);
            transition: width 0.2s ease;
        }
        #prec-flotant.completat .prec-barra-fill { background: #4ade80; }
        
        .prec-pct { 
            font-size: 9.5px; 
            font-family: 'SF Mono', ui-monospace, monospace; 
            font-weight: 700;
            min-width: 38px;
            text-align: right;
        }
        @keyframes gira { 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(estil);

    // 2. Creem el botó i l'afegim al body directament
    const btn = document.createElement('button');
    btn.id = 'prec-flotant';
    btn.title = "Descarregar totes les dades per navegar sense internet";
    btn.innerHTML = `
        <span id="prec-ico" style="display:flex;">${icoDescarrega}</span>
        <span id="prec-txt">Precarregar</span>
        <div class="prec-barra-bg"><div id="prec-barra-fill" class="prec-barra-fill"></div></div>
        <span id="prec-pct" class="prec-pct" style="display:none;">0/0</span>
    `;
    document.body.appendChild(btn);

    // Movem el botó perquè quedi al costat del run si aquest existeix, o a la dreta per defecte
    function ajustarPosicio() {
        const infoRun = document.getElementById('info_run');
        if (infoRun && infoRun.classList.contains('visible')) {
            btn.style.top = 'calc(56px + var(--safe-top))';
        } else {
            btn.style.top = 'calc(14px + var(--safe-top))';
        }
    }

    // 3. Lògica de precàrrega
    btn.addEventListener('click', async () => {
        if (_precarregant) return;
        if (!window.totesLesHores || !window.totesLesHores.length) {
            if(typeof window.mostrarToast === 'function') window.mostrarToast("Encara no hi ha dades carregades", "error");
            return;
        }

        const total = window.totesLesHores.length;
        const confirmar = confirm(`Vols descarregar les dades 3D de les ${total} hores per poder navegar sense internet? (Pot trigar una estona i ocupar espai)`);
        if (!confirmar) return;

        _precarregant = true;
        
        const txt = document.getElementById('prec-txt');
        const ico = document.getElementById('prec-ico');
        const pctEl = document.getElementById('prec-pct');
        const barraFill = document.getElementById('prec-barra-fill');

        btn.classList.add('carregant');
        btn.classList.remove('completat');
        ico.innerHTML = icoCarregant;
        txt.style.display = 'none';
        pctEl.style.display = 'inline';
        pctEl.textContent = `0/${total}`;

        let baseRuta = './web_data_NE/imatges/';
        if (window.PNG_BASE) baseRuta = window.PNG_BASE;

        let completats = 0;
        let errors = 0;

        async function baixarHora(info) {
            const clau = `${String(info.hora).padStart(2, '0')}_${info.dia}`;
            const urlSondeig = `${baseRuta}sondeig_${clau}.msgpack.gz`;

            try {
                const res = await fetch(urlSondeig, { cache: 'force-cache' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                await res.arrayBuffer(); 
            } catch (e) {
                console.warn(`[Precarrega] Error a ${clau}:`, e);
                errors++;
            } finally {
                completats++;
                const pct = Math.round((completats / total) * 100);
                barraFill.style.width = pct + '%';
                pctEl.textContent = `${completats}/${total}`;
            }
        }

        let index = 0;
        const limitConcurrent = 3;

        async function treballador() {
            while (index < total) {
                const i = index++;
                await baixarHora(window.totesLesHores[i]);
            }
        }

        const treballadors = Array(limitConcurrent).fill(null).map(() => treballador());
        await Promise.all(treballadors);

        // Finalitzat
        btn.classList.remove('carregant');
        btn.classList.add('completat');
        ico.innerHTML = icoOk;
        pctEl.textContent = 'Fet';
        
        if(typeof window.mostrarToast === 'function') {
            window.mostrarToast(`Precàrrega completada! (${errors} errors)`, 'ok');
        }

        setTimeout(() => {
            btn.classList.remove('completat');
            ico.innerHTML = icoDescarrega;
            txt.style.display = 'inline';
            pctEl.style.display = 'none';
            barraFill.style.width = '0%';
            _precarregant = false;
            ajustarPosicio();
        }, 3500);
    });

    const observer = new MutationObserver(ajustarPosicio);
    const infoRun = document.getElementById('info_run');
    if (infoRun) observer.observe(infoRun, { attributes: true, attributeFilter: ['class'] });
    
    setTimeout(ajustarPosicio, 1000);
    window.addEventListener('resize', ajustarPosicio);

    window.iniciarPrecarregaMassiva = () => btn.click();
})();