-- Notification deduplication migration.
-- Run this AFTER notifications.sql if the table already exists.
--
-- dedup_key is a 60-second-windowed fingerprint computed by NotificationService.insert:
--   {type}:{to_uid}:{anchor}:{minute_bucket}
-- where anchor = session_id ?? request_id ?? message_id ?? chat_id ?? from_uid ?? 'none'.
--
-- The unique index allows multiple NULLs (rows written outside the service),
-- while blocking duplicate inserts within the same 60-second window.

alter table public.notifications
  add column if not exists dedup_key text;

-- Unique index (non-partial) so PostgREST can target it in ON CONFLICT.
-- PostgreSQL unique indexes treat NULLs as distinct, so multiple NULL
-- dedup_key values are always allowed.
create unique index if not exists notifications_dedup_key_idx
  on public.notifications (dedup_key);
