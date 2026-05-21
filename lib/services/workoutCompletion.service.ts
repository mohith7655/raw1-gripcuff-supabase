import { getResolvedTimezone } from '../utils/timezone';
import { getDateKey } from '../utils/streakDate';
import { StreakService } from './streak.service';

export type WorkoutSourceType =
    | 'exercise_library'
    | 'workout_program'
    | 'daily_challenge'
    | 'live_session'
    | 'friend_workout'
    | 'ai_trainer'
    | 'gripcuff';

export interface WorkoutCompletionOptions {
    workoutId: string;
    workoutTitle?: string;
    sourceType: WorkoutSourceType;
    category?: string;
    watchMinutes?: number;
    isLive?: boolean;
    user?: { timezone?: string };
}

export interface WorkoutCompletionResult {
    counted: boolean;
    duplicatePrevented: boolean;
    newStreak: number;
    creditsAwarded: number;
    milestonesHit: string[];
    todayKey: string;
    timezone: string;
}

/**
 * Single entry-point for every workout completion event in the app.
 * Persists to Supabase, increments streak, prevents same-day duplicates.
 */
export async function recordUniversalWorkoutCompletion(
    uid: string,
    options: WorkoutCompletionOptions,
): Promise<WorkoutCompletionResult> {
    const {
        workoutId,
        workoutTitle,
        sourceType,
        category,
        watchMinutes = 1,
        isLive = false,
        user,
    } = options;

    console.log('[WorkoutCompletion] started', { uid, workoutId: options.workoutId, sourceType: options.sourceType });

    const timezone = getResolvedTimezone(user);
    const todayKey = getDateKey(timezone);
    const activityType: 'workout' | 'liveSession' =
        isLive || sourceType === 'live_session' || sourceType === 'friend_workout'
            ? 'liveSession'
            : 'workout';

    console.log('[WorkoutCompletion] recording', { sourceType, workoutId, todayKey, timezone, watchMinutes });
    console.log('[WorkoutCompletion] calling markWorkoutComplete', { uid, activityType });

    const result = await StreakService.markWorkoutComplete(
        uid,
        workoutId,
        activityType,
        Math.max(1, watchMinutes),
        { sourceType, category, workoutTitle },
    );

    if (result.streakUpdated) {
        console.log('[WorkoutCompletion] ✅ streak updated —', result.newStreak, 'day(s)');
    } else {
        console.log('[WorkoutCompletion] ℹ️ duplicate prevented for today:', todayKey);
    }

    return {
        counted: result.streakUpdated,
        duplicatePrevented: !result.streakUpdated,
        newStreak: result.newStreak,
        creditsAwarded: result.creditsAwarded,
        milestonesHit: result.milestonesHit,
        todayKey,
        timezone,
    };
}
