import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
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
