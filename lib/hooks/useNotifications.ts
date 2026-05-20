import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../providers/AuthContext';

type NavigationRef = {
  isReady: () => boolean;
  navigate: (name: string, params?: object) => void;
} | null;

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
  const { supabaseUserId } = useAuth();

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
