-- ─────────────────────────────────────────────────────────────────────────────
-- session_playback_state
--
-- One row per active session (keyed by session_id).
-- Only the host writes; guests read via Realtime to mirror playback.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_playback_state (
  session_id            uuid        PRIMARY KEY
                        REFERENCES public.scheduled_sessions(id) ON DELETE CASCADE,

  is_playing            boolean     NOT NULL DEFAULT false,
  current_time_seconds  float8      NOT NULL DEFAULT 0,
  video_duration        float8      NOT NULL DEFAULT 0,

  updated_by            uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_playback_state ENABLE ROW LEVEL SECURITY;

-- Host can insert / update / delete their session's playback row
DROP POLICY IF EXISTS "Host writes playback state" ON public.session_playback_state;
CREATE POLICY "Host writes playback state"
  ON public.session_playback_state
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.scheduled_sessions ss
      WHERE ss.id = session_playback_state.session_id
        AND ss.host_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.scheduled_sessions ss
      WHERE ss.id = session_playback_state.session_id
        AND ss.host_user_id = auth.uid()
    )
  );

-- Host AND invited guests can read (SELECT) the playback row
DROP POLICY IF EXISTS "Participants can read playback state" ON public.session_playback_state;
CREATE POLICY "Participants can read playback state"
  ON public.session_playback_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.scheduled_sessions ss
      WHERE ss.id = session_playback_state.session_id
        AND (
          ss.host_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.scheduled_session_invites ssi
            WHERE ssi.session_id = session_playback_state.session_id
              AND ssi.invited_user_id = auth.uid()
          )
        )
    )
  );

-- Enable Realtime on this table so guests receive instant row updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_playback_state;
