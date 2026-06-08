import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MessageCircle } from 'lucide-react-native';
import { TierAvatar } from '../profile/TierAvatar';
import { useFriend } from '../../providers/FriendContext';
import { useAuth } from '../../providers/AuthContext';
import { ChatService, getChatId } from '../../services/chat.service';
import { ChatConversation } from '../../models/Chat';
import { User } from '../../models/User';

const ORANGE = '#E89951';
const MUTED = '#94A3B8';

/** Conversation list for the Social → Chat tab. Friends ordered by recency. */
export function ChatHub() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { friends } = useFriend();
    const [conversations, setConversations] = useState<ChatConversation[]>([]);

    useEffect(() => {
        if (!user?.uid) return;
        const unsub = ChatService.subscribeToConversations(user.uid, setConversations);
        return unsub;
    }, [user?.uid]);

    const convoMap = useMemo(() => {
        const m = new Map<string, ChatConversation>();
        conversations.forEach((c) => m.set(c.id, c));
        return m;
    }, [conversations]);

    const formatTime = (ts: any): string => {
        if (!ts) return '';
        const date: Date = ts?.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(date.getTime())) return '';
        const isToday = date.toDateString() === new Date().toDateString();
        return isToday
            ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Sort friends by last message time (most recent first).
    const ordered = useMemo(() => {
        if (!user?.uid) return friends;
        const ts = (f: User) => {
            const c = convoMap.get(getChatId(user.uid, f.uid));
            const d = c?.lastMessageAt ? ((c.lastMessageAt as any).toDate?.() ?? new Date(c.lastMessageAt as any)) : null;
            return d ? d.getTime() : 0;
        };
        return [...friends].sort((a, b) => ts(b) - ts(a));
    }, [friends, convoMap, user?.uid]);

    const renderItem = ({ item: friend }: { item: User }) => {
        const convo = user ? convoMap.get(getChatId(user.uid, friend.uid)) : undefined;
        const unread = user ? (convo?.unreadCount?.[user.uid] ?? 0) : 0;
        return (
            <TouchableOpacity
                style={s.row}
                activeOpacity={0.8}
                onPress={() =>
                    navigation.navigate('ChatRoom', {
                        friendUid: friend.uid,
                        friendName: friend.fullName || friend.username,
                        friendAvatar: friend.profileImageUrl,
                    })
                }
            >
                <TierAvatar uri={friend.profileImageUrl} size={50} uid={friend.uid} name={friend.fullName || friend.username} radius={12} disableProfileLink />
                <View style={s.info}>
                    <View style={s.topLine}>
                        <Text style={s.name} numberOfLines={1}>{friend.fullName || friend.username}</Text>
                        {convo?.lastMessageAt ? <Text style={s.time}>{formatTime(convo.lastMessageAt)}</Text> : null}
                    </View>
                    <View style={s.bottomLine}>
                        <Text style={[s.preview, unread > 0 && s.previewUnread]} numberOfLines={1}>
                            {convo?.lastMessage || 'Say hi 👋'}
                        </Text>
                        {unread > 0 && (
                            <View style={s.badge}>
                                <Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (friends.length === 0) {
        return (
            <View style={s.empty}>
                <MessageCircle color={ORANGE} size={34} />
                <Text style={s.emptyTitle}>No conversations yet</Text>
                <Text style={s.emptySub}>Add friends to start chatting.</Text>
            </View>
        );
    }

    return (
        <FlatList
            data={ordered}
            keyExtractor={(f) => f.uid}
            renderItem={renderItem}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
        />
    );
}

const s = StyleSheet.create({
    list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#0f1923',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    info: { flex: 1 },
    topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    name: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
    time: { color: MUTED, fontSize: 11 },
    bottomLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 },
    preview: { color: MUTED, fontSize: 13, flex: 1 },
    previewUnread: { color: '#fff', fontWeight: '600' },
    badge: {
        backgroundColor: ORANGE,
        borderRadius: 11,
        minWidth: 22,
        height: 22,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    empty: { alignItems: 'center', gap: 10, paddingTop: 70, paddingHorizontal: 40 },
    emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
    emptySub: { color: MUTED, fontSize: 13, textAlign: 'center' },
});
