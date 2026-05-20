import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    StatusBar,
    Platform,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FriendService } from '../services/friend.service';
import { subscribeLiveViewersForVideo, LiveViewerEntry } from '../services/liveViewers.service';
import { subscribeScheduledForVideo, ScheduledEntry } from '../services/scheduledWorkouts.service';
import { StrangerInviteService } from '../services/StrangerInviteService';
import { LiveSessionService } from '../services/liveSession.service';
import { useUser } from '../providers/UserContext';
import { useAuth } from '../providers/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BG = '#0d1520';
const CARD_BG = '#111e2e';
const TEAL = '#14b8a6';
const FRIEND_GREEN = '#22c55e';
const ACCENT = '#F97316';
const MUTED = '#607a94';

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarColor(name: string): string {
    const palette = ['#D4622A', '#8B5CF6', '#10B981', '#3B82F6', '#E8732A'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
}

function initials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
}

function formatJoinedAgo(ts: Date | null): string {
    if (!ts) return 'just now';
    const diffMs = Date.now() - (ts instanceof Date ? ts.getTime() : 0);
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
}

function formatScheduledTime(ts: Date): string {
    const d = ts instanceof Date ? ts : new Date(ts);
    const isToday = d.toDateString() === new Date().toDateString();
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

// ── YouTube embed (web only) ──────────────────────────────────────────────────

const WebYouTubePlayer = ({ ytId }: { ytId: string }) => {
    const url = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;
    if (Platform.OS === 'web') {
        return (
            <View style={{ width: '100%', height: 220 }}>
                <iframe
                    width="100%"
                    height="220"
                    src={url}
                    title="Workout video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={({ border: 'none' } as any)}
                />
            </View>
        );
    }
    return (
        <View style={s.videoPlaceholder}>
            <Ionicons name="play-circle-outline" size={48} color={ACCENT} />
            <Text style={s.videoPlaceholderText}>Open on mobile to watch</Text>
        </View>
    );
};

// ── Row components ────────────────────────────────────────────────────────────

interface ViewerRowProps {
    entry: LiveViewerEntry;
    onJoin: () => void;
    onInvite: () => void;
    loading: boolean;
}

function ViewerRow({ entry, onJoin, onInvite, loading }: ViewerRowProps) {
    const color = avatarColor(entry.displayName);
    return (
        <View style={row.card}>
            <View style={[row.avatar, { backgroundColor: color }]}>
                <Text style={row.avatarText}>{initials(entry.displayName)}</Text>
            </View>
            <View style={row.info}>
                <View style={row.nameRow}>
                    <Text style={row.name}>{entry.displayName}</Text>
                    {entry.isFriend && (
                        <View style={row.friendBadge}>
                            <Text style={row.friendBadgeText}>Friend</Text>
                        </View>
                    )}
                </View>
                <Text style={row.sub}>Joined {formatJoinedAgo(entry.joinedAt)}</Text>
            </View>
            {loading ? (
                <ActivityIndicator size="small" color={TEAL} />
            ) : entry.isFriend ? (
                <TouchableOpacity style={row.joinBtn} onPress={onJoin} activeOpacity={0.75}>
                    <Text style={row.joinBtnText}>Join</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={row.inviteBtn} onPress={onInvite} activeOpacity={0.75}>
                    <Text style={row.inviteBtnText}>Invite</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

interface ScheduledRowProps {
    entry: ScheduledEntry;
    onJoin: () => void;
    onInvite: () => void;
    loading: boolean;
}

function ScheduledRow({ entry, onJoin, onInvite, loading }: ScheduledRowProps) {
    const color = avatarColor(entry.displayName);
    const isSolo = !entry.isShared && !entry.partnerUid;
    return (
        <View style={row.card}>
            <View style={[row.avatar, { backgroundColor: color }]}>
                <Text style={row.avatarText}>{initials(entry.displayName)}</Text>
            </View>
            <View style={row.info}>
                <View style={row.nameRow}>
                    <Text style={row.name}>{entry.displayName}</Text>
                    {entry.isFriend && (
                        <View style={row.friendBadge}>
                            <Text style={row.friendBadgeText}>Friend</Text>
                        </View>
                    )}
                    {isSolo && (
                        <View style={row.soloBadge}>
                            <Text style={row.soloBadgeText}>Solo</Text>
                        </View>
                    )}
                </View>
                <Text style={row.sub}>{formatScheduledTime(entry.scheduledFor)}</Text>
            </View>
            {loading ? (
                <ActivityIndicator size="small" color={TEAL} />
            ) : entry.isFriend ? (
                <TouchableOpacity style={row.joinBtn} onPress={onJoin} activeOpacity={0.75}>
                    <Text style={row.joinBtnText}>Join</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={row.inviteBtn} onPress={onInvite} activeOpacity={0.75}>
                    <Text style={row.inviteBtnText}>Invite</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
    return (
        <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{title}</Text>
            {count > 0 && (
                <View style={s.countBadge}>
                    <Text style={s.countBadgeText}>{count}</Text>
                </View>
            )}
        </View>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function VideoDetailScreen({ route, navigation }: any) {
    const { supabaseUserId, email } = useAuth();
    const { profile } = useUser();

    const { videoId, videoTitle, youtubeId, videoUrl } = route.params ?? {};

    const [friendUids, setFriendUids] = useState<string[]>([]);
    const [liveViewers, setLiveViewers] = useState<LiveViewerEntry[]>([]);
    const [scheduled, setScheduled] = useState<ScheduledEntry[]>([]);
    const [loadingAction, setLoadingAction] = useState<string | null>(null); // stores uid of in-flight action

    const unsubLiveRef = useRef<(() => void) | null>(null);
    const unsubScheduledRef = useRef<(() => void) | null>(null);

    const currentName =
        profile?.fullName ??
        profile?.username ??
        email?.split('@')[0] ??
        'Me';
    const currentAvatar: string | null =
        (profile as any)?.profileImageUrl ?? null;

    // ── 1. Fetch friend UIDs once ─────────────────────────────────────────────
    useEffect(() => {
        if (!supabaseUserId) return;
        FriendService.getFriendUids(supabaseUserId).then(setFriendUids).catch(() => {});
    }, [supabaseUserId]);

    // ── 2. Subscribe to live viewers & scheduled workouts ─────────────────────
    useEffect(() => {
        if (!videoId || !supabaseUserId) return;

        unsubLiveRef.current?.();
        unsubScheduledRef.current?.();

        unsubLiveRef.current = subscribeLiveViewersForVideo(
            videoId,
            supabaseUserId,
            friendUids,
            setLiveViewers
        );

        unsubScheduledRef.current = subscribeScheduledForVideo(
            videoId,
            supabaseUserId,
            friendUids,
            setScheduled
        );

        return () => {
            unsubLiveRef.current?.();
            unsubScheduledRef.current?.();
        };
    }, [videoId, supabaseUserId, friendUids]);

    // ── Action handlers ───────────────────────────────────────────────────────

    const handleJoinFriend = async (targetUid: string, targetName: string) => {
        if (!supabaseUserId) return;
        setLoadingAction(targetUid);
        try {
            const sessionId = `premade_${targetUid}_${videoId}`;

            await LiveSessionService.requestToJoin(sessionId, {
                uid: supabaseUserId,
                name: currentName,
                avatarUrl: currentAvatar,
            });

            navigation.navigate('SyncedVideoPlayer', {
                sessionId,
                videoId,
                videoTitle: videoTitle ?? '',
                friendName: targetName,
            });
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not join session');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleInviteSocial = async (
        targetUid: string,
        targetName: string
    ) => {
        if (!supabaseUserId) return;
        setLoadingAction(targetUid);
        try {
            await StrangerInviteService.createInvite({
                inviterId: supabaseUserId,
                targetUserId: targetUid,
                workoutId: videoId,
                workoutTitle: videoTitle ?? '',
            });
            Alert.alert('Invite sent', `${targetName} has been invited to this workout.`);
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not send invite');
        } finally {
            setLoadingAction(null);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const hasYT = !!youtubeId && youtubeId.length === 11 && !youtubeId.includes('http');

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* ── Video player ─────────────────────────────────────── */}
            <View style={s.playerWrap}>
                <TouchableOpacity
                    style={s.backBtn}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                {hasYT ? (
                    <WebYouTubePlayer ytId={youtubeId} />
                ) : (
                    <View style={s.videoPlaceholder}>
                        <Ionicons name="play-circle-outline" size={52} color={ACCENT} />
                        <Text style={s.videoPlaceholderText}>{videoTitle ?? 'Workout'}</Text>
                    </View>
                )}
            </View>

            {/* ── Social sections ──────────────────────────────────── */}
            <ScrollView
                style={s.scroll}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Watching Now */}
                <SectionHeader title="Watching Now" count={liveViewers.length} />
                {liveViewers.length === 0 ? (
                    <Text style={s.empty}>No one is watching right now.</Text>
                ) : (
                    liveViewers.map((v) => (
                        <ViewerRow
                            key={v.uid}
                            entry={v}
                            loading={loadingAction === v.uid}
                            onJoin={() => handleJoinFriend(v.uid, v.displayName)}
                            onInvite={() => handleInviteSocial(v.uid, v.displayName)}
                        />
                    ))
                )}

                {/* Scheduled Later */}
                <View style={{ marginTop: 24 }}>
                    <SectionHeader title="Scheduled Later" count={scheduled.length} />
                </View>
                {scheduled.length === 0 ? (
                    <Text style={s.empty}>No upcoming scheduled workouts for this video.</Text>
                ) : (
                    scheduled.map((e) => (
                        <ScheduledRow
                            key={e.id}
                            entry={e}
                            loading={loadingAction === e.userId}
                            onJoin={() => handleJoinFriend(e.userId, e.displayName)}
                            onInvite={() => handleInviteSocial(e.userId, e.displayName)}
                        />
                    ))
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: BG,
    },
    playerWrap: {
        width: SCREEN_WIDTH,
        height: 220,
        backgroundColor: '#000',
    },
    backBtn: {
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    videoPlaceholderText: {
        color: MUTED,
        fontSize: 14,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    countBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    countBadgeText: {
        color: MUTED,
        fontSize: 12,
        fontWeight: '600',
    },
    empty: {
        color: MUTED,
        fontSize: 14,
        marginBottom: 8,
    },
});

const row = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        gap: 12,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    avatarText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    info: {
        flex: 1,
        gap: 3,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    name: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    sub: {
        color: MUTED,
        fontSize: 12,
    },
    friendBadge: {
        backgroundColor: 'rgba(34,197,94,0.15)',
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    friendBadgeText: {
        color: FRIEND_GREEN,
        fontSize: 11,
        fontWeight: '700',
    },
    soloBadge: {
        backgroundColor: 'rgba(96,122,148,0.2)',
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    soloBadgeText: {
        color: MUTED,
        fontSize: 11,
        fontWeight: '600',
    },
    joinBtn: {
        backgroundColor: TEAL,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexShrink: 0,
    },
    joinBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    inviteBtn: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        flexShrink: 0,
    },
    inviteBtnText: {
        color: '#cbd5e1',
        fontSize: 13,
        fontWeight: '600',
    },
});
