// ═══════════════════════════════════════════════════════════════════
//  SARS HISTORIAL — Anàlegs contra casos REALS verificats
//  Altura JUSTA i DINÀMICA, sense espai lliure sobrant
// ═══════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    const URL_HISTORIAL = 'dades_sondeig/historial_sondejos.json';

    let historial = null;
    let carregantHistorial = false;
    let errorCarregar = null;

    function carregarHistorial() {
        if (historial !== null || carregantHistorial) return;
        carregantHistorial = true;
        errorCarregar = null;
        
        fetch(URL_HISTORIAL + '?_=' + Date.now())
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' - ' + r.statusText);
                return r.json();
            })
            .then(json => {
                historial = (json && Array.isArray(json.casos)) ? json.casos : [];
                console.log('[SARS] ✅ Carregats', historial.length, 'casos');
            })
            .catch(e => {
                errorCarregar = e.message;
                historial = [];
            })
            .finally(() => { carregantHistorial = false; });
    }

    function casAPerfilRef(cas) {
        function rang(v, marge) {
            if (v === null || v === undefined || isNaN(v)) return { min: -1e9, max: 1e9 };
            return { min: v - marge, max: v + marge };
        }
        return {
            nom: (cas.lloc || 'CAS') + ' · ' + (cas.data || '??'),
            cas: cas,
            tSfc: rang(cas.tOrigenParcela, 4),
            cape: rang(cas.cape, 300),
            cin: rang(cas.cin, 60),
            li: rang(cas.li, 2),
            lcl: rang(cas.lcl_z, 400),
            lfc: rang(cas.lfc_z, 600),
            el: rang(cas.el_z, 1200),
            shear06: rang(cas.shear06, 5),
            srh01: rang(cas.srh01, 60),
            srh03: rang(cas.srh03, 100)
        };
    }

    function trobarAnàlegsHistorial(indexsActual, ventActual) {
        const E = window.SkewtEngine;
        if (!E || !historial || !historial.length) return [];

        return historial
            .map(cas => {
                try {
                    const ref = casAPerfilRef(cas);
                    const similitud = E.calcularSimilitudSARS(indexsActual, ventActual, ref);
                    return { cas, similitud };
                } catch (e) {
                    return { cas, similitud: 0 };
                }
            })
            .filter(r => r.similitud > 0)
            .sort((a, b) => b.similitud - a.similitud);
    }

    function extreureHailINotes(notes) {
        if (!notes) return null;
        const match = notes.match(/Hail:\s*([\d.]+)\s*cm/i);
        return match ? parseFloat(match[1]) : null;
    }

    function extreureWindINotes(notes) {
        if (!notes) return null;
        const match = notes.match(/Wind:\s*([\d.]+)\s*km\/h/i);
        return match ? parseFloat(match[1]) : null;
    }

    function obtenirHail(cas) {
        if (cas.verificat && cas.verificat.calamarsaGrossa === true) {
            const hail = extreureHailINotes(cas.notes);
            if (hail) return hail;
            return 2;
        }
        if (cas.verificat && cas.verificat.calamarsaGrossa === false) {
            return 0;
        }
        const hail = extreureHailINotes(cas.notes);
        if (hail) return hail;
        return null;
    }

    function obtenirWind(cas) {
        if (cas.verificat && cas.verificat.ventsForts === true) {
            const wind = extreureWindINotes(cas.notes);
            if (wind) return wind;
            return 90;
        }
        if (cas.verificat && cas.verificat.ventsForts === false) {
            const wind = extreureWindINotes(cas.notes);
            if (wind) return wind;
            return 0;
        }
        const wind = extreureWindINotes(cas.notes);
        if (wind) return wind;
        return null;
    }

    function getColorHail(hailCm) {
        if (hailCm === null || hailCm === undefined || hailCm === 0) return '#556677';
        if (hailCm < 2) return '#44ddaa';
        if (hailCm < 5) return '#ffdd44';
        if (hailCm < 8) return '#ff8833';
        return '#ff3344';
    }

    function getColorPrincipal(cas) {
        const hail = obtenirHail(cas);
        if (hail && hail > 0) {
            return getColorHail(hail);
        }
        if (cas.verificat && cas.verificat.supercelula === true) {
            return '#ff3344';
        }
        if (cas.verificat && cas.verificat.multicelula === true) {
            return '#ff8833';
        }
        if (cas.verificat && cas.verificat.tornado === true) {
            return '#cc44ff';
        }
        return '#556677';
    }

    function obtenirFileresAmbColors(cas) {
        const verificat = cas.verificat;
        if (!verificat) return [{ text: '--', color: '#556677' }];
        
        const fileres = [];
        
        if (verificat.supercelula === true) {
            fileres.push({ text: 'SUPERCELL', color: '#ff3344' });
        }
        if (verificat.multicelula === true) {
            fileres.push({ text: 'MULTICELL', color: '#ff8833' });
        }
        if (verificat.tornado === true) {
            fileres.push({ text: 'TORNADO', color: '#cc44ff' });
        }
        
        const hail = obtenirHail(cas);
        if (hail !== null && hail > 0) {
            const colorNum = getColorHail(hail);
            fileres.push({ 
                text: 'HAIL ' + hail + ' cm',
                color: colorNum,
                esNumero: true,
                prefix: 'HAIL ',
                numero: hail,
                suffix: ' cm'
            });
        }
        
        const wind = obtenirWind(cas);
        if (wind !== null && wind > 0) {
            fileres.push({ 
                text: 'WIND ' + wind + ' km/h',
                color: '#44ccff',
                esNumero: true,
                prefix: 'WIND ',
                numero: wind,
                suffix: ' km/h'
            });
        }
        
        if (fileres.length === 0) {
            fileres.push({ text: 'NO SEVERE', color: '#556677' });
        }
        return fileres;
    }

    function assegurarCapa() {
        const wrap = document.getElementById('skewtCanvasWrap');
        if (!wrap) return null;
        let capa = document.getElementById('skewtSarsHistCanvas');
        if (!capa) {
            capa = document.createElement('canvas');
            capa.id = 'skewtSarsHistCanvas';
            capa.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:6;';
            wrap.appendChild(capa);
        }
        return capa;
    }

    function dibuixar() {
        const overlay = document.getElementById('skewtModalOverlay');
        if (!overlay || !overlay.classList.contains('active')) return;

        carregarHistorial();

        const wrap = document.getElementById('skewtCanvasWrap');
        const internal = window._skewtInternal;
        const E = window.SkewtEngine;
        if (!wrap || !internal || !E) return;

        const idx = internal.indexsActual;
        const vent = internal.ventActual;
        if (!idx) return;

        const wTotal = wrap.clientWidth, hTotal = wrap.clientHeight;
        if (wTotal < 50 || hTotal < 50) return;

        const capa = assegurarCapa();
        if (!capa) return;

        const dpr = window.devicePixelRatio || 1;
        capa.width = wTotal * dpr;
        capa.height = hTotal * dpr;
        capa.style.width = wTotal + 'px';
        capa.style.height = hTotal + 'px';

        const ctx = capa.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, wTotal, hTotal);

        const hodoAmpleIdeal = Math.min(340, Math.max(230, hTotal * 0.42));
        const hodoAmple = Math.min(hodoAmpleIdeal, wTotal * 0.42);
        const skewtAmple = wTotal - hodoAmple;

        const panellX = skewtAmple + 4;
        const panellW = hodoAmple - 8;

        // ── Calcular altura JUSTA sense espai lliure ──────────────
        let numCasos = 0;
        let maxFileres = 0;
        let resultats = [];
        let top3 = [];

        if (!errorCarregar && historial && historial.length > 0) {
            resultats = trobarAnàlegsHistorial(idx, vent);
            if (resultats.length > 0) {
                top3 = resultats.slice(0, 3);
                numCasos = top3.length;
                top3.forEach(r => {
                    const fileres = obtenirFileresAmbColors(r.cas);
                    if (fileres.length > maxFileres) maxFileres = fileres.length;
                });
            }
        }

        // Altura JUSTA: capçalera (22) + cada cas (14 + fileres * 10 + 2)
        const alturaPerCaso = 14 + maxFileres * 10 + 2;
        const panellAlt = Math.max(44, 22 + (numCasos > 0 ? numCasos * alturaPerCaso : 44));
        const panellY = hTotal - panellAlt - 4; // només 4px de marge inferior

        ctx.save();

        // Fons
        const grad = ctx.createLinearGradient(panellX, panellY, panellX, panellY + panellAlt);
        grad.addColorStop(0, 'rgba(0, 8, 16, 0.94)');
        grad.addColorStop(1, 'rgba(0, 12, 20, 0.94)');
        ctx.fillStyle = grad;
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(panellX, panellY, panellW, panellAlt, 4);
        ctx.fill();
        ctx.stroke();

        // Capçalera
        ctx.fillStyle = '#22aa88';
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('▶ SARS · ANALOG CASES', panellX + 10, panellY + 6);

        // Separador
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panellX + 8, panellY + 20);
        ctx.lineTo(panellX + panellW - 8, panellY + 20);
        ctx.stroke();

        if (errorCarregar) {
            ctx.fillStyle = '#ff4455';
            ctx.font = '9px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('! ' + errorCarregar, panellX + panellW/2, panellY + 44);
            ctx.fillStyle = '#445566';
            ctx.font = '8px "Courier New", monospace';
            ctx.fillText(URL_HISTORIAL, panellX + panellW/2, panellY + 60);
            ctx.restore();
            return;
        }

        if (!historial || historial.length === 0) {
            ctx.fillStyle = '#22aa88';
            ctx.font = '9px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(' NO CASES IN HISTORIAL', panellX + panellW/2, panellY + 44);
            ctx.fillStyle = '#445566';
            ctx.font = '8px "Courier New", monospace';
            ctx.fillText('ADD CASES USING COPY JSON BUTTON', panellX + panellW/2, panellY + 62);
            ctx.restore();
            return;
        }

        if (!resultats || !resultats.length) {
            ctx.fillStyle = '#22aa88';
            ctx.font = '9px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⏳ NO MATCHING CASES', panellX + panellW/2, panellY + 44);
            ctx.fillStyle = '#445566';
            ctx.font = '8px "Courier New", monospace';
            ctx.fillText('(' + historial.length + ' CASES AVAILABLE)', panellX + panellW/2, panellY + 62);
            ctx.restore();
            return;
        }

        // ── Dibuixar casos amb espai JUST ─────────────────────────
        let yOffset = 24;
        const espaiEntreCasos = 0; // zero per aprofitar al màxim

        top3.forEach((r, i) => {
            const cas = r.cas;
            const fileres = obtenirFileresAmbColors(cas);
            const alturaCaso = 14 + fileres.length * 10;
            const yBase = panellY + yOffset;
            
            const color = getColorPrincipal(cas);

            // Indicador
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(panellX + 10, yBase + 4, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Data i lloc
            ctx.fillStyle = '#c8d8e8';
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const dataLloc = (cas.data || '??') + '  ' + (cas.lloc || '');
            ctx.fillText(dataLloc, panellX + 20, yBase);

            // Percentatge
            ctx.fillStyle = color;
            ctx.font = 'bold 10px "Courier New", monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(r.similitud + '%', panellX + panellW - 10, yBase);

            // Fileres
            let y = yBase + 14;
            
            fileres.forEach((fila) => {
                if (fila.esNumero) {
                    ctx.fillStyle = '#8899aa';
                    ctx.font = '8px "Courier New", monospace';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText('  ' + fila.prefix, panellX + 16, y);
                    
                    const xNum = panellX + 16 + ctx.measureText('  ' + fila.prefix).width;
                    ctx.fillStyle = fila.color;
                    ctx.font = 'bold 8px "Courier New", monospace';
                    ctx.fillText(String(fila.numero), xNum, y);
                    
                    const xSuffix = xNum + ctx.measureText(String(fila.numero)).width;
                    ctx.fillStyle = '#8899aa';
                    ctx.font = '8px "Courier New", monospace';
                    ctx.fillText(fila.suffix, xSuffix, y);
                } else {
                    ctx.fillStyle = fila.color;
                    ctx.font = '8px "Courier New", monospace';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText('  ' + fila.text, panellX + 16, y);
                }
                y += 10;
            });

            yOffset += alturaCaso + espaiEntreCasos;
        });

        ctx.restore();
    }

    function bucle() {
        dibuixar();
        requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);

})();