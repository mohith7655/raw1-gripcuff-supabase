-- challenge_sessions: live exercise challenges between two users.
-- host_ready / guest_ready sync via Realtime so both clients start simultaneously.
CREATE TABLE IF NOT EXISTS public.challenge_sessions (
    id                  uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id             uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    guest_id            uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    exercise_name       text         NOT NULL DEFAULT 'Squats',
    duration_seconds    integer      NOT NULL DEFAULT 60,
    channel_name        text         NOT NULL,
    status              text         NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','accepted','active','completed','cancelled')),
    host_ready          boolean      NOT NULL DEFAULT false,
    guest_ready         boolean      NOT NULL DEFAULT false,
    started_at          timestamptz,
    ended_at            timestamptz,
    created_at          timestamptz  DEFAULT now(),
    updated_at          timestamptz  DEFAULT now()
);

ALTER TABLE public.challenge_sessions ENABLE ROW LEVEL SECURITY;

-- Each participant can read and write their own sessions
CREATE POLICY "Participants can manage their challenge sessions"
    ON public.challenge_sessions
    FOR ALL
    USING  (auth.uid() = host_id OR auth.uid() = guest_id)
    WITH CHECK (auth.uid() = host_id OR auth.uid() = guest_id);

-- Enable Realtime so both clients sync ready state instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_sessions;
