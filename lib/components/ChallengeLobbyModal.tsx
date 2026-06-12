/**
 * ChallengeLobbyModal — an open, public "waiting for challengers" room.
 *
 * Everyone who opens this modal joins a shared Supabase Realtime *presence*
 * channel ('challenge-lobby'). All present users see each other live —
 * regardless of friendship or profile privacy — and can tap anyone to start
 * an exercise challenge (reuses ChallengeSession → ChallengeVideoRoom flow).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, ScrollView, ActivityIndicator, Image, Animated, Easing,
} from 'react-native';
import { X, Zap, CircleUserRound } from 'lucide-react-native';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { ChallengeSessionService } from '../services/challengeSession.service';
import { NotificationService } from '../services/notification.service';
import { fetchAgoraToken } from '../services/agora/AgoraTokenService';
import { TierBars } from './profile/TierBars';
import { TierAvatar } from './profile/TierAvatar';

const ACCENT = '#4C4E78';
const CTA    = '#4C4E78';
const BG     = '#EEEEF2';
const CARD   = '#F8F8FC';

const LOBBY_CHANNEL = 'challenge-lobby';

interface LobbyMember {
    uid: string;
    name: string;
    avatar?: string | null;
    accessType?: string | null;
    exercise: string;
    duration: number;
    joinedAt: number;
}

interface Props {
    visible: boolean;
    exerciseName: string;
    workoutDurationSecs: number;
    onClose: () => void;
    onChallengeStarted: (params: {
        challengeSessionId: string;
        channelName: string;
        token: string;
        opponentName: string;
        opponentUid: string;
        exerciseName: string;
        workoutDurationSecs: number;
        isHost: boolean;
    }) => void;
}

export function ChallengeLobbyModal({
    visible, exerciseName, workoutDurationSecs, onClose, onChallengeStarted,
}: Props) {
    const { user: authUser, supabaseUserId } = useAuth() as any;
    const { profile } = useUser();

    const [members, setMembers] = useState<LobbyMember[]>([]);
    const [loadingUid, setLoadingUid] = useState<string | null>(null);
    const [incoming, setIncoming] = useState<{
        sessionId: string; channelName: string; hostUid: string;
        hostName: string; exerciseName: string; workoutDurationSecs: number;
    } | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const selfName =
        profile?.fullName || profile?.username ||
        authUser?.displayName || authUser?.email?.split('@')[0] || 'Athlete';
    const selfNameRef = useRef(selfName);
    selfNameRef.current = selfName;

    // Pulsing "waiting" dot
    const pulse = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!visible) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [visible, pulse]);

    // ── Join / leave the presence lobby ────────────────────────────────────────
    useEffect(() => {
        if (!visible || !supabaseUserId) return;

        const channel = supabase.channel(LOBBY_CHANNEL, {
            config: { presence: { key: supabaseUserId } },
        });
        channelRef.current = channel;

        const syncMembers = () => {
            const state = channel.presenceState() as Record<string, any[]>;
            const list: LobbyMember[] = [];
            Object.values(state).forEach((entries) => {
                const m = entries[0]; // latest meta for this presence key
                if (m?.uid) {
                    list.push({
                        uid: m.uid,
                        name: m.name ?? 'Athlete',
                        avatar: m.avatar ?? null,
                        accessType: m.accessType ?? null,
                        exercise: m.exercise ?? exerciseName,
                        duration: m.duration ?? workoutDurationSecs,
                        joinedAt: m.joinedAt ?? 0,
                    });
                }
            });
            list.sort((a, b) => a.joinedAt - b.joinedAt);
            setMembers(list);
        };

        channel
            .on('presence', { event: 'sync' }, syncMembers)
            .on('presence', { event: 'join' }, syncMembers)
            .on('presence', { event: 'leave' }, syncMembers)
            // Direct invite over the same channel — instant, no DB-publication dependency
            .on('broadcast', { event: 'challenge' }, ({ payload }) => {
                if (!payload || payload.guestUid !== supabaseUserId) return;
                setIncoming({
                    sessionId: payload.sessionId,
                    channelName: payload.channelName,
                    hostUid: payload.hostUid,
                    hostName: payload.hostName ?? 'Challenger',
                    exerciseName: payload.exerciseName ?? exerciseName,
                    workoutDurationSecs: payload.workoutDurationSecs ?? workoutDurationSecs,
                });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        uid: supabaseUserId,
                        name: selfNameRef.current,
                        avatar: profile?.profileImageUrl ?? null,
                        accessType: profile?.accessType ?? null,
                        exercise: exerciseName,
                        duration: workoutDurationSecs,
                        joinedAt: Date.now(),
                    });
                }
            });

        return () => {
            channel.untrack().catch(() => {});
            supabase.removeChannel(channel);
            channelRef.current = null;
            setMembers([]);
        };
        // exerciseName/duration captured at open; re-track not needed mid-session
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, supabaseUserId]);

    const handleChallenge = async (member: LobbyMember) => {
        if (!supabaseUserId || member.uid === supabaseUserId) return;
        setLoadingUid(member.uid);
        try {
            const session = await ChallengeSessionService.create({
                hostId: supabaseUserId,
                guestId: member.uid,
                exerciseName,
                durationSeconds: workoutDurationSecs,
            });
            const token = await fetchAgoraToken(session.channelName, 0);

            // Notification row (powers the bell + the App-level fallback listener)
            await NotificationService.insert({
                toUid: member.uid,
                fromUid: supabaseUserId,
                fromName: selfNameRef.current,
                type: 'challenge_invite',
                title: '💪 Exercise Challenge!',
                body: `${selfNameRef.current} challenged you to ${workoutDurationSecs / 60} min of ${exerciseName}!`,
                sessionId: session.id,
            }).catch(() => {});

            // Instant invite to the guest over the shared lobby channel.
            // Await so the message flushes before we navigate (which unmounts the channel).
            await channelRef.current?.send({
                type: 'broadcast',
                event: 'challenge',
                payload: {
                    sessionId: session.id,
                    channelName: session.channelName,
                    guestUid: member.uid,
                    hostUid: supabaseUserId,
                    hostName: selfNameRef.current,
                    exerciseName,
                    workoutDurationSecs,
                },
            });

            onChallengeStarted({
                challengeSessionId: session.id,
                channelName: session.channelName,
                token,
                opponentName: member.name,
                opponentUid: member.uid,
                exerciseName,
                workoutDurationSecs,
                isHost: true,
            });
        } catch (e) {
            console.warn('[ChallengeLobby] failed to create session:', e);
        } finally {
            setLoadingUid(null);
        }
    };

    // ── Guest accepts / declines an incoming challenge ──────────────────────────
    const acceptIncoming = async () => {
        const c = incoming;
        if (!c) return;
        setIncoming(null);
        try {
            const token = await fetchAgoraToken(c.channelName, 0).catch(() => '');
            onChallengeStarted({
                challengeSessionId: c.sessionId,
                channelName: c.channelName,
                token,
                opponentName: c.hostName,
                opponentUid: c.hostUid,
                exerciseName: c.exerciseName,
                workoutDurationSecs: c.workoutDurationSecs,
                isHost: false,
            });
        } catch (e) {
            console.warn('[ChallengeLobby] accept failed:', e);
        }
    };

    const declineIncoming = () => {
        const c = incoming;
        setIncoming(null);
        if (c) ChallengeSessionService.cancel(c.sessionId).catch(() => {});
    };

    const others = members.filter(m => m.uid !== supabaseUserId);

    const pulseStyle = {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <SafeAreaView style={s.overlay}>
                <View style={s.sheet}>
                    <View style={s.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.title}>Challenge Lobby</Text>
                            <Text style={s.subtitle}>{exerciseName} · {workoutDurationSecs / 60} min</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X color="#7A7C90" size={22} />
                        </TouchableOpacity>
                    </View>

                    {/* Incoming challenge — accept / decline */}
                    {incoming ? (
                        <View style={s.incomingBanner}>
                            <Text style={s.incomingText}>
                                💪 <Text style={{ fontWeight: '800' }}>{incoming.hostName}</Text> challenged you!
                            </Text>
                            <View style={s.incomingBtns}>
                                <TouchableOpacity style={s.declineBtn} onPress={declineIncoming} activeOpacity={0.8}>
                                    <Text style={s.declineBtnText}>Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.acceptBtn} onPress={acceptIncoming} activeOpacity={0.85}>
                                    <Zap color="#FFFFFF" size={14} />
                                    <Text style={s.acceptBtnText}>Accept</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        /* Waiting banner */
                        <View style={s.waitBanner}>
                            <Animated.View style={[s.waitDot, pulseStyle]} />
                            <Text style={s.waitText}>
                                {others.length === 0
                                    ? 'Waiting for challengers…'
                                    : `${others.length} ${others.length === 1 ? 'athlete' : 'athletes'} in the lobby`}
                            </Text>
                        </View>
                    )}

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
                        {/* Self card */}
                        {members.find(m => m.uid === supabaseUserId) && (
                            <View style={[s.row, s.selfRow]}>
                                <Avatar member={members.find(m => m.uid === supabaseUserId)!} />
                                <View style={s.rowInfo}>
                                    <Text style={s.rowName} numberOfLines={1}>
                                        {profile?.fullName || profile?.username || 'You'}
                                    </Text>
                                </View>
                                <View style={s.youBadge}><Text style={s.youBadgeText}>YOU</Text></View>
                            </View>
                        )}

                        {others.length === 0 ? (
                            <View style={s.empty}>
                                <ActivityIndicator color={ACCENT} />
                                <Text style={s.emptyText}>No challengers yet</Text>
                                <Text style={s.emptyHint}>
                                    Anyone who opens the Challenge Lobby will appear here — friends or not. Hang tight!
                                </Text>
                            </View>
                        ) : (
                            others.map((member) => (
                                <View key={member.uid} style={s.row}>
                                    <Avatar member={member} />
                                    <View style={s.rowInfo}>
                                        <Text style={s.rowName} numberOfLines={1}>{member.name}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[s.challengeBtn, loadingUid === member.uid && { opacity: 0.6 }]}
                                        onPress={() => handleChallenge(member)}
                                        disabled={!!loadingUid}
                                        activeOpacity={0.8}
                                    >
                                        {loadingUid === member.uid ? (
                                            <ActivityIndicator color="#211832" size="small" />
                                        ) : (
                                            <>
                                                <Zap color="#FFFFFF" size={13} />
                                                <Text style={s.challengeBtnText}>Challenge</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

function Avatar({ member }: { member: LobbyMember }) {
    return (
        <TierAvatar
            uri={member.avatar}
            size={44}
            accessType={member.accessType ?? null}
            name={member.name}
            radius={10}
            showBadge={false}
            fallback={
                <View style={[s.avatar, s.avatarFallback]}>
                    <CircleUserRound color="#7A7C90" size={22} strokeWidth={1.5} />
                </View>
            }
        />
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
    sheet: {
        backgroundColor: BG,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        maxHeight: '80%',
        paddingBottom: 32,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(33,24,50,0.06)',
    },
    title: { color: '#211832', fontSize: 17, fontWeight: '700' },
    subtitle: { color: 'rgba(150,180,210,0.6)', fontSize: 12, marginTop: 3 },
    waitBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginHorizontal: 16,
        marginTop: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: 'rgba(76,78,120,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(76,78,120,0.25)',
    },
    waitDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: CTA },
    waitText: { color: CTA, fontSize: 13, fontWeight: '700' },
    incomingBanner: {
        marginHorizontal: 16,
        marginTop: 14,
        padding: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(76,78,120,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(76,78,120,0.3)',
        gap: 12,
    },
    incomingText: { color: '#211832', fontSize: 14, fontWeight: '600' },
    incomingBtns: { flexDirection: 'row', gap: 10 },
    acceptBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: CTA,
        borderRadius: 10,
        paddingVertical: 11,
    },
    acceptBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    declineBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderRadius: 10,
        paddingVertical: 11,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.18)',
    },
    declineBtnText: { color: 'rgba(150,180,210,0.8)', fontSize: 14, fontWeight: '700' },
    list: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(33,24,50,0.05)',
    },
    selfRow: {
        backgroundColor: 'rgba(76,78,120,0.07)',
        borderRadius: 12,
        paddingHorizontal: 10,
        borderBottomWidth: 0,
        marginBottom: 6,
    },
    avatar: { width: 44, height: 44, borderRadius: 10 },
    avatarFallback: {
        backgroundColor: CARD,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowInfo: { flex: 1, gap: 4 },
    rowName: { color: '#211832', fontSize: 14, fontWeight: '600' },
    challengeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: CTA,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 90,
        justifyContent: 'center',
    },
    challengeBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    youBadge: {
        backgroundColor: 'rgba(76,78,120,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(76,78,120,0.35)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    youBadgeText: { color: ACCENT, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
    emptyText: { color: '#D8D8E4', fontSize: 16, fontWeight: '600' },
    emptyHint: { color: '#F8F8FC', fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 19 },
});
