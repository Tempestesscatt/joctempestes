// sw.js - Service Worker per guardar dades del mapa (versió 2)
//
// Canvis respecte a la versió anterior:
//  1) manifest.json i info_run.json NO es guarden: porten ?_cb=<hora> i cada
//     petició tenia una URL nova, així que s'acumulaven sense servir mai.
//  2) Quan arriba una versió nova (?v=...), s'esborren els fitxers de versions
//     antigues. Abans la memòria cau només creixia.
//  3) Només es guarden respostes 200 correctes (abans també errors 404/500).
//  4) Es canvia CACHE_NAME: en activar-se, s'esborra la memòria cau antiga (v1).

const CACHE_NAME = 'tempestes-v2';

// Sempre directes a la xarxa: han de ser frescos i no tenen sentit a la memòria cau
const SEMPRE_XARXA = /\/(manifest|info_run)\.json$/;

let ultimaVersio = null;

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((noms) => Promise.all(
                noms.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

// Esborra de la memòria cau els fitxers amb una versió (?v=) diferent de l'actual
async function netejarVersionsAntigues(cache, versio) {
    if (!versio || versio === ultimaVersio) return;
    ultimaVersio = versio;
    const claus = await cache.keys();
    await Promise.all(
        claus
            .filter((k) => {
                const v = new URL(k.url).searchParams.get('v');
                return v && v !== versio;
            })
            .map((k) => cache.delete(k))
    );
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (!url.pathname.includes('web_data_NE')) return;
    if (SEMPRE_XARXA.test(url.pathname)) return;   // el navegador ho demana directament

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const guardada = await cache.match(req);
        if (guardada) return guardada;

        const xarxa = await fetch(req);
        if (xarxa.status === 200) {
            const copia = xarxa.clone();
            event.waitUntil((async () => {
                await netejarVersionsAntigues(cache, url.searchParams.get('v'));
                await cache.put(req, copia);
            })());
        }
        return xarxa;
    })());
});