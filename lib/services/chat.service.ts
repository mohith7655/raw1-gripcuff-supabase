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
    // No separate conversations table — the chat_id itself is the conversation.
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
    static async sendMessage(
        chatId: string,
        senderId: string,
        recipientId: string,
        text: string
    ): Promise<void> {
        const trimmed = text.trim();
        if (!trimmed) return;

        const { error } = await supabase
            .from('messages')
            .insert({ chat_id: chatId, sender_id: senderId, text: trimmed });

        if (error) {
            console.error('[ChatService] insert failed:', error.message);
            throw new Error(error.message);
        }

        // Notify recipient (best-effort — don't block or throw on failure)
        NotificationService.insert({
            toUid: recipientId,
            fromUid: senderId,
            fromName: 'Chat message',
            type: 'chat_message',
            title: 'New message',
            body: trimmed,
            chatId,
        }).catch((e) => console.warn('[ChatService] notification write failed:', e));
    }

    // Fetch past messages then subscribe to new INSERTs.
    // Calls callback immediately with the historical batch, then again on each
    // new message. Returns an unsubscribe function.
    static subscribeToMessages(
        chatId: string,
        callback: (messages: ChatMessage[]) => void
    ): () => void {
        let cancelled = false;
        let currentMessages: ChatMessage[] = [];

        // Initial fetch — newest 100 messages, ascending so oldest is at top
        supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })
            .limit(100)
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) {
                    console.warn('[ChatService] initial fetch failed:', error.message);
                    callback([]);
                    return;
                }
                currentMessages = (data ?? []).map(rowToMessage);
                console.log('[ChatService] fetched', currentMessages.length, 'messages for', chatId);
                callback(currentMessages);
            });

        // Realtime subscription for new INSERTs
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
                    const newMsg = rowToMessage(payload.new);
                    console.log('[ChatService] realtime INSERT', { id: newMsg.id, senderId: newMsg.senderId });
                    currentMessages = [...currentMessages, newMsg];
                    callback(currentMessages);
                }
            )
            .subscribe((status, err) => {
                if (err) console.warn('[ChatService] subscription error:', err);
                else console.log('[ChatService] subscription status:', status, 'chat:', chatId);
            });

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }

    // Mark all unread messages in a chat as read for a given user
    static async markAsRead(chatId: string, uid: string): Promise<void> {
        const { error } = await supabase
            .from('messages')
            .update({ read: true })
            .eq('chat_id', chatId)
            .neq('sender_id', uid)  // only mark messages sent by the other person
            .eq('read', false);

        if (error) console.warn('[ChatService] markAsRead failed:', error.message);
    }

    // Subscribe to all conversations for a user (stub — no conversations table)
    static subscribeToConversations(
        _uid: string,
        callback: (convos: ChatConversation[]) => void
    ): () => void {
        callback([]);
        return () => {};
    }
}
