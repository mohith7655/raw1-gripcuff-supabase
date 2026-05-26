/**
 * LiveViewersModal
 *
 * Bottom-sheet that shows who is currently watching the same workout video.
 * Tapping "Add" sends a friend request with optimistic UI update.
 * Updates in real-time because `viewers` comes from `useWorkoutWatchers`.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { X, UserCheck, UserPlus, Clock } from 'lucide-react-native';
import { ActiveWatcher } from '../services/WorkoutWatcherService';
import { FriendService } from '../services/friend.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT   = '#FF6B00';
const SHEET_BG = '#0f1923';
const CARD_BG  = 'rgba(255,255,255,0.04)';
const PALETTE  = ['#D4622A', '#8B5CF6', '#10B981', '#3B82F6', '#E84393'];

function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return PALETTE[Math.abs(h) % PALETTE.length];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, uri, size = 44 }: { name: string; uri?: string | null; size?: number }) {
    const [err, setErr] = useState(false);
    if (uri && !err) {
        return (
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
                onError={() => setErr(true)}
            />
        );
    }
    return (
        <View style={[
            { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
            { backgroundColor: avatarColor(name) },
        ]}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>
                {(name || '?')[0].toUpperCase()}
            </Text>
        </View>
    );
}

// ─── Stacked avatar overlay (bonus: shown on the LIVE pill in the parent) ────
// Re-exported so SharedVideoPlayer can use them without importing the modal.

interface StackedAvatarsProps {
    viewers: ActiveWatcher[];
    currentUid?: string | null;
    maxVisible?: number;
    size?: number;
}

export function StackedAvatars({ viewers, currentUid, maxVisible = 3, size = 24 }: StackedAvatarsProps) {
    const others = viewers.filter(v => v.uid !== currentUid).slice(0, maxVisible);
    if (others.length === 0) return null;
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {others.map((v, i) => (
                <View
                    key={v.uid}
                    style={{
                        marginLeft: i === 0 ? 0 : -(size * 0.3),
                        borderRadius: size / 2,
                        borderWidth: 1.5,
                        borderColor: '#0f1923',
                        zIndex: others.length - i,
                    }}
                >
                    <Avatar name={v.username || v.displayName || '?'} uri={v.profilePhoto} size={size} />
                </View>
            ))}
        </View>
    );
}

// ─── Viewer row ───────────────────────────────────────────────────────────────

type FriendStatus = 'none' | 'friends' | 'sent' | 'self';

interface ViewerRowProps {
    viewer: ActiveWatcher;
    status: FriendStatus;
    onAdd: (uid: string) => void;
}

function ViewerRow({ viewer, status, onAdd }: ViewerRowProps) {
    const name = viewer.username || viewer.displayName || 'Viewer';

    return (
        <View style={row.container}>
            <Avatar name={name} uri={viewer.profilePhoto} size={44} />

            <View style={row.info}>
                <Text style={row.username}>@{name}</Text>
                {viewer.joinedAt ? (
                    <View style={row.joinedRow}>
                        <Clock size={10} color="rgba(255,255,255,0.35)" />
                        <Text style={row.joinedText}>
                            {formatJoined(viewer.joinedAt)}
                        </Text>
                    </View>
                ) : null}
            </View>

            {status === 'self' ? (
                <View style={row.badgeSelf}>
                    <Text style={row.badgeSelfText}>You</Text>
                </View>
            ) : status === 'friends' ? (
                <View style={row.badgeFriends}>
                    <UserCheck size={13} color="#10B981" />
                    <Text style={row.badgeFriendsText}>Friends</Text>
                </View>
            ) : status === 'sent' ? (
                <View style={row.badgeRequested}>
                    <Clock size={12} color="rgba(255,255,255,0.4)" />
                    <Text style={row.badgeRequestedText}>Requested</Text>
                </View>
            ) : (
                <TouchableOpacity
                    style={row.addBtn}
                    onPress={() => onAdd(viewer.uid)}
                    activeOpacity={0.75}
                >
                    <UserPlus size={13} color="#fff" />
                    <Text style={row.addBtnText}>Add</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

function formatJoined(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1)  return 'Just joined';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface LiveViewersModalProps {
    visible: boolean;
    viewers: ActiveWatcher[];
    currentUid: string | null;
    /** Friend UIDs already fetched by the parent screen. */
    friendUids: string[];
    onClose: () => void;
}

export function LiveViewersModal({
    visible,
    viewers,
    currentUid,
    friendUids,
    onClose,
}: LiveViewersModalProps) {
    const slideAnim = useRef(new Animated.Value(500)).current;
    const fadeAnim  = useRef(new Animated.Value(0)).current;

    // Optimistic "sent request" set — merges fetched outgoing + user actions
    const [sentUids, setSentUids] = useState<Set<string>>(new Set());
    const [loadingReqs, setLoadingReqs] = useState(false);

    // Self pinned first, then everyone else
    const selfEntry = viewers.find(v => v.uid === currentUid);
    const others    = viewers.filter(v => v.uid !== currentUid);
    const allViewers = selfEntry ? [selfEntry, ...others] : others;

    // Animate in / out
    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
                Animated.timing(fadeAnim,  { toValue: 1, duration: 180, useNativeDriver: true }),
            ]).start();
            // Fetch outgoing pending requests
            if (currentUid) {
                setLoadingReqs(true);
                FriendService.getOutgoingRequests(currentUid)
                    .then(reqs => setSentUids(new Set(reqs.map(r => r.toUid))))
                    .catch(() => {})
                    .finally(() => setLoadingReqs(false));
            }
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }),
                Animated.timing(fadeAnim,  { toValue: 0,   duration: 160, useNativeDriver: true }),
            ]).start();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const getStatus = useCallback((uid: string): FriendStatus => {
        if (uid === currentUid)       return 'self';
        if (friendUids.includes(uid)) return 'friends';
        if (sentUids.has(uid))        return 'sent';
        return 'none';
    }, [currentUid, friendUids, sentUids]);

    const handleAdd = useCallback((uid: string) => {
        if (!currentUid) return;
        // Optimistic update
        setSentUids(prev => new Set([...prev, uid]));
        FriendService.sendFriendRequest(currentUid, uid).catch(() => {
            // Revert on failure
            setSentUids(prev => {
                const next = new Set(prev);
                next.delete(uid);
                return next;
            });
        });
    }, [currentUid]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            {/* Scrim */}
            <Animated.View style={[s.scrim, { opacity: fadeAnim }]}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

                {/* Sheet */}
                <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
                    {/* Handle */}
                    <View style={s.handle} />

                    {/* Header */}
                    <View style={s.header}>
                        <View style={s.headerLeft}>
                            <PulsingDot size={8} />
                            <Text style={s.headerTitle}>Watching Now</Text>
                            {allViewers.length > 0 && (
                                <View style={s.countPill}>
                                    <Text style={s.countPillText}>{allViewers.length}</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
                            <X size={20} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                    </View>

                    {/* List */}
                    <ScrollView
                        style={{ flexGrow: 0, maxHeight: 340 }}
                        contentContainerStyle={s.listContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {loadingReqs && allViewers.length === 0 ? (
                            <ActivityIndicator color={ACCENT} style={{ marginVertical: 32 }} />
                        ) : allViewers.length === 0 ? (
                            <View style={s.empty}>
                                <Text style={s.emptyEmoji}>👀</Text>
                                <Text style={s.emptyTitle}>Solo session</Text>
                                <Text style={s.emptyBody}>No one else is watching right now.</Text>
                            </View>
                        ) : (
                            allViewers.map((viewer, i) => (
                                <React.Fragment key={viewer.uid}>
                                    <ViewerRow
                                        viewer={viewer}
                                        status={getStatus(viewer.uid)}
                                        onAdd={handleAdd}
                                    />
                                    {i < allViewers.length - 1 && <View style={s.divider} />}
                                </React.Fragment>
                            ))
                        )}
                    </ScrollView>

                    {/* Bottom safe-area padding */}
                    <View style={{ height: 16 }} />
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

// ─── Pulsing dot (exported for reuse in SharedVideoPlayer) ───────────────────

interface PulsingDotProps {
    size?: number;
    color?: string;
}

export function PulsingDot({ size = 8, color = '#22C55E' }: PulsingDotProps) {
    const breathe = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(breathe, {
                    toValue: 1,
                    duration: 3000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(breathe, {
                    toValue: 0,
                    duration: 3000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const scale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
    const opacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.0] });

    return (
        <Animated.View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scale }],
            opacity,
        }} />
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    scrim: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: SHEET_BG,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 8,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    handle: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.18)',
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    countPill: {
        backgroundColor: ACCENT,
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    countPillText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    closeBtn: {
        padding: 4,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginHorizontal: 4,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 6,
    },
    emptyEmoji: {
        fontSize: 36,
        marginBottom: 4,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    emptyBody: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        textAlign: 'center',
    },
});

const row = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    info: {
        flex: 1,
        gap: 3,
    },
    username: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    joinedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    joinedText: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 11,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: ACCENT,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
    },
    addBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    badgeSelf: {
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.4)',
        backgroundColor: 'rgba(255,107,0,0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    badgeSelfText: {
        color: '#FF6B00',
        fontSize: 12,
        fontWeight: '700',
    },
    badgeFriends: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.35)',
        backgroundColor: 'rgba(16,185,129,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    badgeFriendsText: {
        color: '#10B981',
        fontSize: 12,
        fontWeight: '600',
    },
    badgeRequested: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    badgeRequestedText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '500',
    },
});
