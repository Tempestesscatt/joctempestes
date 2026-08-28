// ============================================================
// avis/avis.js - Carrega el PNG de /avis/
// ============================================================

(function() {
    'use strict';

    const CONFIG = {
        PNG_FOLDER: '/avis/',
        REFRESH_INTERVAL: 10 * 60 * 1000,
    };

    let refreshTimer = null;

    function carregarOutbreak() {
        const img = document.getElementById('outbreakImage');
        const loading = document.getElementById('loadingContainer');
        const infoSpan = document.getElementById('outbreakInfo');
        const dateSpan = document.getElementById('outbreakDate');

        if (!img || !loading) {
            console.warn('avis.js: No s\'han trobat els elements DOM');
            return;
        }

        loading.style.display = 'flex';
        loading.innerHTML = `
            <div style="width:60px;height:60px;border:4px solid #f5c842;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:20px;"></div>
            <span>Carregant mapa d'outbreak...</span>
        `;
        img.style.display = 'none';

        // ============================================================
        // PROVAR ELS PNGs MÉS RECENTS
        // ============================================================

        const ara = new Date();
        const possibles = [];

        // Generar totes les combinacions possibles
        for (let d = 0; d < 10; d++) {
            const data = new Date(ara);
            data.setDate(data.getDate() - d);
            const any = data.getFullYear();
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            const dia = String(data.getDate()).padStart(2, '0');
            const dataStr = `${any}${mes}${dia}`;
            
            // Runs de més recent a més antic
            const runs = ['21', '18', '15', '12', '09', '06', '03', '00'];
            for (const run of runs) {
                possibles.push({
                    nom: `outbreak_catalunya_${dataStr}_${run}Z.png`,
                    data: data,
                    run: run
                });
            }
        }

        let index = 0;

        function provarSeguent() {
            if (index >= possibles.length) {
                loading.innerHTML = `
                    <div style="color:#f5c842;font-size:18px;text-align:center;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:36px;display:block;margin-bottom:12px;"></i>
                        No s'ha trobat cap imatge PNG
                        <div style="font-size:14px;color:#8aa3be;margin-top:8px;">Carpeta: ${CONFIG.PNG_FOLDER}</div>
                    </div>
                `;
                return;
            }

            const f = possibles[index];
            const url = `${CONFIG.PNG_FOLDER}${f.nom}`;

            fetch(url, { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        console.log(`✅ Trobat: ${f.nom}`);
                        carregarImatge(url, f);
                    } else {
                        index++;
                        provarSeguent();
                    }
                })
                .catch(() => {
                    index++;
                    provarSeguent();
                });
        }

        function carregarImatge(url, f) {
            // Actualitzar info
            if (infoSpan) {
                const dataStr = f.data.toLocaleDateString('ca-ES', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                });
                infoSpan.textContent = `Run ${f.run}Z · ${dataStr} · Risc màxim (10h-21h)`;
            }
            
            if (dateSpan) {
                dateSpan.textContent = `Actualitzat: ${new Date().toLocaleString('ca-ES')}`;
            }

            img.onload = function() {
                loading.style.display = 'none';
                img.style.display = 'block';
                console.log(`✅ Mapa carregat: ${f.nom}`);
                programarRefresc();
            };

            img.onerror = function() {
                console.warn(`❌ Error carregant ${f.nom}`);
                index++;
                provarSeguent();
            };

            // Afegir timestamp per evitar cache
            img.src = url + '?_=' + Date.now();
        }

        // ============================================================
        // COMENÇAR LA CERCA
        // ============================================================

        provarSeguent();
    }

    function programarRefresc() {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            console.log('🔄 Refresc automàtic');
            carregarOutbreak();
        }, CONFIG.REFRESH_INTERVAL);
    }

    // ============================================================
    // INICIALITZAR
    // ============================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', carregarOutbreak);
    } else {
        carregarOutbreak();
    }

    console.log('✅ avis.js: Carregat');

})();