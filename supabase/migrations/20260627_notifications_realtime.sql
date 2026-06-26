-- Enable Supabase Realtime for the notifications table.
--
-- The in-app top banner (NotificationProvider → NotificationService
-- .subscribeToNewNotifications) listens for postgres_changes INSERT events on
-- public.notifications. Every other realtime table in this project is added to
-- the supabase_realtime publication (friend_requests, messages,
-- challenge_sessions, …) but notifications was missed — so the subscription
-- never fired and the banner never appeared.
--
-- REPLICA IDENTITY FULL ensures the row payload (incl. to_uid) is present for the
-- realtime row-level filter, matching how public.messages is configured.

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
