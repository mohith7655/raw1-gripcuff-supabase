import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../core/config/firebase';
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
  // Notifications are addressed by Firebase UID (to_uid = firebaseUid).
  const { firebaseUid } = useAuth();
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
  //
  // Source of truth: public.notifications (Supabase).
  // Firebase still handles push delivery via Cloud Functions + FCM.
  // Dual-write from write-side services ensures Supabase stays current.

  useEffect(() => {
    if (!firebaseUid) {
      setQueue([]);
      setCurrent(null);
      setWorkoutInviteQueue([]);
      setCurrentWorkoutInvite(null);
      bootstrappedRef.current = false;
      seenRef.current.clear();
      return;
    }

    const unsub = NotificationService.subscribeToNewNotifications(
      firebaseUid,

      // ── onBootstrapped: seed seenRef with all currently-unread IDs ──────────
      // Called once on initial subscribe and again after each reconnect
      // (additive — Set.add is idempotent, so no duplicates accumulate).
      (seenIds) => {
        seenIds.forEach((id) => seenRef.current.add(id));
        bootstrappedRef.current = true;
        console.log(`${TAG} bootstrap seeded`, { count: seenIds.length });
      },

      // ── onNew: a fresh INSERT arrived on the realtime channel ────────────────
      (notification) => {
        // chat_message banners come from the chat bridge below, not here.
        if (notification.type === 'chat_message') return;

        if (seenRef.current.has(notification.id)) {
          if (__DEV__) {
            console.log(`${TAG} dedup drop (realtime)`, { id: notification.id, type: notification.type });
          }
          return;
        }
        seenRef.current.add(notification.id);

        if (__DEV__) {
          console.log(`${TAG} enqueue`, { id: notification.id, type: notification.type });
        }

        if (notification.type === 'workout_invite') {
          setWorkoutInviteQueue((prev) => [...prev, notification]);
          return;
        }
        setQueue((prev) => [...prev, notification]);
      },

      // ── onError ──────────────────────────────────────────────────────────────
      (err) => {
        console.warn(`${TAG} Supabase subscription error:`, err);
      },

      // ── onRehydrated: reconnect replay — surface missed notifications ────────
      // Called after a reconnect with all currently-unread rows (oldest-first).
      // Filter by seenRef: only IDs that weren't seen before the disconnect are new.
      (notifications) => {
        const genuinelyNew = notifications.filter((n) => !seenRef.current.has(n.id));
        if (genuinelyNew.length === 0) return;

        console.log(`${TAG} reconnect replay`, { count: genuinelyNew.length });
        genuinelyNew.forEach((n) => {
          seenRef.current.add(n.id);
          if (n.type === 'chat_message') return; // chat bridge handles these
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
  }, [firebaseUid]);

  // ── Chat popup bridge ─────────────────────────────────────────────────────
  //
  // Bell count comes from chatRooms unread counts (Firebase).
  // This bridge emits top banners from that same realtime signal so chat
  // popups are guaranteed even when the Supabase notification write is delayed.

  useEffect(() => {
    if (!firebaseUid) {
      chatBootstrapRef.current = false;
      unreadByChatRef.current = {};
      shownChatEventRef.current.clear();
      return;
    }

    const unsub = ChatService.subscribeToConversations(firebaseUid, async (convos: ChatConversation[]) => {
      const incoming: AppNotification[] = [];

      for (const convo of convos) {
        const chatId = convo.id;
        const nextUnread = convo.unreadCount?.[firebaseUid] ?? 0;
        const prevUnread = unreadByChatRef.current[chatId] ?? 0;
        unreadByChatRef.current[chatId] = nextUnread;

        if (!chatBootstrapRef.current) continue;
        if (nextUnread <= prevUnread) continue;
        if (!convo.lastMessageBy || convo.lastMessageBy === firebaseUid) continue;

        const ts = convo.lastMessageAt?.toMillis?.() ?? Date.now();
        const syntheticId = `chat:${chatId}:${ts}`;
        if (shownChatEventRef.current.has(syntheticId)) continue;
        shownChatEventRef.current.add(syntheticId);

        let fromName = 'Someone';
        let avatar: string | undefined;
        try {
          const senderSnap = await getDoc(doc(db, 'users', convo.lastMessageBy));
          if (senderSnap.exists()) {
            const raw = senderSnap.data() as Record<string, any>;
            fromName = raw.fullName || raw.displayName || raw.username || raw.email || 'Someone';
            avatar = raw.profileImageUrl || raw.avatar || undefined;
          }
        } catch (e) {
          if (__DEV__) console.warn(`${TAG} sender profile read failed:`, e);
        }

        incoming.push({
          id: syntheticId,
          type: 'chat_message',
          title: fromName,
          body: convo.lastMessage || 'You have a new message',
          toUid: firebaseUid,
          fromUid: convo.lastMessageBy,
          fromName,
          avatar,
          createdAt: convo.lastMessageAt ?? Timestamp.now(),
          read: false,
          chatId,
        });
      }

      if (incoming.length) {
        if (__DEV__) console.log(`${TAG} enqueue chat bridge`, incoming.map((n) => n.id));
        setQueue((prev) => [...prev, ...incoming]);
      }

      if (!chatBootstrapRef.current) {
        chatBootstrapRef.current = true;
      }
    });

    return () => unsub();
  }, [firebaseUid]);

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
