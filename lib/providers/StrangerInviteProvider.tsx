import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { db } from '../core/config/firebase';
import { useAuth } from './AuthContext';
import { StrangerInvite, StrangerInviteService } from '../services/StrangerInviteService';
import { IncomingStrangerInvitePopup } from '../components/IncomingStrangerInvitePopup';

interface StrangerInviteCtx {
    hasIncomingInvite: boolean;
}

const Ctx = createContext<StrangerInviteCtx>({ hasIncomingInvite: false });

export function StrangerInviteProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [activeInvite, setActiveInvite] = useState<StrangerInvite | null>(null);
    const handledRef = useRef<Set<string>>(new Set());
    const autoDeclineRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (autoDeclineRef.current) {
            clearTimeout(autoDeclineRef.current);
            autoDeclineRef.current = null;
        }
    };

    const dismiss = useCallback(() => {
        clearTimer();
        setActiveInvite(null);
    }, []);

    const handleDecline = useCallback(async (invite: StrangerInvite) => {
        dismiss();
        try {
            await StrangerInviteService.declineInvite(invite.inviteId, user!.uid);
        } catch {}
    }, [dismiss, user]);

    const handleAccept = useCallback(async (invite: StrangerInvite) => {
        dismiss();
        try {
            await StrangerInviteService.acceptInvite(invite.inviteId, user!.uid);
            navigation.navigate('SyncedVideoPlayer', {
                sessionId: invite.inviteId,
                videoId: invite.workoutId,
                videoTitle: invite.workoutTitle,
                friendName: invite.inviterUsername,
            });
        } catch (err: any) {
            console.warn('Failed to accept stranger invite:', err.message);
        }
    }, [dismiss, navigation, user]);

    useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(db, 'strangerInvites'),
            where('targetUserId', '==', user.uid),
            where('status', '==', 'pending'),
        );

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type !== 'added') return;
                const invite = { inviteId: change.doc.id, ...change.doc.data() } as StrangerInvite;

                // De-duplicate: ignore if already handled or already showing
                if (handledRef.current.has(invite.inviteId)) return;
                handledRef.current.add(invite.inviteId);

                // Only show if not already showing another
                setActiveInvite((prev) => prev ?? invite);
            });

            // If the current active invite was removed/changed, auto-dismiss
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified' || change.type === 'removed') {
                    const id = change.doc.id;
                    const status = change.doc.data()?.status;
                    setActiveInvite((prev) => {
                        if (prev?.inviteId === id && status !== 'pending') {
                            clearTimer();
                            return null;
                        }
                        return prev;
                    });
                }
            });
        }, (err) => console.warn('strangerInvites listener:', err));

        return unsub;
    }, [user?.uid]);

    // Auto-expire on client side (10s + 1s buffer)
    useEffect(() => {
        if (!activeInvite) return;
        clearTimer();
        autoDeclineRef.current = setTimeout(() => {
            setActiveInvite(null);
        }, 11_000);
        return clearTimer;
    }, [activeInvite?.inviteId]);

    return (
        <Ctx.Provider value={{ hasIncomingInvite: !!activeInvite }}>
            {children}
            {activeInvite && (
                <IncomingStrangerInvitePopup
                    invite={activeInvite}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                />
            )}
        </Ctx.Provider>
    );
}

export function useStrangerInviteContext() {
    return useContext(Ctx);
}
