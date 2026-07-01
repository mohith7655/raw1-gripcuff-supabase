import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { AppNotification } from '../models/AppNotification';
import { TopBannerNotification } from '../components/TopBannerNotification';
import { NotificationService } from '../services/notification.service';
import { getChatId } from '../services/chat.service';
import { navigationRef } from '../core/navigation';
import { PushTokenService } from '../services/pushToken.service';
import { WebPushService } from '../services/webPush.service';

type NotificationContextType = {
  current: AppNotification | null;
  queueSize: number;
  currentWorkoutInvite: AppNotification | null;
  dismissWorkoutInvite: () => void;
  /** Unread notification count — drives the bottom Social tab badge. */
  unreadCount: number;
  /** Mark every notification read (called when the Social tab is opened). */
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const TAG = '[NotificationProvider]';

function isCurrentlyInChat(chatId: string | undefined, currentUid: string): boolean {
  if (!chatId || !navigationRef.isReady()) return false;
  const route = navigationRef.getCurrentRoute();
  if (route?.name !== 'ChatRoom') return false;
  const params = route.params as any;
  if (!params?.friendUid) return false;
  return getChatId(currentUid, params.friendUid) === chatId;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { supabaseUserId } = useAuth();
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const [current, setCurrent] = useState<AppNotification | null>(null);
  const [workoutInviteQueue, setWorkoutInviteQueue] = useState<AppNotification[]>([]);
  const [currentWorkoutInvite, setCurrentWorkoutInvite] = useState<AppNotification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const bootstrappedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  // ── Push token registration on login ─────────────────────────────────────
  // Native → Expo push token; web → W3C Web Push subscription (Netlify-hosted PWA).
  useEffect(() => {
    if (!supabaseUserId) return;
    PushTokenService.registerAndSave(supabaseUserId);
    WebPushService.registerAndSave(supabaseUserId);
  }, [supabaseUserId]);

  // ── Supabase realtime notification subscription ───────────────────────────
  useEffect(() => {
    if (!supabaseUserId) {
      setQueue([]);
      setCurrent(null);
      setWorkoutInviteQueue([]);
      setCurrentWorkoutInvite(null);
      setUnreadCount(0);
      bootstrappedRef.current = false;
      seenRef.current.clear();
      return;
    }

    const uid = supabaseUserId;

    // Refresh the deduped unread count from the table (badge source of truth).
    const refreshUnread = () => NotificationService.getUnreadCount(uid).then(setUnreadCount).catch(() => {});
    refreshUnread();

    const unsub = NotificationService.subscribeToNewNotifications(
      uid,

      (seenIds) => {
        seenIds.forEach((id) => seenRef.current.add(id));
        bootstrappedRef.current = true;
      },

      (notification) => {
        if (seenRef.current.has(notification.id)) return;
        seenRef.current.add(notification.id);

        // Suppress chat banner if user is already in that chat room
        if (notification.type === 'chat_message' && isCurrentlyInChat(notification.chatId, uid)) {
          return;
        }

        refreshUnread();
        if (notification.type === 'workout_invite') {
          setWorkoutInviteQueue((prev) => [...prev, notification]);
          return;
        }
        setQueue((prev) => [...prev, notification]);
      },

      (err) => {
        console.warn(`${TAG} Supabase subscription error:`, err);
      },

      (notifications) => {
        const genuinelyNew = notifications.filter((n) => !seenRef.current.has(n.id));
        if (genuinelyNew.length === 0) return;

        refreshUnread();
        genuinelyNew.forEach((n) => {
          seenRef.current.add(n.id);
          if (n.type === 'chat_message' && isCurrentlyInChat(n.chatId, uid)) return;
          if (n.type === 'workout_invite') {
            setWorkoutInviteQueue((prev) => [...prev, n]);
            return;
          }
          setQueue((prev) => [...prev, n]);
        });
      },
    );

    return () => {
      unsub();
      bootstrappedRef.current = false;
      seenRef.current.clear();
    };
  }, [supabaseUserId]);

  // ── Queue draining ────────────────────────────────────────────────────────

  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((prev) => prev.slice(1));
  }, [queue, current]);

  useEffect(() => {
    if (currentWorkoutInvite || workoutInviteQueue.length === 0) return;
    setCurrentWorkoutInvite(workoutInviteQueue[0]);
    setWorkoutInviteQueue((prev) => prev.slice(1));
  }, [workoutInviteQueue, currentWorkoutInvite]);

  const dismissWorkoutInvite = useCallback(() => setCurrentWorkoutInvite(null), []);

  // Clear the unread badge — called when the Social tab is opened.
  const markAllRead = useCallback(() => {
    setUnreadCount(0);
    if (supabaseUserId) NotificationService.markAllRead(supabaseUserId).catch(() => {});
  }, [supabaseUserId]);

  // ── Banner tap navigation ─────────────────────────────────────────────────

  const handleBannerPress = useCallback((notification: AppNotification) => {
    if (!navigationRef.isReady()) return;
    if (notification.type === 'chat_message' || notification.type === 'message') {
      navigationRef.navigate('ChatInbox');
    } else if (notification.type === 'friend_request') {
      navigationRef.navigate('FriendsScreen');
    } else if (
      notification.type === 'workout_invite' ||
      notification.type === 'session_invite' ||
      notification.type === 'challenge_invite' ||
      notification.type === 'video_invite'
    ) {
      navigationRef.navigate('UpcomingSessionsScreen');
    }
  }, []);

  const ctx = useMemo(() => ({
    current,
    queueSize: queue.length,
    currentWorkoutInvite,
    dismissWorkoutInvite,
    unreadCount,
    markAllRead,
  }), [current, queue.length, currentWorkoutInvite, dismissWorkoutInvite, unreadCount, markAllRead]);

  return (
    <NotificationContext.Provider value={ctx}>
      {children}
      <TopBannerNotification
        notification={current}
        onDismiss={() => setCurrent(null)}
        onPress={handleBannerPress}
      />
    </NotificationContext.Provider>
  );
}

export function useNotificationCenter() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationCenter must be used within NotificationProvider');
  return ctx;
}
