// ═══════════════════════════════════════════════════════════════════
//  actualitzacio.js — Detector de noves actualitzacions + recàrrega neta
//  S'encarrega de:
//   - Consultar el manifest.json saltant la caché
//   - Comparar la "signatura" (run + nombre d'hores + data fitxer)
//   - Mostrar un botó al menú "Sistema" per comprovar-ho manualment
//   - Forçar recàrrega neta (sense caché) quan l'usuari ho demana
//   - Quan tot és al dia: salutació segons l'hora local (2 s)
//  Icones: SVG pròpies (estil Meteocons) — cap emoji del sistema
// ═══════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const CLAU_VERSIO = 'tempestescat_versio_manifest';
    const CLAU_ULTIMA_COMPROVACIO = 'tempestescat_ultima_comprovacio';

    // Durada del missatge "al dia" (ms)
    const DURADA_SALUTACIO = 2000;
    // true: també es mostra un cop en carregar la pàgina (primera comprovació automàtica)
    // false: només quan l'usuari prem "Comprovar actualitzacions"
    const SALUDAR_AL_CARREGAR = true;

    const CARPETES_MANIFEST = [
        (window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)) + 'web_data_NE/imatges/manifest.json',
        './web_data_NE/imatges/manifest.json',
        '/web_data_NE/imatges/manifest.json',
        '/public/web_data_NE/imatges/manifest.json',
    ];

    let _estat = 'inicial'; // inicial | comprovant | ok | nova | error
    let _jaSalutat = false; // la salutació automàtica només surt un cop per càrrega

    // ═══════════════════════════════════════════════════════════════
    //  ICONES SVG PRÒPIES (estil Meteocons simplificat)
    //  Cada funció retorna un <svg> inline amb mida 1em (hereta el color)
    // ═══════════════════════════════════════════════════════════════
    const ICONES = {
        // Sol (bon dia)
        sol: (mida = 16) => `
            <svg class="ico-meteo ico-sol" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/>
                <line x1="12" y1="2"  x2="12" y2="4.5"/>
                <line x1="12" y1="19.5" x2="12" y2="22"/>
                <line x1="2"  y1="12" x2="4.5" y2="12"/>
                <line x1="19.5" y1="12" x2="22" y2="12"/>
                <line x1="4.9" y1="4.9" x2="6.7" y2="6.7"/>
                <line x1="17.3" y1="17.3" x2="19.1" y2="19.1"/>
                <line x1="4.9" y1="19.1" x2="6.7" y2="17.3"/>
                <line x1="17.3" y1="6.7" x2="19.1" y2="4.9"/>
            </svg>`,

        // Sol amb núvol (bona tarda)
        solNuv: (mida = 16) => `
            <svg class="ico-meteo ico-sol-nuv" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="2.8" fill="currentColor" stroke="none"/>
                <line x1="8.5" y1="1.8" x2="8.5" y2="3.4"/>
                <line x1="1.8" y1="8.5" x2="3.4" y2="8.5"/>
                <line x1="3.8" y1="3.8" x2="4.9" y2="4.9"/>
                <line x1="12.1" y1="4.9" x2="13.2" y2="3.8"/>
                <path d="M9.5 17.5h7.2a2.8 2.8 0 0 0 0-5.6 3.8 3.8 0 0 0-7.3-1.1 3 3 0 0 0 .1 6.7z"
                      fill="currentColor" fill-opacity="0.18"/>
            </svg>`,

        // Lluna amb estrelles (bona nit / matinada)
        lluna: (mida = 16) => `
            <svg class="ico-meteo ico-lluna" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"
                      fill="currentColor" fill-opacity="0.22"/>
                <circle cx="17.5" cy="6" r="1" fill="currentColor" stroke="none"/>
                <circle cx="20.5" cy="9" r="0.8" fill="currentColor" stroke="none"/>
            </svg>`,

        // Núvol (estat neutre)
        nuvol: (mida = 16) => `
            <svg class="ico-meteo ico-nuvol" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 18h10a3.5 3.5 0 0 0 0-7 4.5 4.5 0 0 0-8.6-1.4A3.6 3.6 0 0 0 7 18z"
                      fill="currentColor" fill-opacity="0.18"/>
            </svg>`,

        // Pluja (bona nit / recàrrega)
        pluja: (mida = 16) => `
            <svg class="ico-meteo ico-pluja" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 15h10a3.5 3.5 0 0 0 0-7 4.5 4.5 0 0 0-8.6-1.4A3.6 3.6 0 0 0 7 15z"
                      fill="currentColor" fill-opacity="0.18"/>
                <line x1="8"  y1="18" x2="7"  y2="21"/>
                <line x1="12" y1="18" x2="11" y2="21"/>
                <line x1="16" y1="18" x2="15" y2="21"/>
            </svg>`,

        // Tempesta (error)
        tempesta: (mida = 16) => `
            <svg class="ico-meteo ico-tempesta" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 14h10a3.5 3.5 0 0 0 0-7 4.5 4.5 0 0 0-8.6-1.4A3.6 3.6 0 0 0 7 14z"
                      fill="currentColor" fill-opacity="0.18"/>
                <polyline points="13,14 10.5,18 13.5,18 11,22" fill="currentColor" stroke="none"/>
            </svg>`,

        // Vent / remolí (error de servidor)
        vent: (mida = 16) => `
            <svg class="ico-meteo ico-vent" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 8h11a3 3 0 1 0-3-3"/>
                <path d="M3 12h15a3 3 0 1 1-3 3"/>
                <path d="M3 16h7"/>
            </svg>`,

        // Arc de Sant Martí (tot al dia)
        arc: (mida = 16) => `
            <svg class="ico-meteo ico-arc" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 19a9 9 0 0 1 18 0"/>
                <path d="M6 19a6 6 0 0 1 12 0"/>
                <path d="M9 19a3 3 0 0 1 6 0"/>
            </svg>`,

        // Check (confirmació)
        check: (mida = 16) => `
            <svg class="ico-meteo ico-check" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.4"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="4.5,12.5 9.5,17.5 19.5,6.5"/>
            </svg>`,

        // Recàrrega (fletxa circular)
        recarrega: (mida = 16) => `
            <svg class="ico-meteo ico-recarga" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 11a8 8 0 1 0-2.3 5.7"/>
                <polyline points="20,4 20,11 13,11"/>
            </svg>`,

        // Globo / servidor (consultant)
        globus: (mida = 16) => `
            <svg class="ico-meteo ico-globus" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/>
                <ellipse cx="12" cy="12" rx="4" ry="9"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
            </svg>`,

        // Campana (nova versió)
        campana: (mida = 16) => `
            <svg class="ico-meteo ico-campana" width="${mida}" height="${mida}" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6z"
                      fill="currentColor" fill-opacity="0.18"/>
                <path d="M10.5 20a1.7 1.7 0 0 0 3 0"/>
            </svg>`,
    };

    // Helper: retorna la icona amb mida en "em" per integrar-se al text
    function _ico(nom, midaPx) {
        return ICONES[nom] ? ICONES[nom](midaPx || 16) : '';
    }

    // ─── Utilitats ──────────────────────────────────────────────────
    // Salutació segons l'hora local del dispositiu
    function _salutacio() {
        const h = new Date().getHours();
        if (h < 6)  return { text: 'Bona matinada',  ico: 'lluna'  };
        if (h < 14) return { text: 'Bon dia',         ico: 'sol'    };
        if (h < 21) return { text: 'Bona tarda',      ico: 'solNuv' };
        return       { text: 'Bona nit',             ico: 'pluja'  };
    }

    function _missatgeAlDia() {
        const s = _salutacio();
        return `${_ico(s.ico, 18)} ${s.text}! Les dades s'han actualitzat perfectament! Estàs al dia ${_ico('arc', 18)}`;
    }

    function _saludar(silencios) {
        // Manual: sempre. Automàtic: només el primer cop (i si està activat)
        if (silencios && (!SALUDAR_AL_CARREGAR || _jaSalutat)) return;
        _jaSalutat = true;
        _mostrarToast(_missatgeAlDia(), 'ok', DURADA_SALUTACIO);
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
                if (!silencios) _mostrarToast(`${_ico('vent', 18)} No s'ha pogut consultar el servidor`, 'error');
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
                _saludar(silencios);
                return;
            }

            if (signaturaNova !== signaturaAntiga) {
                // Nova versió
                _estat = 'nova';
                _pintarBoto();
                _mostrarBannerNovaVersio();
            } else {
                // Tot correcte
                _estat = 'ok';
                localStorage.setItem(CLAU_ULTIMA_COMPROVACIO, Date.now().toString());
                _pintarBoto();
                _saludar(silencios);
            }
        } catch (e) {
            _estat = 'error';
            _pintarBoto('Error consultant');
            if (!silencios) _mostrarToast(`${_ico('tempesta', 18)} Error consultant el servidor`, 'error');
        }
    }

    // ─── Recàrrega neta (buidant caché del navegador) ───────────────
    async function recarregarNet() {
        _mostrarToast(`${_ico('recarrega', 18)} Recarregant dades... ${_ico('nuvol', 18)}`, 'ok');

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
                estatEl.innerHTML = '';
                estatEl.className = 'sistema-estat';
                break;
            case 'comprovant':
                boto.disabled = true;
                boto.classList.add('carregant');
                boto.querySelector('.txt').textContent = 'Comprovant...';
                estatEl.innerHTML = `${_ico('globus', 16)} Consultant el servidor...`;
                estatEl.className = 'sistema-estat comprovant';
                break;
            case 'ok':
                boto.disabled = false;
                boto.classList.remove('carregant');
                boto.querySelector('.txt').textContent = 'Comprovar actualitzacions';
                estatEl.innerHTML = missatgeCustom
                    || `${_ico('check', 16)} Darrera comprovació: ${ara}`;
                estatEl.className = 'sistema-estat ok';
                break;
            case 'nova':
                boto.disabled = false;
                boto.classList.remove('carregant');
                boto.querySelector('.txt').textContent = 'Actualitzar ara';
                boto.classList.add('nova');
                estatEl.innerHTML = `${_ico('solNuv', 16)} Noves dades disponibles!`;
                estatEl.className = 'sistema-estat nova';
                break;
            case 'error':
                boto.disabled = false;
                boto.classList.remove('carregant');
                boto.querySelector('.txt').textContent = 'Tornar a provar';
                estatEl.innerHTML = missatgeCustom
                    || `${_ico('tempesta', 16)} Error consultant`;
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
            <div class="bnv-ico">${_ico('campana', 22)}</div>
            <div class="bnv-text">
                <strong>Noves dades disponibles!</strong>
                <span>Hi ha dades noves al visor ${_ico('solNuv', 14)}</span>
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

    // ─── Toast simple (durada en ms, per defecte 3200) ──────────────
    function _mostrarToast(html, tipus, durada) {
        const t = document.createElement('div');
        t.className = 'toast-sistema ' + (tipus || '');
        t.innerHTML = html;
        // Perquè els missatges llargs no es surtin de pantalla (sobretot al mòbil)
        t.style.whiteSpace = 'normal';
        t.style.textAlign = 'center';
        t.style.maxWidth = 'min(420px, calc(100vw - 32px))';
        // Alineació vertical de les icones SVG amb el text
        t.style.display = 'inline-flex';
        t.style.alignItems = 'center';
        t.style.justifyContent = 'center';
        t.style.gap = '0.4em';
        t.style.flexWrap = 'wrap';
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('visible'));
        setTimeout(() => {
            t.classList.remove('visible');
            setTimeout(() => t.remove(), 250);
        }, durada || 3200);
    }

    // ─── API pública ────────────────────────────────────────────────
    window.actualitzacioSistema = {
        comprovar: () => comprovarActualitzacio(false),
        comprovarSilencios: () => comprovarActualitzacio(true),
        recarregar: recarregarNet,
        estat: () => _estat,
        icones: ICONES, // per si vols reutilitzar-les en altres llocs
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

    console.log('actualitzacio.js carregat');
})();