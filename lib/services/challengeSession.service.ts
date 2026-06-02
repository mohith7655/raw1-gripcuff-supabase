import { supabase } from '../core/config/supabase';

export interface ChallengeSession {
    id: string;
    hostId: string;
    guestId: string;
    exerciseName: string;
    durationSeconds: number;
    channelName: string;
    status: 'pending' | 'accepted' | 'active' | 'completed' | 'cancelled';
    hostReady: boolean;
    guestReady: boolean;
    startedAt?: string | null;
    endedAt?: string | null;
    createdAt: string;
}

function rowToSession(row: any): ChallengeSession {
    return {
        id: row.id,
        hostId: row.host_id,
        guestId: row.guest_id,
        exerciseName: row.exercise_name,
        durationSeconds: row.duration_seconds,
        channelName: row.channel_name,
        status: row.status,
        hostReady: row.host_ready,
        guestReady: row.guest_ready,
        startedAt: row.started_at ?? null,
        endedAt: row.ended_at ?? null,
        createdAt: row.created_at,
    };
}

export const ChallengeSessionService = {
    async create(params: {
        hostId: string;
        guestId: string;
        exerciseName: string;
        durationSeconds: number;
    }): Promise<ChallengeSession> {
        const channelName = `challenge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { data, error } = await supabase
            .from('challenge_sessions')
            .insert({
                host_id: params.hostId,
                guest_id: params.guestId,
                exercise_name: params.exerciseName,
                duration_seconds: params.durationSeconds,
                channel_name: channelName,
            })
            .select()
            .single();
        if (error) throw error;
        return rowToSession(data);
    },

    async get(id: string): Promise<ChallengeSession | null> {
        const { data, error } = await supabase
            .from('challenge_sessions')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error || !data) return null;
        return rowToSession(data);
    },

    async setReady(sessionId: string, role: 'host' | 'guest'): Promise<void> {
        const field = role === 'host' ? 'host_ready' : 'guest_ready';
        await supabase
            .from('challenge_sessions')
            .update({ [field]: true, updated_at: new Date().toISOString() })
            .eq('id', sessionId);
    },

    async markActive(sessionId: string): Promise<void> {
        await supabase
            .from('challenge_sessions')
            .update({
                status: 'active',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId);
    },

    async markCompleted(sessionId: string): Promise<void> {
        await supabase
            .from('challenge_sessions')
            .update({
                status: 'completed',
                ended_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId);
    },

    async cancel(sessionId: string): Promise<void> {
        await supabase
            .from('challenge_sessions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', sessionId);
    },

    /** Subscribe to live changes for a session — returns unsubscribe fn */
    subscribe(sessionId: string, onChange: (session: ChallengeSession) => void): () => void {
        const channel = supabase
            .channel(`challenge:${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'challenge_sessions',
                    filter: `id=eq.${sessionId}`,
                },
                (payload) => {
                    if (payload.new) onChange(rowToSession(payload.new));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    },

    /** Load pending challenge invites where user is the guest */
    async loadPendingForGuest(uid: string): Promise<ChallengeSession[]> {
        const { data, error } = await supabase
            .from('challenge_sessions')
            .select('*')
            .eq('guest_id', uid)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error || !data) return [];
        return data.map(rowToSession);
    },
};
