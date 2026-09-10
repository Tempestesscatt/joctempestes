// ═══════════════════════════════════════════════════════════════════
//  COPIA JSON SENSE COMA (PER ENGANXAR AL FINAL DE L'ARRAY)
// ═══════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    function arrodonir(v, dec) {
        if (v === null || v === undefined || isNaN(v)) return null;
        const f = Math.pow(10, dec || 0);
        return Math.round(v * f) / f;
    }

    function generarBaseNom() {
        const internal = window._skewtInternal;
        const punt = internal ? internal.puntActual : null;
        let base = 'sondeig';
        let dataStr = '', horaStr = '';
        if (punt) {
            const pp = punt.pobleProper;
            if (pp && pp.nom) base += '_' + pp.nom.replace(/[^a-zA-Z0-9]+/g, '_');
            if (punt.horaItem && punt.horaItem.dateObj) {
                const d = punt.horaItem.dateObj;
                const pad = n => String(n).padStart(2, '0');
                dataStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
                horaStr = pad(d.getHours()) + 'h';
                base += '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + horaStr;
            }
        }
        return { base, dataStr, horaStr, punt };
    }

    function demanarVerificacio() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 6, 12, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                font-family: "Courier New", monospace;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: #0a1420;
                border: 1px solid #1a8a7a;
                border-radius: 6px;
                padding: 24px 28px;
                max-width: 420px;
                width: 90%;
                color: #aabbcc;
                box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            `;

            dialog.innerHTML = `
                <div style="color: #1a8a7a; font-size: 13px; font-weight: bold; margin-bottom: 16px; letter-spacing: 1px;">
                    [ SARS VERIFICATION ]
                </div>
                <div style="color: #667788; font-size: 10px; margin-bottom: 16px; border-bottom: 1px solid rgba(26,138,122,0.15); padding-bottom: 12px;">
                    Enter what actually happened at this time/location
                </div>

                <div style="margin-bottom: 10px;">
                    <label style="display: block; font-size: 10px; color: #556677; margin-bottom: 2px;">HAIL SIZE (cm)</label>
                    <input id="sars_hail" type="number" step="0.5" value="0" style="width:100%; padding:6px 8px; background:#0a1420; border:1px solid #1a3a3a; color:#88ccaa; font-family:'Courier New',monospace; font-size:12px; border-radius:3px; outline:none;">
                </div>

                <div style="margin-bottom: 10px;">
                    <label style="display: block; font-size: 10px; color: #556677; margin-bottom: 2px;">WIND GUST (km/h)</label>
                    <input id="sars_wind" type="number" step="5" value="0" style="width:100%; padding:6px 8px; background:#0a1420; border:1px solid #1a3a3a; color:#88ccaa; font-family:'Courier New',monospace; font-size:12px; border-radius:3px; outline:none;">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #556677; cursor: pointer;">
                        <input id="sars_super" type="checkbox" style="accent-color:#1a8a7a;"> SUPERCELL
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #556677; cursor: pointer;">
                        <input id="sars_multi" type="checkbox" style="accent-color:#1a8a7a;"> MULTICELL
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #556677; cursor: pointer;">
                        <input id="sars_tornado" type="checkbox" style="accent-color:#1a8a7a;"> TORNADO
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #556677; cursor: pointer;">
                        <input id="sars_windflag" type="checkbox" style="accent-color:#1a8a7a;"> STRONG WIND
                    </label>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="display: block; font-size: 10px; color: #556677; margin-bottom: 2px;">NOTES (optional)</label>
                    <input id="sars_notes" type="text" style="width:100%; padding:6px 8px; background:#0a1420; border:1px solid #1a3a3a; color:#88ccaa; font-family:'Courier New',monospace; font-size:11px; border-radius:3px; outline:none;" placeholder="additional observations...">
                </div>

                <div style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid rgba(26,138,122,0.15); padding-top: 14px;">
                    <button id="sars_cancel" style="background:transparent; border:1px solid #2a3a3a; color:#556677; padding:6px 16px; border-radius:3px; font-family:'Courier New',monospace; font-size:10px; cursor:pointer;">CANCEL</button>
                    <button id="sars_confirm" style="background:#1a8a7a; border:none; color:#000a14; padding:6px 20px; border-radius:3px; font-family:'Courier New',monospace; font-size:10px; font-weight:bold; cursor:pointer;">CONFIRM</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            setTimeout(() => document.getElementById('sars_hail').focus(), 100);

            const cleanup = () => { if (overlay.parentNode) overlay.remove(); };

            const getResult = () => {
                const hail = parseFloat(document.getElementById('sars_hail').value) || 0;
                const wind = parseFloat(document.getElementById('sars_wind').value) || 0;
                const supercelula = document.getElementById('sars_super').checked;
                const multicelula = document.getElementById('sars_multi').checked;
                const tornado = document.getElementById('sars_tornado').checked;
                const ventsForts = document.getElementById('sars_windflag').checked || wind >= 90;
                const notes = document.getElementById('sars_notes').value.trim();
                const calamarsaGrossa = hail >= 2;

                return {
                    verificat: { supercelula, multicelula, calamarsaGrossa, tornado, ventsForts },
                    notes: notes || (hail > 0 ? `Hail: ${hail}cm` : '') + (wind > 0 ? (hail > 0 ? ', ' : '') + `Wind: ${wind}km/h` : ''),
                    hail, wind
                };
            };

            document.getElementById('sars_confirm').addEventListener('click', () => {
                const result = getResult();
                cleanup();
                resolve(result);
            });

            document.getElementById('sars_cancel').addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') document.getElementById('sars_confirm').click();
                if (e.key === 'Escape') document.getElementById('sars_cancel').click();
            });
        });
    }

    function generarBlocJSON(verificacio) {
        const internal = window._skewtInternal;
        if (!internal) return null;
        const idx = internal.indexsActual;
        const vent = internal.ventActual;
        const punt = internal.puntActual;
        if (!idx) return null;

        const { base, dataStr, horaStr } = generarBaseNom();
        const pp = punt && punt.pobleProper;

        const vShear01 = vent ? vent.shear01 : null;
        const vShear03 = vent ? vent.shear03 : null;
        const vShear06 = vent ? vent.shear06 : null;
        const vShear08 = vent ? vent.shear08 : null;
        const vSrh01 = vent ? vent.srh01 : null;
        const vSrh03 = vent ? vent.srh03 : null;

        const cas = {
            id: base,
            data: dataStr || null,
            hora: horaStr || null,
            lloc: (pp && pp.nom) ? pp.nom : null,
            lat: punt ? arrodonir(punt.lat, 4) : null,
            lon: punt ? arrodonir(punt.lon, 4) : null,
            origenParcela: idx.origenParcela || null,
            pOrigenParcela: arrodonir(idx.pOrigenParcela, 0),
            tOrigenParcela: arrodonir(idx.tOrigenParcela, 1),
            tdOrigenParcela: arrodonir(idx.tdOrigenParcela, 1),
            cape: arrodonir(idx.cape, 0),
            cin: arrodonir(idx.cin, 0),
            li: arrodonir(idx.li, 1),
            showalter: arrodonir(idx.showalter, 1),
            kIndex: arrodonir(idx.kIndex, 0),
            totalsTotals: arrodonir(idx.totalsTotals, 0),
            pwat: arrodonir(idx.pwat, 1),
            lcl_p: arrodonir(idx.lcl_p, 0),
            lcl_z: arrodonir(idx.lcl_z, 0),
            lfc_p: arrodonir(idx.lfc_p, 0),
            lfc_z: arrodonir(idx.lfc_z, 0),
            el_p: arrodonir(idx.el_p, 0),
            el_z: arrodonir(idx.el_z, 0),
            shear01: arrodonir(vShear01, 1),
            shear03: arrodonir(vShear03, 1),
            shear06: arrodonir(vShear06, 1),
            shear08: arrodonir(vShear08, 1),
            srh01: arrodonir(vSrh01, 0),
            srh03: arrodonir(vSrh03, 0),
            verificat: verificacio ? verificacio.verificat : {
                supercelula: null,
                multicelula: null,
                calamarsaGrossa: null,
                tornado: null,
                ventsForts: null
            },
            notes: verificacio ? verificacio.notes : ""
        };

        // 🔑 SENSE COMA - per enganxar al FINAL de l'array
        return JSON.stringify(cas, null, 2);
    }

    function copiarAlPortaretalls(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
        }
    }

    function mostrarAvis(msg) {
        const wrap = document.getElementById('skewtCanvasWrap');
        if (!wrap) { alert(msg); return; }
        const avis = document.createElement('div');
        avis.textContent = msg;
        avis.style.cssText = `
            position:absolute; top:10px; left:50%; transform:translateX(-50%);
            background:rgba(0,6,12,0.95); color:#88ccaa; border:1px solid #1a8a7a;
            border-radius:4px; padding:8px 14px; font-size:11px; font-family:"Courier New",monospace;
            z-index:9999; box-shadow:0 4px 16px rgba(0,0,0,0.6); pointer-events:none;
            max-width:90%; text-align:center; line-height:1.4; white-space:pre-line;
        `;
        wrap.appendChild(avis);
        setTimeout(() => avis.remove(), 4500);
    }

    async function copiarJSON() {
        const internal = window._skewtInternal;
        if (!internal || !internal.indexsActual) {
            alert('No hi ha dades de sondeig calculades.');
            return;
        }

        const verificacio = await demanarVerificacio();
        if (!verificacio) {
            mostrarAvis('CANCEL·LAT');
            return;
        }

        const blocJSON = generarBlocJSON(verificacio);
        if (!blocJSON) {
            alert('Error generant el JSON.');
            return;
        }

        copiarAlPortaretalls(blocJSON);

        let resum = [];
        if (verificacio.verificat.supercelula) resum.push('SUPERCELL');
        if (verificacio.verificat.multicelula) resum.push('MULTICELL');
        if (verificacio.verificat.calamarsaGrossa) resum.push('HAIL '+verificacio.hail+'cm');
        if (verificacio.verificat.tornado) resum.push('TORNADO');
        if (verificacio.verificat.ventsForts) resum.push('WIND '+verificacio.wind+'km/h');

        mostrarAvis('✅ JSON COPILAT (SENSE COMA)\n' + 
                   (resum.length ? resum.join(' · ') : 'NO SEVERE') + 
                   '\nENGANXA AL FINAL DE L\'ARRAY');
    }

    function afegirBoto() {
        const header = document.querySelector('.skewt-modal-header');
        if (!header) return false;
        if (document.getElementById('skewtBtnCopiarJSON')) return true;

        const btn = document.createElement('button');
        btn.className = 'skewt-btn';
        btn.id = 'skewtBtnCopiarJSON';
        btn.title = 'Copiar dades sense coma (per enganxar al final)';
        btn.innerHTML = '<i class="fas fa-copy"></i> <span>Copiar dades</span>';

        const btnClose = document.getElementById('skewtBtnClose');
        if (btnClose) {
            header.insertBefore(btn, btnClose);
        } else {
            header.appendChild(btn);
        }

        btn.addEventListener('click', copiarJSON);
        return true;
    }

    function esperarIAfegir() {
        if (afegirBoto()) return;
        setTimeout(esperarIAfegir, 300);
    }
    esperarIAfegir();

})();