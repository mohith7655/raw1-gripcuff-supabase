-- Enable Supabase Realtime for the scheduled-session tables.
--
-- WorkoutSessionContext subscribes (ScheduledSessionService.subscribeForUser) to
-- postgres_changes on:
--   • public.scheduled_sessions        filtered by host_user_id      (host side)
--   • public.scheduled_session_invites filtered by invited_user_id   (guest side)
-- so that scheduling a session / inviting a friend to work out updates the
-- recipient's pending-invite list (and the host's "accepted" popup) live.
--
-- But neither table was ever added to the supabase_realtime publication (only
-- messages, friend_requests, notifications, challenge_sessions, … were). With
-- the tables unpublished the subscriptions never fire, so those invite
-- notifications appear only after a manual app reload — i.e. "not working".
--
-- REPLICA IDENTITY FULL ensures the full row (incl. host_user_id /
-- invited_user_id) is present so the realtime row-level filters match on
-- UPDATE/DELETE too, matching how public.notifications / public.messages are set.

ALTER TABLE public.scheduled_sessions        REPLICA IDENTITY FULL;
ALTER TABLE public.scheduled_session_invites REPLICA IDENTITY FULL;

DO $$
BEGIN
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
