import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../core/config/firebase';

export type Badge = {
    id: string;
    label: string;
    emoji: string;
    description: string;
    creditReward: number;
};

export const ALL_BADGES: Badge[] = [
    { id: 'first_workout', label: 'First Step', emoji: '👟', description: 'Complete your first workout', creditReward: 0 },
    { id: '7_day_streak', label: '7 Day Warrior', emoji: '🔥', description: 'Maintain a 7-day streak', creditReward: 50 },
    { id: '14_day_streak', label: '2 Week Beast', emoji: '⚡', description: 'Maintain a 14-day streak', creditReward: 100 },
    { id: '30_day_streak', label: '30 Day Discipline', emoji: '🏆', description: 'Maintain a 30-day streak', creditReward: 200 },
    { id: 'first_live_session', label: 'Live Session Beast', emoji: '🎥', description: 'Complete your first live session', creditReward: 0 },
    { id: '100_workouts', label: 'Century Club', emoji: '💯', description: 'Complete 100 workouts', creditReward: 500 },
];

// Milestone thresholds for progress bar
export const WORKOUT_MILESTONES = [1, 7, 14, 30, 50, 100];

export const RewardsService = {
    async awardCredits(uid: string, amount: number, reason: string): Promise<void> {
        await updateDoc(doc(db, 'users', uid), {
            credits: increment(amount),
        });
    },

    async checkMilestones(uid: string): Promise<string[]> {
        const snap = await getDoc(doc(db, 'users', uid));
        const data = snap.data() ?? {};
        const earned: string[] = data.badges ?? [];
        const totalWorkouts: number = data.totalWorkouts ?? 0;
        const totalLive: number = data.totalLiveSessions ?? 0;
        const streak: number = data.currentStreak ?? 0;

        const toUnlock: string[] = [];

        if (totalWorkouts >= 1 && !earned.includes('first_workout')) toUnlock.push('first_workout');
        if (streak >= 7 && !earned.includes('7_day_streak')) toUnlock.push('7_day_streak');
        if (streak >= 14 && !earned.includes('14_day_streak')) toUnlock.push('14_day_streak');
        if (streak >= 30 && !earned.includes('30_day_streak')) toUnlock.push('30_day_streak');
        if (totalLive >= 1 && !earned.includes('first_live_session')) toUnlock.push('first_live_session');
        if (totalWorkouts >= 100 && !earned.includes('100_workouts')) toUnlock.push('100_workouts');

        if (toUnlock.length > 0) {
            const merged = Array.from(new Set([...earned, ...toUnlock]));
            await updateDoc(doc(db, 'users', uid), { badges: merged });
        }

        return toUnlock;
    },

    getNextMilestone(totalWorkouts: number): { label: string; workoutsLeft: number } | null {
        for (const m of WORKOUT_MILESTONES) {
            if (totalWorkouts < m) {
                return { label: m === 1 ? 'First Step' : `${m} Workouts`, workoutsLeft: m - totalWorkouts };
            }
        }
        return null;
    },

    getBadge(id: string): Badge | undefined {
        return ALL_BADGES.find(b => b.id === id);
    },
};
