import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Image,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
// Leaderboard queries are handled by `LeaderboardService`
import { LeaderboardEntry, LeaderboardService } from '../services/leaderboard.service';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';

type Tab = 'self' | 'weekly' | 'monthly';

const formatSeconds = (secs: number) => {
    if (!secs) return '0s';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : (m > 0 ? `${m}m ${s}s` : `${s}s`);
};

export function LeaderboardScreen() {
    const { supabaseUserId } = useAuth();
    const navigation = useNavigation<any>();
    const currentUid = supabaseUserId ?? null;

    const { profile } = useUser();

    const [selectedPeriod, setSelectedPeriod] = useState<Tab>('self');
    const [users, setUsers] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [weeklyTop, setWeeklyTop] = useState<LeaderboardEntry[]>([]);
    const [monthlyTop, setMonthlyTop] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        setLoading(true);
        setUsers([]);

        if (selectedPeriod === 'weekly') {
            const unsub = LeaderboardService.subscribeWeeklyLeaderboard((entries) => {
                setUsers(entries);
                setLoading(false);
            }, (e) => { console.error(e); setLoading(false); });
            return () => unsub();
        }

        if (selectedPeriod === 'monthly') {
            const unsub = LeaderboardService.subscribeMonthlyLeaderboard((entries) => {
                setUsers(entries);
                setLoading(false);
            }, (e) => { console.error(e); setLoading(false); });
            return () => unsub();
        }

        // self tab doesn't subscribe to leaderboard list
        setLoading(false);
        return;
    }, [selectedPeriod]);

    // Preload top lists for insights (non-blocking)
    useEffect(() => {
        const u1 = LeaderboardService.subscribeWeeklyLeaderboard((entries) => setWeeklyTop(entries), (e) => console.warn(e));
        const u2 = LeaderboardService.subscribeMonthlyLeaderboard((entries) => setMonthlyTop(entries), (e) => console.warn(e));
        return () => { u1(); u2(); };
    }, []);

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

    const renderRow = (item: LeaderboardEntry, index: number, isCurrentUser: boolean) => {
        const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
        const rankColor = index < 3 ? rankColors[index] : '#445566';
        const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

        return (
            <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
                <View style={styles.rankCol}>
                    {rankEmoji ? (
                        <Text style={styles.rankEmoji}>{rankEmoji}</Text>
                    ) : (
                        <Text style={[styles.rankNum, { color: rankColor }]}>{index + 1}</Text>
                    )}
                </View>

                <View style={[styles.avatarCircle, { backgroundColor: isCurrentUser ? '#FF6B00' : '#1e3a5f' }]}>
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
                    <Text style={[styles.nameText, isCurrentUser && { color: '#FF6B00' }]} numberOfLines={1}>
                        {item.displayName || 'User'}{isCurrentUser ? ' (You)' : ''}
                    </Text>
                    <Text style={styles.subText}>
                        💪 {item.workoutsCompleted || 0} workouts · 🔥 {item.currentStreak || 0} day streak
                    </Text>
                </View>

                <Text style={[styles.scoreText, { color: (item.score || 0) > 0 ? '#FF6B00' : '#445566' }]}> 
                    {formatSeconds((item.score || 0) * 60)}
                </Text>
            </View>
        );
    };

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
                {(['self', 'weekly', 'monthly'] as Tab[]).map((p) => (
                    <TouchableOpacity
                        key={p}
                        style={[styles.tab, selectedPeriod === p && styles.tabActive]}
                        onPress={() => setSelectedPeriod(p)}
                    >
                        <Text style={[styles.tabText, selectedPeriod === p && styles.tabTextActive]}>
                            {p === 'self' ? 'Self Stats' : p === 'weekly' ? 'Weekly' : 'Monthly'}
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
    const [displaySecs, setDisplaySecs] = useState<number>(0);

    useEffect(() => {
        let total = 0;
        if (profile) {
            if (profile.totalWorkoutSeconds) total = profile.totalWorkoutSeconds;
            else if (profile.totalWorkoutMinutes) total = profile.totalWorkoutMinutes * 60;
            else if (profile.totalMinutes) total = profile.totalMinutes * 60;
        }
        setDisplaySecs(total);
        const t = setInterval(() => setDisplaySecs(s => s + 1), 1000);
        return () => clearInterval(t);
    }, [profile]);

    const thisWeek = profile?.weeklyWorkoutSeconds ?? (profile?.weeklyWorkoutMinutes ? profile.weeklyWorkoutMinutes * 60 : 0);
    const thisMonth = profile?.monthlyWorkoutSeconds ?? (profile?.monthlyWorkoutMinutes ? profile.monthlyWorkoutMinutes * 60 : 0);
    const lifetime = displaySecs;

    // compute approximate percentile from weeklyTop
    const weeklyRank = weeklyTop.findIndex(e => e.uid === uid);
    const weeklyPercent = weeklyRank >= 0 ? Math.round((1 - (weeklyRank / Math.max(1, weeklyTop.length))) * 100) : null;

    return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            <View style={styles.heroCard}>
                <View style={styles.heroLeft}>
                    <Text style={styles.heroLabel}>🔥 Total Time Trained</Text>
                    <Text style={styles.heroTime}>{formatSeconds(displaySecs)}</Text>
                    <Text style={styles.heroSub}>Lifetime • Live</Text>
                </View>
                <View style={styles.heroRight}>
                    <View style={styles.ringPlaceholder} />
                </View>
            </View>

            <View style={styles.statRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>This Week</Text>
                    <Text style={styles.statValue}>{formatSeconds(thisWeek)}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>This Month</Text>
                    <Text style={styles.statValue}>{formatSeconds(thisMonth)}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Workouts</Text>
                    <Text style={styles.statValue}>{profile?.totalWorkouts ?? profile?.workouts ?? 0}</Text>
                </View>
            </View>

            <View style={[styles.statRow, { marginTop: 12 }]}> 
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Current Streak</Text>
                    <Text style={styles.statValue}>{profile?.currentStreak ?? 0} days</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Active Days</Text>
                    <Text style={styles.statValue}>{profile?.activeDays ?? 0}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Calories</Text>
                    <Text style={styles.statValue}>{profile?.caloriesBurned ?? '—'}</Text>
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
        borderWidth: 1,
        borderColor: '#FF6B00',
        backgroundColor: '#1a1200',
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
    nameText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
    heroTime: { color: '#fff', fontSize: 26, fontWeight: '800' },
    heroSub: { color: '#8899aa', fontSize: 12, marginTop: 6 },
    heroRight: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center' },
    ringPlaceholder: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, borderColor: 'rgba(255,107,0,0.18)' },

    statRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    statCard: { flex: 1, backgroundColor: '#07121a', padding: 12, borderRadius: 12, alignItems: 'center' },
    statLabel: { color: '#8899aa', fontSize: 12, fontWeight: '700' },
    statValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 6 },
    insightText: { color: '#FFB88A', marginTop: 6, fontWeight: '600' },
});
