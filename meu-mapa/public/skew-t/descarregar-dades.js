// ═══════════════════════════════════════════════════════════════════
//  GENERADOR JSON SARS — AMB NOM DE ZONA/COMARCA
//  Desa sobreescrivint historial_sondejos.json (llegeix abans d'escriure).
// ═══════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    let fileHandle = null;

    // ─── UTILITATS ────────────────────────────────────────────────────
    function arrodonir(v, dec) {
        if (v === null || v === undefined || isNaN(v)) return null;
        const f = Math.pow(10, dec || 0);
        return Math.round(v * f) / f;
    }

    function esFinit(v) {
        return v !== null && v !== undefined && !isNaN(v) && isFinite(v);
    }

    function humitatRelativa(tC, tdC) {
        if (!esFinit(tC) || !esFinit(tdC)) return null;
        const es = 6.112 * Math.exp((17.67 * tC) / (tC + 243.5));
        const e  = 6.112 * Math.exp((17.67 * tdC) / (tdC + 243.5));
        return Math.min(100, Math.max(0, (e / es) * 100));
    }

    function relacioMescla(tdC, pHpa) {
        if (!esFinit(tdC) || !esFinit(pHpa) || pHpa <= 0) return null;
        const e = 6.112 * Math.exp((17.67 * tdC) / (tdC + 243.5));
        return 621.97 * e / Math.max(pHpa - e, 0.1);
    }

    function bulbHumit(tC, tdC, pHpa) {
        if (!esFinit(tC) || !esFinit(tdC) || !esFinit(pHpa)) return null;
        if (tdC >= tC) return tC;
        const rh = humitatRelativa(tC, tdC);
        if (!esFinit(rh)) return null;
        const tw = tC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
                   Math.atan(tC + rh) - Math.atan(rh - 1.676331) +
                   0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
        return esFinit(tw) ? tw : null;
    }

    function generarBaseNom(zona) {
        const internal = window._skewtInternal;
        const punt = internal ? internal.puntActual : null;
        let base = 'sondeig';
        let dataStr = '', horaStr = '';
        
        // Utilitzem el nom de la zona que ens han passat
        const nomNeteja = zona ? zona.replace(/[^a-zA-Z0-9À-ÿ\s-]+/g, '').trim() : 'Zona';
        base += '_' + nomNeteja.replace(/\s+/g, '_');

        if (punt && punt.horaItem && punt.horaItem.dateObj) {
            const d = punt.horaItem.dateObj;
            const pad = n => String(n).padStart(2, '0');
            dataStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
            horaStr = pad(d.getHours()) + 'h';
            base += '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + horaStr;
        }
        return { base, dataStr, horaStr, punt };
    }

    // ─── DIÀLEG DE VERIFICACIÓ (AMB CAMP DE ZONA) ─────────────────────
    function demanarVerificacio() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; top:0; left:0; width:100%; height:100%;
                background: rgba(0,6,12,0.85); display:flex; align-items:center;
                justify-content:center; z-index:99999; font-family:"Courier New",monospace;
            `;
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background:#0a1420; border:1px solid #1a8a7a; border-radius:6px;
                padding:24px 28px; max-width:460px; width:90%; color:#aabbcc;
                box-shadow:0 8px 32px rgba(0,0,0,0.8); max-height:90vh; overflow-y:auto;
            `;
            dialog.innerHTML = `
                <div style="color:#1a8a7a; font-size:13px; font-weight:bold; margin-bottom:16px; letter-spacing:1px;">
                    [ SARS VERIFICATION ]
                </div>
                <div style="color:#667788; font-size:10px; margin-bottom:16px; border-bottom:1px solid rgba(26,138,122,0.15); padding-bottom:12px;">
                    Enter what actually happened at this time/location
                </div>

                <div style="margin-bottom:10px;">
                    <label style="display:block; font-size:10px; color:#556677; margin-bottom:2px;">ZONA / COMARCA / POBLE (Opcional)</label>
                    <input id="sars_zona" type="text" placeholder="Ex: Berguedà, Solsonès..." style="width:100%; padding:6px 8px; background:#0a1420; border:1px solid #1a8a7a; color:#88ccaa; font-family:'Courier New',monospace; font-size:12px; border-radius:3px; outline:none;">
                </div>

                <div style="margin-bottom:10px;">
                    <label style="display:block; font-size:10px; color:#556677; margin-bottom:2px;">HAIL SIZE (cm)</label>
                    <input id="sars_hail" type="number" step="0.5" value="0" style="width:100%; padding:6px 8px; background:#0a1420; border:1px solid #1a3a3a; color:#88ccaa; font-family:'Courier New',monospace; font-size:12px; border-radius:3px; outline:none;">
                </div>

                <div style="margin-bottom:10px;">
                    <label style="display:block; font-size:10px; color:#556677; margin-bottom:2px;">WIND GUST (km/h)</label>
                    <input id="sars_wind" type="number" step="5" value="0" style="width:100%; padding:6px 8px; background:#0a1420; border:1px solid #1a3a3a; color:#88ccaa; font-family:'Courier New',monospace; font-size:12px; border-radius:3px; outline:none;">
                </div>

                <div style="margin-bottom:10px;">
                    <label style="display:block; font-size:10px; color:#556677; margin-bottom:2px;">RAIN (mm)</label>
                    <input id="sars_rain" type="number" step="0.1" value="0" style="width:100%; padding:6px 8px; background:#0a1420; border:1px solid #1a3a3a; color:#88ccaa; font-family:'Courier New',monospace; font-size:12px; border-radius:3px; outline:none;">
                </div>

                <div style="margin-bottom:10px;">
                    <label style="display:block; font-size:10px; color:#556677; margin-bottom:2px;">SNOW (cm)</label>
                    <input id="sars_snow" type="number" step="0.1" value="0" style="width:100%; padding:6px 8px; background:#0a1420; border:1px solid #1a3a3a; color:#88ccaa; font-family:'Courier New',monospace; font-size:12px; border-radius:3px; outline:none;">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#556677; cursor:pointer;">
                        <input id="sars_super" type="checkbox" style="accent-color:#1a8a7a;"> SUPERCELL
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#556677; cursor:pointer;">
                        <input id="sars_multi" type="checkbox" style="accent-color:#1a8a7a;"> MULTICELL
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#556677; cursor:pointer;">
                        <input id="sars_tornado" type="checkbox" style="accent-color:#1a8a7a;"> TORNADO
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#556677; cursor:pointer;">
                        <input id="sars_windflag" type="checkbox" style="accent-color:#1a8a7a;"> STRONG WIND
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#556677; cursor:pointer;">
                        <input id="sars_snowflag" type="checkbox" style="accent-color:#1a8a7a;"> SNOW
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#556677; cursor:pointer;">
                        <input id="sars_heatflag" type="checkbox" style="accent-color:#1a8a7a;"> EXTREME HEAT
                    </label>
                </div>

                <div style="margin-bottom:14px;">
                    <label style="display:block; font-size:10px; color:#556677; margin-bottom:2px;">NOTES (optional)</label>
                    <input id="sars_notes" type="text" style="width:100%; padding:6px 8px; background:#0a1420; border:1px solid #1a3a3a; color:#88ccaa; font-family:'Courier New',monospace; font-size:11px; border-radius:3px; outline:none;" placeholder="additional observations...">
                </div>

                <div style="display:flex; gap:8px; justify-content:flex-end; border-top:1px solid rgba(26,138,122,0.15); padding-top:14px;">
                    <button id="sars_cancel" style="background:transparent; border:1px solid #2a3a3a; color:#556677; padding:6px 16px; border-radius:3px; font-family:'Courier New',monospace; font-size:10px; cursor:pointer;">CANCEL</button>
                    <button id="sars_confirm" style="background:#1a8a7a; border:none; color:#000a14; padding:6px 20px; border-radius:3px; font-family:'Courier New',monospace; font-size:10px; font-weight:bold; cursor:pointer;">CONFIRM</button>
                </div>
            `;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            setTimeout(() => document.getElementById('sars_zona').focus(), 100);

            const cleanup = () => { if (overlay.parentNode) overlay.remove(); };

            const getResult = () => {
                const zona = document.getElementById('sars_zona').value.trim();
                const hail = parseFloat(document.getElementById('sars_hail').value) || 0;
                const wind = parseFloat(document.getElementById('sars_wind').value) || 0;
                const rain = parseFloat(document.getElementById('sars_rain').value) || 0;
                const snow = parseFloat(document.getElementById('sars_snow').value) || 0;
                const supercelula = document.getElementById('sars_super').checked;
                const multicelula = document.getElementById('sars_multi').checked;
                const tornado = document.getElementById('sars_tornado').checked;
                const ventsForts = document.getElementById('sars_windflag').checked || wind >= 90;
                const neu = document.getElementById('sars_snowflag').checked || snow > 0;
                const calorExtrema = document.getElementById('sars_heatflag').checked;
                const notes = document.getElementById('sars_notes').value.trim();
                const calamarsaGrossa = hail >= 2;

                let notesAuto = [];
                if (hail > 0) notesAuto.push(`Hail: ${hail}cm`);
                if (wind > 0) notesAuto.push(`Wind: ${wind}km/h`);
                if (rain > 0) notesAuto.push(`Rain: ${rain}mm`);
                if (snow > 0) notesAuto.push(`Snow: ${snow}cm`);

                return {
                    zona: zona,
                    verificat: { supercelula, multicelula, calamarsaGrossa, tornado, ventsForts, neu, calorExtrema },
                    notes: notes || notesAuto.join(', '),
                    hail, wind, rain, snow
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

    // ─── CONSTRUCCIÓ DE L'OBJECTE CAS ─────────────────────────────────
    function generarObjecteCas(verificacio) {
        const internal = window._skewtInternal;
        if (!internal) return null;
        const idx = internal.indexsActual;
        const vent = internal.ventActual;
        const punt = internal.puntActual;
        const perfil = internal.perfilActual;
        const unitat = internal.unitatVent || 'kmh';
        if (!idx) return null;

        const { base, dataStr, horaStr } = generarBaseNom(verificacio.zona);
        const pp = punt && punt.pobleProper;
        const fVent = unitat === 'kt' ? 1.94384 : (unitat === 'kmh' ? 3.6 : 1);

        const perfilVertical = [];
        if (perfil && perfil.p) {
            for (let i = 0; i < perfil.p.length; i++) {
                const tC = perfil.t[i];
                const tdC = perfil.td[i];
                const pHpa = perfil.p[i];
                const zM = perfil.z ? perfil.z[i] : null;
                const uMs = perfil.u ? perfil.u[i] : null;
                const vMs = perfil.v ? perfil.v[i] : null;
                const spdMs = (esFinit(uMs) && esFinit(vMs)) ? Math.sqrt(uMs*uMs + vMs*vMs) : null;
                let dirDeg = null;
                if (esFinit(uMs) && esFinit(vMs)) {
                    dirDeg = Math.atan2(-uMs, -vMs) * 180 / Math.PI;
                    if (dirDeg < 0) dirDeg += 360;
                }
                perfilVertical.push({
                    p: arrodonir(pHpa, 0),
                    z: arrodonir(zM, 0),
                    t: arrodonir(tC, 1),
                    td: arrodonir(tdC, 1),
                    hr: arrodonir(humitatRelativa(tC, tdC), 0),
                    tw: arrodonir(bulbHumit(tC, tdC, pHpa), 1),
                    w: arrodonir(relacioMescla(tdC, pHpa), 2),
                    u: arrodonir(uMs, 1),
                    v: arrodonir(vMs, 1),
                    spd: arrodonir(spdMs ? spdMs * fVent : null, 0),
                    dir: arrodonir(dirDeg, 0)
                });
            }
        }

        function tAt(pTarget) {
            if (!perfil || !perfil.p) return null;
            for (let i = 0; i < perfil.p.length - 1; i++) {
                if (perfil.p[i] >= pTarget && perfil.p[i+1] <= pTarget) {
                    const f = (perfil.p[i] - pTarget) / (perfil.p[i] - perfil.p[i+1] || 1);
                    return perfil.t[i] + f * (perfil.t[i+1] - perfil.t[i]);
                }
            }
            return null;
        }

        const t850 = tAt(850), t700 = tAt(700), t500 = tAt(500);
        let gruix1000_500 = null;
        if (perfil && perfil.z && perfil.p) {
            let z1000 = null, z500 = null;
            for (let i = 0; i < perfil.p.length; i++) {
                if (z1000 === null && perfil.p[i] <= 1000) z1000 = perfil.z[i];
                if (z500 === null && perfil.p[i] <= 500) z500 = perfil.z[i];
            }
            if (z1000 !== null && z500 !== null) gruix1000_500 = z500 - z1000;
        }

        const tSfc = idx.tSfc !== undefined ? idx.tSfc : (perfil ? perfil.t[0] : null);
        const tdSfc = perfil ? perfil.td[0] : null;
        const hrSfc = humitatRelativa(tSfc, tdSfc);

        return {
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
            shear01: arrodonir(vent ? vent.shear01 * fVent : null, 1),
            shear03: arrodonir(vent ? vent.shear03 * fVent : null, 1),
            shear06: arrodonir(vent ? vent.shear06 * fVent : null, 1),
            shear08: arrodonir(vent ? vent.shear08 * fVent : null, 1),
            srh01: arrodonir(vent ? vent.srh01 : null, 0),
            srh03: arrodonir(vent ? vent.srh03 : null, 0),
            stormMotionRM: vent && vent.bunkers && vent.bunkers.right ? {
                u: arrodonir(vent.bunkers.right.u * fVent, 1),
                v: arrodonir(vent.bunkers.right.v * fVent, 1),
                spd: arrodonir(Math.sqrt(vent.bunkers.right.u**2 + vent.bunkers.right.v**2) * fVent, 0),
                dir: arrodonir((() => { let d = Math.atan2(-vent.bunkers.right.u, -vent.bunkers.right.v) * 180/Math.PI; return d < 0 ? d + 360 : d; })(), 0)
            } : null,
            stormMotionLM: vent && vent.bunkers && vent.bunkers.left ? {
                u: arrodonir(vent.bunkers.left.u * fVent, 1),
                v: arrodonir(vent.bunkers.left.v * fVent, 1),
                spd: arrodonir(Math.sqrt(vent.bunkers.left.u**2 + vent.bunkers.left.v**2) * fVent, 0),
                dir: arrodonir((() => { let d = Math.atan2(-vent.bunkers.left.u, -vent.bunkers.left.v) * 180/Math.PI; return d < 0 ? d + 360 : d; })(), 0)
            } : null,
            tSfc: arrodonir(tSfc, 1),
            tdSfc: arrodonir(tdSfc, 1),
            hrSfc: arrodonir(hrSfc, 0),
            t850: arrodonir(t850, 1),
            t700: arrodonir(t700, 1),
            t500: arrodonir(t500, 1),
            gruix1000_500: arrodonir(gruix1000_500, 0),
            perfilVertical: perfilVertical,
            verificat: verificacio ? verificacio.verificat : {
                supercelula: null, multicelula: null, calamarsaGrossa: null,
                tornado: null, ventsForts: null, neu: null, calorExtrema: null
            },
            notes: verificacio ? verificacio.notes : ""
        };
    }

    // ─── DESAR SOBREESCRIVINT (LLEGINT EL FITXER ABANS) ──────────────
    async function desarAlFitxer(casNou) {
        if (!window.showSaveFilePicker) {
            mostrarAvis('⚠️ Aquest navegador no permet sobreescriure el fitxer.');
            return;
        }

        try {
            if (!fileHandle) {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: 'historial_sondejos.json',
                    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
                });
            }

            let historialActual = [];
            try {
                const file = await fileHandle.getFile();
                const text = await file.text();
                if (text.trim()) {
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) historialActual = parsed;
                    else if (parsed && Array.isArray(parsed.casos)) historialActual = parsed.casos;
                }
            } catch (e) {
                console.warn("[SARS] Fitxer buit o no llegible. Comencem de zero.", e);
            }

            const existeix = historialActual.some(c => c.id === casNou.id);
            if (existeix) {
                mostrarAvis("⚠️ Aquest cas ja existeix al fitxer. S'ha actualitzat.");
                historialActual = historialActual.filter(c => c.id !== casNou.id);
            }

            historialActual.push(casNou);

            const textFinal = JSON.stringify(historialActual, null, 2);
            const writable = await fileHandle.createWritable();
            await writable.write(textFinal);
            await writable.close();

            window._sarsHistorial = historialActual;

            mostrarAvis("✅ " + historialActual.length + " CASOS AL FITXER\n(Actualitzat sense esborrar res)");
        } catch (e) {
            if (e.name === 'AbortError') {
                mostrarAvis("CANCEL·LAT");
            } else {
                fileHandle = null;
                mostrarAvis("❌ Error desant. Torna-ho a provar.");
                console.error("[SARS] Error desant:", e);
            }
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

    // ─── ACCIÓ PRINCIPAL ──────────────────────────────────────────────
    async function copiarJSON() {
        try {
            const internal = window._skewtInternal;
            if (!internal || !internal.indexsActual) {
                alert("No hi ha dades de sondeig calculades.");
                return;
            }

            const verificacio = await demanarVerificacio();
            if (!verificacio) { mostrarAvis("CANCEL·LAT"); return; }

            const casNou = generarObjecteCas(verificacio);
            if (!casNou) { alert("Error generant el JSON."); return; }

            await desarAlFitxer(casNou);

        } catch (e) {
            console.error("[SARS] Error:", e);
            alert("ERROR SARS:\n" + e.message);
        }
    }

    // ─── BOTÓ ─────────────────────────────────────────────────────────
    function afegirBoto() {
        const header = document.querySelector('.skewt-modal-header');
        if (!header) return false;
        if (document.getElementById('skewtBtnCopiarJSON')) return true;

        const btn = document.createElement('button');
        btn.className = 'skewt-btn';
        btn.id = 'skewtBtnCopiarJSON';
        btn.title = 'Desar el cas a historial_sondejos.json (sobreescriu afegint)';
        btn.innerHTML = '<i class="fas fa-copy"></i> <span>Copiar dades</span>';

        const btnClose = document.getElementById('skewtBtnClose');
        if (btnClose) header.insertBefore(btn, btnClose);
        else header.appendChild(btn);

        btn.addEventListener('click', copiarJSON);
        return true;
    }

    function esperarIAfegir() {
        if (afegirBoto()) return;
        setTimeout(esperarIAfegir, 300);
    }
    esperarIAfegir();

})();