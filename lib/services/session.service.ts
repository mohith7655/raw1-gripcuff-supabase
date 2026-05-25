import { supabase } from '../core/config/supabase';
import { NotificationService } from './notification.service';

const TAG = '[SessionService]';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface CoWorkoutSession {
    sessionId: string;
    agoraChannel: string;
}

export interface AcceptedSession {
    agoraChannel: string;
    workoutId: string;
    workoutTitle: string;
}

export interface IncomingSessionRow {
    id: string;
    host_user_id: string;
    invited_user_id: string;
    workout_id: string;
    workout_title: string;
    agora_channel: string;
    status: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class SessionService {
    /**
     * Calls the Supabase RPC `create_co_workout_session`, then sends a
     * workout_invite notification so the invitee's WorkoutInviteModal pops up.
     */
    static async createCoWorkoutSession(
        hostUid: string,
        hostName: string,
        invitedUid: string,
        workoutId: string,
        workoutTitle: string,
    ): Promise<CoWorkoutSession> {
        console.log(TAG, 'createCoWorkoutSession', { hostUid, invitedUid, workoutId });

        const { data, error } = await supabase.rpc('create_co_workout_session', {
            host_user_id: hostUid,
            invited_user_id: invitedUid,
            workout_id: workoutId,
            workout_title: workoutTitle,
        });

        if (error) {
            console.error(TAG, 'RPC error:', error.message);
            throw new Error(error.message);
        }

        const sessionId: string = data?.session_id ?? data?.id ?? '';
        const agoraChannel: string = data?.agora_channel ?? '';

        if (!sessionId) {
            throw new Error('RPC returned no session_id');
        }

        console.log(TAG, 'session created', { sessionId, agoraChannel });

        // Send notification so the invitee's WorkoutInviteModal appears immediately.
        NotificationService.insert({
            toUid: invitedUid,
            fromUid: hostUid,
            fromName: hostName,
            type: 'workout_invite',
            title: 'Workout Invite 💪',
            body: `${hostName} wants to work out with you!`,
            sessionId,
        }).catch((e) => console.warn(TAG, 'notification write failed:', e));

        return { sessionId, agoraChannel };
    }

    /**
     * Guest accepts an invite:
     *   1. Updates sessions.status → 'active' and sets started_at.
     *   2. Returns the agoraChannel and workout details so the caller can
     *      navigate to VideoPlayerScreen with the right params.
     */
    static async acceptSession(sessionId: string, uid: string): Promise<AcceptedSession> {
        console.log(TAG, 'acceptSession', { sessionId, uid });

        // Fetch session data first
        const { data: row, error: fetchErr } = await supabase
            .from('sessions')
            .select('agora_channel, workout_id, workout_title')
            .eq('id', sessionId)
            .maybeSingle();

        if (fetchErr) throw new Error(fetchErr.message);

        // Mark active
        const { error: updateErr } = await supabase
            .from('sessions')
            .update({ status: 'active', started_at: new Date().toISOString() })
            .eq('id', sessionId);

        if (updateErr) throw new Error(updateErr.message);

        const agoraChannel = row?.agora_channel ?? '';
        const workoutId    = row?.workout_id    ?? '';
        const workoutTitle = row?.workout_title ?? '';

        console.log(TAG, 'accepted', { sessionId, agoraChannel, workoutId });
        return { agoraChannel, workoutId, workoutTitle };
    }

    /**
     * Guest declines or host cancels an invite.
     */
    static async declineSession(sessionId: string): Promise<void> {
        console.log(TAG, 'declineSession', { sessionId });

        const { error } = await supabase
            .from('sessions')
            .update({ status: 'cancelled' })
            .eq('id', sessionId);

        if (error) throw new Error(error.message);
    }

    /**
     * Host-side: listen for the session row to become 'active' (guest accepted).
     * Returns an unsubscribe function.
     */
    static subscribeToSessionStatus(
        sessionId: string,
        onStatus: (status: string, row: IncomingSessionRow) => void,
    ): () => void {
        console.log(TAG, 'subscribeToSessionStatus', { sessionId });

        const channel = supabase
            .channel(`session-status-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `id=eq.${sessionId}`,
                },
                (payload) => {
                    const row = payload.new as IncomingSessionRow;
                    console.log(TAG, 'session status changed', { sessionId, status: row?.status });
                    if (row) onStatus(row.status, row);
                },
            )
            .subscribe((status, err) => {
                if (err) console.warn(TAG, 'subscribeToSessionStatus error:', err);
                else console.log(TAG, 'session status subscription:', status);
            });

        return () => supabase.removeChannel(channel);
    }

    /**
     * App-boot: listen for new session rows where the current user is invited.
     * Use this as a reliability safety-net alongside NotificationProvider.
     * Returns an unsubscribe function.
     */
    static subscribeToIncomingInvites(
        uid: string,
        onInvite: (session: IncomingSessionRow) => void,
    ): () => void {
        console.log(TAG, 'subscribeToIncomingInvites', { uid });

        const channel = supabase
            .channel(`incoming-invites-${uid}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'sessions',
                    filter: `invited_user_id=eq.${uid}`,
                },
                (payload) => {
                    const row = payload.new as IncomingSessionRow;
                    if (row?.status === 'pending') {
                        console.log(TAG, 'incoming invite', { sessionId: row.id });
                        onInvite(row);
                    }
                },
            )
            .subscribe((status, err) => {
                if (err) console.warn(TAG, 'subscribeToIncomingInvites error:', err);
                else console.log(TAG, 'incoming invites subscription:', status);
            });

        return () => supabase.removeChannel(channel);
    }
}
