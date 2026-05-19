import { useEffect, useMemo, useState } from 'react';
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    Timestamp,
    where,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';

export interface SocialScheduledEntry {
    id: string;
    userId: string;
    displayName: string;
    programTitle: string | null;
    workoutTitle: string | null;
    videoTitle: string;
    combinedTitle: string;
    scheduledFor: Timestamp;
    isPublic: boolean;
    isMine: boolean;
}

export interface SocialOpenEntry {
    id: string;
    kind: 'stranger_invite' | 'workout_session';
    status: string;
    title: string;
    subtitle: string;
    startsAt: Timestamp | null;
    hostUid: string | null;
    hostName: string | null;
}

interface Params {
    videoId: string | null | undefined;
    currentUid: string | null | undefined;
    activeLiveCount: number;
}

export function useWorkoutSocialHub({ videoId, currentUid, activeLiveCount }: Params) {
    const [scheduled, setScheduled] = useState<SocialScheduledEntry[]>([]);
    const [open, setOpen] = useState<SocialOpenEntry[]>([]);

    useEffect(() => {
        if (!videoId || !currentUid) {
            setScheduled([]);
            return;
        }

        const normalizedVideoId = String(videoId);
        console.log('[SOCIAL HUB] effect running — videoId:', normalizedVideoId, '| currentUid:', currentUid);
        let rowsByVideo: Array<Record<string, any>> = [];
        let rowsByWorkout: Array<Record<string, any>> = [];

        const rebuildScheduled = async () => {
            const now = Date.now();
            const mergedMap = new Map<string, Record<string, any>>();
            [...rowsByVideo, ...rowsByWorkout].forEach((r) => mergedMap.set(r.id, r));
            const mergedRows = Array.from(mergedMap.values());

            console.log('[SOCIAL HUB] scheduled snapshot size:', mergedRows.length);
            console.log('[SOCIAL HUB] scheduled docs:', mergedRows.map((r) => ({
                id: r.id,
                userId: r.userId,
                videoId: r.videoId,
                workoutId: r.workoutId,
                status: r.status,
                scheduledFor: (r.scheduledFor as Timestamp)?.toMillis?.() ?? null,
                isPublic: r.isPublic,
            })));

            const visible = mergedRows.filter((r) => {
                const at = (r.scheduledFor as Timestamp)?.toMillis?.() ?? 0;
                // 30-minute grace window: still show recently-past scheduled workouts
                const isFuture = at >= now - 30 * 60 * 1000;
                // Include own scheduled workouts so user can see them in the social tab
                return isFuture;
            });

            const withNames = await Promise.all(visible.map(async (r) => {
                let displayName = r.displayName || '';
                if (!displayName && r.userId) {
                    try {
                        const userSnap = await getDoc(doc(db, 'users', r.userId));
                        const ud = (userSnap.data() ?? {}) as Record<string, any>;
                        displayName =
                            ud.fullName ||
                            ud.username ||
                            ud.displayName ||
                            ud.email?.split('@')[0] ||
                            r.userId.slice(0, 8);
                    } catch {
                        displayName = r.userId?.slice?.(0, 8) ?? 'Athlete';
                    }
                }

                const rawVideo  = r.videoTitle ?? r.workoutName ?? 'Workout';
                const rawParent = r.workoutTitle ?? '';
                // Use pre-built combinedTitle from Firestore if present,
                // otherwise construct it client-side for backwards-compat.
                const combinedTitle: string = r.combinedTitle
                    || (rawParent && rawParent !== rawVideo
                        ? `${rawParent} • ${rawVideo}`
                        : rawVideo);

                return {
                    id: r.id,
                    userId: r.userId,
                    displayName,
                    programTitle: r.programTitle ?? r.programName ?? null,
                    workoutTitle: r.workoutTitle ?? r.videoTitle ?? null,
                    videoTitle: rawVideo,
                    combinedTitle,
                    scheduledFor: r.scheduledFor,
                    isPublic: r.isPublic === true,
                    isMine: r.userId === currentUid,
                } as SocialScheduledEntry;
            }));

            withNames.sort((a, b) => a.scheduledFor.toMillis() - b.scheduledFor.toMillis());
            console.log('[SOCIAL HUB] merged scheduled users:', withNames.map((u) => ({
                id: u.id,
                userId: u.userId,
                displayName: u.displayName,
                when: u.scheduledFor.toMillis(),
            })));
            setScheduled(withNames);
        };

        const qByVideoId = query(
            collection(db, 'scheduledWorkouts'),
            where('videoId', '==', normalizedVideoId),
            where('status', 'in', ['active', 'scheduled'])
        );
        const qByWorkoutId = query(
            collection(db, 'scheduledWorkouts'),
            where('workoutId', '==', normalizedVideoId),
            where('status', 'in', ['active', 'scheduled'])
        );

        const unsubVideo = onSnapshot(qByVideoId, async (snap) => {
            rowsByVideo = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
            await rebuildScheduled();
        }, (err) => {
            console.warn('[SOCIAL HUB] qByVideoId error:', err.code, err.message);
            rowsByVideo = [];
            setScheduled([]);
        });

        const unsubWorkout = onSnapshot(qByWorkoutId, async (snap) => {
            rowsByWorkout = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
            await rebuildScheduled();
        }, (err) => {
            console.warn('[SOCIAL HUB] qByWorkoutId error:', err.code, err.message);
            rowsByWorkout = [];
            setScheduled([]);
        });

        return () => {
            unsubVideo();
            unsubWorkout();
        };
    }, [videoId, currentUid]);

    useEffect(() => {
        if (!videoId || !currentUid) {
            setOpen([]);
            return;
        }

        const unsubs: Array<() => void> = [];
        let invites: SocialOpenEntry[] = [];
        let sessions: SocialOpenEntry[] = [];

        const pushCombined = () => {
            const merged = [...invites, ...sessions].sort((a, b) => {
                const atA = a.startsAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
                const atB = b.startsAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
                return atA - atB;
            });
            setOpen(merged);
        };

        const invitesQ = query(
            collection(db, 'strangerInvites'),
            where('workoutId', '==', videoId),
            // Single-field only — status filtered client-side to avoid composite index.
        );
        unsubs.push(onSnapshot(invitesQ, (snap) => {
            const now = Date.now();
            invites = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as any) }))
                .filter((r) => {
                    const expires = (r.expiresAt as Timestamp)?.toMillis?.() ?? now + 1;
                    const isPending = String(r.status ?? '').toLowerCase() === 'pending';
                    return isPending && r.inviterId !== currentUid && expires > now;
                })
                .map((r) => ({
                    id: r.id,
                    kind: 'stranger_invite',
                    status: r.status,
                    title: 'Need workout partner',
                    subtitle: [r.programTitle, r.workoutTitle, r.videoTitle].filter(Boolean).join(' • ') || r.workoutTitle || 'Open invite',
                    startsAt: r.expiresAt ?? null,
                    hostUid: r.inviterId ?? null,
                    hostName: r.inviterUsername ?? null,
                }));
            pushCombined();
        }, () => {
            invites = [];
            pushCombined();
        }));

        const sessionsQ = query(
            collection(db, 'workoutSessions'),
            where('videoId', '==', videoId),
            // Single-field only — status filtered client-side to avoid composite index.
        );
        unsubs.push(onSnapshot(sessionsQ, (snap) => {
            const now = Date.now();
            sessions = snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as any) }))
                .filter((r) => {
                    const at = (r.scheduledAt as Timestamp)?.toMillis?.() ?? now;
                    const status = String(r.status ?? '').toLowerCase();
                    const isActive = status === 'pending' || status === 'accepted';
                    return isActive && at >= now - 10 * 60 * 1000;
                })
                .map((r) => ({
                    id: r.id,
                    kind: 'workout_session',
                    status: r.status,
                    title: r.status === 'accepted' ? 'Session starting soon' : 'Waiting for partner',
                    subtitle: [r.programTitle, r.workoutTitle, r.videoTitle].filter(Boolean).join(' • ') || r.videoTitle || 'Workout Session',
                    startsAt: r.scheduledAt ?? null,
                    hostUid: r.hostUid ?? null,
                    hostName: r.hostName ?? null,
                }));
            pushCombined();
        }, () => {
            sessions = [];
            pushCombined();
        }));

        return () => {
            unsubs.forEach((u) => u());
        };
    }, [videoId, currentUid]);

    return useMemo(() => ({
        scheduled,
        open,
        badges: {
            live: activeLiveCount,
            scheduled: scheduled.length,
            open: open.length,
        },
    }), [activeLiveCount, open, scheduled]);
}
