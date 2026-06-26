// RAW1 PWA Service Worker

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// Handle incoming Web Push messages
self.addEventListener('push', e => {
    let data = {};
    try { data = e.data?.json?.() ?? {}; } catch (_) { data = {}; }
    const title = data.title || 'RAW1';
    const options = {
        body: data.body || 'You have a new notification.',
        icon: '/assets/icon.png',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200, 100, 200],
        // Per-notification tag (e.g. chat:<id>) so unrelated pushes don't collapse.
        tag: data.tag || 'raw1',
        renotify: true,
        requireInteraction: false,
        data: { url: data.url || '/', type: data.type, chatId: data.chatId },
    };
    e.waitUntil(self.registration.showNotification(title, options));
});

// Tap on notification → focus or open the app
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            const open = list.find(c => 'focus' in c);
            if (open) return open.focus();
            return clients.openWindow(e.notification.data?.url || '/');
        })
    );
});
