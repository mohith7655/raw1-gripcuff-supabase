// RAW1 PWA Service Worker

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// Handle incoming Web Push messages
self.addEventListener('push', e => {
    const data = e.data?.json?.() ?? {};
    const title = data.title || 'Reminder to Move 💪';
    const options = {
        body: data.body || 'Time to move — stay active!',
        icon: '/assets/icon.png',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'move-reminder',
        renotify: true,
        requireInteraction: false,
        data: { url: data.url || '/' },
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
