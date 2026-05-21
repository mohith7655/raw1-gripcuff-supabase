import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Image,
    Platform,
    Animated,
    Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
// Leaderboard queries are handled by `LeaderboardService`
import { LeaderboardEntry, LeaderboardService } from '../services/leaderboard.service';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { User } from '../models/User';

type Tab = 'self' | 'weekly' | 'alltime';

function formatWatchTime(seconds: number): string {
    const secs = Number(seconds) || 0;
    if (secs < 60) return `${Math.round(secs)}s`;
    if (secs < 3600) return `${(secs / 60).toFixed(1)}m`;
    return `${(secs / 3600).toFixed(1)}h`;
}

const LeaderboardRow = memo(function LeaderboardRow({
    item,
    index,
    isMe,
}: {
    item: LeaderboardEntry;
    index: number;
    isMe: boolean;
}) {
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!isMe) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                Animated.timing(glowAnim, { toValue: 0, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [isMe]);

    const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    const rankColor = index < 3 ? rankColors[index] : '#445566';
    const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

    return (
        <Animated.View
            style={[
                styles.row,
                isMe && styles.rowHighlight,
                isMe && { opacity: glowOpacity },
            ]}
        >
            <View style={styles.rankCol}>
                {rankEmoji ? (
                    <Text style={styles.rankEmoji}>{rankEmoji}</Text>
                ) : (
                    <Text style={[styles.rankNum, { color: rankColor }]}>{index + 1}</Text>
                )}
            </View>

            <View style={[styles.avatarCircle, { backgroundColor: isMe ? '#FF6B00' : '#1e3a5f' }]}>
                {item.photoURL ? (
                    Platform.OS === 'web' ? (
                        <img
                            src={item.photoURL}
                            style={({ width: 44, height: 44, borderRadius: 22, objectFit: 'cover' } as any)}
                        />
                    ) : (
                        <Image source={{ uri: item.photoURL }} style={styles.avatarImg} />
                    )
                ) : (
                    <Text style={styles.avatarLetter}>
                        {(item.displayName || 'U')[0].toUpperCase()}
                    </Text>
                )}
            </View>

            <View style={styles.infoCol}>
                <View style={styles.nameRow}>
                    <Text style={[styles.nameText, isMe && styles.nameMeText]} numberOfLines={1}>
                        {item.displayName || 'User'}
                    </Text>
                    {isMe && <View style={styles.youBadge}><Text style={styles.youBadgeText}>YOU</Text></View>}
                </View>
                <Text style={styles.subText}>
                    💪 {item.workoutsCompleted || 0} workouts · 🔥 {item.currentStreak || 0} day streak
                </Text>
            </View>

            <Text style={[styles.scoreText, { color: (item.score || 0) > 0 ? '#FF6B00' : '#445566' }]}>
                {formatWatchTime(item.score || 0)}
            </Text>
        </Animated.View>
    );
});

// Inject the current user into a fetched leaderboard if they're absent (cut off by limit or zero score).
// Re-sorts with the same criteria as the Supabase query: streak DESC, score DESC.
// Returns the original array untouched if the user is already present.
function injectSelf(
    entries: LeaderboardEntry[],
    currentUid: string | null,
    profile: User | null,
): LeaderboardEntry[] {
    if (!currentUid || !profile) return entries;

    const alreadyExists = entries.some(r => r.uid === currentUid);
    console.log('[Leaderboard] fetched rows:', entries.length);
    console.log('[Leaderboard] self exists:', alreadyExists);

    if (alreadyExists) return entries;

    console.log('[Leaderboard] current user injected');
    const selfEntry: LeaderboardEntry = {
        uid: currentUid,
        displayName: profile.username || profile.fullName || 'You',
        photoURL: profile.profileImageUrl || '',
        score: Number(profile.watchedSeconds ?? 0),
        currentStreak: Number(profile.currentStreak ?? 0),
        bestStreak: Number(profile.bestStreak ?? 0),
        workouts: Number(profile.completedWorkouts ?? 0),
        liveSessions: Number(profile.totalLiveSessions ?? 0),
        workoutsCompleted: Number(profile.completedWorkouts ?? 0),
    };

    const merged = [...entries, selfEntry];
    merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return merged;
}

export function LeaderboardScreen() {
    const { supabaseUserId } = useAuth();
    const navigation = useNavigation<any>();
    const currentUid = supabaseUserId ?? null;

    const { profile, fetchProfile } = useUser();
    // Keep a ref so subscription closures always see the latest profile
    // without needing to recreate subscriptions on every profile update.
    const profileRef = useRef(profile);
    useEffect(() => { profileRef.current = profile; }, [profile]);

    // Refresh profile from Supabase every time this screen gains focus.
    // This ensures streak/watch-time values are always current, not stale from
    // the initial app load or a realtime event that was blocked by the debounce.
    useFocusEffect(
        useCallback(() => {
            if (currentUid) fetchProfile(currentUid);
        }, [currentUid, fetchProfile])
    );

    const [selectedPeriod, setSelectedPeriod] = useState<Tab>('self');
    const [users, setUsers] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [weeklyTop, setWeeklyTop] = useState<LeaderboardEntry[]>([]);
    const [monthlyTop, setMonthlyTop] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        setLoading(true);
        setUsers([]);

        if (selectedPeriod === 'weekly') {
            const unsub = LeaderboardService.subscribeWeeklyLeaderboard(currentUid || '', (entries) => {
                setUsers(injectSelf(entries, currentUid, profileRef.current));
                setLoading(false);
            }, (e) => { console.error(e); setLoading(false); });
            return () => unsub();
        }

        if (selectedPeriod === 'alltime') {
            const unsub = LeaderboardService.subscribeAllTimeLeaderboard(currentUid || '', (entries) => {
                setUsers(injectSelf(entries, currentUid, profileRef.current));
                setLoading(false);
            }, (e) => { console.error(e); setLoading(false); });
            return () => unsub();
        }

        // self tab doesn't subscribe to leaderboard list
        setLoading(false);
        return;
    }, [selectedPeriod, currentUid]);

    // Preload top lists for insights (non-blocking)
    useEffect(() => {
        if (!currentUid) return;
        const u1 = LeaderboardService.subscribeWeeklyLeaderboard(currentUid, (entries) => setWeeklyTop(injectSelf(entries, currentUid, profileRef.current)), (e) => console.warn(e));
        const u2 = LeaderboardService.subscribeAllTimeLeaderboard(currentUid, (entries) => setMonthlyTop(injectSelf(entries, currentUid, profileRef.current)), (e) => console.warn(e));
        return () => { u1(); u2(); };
    }, [currentUid]);

    const currentUserEntry = users.find(u => u.uid === currentUid) ?? null;
    const currentUserInList = users.some(u => u.uid === currentUid);

    const userTotalSeconds = (() => {
        if (!profile) return 0;
        if ((profile as any).totalWorkoutSeconds) return (profile as any).totalWorkoutSeconds as number;
        if ((profile as any).totalWorkoutMinutes) return ((profile as any).totalWorkoutMinutes as number) * 60;
        if ((profile as any).totalWorkoutMinutesApprox) return ((profile as any).totalWorkoutMinutesApprox as number) * 60;
        // fallback to leaderboards alltime totalMinutes if present
        return (profile as any).totalMinutes ? (profile as any).totalMinutes * 60 : 0;
    })();

    const renderRow = (item: LeaderboardEntry, index: number, isCurrentUser: boolean) => (
        <LeaderboardRow item={item} index={index} isMe={isCurrentUser} />
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                    <Text style={styles.backBtn}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Leaderboard</Text>
                <View style={{ width: 38 }} />
            </View>

            <View style={styles.tabs}>
                {(['self', 'weekly', 'alltime'] as Tab[]).map((p) => (
                    <TouchableOpacity
                        key={p}
                        style={[styles.tab, selectedPeriod === p && styles.tabActive]}
                        onPress={() => setSelectedPeriod(p)}
                    >
                        <Text style={[styles.tabText, selectedPeriod === p && styles.tabTextActive]}>
                            {p === 'self' ? 'Self Stats' : p === 'weekly' ? 'Weekly' : 'All Time'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {selectedPeriod === 'self' ? (
                <SelfStatsView
                    profile={profile}
                    uid={currentUid}
                    weeklyTop={weeklyTop}
                    monthlyTop={monthlyTop}
                />
            ) : (
                (loading ? (
                    <ActivityIndicator color="#FF6B00" style={{ marginTop: 40 }} />
                ) : users.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No users yet</Text>
                    </View>
                ) : (
                    <FlatList
                        data={users}
                        keyExtractor={(item) => item.uid}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: currentUserEntry && !currentUserInList ? 110 : 40 }}
                        renderItem={({ item, index }) =>
                            renderRow(item, index, item.uid === currentUid)
                        }
                    />
                ))
            )}

            {selectedPeriod !== 'self' && currentUserEntry && !currentUserInList && (
                <View style={styles.pinnedContainer}>
                    <Text style={styles.pinnedLabel}>YOUR RANK</Text>
                    {renderRow(currentUserEntry, users.length, true)}
                </View>
            )}
        </SafeAreaView>
    );
}

function SelfStatsView({ profile, uid, weeklyTop, monthlyTop }: { profile: any; uid: string | null; weeklyTop: LeaderboardEntry[]; monthlyTop: LeaderboardEntry[] }) {
    console.log('[Leaderboard Self Stats]', {
        currentStreak: profile?.currentStreak,
        bestStreak: profile?.bestStreak,
        watchedMinutes: profile?.watchedMinutes,
    });

    // watched_seconds is the canonical source for total accumulated watch time
    const lifetimeSecs = Number(profile?.watchedSeconds ?? 0);

    // Weekly: sum from weekly leaderboard entry for self, or today's seconds as proxy
    const selfWeeklyEntry = weeklyTop.find(e => e.uid === uid);
    const thisWeekSecs = selfWeeklyEntry
        ? Number(selfWeeklyEntry.score ?? 0)
        : Number(profile?.todayWatchSeconds ?? 0);

    // Monthly: sum from monthly leaderboard for self
    const selfMonthlyEntry = monthlyTop.find(e => e.uid === uid);
    const thisMonthSecs = selfMonthlyEntry
        ? Number(selfMonthlyEntry.score ?? 0)
        : lifetimeSecs;

    // compute approximate percentile from weeklyTop
    const weeklyRank = weeklyTop.findIndex(e => e.uid === uid);
    const weeklyPercent = weeklyRank >= 0 ? Math.round((1 - (weeklyRank / Math.max(1, weeklyTop.length))) * 100) : null;

    return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            <View style={styles.heroCard}>
                <View style={styles.heroLeft}>
                    <Text style={styles.heroLabel}>🔥 Total Time Trained</Text>
                    <Text style={styles.heroTime}>{formatWatchTime(lifetimeSecs)}</Text>
                    <Text style={styles.heroSub}>Lifetime Total</Text>
                </View>
                <View style={styles.heroRight}>
                    <View style={styles.ringPlaceholder} />
                </View>
            </View>

            <View style={styles.statRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>This Week</Text>
                    <Text style={styles.statValue}>{formatWatchTime(thisWeekSecs)}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>This Month</Text>
                    <Text style={styles.statValue}>{formatWatchTime(thisMonthSecs)}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Workouts</Text>
                    <Text style={styles.statValue}>{profile?.completedWorkouts ?? profile?.totalWorkouts ?? 0}</Text>
                </View>
            </View>

            <View style={[styles.statRow, { marginTop: 12 }]}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Current Streak</Text>
                    <Text style={styles.statValue}>{profile?.currentStreak ?? 0} days</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Best Streak</Text>
                    <Text style={styles.statValue}>{profile?.bestStreak ?? 0} days</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Today</Text>
                    <Text style={styles.statValue}>{formatWatchTime(Number(profile?.todayWatchSeconds ?? 0))}</Text>
                </View>
            </View>

            <View style={{ marginTop: 18 }}>
                {weeklyPercent != null ? (
                    <Text style={styles.insightText}>You're ahead of {weeklyPercent}% of users this week</Text>
                ) : (
                    <Text style={styles.insightText}>Keep going — compete with others on the Weekly tab</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d1520' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    backBtn: { fontSize: 32, color: '#fff', fontWeight: '300', lineHeight: 36 },
    title: { fontSize: 22, fontWeight: '700', color: '#fff' },
    tabs: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 20,
        backgroundColor: '#1e2d3d',
        borderRadius: 12,
        padding: 4,
    },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
    tabActive: { backgroundColor: '#FF6B00' },
    tabText: { color: '#8899aa', fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f1923',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 10,
        gap: 12,
    },
    rowHighlight: {
        backgroundColor: '#1a1500',
        borderWidth: 1.5,
        borderColor: '#FF7A00',
        shadowColor: '#FF7A00',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
    rankCol: { width: 32, alignItems: 'center' },
    rankEmoji: { fontSize: 22 },
    rankNum: { fontSize: 16, fontWeight: '700' },
    avatarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImg: { width: 44, height: 44, borderRadius: 22 },
    avatarLetter: { color: '#fff', fontSize: 18, fontWeight: '700' },
    infoCol: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nameText: { color: '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1 },
    nameMeText: { color: '#FF7A00' },
    youBadge: {
        backgroundColor: '#FF7A00',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    youBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    subText: { color: '#8899aa', fontSize: 11, marginTop: 2 },
    scoreText: { fontSize: 13, fontWeight: '700', minWidth: 50, textAlign: 'right' },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: '#8899aa', fontSize: 15 },
    pinnedContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0d1520',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,107,0,0.25)',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 20,
    },
    pinnedLabel: {
        color: '#FF6B00',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 6,
    },
    heroCard: {
        backgroundColor: '#07121a',
        borderRadius: 14,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    heroLeft: { flex: 1 },
    heroLabel: { color: '#FFB88A', fontSize: 12, fontWeight: '700', marginBottom: 6 },
    heroTime: { color: '#FF7A00', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
    heroSub: { color: '#8899aa', fontSize: 12, marginTop: 6 },
    heroRight: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center' },
    ringPlaceholder: { width: 80, height: 80, borderRadius: 40, borderWidth: 8, borderColor: 'rgba(255,122,0,0.35)' },

    statRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    statCard: { flex: 1, backgroundColor: '#07121a', padding: 12, borderRadius: 12, alignItems: 'center' },
    statLabel: { color: '#8899aa', fontSize: 12, fontWeight: '700' },
    statValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 6 },
    insightText: { color: '#FFB88A', marginTop: 6, fontWeight: '600' },
});
