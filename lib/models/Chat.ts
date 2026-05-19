import { Timestamp } from 'firebase/firestore';

export interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    createdAt: Timestamp;
    read: boolean;
}

export interface ChatConversation {
    id: string; // "{uid1}_{uid2}" sorted alphabetically
    participants: string[];
    lastMessage: string;
    lastMessageAt: Timestamp | null;
    lastMessageBy: string;
    unreadCount: { [uid: string]: number };
}
