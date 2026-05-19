import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    Image,
    Platform,
} from 'react-native';
import { Dumbbell, Clock } from 'lucide-react-native';
import { StrangerInvite } from '../services/StrangerInviteService';

const ACCENT = '#F97316';
const TIMEOUT_SEC = 10;
const { width: SCREEN_W } = Dimensions.get('window');

type Props = {
    invite: StrangerInvite;
    onAccept: (invite: StrangerInvite) => void;
    onDecline: (invite: StrangerInvite) => void;
};

function AvatarCircle({ name, photo }: { name: string; photo: string | null }) {
    const initial = name.charAt(0).toUpperCase();
    const colors = ['#D4622A', '#8B5CF6', '#10B981', '#3B82F6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const bg = colors[Math.abs(hash) % colors.length];

    if (photo) {
        return <Image source={{ uri: photo }} style={styles.avatar} />;
    }
    return (
        <View style={[styles.avatar, { backgroundColor: bg }]}>
            <Text style={styles.avatarText}>{initial}</Text>
        </View>
    );
}

function TimerBar({ secondsLeft }: { secondsLeft: number }) {
    const width = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(width, {
            toValue: 0,
            duration: TIMEOUT_SEC * 1000,
            useNativeDriver: false,
        }).start();
    }, []);

    return (
        <View style={styles.timerTrack}>
            <Animated.View
                style={[
                    styles.timerFill,
                    {
                        width: width.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                        }),
                    },
                ]}
            />
        </View>
    );
}

export function IncomingStrangerInvitePopup({ invite, onAccept, onDecline }: Props) {
    const translateY = useRef(new Animated.Value(300)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SEC);

    useEffect(() => {
        // Slide up
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: Platform.OS !== 'web',
                tension: 70,
                friction: 9,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: Platform.OS !== 'web',
            }),
        ]).start();

        // Countdown
        const interval = setInterval(() => {
            setSecondsLeft((s) => Math.max(0, s - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const {
        inviterUsername,
        inviterPhoto,
        inviterAge,
        inviterGender,
        workoutTitle,
        workoutThumbnail,
    } = invite;

    const metaLine = [
        inviterAge ? `${inviterAge} yrs` : null,
        inviterGender ? (inviterGender === 'male' ? 'Male' : inviterGender === 'female' ? 'Female' : inviterGender) : null,
    ].filter(Boolean).join(' · ');

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY }], opacity },
            ]}
            pointerEvents="box-none"
        >
            <View style={styles.card}>
                {/* Timer bar */}
                <TimerBar secondsLeft={secondsLeft} />

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveBadgeText}>GYM PARTNER</Text>
                    </View>
                    <View style={styles.timerPill}>
                        <Clock size={12} color={secondsLeft <= 3 ? '#ef4444' : '#9CA3AF'} />
                        <Text style={[styles.timerText, secondsLeft <= 3 && { color: '#ef4444' }]}>
                            {secondsLeft}s
                        </Text>
                    </View>
                </View>

                {/* Inviter profile */}
                <View style={styles.profileRow}>
                    <AvatarCircle name={inviterUsername} photo={inviterPhoto} />
                    <View style={styles.profileInfo}>
                        <Text style={styles.inviterName}>{inviterUsername}</Text>
                        {metaLine ? (
                            <Text style={styles.inviterMeta}>{metaLine}</Text>
                        ) : null}
                        <Text style={styles.inviteLabel}>wants to be your gym partner</Text>
                    </View>
                </View>

                {/* Workout */}
                <View style={styles.workoutRow}>
                    <View style={styles.workoutIconWrap}>
                        <Dumbbell size={18} color={ACCENT} />
                    </View>
                    <View style={styles.workoutInfo}>
                        <Text style={styles.workoutLabel}>Workout</Text>
                        <Text style={styles.workoutTitle} numberOfLines={1}>{workoutTitle}</Text>
                    </View>
                    {workoutThumbnail ? (
                        <Image source={{ uri: workoutThumbnail }} style={styles.thumbnail} />
                    ) : null}
                </View>

                {/* Buttons */}
                <View style={styles.btnRow}>
                    <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => onDecline(invite)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => onAccept(invite)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.acceptBtnText}>Accept</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 80,
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 9999,
        alignItems: 'center',
    } as any,
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#111827',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.35)',
        boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
        elevation: 20,
    },
    timerTrack: {
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.07)',
    },
    timerFill: {
        height: '100%',
        backgroundColor: ACCENT,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 4,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(34,197,94,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.3)',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22c55e',
    },
    liveBadgeText: {
        color: '#22c55e',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    timerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.06)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    timerText: {
        color: '#9CA3AF',
        fontSize: 13,
        fontWeight: '700',
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    avatarText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
    },
    profileInfo: {
        flex: 1,
        gap: 2,
    },
    inviterName: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    inviterMeta: {
        color: ACCENT,
        fontSize: 12,
        fontWeight: '600',
    },
    inviteLabel: {
        color: '#9CA3AF',
        fontSize: 13,
    },
    workoutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginHorizontal: 16,
        marginBottom: 14,
        backgroundColor: 'rgba(249,115,22,0.08)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.15)',
    },
    workoutIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(249,115,22,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    workoutInfo: {
        flex: 1,
    },
    workoutLabel: {
        color: '#6B7280',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    workoutTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 2,
    },
    thumbnail: {
        width: 44,
        height: 44,
        borderRadius: 8,
        flexShrink: 0,
    },
    btnRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    declineBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
    },
    declineBtnText: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '700',
    },
    acceptBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: ACCENT,
    },
    acceptBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});
