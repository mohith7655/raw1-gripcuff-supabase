/**
 * DailyActivityService — source-of-truth streak architecture.
 *
 * user_daily_activity: one row per (user, day).
 * A day is "active" when watched_minutes > 0.
 * Streak = consecutive active days, backwards from today (or yesterday).
 *
 * recalculateUserStreak fallback cascade when user_daily_activity has no active rows:
 *   1. Check users.last_workout_date. If it's today/yesterday, fix/preserve streak there.
 *   2. If not, check workout_activity for recent rows. Backfill user_daily_activity and recurse.
 *   3. If nothing found, log and return — never write 0 over an existing positive streak.
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

function getLocalTz(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// ── Fallback: fix streak from users table when user_daily_activity has no active rows ──

async function _fixStreakFromUsersTable(uid: string): Promise<boolean> {
    const { data: userRow } = await supabase
        .from('users')
        .select('current_streak, best_streak, last_workout_date')
        .eq('id', uid)
        .maybeSingle();

    const existingStreak = Number(userRow?.current_streak ?? 0);
    const bestStreak     = Number(userRow?.best_streak ?? 0);
    const lastDate: string | null = userRow?.last_workout_date ?? null;

    const todayKey     = getLocalDateKey();
    const yesterdayKey = shiftDay(todayKey, -1);

    if (lastDate !== todayKey && lastDate !== yesterdayKey) {
        console.log('[StreakCalc] last_workout_date is not recent:', lastDate, '— trying workout_activity fallback');
        return false; // not recent — fall through to workout_activity check
    }

    if (existingStreak > 0) {
        // Streak value is already correct — touch updated_at to fire realtime and refresh UI.
        console.log('[StreakCalc] last_workout_date is recent, streak already correct:', existingStreak);
        await supabase
            .from('users')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', uid);
        return true;
    }

    // last_workout_date is today/yesterday but current_streak is 0 — compute and fix.
    // Without full activity history we can only guarantee at least 1 consecutive day.
    const correctedStreak = 1;
    const newBestStreak   = Math.max(bestStreak, correctedStreak);
    console.log('[StreakCalc] fixing zero streak — last_workout_date is recent, writing streak:', correctedStreak);

    const { error } = await supabase
        .from('users')
        .update({
            current_streak: correctedStreak,
            best_streak:    newBestStreak,
            updated_at:     new Date().toISOString(),
        })
        .eq('id', uid);

    if (error) {
        console.error('[Streak Write] failed:', error.message);
    } else {
        console.log('[Streak Write]', { uid, streak: correctedStreak, bestStreak: newBestStreak });
    }
    return true;
}

// ── Fallback: backfill user_daily_activity from workout_activity, then recompute ──

async function _backfillFromWorkoutActivity(uid: string): Promise<boolean> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities, error } = await supabase
        .from('workout_activity')
        .select('completed_at, watched_minutes')
        .eq('user_id', uid)
        .gte('completed_at', thirtyDaysAgo.toISOString())
        .order('completed_at', { ascending: false });

    if (error) {
        console.warn('[StreakCalc] workout_activity fetch failed:', error.message);
        return false;
    }

    if (!activities || activities.length === 0) {
        console.log('[StreakCalc] no workout_activity rows — cannot backfill');
        return false;
    }

    const tz = getLocalTz();
    const minutesByDay: Record<string, number> = {};
    for (const act of activities) {
        const dateKey = new Date(act.completed_at).toLocaleDateString('en-CA', { timeZone: tz });
        minutesByDay[dateKey] = (minutesByDay[dateKey] ?? 0) + (Number(act.watched_minutes) || 1);
    }

    console.log('[StreakCalc] backfilling user_daily_activity from workout_activity:', Object.keys(minutesByDay));

    for (const [dateKey, minutes] of Object.entries(minutesByDay)) {
        const { error: uErr } = await supabase.rpc('upsert_daily_watch_minutes', {
            p_user_id: uid,
            p_date:    dateKey,
            p_minutes: minutes,
        });
        if (uErr) {
            console.warn('[StreakCalc] backfill upsert failed for', dateKey, uErr.message);
        }
    }

    return true;
}

// ── Internal streak computation (supports one backfill pass) ──────────────────

async function _recalculateStreak(uid: string, alreadyBackfilled: boolean): Promise<void> {
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

    const activeRows = (data ?? []).filter(r => Number(r.watched_minutes || 0) > 0);

    if (activeRows.length === 0) {
        if (!alreadyBackfilled) {
            // Fallback 1: use users.last_workout_date to fix/preserve streak
            const handled = await _fixStreakFromUsersTable(uid);
            if (handled) return;

            // Fallback 2: backfill user_daily_activity from workout_activity, then recompute
            const backfilled = await _backfillFromWorkoutActivity(uid);
            if (backfilled) {
                await _recalculateStreak(uid, true);
                return;
            }
        }
        console.log('[StreakCalc] skipping empty activity — no active rows');
        return;
    }

    const activeDates = new Set<string>(
        activeRows.map(r => {
            console.log('[ActivityRow]', r.activity_date);
            return r.activity_date as string;
        })
    );

    const todayKey     = getLocalDateKey();
    const yesterdayKey = shiftDay(todayKey, -1);

    // Current streak: count consecutive active days backwards from today or yesterday
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
     * Ensure a row exists for today. Called on app boot / login.
     * Creates with watched_minutes = 0 — minutes are added later via incrementWatchMinutes.
     * Does NOT recalculate streak — call recalculateUserStreak separately after minutes exist.
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
            console.log('[DailyActivity] row ensured', { today });
        }
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

        console.log('[DailyActivity] upsert_daily_watch_minutes →', { p_user_id: uid, p_date: today, p_minutes: minutes.toFixed(4) });
        const { error } = await supabase.rpc('upsert_daily_watch_minutes', {
            p_user_id: uid,
            p_date:    today,
            p_minutes: minutes,
        });

        if (error) {
            console.error('[DailyActivity] upsert_daily_watch_minutes FAILED:', error.message);
        } else {
            console.log('[DailyActivity] upsert_daily_watch_minutes OK', { date: today, minutes: minutes.toFixed(4) });
        }
    },

    /**
     * Compute current/best streak from user_daily_activity rows, then write
     * current_streak, best_streak, and last_workout_date to the users table.
     *
     * Fallback cascade when user_daily_activity has no active rows:
     *   1. users.last_workout_date: if today/yesterday, fix or preserve streak in-place.
     *   2. workout_activity: backfill user_daily_activity dates, then recompute.
     *   3. Give up gracefully — never write 0 over an existing positive streak.
     */
    async recalculateUserStreak(uid: string): Promise<void> {
        return _recalculateStreak(uid, false);
    },
};
