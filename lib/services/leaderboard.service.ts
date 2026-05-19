import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    increment,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';

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

const mapDocs = (docs: any[]): LeaderboardEntry[] =>
    docs.map(d => ({
        uid: d.id,
        displayName: d.data().displayName ?? 'Athlete',
        photoURL: d.data().photoURL ?? '',
        score: d.data().score ?? 0,
        currentStreak: d.data().currentStreak ?? 0,
        workouts: d.data().workoutsCompleted ?? d.data().workouts ?? 0,
        liveSessions: d.data().liveSessions ?? 0,
        totalMinutes: d.data().totalMinutes ?? 0,
        workoutsCompleted: d.data().workoutsCompleted ?? 0,
    }));

export const LeaderboardService = {
    subscribeWeeklyLeaderboard(
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        const q = query(
            collection(db, 'leaderboards', 'weekly', 'users'),
            orderBy('score', 'desc'),
            limit(30)
        );
        return onSnapshot(q, snap => onData(mapDocs(snap.docs)), onError);
    },

    subscribeMonthlyLeaderboard(
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        const q = query(
            collection(db, 'leaderboards', 'monthly', 'users'),
            orderBy('score', 'desc'),
            limit(30)
        );
        return onSnapshot(q, snap => onData(mapDocs(snap.docs)), onError);
    },

    subscribeAllTimeLeaderboard(
        onData: (entries: LeaderboardEntry[]) => void,
        onError?: (e: Error) => void
    ): () => void {
        const q = query(
            collection(db, 'leaderboards', 'alltime', 'users'),
            orderBy('score', 'desc'),
            limit(30)
        );
        return onSnapshot(q, snap => onData(mapDocs(snap.docs)), onError);
    },
};

export async function initializeCurrentUserOnLeaderboard(
    uid: string,
    userData: { username?: string; fullName?: string; email?: string; profileImageUrl?: string; currentStreak?: number } = {}
): Promise<void> {
    try {
        const displayName =
            userData.username ||
            userData.fullName ||
            (userData.email ? userData.email.split('@')[0] : null) ||
            'User';
        const photoURL = userData.profileImageUrl || null;

        for (const period of ['weekly', 'monthly', 'alltime']) {
            const ref = doc(db, 'leaderboards', period, 'users', uid);
            const existing = await getDoc(ref);
            if (!existing.exists()) {
                // First time only — create with zero stats
                await setDoc(ref, {
                    uid,
                    displayName,
                    photoURL,
                    currentStreak: 0,
                    totalMinutes: 0,
                    workoutMinutes: 0,
                    liveSessionMinutes: 0,
                    workoutsCompleted: 0,
                    liveSessions: 0,
                    workouts: 0,
                    score: 0,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                console.log('[Leaderboard] Created new entry for', uid, 'in', period);
            } else {
                // Doc exists — only refresh identity fields, never touch stats
                await updateDoc(ref, {
                    uid,
                    displayName,
                    photoURL,
                    updatedAt: serverTimestamp(),
                });
            }
        }
        console.log('[Leaderboard] User synced:', uid, displayName);
    } catch (err) {
        console.error('[Leaderboard] Sync error:', err);
    }
}

export async function backfillLeaderboardUser(
    uid: string,
    data: {
        currentStreak: number;
        totalMinutes: number;
        workoutsCompleted: number;
        workoutMinutes: number;
        score: number;
    }
): Promise<void> {
    try {
        const payload = { ...data, updatedAt: serverTimestamp() };
        for (const period of ['weekly', 'monthly', 'alltime']) {
            const ref = doc(db, 'leaderboards', period, 'users', uid);
            await updateDoc(ref, payload);
        }
        console.log('[Leaderboard] Backfill complete for', uid);
    } catch (err) {
        console.error('[Leaderboard] Backfill error:', err);
    }
}


export async function addWorkoutMinutes(uid: string, minutes: number): Promise<void> {
    if (!uid || minutes <= 0) return;
    try {
        const updateData = {
            workoutMinutes: increment(minutes),
            totalMinutes: increment(minutes),
            score: increment(minutes),
            updatedAt: serverTimestamp(),
        };

        for (const period of ['weekly', 'monthly', 'alltime']) {
            const ref = doc(db, 'leaderboards', period, 'users', uid);
            await setDoc(ref, updateData, { merge: true });
        }

        await setDoc(doc(db, 'users', uid), {
            totalWorkoutMinutes: increment(minutes),
        }, { merge: true });
    } catch (e) {
        console.warn('[Leaderboard] addWorkoutMinutes error:', e);
    }
}
