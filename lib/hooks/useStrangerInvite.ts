import { useState, useRef, useCallback, useEffect } from 'react';
import { StrangerInviteService, StrangerInvite, StrangerInviteStatus } from '../services/StrangerInviteService';

const TIMEOUT_SEC = 10;

export type SenderState =
    | { phase: 'idle' }
    | { phase: 'sending' }
    | { phase: 'waiting'; inviteId: string; channelName: string; secondsLeft: number }
    | { phase: 'accepted'; inviteId: string; sessionId: string; videoId: string; videoTitle: string }
    | { phase: 'declined' }
    | { phase: 'expired' }
    | { phase: 'error'; message: string };

export function useSocialInvite(currentUid: string | null) {
    const [state, setState] = useState<SenderState>({ phase: 'idle' });
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cleanup = useCallback(() => {
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        if (expireTimerRef.current) { clearTimeout(expireTimerRef.current); expireTimerRef.current = null; }
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    const sendInvite = useCallback(async (params: {
        targetUserId: string;
        workoutId: string;
        workoutTitle: string;
        workoutThumbnail?: string | null;
    }) => {
        if (!currentUid) return;
        setState({ phase: 'sending' });

        let inviteId: string;
        try {
            inviteId = await StrangerInviteService.createInvite({
                inviterId: currentUid,
                ...params,
            });
        } catch (err: any) {
            setState({ phase: 'error', message: err.message ?? 'Failed to send invite' });
            return;
        }

        const channelName = inviteId;
        let secondsLeft = TIMEOUT_SEC;

        setState({ phase: 'waiting', inviteId, channelName, secondsLeft });

        countdownRef.current = setInterval(() => {
            secondsLeft -= 1;
            setState((prev) =>
                prev.phase === 'waiting'
                    ? { ...prev, secondsLeft: Math.max(0, secondsLeft) }
                    : prev,
            );
        }, 1000);

        expireTimerRef.current = setTimeout(async () => {
            cleanup();
            await StrangerInviteService.expireInvite(inviteId).catch(() => {});
            setState({ phase: 'expired' });
        }, TIMEOUT_SEC * 1000);
    }, [currentUid, cleanup]);

    const cancel = useCallback(async () => {
        const s = state;
        cleanup();
        if (s.phase === 'waiting') {
            await StrangerInviteService.cancelInvite(s.inviteId, currentUid!).catch(() => {});
        }
        setState({ phase: 'idle' });
    }, [state, currentUid, cleanup]);

    const reset = useCallback(() => {
        cleanup();
        setState({ phase: 'idle' });
    }, [cleanup]);

    return { state, sendInvite, cancel, reset };
}
