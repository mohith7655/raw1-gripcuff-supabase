import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { WorkoutSessionService } from '../services/workoutSession.service';
import { ScheduledSessionService } from '../services/scheduledSession.service';
import { SessionReminderService } from '../services/sessionReminder.service';
import { WorkoutSession, WorkoutInviteNotification } from '../models/WorkoutSession';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';
import { InviteAcceptedModal } from '../components/InviteAcceptedModal';
import { InviteWaitingModal, IncomingInviteModal } from '../components/InstantWorkoutModals';
import { navigationRef } from '../core/navigation';

// How long an instant invite stays live before it auto-expires / auto-declines.
const INSTANT_TTL_MS = 60_000;
// Only invites created within this window are treated as a live "instant" ping
// worth popping the receiver modal for (avoids popping stale/scheduled rows).
// Must stay >= the TTL so a still-live invite is never treated as stale.
const INSTANT_FRESH_MS = 75_000;

export interface CreateSessionExtras {
    inviteType?: 'instant' | 'scheduled';
    category?: string;
    programName?: string;
    thumbnail?: string;
}

interface WorkoutSessionContextType {
    pendingInvites: WorkoutSession[];
    pendingOutgoing: WorkoutSession[];
    upcomingSessions: WorkoutSession[];
    completedSessions: WorkoutSession[];
    /** Self-scheduled (solo) sessions — no guest, no invite. */
    selfSessions: WorkoutSession[];
    unreadInvitesCount: number;
    loading: boolean;
    error: string | null;
    createSession: (guestUid: string, guestName: string, guestAvatarUrl: string | undefined, videoId: string, videoTitle: string, scheduledAt: Date, betCredits: number, extras?: CreateSessionExtras) => Promise<string>;
    /** Fire an INSTANT co-workout invite (video pre-picked) and open the sender's
     *  30s waiting screen; auto-navigates both users into the session on accept. */
    sendInstantWorkout: (guestUid: string, guestName: string, guestAvatarUrl: string | undefined, videoId: string, videoTitle: string) => Promise<void>;
    createSelfSession: (videoId: string, videoTitle: string, scheduledAt: Date, extras?: { category?: string; programName?: string; thumbnail?: string }) => Promise<string>;
    acceptSession: (sessionId: string) => Promise<void>;
    declineSession: (sessionId: string) => Promise<void>;
    cancelSession: (sessionId: string) => Promise<void>;
    expireSession: (sessionId: string) => Promise<void>;
    resendSession: (sessionId: string) => Promise<void>;
    refreshSessions: () => Promise<void>;
}

const WorkoutSessionContext = createContext<WorkoutSessionContextType | undefined>(undefined);

export function WorkoutSessionProvider({ children }: { children: React.ReactNode }) {
    const { user, supabaseUserId, email } = useAuth();
    const { profile } = useUser();

    const [pendingInvites, setPendingInvites] = useState<WorkoutSession[]>([]);
    const [pendingOutgoing, setPendingOutgoing] = useState<WorkoutSession[]>([]);
    const [upcomingSessions, setUpcomingSessions] = useState<WorkoutSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<WorkoutSession[]>([]);
    const [selfSessions, setSelfSessions] = useState<WorkoutSession[]>([]);
    const [unreadInvitesCount, setUnreadInvitesCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [acceptancePopup, setAcceptancePopup] = useState<{
        guestName: string;
        videoTitle: string;
        sessionId: string;
        videoId: string;
    } | null>(null);
    // Tracks session IDs that the current user (as host) had as outgoing-pending
    // on the previous loadAll cycle, so we can detect a pending→accepted transition
    // and pop the "Join Now" modal exactly once per acceptance.
    const prevOutgoingIdsRef = useRef<Set<string>>(new Set());
    // Prevents the modal from refiring for the same session on subsequent reloads.
    const announcedAcceptedIdsRef = useRef<Set<string>>(new Set());

    // ── Instant "workout with a friend" flow (Phase 1) ────────────────────────
    type InstantOutgoing = { sessionId: string; friendName: string; friendAvatar?: string | null; videoTitle: string; videoId: string; expiresAt: number };
    type InstantIncoming = { sessionId: string; hostName: string; hostAvatar?: string | null; videoTitle: string; videoId: string; expiresAt: number };
    const [instantOutgoing, setInstantOutgoing] = useState<InstantOutgoing | null>(null);
    const [instantIncoming, setInstantIncoming] = useState<InstantIncoming | null>(null);
    const [instantBusy, setInstantBusy] = useState(false);
    const [, setCountTick] = useState(0); // drives the 1s countdown re-render
    // Refs so loadAll (a []-dep callback) can read current instant state.
    const instantOutgoingRef = useRef<InstantOutgoing | null>(null);
    instantOutgoingRef.current = instantOutgoing;
    const instantIncomingRef = useRef<InstantIncoming | null>(null);
    instantIncomingRef.current = instantIncoming;
    // Guest-side: invite IDs already seen, so we only pop the modal for genuinely
    // NEW instant invites (not the ones already sitting in the list on first load).
    const seenInviteIdsRef = useRef<Set<string>>(new Set());
    const invitesInitialisedRef = useRef(false);

    // Route both participants into the synced co-workout session.
    const navigateToCoWorkout = (session: WorkoutSession, iAmHost: boolean) => {
        if (!navigationRef.isReady()) return;
        const friendName = iAmHost ? session.guestName : session.hostName;
        (navigationRef as any).navigate('SyncedVideoPlayer', {
            sessionId: session.id,
            videoId: session.videoId,
            videoTitle: session.videoTitle,
            friendName,
        });
    };

    const loadAll = useCallback(async (uid: string) => {
        try {
            setLoading(true);
            setError(null);

            const all = await WorkoutSessionService.getAllUserSessions(uid);

            const invites: WorkoutSession[] = [];
            const outgoing: WorkoutSession[] = [];
            const accepted: WorkoutSession[] = [];
            const completed: WorkoutSession[] = [];
            const self: WorkoutSession[] = [];

            for (const s of all) {
                // Self-scheduled sessions (no guest) are their own bucket —
                // they must be checked first so they don't fall into outgoing.
                if (s.sessionType === 'self') {
                    self.push(s);
                } else if (s.status === 'pending' && s.guestUid === uid) {
                    invites.push(s);
                } else if (s.status === 'pending' && s.hostUid === uid) {
                    outgoing.push(s);
                } else if (s.status === 'accepted') {
                    accepted.push(s);
                } else if (
                    s.status === 'completed' ||
                    s.status === 'declined' ||
                    s.status === 'cancelled' ||
                    s.status === 'expired'
                ) {
                    completed.push(s);
                }
            }

            console.log('[Sessions] self scheduled', self.length);
            console.log('[Sessions] outgoing pending', outgoing.length);
            console.log('[Sessions] incoming pending', invites.length);
            console.log('[Sessions] upcoming accepted', accepted.length);

            // Detect host-side acceptance: any accepted session that was outgoing-pending
            // on the previous tick and we haven't already announced.
            const justAccepted = accepted.find(s =>
                s.hostUid === uid
                && prevOutgoingIdsRef.current.has(s.id)
                && !announcedAcceptedIdsRef.current.has(s.id)
            );
            if (justAccepted) {
                console.log('[Sessions] host detected acceptance', justAccepted.id);
                announcedAcceptedIdsRef.current.add(justAccepted.id);
                // Instant invite we're actively waiting on → skip the "Join Now"
                // modal and drop the host straight into the session.
                if (instantOutgoingRef.current?.sessionId === justAccepted.id) {
                    setInstantOutgoing(null);
                    navigateToCoWorkout(justAccepted, true);
                } else {
                    setAcceptancePopup({
                        guestName: justAccepted.guestName,
                        videoTitle: justAccepted.videoTitle,
                        sessionId: justAccepted.id,
                        videoId: justAccepted.videoId,
                    });
                }
            }

            // Guest-side: pop the incoming-invite countdown for a genuinely NEW,
            // freshly-created pending invite (an instant ping). On first load we
            // just seed the "seen" set so pre-existing invites never pop.
            const nowMs = Date.now();
            if (!invitesInitialisedRef.current) {
                invites.forEach(s => seenInviteIdsRef.current.add(s.id));
                invitesInitialisedRef.current = true;
            } else if (!instantIncomingRef.current) {
                const fresh = invites.find(s =>
                    !seenInviteIdsRef.current.has(s.id)
                    && s.createdAt instanceof Date
                    && nowMs - s.createdAt.getTime() < INSTANT_FRESH_MS
                    && (s.createdAt.getTime() + INSTANT_TTL_MS) - nowMs > 3000, // enough time left to act
                );
                invites.forEach(s => seenInviteIdsRef.current.add(s.id));
                if (fresh) {
                    setInstantIncoming({
                        sessionId: fresh.id,
                        hostName: fresh.hostName,
                        hostAvatar: fresh.hostAvatarUrl ?? null,
                        videoTitle: fresh.videoTitle,
                        videoId: fresh.videoId,
                        expiresAt: fresh.createdAt.getTime() + INSTANT_TTL_MS,
                    });
                }
            } else {
                invites.forEach(s => seenInviteIdsRef.current.add(s.id));
            }

            // Update the outgoing-pending snapshot for the next diff
            prevOutgoingIdsRef.current = new Set(outgoing.map(s => s.id));

            setPendingInvites(invites);
            setPendingOutgoing(outgoing);
            setUpcomingSessions(accepted);
            setCompletedSessions(completed);
            setSelfSessions(self);
        } catch (err) {
            console.error('Failed to load workout sessions', err);
            const msg = (err as Error).message;
            if (!msg.includes('timed out')) setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (supabaseUserId) {
            loadAll(supabaseUserId);
        } else {
            setPendingInvites([]);
            setPendingOutgoing([]);
            setUpcomingSessions([]);
            setCompletedSessions([]);
            setSelfSessions([]);
        }
    }, [supabaseUserId, loadAll]);

    // ── Realtime: re-fetch whenever a session or invite row changes ───────────
    // Covers both hosted sessions (host_user_id = uid) and
    // invited sessions (invited_user_id = uid).
    useEffect(() => {
        if (!supabaseUserId) return;
        const uid = supabaseUserId;

        const unsub = ScheduledSessionService.subscribeForUser(uid, () => {
            console.log('[WorkoutSessionContext] realtime change — reloading sessions');
            loadAll(uid).catch(() => {});
        });

        return unsub;
    }, [supabaseUserId, loadAll]);

    const createSession = async (guestUid: string, guestName: string, guestAvatarUrl: string | undefined, videoId: string, videoTitle: string, scheduledAt: Date, betCredits: number, extras?: CreateSessionExtras) => {
        if (!supabaseUserId) {
            throw new Error('Please log in again. Not authenticated');
        }
        const uid = supabaseUserId;

        const hostNameFinal = profile?.fullName || profile?.username || email?.split('@')[0] || 'User';
        const guestNameFinal = guestName || 'Friend';

        try {
            setError(null);

            const sessionId = await WorkoutSessionService.createSession(
                uid,
                hostNameFinal,
                profile?.profileImageUrl,
                guestUid,
                guestNameFinal,
                guestAvatarUrl,
                videoId,
                videoTitle,
                scheduledAt,
                betCredits,
                extras
            );

            // Schedule a local notification to fire at the exact session time.
            // Non-fatal — a failed reminder should never block session creation.
            if (Platform.OS !== 'web') {
                SessionReminderService.scheduleSessionReminder({
                    sessionId,
                    videoTitle,
                    friendName: guestNameFinal,
                    scheduledAt,
                    isSelf: false,
                }).catch(e => console.warn('[WorkoutSessionContext] schedule reminder failed:', e));
            }

            await loadAll(uid);
            return sessionId;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const createSelfSession = async (
        videoId: string,
        videoTitle: string,
        scheduledAt: Date,
        extras?: { category?: string; programName?: string; thumbnail?: string },
    ): Promise<string> => {
        if (!supabaseUserId) throw new Error('Not authenticated');
        try {
            setError(null);
            const sessionId = await WorkoutSessionService.createSelfSession(
                supabaseUserId,
                videoId,
                videoTitle,
                scheduledAt,
                extras,
            );

            // Schedule a local notification at the exact session start time.
            if (Platform.OS !== 'web') {
                SessionReminderService.scheduleSessionReminder({
                    sessionId,
                    videoTitle,
                    friendName: null,
                    scheduledAt,
                    isSelf: true,
                }).catch(e => console.warn('[WorkoutSessionContext] schedule self reminder failed:', e));
            }

            await loadAll(supabaseUserId);
            return sessionId;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const acceptSession = async (sessionId: string) => {
        if (!supabaseUserId) return;
        try {
            setError(null);
            // Capture session data BEFORE it disappears from pendingInvites
            // so we can schedule the guest's reminder at the correct workout time.
            const session = pendingInvites.find(s => s.id === sessionId);
            await WorkoutSessionService.acceptSession(sessionId, supabaseUserId);
            // Schedule local notification at workout time for the guest.
            if (session && Platform.OS !== 'web') {
                const at = session.scheduledAt instanceof Date
                    ? session.scheduledAt
                    : new Date(session.scheduledAt as unknown as string);
                SessionReminderService.scheduleSessionReminder({
                    sessionId,
                    videoTitle: session.videoTitle,
                    friendName: session.hostName,   // from guest's POV: "workout with [host]"
                    scheduledAt: at,
                    isSelf: false,
                }).catch(e => console.warn('[WorkoutSessionContext] schedule accept reminder failed:', e));
            }
            await loadAll(supabaseUserId);
        } catch (err) {
            setError((err as Error).message);
            throw err;
        }
    };

    const declineSession = async (sessionId: string) => {
        if (!supabaseUserId) return;
        try {
            setError(null);
            // Cancel any existing reminder for this session before declining.
            if (Platform.OS !== 'web') {
                SessionReminderService.cancelSessionReminder(sessionId).catch(() => {});
            }
            await WorkoutSessionService.declineSession(sessionId, supabaseUserId);
            await loadAll(supabaseUserId);
        } catch (err) {
            setError((err as Error).message);
            throw err;
        }
    };

    const cancelSession = async (sessionId: string) => {
        if (!supabaseUserId) return;
        try {
            setError(null);
            // Cancel any local notification scheduled for this session.
            if (Platform.OS !== 'web') {
                SessionReminderService.cancelSessionReminder(sessionId).catch(() => {});
            }
            await WorkoutSessionService.cancelSession(sessionId);
            await loadAll(supabaseUserId);
        } catch (err) {
            setError((err as Error).message);
            throw err;
        }
    };

    const resendSession = async (sessionId: string) => {
        if (!supabaseUserId) return;
        try {
            setError(null);
            const hostName = profile?.fullName ?? profile?.username ?? 'User';
            const hostAvatar = profile?.profileImageUrl;
            await WorkoutSessionService.resendSession(sessionId, hostName, hostAvatar);
            await loadAll(supabaseUserId);
        } catch (err) {
            setError((err as Error).message);
            throw err;
        }
    };

    const expireSession = async (sessionId: string) => {
        if (!supabaseUserId) return;
        try {
            await WorkoutSessionService.expireSession(sessionId);
            await loadAll(supabaseUserId);
        } catch (err) {
            console.warn('expireSession failed:', err);
        }
    };

    // ── Instant-invite timers ────────────────────────────────────────────────
    // 1s ticker to re-render the live countdown while either modal is open.
    useEffect(() => {
        if (!instantOutgoing && !instantIncoming) return;
        const iv = setInterval(() => setCountTick(t => t + 1), 1000);
        return () => clearInterval(iv);
    }, [!!instantOutgoing, !!instantIncoming]);

    // Sender: auto-expire (cancel) the invite if unaccepted within the TTL.
    useEffect(() => {
        if (!instantOutgoing) return;
        const to = setTimeout(async () => {
            const o = instantOutgoingRef.current;
            if (!o) return;
            // Re-check acceptance right at the deadline before cancelling — the
            // guest may have accepted just now. If loadAll detects it, it clears
            // instantOutgoing (and navigates the host), so we skip the cancel.
            if (supabaseUserId) await loadAll(supabaseUserId).catch(() => {});
            const stillWaiting = instantOutgoingRef.current;
            if (stillWaiting && stillWaiting.sessionId === o.sessionId) {
                cancelSession(o.sessionId).catch(() => {});
                setInstantOutgoing(null);
            }
        }, Math.max(0, instantOutgoing.expiresAt - Date.now()));
        return () => clearTimeout(to);
    }, [instantOutgoing?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sender fallback: while waiting on an instant invite, poll for acceptance.
    // Realtime UPDATEs can be missed when the sender's tab is backgrounded /
    // the socket drops (seen as "realtime: CLOSED"), so we actively re-run
    // loadAll — its pending→accepted diff then navigates the host into the
    // session even without the realtime push. Also refresh the moment the tab
    // regains focus so a returning user is pulled in immediately.
    useEffect(() => {
        if (!instantOutgoing || !supabaseUserId) return;
        const uid = supabaseUserId;
        const iv = setInterval(() => { loadAll(uid).catch(() => {}); }, 2000);
        const onVisible = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                loadAll(uid).catch(() => {});
            }
        };
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisible);
        }
        return () => {
            clearInterval(iv);
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisible);
            }
        };
    }, [instantOutgoing?.sessionId, supabaseUserId, loadAll]);

    // Receiver: auto-decline if not acted on within the TTL.
    useEffect(() => {
        if (!instantIncoming) return;
        const to = setTimeout(() => {
            const i = instantIncomingRef.current;
            if (i) {
                declineSession(i.sessionId).catch(() => {});
                setInstantIncoming(null);
            }
        }, Math.max(0, instantIncoming.expiresAt - Date.now()));
        return () => clearTimeout(to);
    }, [instantIncoming?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    const sendInstantWorkout = async (
        guestUid: string,
        guestName: string,
        guestAvatarUrl: string | undefined,
        videoId: string,
        videoTitle: string,
    ) => {
        if (!supabaseUserId) throw new Error('Please log in again. Not authenticated');
        const uid = supabaseUserId;
        const hostNameFinal = profile?.fullName || profile?.username || email?.split('@')[0] || 'User';
        const friendNameFinal = guestName || 'Friend';
        setError(null);
        const sessionId = await WorkoutSessionService.createSession(
            uid, hostNameFinal, profile?.profileImageUrl,
            guestUid, friendNameFinal, guestAvatarUrl,
            videoId, videoTitle, new Date(), 0, { inviteType: 'instant' },
        );
        // Refresh so this session is in the outgoing snapshot before the guest
        // can accept (the acceptance diff relies on it).
        await loadAll(uid);
        setInstantOutgoing({
            sessionId,
            friendName: friendNameFinal,
            friendAvatar: guestAvatarUrl ?? null,
            videoTitle,
            videoId,
            expiresAt: Date.now() + INSTANT_TTL_MS,
        });
    };

    const acceptInstant = async () => {
        const inc = instantIncomingRef.current;
        if (!inc || !supabaseUserId) return;
        setInstantBusy(true);
        try {
            await acceptSession(inc.sessionId);
            setInstantIncoming(null);
            navigateToCoWorkout(
                { id: inc.sessionId, videoId: inc.videoId, videoTitle: inc.videoTitle, hostName: inc.hostName } as WorkoutSession,
                false,
            );
        } catch (err) {
            console.warn('[WorkoutSessionContext] acceptInstant failed', err);
        } finally {
            setInstantBusy(false);
        }
    };

    const declineInstant = async () => {
        const inc = instantIncomingRef.current;
        if (!inc) return;
        setInstantIncoming(null);
        declineSession(inc.sessionId).catch(() => {});
    };

    // Memoised so its identity is stable across renders — consumers put it in
    // useFocusEffect/useEffect dep arrays, and an unstable ref there re-runs those
    // effects every render (which then call refreshSessions → setState → render …),
    // an infinite loop that showed up as the Activity/Chats tab constantly reloading.
    const refreshSessions = useCallback(async () => {
        if (supabaseUserId) await loadAll(supabaseUserId);
    }, [supabaseUserId, loadAll]);

    return (
        <WorkoutSessionContext.Provider
            value={{
                pendingInvites,
                pendingOutgoing,
                upcomingSessions,
                completedSessions,
                selfSessions,
                unreadInvitesCount,
                loading,
                error,
                createSession,
                sendInstantWorkout,
                createSelfSession,
                acceptSession,
                declineSession,
                cancelSession,
                expireSession,
                resendSession,
                refreshSessions,
            }}
        >
            {children}
            {acceptancePopup && (
                <InviteAcceptedModal
                    guestName={acceptancePopup.guestName}
                    videoTitle={acceptancePopup.videoTitle}
                    onClose={() => setAcceptancePopup(null)}
                    onJoin={() => {
                        const popup = acceptancePopup;
                        setAcceptancePopup(null);
                        if (navigationRef.isReady()) {
                            // Route host to VideoPlayerScreen — the same path used by the
                            // "Join Session" button in UpcomingSessionsScreen (navigateToSession).
                            // hostUserId = supabaseUserId because this popup only fires for the host.
                            (navigationRef as any).navigate('VideoPlayer', {
                                videoId:          popup.videoId,
                                title:            popup.videoTitle,
                                allowInvite:      false,
                                sessionId:        popup.sessionId,
                                hostUserId:       supabaseUserId,
                                coWorkoutChannel: popup.sessionId,
                                friendName:       popup.guestName,
                            } as never);
                        }
                    }}
                />
            )}

            {/* Instant "workout with a friend" — sender waiting screen */}
            <InviteWaitingModal
                visible={!!instantOutgoing}
                friendName={instantOutgoing?.friendName ?? ''}
                friendAvatar={instantOutgoing?.friendAvatar}
                videoTitle={instantOutgoing?.videoTitle ?? ''}
                seconds={instantOutgoing ? Math.max(0, Math.ceil((instantOutgoing.expiresAt - Date.now()) / 1000)) : 0}
                onCancel={() => {
                    const o = instantOutgoingRef.current;
                    if (o) cancelSession(o.sessionId).catch(() => {});
                    setInstantOutgoing(null);
                }}
            />

            {/* Instant "workout with a friend" — receiver popup */}
            <IncomingInviteModal
                visible={!!instantIncoming}
                hostName={instantIncoming?.hostName ?? ''}
                hostAvatar={instantIncoming?.hostAvatar}
                videoTitle={instantIncoming?.videoTitle ?? ''}
                seconds={instantIncoming ? Math.max(0, Math.ceil((instantIncoming.expiresAt - Date.now()) / 1000)) : 0}
                busy={instantBusy}
                onAccept={acceptInstant}
                onDecline={declineInstant}
            />
        </WorkoutSessionContext.Provider>
    );
}

export function useWorkoutSession() {
    const ctx = useContext(WorkoutSessionContext);
    if (!ctx) throw new Error('useWorkoutSession must be used within WorkoutSessionProvider');
    return ctx;
}
