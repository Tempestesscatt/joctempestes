// sw.js - Service Worker per guardar dades offline
const CACHE_NAME = 'tempestes-v1';

// Quan el navegador fa una petició (imatge, fitxer, etc.)
self.addEventListener('fetch', (event) => {
    // Només volem guardar les imatges i les dades del mapa
    if (event.request.url.includes('web_data_NE')) {
        event.respondWith(
            caches.match(event.request).then((resposta) => {
                // Si el fitxer ja està al disc dur, el retornem (modo offline)
                if (resposta) return resposta;
                // Si no, el baixem d'internet
                return fetch(event.request).then((respostaXarxa) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        // El guardem per la propera vegada
                        cache.put(event.request, respostaXarxa.clone());
                        return respostaXarxa;
                    });
                });
            })
        );
    }
});