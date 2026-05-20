import { getResolvedTimezone } from '../utils/timezone';
import { getDateKey } from '../utils/streakDate';
import { getUserLocalString } from '../utils/userDate';
import { StreakService } from './streak.service';

export type ActivityType = 'workout' | 'liveSession';

export interface RecordActivityOptions {
    completedDailyChallenge?: boolean;
    videoId?: string;
    challengeId?: string;
    minutes?: number;
    type?: ActivityType;
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

    const timezone = getResolvedTimezone(user);
    const todayKey = getDateKey(timezone);

    console.log('[Activity] recording', { uid, timezone, todayKey, type, completedDailyChallenge, videoId, minutes });

    const result = await StreakService.recordActivity(uid, type, timezone);

    console.log('[Activity] complete — todayKey:', todayKey, 'streak:', result.newStreak,
        'credits:', result.creditsAwarded, 'writeSuccess: true');

    return { ...result, todayKey, timezone };
}
