// precarregar.js
// Sistema de precàrrega massiva total (PNGs, JS de dades, sondejos, etc.)

(function() {
    if (typeof window.totesLesHores === 'undefined') return;

    let _precarregant = false;

    const icoDescarrega = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    const icoCarregant = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: gira 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
    const icoOk = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

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
        #prec-flotant:hover { background: var(--panel-hover); border-color: var(--accent); color: var(--accent); }
        #prec-flotant.carregant { border-color: var(--accent); color: var(--accent); cursor: wait; }
        #prec-flotant.completat { border-color: #4ade80; color: #4ade80; }
        
        .prec-barra-bg {
            width: 40px; height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px; overflow: hidden;
            display: none; margin: 0 4px;
        }
        #prec-flotant.carregant .prec-barra-bg { display: block; }
        .prec-barra-fill {
            height: 100%; width: 0%;
            background: var(--accent);
            transition: width 0.2s ease;
        }
        #prec-flotant.completat .prec-barra-fill { background: #4ade80; }
        
        .prec-pct { 
            font-size: 9.5px; font-family: 'SF Mono', ui-monospace, monospace; 
            font-weight: 700; min-width: 38px; text-align: right;
        }
        @keyframes gira { 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(estil);

    const btn = document.createElement('button');
    btn.id = 'prec-flotant';
    btn.title = "Descarregar absolutament totes les dades per navegar sense internet";
    btn.innerHTML = `
        <span id="prec-ico" style="display:flex;">${icoDescarrega}</span>
        <span id="prec-txt">Precarregar</span>
        <div class="prec-barra-bg"><div id="prec-barra-fill" class="prec-barra-fill"></div></div>
        <span id="prec-pct" class="prec-pct" style="display:none;">0/0</span>
    `;
    document.body.appendChild(btn);

    function ajustarPosicio() {
        const infoRun = document.getElementById('info_run');
        if (infoRun && infoRun.classList.contains('visible')) {
            btn.style.top = 'calc(56px + var(--safe-top))';
        } else {
            btn.style.top = 'calc(14px + var(--safe-top))';
        }
    }

    btn.addEventListener('click', async () => {
        if (_precarregant) return;
        if (!window.totesLesHores || !window.totesLesHores.length) {
            if(typeof window.mostrarToast === 'function') window.mostrarToast("Encara no hi ha dades carregades", "error");
            return;
        }

        const totalHores = window.totesLesHores.length;
        // Calculem aproximadament el pes (posem uns 5MB per hora per tenir una idea)
        const confirmar = confirm(`Vols descarregar TOTES les dades del visor (${totalHores} hores)? Això inclou mapes, vent, isolínies i sondejos. Pot ocupar molt d'espai i trigar uns minuts.`);
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
        pctEl.textContent = `0%`;

        let baseRuta = './web_data_NE/imatges/';
        if (window.PNG_BASE) baseRuta = window.PNG_BASE;

        // 1. Construïm la llista de TOTES les URLs a descarregar
        const urls = new Set();

        // Fitxers bàsics del mapa
        urls.add(baseRuta + 'fons.png');
        urls.add(baseRuta + 'vores.png');
        urls.add(baseRuta + 'manifest.json');
        urls.add(baseRuta + 'info_run.json');
        urls.add(baseRuta + 'noms.js');
        urls.add(baseRuta + 'lineas.js');
        urls.add(baseRuta + 'comarques.js');

        // Variables que tenen llegenda
        const llegendes = ['cape', 'lifted_index', 'dcape', 'shear_01', 'shear_03', 'shear_06', 'srh_01', 'srh_03'];
        llegendes.forEach(v => urls.add(baseRuta + 'legend_' + v + '.png'));

        // Recorrem totes les hores
        window.totesLesHores.forEach(info => {
            const hora = String(info.hora).padStart(2, '0');
            const clauHora = `${hora}_${info.dia}`;

            // 1. Sondeig 3D (pesa molt i és el que permet dibuixar el vent i fer Skew-T)
            urls.add(baseRuta + 'sondeig_' + clauHora + '.msgpack.gz');
            
            // 2. Storm motion (barbes de tempesta)
            urls.add(baseRuta + 'stormmotion_' + clauHora + '.js');

            // 3. Dades de vent de superfície
            urls.add(baseRuta + 'vent_' + clauHora + '.js');

            // 4. Per a cada variable que hi ha en aquesta hora, descarreguem el PNG, les isolínies i la llegenda
            if (info.variables && Array.isArray(info.variables)) {
                info.variables.forEach(varNom => {
                    // Saltem les que sabem que no tenen dades o que no es fan servir
                    if (varNom === 'su' || varNom === 'sv') return;

                    // Imatge de dades
                    urls.add(baseRuta + 'sfc_' + clauHora + '_' + varNom + '.png');
                    // Llegenda
                    urls.add(baseRuta + 'legend_' + varNom + '.png');
                    // Isolínies (el servidor pot no tenir-les per a totes, però ho intentem)
                    urls.add(baseRuta + 'isolines_' + clauHora + '_' + varNom + '.js');
                });
            }
        });

        // 5. Nivells 3D (Nivells de pressió: 1000, 925, 850, 700, 500, 300, 200)
        const nivells3D = [1000, 925, 850, 700, 500, 300, 200];
        const vars3D = ['t', 'dpt', 'r', 'wind_speed', 'w'];
        const vars3DCol = ['shear_01', 'shear_03', 'shear_06', 'srh_01', 'srh_03', 'dcape', 'lifted_index', 'lcl_m', 'lfc_m', 'storm_speed'];

        window.totesLesHores.forEach(info => {
            const hora = String(info.hora).padStart(2, '0');
            const clauHora = `${hora}_${info.dia}`;

            // Imatges de nivells de pressió
            nivells3D.forEach(nivell => {
                vars3D.forEach(v => {
                    urls.add(baseRuta + '3d_' + clauHora + '_' + v + '_' + nivell + '.png');
                    urls.add(baseRuta + 'isolines_3d_' + clauHora + '_' + v + '_' + nivell + '.js');
                });
            });

            // Imatges de paràmetres de columna (tempestes severes)
            vars3DCol.forEach(v => {
                urls.add(baseRuta + '3d_' + clauHora + '_' + v + '_col.png');
                urls.add(baseRuta + 'isolines_3d_' + clauHora + '_' + v + '_col.js');
            });
        });

        // Convertim el Set a un Array per poder-lo recórrer
        const llistaUrls = Array.from(urls);
        const totalFitxers = llistaUrls.length;
        
        let completats = 0;
        let errors = 0;

        async function descarregarUrl(url) {
            try {
                // Utilitzem fetch amb force-cache perquè es guardi a la memòria cau del navegador
                const res = await fetch(url, { cache: 'force-cache' });
                // Si la resposta no és OK (ex: 404 perquè no existeix aquesta imatge en aquesta hora), no passa res, l'ignorem.
            } catch (e) {
                errors++;
            } finally {
                completats++;
                const pct = Math.round((completats / totalFitxers) * 100);
                barraFill.style.width = pct + '%';
                pctEl.textContent = pct + '%';
            }
        }

        // Baixem de 6 en 6 perquè sigui ràpid però no bloquegi el navegador
        let index = 0;
        const limitConcurrent = 6;

        async function treballador() {
            while (index < totalFitxers) {
                const i = index++;
                await descarregarUrl(llistaUrls[i]);
            }
        }

        const treballadors = Array(limitConcurrent).fill(null).map(() => treballador());
        await Promise.all(treballadors);

        // Finalitzat
        btn.classList.remove('carregant');
        btn.classList.add('completat');
        ico.innerHTML = icoOk;
        pctEl.textContent = 'Fet!';
        
        if(typeof window.mostrarToast === 'function') {
            window.mostrarToast(`Precàrrega total completada! (${totalFitxers} arxius)`, 'ok');
        }

        setTimeout(() => {
            btn.classList.remove('completat');
            ico.innerHTML = icoDescarrega;
            txt.style.display = 'inline';
            pctEl.style.display = 'none';
            barraFill.style.width = '0%';
            _precarregant = false;
            ajustarPosicio();
        }, 4000);
    });

    const observer = new MutationObserver(ajustarPosicio);
    const infoRun = document.getElementById('info_run');
    if (infoRun) observer.observe(infoRun, { attributes: true, attributeFilter: ['class'] });
    
    setTimeout(ajustarPosicio, 1000);
    window.addEventListener('resize', ajustarPosicio);

    window.iniciarPrecarregaMassiva = () => btn.click();
})();