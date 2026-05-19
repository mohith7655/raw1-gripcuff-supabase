/**
 * Central entry point for ALL workout/challenge completion writes.
 *
 * Resolves timezone once (synchronously via device clock) then:
 *  1. Writes the activity doc for today's local date
 *  2. Updates lastWorkoutDate on the user doc directly (belt-and-suspenders)
 *  3. Delegates streak / credits / milestones to StreakService.recordActivity,
 *     passing the already-resolved timezone so it never re-resolves independently.
 *
 * This eliminates the stale-cache race where StreakService computed an old dateKey
 * and hit `alreadyCountedToday === true` on yesterday's activity doc.
 */

import {
    doc,
    setDoc,
    updateDoc,
    serverTimestamp,
    increment,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { getResolvedTimezone } from '../utils/timezone';
import { getDateKey } from '../utils/streakDate';
import { getUserLocalString } from '../utils/userDate';
import { StreakService } from './streak.service';

export type ActivityType = 'workout' | 'liveSession';

export interface RecordActivityOptions {
    /** Set true when completing a daily challenge video. */
    completedDailyChallenge?: boolean;
    /** Challenge or video ID to store for deduplication / analytics. */
    videoId?: string;
    /** Set when the challenge was launched from its card (overrides videoId for challengeId). */
    challengeId?: string;
    /** Minutes watched — merged into watchedMinutes via increment(). */
    minutes?: number;
    /** 'workout' (default) or 'liveSession'. */
    type?: ActivityType;
    /** Optional user object to help timezone resolution (device tz wins regardless). */
    user?: { timezone?: string };
}

export interface RecordActivityResult {
    creditsAwarded: number;
    streakUpdated: boolean;
    newStreak: number;
    milestonesHit: string[];
    todayKey: string;
    timezone: string;
}

export async function recordDailyActivity(
    uid: string,
    options: RecordActivityOptions = {},
): Promise<RecordActivityResult> {
    const { completedDailyChallenge = false, videoId, challengeId, minutes, type = 'workout', user } = options;

    // Timezone resolved synchronously from device clock — cannot throw, cannot use stale cache.
    const timezone = getResolvedTimezone(user);
    const todayKey = getDateKey(timezone);

    console.group('[Activity] recording');
    console.log('[Activity] recording', {
        uid,
        timezone,
        todayKey,
        type,
        completedDailyChallenge,
        videoId,
        minutes,
        deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    console.groupEnd();

    // ── Step 1: Write activity doc ──────────────────────────────────────────────
    const activityRef = doc(db, 'users', uid, 'activity', todayKey);
    const activityPayload: Record<string, any> = {
        date: todayKey,
        timezone,
        updatedAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        completedAtLocal: getUserLocalString(timezone),
    };

    if (type === 'workout') activityPayload.workoutCompleted = true;
    if (type === 'liveSession') activityPayload.liveSessionCompleted = true;

    if (completedDailyChallenge) {
        activityPayload.challengeCompleted = true;
        activityPayload.challengeId = challengeId ?? videoId ?? null;
    }
    if (videoId) activityPayload.videoId = videoId;
    // Always increment watchedMinutes — minimum 1 so every completed day shows a duration label.
    // Using the single canonical field avoids the transition-period split-brain where a new
    // "minutes" field starts at 1 while "watchedMinutes" already holds the historical total.
    const effectiveMinutes = Math.max(1, minutes ?? 1);
    activityPayload.watchedMinutes = increment(effectiveMinutes);
    activityPayload.watchCount = increment(1);
    activityPayload.completed = true;

    await setDoc(activityRef, activityPayload, { merge: true });

    console.log('[Activity Saved]', {
        todayKey,
        minutes: effectiveMinutes,
        completed: true,
    });
    console.log('[Activity] activity doc written', {
        path: 'users/' + uid + '/activity/' + todayKey,
        writeSuccess: true,
        fields: Object.keys(activityPayload),
    });

    // ── Step 2: Belt-and-suspenders user doc update ─────────────────────────────
    // Write lastWorkoutDate directly so it's never gated on StreakService success.
    // StreakService will also update it (with the full streak calculation), but this
    // ensures the field is always current even if recordActivity returns early.
    updateDoc(doc(db, 'users', uid), {
        lastWorkoutDate: todayKey,
        totalWorkoutMinutes: increment(effectiveMinutes),
        updatedAt: serverTimestamp(),
    }).catch(e => console.warn('[Activity] user doc lastWorkoutDate update failed:', e?.message ?? e));

    // ── Step 3: Delegate streak / credits to StreakService ──────────────────────
    // Pass timezone so StreakService never re-resolves it independently.
    // This prevents the stale-cache race that caused the wrong dateKey to be used.
    const result = await StreakService.recordActivity(uid, type, timezone);

    console.log('[Activity] complete — todayKey:', todayKey, 'streak:', result.newStreak,
        'credits:', result.creditsAwarded, 'writeSuccess: true');

    return { ...result, todayKey, timezone };
}
