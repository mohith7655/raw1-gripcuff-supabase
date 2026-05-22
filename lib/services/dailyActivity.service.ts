/**
 * DailyActivityService — source-of-truth streak architecture.
 *
 * Streak rules:
 *   - App open = day logged: ensureTodayActivity() creates a row on every boot.
 *   - Streak = consecutive days a row exists (row presence = user was active that day).
 *   - Watch minutes fill the circle UI but do not affect streak eligibility.
 *
 * Correct call order per flush:
 *   1. incrementWatchMinutes   — save minutes first
 *   2. recalculateUserStreak   — compute from real data
 *   3. profile refetch         — caller responsibility (via onStreakReady callback)
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

// ── Internal streak computation ───────────────────────────────────────────────

async function _recalculateStreak(uid: string): Promise<void> {
    console.log('[StreakCalc] computing streak for', uid);

    const { data, error } = await supabase
        .from('user_daily_activity')
        .select('activity_date, watched_minutes, completed_workouts')
        .eq('user_id', uid)
        .order('activity_date', { ascending: false })
        .limit(400); // ~13 months

    if (error) {
        console.error('[StreakCalc] fetch failed:', error.message);
        return;
    }

    const todayKey = getLocalDateKey();

    // Row existence = user opened the app that day. ensureTodayActivity creates a
    // row on every boot, so any day with a row counts toward the streak regardless
    // of watched_minutes or completed_workouts.
    const activeRows = (data ?? []).filter(r => !!r.activity_date);

    if (activeRows.length === 0) {
        console.log('[StreakCalc] skipping — no active rows in user_daily_activity');
        return;
    }

    const activeDates = new Set<string>(
        activeRows.map(r => {
            console.log('[ActivityRow]', r.activity_date);
            return r.activity_date as string;
        })
    );

    const yesterdayKey = shiftDay(todayKey, -1);

    // Current streak: count consecutive days backwards from today or yesterday
    let currentStreak = 0;
    const startKey = activeDates.has(todayKey)
        ? todayKey
        : activeDates.has(yesterdayKey)
            ? yesterdayKey
            : null;

    if (startKey) {
        let d = startKey;
        while (activeDates.has(d)) {
            console.log('[StreakCalc] checking', d, '✓');
            currentStreak++;
            d = shiftDay(d, -1);
        }
    } else {
        console.log('[StreakCalc] neither today nor yesterday active — streak 0');
    }

    // Best streak: longest consecutive run across all history
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

    console.log('[StreakCalc] final streak', { uid, currentStreak, bestStreak, activeDays: activeDates.size });

    const updates: Record<string, any> = {
        current_streak: currentStreak,
        best_streak:    bestStreak,
        updated_at:     new Date().toISOString(),
    };

    if (activeDates.has(todayKey)) {
        updates.last_workout_date = todayKey;
    } else if (activeDates.has(yesterdayKey)) {
        updates.last_workout_date = yesterdayKey;
    }

    const { error: uErr } = await supabase
        .from('users')
        .update(updates)
        .eq('id', uid);

    if (uErr) {
        console.error('[Streak Write] failed:', uErr.message);
    } else {
        console.log('[Streak Write]', { uid, streak: currentStreak, bestStreak });
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const DailyActivityService = {
    /**
     * Ensure a row exists for today, then immediately recalculate streak.
     * Called on every app boot — the row creation is what marks the day active
     * (row exists = user opened the app = streak day).
     * ignoreDuplicates:true means existing rows are left untouched (minutes preserved).
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
            return;
        }

        console.log('[DailyActivity] row ensured', { today });

        // Boot-time reconciliation: if users.today_watch_seconds > 0 but
        // user_daily_activity.watched_minutes = 0, the two systems drifted out of
        // sync (e.g. increment_watch_time fired but upsert_daily_watch_minutes never
        // did because startSession wasn't called on web). Fix it once at boot.
        const [profileRes, dailyRes] = await Promise.all([
            supabase
                .from('users')
                .select('today_watch_seconds, last_video_watch_at')
                .eq('id', uid)
                .maybeSingle(),
            supabase
                .from('user_daily_activity')
                .select('watched_minutes')
                .eq('user_id', uid)
                .eq('activity_date', today)
                .maybeSingle(),
        ]);

        const todayWatchSeconds = Number(profileRes.data?.today_watch_seconds || 0);
        const dailyMinutes      = Number(dailyRes.data?.watched_minutes || 0);
        const lastWatchAt       = profileRes.data?.last_video_watch_at ?? null;

        // today_watch_seconds resets on UTC day boundaries (increment_watch_time RPC).
        // Guard against writing stale minutes: compare the UTC date of last_video_watch_at
        // against today's LOCAL date (same mixed comparison used in HomeScreen).
        // For IST +5:30: a 19:40 UTC session = 01:10 IST next day → UTC date '2026-05-22'
        // does not match local today '2026-05-23' → boot sync correctly blocked.
        const lastWatchDateUtc = lastWatchAt
            ? new Date(lastWatchAt).toISOString().split('T')[0]
            : null;

        if (todayWatchSeconds > 0 && dailyMinutes === 0 && lastWatchDateUtc === today) {
            const minutesToSync = todayWatchSeconds / 60;
            console.log(`[DailyActivity] boot sync: syncing ${minutesToSync.toFixed(2)} minutes from users table`);
            const { error: syncErr } = await supabase.rpc('upsert_daily_watch_minutes', {
                p_user_id: uid,
                p_date:    today,
                p_minutes: minutesToSync,
            });
            if (syncErr) {
                console.error('[DailyActivity] boot sync failed:', syncErr.message);
            } else {
                console.log(`[DailyActivity] boot sync OK: ${minutesToSync.toFixed(2)}m written to user_daily_activity`);
            }
        } else if (todayWatchSeconds > 0 && lastWatchDateUtc !== today) {
            console.log(`[DailyActivity] boot sync skipped — today_watch_seconds (${todayWatchSeconds}s) is stale from UTC ${lastWatchDateUtc ?? 'unknown'}, not local today (${today})`);
        }

        // Row exists → recalculate streak so today is counted immediately.
        await _recalculateStreak(uid);
    },

    /**
     * Atomically increment today's watched_minutes via the server-side RPC.
     * Called from WatchTrackingService after each successful flush.
     * Always call recalculateUserStreak immediately after this.
     */
    async incrementWatchMinutes(uid: string, minutes: number): Promise<void> {
        if (minutes <= 0) return;
        const today = getLocalDateKey();
        console.log('[DailyActivity] incrementing minutes', { uid, minutes: minutes.toFixed(3), today });

        const rounded = Math.round(minutes * 100) / 100;
        console.log('[DailyActivity] upsert_daily_watch_minutes →', { p_user_id: uid, p_date: today, p_minutes: rounded });
        const { error } = await supabase.rpc('upsert_daily_watch_minutes', {
            p_user_id: uid,
            p_date:    today,
            p_minutes: rounded,
        });

        if (error) {
            console.error('[DailyActivity] upsert_daily_watch_minutes FAILED:', error.message, error);
            throw new Error(`upsert_daily_watch_minutes: ${error.message}`);
        } else {
            console.log('[DailyActivity] upsert_daily_watch_minutes OK', { date: today, minutes: minutes.toFixed(4) });
        }
    },

    /**
     * Compute current/best streak from user_daily_activity rows and write to users table.
     * Every row counts as an active day — no minutes threshold.
     */
    async recalculateUserStreak(uid: string): Promise<void> {
        return _recalculateStreak(uid);
    },
};
