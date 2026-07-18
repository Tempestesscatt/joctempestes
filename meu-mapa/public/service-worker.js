const CACHE_NAME = 'meteo-v1';

self.addEventListener('push', function(event) {
    let data = {};
    try {
        data = event.data.json();
    } catch (e) {
        data = {
            title: '🔔 Alerta meteorològica',
            body: 'Comprova les condicions del temps',
            icon: '/icons/icon-192.png'
        };
    }

    const options = {
        body: data.body || 'Comprova les condicions meteorològiques',
        icon: data.icon || '/icons/icon-192.png',
        badge: data.badge || '/icons/icon-192.png',
        vibrate: [200, 100, 200, 100, 300],
        data: { url: '/' },
        actions: [
            { action: 'open', title: '📊 Veure previsió' },
            { action: 'dismiss', title: 'Tancar' }
        ],
        tag: data.tag || 'weather-' + Date.now(),
        renotify: true,
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Alerta', options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = new URL('/', self.location.origin).href;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});