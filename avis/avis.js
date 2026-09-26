// ============================================================
// avis.js - Mostra el PNG d'outbreak de /avis/
// Primer intenta nivell.json (instantani); si falla, cerca per força bruta
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // GENERAR TOTS ELS NOMS POSSIBLES (mètode antic, com a fallback)
    // ============================================================

    const ara = new Date();
    const possibles = [];

    for (let d = 0; d < 30; d++) {
        const data = new Date(ara);
        data.setDate(data.getDate() - d);
        const any = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        const dataStr = `${any}${mes}${dia}`;

        const runs = ['21', '18', '15', '12', '09', '06', '03', '00'];
        for (const run of runs) {
            possibles.push(`outbreak_catalunya_${dataStr}_${run}Z.png`);
        }
        possibles.push(`outbreak_catalunya_${dataStr}.png`);
    }
    possibles.push('outbreak_catalunya.png');

    let index = 0;
    let trobat = false;

    // ============================================================
    // FUNCIÓ PRINCIPAL
    // ============================================================

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
            <span style="font-size:14px;color:#8aa3be;margin-top:8px;">Buscant PNG a /avis/</span>
        `;
        img.style.display = 'none';

        // ============================================================
        // MÈTODE RÀPID: llegir nivell.json
        // ============================================================

        fetch('/avis/nivell.json?_=' + Date.now())
            .then(response => {
                if (!response.ok) throw new Error('nivell.json no trobat');
                return response.json();
            })
            .then(data => {
                // Ajusta aquest camp segons l'estructura real de nivell.json
                // Prova diversos noms de camp habituals per si de cas
                const nomFitxer = data.fitxer || data.filename || data.png || data.imatge || data.latest;

                if (!nomFitxer) {
                    console.warn('avis.js: nivell.json trobat però no conté el nom del fitxer, es fa servir cerca per força bruta');
                    provarSeguent();
                    return;
                }

                console.log(`✅ avis.js: nom obtingut via nivell.json: ${nomFitxer}`);
                trobat = true;
                mostrarImatge(`/avis/${nomFitxer}`, nomFitxer);
            })
            .catch(err => {
                console.warn(`avis.js: no s'ha pogut llegir nivell.json (${err.message}), es fa servir cerca per força bruta`);
                provarSeguent();
            });

        // ============================================================
        // MÈTODE FALLBACK: provar cada nom fins a trobar-ne un
        // ============================================================

        function provarSeguent() {
            if (trobat) return;

            if (index >= possibles.length) {
                loading.innerHTML = `
                    <div style="color:#f5c842;font-size:18px;text-align:center;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:36px;display:block;margin-bottom:12px;"></i>
                        No s'ha trobat cap imatge PNG a /avis/
                        <div style="font-size:14px;color:#8aa3be;margin-top:8px;">
                            Genera un PNG amb el script Python
                        </div>
                        <div style="font-size:13px;color:#8aa3be;margin-top:4px;">
                            Obre <a href="/avis/" target="_blank" style="color:#f5c842;">/avis/</a> per veure els fitxers
                        </div>
                    </div>
                `;
                return;
            }

            const nom = possibles[index];
            const url = `/avis/${nom}`;

            fetch(url, { method: 'HEAD' })
                .then(response => {
                    if (trobat) return;
                    if (response.ok) {
                        console.log(`✅ Trobat (força bruta): ${nom}`);
                        trobat = true;
                        mostrarImatge(url, nom);
                    } else {
                        index++;
                        provarSeguent();
                    }
                })
                .catch(() => {
                    if (trobat) return;
                    index++;
                    provarSeguent();
                });
        }

        // ============================================================
        // MOSTRAR LA IMATGE
        // ============================================================

        function mostrarImatge(url, nom) {
            const img = document.getElementById('outbreakImage');
            const loading = document.getElementById('loadingContainer');
            const infoSpan = document.getElementById('outbreakInfo');
            const dateSpan = document.getElementById('outbreakDate');

            const match = nom.match(/(\d{8})/);
            if (match) {
                const dataStr = match[1];
                const any = dataStr.substring(0, 4);
                const mes = dataStr.substring(4, 6);
                const dia = dataStr.substring(6, 8);
                if (infoSpan) {
                    infoSpan.textContent = `${dia}/${mes}/${any} · Risc màxim (10h-21h)`;
                }
            } else if (infoSpan) {
                infoSpan.textContent = `Mapa d'outbreak · Risc màxim (10h-21h)`;
            }

            if (dateSpan) {
                dateSpan.textContent = `Actualitzat: ${new Date().toLocaleString('ca-ES')}`;
            }

            img.onload = function() {
                loading.style.display = 'none';
                img.style.display = 'block';
                console.log(`✅ Mapa carregat: ${nom}`);
            };

            img.onerror = function() {
                console.warn(`❌ Error carregant ${nom}, es reprèn la cerca`);
                trobat = false;
                index++;
                provarSeguent();
            };

            img.src = url + '?_=' + Date.now();
        }
    }

    // ============================================================
    // INICIALITZAR
    // ============================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', carregarOutbreak);
    } else {
        carregarOutbreak();
    }

    console.log('✅ avis.js: Carregat - primer nivell.json, després /avis/');

})();