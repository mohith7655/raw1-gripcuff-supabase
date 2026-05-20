import { supabase } from '../core/config/supabase';

export type LeaderboardEntry = {
    uid: string;
    displayName: string;
    photoURL: string;
    score: number;
    currentStreak: number;
    workouts: number;
    liveSessions: number;
    totalMinutes?: number;
    workoutsCompleted?: number;
};

export const LeaderboardService = {
    subscribeWeeklyLeaderboard(
        userId: string,
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        const fetchEntries = async () => {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, avatar_url, current_streak, completed_workouts, total_live_sessions, watched_seconds')
                .order('current_streak', { ascending: false })
                .order('watched_seconds', { ascending: false })
                .limit(50);
            if (error) {
                onError?.(new Error(error.message));
                return;
            }
            const entries: LeaderboardEntry[] = (data || []).map(row => ({
                uid: row.id,
                displayName: row.full_name || 'User',
                photoURL: row.avatar_url || '',
                score: row.watched_seconds ?? 0,
                currentStreak: row.current_streak ?? 0,
                workouts: row.completed_workouts ?? 0,
                liveSessions: row.total_live_sessions ?? 0,
                workoutsCompleted: row.completed_workouts ?? 0,
            }));
            onData(entries);
        };

        fetchEntries();

        if (!userId) {
            return () => {};
        }

        const channel = supabase
            .channel(`leaderboard-user-weekly:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
                () => {
                    console.log('[Leaderboard] User profile updated, re-fetching weekly leaderboard...');
                    fetchEntries();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    subscribeMonthlyLeaderboard(
        userId: string,
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        const fetchEntries = async () => {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, avatar_url, current_streak, completed_workouts, total_live_sessions, watched_seconds')
                .order('current_streak', { ascending: false })
                .order('watched_seconds', { ascending: false })
                .limit(50);
            if (error) {
                onError?.(new Error(error.message));
                return;
            }
            const entries: LeaderboardEntry[] = (data || []).map(row => ({
                uid: row.id,
                displayName: row.full_name || 'User',
                photoURL: row.avatar_url || '',
                score: row.watched_seconds ?? 0,
                currentStreak: row.current_streak ?? 0,
                workouts: row.completed_workouts ?? 0,
                liveSessions: row.total_live_sessions ?? 0,
                workoutsCompleted: row.completed_workouts ?? 0,
            }));
            onData(entries);
        };

        fetchEntries();

        if (!userId) {
            return () => {};
        }

        const channel = supabase
            .channel(`leaderboard-user-monthly:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
                () => {
                    console.log('[Leaderboard] User profile updated, re-fetching monthly leaderboard...');
                    fetchEntries();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    subscribeAllTimeLeaderboard(
        userId: string,
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        const fetchEntries = async () => {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, avatar_url, current_streak, completed_workouts, total_live_sessions, watched_seconds')
                .order('current_streak', { ascending: false })
                .order('watched_seconds', { ascending: false })
                .limit(50);
            if (error) {
                onError?.(new Error(error.message));
                return;
            }
            const entries: LeaderboardEntry[] = (data || []).map(row => ({
                uid: row.id,
                displayName: row.full_name || 'User',
                photoURL: row.avatar_url || '',
                score: row.watched_seconds ?? 0,
                currentStreak: row.current_streak ?? 0,
                workouts: row.completed_workouts ?? 0,
                liveSessions: row.total_live_sessions ?? 0,
                workoutsCompleted: row.completed_workouts ?? 0,
            }));
            onData(entries);
        };

        fetchEntries();

        if (!userId) {
            return () => {};
        }

        const channel = supabase
            .channel(`leaderboard-user-alltime:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
                () => {
                    console.log('[Leaderboard] User profile updated, re-fetching alltime leaderboard...');
                    fetchEntries();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
