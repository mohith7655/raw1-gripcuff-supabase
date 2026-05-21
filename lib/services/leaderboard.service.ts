import { supabase } from '../core/config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

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

// ── Singleton channel state ───────────────────────────────────────────────────
// Each channel is created exactly once regardless of how many components
// subscribe. A ref-count tracks active subscribers; the channel is removed
// only when the last subscriber unsubscribes.

interface ChannelEntry {
    channel:   RealtimeChannel;
    count:     number;
    callbacks: Set<() => void>;
}

const _channels: Record<string, ChannelEntry> = {};

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function fetchLeaderboardEntries(
    onData:   (entries: LeaderboardEntry[]) => void,
    onError?: (e: Error) => void,
) {
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
            username:       row.username,
            current_streak: row.current_streak,
        });
        return {
            uid:              row.id,
            displayName:      row.username || row.full_name || 'User',
            photoURL:         row.avatar_url || '',
            score:            Number(row.watched_seconds ?? 0),
            currentStreak:    Number(row.current_streak ?? 0),
            bestStreak:       Number(row.best_streak ?? 0),
            workouts:         Number(row.completed_workouts ?? 0),
            liveSessions:     Number(row.total_live_sessions ?? 0),
            workoutsCompleted: Number(row.completed_workouts ?? 0),
        };
    });

    onData(entries);
}

// ── Singleton subscribe helper ─────────────────────────────────────────────────

function subscribeLeaderboard(
    name:     string,
    onData:   (entries: LeaderboardEntry[]) => void,
    onError?: (e: Error) => void,
): () => void {
    const refresh = () => fetchLeaderboardEntries(onData, onError);

    // Always do an initial fetch for this subscriber
    refresh();

    if (!_channels[name]) {
        // First subscriber — create the channel
        console.log('[Leaderboard] creating realtime channel', name);
        const ch = supabase.channel(name);
        const callbacks = new Set<() => void>();

        ch.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'users' },
            () => {
                console.log('[Leaderboard] realtime update —', name);
                callbacks.forEach(cb => cb());
            },
        );
        ch.subscribe((status) => {
            console.log('[Leaderboard] channel status', name, status);
        });

        _channels[name] = { channel: ch, count: 0, callbacks };
    }

    _channels[name].callbacks.add(refresh);
    _channels[name].count++;

    return () => {
        const entry = _channels[name];
        if (!entry) return;

        entry.callbacks.delete(refresh);
        entry.count--;

        if (entry.count <= 0) {
            console.log('[Leaderboard] removing realtime channel', name);
            supabase.removeChannel(entry.channel);
            delete _channels[name];
        }
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const LeaderboardService = {
    subscribeWeeklyLeaderboard(
        _userId: string,
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void,
    ): () => void {
        return subscribeLeaderboard('lb-weekly', onData, onError);
    },

    subscribeMonthlyLeaderboard(
        _userId: string,
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void,
    ): () => void {
        return subscribeLeaderboard('lb-monthly', onData, onError);
    },

    subscribeAllTimeLeaderboard(
        _userId: string,
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void,
    ): () => void {
        return subscribeLeaderboard('lb-alltime', onData, onError);
    },
};

export async function initializeCurrentUserOnLeaderboard(
    _uid: string,
    _userData: { username?: string; fullName?: string; email?: string; profileImageUrl?: string; currentStreak?: number } = {}
): Promise<void> {}

export async function backfillLeaderboardUser(
    _uid: string,
    _data: {
        currentStreak: number;
        totalMinutes: number;
        workoutsCompleted: number;
        workoutMinutes: number;
        score: number;
    }
): Promise<void> {}

export async function addWorkoutMinutes(_uid: string, _minutes: number): Promise<void> {}
