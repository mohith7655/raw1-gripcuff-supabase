-- ─────────────────────────────────────────────────────────────────────────────
-- scheduled_sessions.resend_count
--
-- Tracks how many times the host has resent invites for this session.
-- Capped at 3 (UI shows "N/3 used" + disables button at cap).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.scheduled_sessions
  ADD COLUMN IF NOT EXISTS resend_count int NOT NULL DEFAULT 0;


-- ─────────────────────────────────────────────────────────────────────────────
-- try_increment_resend(p_session_id uuid)
--
-- Atomic increment used by the "Resend Invite" button.
-- Returns the new resend_count on success, or NULL when:
--   • the session does not exist
--   • caller is not the host
--   • resend_count is already at the cap (3)
--
-- One round-trip, race-safe, RLS-aware (uses auth.uid()).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.try_increment_resend(p_session_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  new_count int;
BEGIN
  UPDATE public.scheduled_sessions
     SET resend_count    = resend_count + 1,
         last_activity_at = now()
   WHERE id             = p_session_id
     AND host_user_id   = auth.uid()
     AND resend_count   < 3
  RETURNING resend_count INTO new_count;

  RETURN new_count;
END;
$$;
