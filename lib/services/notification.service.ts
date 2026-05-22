import { supabase } from '../core/config/supabase';
import { AppNotification, AppNotificationType } from '../models/AppNotification';

const TAG = '[NotificationService]';

// ─── Insert payload ───────────────────────────────────────────────────────────
// to_uid is the Supabase user ID of the recipient.

export type NotificationInsertPayload = {
  toUid: string;
  fromUid?: string;
  fromName?: string;
  type: string;
  title: string;
  body: string;
  chatId?: string;
  messageId?: string;
  sessionId?: string;
};

// ─── Dedup key ────────────────────────────────────────────────────────────────
//
// A 60-second-windowed fingerprint that makes inserts idempotent against:
//   • network retries / double-calls within the same minute
//   • React Strict Mode double-invocation in development
//
// The anchor prefers a stable entity ID (session/request/message) so that
// intentional resends (same session, later minute) always get a new key.

function buildDedupKey(payload: NotificationInsertPayload): string {
  const bucket = Math.floor(Date.now() / 60_000);
  // Use || (not ??) so that empty strings fall through to the next candidate.
  const anchor =
    payload.sessionId ||
    payload.messageId ||
    payload.chatId ||
    payload.fromUid ||
    'none';
  return `${payload.type}:${payload.toUid}:${anchor}:${bucket}`;
}

// ─── Row → AppNotification ────────────────────────────────────────────────────

function rowToNotification(row: Record<string, any>): AppNotification {
  return {
    id: row.id,
    type: (row.type ?? 'system') as AppNotificationType,
    title: row.title ?? 'Notification',
    body: row.body ?? '',
    toUid: row.to_uid ?? '',
    fromUid: row.from_uid ?? '',
    fromName: row.from_name ?? 'Someone',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    read: !!row.read,
    chatId: row.chat_id ?? undefined,
    messageId: row.message_id ?? undefined,
    sessionId: row.session_id ?? undefined,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class NotificationService {
  // ── Insert ─────────────────────────────────────────────────────────────────
  // Returns the new row id, or null on failure (non-fatal for callers).

  static async insert(payload: NotificationInsertPayload): Promise<string | null> {
    const dedupKey = buildDedupKey(payload);
    console.log(`${TAG} insert`, { type: payload.type, toUid: payload.toUid, dedupKey });

    console.log('[NotificationService] full payload:', JSON.stringify(payload, null, 2));

    // upsert with ignoreDuplicates: if dedup_key already exists, do nothing and
    // return null data (not an error).  maybeSingle() handles the empty-result case.
    const { data, error } = await supabase
      .from('notifications')
      .upsert(
        {
          to_uid: payload.toUid,           // TEXT column — uid stored as plain string
          from_uid: payload.fromUid || null, // UUID column — must be valid UUID or null; never ''
          from_name: payload.fromName ?? 'Someone',
          type: payload.type,
          title: payload.title,
          body: payload.body,
          read: false,
          chat_id: payload.chatId || null,
          message_id: payload.messageId || null, // || catches '' so empty string → null
          session_id: payload.sessionId || null,
          dedup_key: dedupKey,
        },
        { onConflict: 'dedup_key', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle();

    if (error) {
      console.warn(`${TAG} insert failed:`, error.message);
      return null;
    }

    if (!data) {
      console.log(`${TAG} duplicate suppressed`, { dedupKey, type: payload.type, toUid: payload.toUid });
      return null;
    }

    console.log(`${TAG} inserted`, { id: data.id, type: payload.type });
    return data.id as string;
  }

  // ── Mark single notification read ──────────────────────────────────────────

  static async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) console.warn(`${TAG} markRead failed:`, error.message);
    else console.log(`${TAG} markRead`, { id });
  }

  // ── Mark read by sessionId + toUid (accept/decline invite) ────────────────

  static async markReadBySession(sessionId: string, toUid: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('session_id', sessionId)
      .eq('to_uid', toUid);

    if (error) console.warn(`${TAG} markReadBySession failed:`, error.message);
    else console.log(`${TAG} markReadBySession`, { sessionId, toUid });
  }

  // ── Mark read by sessionId only (cancel/expire — all recipients) ──────────

  static async markReadBySessionAll(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('session_id', sessionId);

    if (error) console.warn(`${TAG} markReadBySessionAll failed:`, error.message);
    else console.log(`${TAG} markReadBySessionAll`, { sessionId });
  }

  // ── Realtime subscription ─────────────────────────────────────────────────
  //
  // Three-phase:
  //   1. onBootstrapped — called once at startup with the IDs of all currently-
  //      unread rows so the provider seeds seenRef (no false banners on open).
  //   2. onNew — called for each INSERT that arrives on the live channel.
  //   3. onRehydrated — called after a reconnect with the full unread rows so
  //      the provider can surface any notification missed during the gap.
  //      The provider filters by seenRef; only genuinely new ones become banners.
  //
  // Returns an unsubscribe function.

  static subscribeToNewNotifications(
    uid: string,
    onBootstrapped: (seenIds: string[]) => void,
    onNew: (notification: AppNotification) => void,
    onError?: (err: unknown) => void,
    onRehydrated?: (notifications: AppNotification[]) => void,
  ): () => void {
    console.log(`${TAG} subscribing`, { uid });
    let hasBeenSubscribed = false;

    // Phase 1: fetch existing unread IDs to seed seenRef.
    supabase
      .from('notifications')
      .select('id')
      .eq('to_uid', uid)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          console.warn(`${TAG} bootstrap fetch failed:`, error.message);
          onError?.(error);
          onBootstrapped([]);
          return;
        }
        const ids = (data ?? []).map((r) => r.id as string);
        console.log(`${TAG} bootstrap complete`, { count: ids.length, uid });
        onBootstrapped(ids);
      });

    // Phase 2: realtime channel — INSERT events after subscription starts.
    const channel = supabase
      .channel(`notifications-new:${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `to_uid=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row) return;
          console.log(`${TAG} realtime INSERT`, { id: row.id, type: row.type });
          onNew(rowToNotification(row));
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn(`${TAG} subscription error:`, err);
          onError?.(err);
          return;
        }

        console.log(`${TAG} subscription status`, { status, uid });

        if (status === 'SUBSCRIBED') {
          if (hasBeenSubscribed && onRehydrated) {
            // Reconnect detected: fetch full unread rows oldest-first so the
            // provider can show banners for anything missed during the disconnect.
            console.log(`${TAG} reconnect rehydration start`, { uid });
            supabase
              .from('notifications')
              .select('*')
              .eq('to_uid', uid)
              .eq('read', false)
              .order('created_at', { ascending: true })
              .limit(20)
              .then(({ data: rows, error: fetchErr }) => {
                if (fetchErr) {
                  console.warn(`${TAG} rehydration fetch failed:`, fetchErr.message);
                  return;
                }
                const notifications = (rows ?? []).map(rowToNotification);
                console.log(`${TAG} rehydration complete`, { count: notifications.length, uid });
                onRehydrated(notifications);
              });
          }
          hasBeenSubscribed = true;
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'CLOSED' ||
          status === 'TIMED_OUT'
        ) {
          console.log(`${TAG} channel ${status} — will rehydrate on reconnect`, { uid });
        }
      });

    return () => {
      console.log(`${TAG} unsubscribing`, { uid });
      supabase.removeChannel(channel);
    };
  }
}
