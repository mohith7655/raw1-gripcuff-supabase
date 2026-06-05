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

export interface ChallengeFeedbackInput {
    sessionId: string;
    userId: string;
    feeling: number;       // 1–5
    friendliness: number;  // 1–5
    reps: number;          // 1–5
    winnerId: string | null;
}

/** The current user's own answers for a challenge (self-viewable in history). */
export interface ChallengeFeedback {
    feeling: number | null;
    friendliness: number | null;
    reps: number | null;
    winnerId: string | null;
}

export interface PreviousChallenge {
    id: string;
    exerciseName: string;
    durationSeconds: number;
    status: string;
    createdAt: string;
    isHost: boolean;
    opponentUid: string;
    opponentName: string;
    opponentAvatar: string | null;
    feedback: ChallengeFeedback | null;
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

    /**
     * Load previous (attended) challenges for a user — those that reached the
     * active or completed state, with the opponent's display name/avatar
     * resolved. Used by the "Previous Sessions" list.
     */
    async loadPreviousForUser(uid: string): Promise<PreviousChallenge[]> {
        const { data, error } = await supabase
            .from('challenge_sessions')
            .select('*')
            .or(`host_id.eq.${uid},guest_id.eq.${uid}`)
            .in('status', ['active', 'completed'])
            .order('created_at', { ascending: false });
        if (error || !data) return [];

        const sessions = data.map(rowToSession);
        const opponentIds = Array.from(
            new Set(sessions.map(s => (s.hostId === uid ? s.guestId : s.hostId)).filter(Boolean)),
        );

        const nameMap: Record<string, { name: string; avatar: string | null }> = {};
        if (opponentIds.length > 0) {
            const { data: profs } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', opponentIds);
            (profs ?? []).forEach((p: any) => {
                nameMap[p.id] = { name: p.full_name ?? 'Athlete', avatar: p.avatar_url ?? null };
            });
        }

        // Attach the user's OWN questionnaire answers per session (RLS already
        // restricts this to their own rows) so they're viewable in history.
        const feedbackMap: Record<string, ChallengeFeedback> = {};
        const sessionIds = sessions.map(s => s.id);
        if (sessionIds.length > 0) {
            const { data: fb, error: fbErr } = await supabase
                .from('challenge_feedback')
                .select('session_id, feeling, friendliness, reps, winner_id')
                .eq('user_id', uid)
                .in('session_id', sessionIds);
            if (fbErr) {
                console.warn('[Challenge] feedback load failed (is the challenge_feedback migration applied?):', fbErr.message);
            }
            (fb ?? []).forEach((r: any) => {
                feedbackMap[r.session_id] = {
                    feeling: r.feeling ?? null,
                    friendliness: r.friendliness ?? null,
                    reps: r.reps ?? null,
                    winnerId: r.winner_id ?? null,
                };
            });
            console.log('[Challenge] previous loaded', {
                challenges: sessions.length,
                feedbackRows: (fb ?? []).length,
                ratedSessions: Object.keys(feedbackMap),
            });
        }

        return sessions.map((s) => {
            const isHost = s.hostId === uid;
            const opponentUid = isHost ? s.guestId : s.hostId;
            const prof = nameMap[opponentUid];
            return {
                id: s.id,
                exerciseName: s.exerciseName,
                durationSeconds: s.durationSeconds,
                status: s.status,
                createdAt: s.createdAt,
                isHost,
                opponentUid,
                opponentName: prof?.name ?? 'Athlete',
                opponentAvatar: prof?.avatar ?? null,
                feedback: feedbackMap[s.id] ?? null,
            };
        });
    },

    /** Save (or update) the submitter's post-challenge questionnaire answers. */
    async submitFeedback(input: ChallengeFeedbackInput): Promise<void> {
        const { error } = await supabase
            .from('challenge_feedback')
            .upsert(
                {
                    session_id: input.sessionId,
                    user_id: input.userId,
                    feeling: input.feeling,
                    friendliness: input.friendliness,
                    reps: input.reps,
                    winner_id: input.winnerId,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'session_id,user_id' },
            );
        if (error) throw error;
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
