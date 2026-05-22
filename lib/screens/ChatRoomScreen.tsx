import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Send, CircleUserRound } from 'lucide-react-native';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { ChatService, getChatId } from '../services/chat.service';
import { ChatMessage } from '../models/Chat';

type RouteParams = {
    friendUid: string;
    friendName: string;
    friendAvatar?: string;
};

export const ChatRoomScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { friendUid, friendName, friendAvatar } = route.params as RouteParams;

    const { supabaseUserId } = useAuth();
    const { profile } = useUser();
    const senderName = profile?.username || profile?.fullName || 'Someone';
    const chatId = getChatId(supabaseUserId ?? 'unknown', friendUid);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [ready, setReady] = useState(false);
    const listRef = useRef<FlatList>(null);

    // Ensure conversation doc exists
    useEffect(() => {
        if (!supabaseUserId) return;
        ChatService.getOrCreateConversation(supabaseUserId, friendUid).then(() => setReady(true));
    }, [supabaseUserId, friendUid]);

    // Subscribe to messages
    useEffect(() => {
        if (!ready) return;
        const unsub = ChatService.subscribeToMessages(chatId, (msgs) => {
            setMessages(msgs);
            // Auto-scroll to bottom
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        });
        return unsub;
    }, [chatId, ready]);

    // Mark as read when entering room
    useEffect(() => {
        if (ready && supabaseUserId) {
            ChatService.markAsRead(chatId, supabaseUserId);
        }
    }, [chatId, ready, supabaseUserId]);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        if (!supabaseUserId) return;
        const uid = supabaseUserId;
        const msg = text.trim();
        setText('');
        setSending(true);
        try {
            const sent = await ChatService.sendMessage(chatId, uid, friendUid, msg, senderName);
            // Optimistic: append the confirmed message immediately.
            // subscribeToMessages deduplicates by ID so the realtime event won't double-render.
            if (sent) {
                setMessages(prev => {
                    const alreadyIn = prev.some(m => m.id === sent.id);
                    return alreadyIn ? prev : [...prev, sent];
                });
                setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
            }
        } catch (e) {
            console.warn('Failed to send message:', e);
            setText(msg); // restore text so user can retry
        } finally {
            setSending(false);
        }
    };

    const formatTime = (ts: any): string => {
        if (!ts) return '';
        const date: Date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
        const isMe = item.senderId === supabaseUserId;
        const prevMsg = messages[index - 1];
        const showTimestamp =
            !prevMsg ||
            (item.createdAt &&
                prevMsg.createdAt &&
                item.createdAt.getTime() - prevMsg.createdAt.getTime() > 5 * 60 * 1000);

        return (
            <View>
                {showTimestamp && item.createdAt && (
                    <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
                )}
                <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
                    {!isMe && (
                        friendAvatar ? (
                            <Image source={{ uri: friendAvatar }} style={styles.bubbleAvatar} />
                        ) : (
                            <View style={styles.bubbleAvatarFallback}>
                                <CircleUserRound color={AppTheme.primaryColor} size={16} />
                            </View>
                        )
                    )}
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                            {item.text}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerCenter}
                    activeOpacity={0.75}
                    onPress={() =>
                        navigation.navigate('ChatFriendProfile', {
                            friendUid,
                            friendName,
                            friendAvatar,
                        })
                    }
                >
                    {friendAvatar ? (
                        <Image source={{ uri: friendAvatar }} style={styles.headerAvatar} />
                    ) : (
                        <View style={styles.headerAvatarFallback}>
                            <CircleUserRound color={AppTheme.primaryColor} size={20} />
                        </View>
                    )}
                    <Text style={styles.headerName} numberOfLines={1}>{friendName}</Text>
                </TouchableOpacity>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                {!ready ? (
                    <View style={styles.centered}>
                        <ActivityIndicator color={AppTheme.primaryColor} size="large" />
                    </View>
                ) : (
                    <FlatList
                        ref={listRef}
                        data={messages}
                        keyExtractor={(m) => m.id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.messagesContent}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                        ListEmptyComponent={
                            <View style={styles.emptyChat}>
                                <Text style={styles.emptyChatText}>No messages yet. Say hi!</Text>
                            </View>
                        }
                    />
                )}

                {/* Input Bar */}
                <View style={styles.inputBar}>
                    <TextInput
                        style={styles.input}
                        value={text}
                        onChangeText={setText}
                        placeholder="Message..."
                        placeholderTextColor={AppTheme.textGrey}
                        multiline
                        maxLength={1000}
                        returnKeyType="default"
                        onSubmitEditing={handleSend}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!text.trim() || sending}
                        activeOpacity={0.7}
                    >
                        {sending ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Send color="#fff" size={18} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppTheme.background },
    flex: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    headerAvatar: { width: 36, height: 36, borderRadius: 18 },
    headerAvatarFallback: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,107,0,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerName: { fontSize: FontSizes.body, fontWeight: FontWeights.bold as any, color: '#fff', maxWidth: 180 },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    messagesContent: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },

    timestamp: {
        color: AppTheme.textGrey,
        fontSize: 11,
        textAlign: 'center',
        marginVertical: 8,
    },

    bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 2 },
    bubbleRowMe: { justifyContent: 'flex-end' },
    bubbleRowThem: { justifyContent: 'flex-start' },

    bubbleAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 6 },
    bubbleAvatarFallback: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,107,0,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },

    bubble: {
        maxWidth: '72%',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 18,
    },
    bubbleMe: {
        backgroundColor: AppTheme.primaryColor,
        borderBottomRightRadius: 4,
    },
    bubbleThem: {
        backgroundColor: AppTheme.cardColor,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    bubbleText: { fontSize: FontSizes.body, lineHeight: 20 },
    bubbleTextMe: { color: '#fff' },
    bubbleTextThem: { color: '#fff' },

    emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyChatText: { color: AppTheme.textGrey, fontSize: FontSizes.body },

    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        backgroundColor: AppTheme.background,
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: AppTheme.cardColor,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: '#fff',
        fontSize: FontSizes.body,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: AppTheme.primaryColor,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: 'rgba(255,107,0,0.35)',
    },
});
