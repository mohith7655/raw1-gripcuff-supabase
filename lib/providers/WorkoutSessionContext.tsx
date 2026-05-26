import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { WorkoutSessionService } from '../services/workoutSession.service';
import { ScheduledSessionService } from '../services/scheduledSession.service';
import { SessionReminderService } from '../services/sessionReminder.service';
import { WorkoutSession, WorkoutInviteNotification } from '../models/WorkoutSession';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';
import { InviteAcceptedModal } from '../components/InviteAcceptedModal';
import { navigationRef } from '../core/navigation';

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
                setAcceptancePopup({
                    guestName: justAccepted.guestName,
                    videoTitle: justAccepted.videoTitle,
                    sessionId: justAccepted.id,
                    videoId: justAccepted.videoId,
                });
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

    const refreshSessions = async () => {
        if (supabaseUserId) await loadAll(supabaseUserId);
    };

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
                            navigationRef.navigate('VideoPlayer' as never, {
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
        </WorkoutSessionContext.Provider>
    );
}

export function useWorkoutSession() {
    const ctx = useContext(WorkoutSessionContext);
    if (!ctx) throw new Error('useWorkoutSession must be used within WorkoutSessionProvider');
    return ctx;
}
