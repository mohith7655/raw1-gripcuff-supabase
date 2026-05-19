import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
    WorkoutWatcherService,
    type ActiveWatcher,
    type JoinProfile,
} from '../services/WorkoutWatcherService';

const HEARTBEAT_MS = 15_000;

export interface WatcherProfile {
    displayName: string;
    username?: string | null;
    profilePhoto?: string | null;
    gender?: string | null;
    age?: number | null;
}

export interface UseWorkoutWatchersResult {
    count: number;
    viewers: ActiveWatcher[];
}

/**
 * Manages live viewer presence for a workout video.
 *
 * Guarantees:
 * - Listener is set up exactly once per (videoId, userId) pair.
 * - No stale closures: profile is read from a ref at call-time.
 * - No race condition: if cleanup runs before async join completes, the
 *   doc is deleted immediately when join finishes.
 * - Heartbeat uses setDoc+merge so it re-creates the doc if it was deleted.
 * - App backgrounding pauses the heartbeat; foregrounding re-joins cleanly.
 */
export function useWorkoutWatchers(
    videoId: string | null | undefined,
    userId: string | null | undefined,
    profile?: WatcherProfile | null,
): UseWorkoutWatchersResult {
    const [viewers, setViewers] = useState<ActiveWatcher[]>([]);

    // ── Stable refs ────────────────────────────────────────────────────────────

    // Always holds the latest profile without causing effect re-runs
    const profileRef = useRef<WatcherProfile | null | undefined>(profile);
    profileRef.current = profile; // sync on every render (no effect needed)

    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const joinedRef = useRef(false);

    // Shared "still mounted?" flag between the main effect and AppState effect.
    // Set to false in the main effect's cleanup so AppState handler can bail out.
    const mountedRef = useRef(false);

    // ── Heartbeat helpers (stable — only touch refs, no state) ─────────────────

    const stopHeartbeat = () => {
        if (heartbeatRef.current !== null) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    };

    const startHeartbeat = (vid: string, uid: string) => {
        stopHeartbeat();
        heartbeatRef.current = setInterval(() => {
            WorkoutWatcherService.heartbeat(vid, uid).catch((err) => {
                console.warn('[WATCHERS] Heartbeat failed:', err?.code, err?.message);
            });
        }, HEARTBEAT_MS);
    };

    // ── Main presence + listener effect ───────────────────────────────────────

    useEffect(() => {
        if (!videoId) return;

        // Local flag for this specific effect invocation.
        // When cleanup runs, this flips to false — async join checks it
        // after awaiting to decide whether to clean up or proceed.
        let alive = true;
        mountedRef.current = true;

        // ── Listener ──────────────────────────────────────────────────────────
        const unsub = WorkoutWatcherService.subscribe(
            videoId,
            (active) => {
                if (!alive) return; // don't update unmounted component
                setViewers(active);
            },
            (err) => {
                console.error('[WATCHERS] Listener error:', err);
            },
        );

        // ── Join ──────────────────────────────────────────────────────────────
        if (userId) {
            const p = profileRef.current;
            if (p) {
                const joinProfile: JoinProfile = {
                    displayName: p.displayName,
                    username: p.username ?? p.displayName,
                    profilePhoto: p.profilePhoto,
                    gender: p.gender,
                    age: p.age,
                };

                WorkoutWatcherService.join(videoId, userId, joinProfile)
                    .then(() => {
                        if (!alive) {
                            // Cleanup ran while join was in-flight — delete the doc we just wrote
                            console.log('[WATCHERS] Cleanup ran during join — leaving immediately');
                            WorkoutWatcherService.leave(videoId, userId).catch(() => {});
                            return;
                        }
                        joinedRef.current = true;
                        startHeartbeat(videoId, userId);
                        // Cleanup pass: delete ghost docs from previous sessions
                        WorkoutWatcherService.purgeStaleViewers(videoId).catch(() => {});
                    })
                    .catch((err) => {
                        console.error('[WATCHERS] Join failed:', err?.code, err?.message);
                    });
            }
        }

        // ── Cleanup ───────────────────────────────────────────────────────────
        return () => {
            alive = false;
            mountedRef.current = false;

            // 1. Detach the Firestore listener first — no more state updates
            unsub();

            // 2. Stop the heartbeat interval
            stopHeartbeat();

            // 3. Delete the presence doc (fire-and-forget — cleanup can't await)
            if (userId && joinedRef.current) {
                joinedRef.current = false;
                WorkoutWatcherService.leave(videoId, userId).catch((err) => {
                    console.warn('[WATCHERS] Leave failed:', err?.code, err?.message);
                });
            }
        };

        // profile intentionally omitted — read from profileRef.current at call time
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId, userId]);

    // ── App background / foreground ────────────────────────────────────────────

    useEffect(() => {
        if (!videoId || !userId) return;

        const handleAppStateChange = (next: AppStateStatus) => {
            // Always read profileRef.current at the time of the event,
            // not the stale closure value from when this effect ran.
            const p = profileRef.current;

            if (next === 'active') {
                if (!p) return;
                console.log('[WATCHERS] Foregrounded — re-joining');

                const joinProfile: JoinProfile = {
                    displayName: p.displayName,
                    username: p.username ?? p.displayName,
                    profilePhoto: p.profilePhoto,
                    gender: p.gender,
                    age: p.age,
                };

                WorkoutWatcherService.join(videoId, userId, joinProfile)
                    .then(() => {
                        if (!mountedRef.current) {
                            // Component unmounted while foreground-join was in flight
                            WorkoutWatcherService.leave(videoId, userId).catch(() => {});
                            return;
                        }
                        joinedRef.current = true;
                        startHeartbeat(videoId, userId);
                    })
                    .catch((err) => {
                        console.error('[WATCHERS] Foreground re-join failed:', err?.code, err?.message);
                    });
            } else {
                // Background or inactive — pause heartbeat to avoid unnecessary writes
                console.log('[WATCHERS] Backgrounded — pausing heartbeat');
                stopHeartbeat();
            }
        };

        const sub = AppState.addEventListener('change', handleAppStateChange);
        return () => sub.remove();

        // Intentionally only [videoId, userId] — profile is read from ref
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId, userId]);

    // ── Output ────────────────────────────────────────────────────────────────

    return { count: viewers.length, viewers };
}
