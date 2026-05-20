import { getResolvedTimezone } from '../utils/timezone';
import { getDateKey } from '../utils/streakDate';
import { recordDailyActivity } from './dailyActivity.service';

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

    const timezone = getResolvedTimezone(user);
    const todayKey = getDateKey(timezone);

    console.log('[Workout Completion]', { sourceType, workoutId, todayKey, timezone });

    const activityResult = await recordDailyActivity(uid, {
        completedDailyChallenge: sourceType === 'daily_challenge',
        challengeId: sourceType === 'daily_challenge' ? workoutId : undefined,
        videoId: workoutId,
        minutes: watchMinutes,
        type: isLive ? 'liveSession' : 'workout',
        user,
    });

    console.log('[Minutes Update]', { addedMinutes: Math.max(1, watchMinutes), sourceType, workoutId, todayKey });

    return {
        counted: true,
        duplicatePrevented: false,
        newStreak: activityResult.newStreak,
        creditsAwarded: activityResult.creditsAwarded,
        milestonesHit: activityResult.milestonesHit,
        todayKey,
        timezone,
    };
}
