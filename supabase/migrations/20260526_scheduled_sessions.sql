-- ─────────────────────────────────────────────────────────────────────────────
-- scheduled_sessions
--
-- One row per planned workout session created by a host.
-- Invited users are stored in scheduled_session_invites.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Workout / video reference — must match a video in the library
  workout_id          text        NOT NULL,
  workout_title       text        NOT NULL,
  workout_video_url   text,
  thumbnail_url       text,
  category            text,
  program_name        text,

  -- When the session is planned
  scheduled_for       timestamptz NOT NULL,

  -- Lifecycle: scheduled → live → completed | cancelled
  status              text        NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),

  -- Agora voice channel for co-workout audio (set when host starts the session)
  co_workout_channel  text,

  -- Updated whenever host starts, guest joins, or status changes
  last_activity_at    timestamptz NOT NULL DEFAULT now(),

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Fast host lookup + status filter
CREATE INDEX IF NOT EXISTS sched_sessions_host_idx
  ON public.scheduled_sessions (host_user_id);
CREATE INDEX IF NOT EXISTS sched_sessions_status_idx
  ON public.scheduled_sessions (status);
CREATE INDEX IF NOT EXISTS sched_sessions_scheduled_for_idx
  ON public.scheduled_sessions (scheduled_for);

ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;

-- Host can do everything with their own sessions
CREATE POLICY "Host manages own sessions"
  ON public.scheduled_sessions
  FOR ALL
  USING (host_user_id = auth.uid())
  WITH CHECK (host_user_id = auth.uid());

-- Invited users can read sessions they have been invited to
CREATE POLICY "Invited users can read sessions"
  ON public.scheduled_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.scheduled_session_invites ssi
      WHERE ssi.session_id = id
        AND ssi.invited_user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- scheduled_session_invites
--
-- One row per (session, invited_user) pair.
-- A single session can have multiple invitees.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_session_invites (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL REFERENCES public.scheduled_sessions(id) ON DELETE CASCADE,
  invited_user_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invited_by       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- pending → accepted | declined
  status           text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined')),

  created_at       timestamptz NOT NULL DEFAULT now(),

  -- One invite row per (session, user)
  UNIQUE (session_id, invited_user_id)
);

-- Fast invited-user lookup
CREATE INDEX IF NOT EXISTS sched_invites_invited_idx
  ON public.scheduled_session_invites (invited_user_id);
CREATE INDEX IF NOT EXISTS sched_invites_session_idx
  ON public.scheduled_session_invites (session_id);

ALTER TABLE public.scheduled_session_invites ENABLE ROW LEVEL SECURITY;

-- Invited user can read and update (accept/decline) their own invite row.
-- invited_by (host) can also read all invites for their sessions.
CREATE POLICY "Invited user manages own invite"
  ON public.scheduled_session_invites
  FOR ALL
  USING (invited_user_id = auth.uid() OR invited_by = auth.uid())
  WITH CHECK (invited_user_id = auth.uid() OR invited_by = auth.uid());

-- Host can INSERT invite rows when creating a session
CREATE POLICY "Host can insert invites"
  ON public.scheduled_session_invites
  FOR INSERT
  WITH CHECK (invited_by = auth.uid());
