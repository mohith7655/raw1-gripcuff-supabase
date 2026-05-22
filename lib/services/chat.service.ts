import { supabase } from '../core/config/supabase';
import { ChatConversation, ChatMessage } from '../models/Chat';
import { NotificationService } from './notification.service';

// Deterministic conversation ID for two users (no separate conversations table needed)
export function getChatId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
}

function rowToMessage(row: any): ChatMessage {
    return {
        id: row.id as string,
        text: row.text as string,
        senderId: row.sender_id as string,
        createdAt: new Date(row.created_at),
        read: !!row.read,
    };
}

export class ChatService {
    static async getOrCreateConversation(
        uid1: string,
        uid2: string
    ): Promise<ChatConversation> {
        const chatId = getChatId(uid1, uid2);
        return {
            id: chatId,
            participants: [uid1, uid2],
            lastMessage: '',
            lastMessageAt: null,
            lastMessageBy: '',
            unreadCount: { [uid1]: 0, [uid2]: 0 },
        };
    }

    // Insert message into messages table, then notify recipient.
    // senderName is used for the notification's fromName field.
    static async sendMessage(
        chatId: string,
        senderId: string,
        recipientId: string,
        text: string,
        senderName?: string,
    ): Promise<ChatMessage | null> {
        const trimmed = text.trim();
        if (!trimmed) return null;

        const { data, error } = await supabase
            .from('messages')
            .insert({ chat_id: chatId, sender_id: senderId, text: trimmed })
            .select('*')
            .single();

        if (error) {
            console.error('[ChatService] insert failed:', error.message);
            throw new Error(error.message);
        }

        console.log('[ChatService] inserted message', { id: data.id, chatId, senderId });

        // Notify recipient (best-effort)
        NotificationService.insert({
            toUid: recipientId,
            fromUid: senderId,
            fromName: senderName || 'Someone',
            type: 'chat_message',
            title: 'New message',
            body: trimmed,
            chatId,
        }).catch((e) => console.warn('[ChatService] notification write failed:', e));

        return rowToMessage(data);
    }

    // Fetch past messages then subscribe to new INSERTs.
    // Calls callback immediately with the historical batch, then again on each
    // new message. Deduplicates by ID so optimistic inserts don't double-render.
    // Returns an unsubscribe function.
    static subscribeToMessages(
        chatId: string,
        callback: (messages: ChatMessage[]) => void
    ): () => void {
        let cancelled = false;
        let currentMessages: ChatMessage[] = [];
        const seenIds = new Set<string>();

        const addMessages = (msgs: ChatMessage[]) => {
            let changed = false;
            for (const m of msgs) {
                if (!seenIds.has(m.id)) {
                    seenIds.add(m.id);
                    currentMessages = [...currentMessages, m];
                    changed = true;
                }
            }
            if (changed) callback(currentMessages);
        };

        // Initial fetch — 100 messages ascending so oldest is at top
        console.log('[ChatService] fetching messages for chatId:', chatId);
        supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })
            .limit(100)
            .then(({ data, error: fetchErr }) => {
                if (cancelled) return;
                if (fetchErr) {
                    console.warn('[ChatService] initial fetch failed:', fetchErr.message);
                    callback([]);
                    return;
                }
                const rows = (data ?? []).map(rowToMessage);
                console.log('[ChatService] fetched', rows.length, 'messages for', chatId);
                addMessages(rows);
            });

        // Realtime subscription — fires for every INSERT on this chat_id.
        // Requires the messages table to be in the supabase_realtime publication
        // and have REPLICA IDENTITY FULL (see migration 20260522_messages.sql).
        const channel = supabase
            .channel(`messages:${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${chatId}`,
                },
                (payload) => {
                    if (cancelled) return;
                    console.log('[ChatService] realtime INSERT fired', {
                        id: payload.new?.id,
                        chatId: payload.new?.chat_id,
                        senderId: payload.new?.sender_id,
                    });
                    const newMsg = rowToMessage(payload.new);
                    addMessages([newMsg]);
                }
            )
            .subscribe((status, err) => {
                if (err) {
                    console.warn('[ChatService] subscription error:', err);
                } else {
                    console.log('[ChatService] subscription status:', status, '| chatId:', chatId);
                }
            });

        return () => {
            cancelled = true;
            console.log('[ChatService] unsubscribing channel for', chatId);
            supabase.removeChannel(channel);
        };
    }

    // Mark all unread messages from the other person as read
    static async markAsRead(chatId: string, uid: string): Promise<void> {
        const { error } = await supabase
            .from('messages')
            .update({ read: true })
            .eq('chat_id', chatId)
            .neq('sender_id', uid)
            .eq('read', false);

        if (error) console.warn('[ChatService] markAsRead failed:', error.message);
    }

    static subscribeToConversations(
        _uid: string,
        callback: (convos: ChatConversation[]) => void
    ): () => void {
        callback([]);
        return () => {};
    }
}
