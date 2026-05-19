import { useCallback, useRef, useState } from 'react';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { trackEvent } from '../services/analytics.service';

export type InviteResult = {
    success: boolean;
    sessionId?: string;
    error?: string;
};

export type SendInviteOptions = {
    type?: string;
    toUid: string;
    toName?: string;
    toAvatarUrl?: string | null;
    videoId?: string;
    videoTitle?: string;
    scheduledAt?: Date;
    betCredits?: number;
    inviteType?: 'instant' | 'scheduled';
    category?: string;
    programName?: string;
    thumbnail?: string;
};

export function useInvite() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sendingRef = useRef(false);

    const { createSession } = useWorkoutSession();

    const sendInvite = useCallback(async (opts: SendInviteOptions): Promise<InviteResult> => {
        if (sendingRef.current) {
            return { success: false, error: 'already_sending' };
        }
        sendingRef.current = true;
        setLoading(true);
        setError(null);

        trackEvent('invite_opened', { type: opts.type ?? 'workout_invite' });

        try {
            const sessionId = await createSession(
                opts.toUid,
                opts.toName ?? opts.toUid,
                opts.toAvatarUrl ?? undefined,
                opts.videoId ?? '',
                opts.videoTitle ?? '',
                opts.scheduledAt ?? new Date(),
                opts.betCredits ?? 0,
                {
                    inviteType: opts.inviteType ?? 'instant',
                    category: opts.category,
                    programName: opts.programName,
                    thumbnail: opts.thumbnail,
                }
            );

            trackEvent('invite_sent', { type: opts.type ?? 'workout_invite', sessionId });
            return { success: true, sessionId };
        } catch (e: any) {
            console.error('[useInvite] createSession failed:', e);
            trackEvent('invite_failed', { type: opts.type ?? 'workout_invite', error: String(e) });

            const msg = e?.message ?? String(e);
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setLoading(false);
            sendingRef.current = false;
        }
    }, [createSession]);

    return { sendInvite, loading, error };
}
