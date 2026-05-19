import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';

// Matches the actual Firestore schema written by WorkoutReminderService
export interface ScheduledEntry {
    id: string;
    userId: string;
    workoutId: string;      // field name in Firestore (was 'videoId' in older code)
    workoutName: string;
    programName: string | null;
    thumbnail: string | null;
    scheduledFor: Timestamp; // field name in Firestore (was 'scheduledTime' in older code)
    isShared: boolean;
    partnerUid?: string;
    displayName: string;
    isFriend: boolean;
}

/**
 * Real-time subscription to upcoming scheduledWorkouts for a video.
 * Uses the actual Firestore field names: workoutId and scheduledFor.
 * Excludes the current user, orders soonest first, attaches isFriend + displayName.
 * Returns the Firestore unsubscribe function.
 */
export function subscribeScheduledForVideo(
    videoId: string,
    currentUid: string,
    friendUids: string[],
    onChange: (entries: ScheduledEntry[]) => void
): () => void {
    // Single-field equality query only — avoids composite index requirement.
    // scheduledFor filtering and sorting done client-side.
    const q = query(
        collection(db, 'scheduledWorkouts'),
        where('workoutId', '==', videoId)
    );

    return onSnapshot(
        q,
        async (snap) => {
            const nowMs = Date.now();
            const raw = snap.docs
                .map(d => ({ id: d.id, ...(d.data() as any) }))
                .filter(
                    (d) =>
                        d.userId !== currentUid &&
                        ((d.scheduledAt as Timestamp)?.toMillis?.() ?? (d.scheduledFor as Timestamp)?.toMillis?.()) >= nowMs
                )
                .sort(
                    (a, b) =>
                        ((a.scheduledAt as Timestamp)?.toMillis?.() ?? (a.scheduledFor as Timestamp).toMillis()) -
                        ((b.scheduledAt as Timestamp)?.toMillis?.() ?? (b.scheduledFor as Timestamp).toMillis())
                );

            const entries: ScheduledEntry[] = await Promise.all(
                raw.map(async (d) => {
                    // displayName may already be embedded in the doc (optional field)
                    let displayName: string = d.displayName ?? d.workoutName ?? '';
                    if (!displayName) {
                        try {
                            const userSnap = await getDoc(doc(db, 'users', d.userId));
                            const ud = (userSnap.data() ?? {}) as Record<string, any>;
                            displayName =
                                ud.fullName ||
                                ud.username ||
                                ud.displayName ||
                                ud.email?.split('@')[0] ||
                                d.userId.slice(0, 8);
                        } catch {
                            displayName = d.userId.slice(0, 8);
                        }
                    }
                    return {
                        id: d.id,
                        userId: d.userId,
                        workoutId: d.workoutId,
                        workoutName: d.workoutName ?? '',
                        programName: d.programName ?? null,
                        thumbnail: d.thumbnail ?? null,
                        scheduledFor: d.scheduledAt ?? d.scheduledFor,
                        isShared: d.isShared ?? false,
                        partnerUid: d.partnerUid,
                        displayName,
                        isFriend: friendUids.includes(d.userId),
                    };
                })
            );

            onChange(entries);
        },
        (err) => {
            console.warn('[ScheduledWorkoutsService] snapshot error:', err);
        }
    );
}
