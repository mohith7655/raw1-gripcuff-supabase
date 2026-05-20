export type LeaderboardEntry = {
    uid: string;
    displayName: string;
    photoURL: string;
    score: number;
    currentStreak: number;
    workouts: number;
    liveSessions: number;
    totalMinutes?: number;
    workoutsCompleted?: number;
};

export const LeaderboardService = {
    subscribeWeeklyLeaderboard(
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        onData([]);
        return () => {};
    },

    subscribeMonthlyLeaderboard(
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        onData([]);
        return () => {};
    },

    subscribeAllTimeLeaderboard(
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        onData([]);
        return () => {};
    },
};

export async function initializeCurrentUserOnLeaderboard(
    uid: string,
    userData: { username?: string; fullName?: string; email?: string; profileImageUrl?: string; currentStreak?: number } = {}
): Promise<void> {}

export async function backfillLeaderboardUser(
    uid: string,
    data: {
        currentStreak: number;
        totalMinutes: number;
        workoutsCompleted: number;
        workoutMinutes: number;
        score: number;
    }
): Promise<void> {}

export async function addWorkoutMinutes(uid: string, minutes: number): Promise<void> {}
