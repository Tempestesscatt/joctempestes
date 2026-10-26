// ═══════════════════════════════════════════════════════════════════
//  sw.js (v3) — Service Worker del visor: guardat passiu + mode offline
//  Ubicació: a la MATEIXA carpeta que el HTML del visor.
//
//  Memòries cau:
//   · tc-shell-v1     → HTML, JS, CSS propis, manifest i llibreries CDN
//   · tc-data-<versio>→ dades del mapa (PNG, isolínies, vent, 3D...).
//                       Hi escriu tant aquest SW (el que mires) com offline.js
//                       (botó "Descarregar"). Quan surt una versió nova al
//                       manifest, les versions antigues s'esborren soles.
// ═══════════════════════════════════════════════════════════════════
'use strict';

const SHELL = 'tc-shell-v1';
const DATA_PREFIX = 'tc-data-';
const CACHE_PASSIU = true;   // true: guarda automàticament el que es veu. false: només el que es descarrega amb el botó

// Ajusta-ho als fitxers reals (rutes relatives a sw.js). Si algun falla, s'ignora.
const PRECACHE = [
    './',
    'js/mapapngs.js', 'js/hores.js', 'js/gfspngs.js', 'js/models.js',
    'dades/altitude.js', 'dades/paletes.js',
    'js/skew-t-engine.js', 'js/skewt.js', 'js/valor.js', 'js/outlook.js',
    'js/novetats.js', 'js/actualitzacio.js', 'js/vent.js', 'js/offline.js',
    'img/favicon.png',
    'https://cdnjs.cloudflare.com/ajax/libs/pako/2.0.4/pako.min.js',
    'https://cdn.jsdelivr.net/npm/msgpack-lite@0.1.26/dist/msgpack.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
];

const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com',
             'fonts.gstatic.com', 'www.gstatic.com'];
const FRESC = /\/(manifest|info_run)\.json$/;
const DADES = /\/(web_data_NE\/imatges|dades)\//;

// ─── Negre → blanc fet AQUÍ (fil del SW, una sola vegada, i es guarda processat) ───
const LLINDAR_NEGRE = 50;                                   // el mateix que mapapngs.js
const PNG_NB = /\/(sfc|3d)_[^/]*\.png$/;                    // només les capes de dades (no llegendes ni vores)
const SUPORT_NB = typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function';

async function processarNegre(resp) {
    const bmp = await createImageBitmap(await resp.blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0);
    bmp.close();
    const id = cx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        if (Math.max(d[i], d[i + 1], d[i + 2]) <= LLINDAR_NEGRE) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; }
    }
    cx.putImageData(id, 0, 0);
    const out = await c.convertToBlob({ type: 'image/png' });
    return new Response(out, { status: 200, headers: { 'Content-Type': 'image/png' } });
}

const clauNeta = url => { const u = new URL(url); return u.origin + u.pathname; };

self.addEventListener('install', e => {
    e.waitUntil((async () => {
        const c = await caches.open(SHELL);
        await Promise.allSettled(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' }))));
        self.skipWaiting();
    })());
});

self.addEventListener('activate', e => {
    e.waitUntil((async () => {
        // Esborra versions antigues del SW (inclosa 'tempestes-v2'), però respecta tc-data-*
        for (const k of await caches.keys()) {
            if (k !== SHELL && !k.startsWith(DATA_PREFIX)) await caches.delete(k);
        }
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET' || req.headers.has('range')) return;
    const url = new URL(req.url);
    const propi = url.origin === self.location.origin;

    if (!propi) {
        if (CDN.includes(url.hostname)) e.respondWith(cacheFirst(req));
        return;
    }
    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname.endsWith('/sw-ping')) {
        e.respondWith(new Response(JSON.stringify({ nb: SUPORT_NB }),
            { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }));
        return;
    }

    const fresc = FRESC.test(url.pathname);
    const v = url.searchParams.get('v');
    if (!fresc && v && DADES.test(url.pathname)) { e.respondWith(dadesVersionades(e, req, v)); return; }
    if (!fresc && DADES.test(url.pathname)) { e.respondWith(dadesSenseVersio(req)); return; }
    e.respondWith(xarxaPrimer(e, req, 4000));
});

// Dades amb ?v=VERSIO: si ja són guardades (passiu o descàrrega), es serveixen a l'instant.
async function dadesVersionades(e, req, v) {
    const c = await caches.match(req, { ignoreVary: true });
    if (c) return c;
    try {
        let r = await fetch(req);
        let guardar = true;
        const u = new URL(req.url);
        if (r.status === 200 && SUPORT_NB && u.searchParams.get('nb') === '1' && PNG_NB.test(u.pathname)) {
            const original = r.clone();
            try { r = await processarNegre(r); }
            catch { r = original; guardar = false; }      // si falla: es serveix l'original i no es guarda
        }
        // Si la petició ve del botó de descàrrega, ja la guarda la pàgina: no escrivim dues vegades
        if (guardar && CACHE_PASSIU && r.status === 200 && !req.headers.has('X-TC-Descarrega')) {
            const copia = r.clone();
            e.waitUntil(caches.open(DATA_PREFIX + v).then(cache => cache.put(req, copia)));
        }
        return r;
    } catch (err) {
        const vella = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
        if (vella) return vella;
        throw err;
    }
}

async function dadesSenseVersio(req) {
    try { return await fetch(req); }
    catch (err) {
        const c = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
        if (c) return c;
        throw err;
    }
}

// Quan arriba el manifest de xarxa, la seva "versio" mana: s'esborren les dades d'altres versions
async function netejarVelles(resp) {
    try {
        const m = await resp.json();
        if (!m || !m.versio) return;
        const actual = DATA_PREFIX + m.versio;
        for (const k of await caches.keys()) {
            if (k.startsWith(DATA_PREFIX) && k !== actual) await caches.delete(k);
        }
    } catch {}
}

// Xarxa primer, amb límit de temps si ja hi ha còpia (mala connexió).
// La clau no porta ?_cb= → una sola còpia del manifest, mai s'acumulen.
async function xarxaPrimer(e, req, ms) {
    const cache = await caches.open(SHELL);
    const clau = clauNeta(req.url);
    const guardada = await cache.match(clau);
    const xarxa = fetch(req).then(r => {
        if (r.status === 200) {
            cache.put(clau, r.clone());
            if (/\/manifest\.json$/.test(clau)) e.waitUntil(netejarVelles(r.clone()));
        }
        return r;
    });
    if (!guardada) return xarxa;
    xarxa.catch(() => {});
    try {
        return await Promise.race([xarxa, new Promise((_, rej) => setTimeout(rej, ms))]);
    } catch {
        return guardada;
    }
}

async function cacheFirst(req) {
    const cache = await caches.open(SHELL);
    const c = await cache.match(req);
    if (c) return c;
    const r = await fetch(req);
    if (r.status === 200 || r.type === 'opaque') cache.put(req, r.clone());
    return r;
}