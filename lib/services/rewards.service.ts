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
    { id: 'heavy_lifter', label: 'Heavy Lifter', emoji: '🏋️‍♂️', description: 'Log 10 weightlifting sessions', creditReward: 100 },
    { id: 'cardio_king', label: 'Cardio King', emoji: '🏃‍♂️', description: 'Complete 5 running or cardio sessions', creditReward: 100 },
    { id: 'flexibility_master', label: 'Flex Master', emoji: '🧘‍♂️', description: 'Log 5 stretching or yoga sessions', creditReward: 100 },
    { id: 'early_grinder', label: 'Early Grinder', emoji: '🌅', description: 'Hit the gym before 6 AM', creditReward: 50 },
    { id: 'iron_will', label: 'Iron Will', emoji: '🦾', description: 'Complete a workout on a Sunday', creditReward: 150 },
    { id: 'endurance_beast', label: 'Endurance Beast', emoji: '💦', description: 'Workout for more than 90 minutes', creditReward: 200 },
];

// Milestone thresholds for progress bar
export const WORKOUT_MILESTONES = [1, 7, 14, 30, 50, 100];

export const RewardsService = {
    async awardCredits(uid: string, amount: number, reason: string): Promise<void> {},

    async checkMilestones(uid: string): Promise<string[]> {
        return [];
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
