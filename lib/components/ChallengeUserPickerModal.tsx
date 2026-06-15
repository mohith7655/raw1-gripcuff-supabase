import React, { useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { X, Zap, CircleUserRound } from 'lucide-react-native';
import { useFriend } from '../providers/FriendContext';
import { TierAvatar } from './profile/TierAvatar';
import { useAuth } from '../providers/AuthContext';
import { ChallengeSessionService } from '../services/challengeSession.service';
import { NotificationService } from '../services/notification.service';
import { fetchAgoraToken } from '../services/agora/AgoraTokenService';

const ACCENT = '#F25912';
const BG     = '#EEEEF2';
const CARD   = '#F8F8FC';

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

export function ChallengeUserPickerModal({
    visible, exerciseName, workoutDurationSecs, onClose, onChallengeStarted,
}: Props) {
    const { friends } = useFriend();
    const { user: authUser, supabaseUserId } = useAuth() as any;
    const [loadingUid, setLoadingUid] = useState<string | null>(null);

    const handleChallenge = async (friend: any) => {
        if (!supabaseUserId) return;
        setLoadingUid(friend.uid);
        try {
            const session = await ChallengeSessionService.create({
                hostId: supabaseUserId,
                guestId: friend.uid,
                exerciseName,
                durationSeconds: workoutDurationSecs,
            });

            const token = await fetchAgoraToken(session.channelName, 0);

            // Notify the guest
            await NotificationService.insert({
                toUid: friend.uid,
                fromUid: supabaseUserId,
                fromName: authUser?.displayName || authUser?.email?.split('@')[0] || 'Someone',
                type: 'challenge_invite',
                title: '💪 Exercise Challenge!',
                body: `${authUser?.displayName || 'Someone'} challenged you to ${workoutDurationSecs / 60} min of ${exerciseName}!`,
                sessionId: session.id,
            });

            onChallengeStarted({
                challengeSessionId: session.id,
                channelName: session.channelName,
                token,
                opponentName: friend.fullName || friend.username || 'Opponent',
                opponentUid: friend.uid,
                exerciseName,
                workoutDurationSecs,
                isHost: true,
            });
        } catch (e) {
            console.warn('[Challenge] failed to create session:', e);
        } finally {
            setLoadingUid(null);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <SafeAreaView style={s.overlay}>
                <View style={s.sheet}>
                    <View style={s.header}>
                        <View>
                            <Text style={s.title}>Challenge a Friend</Text>
                            <Text style={s.subtitle}>{exerciseName} · {workoutDurationSecs / 60} min</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X color="#7A7C90" size={22} />
                        </TouchableOpacity>
                    </View>

                    {friends.length === 0 ? (
                        <View style={s.empty}>
                            <CircleUserRound color="#D8D8E4" size={48} strokeWidth={1.2} />
                            <Text style={s.emptyText}>No friends yet</Text>
                            <Text style={s.emptyHint}>Add friends to challenge them to a workout</Text>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
                            {friends.map((friend: any) => (
                                <View key={friend.uid} style={s.row}>
                                    {/* Avatar */}
                                    <TierAvatar uri={friend.profileImageUrl} size={44} uid={friend.uid} name={friend.fullName || friend.username} radius={10} />

                                    {/* Name + streak */}
                                    <View style={s.rowInfo}>
                                        <Text style={s.rowName} numberOfLines={1}>
                                            {friend.username ? `@${friend.username}` : (friend.fullName || 'Friend')}
                                        </Text>
                                        {!!friend.fullName && (
                                            <Text style={{ color: '#7A7C90', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                                                {friend.fullName}
                                            </Text>
                                        )}
                                        {(friend.currentStreak ?? 0) > 0 && (
                                            <Text style={s.rowStreak}>🔥 {friend.currentStreak} day streak</Text>
                                        )}
                                    </View>

                                    {/* Challenge button */}
                                    <TouchableOpacity
                                        style={[s.challengeBtn, loadingUid === friend.uid && { opacity: 0.6 }]}
                                        onPress={() => handleChallenge(friend)}
                                        disabled={!!loadingUid}
                                        activeOpacity={0.8}
                                    >
                                        {loadingUid === friend.uid ? (
                                            <ActivityIndicator color="#211832" size="small" />
                                        ) : (
                                            <>
                                                <Zap color="#211832" size={13} />
                                                <Text style={s.challengeBtnText}>Challenge</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
    sheet: {
        backgroundColor: BG,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        maxHeight: '75%',
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
    list: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(33,24,50,0.05)',
    },
    avatar: { width: 44, height: 44, borderRadius: 10 },
    avatarFallback: {
        backgroundColor: CARD,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowInfo: { flex: 1 },
    rowName: { color: '#211832', fontSize: 14, fontWeight: '600' },
    rowStreak: { color: 'rgba(150,180,210,0.5)', fontSize: 12, marginTop: 2 },
    challengeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#F25912',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 90,
        justifyContent: 'center',
    },
    challengeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
    emptyText: { color: '#D8D8E4', fontSize: 16, fontWeight: '600' },
    emptyHint: { color: '#F8F8FC', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
});
