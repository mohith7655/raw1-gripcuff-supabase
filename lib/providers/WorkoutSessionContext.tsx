import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { WorkoutSessionService } from '../services/workoutSession.service';
import { WorkoutSession, WorkoutInviteNotification } from '../models/WorkoutSession';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';
import { collection, query as fsQuery, where, onSnapshot } from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { InviteAcceptedModal } from '../components/InviteAcceptedModal';

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
    const { user, firebaseUid, email } = useAuth();
    const { profile } = useUser();

    const [pendingInvites, setPendingInvites] = useState<WorkoutSession[]>([]);
    const [pendingOutgoing, setPendingOutgoing] = useState<WorkoutSession[]>([]);
    const [upcomingSessions, setUpcomingSessions] = useState<WorkoutSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<WorkoutSession[]>([]);
    const [unreadInvitesCount, setUnreadInvitesCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [acceptancePopup, setAcceptancePopup] = useState<{ guestName: string; videoTitle: string } | null>(null);
    const hostFirstFireRef = useRef(true);

    const loadAll = useCallback(async (uid: string) => {
        try {
            setLoading(true);
            setError(null);

            const all = await WorkoutSessionService.getAllUserSessions(uid);

            // Categorise client-side — no composite indexes needed
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

            invites.sort((a, b) => b.scheduledAt.toMillis() - a.scheduledAt.toMillis());
            outgoing.sort((a, b) => b.scheduledAt.toMillis() - a.scheduledAt.toMillis());
            accepted.sort((a, b) => b.scheduledAt.toMillis() - a.scheduledAt.toMillis());
            completed.sort((a, b) => b.scheduledAt.toMillis() - a.scheduledAt.toMillis());

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

    // Load data when user changes
    useEffect(() => {
        if (firebaseUid) {
            loadAll(firebaseUid);
        } else {
            setPendingInvites([]);
            setPendingOutgoing([]);
            setUpcomingSessions([]);
            setCompletedSessions([]);
        }
    }, [firebaseUid, loadAll]);

    // Listen for unread notifications to drive the badge count
    useEffect(() => {
        if (!firebaseUid) {
            setUnreadInvitesCount(0);
            return;
        }

        const q = fsQuery(
            collection(db, 'notifications'),
            where('toUid', '==', firebaseUid),
            where('read', '==', false),
            where('type', '==', 'workout_invite')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadInvitesCount(snapshot.size);
            if (snapshot.docChanges().some(change => change.type === 'added')) {
                loadAll(firebaseUid);
            }
        }, (err) => {
            console.warn('Error listening to notifications:', err);
        });

        return () => unsubscribe();
    }, [firebaseUid, loadAll]);

    // Real-time listener on workoutSessions so acceptance/cancellation
    // shows up instantly for BOTH host and guest without waiting for a
    // manual refresh or a notifications event.
    useEffect(() => {
        if (!firebaseUid) return;

        const uid = firebaseUid;

        // Two listeners: one for sessions where user is host, one where guest
        const qHost = fsQuery(collection(db, 'workoutSessions'), where('hostUid', '==', uid));
        const qGuest = fsQuery(collection(db, 'workoutSessions'), where('guestUid', '==', uid));

        const reload = () => loadAll(uid);

        hostFirstFireRef.current = true;
        const unsubHost = onSnapshot(qHost, (snapshot) => {
            // Skip the initial snapshot — it contains pre-existing docs, not new events
            if (hostFirstFireRef.current) {
                hostFirstFireRef.current = false;
            } else {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'modified') {
                        const data = change.doc.data();
                        if (data.status === 'accepted' && data.hostUid === uid) {
                            setAcceptancePopup({
                                guestName: data.guestName ?? 'Your friend',
                                videoTitle: data.videoTitle ?? 'the workout',
                            });
                        }
                    }
                });
            }
            reload();
        }, (err) => console.warn('session host listener:', err));

        const unsubGuest = onSnapshot(qGuest, () => reload(), (err) => console.warn('session guest listener:', err));

        return () => {
            unsubHost();
            unsubGuest();
        };
    }, [firebaseUid, loadAll]);

    const createSession = async (guestUid: string, guestName: string, guestAvatarUrl: string | undefined, videoId: string, videoTitle: string, scheduledAt: Date, betCredits: number, extras?: CreateSessionExtras) => {
        if (!firebaseUid) {
            console.error('=== BOOKING FAILED === Not authenticated');
            throw new Error('Please log in again. Not authenticated');
        }
        const uid = firebaseUid;

        console.log('=== BOOKING DEBUG START ===');
        console.log('1. currentUser:', uid);
        console.log('3. friendData:', JSON.stringify({ guestUid, guestName, guestAvatarUrl }));
        console.log('4. selectedTime:', scheduledAt);
        console.log('5. selectedWorkout:', videoTitle, 'ID:', videoId);
        console.log('6. db connected:', !!db);

        const hostNameFinal = profile?.fullName || profile?.username || email?.split('@')[0] || 'User';
        const guestNameFinal = guestName || 'Friend';

        const fields = {
            hostUid: uid,
            hostName: hostNameFinal,
            guestUid: guestUid,
            guestName: guestNameFinal,
            scheduledAt: scheduledAt,
            workoutType: videoTitle,
        };

        console.log('7. All fields:', JSON.stringify(fields));

        // Log which fields are undefined
        Object.entries(fields).forEach(([key, val]) => {
            if (val === undefined || val === null) {
                console.warn(`⚠️ UNDEFINED FIELD: ${key} = ${val}`);
            }
        });

        try {
            console.log('8. Attempting Firestore write...');
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

            console.log('10. ✅ SESSION SAVED AND NOTIFICATION SENT! ID:', sessionId);
            await loadAll(uid);
            console.log('=== BOOKING DEBUG END ===');
            return sessionId;
        } catch (err: any) {
            console.error('=== BOOKING FAILED ===');
            console.error('Error code:', err?.code);
            console.error('Error message:', err?.message);
            console.error('Full error:', JSON.stringify(err));
            setError(err.message);
            throw err;
        }
    };

    const acceptSession = async (sessionId: string) => {
        if (!firebaseUid) return;
        try {
            setError(null);
            await WorkoutSessionService.acceptSession(sessionId, firebaseUid);
            await loadAll(firebaseUid);
        } catch (err) {
            setError((err as Error).message);
            throw err;
        }
    };

    const declineSession = async (sessionId: string) => {
        if (!firebaseUid) return;
        try {
            setError(null);
            await WorkoutSessionService.declineSession(sessionId, firebaseUid);
            await loadAll(firebaseUid);
        } catch (err) {
            setError((err as Error).message);
            throw err;
        }
    };

    const cancelSession = async (sessionId: string) => {
        if (!firebaseUid) return;
        try {
            setError(null);
            await WorkoutSessionService.cancelSession(sessionId);
            await loadAll(firebaseUid);
        } catch (err) {
            setError((err as Error).message);
            throw err;
        }
    };

    const resendSession = async (sessionId: string) => {
        if (!firebaseUid) return;
        try {
            setError(null);
            const hostName = profile?.fullName ?? profile?.username ?? 'User';
            const hostAvatar = profile?.profileImageUrl;
            await WorkoutSessionService.resendSession(sessionId, hostName, hostAvatar);
            await loadAll(firebaseUid);
        } catch (err) {
            setError((err as Error).message);
            throw err;
        }
    };

    const expireSession = async (sessionId: string) => {
        if (!firebaseUid) return;
        try {
            await WorkoutSessionService.expireSession(sessionId);
            await loadAll(firebaseUid);
        } catch (err) {
            // non-critical — don't surface to UI
            console.warn('expireSession failed:', err);
        }
    };

    const refreshSessions = async () => {
        if (firebaseUid) await loadAll(firebaseUid);
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

