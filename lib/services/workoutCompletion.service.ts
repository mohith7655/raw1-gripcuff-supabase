/**
 * Universal workout completion pipeline.
 *
 * Every content type — video, live session, friend workout, challenge, GripCuff —
 * funnels through this single function. It handles:
 *   1. Timezone resolution
 *   2. Per-workout deduplication (same workout can't count twice in one day)
 *   3. Watch history write
 *   4. Activity doc + streak + credits (via recordDailyActivity)
 *   5. lastCompletedWorkout on user doc
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../core/config/firebase';
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
    const dedupId = `${todayKey}_${workoutId}`;

    console.log('[Workout Completion]', {
        sourceType,
        workoutId,
        todayKey,
        timezone,
        counted: false,
        duplicatePrevented: false,
    });

    // 1. Per-workout dedup — same workout can't count twice in the same calendar day
    const dedupRef = doc(db, 'users', uid, 'completedWorkouts', dedupId);
    const dedupSnap = await getDoc(dedupRef);
    if (dedupSnap.exists()) {
        // Completion already counted — but still accumulate watch minutes for this session.
        const addedMinutes = Math.max(1, watchMinutes);
        setDoc(
            doc(db, 'users', uid, 'activity', todayKey),
            {
                watchedMinutes: increment(addedMinutes),
                watchCount: increment(1),
                updatedAt: serverTimestamp(),
            },
            { merge: true },
        ).catch(() => {});
        updateDoc(doc(db, 'users', uid), {
            totalWorkoutMinutes: increment(addedMinutes),
            updatedAt: serverTimestamp(),
        }).catch(() => {});
        console.log('[Workout Completion] duplicate prevented — minutes still accumulated:', { dedupId, addedMinutes });
        console.log('[Minutes Update]', { addedMinutes, note: 'repeat watch, completion blocked' });
        return {
            counted: false,
            duplicatePrevented: true,
            newStreak: 0,
            creditsAwarded: 0,
            milestonesHit: [],
            todayKey,
            timezone,
        };
    }

    // 2. Claim the dedup slot atomically before any async work
    await setDoc(dedupRef, {
        workoutId,
        workoutTitle: workoutTitle ?? null,
        sourceType,
        todayKey,
        completedAt: serverTimestamp(),
    });

    // 3. Watch history — non-blocking, best-effort
    setDoc(
        doc(db, 'users', uid, 'watchHistory', dedupId),
        {
            workoutId,
            workoutTitle: workoutTitle ?? null,
            sourceType,
            category: category ?? null,
            watchMinutes,
            isLive,
            completedAt: serverTimestamp(),
            todayKey,
            timezone,
        },
        { merge: true },
    ).catch(() => {});

    // 4. Activity doc + streak + credits via central pipeline
    const activityResult = await recordDailyActivity(uid, {
        completedDailyChallenge: sourceType === 'daily_challenge',
        challengeId: sourceType === 'daily_challenge' ? workoutId : undefined,
        videoId: workoutId,
        minutes: watchMinutes,
        type: isLive ? 'liveSession' : 'workout',
        user,
    });

    // 5. lastCompletedWorkout on user doc — non-blocking
    // (totalWorkoutMinutes is already incremented by recordDailyActivity above)
    console.log('[Minutes Update]', { addedMinutes: Math.max(1, watchMinutes), sourceType, workoutId, todayKey });
    updateDoc(doc(db, 'users', uid), {
        lastCompletedWorkout: {
            title: workoutTitle ?? null,
            completedAt: serverTimestamp(),
            sourceType,
        },
        updatedAt: serverTimestamp(),
    }).catch(() => {});

    console.log('[Workout Completion]', {
        sourceType,
        workoutId,
        todayKey,
        timezone,
        counted: true,
        duplicatePrevented: false,
        newStreak: activityResult.newStreak,
        creditsAwarded: activityResult.creditsAwarded,
    });

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
