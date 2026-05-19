importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

console.log('[FCM SW] loaded');

firebase.initializeApp({
  apiKey: 'AIzaSyArvR9zogpBSK9zmQIFULUSuUbC8iTNvcA',
  authDomain: 'wazy-6c4a9.firebaseapp.com',
  projectId: 'wazy-6c4a9',
  storageBucket: 'wazy-6c4a9.firebasestorage.app',
  messagingSenderId: '618804250165',
  appId: '1:618804250165:web:f9d7ba05cbfa969523137c',
});

const messaging = firebase.messaging();

self.addEventListener('install', (event) => {
  console.log('[FCM SW] install');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[FCM SW] activate');
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log('[Reminder] FCM sent (background):', payload);

  const title = payload.notification?.title || 'Raw1';
  const body = payload.notification?.body || '';

  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
    requireInteraction: true,
    vibrate: [200, 200, 200, 200],
  });
});

self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] notificationclick', event.notification.data);
  event.notification.close();

  const data = event.notification.data || {};
  const type = data.type;
  const origin = self.location.origin;

  // Special handling for workout_start — navigate to VideoPlayer with params
  if (type === 'workout_start') {
    const workoutId = data.workoutId || '';
    const scheduleId = data.scheduleId || '';
    const targetUrl = `${origin}/?screen=VideoPlayer&workoutId=${encodeURIComponent(workoutId)}&scheduleId=${encodeURIComponent(scheduleId)}&fromNotification=true`;
    
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              notificationType: type,
              ...data,
            });
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      })
    );
    return;
  }

  const pathByType = {
    message: '/?notification=chat',
    chat_message: '/?notification=chat',
    friend_request: '/?notification=friends',
    workout_invite: '/?notification=invites',
    workout_reminder: '/?notification=reminders',
    recurring_workout: '/?notification=reminders',
    social_notification: '/?notification=social',
  };
  const fallbackPath = pathByType[type] || '/';
  const explicitLink = typeof data.link === 'string' && data.link ? data.link : '';
  const targetUrl = explicitLink.startsWith('http')
    ? explicitLink
    : `${origin}${explicitLink || fallbackPath}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            notificationType: type,
            ...data,
          });
          return;
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
