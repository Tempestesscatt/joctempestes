// ═══════════════════════════════════════════════════════════════════
//  actualitzacio.js — Detector de noves actualitzacions + recàrrega neta
//  S'encarrega de:
//   - Consultar el manifest.json saltant la caché
//   - Comparar la "signatura" (run + nombre d'hores + data fitxer)
//   - Mostrar un botó al menú "Sistema" per comprovar-ho manualment
//   - Forçar recàrrega neta (sense caché) quan l'usuari ho demana
// ═══════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const CLAU_VERSIO = 'tempestescat_versio_manifest';
    const CLAU_ULTIMA_COMPROVACIO = 'tempestescat_ultima_comprovacio';

    const CARPETES_MANIFEST = [
        (window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)) + 'web_data_NE/imatges/manifest.json',
        './web_data_NE/imatges/manifest.json',
        '/web_data_NE/imatges/manifest.json',
        '/public/web_data_NE/imatges/manifest.json',
    ];

    let _estat = 'inicial'; // inicial | comprovant | ok | nova | error

    // ─── Utilitats ──────────────────────────────────────────────────
    function _dataActual() {
        return new Date().toLocaleString('ca-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    // Signatura: nombre d'hores + hores_3d + runs detectats al manifest
    function _signatura(manifest) {
        if (!manifest) return '';
        const hores = Array.isArray(manifest.hores) ? manifest.hores.length : 0;
        const hores3d = Array.isArray(manifest.hores_3d) ? manifest.hores_3d.length : 0;
        // Agafem el run_z si existeix
        const runZ = manifest.run_z || manifest.run || '';
        // Afegim les claus de les hores del dia "avui" i "dema" per detectar canvis
        const clauDies = (manifest.hores || [])
            .map(h => `${h.hora}_${h.dia}`)
            .join('|');
        return `${runZ}::${hores}::${hores3d}::${clauDies}`;
    }

    // ─── Consulta del manifest (sense caché) ────────────────────────
    async function _llegirManifestFresc() {
        for (const url of CARPETES_MANIFEST) {
            try {
                const r = await fetch(url + '?_cb=' + Date.now(), { cache: 'no-store' });
                if (!r.ok) continue;
                const ct = r.headers.get('content-type') || '';
                if (ct.includes('text/html')) continue;
                return await r.json();
            } catch (e) {}
        }
        return null;
    }

    // ─── Comprovació principal ──────────────────────────────────────
    async function comprovarActualitzacio(silencios) {
        if (_estat === 'comprovant') return;
        _estat = 'comprovant';
        _pintarBoto();

        try {
            const manifest = await _llegirManifestFresc();
            if (!manifest) {
                _estat = 'error';
                _pintarBoto('No s\'ha pogut consultar el servidor');
                if (!silencios) _mostrarToast('⚠️ No s\'ha pogut consultar el servidor', 'error');
                return;
            }

            const signaturaNova = _signatura(manifest);
            const signaturaAntiga = localStorage.getItem(CLAU_VERSIO) || '';

            if (!signaturaAntiga) {
                // Primera vegada: guardem i considerem OK
                localStorage.setItem(CLAU_VERSIO, signaturaNova);
                localStorage.setItem(CLAU_ULTIMA_COMPROVACIO, Date.now().toString());
                _estat = 'ok';
                _pintarBoto();
                if (!silencios) _mostrarToast('✅ Visor actualitzat', 'ok');
                return;
            }

            if (signaturaNova !== signaturaAntiga) {
                // 🔔 HI HA NOVA VERSIÓ
                _estat = 'nova';
                _pintarBoto();
                _mostrarBannerNovaVersio();
            } else {
                // Tot correcte
                _estat = 'ok';
                localStorage.setItem(CLAU_ULTIMA_COMPROVACIO, Date.now().toString());
                _pintarBoto();
                if (!silencios) _mostrarToast('✅ Ja tens la darrera versió', 'ok');
            }
        } catch (e) {
            _estat = 'error';
            _pintarBoto('Error consultant');
            if (!silencios) _mostrarToast('❌ Error consultant el servidor', 'error');
        }
    }

    // ─── Recàrrega neta (buidant caché del navegador) ───────────────
    async function recarregarNet() {
        _mostrarToast('🔄 Recarregant dades...', 'ok');

        // 1. Buidar Cache API del navegador (si existeix)
        if ('caches' in window) {
            try {
                const noms = await caches.keys();
                await Promise.all(noms.map(n => caches.delete(n)));
            } catch (e) {}
        }

        // 2. Buidar localStorage d'estat de versió
        try {
            localStorage.removeItem(CLAU_VERSIO);
            localStorage.setItem(CLAU_ULTIMA_COMPROVACIO, Date.now().toString());
        } catch (e) {}

        // 3. Forçar recàrrega sense caché (query string + location.reload)
        const url = new URL(window.location.href);
        url.searchParams.set('_refresh', Date.now().toString());
        window.location.replace(url.toString());
    }

    // ─── Pintar el botó (l'HTML el crea el panell) ──────────────────
    function _pintarBoto(missatgeCustom) {
        const boto = document.getElementById('btnComprovarActualitzacio');
        const estatEl = document.getElementById('estatActualitzacio');
        if (!boto || !estatEl) return;

        const ara = new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });

        switch (_estat) {
            case 'inicial':
                boto.disabled = false;
                boto.classList.remove('carregant');
                boto.querySelector('.txt').textContent = 'Comprovar actualitzacions';
                estatEl.textContent = '';
                estatEl.className = 'sistema-estat';
                break;
            case 'comprovant':
                boto.disabled = true;
                boto.classList.add('carregant');
                boto.querySelector('.txt').textContent = 'Comprovant...';
                estatEl.textContent = 'Consultant el servidor...';
                estatEl.className = 'sistema-estat comprovant';
                break;
            case 'ok':
                boto.disabled = false;
                boto.classList.remove('carregant');
                boto.querySelector('.txt').textContent = 'Comprovar actualitzacions';
                estatEl.textContent = missatgeCustom || `Darrera comprovació: ${ara}`;
                estatEl.className = 'sistema-estat ok';
                break;
            case 'nova':
                boto.disabled = false;
                boto.classList.remove('carregant');
                boto.querySelector('.txt').textContent = 'Actualitzar ara';
                boto.classList.add('nova');
                estatEl.textContent = '🔔 Nova versió disponible!';
                estatEl.className = 'sistema-estat nova';
                break;
            case 'error':
                boto.disabled = false;
                boto.classList.remove('carregant');
                boto.querySelector('.txt').textContent = 'Tornar a provar';
                estatEl.textContent = missatgeCustom || 'Error consultant';
                estatEl.className = 'sistema-estat error';
                break;
        }
    }

    // ─── Banner flotant de "nova versió" ────────────────────────────
    function _mostrarBannerNovaVersio() {
        if (document.getElementById('bannerNovaVersio')) return;

        const b = document.createElement('div');
        b.id = 'bannerNovaVersio';
        b.className = 'banner-nova-versio';
        b.innerHTML = `
            <div class="bnv-ico">🔔</div>
            <div class="bnv-text">
                <strong>Nova versió disponible</strong>
                <span>Hi ha dades noves al visor</span>
            </div>
            <button class="bnv-btn" id="bnvRecarregar">Actualitzar ara</button>
            <button class="bnv-tanca" id="bnvTanca" title="Més tard">✕</button>
        `;
        document.body.appendChild(b);

        requestAnimationFrame(() => b.classList.add('visible'));

        document.getElementById('bnvRecarregar').addEventListener('click', () => {
            b.remove();
            recarregarNet();
        });
        document.getElementById('bnvTanca').addEventListener('click', () => {
            b.classList.remove('visible');
            setTimeout(() => b.remove(), 250);
        });
    }

    // ─── Toast simple ───────────────────────────────────────────────
    function _mostrarToast(text, tipus) {
        const t = document.createElement('div');
        t.className = 'toast-sistema ' + (tipus || '');
        t.textContent = text;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('visible'));
        setTimeout(() => {
            t.classList.remove('visible');
            setTimeout(() => t.remove(), 250);
        }, 3200);
    }

    // ─── API pública ────────────────────────────────────────────────
    window.actualitzacioSistema = {
        comprovar: () => comprovarActualitzacio(false),
        comprovarSilencios: () => comprovarActualitzacio(true),
        recarregar: recarregarNet,
        estat: () => _estat,
    };

    // ─── Auto-comprovació silenciosa ────────────────────────────────
    // Primer cop al carregar (passats 3s)
    setTimeout(() => comprovarActualitzacio(true), 3000);

    // Cada 15 minuts (silenciós)
    setInterval(() => comprovarActualitzacio(true), 15 * 60 * 1000);

    // Quan l'usuari torna a la pestanya
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const ultima = parseInt(localStorage.getItem(CLAU_ULTIMA_COMPROVACIO) || '0');
            if (Date.now() - ultima > 5 * 60 * 1000) {
                comprovarActualitzacio(true);
            }
        }
    });

    console.log('✅ actualitzacio.js carregat');
})();