import { supabase } from '../core/config/supabase';

export type LeaderboardEntry = {
    uid: string;
    displayName: string;
    photoURL: string;
    score: number;
    currentStreak: number;
    bestStreak: number;
    workouts: number;
    liveSessions: number;
    totalMinutes?: number;
    workoutsCompleted?: number;
};

function makeChannelName(prefix: string): string {
    return `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function fetchLeaderboardEntries(onData: (entries: LeaderboardEntry[]) => void, onError?: (e: Error) => void) {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, current_streak, best_streak, completed_workouts, total_live_sessions, watched_seconds')
        .or('username.not.is.null,full_name.not.is.null')
        .order('watched_seconds', { ascending: false })
        .limit(50);

    if (error) {
        onError?.(new Error(error.message));
        return;
    }

    const entries: LeaderboardEntry[] = (data || []).map(row => {
        console.log('[Leaderboard User]', {
            username: row.username,
            current_streak: row.current_streak,
            best_streak: row.best_streak,
        });
        return {
            uid: row.id,
            displayName: row.username || row.full_name || 'User',
            photoURL: row.avatar_url || '',
            score: Number(row.watched_seconds ?? 0),
            currentStreak: Number(row.current_streak ?? 0),
            bestStreak: Number(row.best_streak ?? 0),
            workouts: Number(row.completed_workouts ?? 0),
            liveSessions: Number(row.total_live_sessions ?? 0),
            workoutsCompleted: Number(row.completed_workouts ?? 0),
        };
    });

    onData(entries);
}

function subscribeLeaderboard(
    channelPrefix: string,
    onData: (entries: LeaderboardEntry[]) => void,
    onError?: (e: Error) => void
): () => void {
    const refresh = () => fetchLeaderboardEntries(onData, onError);

    // Initial fetch
    refresh();

    // Always create a fresh channel with a unique name to avoid the
    // "cannot add postgres_changes callbacks after subscribe()" error that occurs
    // when supabase.channel(name) returns an already-subscribed channel instance.
    const channelName = makeChannelName(channelPrefix);
    console.log('[Leaderboard] creating realtime channel', channelName);

    const channel = supabase.channel(channelName);

    channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
            console.log('[Leaderboard] realtime update', payload);
            refresh();
        }
    );

    console.log('[Leaderboard] subscribing', channelName);
    channel.subscribe((status) => {
        console.log('[Leaderboard] subscribed', channelName, status);
    });

    return () => {
        console.log('[Leaderboard] removing realtime channel', channelName);
        supabase.removeChannel(channel);
    };
}

export const LeaderboardService = {
    subscribeWeeklyLeaderboard(
        _userId: string,
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        return subscribeLeaderboard('lb-weekly', onData, onError);
    },

    subscribeMonthlyLeaderboard(
        _userId: string,
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        return subscribeLeaderboard('lb-monthly', onData, onError);
    },

    subscribeAllTimeLeaderboard(
        _userId: string,
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        return subscribeLeaderboard('lb-alltime', onData, onError);
    },
};

export async function initializeCurrentUserOnLeaderboard(
    uid: string,
    userData: { username?: string; fullName?: string; email?: string; profileImageUrl?: string; currentStreak?: number } = {}
): Promise<void> {}

export async function backfillLeaderboardUser(
    uid: string,
    data: {
        currentStreak: number;
        totalMinutes: number;
        workoutsCompleted: number;
        workoutMinutes: number;
        score: number;
    }
): Promise<void> {}

export async function addWorkoutMinutes(uid: string, minutes: number): Promise<void> {}
