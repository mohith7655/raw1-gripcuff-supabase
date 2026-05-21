/**
 * DailyActivityService — source-of-truth streak architecture.
 *
 * user_daily_activity has one row per (user, day).
 * A day is "active" when watched_minutes > 0.
 * Streak is computed by counting consecutive active days backwards from today.
 *
 * This replaces video-completion callbacks as the streak source.
 * Works reliably on web, mobile, Netlify, and background resume.
 */

import { supabase } from '../core/config/supabase';
import { getDateKey } from '../utils/streakDate';

// ── Date helpers ──────────────────────────────────────────────────────────────

function getLocalDateKey(): string {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return getDateKey(tz);
}

function shiftDay(dateKey: string, delta: number): string {
    const d = new Date(dateKey + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const DailyActivityService = {
    /**
     * Ensure a row exists for today. Called on app boot / login.
     * If the row already exists this is a no-op (ignoreDuplicates).
     */
    async ensureTodayActivity(uid: string): Promise<void> {
        const today = getLocalDateKey();
        console.log('[DailyActivity] ensuring today row', { uid, today });

        const { error } = await supabase
            .from('user_daily_activity')
            .upsert(
                { user_id: uid, activity_date: today, watched_minutes: 0, completed_workouts: 0 },
                { onConflict: 'user_id,activity_date', ignoreDuplicates: true }
            );

        if (error) {
            console.error('[DailyActivity] ensureTodayActivity failed:', error.message);
        } else {
            console.log('[DailyActivity] row created', { today });
        }
    },

    /**
     * Atomically increment today's watched_minutes via the server-side RPC.
     * Called from WatchTrackingService after each successful flush.
     */
    async incrementWatchMinutes(uid: string, minutes: number): Promise<void> {
        if (minutes <= 0) return;
        const today = getLocalDateKey();
        console.log('[DailyActivity] incrementing minutes', { uid, minutes: minutes.toFixed(3), today });

        const { error } = await supabase.rpc('upsert_daily_watch_minutes', {
            p_user_id: uid,
            p_date:    today,
            p_minutes: minutes,
        });

        if (error) {
            console.error('[DailyActivity] incrementWatchMinutes failed:', error.message);
        }
    },

    /**
     * Compute current/best streak from user_daily_activity rows, then write
     * current_streak, best_streak, last_workout_date, and weekly_activity back
     * to the users table so all existing consumers (profile, leaderboard) stay correct.
     *
     * Call on: app boot, app foreground, login, after workout completion.
     */
    async recalculateUserStreak(uid: string): Promise<void> {
        console.log('[StreakCalc] computing streak for', uid);

        const { data, error } = await supabase
            .from('user_daily_activity')
            .select('activity_date, watched_minutes')
            .eq('user_id', uid)
            .order('activity_date', { ascending: false })
            .limit(400); // ~13 months

        if (error) {
            console.error('[StreakCalc] fetch failed:', error.message);
            return;
        }

        // Active days = rows where the user actually watched something
        const activeDates = new Set<string>(
            (data ?? [])
                .filter(r => Number(r.watched_minutes) > 0)
                .map(r => r.activity_date as string)
        );

        const todayKey     = getLocalDateKey();
        const yesterdayKey = shiftDay(todayKey, -1);

        // Current streak: consecutive active days ending today or yesterday
        let currentStreak = 0;
        const startKey = activeDates.has(todayKey)
            ? todayKey
            : activeDates.has(yesterdayKey)
                ? yesterdayKey
                : null;

        if (startKey) {
            let d = startKey;
            while (activeDates.has(d)) {
                currentStreak++;
                d = shiftDay(d, -1);
            }
        }

        // Best streak: scan sorted dates for the longest consecutive run
        const sortedDates = Array.from(activeDates).sort();
        let bestStreak = currentStreak;
        let runStreak  = 0;
        let prevKey: string | null = null;

        for (const d of sortedDates) {
            if (prevKey !== null && d === shiftDay(prevKey, 1)) {
                runStreak++;
            } else {
                runStreak = 1;
            }
            prevKey = d;
            if (runStreak > bestStreak) bestStreak = runStreak;
        }

        console.log('[StreakCalc] computed streak', {
            currentStreak,
            bestStreak,
            activeDays: activeDates.size,
        });

        // Rebuild weekly_activity for the last 30 days (used by HomeScreen circles)
        const cutoff = shiftDay(todayKey, -30);
        const weeklyActivity: Record<string, boolean> = {};
        for (const d of activeDates) {
            if (d >= cutoff) weeklyActivity[d] = true;
        }

        const updates: Record<string, any> = {
            current_streak:  currentStreak,
            best_streak:     bestStreak,
            weekly_activity: weeklyActivity,
            updated_at:      new Date().toISOString(),
        };

        if (activeDates.has(todayKey)) {
            updates.last_workout_date = todayKey;
        }

        console.log('[StreakCalc] updating user cache', { currentStreak, bestStreak });

        const { error: uErr } = await supabase
            .from('users')
            .update(updates)
            .eq('id', uid);

        if (uErr) {
            console.error('[StreakCalc] user update failed:', uErr.message);
        } else {
            console.log('[StreakCalc] user cache updated', { currentStreak, bestStreak });
        }
    },
};
