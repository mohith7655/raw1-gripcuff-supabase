import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Dumbbell, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useNotificationCenter } from '../providers/NotificationProvider';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { useAuth } from '../providers/AuthContext';
import { SessionService } from '../services/session.service';
import { WorkoutSession } from '../models/WorkoutSession';

const ACCENT = '#F97316';
const NAVY   = '#0F172A';
const CARD   = '#111827';

const { width: SW } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────

function InviterAvatar({ name, photo }: { name: string; photo?: string | null }) {
    const initial = name?.charAt(0)?.toUpperCase() ?? '?';
    const palette = ['#D4622A', '#8B5CF6', '#10B981', '#3B82F6'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    const bg = palette[Math.abs(h) % palette.length];

    return photo ? (
        <Image source={{ uri: photo }} style={s.avatar} />
    ) : (
        <View style={[s.avatar, { backgroundColor: bg }]}>
            <Text style={s.avatarInitial}>{initial}</Text>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────
// Pulsing ring behind avatar
// ─────────────────────────────────────────────────────────────

function PulseRing() {
    const scale   = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(0.55)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(scale,   { toValue: 1.25, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
                    Animated.timing(scale,   { toValue: 1,    duration: 900, useNativeDriver: Platform.OS !== 'web' }),
                ]),
                Animated.sequence([
                    Animated.timing(opacity, { toValue: 0.08, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
                    Animated.timing(opacity, { toValue: 0.55, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
                ]),
            ]),
        );
        anim.start();
        return () => anim.stop();
    }, [scale, opacity]);

    return <Animated.View style={[s.pulseRing, { transform: [{ scale }], opacity }]} />;
}

// ─────────────────────────────────────────────────────────────
// Pulsing Accept button
// ─────────────────────────────────────────────────────────────

function AcceptButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: Platform.OS !== 'web' }),
            ]),
        );
        anim.start();
        return () => anim.stop();
    }, [pulse]);

    return (
        <Animated.View style={[s.acceptWrap, { transform: [{ scale: disabled ? new Animated.Value(1) : pulse }] }]}>
            <TouchableOpacity
                style={[s.acceptBtn, disabled && { opacity: 0.45 }]}
                onPress={onPress}
                disabled={disabled}
                activeOpacity={0.82}
            >
                <Dumbbell color="#fff" size={17} />
                <Text style={s.acceptText}>Accept</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

// ─────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────

export function WorkoutInviteModal() {
    const { currentWorkoutInvite, dismissWorkoutInvite } = useNotificationCenter();
    const { acceptSession, declineSession, pendingInvites } = useWorkoutSession();
    const { supabaseUserId } = useAuth();

    // Reliable fallback: show modal when pendingInvites arrives even if the
    // notification doc was skipped by the NotificationProvider bootstrap.
    const shownRef = useRef<Set<string>>(new Set());
    const [sessionFallback, setSessionFallback] = useState<WorkoutSession | null>(null);
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();

    const [session, setSession]   = useState<WorkoutSession | null>(null);
    const [loading, setLoading]   = useState(false);
    const [busy, setBusy]         = useState(false);

    // Animation refs
    const bgOpacity   = useRef(new Animated.Value(0)).current;
    const cardScale   = useRef(new Animated.Value(0.82)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;

    // pendingInvites fallback effect
    useEffect(() => {
        const newest = pendingInvites[0] ?? null;
        if (!newest) return;
        if (shownRef.current.has(newest.id)) return;
        // already covered by notification pipeline
        if (currentWorkoutInvite?.sessionId === newest.id) {
            shownRef.current.add(newest.id);
            return;
        }
        shownRef.current.add(newest.id);
        setSessionFallback(newest);
    }, [pendingInvites, currentWorkoutInvite?.sessionId]);

    // If a notification arrives for the same session, clear the fallback
    useEffect(() => {
        if (!currentWorkoutInvite?.sessionId) return;
        shownRef.current.add(currentWorkoutInvite.sessionId);
        setSessionFallback((prev) => prev?.id === currentWorkoutInvite.sessionId ? null : prev);
    }, [currentWorkoutInvite?.sessionId]);

    const visible = !!(currentWorkoutInvite || sessionFallback);

    // Animate in when a new invite lands
    useEffect(() => {
        if (!visible) return;
        setBusy(false);
        setSession(null);
        Animated.parallel([
            Animated.timing(bgOpacity, {
                toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.spring(cardScale, {
                toValue: 1, tension: 75, friction: 9, useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(cardOpacity, {
                toValue: 1, duration: 260, useNativeDriver: Platform.OS !== 'web',
            }),
        ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentWorkoutInvite?.id ?? sessionFallback?.id]);

    // WorkoutSession doc fetch removed (no Firestore)
    useEffect(() => {
        setLoading(false);
    }, [currentWorkoutInvite?.sessionId, sessionFallback]);

    // Shared exit animation, then run callback
    const animateOut = useCallback((cb: () => void) => {
        Animated.parallel([
            Animated.timing(bgOpacity,   { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(cardScale,   { toValue: 0.88, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
        ]).start(() => {
            bgOpacity.setValue(0);
            cardScale.setValue(0.82);
            cardOpacity.setValue(0);
            cb();
        });
    }, [bgOpacity, cardScale, cardOpacity]);

    const activeSessionId = currentWorkoutInvite?.sessionId ?? sessionFallback?.id ?? null;

    const dismissActive = useCallback(() => {
        if (currentWorkoutInvite) dismissWorkoutInvite();
        else setSessionFallback(null);
    }, [currentWorkoutInvite, dismissWorkoutInvite]);

    const handleAccept = useCallback(() => {
        if (busy || !activeSessionId) return;
        setBusy(true);
        animateOut(async () => {
            // Mark notification read (existing flow)
            acceptSession(activeSessionId).catch(() => {});
            dismissActive();

            // Update sessions table → get agoraChannel + workoutId, then navigate
            try {
                const uid = supabaseUserId ?? '';
                const { agoraChannel, workoutId, workoutTitle } =
                    await SessionService.acceptSession(activeSessionId, uid);

                if (workoutId) {
                    navigation.navigate('VideoPlayerScreen', {
                        videoId: workoutId,
                        title: workoutTitle || undefined,
                        allowInvite: true,
                        coWorkoutChannel: agoraChannel || undefined,
                    });
                }
            } catch (e) {
                console.warn('[WorkoutInviteModal] SessionService.acceptSession failed:', e);
                // Still navigate to sessions screen as a fallback
                navigation.navigate('UpcomingSessionsScreen');
            }
        });
    }, [busy, activeSessionId, animateOut, acceptSession, dismissActive, supabaseUserId, navigation]);

    const handleDecline = useCallback(() => {
        if (busy || !activeSessionId) return;
        setBusy(true);
        animateOut(() => {
            declineSession(activeSessionId).catch(() => {});
            SessionService.declineSession(activeSessionId).catch(() => {});
            dismissActive();
        });
    }, [busy, activeSessionId, animateOut, declineSession, dismissActive]);

    const handleDismiss = useCallback(() => {
        if (busy) return;
        animateOut(dismissActive);
    }, [busy, animateOut, dismissActive]);

    const handleViewDetails = useCallback(() => {
        animateOut(() => {
            dismissActive();
            navigation.navigate('UpcomingSessionsScreen');
        });
    }, [animateOut, dismissActive, navigation]);

    if (!visible) return null;

    const inviterName  = session?.hostName ?? sessionFallback?.hostName ?? currentWorkoutInvite?.fromName ?? 'Someone';
    const inviterPhoto = session?.hostAvatarUrl ?? sessionFallback?.hostAvatarUrl ?? currentWorkoutInvite?.avatar ?? null;
    const workoutTitle = session?.videoTitle ?? sessionFallback?.videoTitle ?? 'Workout Session';
    const rawScheduledAt = session?.scheduledAt ?? sessionFallback?.scheduledAt ?? null;

    let scheduledStr = '';
    if (rawScheduledAt) {
        const date    = rawScheduledAt instanceof Date ? rawScheduledAt : new Date(rawScheduledAt as any);
        const isToday = date.toDateString() === new Date().toDateString();
        const dateStr = isToday
            ? 'Today'
            : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        scheduledStr = `${dateStr} at ${timeStr}`;
    }

    return (
        <View style={s.root}>
            {/* ── Backdrop ── */}
            <Animated.View style={[s.backdrop, { opacity: bgOpacity }]} />

            {/* ── Card ── */}
            <Animated.View
                style={[
                    s.card,
                    { marginTop: insets.top, transform: [{ scale: cardScale }], opacity: cardOpacity },
                ]}
            >
                {/* Close button */}
                <TouchableOpacity style={s.closeBtn} onPress={handleDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <X color="#4B5563" size={20} />
                </TouchableOpacity>

                {/* Badge */}
                <View style={s.badge}>
                    <Dumbbell color={ACCENT} size={11} />
                    <Text style={s.badgeText}>WORKOUT WITH FRIEND</Text>
                </View>

                {/* Avatar + name */}
                <View style={s.avatarSection}>
                    <View style={s.avatarWrap}>
                        <PulseRing />
                        <InviterAvatar name={inviterName} photo={inviterPhoto} />
                    </View>
                    <Text style={s.inviterName}>{inviterName}</Text>
                    <Text style={s.inviterSub}>wants to work out with you!</Text>
                </View>

                {/* Session detail card */}
                <View style={s.sessionCard}>
                    {loading ? (
                        <ActivityIndicator color={ACCENT} size="small" style={{ paddingVertical: 6 }} />
                    ) : (
                        <>
                            <View style={s.sessionRow}>
                                <View style={s.sessionIconWrap}>
                                    <Dumbbell color={ACCENT} size={14} />
                                </View>
                                <Text style={s.sessionTitle} numberOfLines={1}>{workoutTitle}</Text>
                            </View>
                            {scheduledStr ? (
                                <View style={s.sessionRow}>
                                    <View style={s.sessionIconWrap}>
                                        <Calendar color="#6B7280" size={13} />
                                    </View>
                                    <Text style={s.sessionMeta}>{scheduledStr}</Text>
                                </View>
                            ) : null}
                        </>
                    )}
                </View>

                {/* Primary actions */}
                <View style={s.btnRow}>
                    <AcceptButton onPress={handleAccept} disabled={busy} />
                    <TouchableOpacity
                        style={[s.declineBtn, busy && { opacity: 0.45 }]}
                        onPress={handleDecline}
                        disabled={busy}
                        activeOpacity={0.8}
                    >
                        <Text style={s.declineText}>Decline</Text>
                    </TouchableOpacity>
                </View>

                {/* Secondary action */}
                <TouchableOpacity style={s.detailsBtn} onPress={handleViewDetails} activeOpacity={0.7}>
                    <Text style={s.detailsText}>View Details</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const AVATAR_SIZE = 76;

const s = StyleSheet.create({
    root: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9998,
        elevation: 9998,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    } as any,
    backdrop: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.84)',
    },
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: CARD,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.30)',
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 24,
        alignItems: 'center',
        // Orange ambient glow (web)
        boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
        elevation: 32,
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(249,115,22,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.28)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 20,
    },
    badgeText: {
        color: ACCENT,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.1,
    },
    // ── Avatar ──
    avatarSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarWrap: {
        width: AVATAR_SIZE + 20,
        height: AVATAR_SIZE + 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    pulseRing: {
        position: 'absolute',
        width: AVATAR_SIZE + 20,
        height: AVATAR_SIZE + 20,
        borderRadius: (AVATAR_SIZE + 20) / 2,
        borderWidth: 2,
        borderColor: ACCENT,
    },
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2.5,
        borderColor: ACCENT,
    },
    avatarInitial: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '700',
    },
    inviterName: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4,
    },
    inviterSub: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    // ── Session card ──
    sessionCard: {
        width: '100%',
        backgroundColor: 'rgba(249,115,22,0.07)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.15)',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 8,
        marginBottom: 22,
    },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    sessionIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: 'rgba(249,115,22,0.10)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sessionTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
    },
    sessionMeta: {
        color: '#9CA3AF',
        fontSize: 13,
        flex: 1,
    },
    // ── Buttons ──
    btnRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
        marginBottom: 10,
    },
    acceptWrap: {
        flex: 1,
    },
    acceptBtn: {
        backgroundColor: ACCENT,
        borderRadius: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
        elevation: 8,
    },
    acceptText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
    declineBtn: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 14,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.28)',
    },
    declineText: {
        color: '#EF4444',
        fontSize: 15,
        fontWeight: '700',
    },
    detailsBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    detailsText: {
        color: '#4B5563',
        fontSize: 13,
        fontWeight: '600',
    },
});
