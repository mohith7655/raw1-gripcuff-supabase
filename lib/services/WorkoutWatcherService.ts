import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    getDocs,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';

const COL = 'liveViewers';

// Doc is filtered from the UI list after 60s of no heartbeat.
// Heartbeat fires every 15s → user must miss 4 consecutive beats to be hidden.
const DISPLAY_STALE_MS = 60_000;

// Ghost docs older than 120s are hard-deleted on the next join (cleanup pass).
const CLEANUP_STALE_MS = 120_000;

export interface WatcherDoc {
    userId: string;
    displayName: string;
    username: string;
    profilePhoto: string | null;
    gender: string | null;
    age: number | null;
    joinedAt: Timestamp | null;
    lastActive: Timestamp | null;
    // legacy field written by the old useLiveViewerCount hook
    lastSeen?: Timestamp | null;
}

export interface ActiveWatcher extends WatcherDoc {
    uid: string; // same as userId — the Firestore doc id
}

export interface JoinProfile {
    displayName: string;
    username?: string | null;
    profilePhoto?: string | null;
    gender?: string | null;
    age?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function viewersColRef(videoId: string) {
    return collection(db, COL, videoId, 'viewers');
}

function viewerDocRef(videoId: string, uid: string) {
    return doc(db, COL, videoId, 'viewers', uid);
}

/**
 * Returns the most recent activity timestamp from a viewer doc.
 * Checks both `lastActive` (new format) and `lastSeen` (old format written by
 * the legacy useLiveViewerCount hook) and uses whichever is more recent.
 * Returns 0 if both are absent (treat as infinitely old).
 */
function mostRecentActivityMs(data: WatcherDoc): number {
    const lastActiveMs = data.lastActive?.toMillis?.() ?? 0;
    const lastSeenMs   = data.lastSeen?.toMillis?.()   ?? 0;
    return Math.max(lastActiveMs, lastSeenMs);
}

/**
 * Returns true if the viewer should be shown in the UI.
 * A null/undefined timestamp means the serverTimestamp() sentinel hasn't
 * resolved from the server yet — include the doc optimistically so the
 * joining user's count doesn't flicker.
 */
export function isViewerActive(data: WatcherDoc): boolean {
    const ms = mostRecentActivityMs(data);
    if (ms === 0) return true; // both fields absent — treat as fresh (pending write)
    return Date.now() - ms <= DISPLAY_STALE_MS;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class WorkoutWatcherService {
    /**
     * Write (or overwrite) the viewer doc on join.
     */
    static async join(videoId: string, uid: string, p: JoinProfile): Promise<void> {
        const payload: WatcherDoc = {
            userId: uid,
            displayName: p.displayName,
            username: p.username || p.displayName,
            profilePhoto: p.profilePhoto ?? null,
            gender: p.gender ?? null,
            age: p.age ?? null,
            joinedAt: serverTimestamp() as unknown as Timestamp,
            lastActive: serverTimestamp() as unknown as Timestamp,
        };
        console.log('[WATCHERS] Viewer joined:', uid, { videoId, displayName: payload.displayName });
        await setDoc(viewerDocRef(videoId, uid), payload);
    }

    /**
     * Heartbeat — keeps lastActive fresh.
     * Uses setDoc+merge so it re-creates the doc if it was deleted (e.g. by the
     * cleanup pass or a crash). Always includes userId to satisfy the Firestore rule.
     */
    static async heartbeat(videoId: string, uid: string): Promise<void> {
        console.log('[WATCHERS] Heartbeat:', uid);
        await setDoc(
            viewerDocRef(videoId, uid),
            { userId: uid, lastActive: serverTimestamp() },
            { merge: true },
        );
    }

    /**
     * Remove the viewer doc on clean exit.
     */
    static async leave(videoId: string, uid: string): Promise<void> {
        console.log('[WATCHERS] Viewer left:', uid, { videoId });
        await deleteDoc(viewerDocRef(videoId, uid));
    }

    /**
     * Cleanup pass — called once on join.
     *
     * Reads every doc in the collection and deletes any whose last activity
     * is older than CLEANUP_STALE_MS (120s). This removes ghost docs from
     * previous sessions that never got cleaned up (e.g. app killed, crash).
     *
     * The Firestore rule allows deleting docs where lastActive < now - 120s,
     * so this works for any user's stale docs, not just the current user's.
     * Permission errors are caught silently — the worst outcome is that a
     * ghost doc isn't deleted on this pass.
     */
    static async purgeStaleViewers(videoId: string): Promise<void> {
        console.log('[WATCHERS] Running stale doc cleanup for videoId:', videoId);
        try {
            const snapshot = await getDocs(viewersColRef(videoId));
            const now = Date.now();
            const deletePromises: Promise<void>[] = [];

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data() as WatcherDoc;
                const lastActiveMs = data.lastActive?.toMillis?.() ?? null;
                const lastSeenMs   = data.lastSeen?.toMillis?.()   ?? null;
                const lastMs = Math.max(lastActiveMs ?? 0, lastSeenMs ?? 0);

                // lastMs === 0 means both timestamps are absent — likely a pending write,
                // or a doc created with incomplete data. Skip these to avoid 403 errors
                // since the Firestore rule requires lastActive to be defined.
                if (lastMs === 0) {
                    console.log('[WATCHERS] Stale doc skipped (no lastActive):', docSnap.id);
                    return;
                }

                const ageMs = now - lastMs;
                if (ageMs > CLEANUP_STALE_MS) {
                    console.log('[WATCHERS] Purging ghost doc:', docSnap.id, `(${Math.round(ageMs / 1000)}s old)`);
                    deletePromises.push(
                        deleteDoc(docSnap.ref).catch((err) => {
                            // Permission denied if doc is fresh per server rules — ignore
                            console.log('[WATCHERS] Could not purge doc:', docSnap.id, err?.code);
                        }),
                    );
                }
            });

            await Promise.allSettled(deletePromises);
            console.log('[WATCHERS] Cleanup pass done. Attempted:', deletePromises.length, 'deletions');
        } catch (err: any) {
            console.warn('[WATCHERS] Cleanup pass failed:', err?.code, err?.message);
        }
    }

    /**
     * Subscribe to realtime viewer updates for a video.
     * Returns the Firestore unsubscribe function.
     */
    static subscribe(
        videoId: string,
        onChange: (watchers: ActiveWatcher[]) => void,
        onError?: (err: Error) => void,
    ): Unsubscribe {
        console.log('[WATCHERS] Listener attached for videoId:', videoId);

        return onSnapshot(
            viewersColRef(videoId),
            { includeMetadataChanges: false },
            (snapshot) => {
                console.log('[WATCHERS] Snapshot size:', snapshot.size);

                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added')    console.log('[WATCHERS] Doc added:', change.doc.id);
                    if (change.type === 'modified') console.log('[WATCHERS] Doc modified:', change.doc.id);
                    if (change.type === 'removed')  console.log('[WATCHERS] Doc removed:', change.doc.id);
                });

                const active: ActiveWatcher[] = [];

                snapshot.docs.forEach((docSnap) => {
                    const data = docSnap.data() as WatcherDoc;
                    if (!isViewerActive(data)) {
                        console.log('[WATCHERS] Stale doc skipped:', docSnap.id,
                            `lastActive=${data.lastActive?.toMillis?.()}, lastSeen=${data.lastSeen?.toMillis?.()}`);
                        return;
                    }
                    active.push({ uid: docSnap.id, ...data });
                });

                console.log('[WATCHERS] Current count:', active.length);
                onChange(active);
            },
            (err) => {
                console.error('[WATCHERS] Listener error:', err.code, err.message);
                onError?.(err);
            },
        );
    }
}
