import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { WorkoutSessionService } from '../services/workoutSession.service';
import { ScheduledSessionService } from '../services/scheduledSession.service';
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
    unreadInvitesCount: number;
    loading: boolean;
    error: string | null;
    createSession: (guestUid: string, guestName: string, guestAvatarUrl: string | undefined, videoId: string, videoTitle: string, scheduledAt: Date, betCredits: number, extras?: CreateSessionExtras) => Promise<string>;
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
    const [unreadInvitesCount, setUnreadInvitesCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [acceptancePopup, setAcceptancePopup] = useState<{ guestName: string; videoTitle: string; sessionId: string } | null>(null);
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

            for (const s of all) {
                if (s.status === 'pending' && s.guestUid === uid) {
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
                });
            }

            // Update the outgoing-pending snapshot for the next diff
            prevOutgoingIdsRef.current = new Set(outgoing.map(s => s.id));

            setPendingInvites(invites);
            setPendingOutgoing(outgoing);
            setUpcomingSessions(accepted);
            setCompletedSessions(completed);
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

            await loadAll(uid);
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
            await WorkoutSessionService.acceptSession(sessionId, supabaseUserId);
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
                unreadInvitesCount,
                loading,
                error,
                createSession,
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
                        const sid = acceptancePopup.sessionId;
                        setAcceptancePopup(null);
                        if (navigationRef.isReady()) {
                            navigationRef.navigate('AgoraVideoRoom' as never, {
                                channelName: `session_${sid}`,
                                participantName: profile?.fullName ?? profile?.username ?? 'Host',
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
