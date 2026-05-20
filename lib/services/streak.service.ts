import { supabase } from '../core/config/supabase';
import {
    getDateKey,
    getYesterdayKey,
    getLastNDayKeys,
    logStreakDebug,
    getWeekdayIndex,
    buildWeekDates,
} from '../utils/streakDate';
import { getUserLocalString } from '../utils/userDate';
import { TimezoneService } from './timezone.service';

export type StreakData = {
    currentStreak: number;
    bestStreak: number;
    lastWorkoutDate: string | null;
    weeklyActivity: Record<string, boolean>;
    weeklyMinutes: Record<string, number>;
    weeklyChallengesCompleted: number;
    timezone: string;
    totalWorkouts: number;
    totalLiveSessions: number;
    credits: number;
    badges: string[];
    leaderboardScore: number;
};

/** Returns YYYY-MM-DD for today in the device's local timezone. */
export function getLocalDayKey(): string {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return getDateKey(tz);
}

export const StreakService = {
    getTodayKey(timezone: string): string {
        return getDateKey(timezone);
    },

    cleanupWeeklyActivity(weeklyActivity: Record<string, boolean>, todayKey: string): Record<string, boolean> {
        const cleaned = { ...weeklyActivity };
        const today = new Date(todayKey);
        const thirtyDaysAgoMs = today.getTime() - (30 * 24 * 60 * 60 * 1000);
        for (const key of Object.keys(cleaned)) {
            const keyDate = new Date(key);
            if (!isNaN(keyDate.getTime()) && keyDate.getTime() < thirtyDaysAgoMs) {
                delete cleaned[key];
            }
        }
        return cleaned;
    },

    calculateCurrentStreak(
        lastWorkoutDate: string | null,
        weeklyActivity: Record<string, boolean>,
        todayKey: string,
        yesterdayKey: string
    ): number {
        const completedToday = !!weeklyActivity[todayKey];
        const completedYesterday = !!weeklyActivity[yesterdayKey];
        
        if (!completedToday && !completedYesterday) {
            return 0;
        }
        
        let streak = 0;
        let currentKey = todayKey;
        if (!completedToday) {
            currentKey = yesterdayKey;
        }
        
        // Loop backwards to count contiguous days
        while (weeklyActivity[currentKey]) {
            streak++;
            const d = new Date(currentKey);
            d.setDate(d.getDate() - 1);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            currentKey = `${year}-${month}-${day}`;
        }
        return streak;
    },

    async hasCompletedToday(uid: string): Promise<boolean> {
        const tz = await TimezoneService.getForUser(uid);
        const todayKey = getDateKey(tz);
        const { data, error } = await supabase
            .from('users')
            .select('weekly_activity')
            .eq('id', uid)
            .maybeSingle();
        if (error || !data) return false;
        const weeklyActivity = typeof data.weekly_activity === 'string' 
            ? JSON.parse(data.weekly_activity) 
            : (data.weekly_activity || {});
        return !!weeklyActivity[todayKey];
    },

    async markWorkoutComplete(
        uid: string,
        workoutId?: string,
        type: 'workout' | 'liveSession' = 'workout',
        minutes: number = 1,
        metadata: any = {}
    ): Promise<{
        creditsAwarded: number;
        streakUpdated: boolean;
        newStreak: number;
        milestonesHit: string[];
    }> {
        const tz = await TimezoneService.getForUser(uid);
        const todayKey = getDateKey(tz);
        const yesterdayKey = getYesterdayKey(tz);

        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('current_streak, best_streak, last_workout_date, weekly_activity, completed_workouts, total_live_sessions, watched_seconds')
            .eq('id', uid)
            .maybeSingle();

        if (profileError || !profile) {
            throw new Error(profileError?.message || 'User profile not found');
        }

        const weeklyActivityRaw = typeof profile.weekly_activity === 'string'
            ? JSON.parse(profile.weekly_activity)
            : (profile.weekly_activity || {});

        const lastWorkoutDate: string | null = profile.last_workout_date ?? null;
        const currentStreak = Number(profile.current_streak ?? 0);
        const bestStreak = Number(profile.best_streak ?? 0);
        const completedWorkouts = Number(profile.completed_workouts ?? 0);
        const totalLiveSessions = Number(profile.total_live_sessions ?? 0);
        const watchedSeconds = Number(profile.watched_seconds ?? 0);

        console.log('[Streak] previous date', lastWorkoutDate);
        console.log('[Streak] today', todayKey);
        console.log('[Streak] yesterday', yesterdayKey);

        // CASE 2: already completed today — prevent double-count
        // Check BOTH weekly_activity and last_workout_date so they can't get out of sync.
        if (weeklyActivityRaw[todayKey] || lastWorkoutDate === todayKey) {
            console.log('[Streak] already completed today');
            return {
                creditsAwarded: 0,
                streakUpdated: false,
                newStreak: currentStreak,
                milestonesHit: [],
            };
        }

        // Insert into workout_activity
        const { error: activityError } = await supabase
            .from('workout_activity')
            .insert({
                user_id: uid,
                workout_type: type,
                workout_id: workoutId || 'manual',
                completed_at: new Date().toISOString(),
                watched_minutes: minutes,
                metadata: metadata || {}
            });

        if (activityError) {
            console.error('[Streak] Failed to insert workout_activity:', activityError.message);
        }

        // CASE 1-4: determine new streak
        let newStreak: number;
        if (!lastWorkoutDate) {
            // CASE 1: no prior workout — first streak day
            newStreak = 1;
            console.log('[Streak] incrementing streak');
        } else if (lastWorkoutDate === yesterdayKey) {
            // CASE 3: completed yesterday — continue streak
            newStreak = currentStreak + 1;
            console.log('[Streak] streak continued');
        } else {
            // CASE 4: missed more than 1 day — reset
            newStreak = 1;
            console.log('[Streak] streak reset');
        }

        const newBestStreak = Math.max(bestStreak, newStreak);
        // Merge today into existing weekly_activity — never overwrite previous days
        let newWeeklyActivity = { ...weeklyActivityRaw, [todayKey]: true };
        newWeeklyActivity = this.cleanupWeeklyActivity(newWeeklyActivity, todayKey);

        const newCompletedWorkouts = completedWorkouts + 1;
        const newTotalLiveSessions = type === 'liveSession' ? totalLiveSessions + 1 : totalLiveSessions;
        // watched_seconds is canonical — add session minutes converted to seconds.
        // watched_minutes is derived: FLOOR(total_seconds / 60).
        const newWatchedSeconds = watchedSeconds + minutes * 60;
        const creditsAwarded = type === 'liveSession' ? 15 : 10;

        // Upsert so that a missing row never causes a silent no-op
        const { error: updateError } = await supabase
            .from('users')
            .upsert({
                id: uid,
                last_workout_date: todayKey,
                current_streak: newStreak,
                best_streak: newBestStreak,
                weekly_activity: newWeeklyActivity,
                completed_workouts: newCompletedWorkouts,
                total_live_sessions: newTotalLiveSessions,
                watched_seconds: newWatchedSeconds,
                watched_minutes: Math.floor(newWatchedSeconds / 60),
                streak: newStreak,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (updateError) {
            throw new Error(updateError.message);
        }

        return {
            creditsAwarded,
            streakUpdated: true,
            newStreak,
            milestonesHit: [],
        };
    },

    async recordActivity(uid: string, type: 'workout' | 'liveSession', resolvedTimezone?: string): Promise<{
        creditsAwarded: number;
        streakUpdated: boolean;
        newStreak: number;
        milestonesHit: string[];
    }> {
        return this.markWorkoutComplete(uid, undefined, type, 1);
    },

    async getStreakData(uid: string): Promise<StreakData> {
        const tz = await TimezoneService.getForUser(uid);
        const todayKey = getDateKey(tz);
        
        const { data: row, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', uid)
            .maybeSingle();

        if (error || !row) {
            return this.getDefaultStreakData(tz);
        }

        const weeklyActivityRaw = typeof row.weekly_activity === 'string'
            ? JSON.parse(row.weekly_activity)
            : (row.weekly_activity || {});

        const calendarWeek = buildWeekDates(tz, 0);
        const rollingDays  = getLastNDayKeys(tz, 7);
        const allDays = Array.from(new Set([...calendarWeek, ...rollingDays]));

        // Fetch actual watched minutes from workout_activity for the past 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: activities } = await supabase
            .from('workout_activity')
            .select('completed_at, watched_minutes')
            .eq('user_id', uid)
            .gte('completed_at', thirtyDaysAgo.toISOString());

        const minutesByDay: Record<string, number> = {};
        for (const act of activities ?? []) {
            const localDate = new Date(act.completed_at).toLocaleDateString('en-CA', { timeZone: tz });
            minutesByDay[localDate] = (minutesByDay[localDate] ?? 0) + (Number(act.watched_minutes) || 0);
        }

        const weeklyActivity: Record<string, boolean> = {};
        const weeklyMinutes: Record<string, number> = {};
        allDays.forEach(d => {
            weeklyActivity[d] = !!weeklyActivityRaw[d];
            weeklyMinutes[d] = minutesByDay[d] ?? (weeklyActivityRaw[d] ? 10 : 0);
        });

        const currentStreak = Number(row.current_streak ?? 0);
        const completedWorkouts = Number(row.completed_workouts ?? 0);
        const totalLiveSessions = Number(row.total_live_sessions ?? 0);

        return {
            currentStreak,
            bestStreak: Number(row.best_streak ?? 0),
            lastWorkoutDate: row.last_workout_date ?? null,
            weeklyActivity,
            weeklyMinutes,
            weeklyChallengesCompleted: 0,
            timezone: tz,
            totalWorkouts: completedWorkouts,
            totalLiveSessions,
            credits: 0,
            badges: [],
            leaderboardScore: currentStreak * 5 + completedWorkouts * 3 + totalLiveSessions * 8,
        };
    },

    getDefaultStreakData(tz: string): StreakData {
        const calendarWeek = buildWeekDates(tz, 0);
        const rollingDays  = getLastNDayKeys(tz, 7);
        const allDays = Array.from(new Set([...calendarWeek, ...rollingDays]));

        const weeklyActivity: Record<string, boolean> = {};
        const weeklyMinutes: Record<string, number> = {};
        allDays.forEach(d => {
            weeklyActivity[d] = false;
            weeklyMinutes[d] = 0;
        });

        return {
            currentStreak: 0,
            bestStreak: 0,
            lastWorkoutDate: null,
            weeklyActivity,
            weeklyMinutes,
            weeklyChallengesCompleted: 0,
            timezone: tz,
            totalWorkouts: 0,
            totalLiveSessions: 0,
            credits: 0,
            badges: [],
            leaderboardScore: 0,
        };
    },

    async backfillStreak(_uid: string): Promise<void> {},

    async checkAndBreakStreak(uid: string): Promise<{ wasReset: boolean }> {
        const tz = await TimezoneService.getForUser(uid);
        const todayKey = getDateKey(tz);
        const yesterdayKey = getYesterdayKey(tz);

        const { data, error } = await supabase
            .from('users')
            .select('last_workout_date, current_streak')
            .eq('id', uid)
            .maybeSingle();

        if (error || !data) return { wasReset: false };

        const lastWorkoutDate: string | null = data.last_workout_date ?? null;
        const currentStreak = Number(data.current_streak ?? 0);

        console.log('[Streak] previous date', lastWorkoutDate);
        console.log('[Streak] today', todayKey);
        console.log('[Streak] yesterday', yesterdayKey);

        // Only reset if user had an active streak AND missed more than 1 day.
        // lastWorkoutDate === todayKey → completed today, preserve streak.
        // lastWorkoutDate === yesterdayKey → completed yesterday, preserve streak.
        if (currentStreak > 0 && lastWorkoutDate !== todayKey && lastWorkoutDate !== yesterdayKey) {
            console.log('[Streak] streak reset due to inactivity');
            await supabase
                .from('users')
                .upsert({
                    id: uid,
                    current_streak: 0,
                    streak: 0,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });
            return { wasReset: true };
        }

        if (lastWorkoutDate === todayKey) {
            console.log('[Streak] already completed today');
        } else if (lastWorkoutDate === yesterdayKey) {
            console.log('[Streak] streak continued');
        }

        return { wasReset: false };
    },
};
