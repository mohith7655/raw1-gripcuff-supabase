import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, CircleUserRound, MessageCircle } from 'lucide-react-native';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { useFriend } from '../providers/FriendContext';
import { useAuth } from '../providers/AuthContext';
import { ChatService, getChatId } from '../services/chat.service';
import { ChatConversation } from '../models/Chat';
import { User } from '../models/User';

export const ChatInboxScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { friends, loading: friendsLoading } = useFriend();

    const [conversations, setConversations] = useState<ChatConversation[]>([]);

    // Subscribe to all conversations for this user (conversations load in background)
    useEffect(() => {
        if (!user?.uid) return;
        const unsub = ChatService.subscribeToConversations(user.uid, (convos) => {
            setConversations(convos);
        });
        return unsub;
    }, [user?.uid]);

    // Build a map of chatId → conversation for quick lookup
    const convoMap = new Map<string, ChatConversation>();
    conversations.forEach((c) => convoMap.set(c.id, c));

    const formatTime = (ts: any): string => {
        if (!ts) return '';
        const date: Date = ts.toDate ? ts.toDate() : new Date(ts);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const renderFriend = ({ item: friend }: { item: User }) => {
        const chatId = getChatId(user!.uid, friend.uid);
        const convo = convoMap.get(chatId);
        const unread = convo?.unreadCount?.[user!.uid] ?? 0;

        return (
            <View style={styles.row}>
                <TouchableOpacity
                    style={styles.profileTapArea}
                    activeOpacity={0.75}
                    onPress={() =>
                        navigation.navigate('ChatFriendProfile', {
                            friendUid: friend.uid,
                            friendName: friend.fullName || friend.username,
                            friendAvatar: friend.profileImageUrl,
                        })
                    }
                >
                    {friend.profileImageUrl ? (
                        <Image key={friend.profileImageUrl} source={{ uri: friend.profileImageUrl }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarFallback}>
                            <CircleUserRound color={AppTheme.primaryColor} size={24} />
                        </View>
                    )}
                    <Text style={styles.friendName} numberOfLines={1}>
                        {friend.fullName || friend.username}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.rowContent}
                    activeOpacity={0.7}
                    onPress={() =>
                        navigation.navigate('ChatRoom', {
                            friendUid: friend.uid,
                            friendName: friend.fullName || friend.username,
                            friendAvatar: friend.profileImageUrl,
                        })
                    }
                >
                    <View style={styles.rowTop}>
                        <View />
                        {convo?.lastMessageAt && (
                            <Text style={styles.timeText}>{formatTime(convo.lastMessageAt)}</Text>
                        )}
                    </View>
                    <View style={styles.rowBottom}>
                        <Text style={[styles.lastMessage, unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                            {convo?.lastMessage || 'Say hi!'}
                        </Text>
                        {unread > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{unread}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const loading = friendsLoading;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Messages</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={AppTheme.primaryColor} size="large" />
                </View>
            ) : friends.length === 0 ? (
                <View style={styles.centered}>
                    <MessageCircle color={AppTheme.textGrey} size={48} />
                    <Text style={styles.emptyTitle}>No friends yet</Text>
                    <Text style={styles.emptySubtitle}>Add friends to start chatting</Text>
                </View>
            ) : (
                <FlatList
                    data={friends}
                    keyExtractor={(f) => f.uid}
                    renderItem={renderFriend}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppTheme.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyTitle: { color: '#fff', fontSize: FontSizes.h3, fontWeight: FontWeights.bold as any },
    emptySubtitle: { color: AppTheme.textGrey, fontSize: FontSizes.body },
    listContent: { paddingVertical: 8 },
    separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginLeft: 84 },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    profileTapArea: {
        width: 130,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginRight: 10,
    },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    avatarFallback: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,107,0,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowContent: { flex: 1 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    friendName: { fontSize: FontSizes.body, fontWeight: FontWeights.bold as any, color: '#fff', flex: 1, marginRight: 8 },
    timeText: { fontSize: 12, color: AppTheme.textGrey },
    rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    lastMessage: { fontSize: FontSizes.small, color: AppTheme.textGrey, flex: 1, marginRight: 8 },
    lastMessageUnread: { color: '#fff', fontWeight: '600' },
    unreadBadge: {
        backgroundColor: AppTheme.primaryColor,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
});
