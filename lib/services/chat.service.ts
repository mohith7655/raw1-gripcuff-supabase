import { ChatConversation, ChatMessage } from '../models/Chat';
import { NotificationService } from './notification.service';

// Deterministic conversation ID for two users
export function getChatId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
}

export class ChatService {
    // Ensure a conversation doc exists
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

    // Send a message and create a unified in-app notification
    static async sendMessage(
        chatId: string,
        senderId: string,
        recipientId: string,
        text: string
    ): Promise<void> {
        const trimmed = text.trim();

        // Dual-write: Supabase is source of truth for notification reads/listeners.
        NotificationService.insert({
            toUid: recipientId,
            fromUid: senderId,
            fromName: 'Chat message',
            type: 'chat_message',
            title: 'New message',
            body: trimmed || 'You have a new message',
            chatId,
            // messageId intentionally omitted — chatId is used as the dedup anchor.
            // Passing messageId:'' would bypass the ?? guard and produce :: in the key.
        }).catch((e) => console.warn('[ChatService] Supabase notification write failed:', e));
    }

    // Listen to messages in real-time
    static subscribeToMessages(
        chatId: string,
        callback: (messages: ChatMessage[]) => void
    ): () => void {
        callback([]);
        return () => {};
    }

    // Listen to all conversations for a user
    static subscribeToConversations(
        uid: string,
        callback: (convos: ChatConversation[]) => void
    ): () => void {
        callback([]);
        return () => {};
    }

    // Mark messages as read
    static async markAsRead(chatId: string, uid: string): Promise<void> {}
}
