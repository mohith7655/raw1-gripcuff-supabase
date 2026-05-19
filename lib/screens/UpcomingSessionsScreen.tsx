import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Calendar, Clock, Check, X, Dumbbell, UserRound, ArrowLeft, Play } from 'lucide-react-native';
import { collection, query, where, onSnapshot, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { AppTheme } from '../core/theme/app_theme';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { useAuth } from '../providers/AuthContext';
import { db } from '../core/config/firebase';

interface SelfScheduledEntry {
    id: string;
    workoutId: string;
    workoutName?: string;
    workoutTitle?: string | null;
    categoryId?: string | null;
    categoryTitle?: string | null;
    programId?: string | null;
    programTitle?: string | null;
    videoId?: string;
    videoTitle?: string;
    combinedTitle?: string | null;
    category?: string | null;
    programName: string | null;
    thumbnail: string | null;
    scheduledFor: Timestamp;
    status: string;
}

export const UpcomingSessionsScreen = () => {
    const {
        pendingInvites,
        pendingOutgoing,
        upcomingSessions,
        completedSessions,
        loading,
        acceptSession,
        declineSession,
        cancelSession,
        resendSession,
        refreshSessions
    } = useWorkoutSession();

    const navigation = useNavigation<any>();

    const { user } = useAuth();
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selfScheduled, setSelfScheduled] = useState<SelfScheduledEntry[]>([]);

    // Refresh sessions every time the screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshSessions();
        });
        return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation]);

    // Subscribe to self-scheduled workouts
    useEffect(() => {
        if (!user?.uid) return;
        const q = query(
            collection(db, 'scheduledWorkouts'),
            where('userId', '==', user.uid),
            where('status', 'in', ['active', 'scheduled'])
        );
        const unsub = onSnapshot(
            q,
            (snap) => {
                const raw = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as SelfScheduledEntry));
                // Deduplicate by doc ID to guard against double-mount in Strict Mode
                const deduped = Array.from(new Map(raw.map(e => [e.id, e])).values());
                setSelfScheduled(deduped);
            },
            (err) => console.warn('[UpcomingSessionsScreen] self-scheduled snapshot error:', err)
        );
        return unsub;
    }, [user?.uid]);

    const onRefresh = async () => {
        setRefreshing(true);
        try { await refreshSessions(); }
        catch (e) { console.error(e); }
        finally { setRefreshing(false); }
    };

    const handleAccept = async (id: string) => {
        setActionLoading(id);
        try { await acceptSession(id); }
        catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionLoading(null); }
    };

    const handleDecline = async (id: string) => {
        setActionLoading(id);
        try { await declineSession(id); }
        catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionLoading(null); }
    };

    const handleCancel = async (id: string) => {
        setActionLoading(id);
        try { await cancelSession(id); }
        catch (e: any) { Alert.alert('Error', e.message); }
        finally { setActionLoading(null); }
    };

    const handleResend = async (id: string) => {
        setActionLoading(id);
        try {
            await resendSession(id);
        } catch (e: any) {
            if (e.message === 'max_resends_reached') {
                Alert.alert('Limit reached', 'You can only resend an invite 3 times.');
            } else {
                Alert.alert('Error', e.message);
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancelScheduled = (id: string) => {
        Alert.alert(
            'Cancel scheduled workout',
            'Remove this workout from your schedule?',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(id);
                        try {
                            await updateDoc(doc(db, 'scheduledWorkouts', id), { status: 'cancelled' });
                        } catch (e: any) {
                            Alert.alert('Error', e?.message ?? 'Could not remove workout');
                        } finally {
                            setActionLoading(null);
                        }
                    },
                },
            ]
        );
    };

    const formatDateTime = (date: Date) => {
        const isToday = date.toDateString() === new Date().toDateString();
        const dateStr = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return { dateStr, timeStr };
    };

    const getCountdown = (date: Date) => {
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        if (diffMs < 0 && diffMs > -3600000) return 'Started'; // within last hour
        if (diffMs < 0) return 'Passed';

        const diffH = Math.floor(diffMs / 3600000);
        const diffM = Math.floor((diffMs % 3600000) / 60000);

        if (diffH < 1) return `in ${diffM}m`;
        if (diffH < 24) return `in ${diffH}h ${diffM}m`;

        const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === date.toDateString();
        if (isTomorrow) return 'Tomorrow';

        return `${Math.floor(diffH / 24)} days`;
    };

    const EmptyState = ({ message }: { message: string }) => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{message}</Text>
        </View>
    );

    const getSelfScheduleTitles = (entry: SelfScheduledEntry) => {
        const rawVideo  = entry.videoTitle  || entry.workoutName || 'Workout';
        const rawParent = entry.workoutTitle || '';
        // combinedTitle is pre-built in Firestore: "Upper Body Hypertrophy • Day 1"
        // Fall back to constructing it client-side for older docs.
        const videoLine = rawVideo;
        const workoutLine = entry.combinedTitle
            || (rawParent && rawParent !== rawVideo ? `${rawParent} • ${rawVideo}` : rawVideo);
        const programLine = entry.programTitle || entry.programName || null;
        return { programLine, workoutLine, videoLine };
    };

    const now = Date.now();
    const cutoff = 60 * 60 * 1000; // 1 hour in ms
    const upcoming = upcomingSessions.filter(s => s.scheduledAt.toMillis() > now - cutoff);

    // Self-scheduled partitions (client-side, no orderBy needed)
    const upcomingSelf = selfScheduled
        .filter(e => (e.scheduledFor as Timestamp)?.toMillis?.() >= now)
        .sort((a, b) => a.scheduledFor.toMillis() - b.scheduledFor.toMillis());
    const pastSelf = selfScheduled
        .filter(e => (e.scheduledFor as Timestamp)?.toMillis?.() < now)
        .sort((a, b) => b.scheduledFor.toMillis() - a.scheduledFor.toMillis());

    // Previous = completed sessions + accepted sessions older than 1h, deduplicated
    const oldAccepted = upcomingSessions
        .filter(s => s.scheduledAt.toMillis() <= now - cutoff);
    const allPrevious = [...completedSessions, ...oldAccepted];
    const previousMap = new Map(allPrevious.map(s => [s.id, s]));
    const previousSessions = Array.from(previousMap.values());

    // Merge sessions + pastSelf into a single sorted list
    type PreviousItem =
        | { kind: 'session'; data: typeof previousSessions[number] }
        | { kind: 'self'; data: SelfScheduledEntry };
    const previous: PreviousItem[] = [
        ...previousSessions.map(s => ({ kind: 'session' as const, data: s })),
        ...pastSelf.map(e => ({ kind: 'self' as const, data: e })),
    ].sort((a, b) => {
        const tsA = a.kind === 'session' ? a.data.scheduledAt.toMillis() : a.data.scheduledFor.toMillis();
        const tsB = b.kind === 'session' ? b.data.scheduledAt.toMillis() : b.data.scheduledFor.toMillis();
        return tsB - tsA;
    });

    if (loading && !pendingInvites.length && !pendingOutgoing.length && !upcomingSessions.length) {
        return (
            <SafeAreaView style={styles.centered}>
                <ActivityIndicator size="large" color={AppTheme.primaryColor} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Sessions</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppTheme.primaryColor} />
                }
            >

                {/* ── Section 1: Awaiting (Pending Invites + Awaiting Response combined) ── */}
                <Text style={styles.sectionTitle}>Awaiting Response</Text>
                {pendingInvites.length === 0 && pendingOutgoing.length === 0 ? (
                    <EmptyState message="No pending invites" />
                ) : (
                    <>
                        {pendingInvites.map(session => (
                            <View key={session.id} style={styles.card}>
                                <Text style={styles.sessionTypeLabel}>Workout with Friend</Text>
                                <View style={styles.cardHeader}>
                                    {session.hostAvatarUrl ? (
                                        <Image source={{ uri: session.hostAvatarUrl }} style={styles.avatar} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <UserRound color={AppTheme.primaryColor} size={20} />
                                        </View>
                                    )}
                                    <View style={styles.headerText}>
                                        <Text style={styles.userName}>{session.hostName}</Text>
                                        <Text style={styles.actionText}>invited you to work out</Text>
                                    </View>
                                </View>

                                <View style={styles.detailsRow}>
                                    <View style={styles.detailHarp}>
                                        <Calendar color={AppTheme.textGrey} size={14} />
                                        <Text style={styles.detailText}>{formatDateTime(session.scheduledAt.toDate()).dateStr}</Text>
                                    </View>
                                    <View style={styles.detailHarp}>
                                        <Clock color={AppTheme.textGrey} size={14} />
                                        <Text style={styles.detailText}>{formatDateTime(session.scheduledAt.toDate()).timeStr}</Text>
                                    </View>
                                </View>

                                <View style={[styles.detailHarp, { marginTop: 8 }]}>
                                    <Dumbbell color={AppTheme.primaryColor} size={14} />
                                    <View style={{ flex: 1 }}>
                                        {(session.category || session.programName) ? (
                                            <Text style={styles.sessionMeta} numberOfLines={1}>
                                                {[session.category, session.programName].filter(Boolean).join(' · ')}
                                            </Text>
                                        ) : null}
                                        <Text style={[styles.detailText, { color: AppTheme.textWhite }]} numberOfLines={1}>
                                            {session.videoTitle}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.actionsRow}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.declineBtn]}
                                        onPress={() => handleDecline(session.id)}
                                        disabled={actionLoading === session.id}
                                    >
                                        <X color={AppTheme.textWhite} size={18} />
                                        <Text style={styles.btnText}>Decline</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.acceptBtn]}
                                        onPress={() => handleAccept(session.id)}
                                        disabled={actionLoading === session.id}
                                    >
                                        {actionLoading === session.id ? (
                                            <ActivityIndicator size="small" color="white" />
                                        ) : (
                                            <>
                                                <Check color="white" size={18} />
                                                <Text style={styles.btnText}>Accept</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        {pendingOutgoing.map(session => (
                            <View key={session.id} style={styles.card}>
                                <Text style={styles.sessionTypeLabel}>Workout with Friend</Text>
                                <View style={styles.cardHeader}>
                                    {session.guestAvatarUrl ? (
                                        <Image source={{ uri: session.guestAvatarUrl }} style={styles.avatar} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <UserRound color={AppTheme.primaryColor} size={20} />
                                        </View>
                                    )}
                                    <View style={styles.headerText}>
                                        <Text style={styles.actionText}>You invited</Text>
                                        <Text style={styles.userName}>{session.guestName}</Text>
                                    </View>
                                </View>

                                <View style={styles.detailsRow}>
                                    <View style={styles.detailHarp}>
                                        <Calendar color={AppTheme.textGrey} size={14} />
                                        <Text style={styles.detailText}>{formatDateTime(session.scheduledAt.toDate()).dateStr}</Text>
                                    </View>
                                    <View style={styles.detailHarp}>
                                        <Clock color={AppTheme.textGrey} size={14} />
                                        <Text style={styles.detailText}>{formatDateTime(session.scheduledAt.toDate()).timeStr}</Text>
                                    </View>
                                </View>

                                <View style={[styles.detailHarp, { marginTop: 8 }]}>
                                    <Dumbbell color={AppTheme.primaryColor} size={14} />
                                    <Text style={[styles.detailText, { color: AppTheme.textWhite, flex: 1 }]} numberOfLines={1}>
                                        {session.videoTitle}
                                    </Text>
                                </View>

                                <View style={styles.actionsRow}>
                                    <View style={styles.waitingBadge}>
                                        <ActivityIndicator size="small" color={AppTheme.textGrey} style={{ marginRight: 6 }} />
                                        <Text style={styles.waitingText}>Waiting for response</Text>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.declineBtn, { flex: 0, paddingHorizontal: 16 }]}
                                        onPress={() => handleCancel(session.id)}
                                        disabled={actionLoading === session.id}
                                    >
                                        {actionLoading === session.id ? (
                                            <ActivityIndicator size="small" color="white" />
                                        ) : (
                                            <Text style={styles.btnText}>Cancel</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {/* ── Section 2: Upcoming Scheduled (self) ── */}
                {upcomingSelf.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Upcoming Scheduled</Text>
                        {upcomingSelf.map(entry => {
                            const { dateStr, timeStr } = formatDateTime(entry.scheduledFor.toDate());
                            const { programLine, workoutLine, videoLine } = getSelfScheduleTitles(entry);
                            return (
                                <View key={entry.id} style={styles.card}>
                                    <Text style={styles.sessionTypeLabel}>Solo Workout</Text>
                                    <View style={styles.cardHeader}>
                                        <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(20,184,166,0.1)' }]}>
                                            <Calendar color="#14b8a6" size={20} />
                                        </View>
                                        <View style={styles.headerText}>
                                            {programLine ? <Text style={styles.actionText} numberOfLines={1}>{programLine}</Text> : null}
                                            <Text style={styles.userName} numberOfLines={2}>{workoutLine}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailsRow}>
                                        <View style={styles.detailHarp}>
                                            <Calendar color={AppTheme.textGrey} size={14} />
                                            <Text style={styles.detailText}>{dateStr}</Text>
                                        </View>
                                        <View style={styles.detailHarp}>
                                            <Clock color={AppTheme.textGrey} size={14} />
                                            <Text style={styles.detailText}>{timeStr}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.scheduledCardFooter}>
                                        <View style={styles.scheduledSoloBadge}>
                                            <Text style={styles.scheduledSoloBadgeText}>Scheduled · Solo</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.cancelScheduledBtn}
                                            onPress={() => handleCancelScheduled(entry.id)}
                                            disabled={actionLoading === entry.id}
                                            activeOpacity={0.75}
                                        >
                                            {actionLoading === entry.id ? (
                                                <ActivityIndicator size="small" color="#9CA3AF" />
                                            ) : (
                                                <Text style={styles.cancelScheduledText}>Remove</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </>
                )}

                {/* ── Section 3: Upcoming Sessions ── */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Upcoming Sessions</Text>
                {upcoming.length === 0 ? (
                    <EmptyState message="No upcoming sessions — invite a friend!" />
                ) : (
                    upcoming.map(session => {
                        const isHost = session.hostUid === user?.uid;
                        const partnerName = isHost ? session.guestName : session.hostName;
                        const partnerAvatar = isHost ? session.guestAvatarUrl : session.hostAvatarUrl;
                        const countdown = getCountdown(session.scheduledAt.toDate());
                        const diffMs = session.scheduledAt.toDate().getTime() - new Date().getTime();
                        const isStartingNow = diffMs < 10 * 60 * 1000;

                        return (
                            <View key={session.id} style={styles.card}>
                                <Text style={styles.sessionTypeLabel}>Workout with Friend</Text>
                                <View style={styles.cardHeader}>
                                    <View style={styles.avatarPile}>
                                        <View style={[styles.avatarPlaceholder, { zIndex: 2, borderWidth: 2, borderColor: AppTheme.cardColor }]}>
                                            <UserRound color={AppTheme.primaryColor} size={20} />
                                        </View>
                                        <View style={[styles.avatarPlaceholder, { marginLeft: -15, zIndex: 1, backgroundColor: '#333' }]}>
                                            {partnerAvatar ? (
                                                <Image source={{ uri: partnerAvatar }} style={[styles.avatar, { width: 40, height: 40 }]} />
                                            ) : (
                                                <UserRound color="#888" size={20} />
                                            )}
                                        </View>
                                    </View>
                                    <View style={[styles.headerText, { marginLeft: 12 }]}>
                                        <Text style={styles.userName}>You & {partnerName}</Text>
                                        <Text style={[styles.actionText, { color: AppTheme.primaryColor }]}>{countdown}</Text>
                                    </View>
                                </View>

                                <View style={styles.detailsRow}>
                                    <View style={styles.detailHarp}>
                                        <Calendar color={AppTheme.textGrey} size={14} />
                                        <Text style={styles.detailText}>{formatDateTime(session.scheduledAt.toDate()).dateStr}</Text>
                                    </View>
                                    <View style={styles.detailHarp}>
                                        <Clock color={AppTheme.textGrey} size={14} />
                                        <Text style={styles.detailText}>{formatDateTime(session.scheduledAt.toDate()).timeStr}</Text>
                                    </View>
                                </View>

                                <View style={[styles.detailHarp, { marginTop: 8, marginBottom: session.status === 'accepted' ? 16 : 0 }]}>
                                    <Dumbbell color={AppTheme.primaryColor} size={14} />
                                    <Text style={[styles.detailText, { color: AppTheme.textWhite, flex: 1 }]} numberOfLines={1}>
                                        {session.videoTitle}
                                    </Text>
                                </View>

                                {session.status === 'accepted' && (
                                    <TouchableOpacity
                                        style={styles.joinNowButton}
                                        onPress={() => navigation.navigate('SyncedVideoPlayer', {
                                            sessionId: session.id,
                                            videoId: session.videoId,
                                            videoTitle: session.videoTitle,
                                            friendName: partnerName,
                                        })}
                                    >
                                        <Text style={styles.joinNowText}>Join Now</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })
                )}

                {/* ── Section 4: Previous Sessions (only if non-empty) ── */}
                {previous.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Previous Sessions</Text>
                        {previous.map(item => {
                            // Self-scheduled past entry
                            if (item.kind === 'self') {
                                const entry = item.data;
                                const { dateStr, timeStr } = formatDateTime(entry.scheduledFor.toDate());
                                const { programLine, workoutLine, videoLine } = getSelfScheduleTitles(entry);
                                return (
                                    <View key={`self_${entry.id}`} style={styles.pastCard}>
                                        <Text style={styles.sessionTypeLabel}>Solo Workout</Text>
                                        <View style={styles.cardHeader}>
                                            <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(20,184,166,0.08)' }]}>
                                                <Calendar color="#14b8a6" size={20} />
                                            </View>
                                            <View style={[styles.headerText, { marginLeft: 12 }]}>
                                                {programLine ? <Text style={styles.actionText} numberOfLines={1}>{programLine}</Text> : null}
                                                <Text style={styles.userName} numberOfLines={2}>{workoutLine}</Text>
                                                <View style={styles.completedBadge}>
                                                    <Text style={styles.completedText}>Scheduled</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.detailsRow}>
                                            <View style={styles.detailHarp}>
                                                <Calendar color="#555" size={14} />
                                                <Text style={styles.pastDetailText}>{dateStr}</Text>
                                            </View>
                                            <View style={styles.detailHarp}>
                                                <Clock color="#555" size={14} />
                                                <Text style={styles.pastDetailText}>{timeStr}</Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            }

                            // Friend/premade session entry
                            const session = item.data;
                            const isPremade = session.sessionType === 'premade';

                            if (isPremade) {
                                return (
                                    <View key={session.id} style={styles.pastCard}>
                                        <Text style={styles.sessionTypeLabel}>Pre-Made Workout</Text>
                                        <View style={styles.cardHeader}>
                                            <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(255,107,0,0.1)' }]}>
                                                <Play color={AppTheme.primaryColor} size={20} />
                                            </View>
                                            <View style={[styles.headerText, { marginLeft: 12 }]}>
                                                <Text style={styles.userName} numberOfLines={1}>{session.videoTitle}</Text>
                                                <Text style={styles.actionText}>Pre-Made Workout</Text>
                                            </View>
                                        </View>

                                        <View style={styles.detailsRow}>
                                            <View style={styles.detailHarp}>
                                                <Calendar color="#555" size={14} />
                                                <Text style={styles.pastDetailText}>{formatDateTime(session.scheduledAt.toDate()).dateStr}</Text>
                                            </View>
                                            <View style={styles.detailHarp}>
                                                <Clock color="#555" size={14} />
                                                <Text style={styles.pastDetailText}>{formatDateTime(session.scheduledAt.toDate()).timeStr}</Text>
                                            </View>
                                        </View>

                                        <View style={[styles.detailHarp, { marginTop: 8 }]}>
                                            <Dumbbell color="#555" size={14} />
                                            <Text style={[styles.pastDetailText, { flex: 1 }]} numberOfLines={1}>
                                                {session.videoTitle}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            }

                            const isHost = session.hostUid === user?.uid;
                            const partnerName = isHost ? session.guestName : session.hostName;
                            const partnerAvatar = isHost ? session.guestAvatarUrl : session.hostAvatarUrl;

                            const canResend = isHost && session.status !== 'completed';
                            return (
                                <View key={session.id} style={[styles.pastCard, canResend && { opacity: 1 }]}>
                                    <Text style={styles.sessionTypeLabel}>Workout with Friend</Text>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.avatarPile}>
                                            <View style={[styles.avatarPlaceholder, { zIndex: 2, borderWidth: 2, borderColor: AppTheme.cardColor }]}>
                                                <UserRound color="#666" size={20} />
                                            </View>
                                            <View style={[styles.avatarPlaceholder, { marginLeft: -15, zIndex: 1, backgroundColor: '#333' }]}>
                                                {partnerAvatar ? (
                                                    <Image source={{ uri: partnerAvatar }} style={[styles.avatar, { width: 40, height: 40 }]} />
                                                ) : (
                                                    <UserRound color="#666" size={20} />
                                                )}
                                            </View>
                                        </View>
                                        <View style={[styles.headerText, { marginLeft: 12 }]}>
                                            <Text style={styles.userName}>You & {partnerName}</Text>
                                            <View style={[
                                                styles.completedBadge,
                                                session.status === 'declined' && { backgroundColor: 'rgba(239,68,68,0.1)' },
                                                session.status === 'cancelled' && { backgroundColor: 'rgba(107,114,128,0.15)' },
                                                session.status === 'expired' && { backgroundColor: 'rgba(107,114,128,0.15)' },
                                            ]}>
                                                <Text style={[
                                                    styles.completedText,
                                                    session.status === 'declined' && { color: '#EF4444' },
                                                    (session.status === 'cancelled' || session.status === 'expired') && { color: '#6B7280' },
                                                ]}>
                                                    {session.status === 'declined' ? 'Declined'
                                                    : session.status === 'cancelled' ? 'Cancelled'
                                                    : session.status === 'expired' ? 'No Response'
                                                    : 'Completed'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.detailsRow}>
                                        <View style={styles.detailHarp}>
                                            <Calendar color="#555" size={14} />
                                            <Text style={styles.pastDetailText}>{formatDateTime(session.scheduledAt.toDate()).dateStr}</Text>
                                        </View>
                                        <View style={styles.detailHarp}>
                                            <Clock color="#555" size={14} />
                                            <Text style={styles.pastDetailText}>{formatDateTime(session.scheduledAt.toDate()).timeStr}</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.detailHarp, { marginTop: 8 }]}>
                                        <Dumbbell color="#555" size={14} />
                                        <Text style={[styles.pastDetailText, { flex: 1 }]} numberOfLines={1}>
                                            {session.videoTitle}
                                        </Text>
                                    </View>

                                    {/* Resend — only for host, only on declined/cancelled/expired, max 3 times */}
                                    {isHost && session.status !== 'completed' && (() => {
                                        const used = session.resendCount ?? 0;
                                        const maxed = used >= 3;
                                        return (
                                            <View style={styles.resendRow}>
                                                {maxed ? (
                                                    <View style={styles.resendExpiredBadge}>
                                                        <Text style={styles.resendExpiredText}>Resend limit reached</Text>
                                                    </View>
                                                ) : (
                                                    <TouchableOpacity
                                                        style={[styles.resendBtn, actionLoading === session.id && { opacity: 0.5 }]}
                                                        onPress={() => handleResend(session.id)}
                                                        disabled={actionLoading === session.id}
                                                        activeOpacity={0.8}
                                                    >
                                                        {actionLoading === session.id ? (
                                                            <ActivityIndicator size="small" color={AppTheme.primaryColor} />
                                                        ) : (
                                                            <Text style={styles.resendBtnText}>
                                                                Resend Invite
                                                            </Text>
                                                        )}
                                                    </TouchableOpacity>
                                                )}
                                                <Text style={styles.resendCounter}>{used}/3 used</Text>
                                            </View>
                                        );
                                    })()}
                                </View>
                            );
                        })}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppTheme.background },
    centered: { flex: 1, backgroundColor: AppTheme.background, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    scrollContent: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 16 },
    emptyContainer: { padding: 20, alignItems: 'center', backgroundColor: AppTheme.cardColor, borderRadius: 16, opacity: 0.7 },
    emptyText: { color: AppTheme.textGrey, fontSize: 14 },

    card: {
        backgroundColor: AppTheme.cardColor,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,107,0,0.1)', alignItems: 'center', justifyContent: 'center' },
    headerText: { marginLeft: 12, flex: 1 },
    userName: { fontSize: 16, fontWeight: 'bold', color: 'white' },
    actionText: { fontSize: 13, color: AppTheme.textGrey, marginTop: 2 },

    detailsRow: { flexDirection: 'row', gap: 16 },
    detailHarp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { color: AppTheme.textGrey, fontSize: 14 },

    actionsRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6 },
    declineBtn: { backgroundColor: 'rgba(255,255,255,0.1)' },
    acceptBtn: { backgroundColor: AppTheme.primaryColor },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    waitingBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, borderRadius: 10 },
    waitingText: { color: AppTheme.textGrey, fontSize: 13, fontWeight: '500' },

    avatarPile: { flexDirection: 'row', alignItems: 'center' },

    joinNowButton: {
        backgroundColor: '#000000',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginTop: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FF6B00',
    },
    joinNowText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },

    pastCard: {
        backgroundColor: AppTheme.cardColor,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        opacity: 0.6,
    },
    completedBadge: {
        marginTop: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    completedText: {
        color: '#777',
        fontSize: 11,
        fontWeight: '600',
    },
    pastDetailText: {
        color: '#555',
        fontSize: 14,
    },
    sessionTypeLabel: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    sessionMeta: {
        color: AppTheme.primaryColor,
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        marginBottom: 1,
        opacity: 0.75,
    },
    resendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        gap: 10,
    },
    resendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: AppTheme.primaryColor,
        backgroundColor: 'rgba(255,107,0,0.08)',
    },
    resendBtnText: {
        color: AppTheme.primaryColor,
        fontSize: 13,
        fontWeight: '700',
    },
    resendCounter: {
        color: '#555',
        fontSize: 12,
        fontWeight: '500',
    },
    resendExpiredBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(107,114,128,0.12)',
    },
    resendExpiredText: {
        color: '#555',
        fontSize: 12,
        fontWeight: '600',
    },
    scheduledCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    scheduledSoloBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(20,184,166,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(20,184,166,0.25)',
    },
    scheduledSoloBadgeText: {
        color: '#14b8a6',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    cancelScheduledBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cancelScheduledText: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '600',
    },
});
