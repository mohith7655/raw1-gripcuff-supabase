import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { AppNotification } from '../models/AppNotification';
import { TopBannerNotification } from '../components/TopBannerNotification';
import { NotificationService } from '../services/notification.service';
import { getChatId } from '../services/chat.service';
import { navigationRef } from '../core/navigation';
import { PushTokenService } from '../services/pushToken.service';

type NotificationContextType = {
  current: AppNotification | null;
  queueSize: number;
  currentWorkoutInvite: AppNotification | null;
  dismissWorkoutInvite: () => void;
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
  const bootstrappedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  // ── Push token registration on login ─────────────────────────────────────
  useEffect(() => {
    if (!supabaseUserId) return;
    PushTokenService.registerAndSave(supabaseUserId);
  }, [supabaseUserId]);

  // ── Supabase realtime notification subscription ───────────────────────────
  useEffect(() => {
    if (!supabaseUserId) {
      setQueue([]);
      setCurrent(null);
      setWorkoutInviteQueue([]);
      setCurrentWorkoutInvite(null);
      bootstrappedRef.current = false;
      seenRef.current.clear();
      return;
    }

    const uid = supabaseUserId;

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

  // ── Banner tap navigation ─────────────────────────────────────────────────

  const handleBannerPress = useCallback((notification: AppNotification) => {
    if (!navigationRef.isReady()) return;
    if (notification.type === 'chat_message') {
      navigationRef.navigate('ChatInbox');
    } else if (notification.type === 'friend_request') {
      navigationRef.navigate('FriendsScreen');
    } else if (notification.type === 'workout_invite') {
      navigationRef.navigate('UpcomingSessionsScreen');
    }
  }, []);

  const ctx = useMemo(() => ({
    current,
    queueSize: queue.length,
    currentWorkoutInvite,
    dismissWorkoutInvite,
  }), [current, queue.length, currentWorkoutInvite, dismissWorkoutInvite]);

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
