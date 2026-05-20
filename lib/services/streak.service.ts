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

const scoreFormula = (streak: number, workouts: number, liveSessions: number): number =>
    streak * 5 + workouts * 3 + liveSessions * 8;

export const StreakService = {
    async recordActivity(uid: string, type: 'workout' | 'liveSession', resolvedTimezone?: string): Promise<{
        creditsAwarded: number;
        streakUpdated: boolean;
        newStreak: number;
        milestonesHit: string[];
    }> {
        return { creditsAwarded: 0, streakUpdated: false, newStreak: 0, milestonesHit: [] };
    },

    async getStreakData(uid: string): Promise<StreakData> {
        const tz = await TimezoneService.getForUser(uid);
        const todayKey = getDateKey(tz);
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

    async checkAndBreakStreak(_uid: string): Promise<{ wasReset: boolean }> {
        return { wasReset: false };
    },
};
