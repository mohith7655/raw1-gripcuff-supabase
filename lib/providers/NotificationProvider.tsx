import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { AppNotification } from '../models/AppNotification';
import { TopBannerNotification } from '../components/TopBannerNotification';
import { NotificationService } from '../services/notification.service';
import { ChatService } from '../services/chat.service';
import { ChatConversation } from '../models/Chat';

type NotificationContextType = {
  current: AppNotification | null;
  queueSize: number;
  currentWorkoutInvite: AppNotification | null;
  dismissWorkoutInvite: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const TAG = '[NotificationProvider]';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { supabaseUserId } = useAuth();
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const [current, setCurrent] = useState<AppNotification | null>(null);
  const [workoutInviteQueue, setWorkoutInviteQueue] = useState<AppNotification[]>([]);
  const [currentWorkoutInvite, setCurrentWorkoutInvite] = useState<AppNotification | null>(null);
  const bootstrappedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const chatBootstrapRef = useRef(false);
  const unreadByChatRef = useRef<Record<string, number>>({});
  const shownChatEventRef = useRef<Set<string>>(new Set());

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

    const unsub = NotificationService.subscribeToNewNotifications(
      supabaseUserId,

      (seenIds) => {
        seenIds.forEach((id) => seenRef.current.add(id));
        bootstrappedRef.current = true;
      },

      (notification) => {
        if (notification.type === 'chat_message') return;

        if (seenRef.current.has(notification.id)) return;
        seenRef.current.add(notification.id);

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
          if (n.type === 'chat_message') return;
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

  // ── Chat popup bridge ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseUserId) {
      chatBootstrapRef.current = false;
      unreadByChatRef.current = {};
      shownChatEventRef.current.clear();
      return;
    }

    const unsub = ChatService.subscribeToConversations(supabaseUserId, async (convos: ChatConversation[]) => {
      const incoming: AppNotification[] = [];

      for (const convo of convos) {
        const chatId = convo.id;
        const nextUnread = convo.unreadCount?.[supabaseUserId] ?? 0;
        const prevUnread = unreadByChatRef.current[chatId] ?? 0;
        unreadByChatRef.current[chatId] = nextUnread;

        if (!chatBootstrapRef.current) continue;
        if (nextUnread <= prevUnread) continue;
        if (!convo.lastMessageBy || convo.lastMessageBy === supabaseUserId) continue;

        const ts = convo.lastMessageAt?.getTime?.() ?? Date.now();
        const syntheticId = `chat:${chatId}:${ts}`;
        if (shownChatEventRef.current.has(syntheticId)) continue;
        shownChatEventRef.current.add(syntheticId);

        const fromName = 'Someone';

        incoming.push({
          id: syntheticId,
          type: 'chat_message',
          title: fromName,
          body: convo.lastMessage || 'You have a new message',
          toUid: supabaseUserId,
          fromUid: convo.lastMessageBy,
          fromName,
          avatar: undefined,
          createdAt: new Date() as any,
          read: false,
          chatId,
        });
      }

      if (incoming.length) {
        setQueue((prev) => [...prev, ...incoming]);
      }

      if (!chatBootstrapRef.current) {
        chatBootstrapRef.current = true;
      }
    });

    return () => unsub();
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
      />
    </NotificationContext.Provider>
  );
}

export function useNotificationCenter() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationCenter must be used within NotificationProvider');
  return ctx;
}
