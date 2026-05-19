import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Calendar, Dumbbell, UserPlus, X } from 'lucide-react-native';
import { Timestamp } from 'firebase/firestore';
import { SocialOpenEntry, SocialScheduledEntry } from '../../hooks/useWorkoutSocialHub';

const ACCENT = '#F97316';

type SocialUser = {
    uid: string;
    displayName: string;
    username: string;
    age?: number | null;
    gender?: string | null;
    data?: {
        age?: number | null;
        gender?: string | null;
    } | null;
};

type Props = {
    visible: boolean;
    onClose: () => void;
    onInvite: (user: SocialUser) => void;
    onAddFriend: (user: SocialUser) => void;
    viewers?: SocialUser[];
    videoId?: string;
    currentUid?: string;
    friendUids?: string[];
    socialHub?: {
        scheduled: SocialScheduledEntry[];
        open: SocialOpenEntry[];
        badges: { live: number; scheduled: number; open: number };
    };
    onJoin?: (user: { uid: string; displayName: string }) => void;
};

function avatarColor(name: string): string {
    const palette = ['#D4622A', '#8B5CF6', '#10B981', '#3B82F6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

function formatScheduledTime(ts: Timestamp): string {
    const d = ts.toDate();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Today, ${timeStr}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${timeStr}`;
    return (
        d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
        `, ${timeStr}`
    );
}

function Avatar({ name }: { name: string }) {
    const initial = (name || '?').charAt(0).toUpperCase();
    return (
        <View style={[styles.avatar, { backgroundColor: avatarColor(name || '?') }]}>
            <Text style={styles.avatarText}>{initial}</Text>
        </View>
    );
}

function ViewerMeta({ user }: { user: SocialUser }) {
    const rawAge = user.age ?? user.data?.age;
    const rawGender = user.gender ?? user.data?.gender;
    const age = rawAge && rawAge > 0 ? String(rawAge) : null;
    const gender = rawGender
        ? rawGender.charAt(0).toUpperCase() + rawGender.slice(1).toLowerCase()
        : null;
    const meta = [age, gender].filter(Boolean).join(' • ');
    if (!meta) return null;
    return <Text style={styles.userMeta}>{meta}</Text>;
}

export function InviteStrangerModal({
    visible,
    onClose,
    onInvite,
    onAddFriend,
    viewers,
    currentUid,
    friendUids = [],
    socialHub,
    onJoin,
}: Props) {
    const live = viewers ?? [];
    const scheduled = socialHub?.scheduled ?? [];
    const open = socialHub?.open ?? [];
    const badges = socialHub?.badges ?? {
        live: live.length,
        scheduled: scheduled.length,
        open: open.length,
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

            <View style={styles.sheet}>
                <View style={styles.header}>
                    <Text style={styles.title}>Workout Social Hub</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <X color="#9CA3AF" size={20} />
                    </TouchableOpacity>
                </View>

                <View style={styles.badgesRow}>
                    <Text style={styles.countBadge}>LIVE • {badges.live}</Text>
                    <Text style={styles.countBadge}>SCHEDULED • {badges.scheduled}</Text>
                    <Text style={styles.countBadge}>OPEN • {badges.open}</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>LIVE NOW</Text>
                        {live.length === 0 ? (
                            <Text style={styles.emptyText}>You're the only one here.</Text>
                        ) : (
                            live.map((user, i) => (
                                <View key={user.uid} style={[styles.row, i < live.length - 1 && styles.rowBorder]}>
                                    <Avatar name={user.displayName || user.username} />
                                    <View style={styles.userBlock}>
                                        <Text style={styles.userName}>{user.displayName || user.username}</Text>
                                        <ViewerMeta user={user} />
                                    </View>
                                    <View style={styles.rowActions}>
                                        <TouchableOpacity style={styles.softBtn} onPress={() => onAddFriend(user)}>
                                            <UserPlus color={ACCENT} size={13} />
                                            <Text style={styles.softBtnText}>Add</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.ctaBtn} onPress={() => onInvite(user)}>
                                            <Dumbbell color="#fff" size={13} />
                                            <Text style={styles.ctaBtnText}>Invite</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>SCHEDULED TODAY</Text>
                        {scheduled.length === 0 ? (
                            <Text style={styles.emptyText}>No upcoming public schedules yet.</Text>
                        ) : (
                            scheduled.map((item, i) => {
                                const programLine = item.programTitle || null;
                                const workoutLine = item.combinedTitle || item.workoutTitle || item.videoTitle;
                                const videoLine = item.videoTitle;
                                const isMine = item.userId === currentUid;
                                const isFriend = !isMine && friendUids.includes(item.userId);
                                return (
                                    <View key={item.id} style={[styles.row, i < scheduled.length - 1 && styles.rowBorder]}>
                                        <Avatar name={item.displayName} />
                                        <View style={styles.userBlock}>
                                            <Text style={styles.userName}>{item.displayName}</Text>
                                            <Text style={styles.userMeta}>{formatScheduledTime(item.scheduledFor)}</Text>
                                            {programLine ? <Text style={styles.scheduleTop}>{programLine}</Text> : null}
                                            <Text style={styles.scheduleTop}>{workoutLine}</Text>
                                            {videoLine !== workoutLine ? <Text style={styles.scheduleBottom}>{videoLine}</Text> : null}
                                        </View>
                                        <View style={styles.rowActions}>
                                            {isMine ? (
                                                <View style={styles.scheduledBadge}>
                                                    <Text style={styles.scheduledBadgeText}>Scheduled</Text>
                                                </View>
                                            ) : isFriend ? (
                                                <TouchableOpacity
                                                    style={styles.joinBtn}
                                                    onPress={() => onJoin?.({ uid: item.userId, displayName: item.displayName })}
                                                >
                                                    <Text style={styles.joinBtnText}>Join</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    style={styles.ctaBtn}
                                                    onPress={() => onInvite({
                                                        uid: item.userId,
                                                        displayName: item.displayName,
                                                        username: item.displayName,
                                                    })}
                                                >
                                                    <Text style={styles.ctaBtnText}>Invite</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>OPEN STRANGER SESSIONS</Text>
                        {open.length === 0 ? (
                            <Text style={styles.emptyText}>No open sessions right now.</Text>
                        ) : (
                            open.map((item, i) => (
                                <View key={item.id} style={[styles.row, i < open.length - 1 && styles.rowBorder]}>
                                    <Avatar name={item.hostName || 'Athlete'} />
                                    <View style={styles.userBlock}>
                                        <Text style={styles.userName}>{item.title}</Text>
                                        <Text style={styles.userMeta}>
                                            {item.subtitle}
                                            {item.startsAt ? ` • ${formatScheduledTime(item.startsAt)}` : ''}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.joinBtn}
                                        onPress={() => {
                                            if (item.hostUid && item.hostName) {
                                                onJoin?.({ uid: item.hostUid, displayName: item.hostName });
                                            }
                                        }}
                                        disabled={!item.hostUid || !item.hostName}
                                    >
                                        <Calendar color="#fff" size={13} />
                                        <Text style={styles.joinBtnText}>Join</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
        backgroundColor: '#111827',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 18,
        paddingBottom: 36,
        maxHeight: '80%',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    badgesRow: {
        paddingHorizontal: 20,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    countBadge: {
        color: '#E5E7EB',
        fontSize: 11,
        fontWeight: '700',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        overflow: 'hidden',
    },
    scrollContent: {
        paddingHorizontal: 14,
        paddingBottom: 12,
    },
    section: {
        marginTop: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    sectionTitle: {
        color: '#C7D2FE',
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 6,
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 13,
        paddingVertical: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: '700',
    },
    userBlock: {
        flex: 1,
    },
    userName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    userMeta: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    scheduleTop: {
        color: '#F3F4F6',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    scheduleBottom: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    rowActions: {
        flexDirection: 'row',
        gap: 6,
    },
    softBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.4)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    softBtnText: {
        color: ACCENT,
        fontSize: 12,
        fontWeight: '700',
    },
    ctaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: ACCENT,
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 6,
    },
    ctaBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    joinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#0ea5a3',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    joinBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    scheduledBadge: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    scheduledBadgeText: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '600',
    },
    liveNowPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
    },
    liveNowText: {
        color: '#ef4444',
        fontSize: 12,
        fontWeight: '600',
    },
});
