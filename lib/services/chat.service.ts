import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    where,
    increment,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';
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
        const ref = doc(db, 'chatRooms', chatId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return { id: chatId, ...snap.data() } as ChatConversation;
        }
        const data: Omit<ChatConversation, 'id'> = {
            participants: [uid1, uid2],
            lastMessage: '',
            lastMessageAt: null,
            lastMessageBy: '',
            unreadCount: { [uid1]: 0, [uid2]: 0 },
        };
        await setDoc(ref, data);
        return { id: chatId, ...data };
    }

    // Send a message and create a unified in-app notification
    static async sendMessage(
        chatId: string,
        senderId: string,
        recipientId: string,
        text: string
    ): Promise<void> {
        const trimmed = text.trim();
        const messagesRef = collection(db, 'chatRooms', chatId, 'messages');
        const messageRef = await addDoc(messagesRef, {
            text: trimmed,
            senderId,
            createdAt: serverTimestamp(),
            read: false,
        });

        const senderSnap = await getDoc(doc(db, 'users', senderId));
        const senderData = senderSnap.exists() ? (senderSnap.data() as Record<string, any>) : {};
        const senderName =
            senderData.fullName ||
            senderData.displayName ||
            senderData.username ||
            senderData.email ||
            'Someone';
        const senderAvatar = senderData.profileImageUrl || senderData.avatar || null;

        await addDoc(collection(db, 'notifications'), {
            toUid: recipientId,
            fromUid: senderId,
            fromName: senderName,
            avatar: senderAvatar,
            type: 'chat_message',
            title: senderName,
            body: trimmed || 'You have a new message',
            chatId,
            messageId: messageRef.id,
            read: false,
            createdAt: serverTimestamp(),
        });

        // Dual-write: Supabase is source of truth for notification reads/listeners.
        NotificationService.insert({
            toUid: recipientId,
            fromUid: senderId,
            fromName: senderName,
            avatar: senderAvatar,
            type: 'chat_message',
            title: senderName,
            body: trimmed || 'You have a new message',
            chatId,
            messageId: messageRef.id,
        }).catch((e) => console.warn('[ChatService] Supabase notification write failed:', e));

        const chatRef = doc(db, 'chatRooms', chatId);
        await updateDoc(chatRef, {
            lastMessage: trimmed,
            lastMessageAt: serverTimestamp(),
            lastMessageBy: senderId,
            [`unreadCount.${recipientId}`]: increment(1),
        });
    }

    // Listen to messages in real-time
    static subscribeToMessages(
        chatId: string,
        callback: (messages: ChatMessage[]) => void
    ): () => void {
        const ref = collection(db, 'chatRooms', chatId, 'messages');
        const q = query(ref, orderBy('createdAt', 'asc'));
        return onSnapshot(q, (snap) => {
            const msgs: ChatMessage[] = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as ChatMessage[];
            callback(msgs);
        });
    }

    // Listen to all conversations for a user
    static subscribeToConversations(
        uid: string,
        callback: (convos: ChatConversation[]) => void
    ): () => void {
        const ref = collection(db, 'chatRooms');
        const q = query(ref, where('participants', 'array-contains', uid));
        return onSnapshot(q, (snap) => {
            const convos: ChatConversation[] = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }) as ChatConversation)
                .sort((a, b) => {
                    const aTime = a.lastMessageAt?.toMillis() ?? 0;
                    const bTime = b.lastMessageAt?.toMillis() ?? 0;
                    return bTime - aTime;
                });
            callback(convos);
        });
    }

    // Mark messages as read
    static async markAsRead(chatId: string, uid: string): Promise<void> {
        const chatRef = doc(db, 'chatRooms', chatId);
        await updateDoc(chatRef, {
            [`unreadCount.${uid}`]: 0,
        });
    }
}
