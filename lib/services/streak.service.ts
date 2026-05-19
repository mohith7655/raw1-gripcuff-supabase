import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';
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

/**
 * Reads last 60 activity docs in parallel and counts consecutive active days
 * going backward from today. Gives a one-day grace for today: if today has no
 * activity yet the chain is allowed to start from yesterday instead of breaking.
 */
async function calculateStreakFromActivity(uid: string, timezone: string): Promise<number> {
    // Build 60 date keys going back from today using noon-UTC anchored arithmetic.
    const dates = getLastNDayKeys(timezone, 60).reverse(); // newest first
    const snaps = await Promise.all(
        dates.map(dateKey =>
            getDoc(doc(db, 'users', uid, 'activity', dateKey)).catch(() => null)
        )
    );

    let streak = 0;
    for (let i = 0; i < snaps.length; i++) {
        const snap = snaps[i];
        if (!snap) break;
        const a = snap.data();
        const active = snap.exists() && !!(a?.challengeCompleted || a?.workoutCompleted || a?.liveSessionCompleted);
        console.log('[Streak] scan', dates[i], active ? '✓' : '✗',
            snap.exists() ? JSON.stringify({ cc: a?.challengeCompleted, wc: a?.workoutCompleted, ls: a?.liveSessionCompleted }) : '(no doc)');
        if (active) {
            streak++;
        } else if (i === 0) {
            // Today has no activity yet — give grace and try from yesterday
            console.log('[Streak] grace: today inactive, continuing from yesterday');
            continue;
        } else {
            break;
        }
    }

    console.log('[Streak] calculateStreakFromActivity result:', streak);
    return streak;
}

export type StreakData = {
    currentStreak: number;
    bestStreak: number;
    lastWorkoutDate: string | null;
    weeklyActivity: Record<string, boolean>; // keyed by YYYY-MM-DD in user timezone
    weeklyMinutes: Record<string, number>;   // keyed by YYYY-MM-DD in user timezone
    weeklyChallengesCompleted: number;       // days this Mon–Sun window with challengeCompleted
    timezone: string;                        // IANA timezone used for all date keys
    totalWorkouts: number;
    totalLiveSessions: number;
    credits: number;
    badges: string[];
    leaderboardScore: number;
};

// Internal helpers — always pass timezone explicitly.
const today     = (tz: string) => getDateKey(tz);
const yesterday = (tz: string) => getYesterdayKey(tz);
const last7Days = (tz: string) => getLastNDayKeys(tz, 7);

const scoreFormula = (streak: number, workouts: number, liveSessions: number): number =>
    streak * 5 + workouts * 3 + liveSessions * 8;

export const StreakService = {
    async recordActivity(uid: string, type: 'workout' | 'liveSession', resolvedTimezone?: string): Promise<{
        creditsAwarded: number;
        streakUpdated: boolean;
        newStreak: number;
        milestonesHit: string[];
    }> {
        // Use caller-supplied timezone when available — avoids stale-cache re-resolution.
        const tz = resolvedTimezone ?? await TimezoneService.getForUser(uid);
        const dateKey = today(tz);
        logStreakDebug({ timezone: tz, label: `recordActivity (${type})` });
        console.log('[Streak] recordActivity — timezone:', tz, 'dateKey:', dateKey, 'type:', type,
            resolvedTimezone ? '(tz from caller)' : '(tz from TimezoneService)');
        const userRef = doc(db, 'users', uid);
        const activityRef = doc(db, 'users', uid, 'activity', dateKey);

        const [userSnap, activitySnap] = await Promise.all([
            getDoc(userRef),
            getDoc(activityRef),
        ]);

        const userData = userSnap.data() ?? {};
        const activityData = activitySnap.data() ?? {};

        const lastDate = userData.lastWorkoutDate as string | null ?? null;
        const currentStreak = (userData.currentStreak as number) ?? 0;
        const bestStreak = (userData.bestStreak as number) ?? 0;
        const totalWorkouts = (userData.totalWorkouts as number) ?? 0;
        const totalLiveSessions = (userData.totalLiveSessions as number) ?? 0;

        // Determine if streak continues or starts fresh
        const alreadyCountedToday = activityData.streakCounted === true;
        if (alreadyCountedToday) {
            console.log('[Streak] recordActivity — already counted for', dateKey, '— skipping');
            return { creditsAwarded: 0, streakUpdated: false, newStreak: currentStreak, milestonesHit: [] };
        }

        let newStreak: number;
        if (lastDate === yesterday(tz) || lastDate === dateKey) {
            newStreak = currentStreak + 1;
        } else {
            newStreak = 1;
        }
        const streakUpdated = true;

        // Credits
        const baseCredits = type === 'workout' ? 10 : 25;
        let bonusCredits = 0;
        const milestonesHit: string[] = [];
        const newTotalWorkouts = totalWorkouts + (type === 'workout' ? 1 : 0);
        const newTotalLive = totalLiveSessions + (type === 'liveSession' ? 1 : 0);

        // Streak milestones (only on the exact day the streak hits the number)
        if (streakUpdated) {
            if (newStreak === 7) { bonusCredits += 50; milestonesHit.push('7_day_streak'); }
            if (newStreak === 14) { bonusCredits += 100; milestonesHit.push('14_day_streak'); }
            if (newStreak === 30) { bonusCredits += 200; milestonesHit.push('30_day_streak'); }
        }

        // Workout count milestones
        if (type === 'workout') {
            if (newTotalWorkouts === 1) milestonesHit.push('first_workout');
            if (newTotalWorkouts === 100) milestonesHit.push('100_workouts');
        }
        if (type === 'liveSession' && newTotalLive === 1) {
            milestonesHit.push('first_live_session');
        }

        const creditsAwarded = baseCredits + bonusCredits;
        const newBest = Math.max(bestStreak, newStreak);
        const newScore = scoreFormula(newStreak, newTotalWorkouts, newTotalLive);

        // Update user doc
        const userUpdate: Record<string, any> = {
            lastWorkoutDate: dateKey,
            currentStreak: newStreak,
            bestStreak: newBest,
            leaderboardScore: newScore,
            credits: increment(creditsAwarded),
        };
        if (type === 'workout') userUpdate.totalWorkouts = increment(1);
        if (type === 'liveSession') userUpdate.totalLiveSessions = increment(1);
        if (milestonesHit.length > 0) {
            // Merge badges array
            const existing: string[] = userData.badges ?? [];
            const merged = Array.from(new Set([...existing, ...milestonesHit]));
            userUpdate.badges = merged;
        }

        // Update activity doc
        const activityUpdate: Record<string, any> = {
            date: dateKey,
            creditsEarned: increment(creditsAwarded),
            streakCounted: true,
            updatedAt: serverTimestamp(),
        };
        if (type === 'workout') activityUpdate.workoutCompleted = true;
        if (type === 'liveSession') activityUpdate.liveSessionCompleted = true;
        if (!activitySnap.exists()) activityUpdate.createdAt = serverTimestamp();

        // Update leaderboard docs — score is managed exclusively by addWorkoutMinutes (minutes-based).
        // StreakService only updates streak, display info, and workout counts.
        const displayName = userData.displayName ?? userData.fullName ?? 'Athlete';
        const photoURL = userData.profileImageUrl ?? userData.photoURL ?? '';
        const leaderboardPayload: Record<string, any> = {
            displayName,
            photoURL,
            currentStreak: newStreak,
            updatedAt: serverTimestamp(),
        };
        if (type === 'workout') {
            leaderboardPayload.workouts = increment(1);
            leaderboardPayload.workoutsCompleted = increment(1);
        }
        if (type === 'liveSession') {
            leaderboardPayload.liveSessions = increment(1);
        }

        await Promise.all([
            updateDoc(userRef, userUpdate).catch(() => setDoc(userRef, userUpdate, { merge: true })),
            setDoc(activityRef, activityUpdate, { merge: true }),
            setDoc(doc(db, 'leaderboards', 'weekly', 'users', uid), leaderboardPayload, { merge: true }),
            setDoc(doc(db, 'leaderboards', 'monthly', 'users', uid), leaderboardPayload, { merge: true }),
            setDoc(doc(db, 'leaderboards', 'alltime', 'users', uid), leaderboardPayload, { merge: true }),
        ]);

        return { creditsAwarded, streakUpdated, newStreak, milestonesHit };
    },

    async getStreakData(uid: string): Promise<StreakData> {
        const tz = await TimezoneService.getForUser(uid);
        logStreakDebug({ timezone: tz, label: 'getStreakData' });

        const userSnap = await getDoc(doc(db, 'users', uid));
        const data = userSnap.data() ?? {};

        const storedStreak = (data.currentStreak ?? data.streakDays ?? 0) as number;
        const storedBest = (data.bestStreak ?? 0) as number;
        const lastWorkoutDate = (data.lastWorkoutDate as string | null) ?? null;
        const todayKey = today(tz);
        const yesterdayKey = yesterday(tz);

        // Fetch activity docs for the current calendar week (Mon–Sun) AND last 7
        // rolling days. The union ensures we never miss a dot regardless of when in
        // the week getStreakData is called.
        const calendarWeek = buildWeekDates(tz, 0); // Mon–Sun this week
        const rollingDays  = last7Days(tz);          // last 7 days ending today
        const allDays = Array.from(new Set([...calendarWeek, ...rollingDays]));

        console.log('[Streak] getStreakData — timezone:', tz, 'today:', todayKey,
            'weekday:', getWeekdayIndex(tz), 'calendarWeek:', calendarWeek);

        const activitySnaps = await Promise.all(
            allDays.map(d => getDoc(doc(db, 'users', uid, 'activity', d)))
        );
        const activityMap: Record<string, ReturnType<typeof activitySnaps[0]['data']>> = {};
        allDays.forEach((d, i) => { activityMap[d] = activitySnaps[i].data(); });

        // Log today's activity doc for debugging
        const todaySnapIdx = allDays.indexOf(todayKey);
        const todaySnap = todaySnapIdx >= 0 ? activitySnaps[todaySnapIdx] : null;
        console.log('[Activity Check]', {
            path: 'users/' + uid + '/activity/' + todayKey,
            exists: todaySnap?.exists() ?? false,
            data: todaySnap?.data() ?? null,
        });

        const weeklyActivity: Record<string, boolean> = {};
        const weeklyMinutes: Record<string, number> = {};
        // weeklyChallengesCompleted counts Mon–Sun calendar week (matches UI week dots)
        let weeklyChallengesCompleted = 0;
        allDays.forEach(d => {
            const a = activityMap[d];
            const active = !!(a?.workoutCompleted || a?.liveSessionCompleted || a?.challengeCompleted);
            weeklyActivity[d] = active;
            // watchedMinutes is the canonical accumulated field; minutes is legacy fallback.
            const watchedMinutes = (a?.watchedMinutes as number | undefined) ?? 0;
            const legacyMinutes  = (a?.minutes        as number | undefined) ?? 0;
            const rawMinutes     = Math.max(watchedMinutes, legacyMinutes);
            const displayMinutes = active ? Math.max(1, rawMinutes) : 0;
            weeklyMinutes[d] = displayMinutes;
            console.log('[Streak Minutes]', {
                day: d,
                watchedMinutes,
                legacyMinutes,
                rawMinutes,
                displayMinutes,
                active,
            });
        });
        calendarWeek.forEach(d => {
            const a = activityMap[d];
            if (a?.challengeCompleted) weeklyChallengesCompleted++;
        });

        console.log('[Streak] getStreakData — storedStreak:', storedStreak, 'lastWorkoutDate:', lastWorkoutDate,
            'today:', todayKey, 'yesterday:', yesterdayKey, 'localNow:', getUserLocalString(tz));
        console.log('[Streak] weeklyActivity:', JSON.stringify(weeklyActivity));

        // Determine streak:
        // - If lastWorkoutDate is today or yesterday the streak is actively tracked in Firestore.
        //   Trust storedStreak for > 7 days; cross-check with rolling days for shorter ones.
        // - Otherwise (stale/missing lastWorkoutDate) scan up to 60 days back.
        //   Grace: if today has no activity yet, the scan continues from yesterday.
        const streakIsTracked = storedStreak > 0 &&
            (lastWorkoutDate === todayKey || lastWorkoutDate === yesterdayKey);

        console.log('[Streak] streakIsTracked:', streakIsTracked);

        let effectiveStreak: number;
        if (streakIsTracked && storedStreak > 7) {
            effectiveStreak = storedStreak;
            console.log('[Streak] path: long stored streak', storedStreak);
        } else if (streakIsTracked) {
            // Cross-check with rolling 7-day window (newest-first scan)
            const rolling = last7Days(tz); // oldest → newest
            let i = rolling.length - 1;
            if (!weeklyActivity[rolling[i]]) i--; // grace: today inactive → start from yesterday
            let activityStreak = 0;
            for (; i >= 0; i--) {
                if (weeklyActivity[rolling[i]]) activityStreak++;
                else break;
            }
            effectiveStreak = Math.max(storedStreak, activityStreak);
            console.log('[Streak] path: tracked cross-check — activityStreak:', activityStreak,
                'storedStreak:', storedStreak, '→', effectiveStreak);
        } else {
            console.log('[Streak] path: full scan (storedStreak stale or 0)');
            effectiveStreak = await calculateStreakFromActivity(uid, tz);
            if (effectiveStreak > storedStreak) {
                console.log('[Streak] getStreakData — self-healing streak to', effectiveStreak);
                updateDoc(doc(db, 'users', uid), { currentStreak: effectiveStreak }).catch(() => {});
            }
        }

        // Self-heal bestStreak if it lags behind
        const effectiveBest = Math.max(storedBest, effectiveStreak);
        if (effectiveBest > storedBest) {
            console.log('[Streak] getStreakData — self-healing bestStreak to', effectiveBest);
            updateDoc(doc(db, 'users', uid), { bestStreak: effectiveBest }).catch(() => {});
        }

        return {
            currentStreak: effectiveStreak,
            bestStreak: effectiveBest,
            lastWorkoutDate,
            weeklyActivity,
            weeklyMinutes,
            weeklyChallengesCompleted,
            timezone: tz,
            totalWorkouts: data.totalWorkouts ?? 0,
            totalLiveSessions: data.totalLiveSessions ?? 0,
            credits: data.credits ?? 0,
            badges: data.badges ?? [],
            leaderboardScore: data.leaderboardScore ?? 0,
        };
    },

    /**
     * Called on app load if Firestore shows workout minutes but no streak recorded.
     * Writes today's activity doc then runs recordActivity to calculate and persist the streak.
     */
    async backfillStreak(uid: string): Promise<void> {
        const tz = await TimezoneService.getForUser(uid);
        logStreakDebug({ timezone: tz, label: 'backfillStreak' });
        const dateKey = today(tz);
        const userRef = doc(db, 'users', uid);
        const activityRef = doc(db, 'users', uid, 'activity', dateKey);

        const [userSnap, activitySnap] = await Promise.all([
            getDoc(userRef),
            getDoc(activityRef),
        ]);

        const userData = userSnap.data() ?? {};
        const actData = activitySnap.data() ?? {};

        const hasMinutes = ((userData.totalWorkoutMinutes as number) ?? 0) > 0;
        const hasStreak = ((userData.currentStreak as number) ?? 0) > 0 ||
            ((userData.streakDays as number) ?? 0) > 0;
        const streakCounted = actData.streakCounted === true;
        const lastWorkoutDate = userData.lastWorkoutDate as string | null;
        const todayHasActivity = !!(actData.workoutCompleted || actData.liveSessionCompleted || actData.challengeCompleted);

        // Case 1: has minutes but no streak at all — write activity doc and seed streak
        if (hasMinutes && !hasStreak && !streakCounted) {
            console.log('[Streak] backfillStreak: seeding missing streak for', dateKey);
            await setDoc(activityRef, {
                challengeCompleted: true,
                watchedMinutes: (userData.totalWorkoutMinutes as number) ?? 1,
                watchCount: increment(1),
                completed: true,
                completedAt: serverTimestamp(),
                date: dateKey,
                createdAt: serverTimestamp(),
            }, { merge: true });
            await StreakService.recordActivity(uid, 'workout');
            return;
        }

        // Case 2: today's activity exists but recordActivity never finished (network blip etc.)
        if (todayHasActivity && !streakCounted && lastWorkoutDate !== dateKey) {
            console.log('[Streak] backfillStreak: today has activity but streak not counted, repairing for', dateKey);
            await StreakService.recordActivity(uid, 'workout');
        }
    },

    async checkAndBreakStreak(uid: string): Promise<{ wasReset: boolean }> {
        const tz = await TimezoneService.getForUser(uid);
        logStreakDebug({ timezone: tz, label: 'checkAndBreakStreak' });
        const userSnap = await getDoc(doc(db, 'users', uid));
        const data = userSnap.data();
        if (!data) return { wasReset: false };

        const lastDate = data.lastWorkoutDate as string | null;
        if (!lastDate) return { wasReset: false };

        const todayStr = today(tz);
        const yesterdayStr = yesterday(tz);

        // If last workout was today or yesterday, streak is intact
        if (lastDate === todayStr || lastDate === yesterdayStr) {
            return { wasReset: false };
        }

        // More than 1 day gap — reset streak
        await updateDoc(doc(db, 'users', uid), { currentStreak: 0 });
        return { wasReset: true };
    },
};
