-- ─────────────────────────────────────────────────────────────────────────────
-- Instant co-workout + challenge "pull both users together" realtime fix.
--
-- The instant invite → accept → auto-join flow (WorkoutSessionContext for
-- co-workouts, App.tsx + ChallengeVideoRoom for challenges) works ONLY if
-- Supabase Realtime delivers row changes for the tables below, and if the
-- row-level filters (invited_user_id / host_user_id / guest_id) match on
-- UPDATE events too — which requires REPLICA IDENTITY FULL.
--
--   • challenge_sessions        — added to the publication in 20260603 but its
--                                 REPLICA IDENTITY was never set to FULL, so the
--                                 accept / host_ready / guest_ready UPDATEs did
--                                 not match the guest_id/host_id filters. THIS is
--                                 the gap that broke "start together" on challenges.
--   • scheduled_sessions        — host side (accept detection)
--   • scheduled_session_invites — guest side (incoming instant invite modal)
--
-- Idempotent: safe to re-run. Re-asserts publication membership AND replica
-- identity for every table the instant flows depend on.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) REPLICA IDENTITY FULL so UPDATE payloads carry the filter columns.
ALTER TABLE public.challenge_sessions        REPLICA IDENTITY FULL;
ALTER TABLE public.scheduled_sessions        REPLICA IDENTITY FULL;
ALTER TABLE public.scheduled_session_invites REPLICA IDENTITY FULL;

-- 2) Ensure each table is in the supabase_realtime publication (no-op if already).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'challenge_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scheduled_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scheduled_session_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_session_invites;
  END IF;
END $$;
