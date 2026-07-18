// ═══════════════════════════════════════════════════════════════════════
//  statuscheck.js — Basat en "generat" (quan es va executar el model)
// ═══════════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    const STATUS_URL = './web_data/status.json';
    let intervalId = null;

    function crearBadgeEstat() {
        if (document.getElementById('statusBadge')) return;

        const topnavRight = document.querySelector('.topnav-right');
        if (!topnavRight) return;

        const badge = document.createElement('div');
        badge.id = 'statusBadge';
        badge.className = 'status-badge';
        badge.innerHTML = `
            <span class="status-dot"></span>
            <span class="status-text">Comprovant...</span>
        `;

        const xatBtn = document.getElementById('btnXat');
        if (xatBtn) {
            topnavRight.insertBefore(badge, xatBtn);
        } else {
            topnavRight.appendChild(badge);
        }
    }

    function tempsRelatiu(dataIso) {
        if (!dataIso) return 'desconegut';
        const ara = new Date();
        const data = new Date(dataIso + (dataIso.endsWith('Z') ? '' : 'Z'));
        const diffMin = Math.floor((ara - data) / 60000);

        if (diffMin < 0) return 'ara mateix';
        if (diffMin === 0) return 'fa un moment';
        if (diffMin === 1) return 'fa 1 minut';
        if (diffMin < 60) return 'fa ' + diffMin + ' minuts';
        const diffHores = Math.floor(diffMin / 60);
        if (diffHores === 1) return 'fa 1 hora';
        if (diffHores < 24) return 'fa ' + diffHores + ' hores';
        return 'fa ' + Math.floor(diffHores / 24) + ' dies';
    }

    function formatarDiaHora(dataIso) {
        if (!dataIso) return '';
        const data = new Date(dataIso + (dataIso.endsWith('Z') ? '' : 'Z'));
        const d = String(data.getDate()).padStart(2, '0');
        const m = String(data.getMonth() + 1).padStart(2, '0');
        const h = String(data.getHours()).padStart(2, '0');
        const min = String(data.getMinutes()).padStart(2, '0');
        return d + '/' + m + ' ' + h + ':' + min;
    }

    function actualitzarBadge(data) {
        const badge = document.getElementById('statusBadge');
        const fhValidTime = document.getElementById('fh_validtime');

        if (!badge) return;

        const dot = badge.querySelector('.status-dot');
        const text = badge.querySelector('.status-text');

        if (!data || !data.generat) {
            dot.className = 'status-dot status-error';
            text.textContent = 'Sense dades';
            badge.title = '';
            if (fhValidTime) fhValidTime.style.color = '';
            return;
        }

        const generat = data.generat; // "2026-07-17T11:50:52Z"
        const runStr = data.run_meteofetch || '';
        const horaRun = runStr ? runStr.split('T')[1] + 'Z' : '?Z';
        const faQuant = tempsRelatiu(generat);
        const diaHora = formatarDiaHora(generat);

        const ara = new Date();
        const dataGen = new Date(generat + (generat.endsWith('Z') ? '' : 'Z'));
        const diffHores = (ara - dataGen) / 3600000;

        if (diffHores < 3) {
            // ✅ Tot OK — verd
            dot.className = 'status-dot status-ok';
            text.innerHTML = 'Run ' + horaRun + ' · Llançat ' + faQuant;
            badge.title = 'Generat: ' + diaHora;

            if (fhValidTime) {
                fhValidTime.style.color = '';
                fhValidTime.title = '';
            }
        } else {
            // ⚠️ Més de 3 hores — vermell
            dot.className = 'status-dot status-old';
            text.innerHTML = 'Run ' + horaRun + ' · Llançat ' + faQuant +
                ' <i class="wi wi-na" style="font-size:13px;color:#ffaa2b;margin-left:4px;" title="Actualització pendent"></i>';
            badge.title = 'Generat: ' + diaHora + ' — El següent run estarà disponible aviat.';

            if (fhValidTime) {
                fhValidTime.style.color = '#ff5e5e';
                fhValidTime.title = 'Run ' + horaRun + ' · Llançat ' + faQuant;
            }
        }
    }

    async function comprovarEstat() {
        try {
            const response = await fetch(STATUS_URL, {
                cache: 'no-cache',
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (!response.ok) throw new Error('HTTP ' + response.status);

            const data = await response.json();
            actualitzarBadge(data);
            console.log('[Status] Run ' + (data.run_meteofetch || '?') + 'Z · Generat ' + data.generat);

        } catch (err) {
            console.warn('[Status] Error:', err.message);
            const badge = document.getElementById('statusBadge');
            if (badge) {
                badge.querySelector('.status-dot').className = 'status-dot status-error';
                badge.querySelector('.status-text').textContent = 'Error';
            }
        }
    }

    function inicialitzar() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', iniciar);
        } else {
            iniciar();
        }
    }

    function iniciar() {
        crearBadgeEstat();
        comprovarEstat();
        intervalId = setInterval(comprovarEstat, 5 * 60 * 1000);
    }

    window.addEventListener('beforeunload', () => {
        if (intervalId) clearInterval(intervalId);
    });

    inicialitzar();
})();