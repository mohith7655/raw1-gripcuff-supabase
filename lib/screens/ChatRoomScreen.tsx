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
    Animated,
    PanResponder,
    Dimensions,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Send, CircleUserRound, Dumbbell, Swords, Trophy, Timer } from 'lucide-react-native';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { ChatService, getChatId } from '../services/chat.service';
import { ChatMessage } from '../models/Chat';
import { TierAvatar } from '../components/profile/TierAvatar';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { ChallengeSessionService, PreviousChallenge } from '../services/challengeSession.service';
import { NotificationService } from '../services/notification.service';
import { fetchAgoraToken } from '../services/agora/AgoraTokenService';
import { getProgramsByCategory } from '../data/preRecordedPrograms';

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
    // "+" action menu (invite to workout / challenge this friend).
    const [actionsOpen, setActionsOpen] = useState(false);
    const [challengeBusy, setChallengeBusy] = useState(false);
    // Past challenges played against THIS friend — shown as a history strip above
    // the messages so the two of you can see your head-to-head record.
    const [history, setHistory] = useState<PreviousChallenge[]>([]);
    const firstName = friendName?.split(' ')[0] || friendName;
    const listRef = useRef<FlatList>(null);

    const { sendInstantWorkout } = useWorkoutSession();

    // Instant co-workout — fire an immediate invite with a sensible default
    // workout (no scheduling). The sender's 30s waiting screen is owned by
    // WorkoutSessionContext; both users are pulled in on accept.
    const openWorkout = async () => {
        setActionsOpen(false);
        if (!supabaseUserId) return;
        const p = getProgramsByCategory('MuscleGrowth')[0];
        const v = p?.videos?.[0];
        if (!v) return;
        try {
            await sendInstantWorkout(friendUid, friendName, friendAvatar, v.id, `${p.title} - ${v.title}`);
        } catch (e) {
            console.warn('[Chat] instant workout failed', e);
        }
    };

    // Instant head-to-head challenge — create the session, notify the friend,
    // and jump straight into the room (no time picker). Defaults to a 1-min
    // Squats duel; the friend gets the accept popup via the App-level listener.
    const openChallenge = async () => {
        setActionsOpen(false);
        if (!supabaseUserId || challengeBusy) return;
        setChallengeBusy(true);
        const exerciseName = 'Squats';
        const durationSeconds = 60;
        try {
            const session = await ChallengeSessionService.create({
                hostId: supabaseUserId,
                guestId: friendUid,
                exerciseName,
                durationSeconds,
            });
            const token = await fetchAgoraToken(session.channelName, 0).catch(() => '');
            await NotificationService.insert({
                toUid: friendUid,
                fromUid: supabaseUserId,
                fromName: senderName,
                type: 'challenge_invite',
                title: '💪 Exercise Challenge!',
                body: `${senderName} challenged you to ${durationSeconds / 60} min of ${exerciseName}!`,
                sessionId: session.id,
            }).catch(() => {});
            navigation.navigate('ChallengeVideoRoom', {
                channelName: session.channelName,
                opponentName: friendName,
                opponentUid: friendUid,
                token,
                challengeSessionId: session.id,
                exerciseName,
                workoutDurationSecs: durationSeconds,
                isHost: true,
                myUid: supabaseUserId,
            });
        } catch (e) {
            console.warn('[Chat] instant challenge failed', e);
        } finally {
            setChallengeBusy(false);
        }
    };

    // Drag-down-to-close: the header/grabber acts as a drag handle.
    // (The message FlatList consumes its own vertical scroll, so we don't
    // rely on the native modal swipe gesture which only fires at the top.)
    const screenHeight = Dimensions.get('window').height;
    const translateY = useRef(new Animated.Value(0)).current;
    const dragResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) translateY.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                const shouldClose = g.dy > 120 || g.vy > 0.6;
                if (shouldClose) {
                    Animated.timing(translateY, {
                        toValue: screenHeight,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => navigation.goBack());
                } else {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 4,
                    }).start();
                }
            },
        })
    ).current;

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

    // Load the head-to-head challenge history with this friend. Refreshed on focus
    // so it updates after returning from a just-finished challenge.
    useFocusEffect(
        React.useCallback(() => {
            if (!supabaseUserId) return;
            let cancelled = false;
            ChallengeSessionService.loadPreviousForUser(supabaseUserId)
                .then((all) => {
                    if (cancelled) return;
                    setHistory(all.filter((c) => c.opponentUid === friendUid));
                })
                .catch((e) => console.warn('[Chat] challenge history load failed', e));
            return () => { cancelled = true; };
        }, [supabaseUserId, friendUid]),
    );

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

    const formatDuration = (secs: number): string => {
        if (secs >= 60) {
            const m = Math.round(secs / 60);
            return `${m} min`;
        }
        return `${secs}s`;
    };

    // Head-to-head challenge history strip, rendered above the messages.
    const renderHistory = () => {
        if (history.length === 0) return null;
        return (
            <View style={styles.historyWrap}>
                <Text style={styles.historyHeading}>Challenge history</Text>
                {history.map((c) => {
                    const d = new Date(c.createdAt);
                    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    const reps = c.feedback?.reps ?? null;
                    const winnerId = c.feedback?.winnerId ?? null;
                    const outcome = winnerId
                        ? (winnerId === supabaseUserId ? 'You won' : `${firstName} won`)
                        : null;
                    const iWon = winnerId === supabaseUserId;
                    return (
                        <View key={c.id} style={styles.histCard}>
                            <View style={styles.histIcon}>
                                <Swords size={18} color={AppTheme.primaryColor} />
                            </View>
                            <View style={styles.flex}>
                                <Text style={styles.histTitle}>{c.exerciseName} challenge</Text>
                                <View style={styles.histMetaRow}>
                                    <Text style={styles.histMeta}>{dateStr} · {timeStr}</Text>
                                    <View style={styles.histDot} />
                                    <Timer size={12} color={AppTheme.textGrey} />
                                    <Text style={styles.histMeta}>{formatDuration(c.durationSeconds)}</Text>
                                    {reps != null && (
                                        <>
                                            <View style={styles.histDot} />
                                            <Text style={styles.histMeta}>{reps} reps</Text>
                                        </>
                                    )}
                                </View>
                            </View>
                            {outcome && (
                                <View style={[styles.histBadge, iWon ? styles.histBadgeWin : styles.histBadgeLoss]}>
                                    {iWon && <Trophy size={12} color="#B8860B" />}
                                    <Text style={[styles.histBadgeText, iWon ? styles.histBadgeTextWin : styles.histBadgeTextLoss]}>
                                        {outcome}
                                    </Text>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        );
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
                        <View style={{ marginRight: 6 }}>
                            <TierAvatar
                                uri={friendAvatar}
                                size={28}
                                uid={friendUid}
                                name={friendName}
                                fallback={
                                    <View style={styles.bubbleAvatarFallback}>
                                        <CircleUserRound color={AppTheme.primaryColor} size={16} />
                                    </View>
                                }
                            />
                        </View>
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
        <Animated.View style={[styles.safeArea, { transform: [{ translateY }] }]}>
          <SafeAreaView style={styles.flex} edges={['top']}>
            {/* Drag handle — swipe down to close */}
            <View {...dragResponder.panHandlers}>
                <View style={styles.grabber} />

                {/* Header */}
                <View style={styles.header}>
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
                        <TierAvatar
                            uri={friendAvatar}
                            size={36}
                            uid={friendUid}
                            name={friendName}
                            showBadge={false}
                            fallback={
                                <View style={styles.headerAvatarFallback}>
                                    <CircleUserRound color={AppTheme.primaryColor} size={20} />
                                </View>
                            }
                        />
                        <Text style={styles.headerName} numberOfLines={1}>{friendName}</Text>
                    </TouchableOpacity>
                </View>
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
                        ListHeaderComponent={renderHistory()}
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
                    {/* Challenge / workout actions — right side, next to Send */}
                    <TouchableOpacity
                        style={styles.attachButton}
                        onPress={() => setActionsOpen(true)}
                        activeOpacity={0.7}
                    >
                        <Swords color={AppTheme.primaryColor} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!text.trim() || sending}
                        activeOpacity={0.7}
                    >
                        {sending ? (
                            <ActivityIndicator color="#211832" size="small" />
                        ) : (
                            <Send color="#211832" size={18} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* "+" action menu — invite this friend to a workout or a challenge */}
            <Modal
                visible={actionsOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setActionsOpen(false)}
            >
                <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setActionsOpen(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Train with {firstName}</Text>

                        <TouchableOpacity style={styles.sheetRow} activeOpacity={0.85} onPress={openWorkout}>
                            <View style={[styles.sheetIcon, { backgroundColor: 'rgba(22,163,74,0.12)' }]}>
                                <Dumbbell size={20} color="#16a34a" />
                            </View>
                            <View style={styles.flex}>
                                <Text style={styles.sheetRowTitle}>Workout together</Text>
                                <Text style={styles.sheetRowSub}>Start an instant co-workout with {firstName} now</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.sheetRow} activeOpacity={0.85} onPress={openChallenge} disabled={challengeBusy}>
                            <View style={[styles.sheetIcon, { backgroundColor: 'rgba(225,29,72,0.12)' }]}>
                                <Swords size={20} color="#E11D48" />
                            </View>
                            <View style={styles.flex}>
                                <Text style={styles.sheetRowTitle}>Challenge</Text>
                                <Text style={styles.sheetRowSub}>Instant Squats head-to-head — start now</Text>
                            </View>
                            {challengeBusy && <ActivityIndicator color="#E11D48" size="small" />}
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
          </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    flex: { flex: 1 },

    grabber: {
        alignSelf: 'center',
        width: 40,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(33,24,50,0.18)',
        marginTop: 8,
        marginBottom: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(33,24,50,0.05)',
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    headerAvatar: { width: 36, height: 36, borderRadius: 18 },
    headerAvatarFallback: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(242,89,18,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerName: { fontSize: FontSizes.body, fontWeight: FontWeights.bold as any, color: '#211832', maxWidth: 180 },

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
        backgroundColor: 'rgba(242,89,18,0.12)',
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
        borderColor: 'rgba(33,24,50,0.07)',
    },
    bubbleText: { fontSize: FontSizes.body, lineHeight: 20 },
    bubbleTextMe: { color: '#211832' },
    bubbleTextThem: { color: '#211832' },

    // Challenge history strip (chat header)
    historyWrap: { marginBottom: 14 },
    historyHeading: {
        color: AppTheme.textGrey,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 2,
    },
    histCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: AppTheme.cardColor,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.07)',
    },
    histIcon: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: 'rgba(242,89,18,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    histTitle: { color: '#211832', fontSize: 14.5, fontWeight: '700', textTransform: 'capitalize' },
    histMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
    histMeta: { color: AppTheme.textGrey, fontSize: 12 },
    histDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(33,24,50,0.25)' },
    histBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    },
    histBadgeWin: { backgroundColor: 'rgba(184,134,11,0.14)' },
    histBadgeLoss: { backgroundColor: 'rgba(33,24,50,0.06)' },
    histBadgeText: { fontSize: 11.5, fontWeight: '800' },
    histBadgeTextWin: { color: '#B8860B' },
    histBadgeTextLoss: { color: AppTheme.textGrey },

    emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyChatText: { color: AppTheme.textGrey, fontSize: FontSizes.body },

    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(33,24,50,0.06)',
        backgroundColor: AppTheme.background,
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: AppTheme.cardColor,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: '#211832',
        fontSize: FontSizes.body,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.07)',
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
        backgroundColor: 'rgba(242,89,18,0.35)',
    },
    attachButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(242,89,18,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // "+" action sheet
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingHorizontal: 18,
        paddingTop: 10,
        paddingBottom: 28,
    },
    sheetHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D8D8E4', marginBottom: 12 },
    sheetTitle: { color: '#211832', fontSize: 16, fontWeight: '800', marginBottom: 8 },
    sheetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(33,24,50,0.06)',
    },
    sheetIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    sheetRowTitle: { color: '#211832', fontSize: 15, fontWeight: '700' },
    sheetRowSub: { color: AppTheme.textGrey, fontSize: 12.5, marginTop: 2 },
});
