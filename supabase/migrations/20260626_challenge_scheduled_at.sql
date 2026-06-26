-- Scheduled challenges: a challenge a user sets up for a future time from
-- another person's profile (the "Open to Challenge" chips). When scheduled_at
-- is NULL the row is an instant lobby/direct challenge (unchanged behaviour);
-- when set, both participants join from the Sessions tab at the chosen time.
--
-- The global incoming-challenge alert (App.tsx) only pops for instant invites
-- (status = 'pending' AND scheduled_at IS NULL), so scheduled rows never
-- interrupt the guest — they surface in the Sessions tab to accept later.
ALTER TABLE public.challenge_sessions
    ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
