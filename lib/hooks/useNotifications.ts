import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app, db } from '../core/config/firebase';
import { useAuth } from '../providers/AuthContext';

const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY?.trim();

type NavigationRef = {
  isReady: () => boolean;
  navigate: (name: string, params?: object) => void;
} | null;

async function waitForActiveServiceWorker(
  registration: ServiceWorkerRegistration
): Promise<ServiceWorkerRegistration> {
  if (registration.active?.state === 'activated') {
    return registration;
  }

  const worker = registration.installing || registration.waiting;

  if (!worker) {
    return navigator.serviceWorker.ready;
  }

  return new Promise((resolve) => {
    worker.addEventListener('statechange', () => {
      console.log('[FCM] Service worker state:', worker.state);
      if (worker.state === 'activated') {
        resolve(registration);
      }
    });
  });
}

async function saveToken(uid: string, token: string) {
  await setDoc(
    doc(db, 'users', uid),
    {
      fcmToken: token,
      fcmTokenUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  console.log('[FCM] Token saved for', uid);
}

async function showForegroundWebNotification(
  title: string,
  body: string,
  data: Record<string, any> | undefined
) {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data,
      tag: `raw1-${data?.type || 'foreground'}`,
      requireInteraction: true,
      vibrate: [200, 120, 200, 120, 200],
    });
    console.log('[Reminder] notification shown (foreground via SW)');
    return;
  } catch (e) {
    console.warn('[FCM] showNotification via SW failed, falling back to Notification():', e);
  }

  // Mobile Chrome often rejects Notification constructor; keep as desktop fallback.
  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data,
    tag: `raw1-${data?.type || 'foreground'}`,
  });
  console.log('[Reminder] notification shown (foreground via Notification constructor)');
  notification.onclick = () => notification.close();
}

function emitForegroundReminderEvent(data: Record<string, any> | undefined) {
  if (typeof window === 'undefined' || !data) return;
  window.dispatchEvent(
    new CustomEvent('raw1:foreground-reminder', {
      detail: data,
    })
  );
}

function navigateByType(
  type: string | undefined,
  navigationRef: React.MutableRefObject<NavigationRef>
) {
  const nav = navigationRef.current;

  if (!nav?.isReady()) {
    console.log('[FCM] Navigation not ready for notification type:', type);
    return;
  }

  if (type === 'message' || type === 'chat_message') {
    nav.navigate('ChatInbox');
  } else if (type === 'friend_request') {
    nav.navigate('FriendsScreen');
  } else if (type === 'workout_invite') {
    nav.navigate('UpcomingSessionsScreen');
  } else if (type === 'workout_reminder') {
    nav.navigate('UpcomingSessionsScreen');
  } else if (type === 'social_notification') {
    nav.navigate('HomeScreen');
  } else {
    console.log('[FCM] Unknown notification type:', type);
  }
}

export function useNotifications(navigationRef: React.MutableRefObject<NavigationRef>) {
  const { firebaseUser } = useAuth();
  const foregroundUnsubscribeRef = useRef<(() => void) | null>(null);

  const setupWebPush = useCallback(
    async (uid: string) => {
      if (Platform.OS !== 'web') {
        console.log('[FCM] Skipping Firebase Web Push on non-web platform:', Platform.OS);
        return;
      }

      if (typeof window === 'undefined') return;
      console.log('[FCM] initialized');

      if (!('Notification' in window)) {
        console.log('[FCM] Notification API unavailable');
        return;
      }
      console.log('[FCM] PushManager supported:', 'PushManager' in window);
      console.log('[FCM] Standalone mode:', window.matchMedia?.('(display-mode: standalone)')?.matches ?? false);

      if (!('serviceWorker' in navigator)) {
        console.log('[FCM] Service workers unavailable');
        return;
      }

      if (!VAPID_KEY) {
        console.error('[FCM] Missing EXPO_PUBLIC_FIREBASE_VAPID_KEY');
        return;
      }

      const supported = await isSupported();
      console.log('[FCM] Messaging supported:', supported);

      if (!supported) return;

      console.log('[FCM] Current permission:', Notification.permission);

      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();

      console.log('[FCM] Permission result:', permission);

      if (permission !== 'granted') {
        console.log('[FCM] Permission denied');
        return;
      }

      console.log('[FCM] Registering /firebase-messaging-sw.js');
      try {
        const swResp = await fetch('/firebase-messaging-sw.js', { cache: 'no-store' });
        console.log('[FCM] SW fetch check:', swResp.status, swResp.headers.get('content-type'));
      } catch (e) {
        console.warn('[FCM] SW fetch check failed:', e);
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      console.log('[FCM] SW register success, scope:', registration.scope);
      registration.update().catch(() => {});

      const activeRegistration = await waitForActiveServiceWorker(registration);
      console.log('[FCM] Service worker active:', activeRegistration.active?.state);

      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: activeRegistration,
      });

      if (!token) {
        console.log('[FCM] getToken returned no token');
        return;
      }

      console.log('[FCM] Generated token:', token);
      await saveToken(uid, token);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`raw1_fcm_token_${uid}`, token);
      }

      foregroundUnsubscribeRef.current?.();
      foregroundUnsubscribeRef.current = onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message:', payload);

        const title = payload.notification?.title || 'Raw1';
        const body = payload.notification?.body || '';
        const type = payload.data?.type;
        if (type === 'workout_start' || type === 'workout_reminder') {
          emitForegroundReminderEvent(payload.data as Record<string, any>);
          console.log('[Reminder] foreground popup opened', payload.data);
        }

        if (Notification.permission !== 'granted') return;
        showForegroundWebNotification(title, body, payload.data as Record<string, any>).catch((e) => {
          console.warn('[FCM] Foreground showNotification failed:', e);
        });
      });
    },
    [navigationRef]
  );

  useEffect(() => {
    if (!firebaseUser?.uid) return;

    setupWebPush(firebaseUser.uid).catch((error) => {
      console.error('[FCM] Setup failed:', error);
    });

    return () => {
      foregroundUnsubscribeRef.current?.();
      foregroundUnsubscribeRef.current = null;
    };
  }, [firebaseUser?.uid, setupWebPush]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'NOTIFICATION_CLICKED') return;
      console.log('[FCM] Service worker click message:', event.data);
      navigateByType(event.data.notificationType, navigationRef);
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigationRef]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const notification = params.get('notification');
    if (!notification) return;

    params.delete('notification');
    window.history.replaceState(
      {},
      '',
      params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname
    );

    const typeMap: Record<string, string> = {
      chat: 'message',
      friends: 'friend_request',
      invites: 'workout_invite',
      reminders: 'workout_reminder',
      social: 'social_notification',
    };

    const timer = window.setTimeout(() => {
      navigateByType(typeMap[notification], navigationRef);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [navigationRef]);
}
