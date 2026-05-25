import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { Check, CircleUserRound, X, PlayCircle, Clock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useFriend } from '../providers/FriendContext';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { SessionService } from '../services/session.service';
import type { User } from '../models/User';

const ACCENT = '#FF6B00';
const WAIT_SECONDS = 60;

interface Props {
    visible: boolean;
    videoId: string;
    videoTitle: string;
    category?: string;
    programName?: string;
    thumbnail?: string;
    onClose: () => void;
}

type Screen = 'select' | 'sending' | 'waiting' | 'accepted' | 'declined' | 'timeout';

export function VideoInviteModal({ visible, videoId, videoTitle, category, programName, thumbnail, onClose }: Props) {
    const navigation = useNavigation<any>();
    const { friends } = useFriend();
    const { cancelSession, expireSession } = useWorkoutSession();
    const { supabaseUserId } = useAuth();
    const { profile } = useUser();

    const [screen, setScreen] = useState<Screen>('select');
    const [selected, setSelected] = useState<User | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(WAIT_SECONDS);
    const [sendError, setSendError] = useState<string | null>(null);

    const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
    const sessionUnsubRef = useRef<(() => void) | null>(null);
    const mountedRef      = useRef(true);
    const agoraChannelRef = useRef<string>('');

    // ── Cleanup on unmount ──
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            clearInterval(countdownRef.current!);
            sessionUnsubRef.current?.();
        };
    }, []);

    // ── Reset when modal closes ──
    useEffect(() => {
        if (!visible) {
            clearInterval(countdownRef.current!);
            sessionUnsubRef.current?.();
            sessionUnsubRef.current = null;
            setScreen('select');
            setSelected(null);
            setSessionId(null);
            setCountdown(WAIT_SECONDS);
            setSendError(null);
            agoraChannelRef.current = '';
        }
    }, [visible]);

    // ── Realtime session status + countdown while waiting ──
    useEffect(() => {
        if (screen !== 'waiting' || !sessionId) return;

        // Countdown — expire if no response in WAIT_SECONDS
        setCountdown(WAIT_SECONDS);
        countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current!);
                    if (mountedRef.current) {
                        SessionService.declineSession(sessionId).catch(() => {});
                        expireSession(sessionId).catch(() => {});
                        setScreen('timeout');
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Supabase realtime — watch for the guest accepting (status → 'active')
        sessionUnsubRef.current = SessionService.subscribeToSessionStatus(
            sessionId,
            (status, row) => {
                if (!mountedRef.current) return;
                if (status === 'active') {
                    clearInterval(countdownRef.current!);
                    setScreen('accepted');
                    // Give the accepted animation a moment, then navigate
                    setTimeout(() => {
                        if (!mountedRef.current) return;
                        onClose();
                        navigation.navigate('VideoPlayerScreen', {
                            videoId: row.workout_id,
                            allowInvite: true,
                            coWorkoutChannel: row.agora_channel,
                        });
                    }, 1400);
                } else if (status === 'cancelled' || status === 'declined') {
                    clearInterval(countdownRef.current!);
                    setScreen('declined');
                }
            },
        );

        return () => {
            clearInterval(countdownRef.current!);
            sessionUnsubRef.current?.();
            sessionUnsubRef.current = null;
        };
    }, [screen, sessionId]);

    const handleSelectFriend = async (friend: User) => {
        if (!supabaseUserId) return;
        setSelected(friend);
        setSendError(null);
        setScreen('sending');
        try {
            const hostName = profile?.fullName || profile?.username || 'Your friend';
            const { sessionId: sid, agoraChannel } = await SessionService.createCoWorkoutSession(
                supabaseUserId,
                hostName,
                friend.uid,
                videoId,
                videoTitle,
            );
            if (!mountedRef.current) return;
            agoraChannelRef.current = agoraChannel;
            setSessionId(sid);
            setScreen('waiting');
        } catch (e: any) {
            if (!mountedRef.current) return;
            const msg = e?.message ?? 'Could not send invite. Please try again.';
            console.error('[VideoInviteModal] createCoWorkoutSession failed:', msg);
            setSendError(msg);
            setScreen('select');
        }
    };

    const handleCancel = () => {
        if (sessionId) {
            SessionService.declineSession(sessionId).catch(() => {});
            cancelSession(sessionId).catch(() => {});
        }
        onClose();
    };

    const progressAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (screen !== 'waiting') return;
        progressAnim.setValue(1);
        Animated.timing(progressAnim, {
            toValue: 0,
            duration: WAIT_SECONDS * 1000,
            useNativeDriver: false,
        }).start();
    }, [screen]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
            <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={screen === 'select' ? handleCancel : undefined} />

            <View style={s.sheet}>
                <View style={s.handle} />

                {/* ── SELECT FRIEND ── */}
                {screen === 'select' && (
                    <>
                        <View style={s.header}>
                            <Text style={s.title}>Invite a Friend</Text>
                            <TouchableOpacity onPress={handleCancel} style={s.closeBtn}>
                                <X color="#aaa" size={20} />
                            </TouchableOpacity>
                        </View>

                        <View style={s.videoBanner}>
                            <PlayCircle color={ACCENT} size={16} />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                {(category || programName) ? (
                                    <Text style={s.videoBannerMeta} numberOfLines={1}>
                                        {[category, programName].filter(Boolean).join(' · ')}
                                    </Text>
                                ) : null}
                                <Text style={s.videoBannerText} numberOfLines={1}>{videoTitle}</Text>
                            </View>
                        </View>

                        <Text style={s.sectionLabel}>Tap a friend to invite them now</Text>

                        {sendError ? (
                            <View style={s.errorBanner}>
                                <Text style={s.errorText}>{sendError}</Text>
                            </View>
                        ) : null}

                        {friends.length === 0 ? (
                            <View style={s.empty}>
                                <Text style={s.emptyText}>No friends yet. Add some first!</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={friends}
                                keyExtractor={(f) => f.uid}
                                style={s.list}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={s.friendRow}
                                        onPress={() => handleSelectFriend(item)}
                                        activeOpacity={0.75}
                                    >
                                        {item.profileImageUrl ? (
                                            <Image key={item.profileImageUrl} source={{ uri: item.profileImageUrl }} style={s.avatar} />
                                        ) : (
                                            <CircleUserRound color={ACCENT} size={38} />
                                        )}
                                        <View style={s.friendInfo}>
                                            <Text style={s.friendName}>{item.fullName || item.username}</Text>
                                            <Text style={s.friendUsername}>@{item.username}</Text>
                                        </View>
                                        <View style={s.inviteNowChip}>
                                            <Text style={s.inviteNowText}>Invite Now</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </>
                )}

                {/* ── SENDING ── */}
                {screen === 'sending' && (
                    <View style={s.centeredContent}>
                        <ActivityIndicator color={ACCENT} size="large" />
                        <Text style={s.waitTitle}>Sending invite…</Text>
                    </View>
                )}

                {/* ── WAITING ── */}
                {screen === 'waiting' && (
                    <View style={s.centeredContent}>
                        <TouchableOpacity style={s.topClose} onPress={handleCancel}>
                            <X color="#aaa" size={20} />
                        </TouchableOpacity>

                        {/* Avatar */}
                        {selected?.profileImageUrl ? (
                            <Image key={selected.profileImageUrl} source={{ uri: selected.profileImageUrl }} style={s.waitAvatar} />
                        ) : (
                            <View style={s.waitAvatarPlaceholder}>
                                <Text style={s.waitAvatarInitial}>
                                    {(selected?.fullName ?? selected?.username ?? '?').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}

                        <Text style={s.waitTitle}>Waiting for</Text>
                        <Text style={s.waitName}>{selected?.fullName ?? selected?.username}</Text>
                        <Text style={s.waitSub}>to accept your invite</Text>

                        {/* Countdown bar */}
                        <View style={s.countdownBarBg}>
                            <Animated.View
                                style={[
                                    s.countdownBarFill,
                                    {
                                        width: progressAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0%', '100%'],
                                        }),
                                    },
                                ]}
                            />
                        </View>
                        <View style={s.countdownRow}>
                            <Clock color="#6B7280" size={13} />
                            <Text style={s.countdownText}>{countdown}s remaining</Text>
                        </View>

                        <TouchableOpacity style={s.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
                            <Text style={s.cancelBtnText}>Cancel Invite</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── ACCEPTED ── */}
                {screen === 'accepted' && (
                    <View style={s.centeredContent}>
                        <View style={[s.resultIcon, { backgroundColor: '#10B981' }]}>
                            <Check color="white" size={32} />
                        </View>
                        <Text style={s.waitTitle}>{selected?.fullName ?? 'Friend'} accepted!</Text>
                        <Text style={s.waitSub}>Starting workout together…</Text>
                        <ActivityIndicator color={ACCENT} style={{ marginTop: 16 }} />
                    </View>
                )}

                {/* ── DECLINED ── */}
                {screen === 'declined' && (
                    <View style={s.centeredContent}>
                        <View style={[s.resultIcon, { backgroundColor: '#EF4444' }]}>
                            <X color="white" size={32} />
                        </View>
                        <Text style={s.waitTitle}>{selected?.fullName ?? 'Friend'} declined</Text>
                        <Text style={s.waitSub}>Maybe next time!</Text>
                        <TouchableOpacity style={s.sendBtn} onPress={onClose} activeOpacity={0.85}>
                            <Text style={s.sendBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── TIMEOUT ── */}
                {screen === 'timeout' && (
                    <View style={s.centeredContent}>
                        <View style={[s.resultIcon, { backgroundColor: '#6B7280' }]}>
                            <Clock color="white" size={32} />
                        </View>
                        <Text style={s.waitTitle}>No response</Text>
                        <Text style={s.waitSub}>{selected?.fullName ?? 'Friend'} didn't respond in time.</Text>
                        <TouchableOpacity style={s.sendBtn} onPress={onClose} activeOpacity={0.85}>
                            <Text style={s.sendBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        backgroundColor: '#0f1923',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: 36,
        minHeight: 360,
        maxHeight: '80%',
    },
    handle: {
        width: 40, height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10, marginBottom: 4,
    },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    title: { color: 'white', fontSize: 17, fontWeight: '700' },
    closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    topClose: {
        position: 'absolute', top: 0, right: 0,
        width: 36, height: 36,
        alignItems: 'center', justifyContent: 'center',
    },
    videoBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(255,107,0,0.1)',
        borderWidth: 1, borderColor: 'rgba(255,107,0,0.25)',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        marginBottom: 16,
    },
    videoBannerMeta: { color: 'rgba(255,107,0,0.65)', fontSize: 10, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 1 },
    videoBannerText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
    sectionLabel: {
        color: '#aaa', fontSize: 12,
        textTransform: 'uppercase', letterSpacing: 0.5,
        marginBottom: 8,
    },
    list: { maxHeight: 280 },
    friendRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: 12, marginBottom: 8,
        backgroundColor: '#1a2530',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    },
    avatar: { width: 38, height: 38, borderRadius: 19 },
    friendInfo: { flex: 1, marginLeft: 12 },
    friendName: { color: 'white', fontSize: 14, fontWeight: '600' },
    friendUsername: { color: '#888', fontSize: 12, marginTop: 1 },
    inviteNowChip: {
        backgroundColor: ACCENT,
        borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5,
    },
    inviteNowText: { color: 'white', fontSize: 12, fontWeight: '700' },
    empty: { paddingVertical: 32, alignItems: 'center' },
    emptyText: { color: '#666', fontSize: 14, textAlign: 'center' },
    errorBanner: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
        paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
    },
    errorText: { color: '#F87171', fontSize: 13, textAlign: 'center' },
    // Centered states
    centeredContent: {
        alignItems: 'center', paddingTop: 28, paddingBottom: 8,
        position: 'relative',
    },
    waitAvatar: {
        width: 72, height: 72, borderRadius: 36,
        borderWidth: 3, borderColor: ACCENT,
        marginBottom: 16,
    },
    waitAvatarPlaceholder: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: 'rgba(255,107,0,0.2)',
        borderWidth: 3, borderColor: ACCENT,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
    },
    waitAvatarInitial: { color: ACCENT, fontSize: 30, fontWeight: '700' },
    waitTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
    waitName: { color: ACCENT, fontSize: 20, fontWeight: '800', marginBottom: 4 },
    waitSub: { color: '#9CA3AF', fontSize: 14, marginBottom: 20, textAlign: 'center' },
    countdownBarBg: {
        width: '100%', height: 6, backgroundColor: '#1e2d3d',
        borderRadius: 3, overflow: 'hidden', marginBottom: 8,
    },
    countdownBarFill: {
        height: 6, backgroundColor: ACCENT, borderRadius: 3,
    },
    countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 24 },
    countdownText: { color: '#6B7280', fontSize: 13 },
    cancelBtn: {
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28,
    },
    cancelBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
    resultIcon: {
        width: 72, height: 72, borderRadius: 36,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
    },
    sendBtn: {
        backgroundColor: ACCENT, borderRadius: 14,
        paddingVertical: 14, paddingHorizontal: 40,
        alignItems: 'center', justifyContent: 'center',
        marginTop: 20,
    },
    sendBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
});
