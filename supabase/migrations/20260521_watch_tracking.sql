-- Watch time tracking columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS watched_seconds    BIGINT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS today_watch_seconds BIGINT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_watch_sessions INTEGER         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_video_watch_at  TIMESTAMPTZ;

-- Atomic watch-time increment.
-- p_new_session = true  → also increments total_watch_sessions
-- Handles daily rollover: if last watch was on a previous day, resets today_watch_seconds
CREATE OR REPLACE FUNCTION public.increment_watch_time(
  p_user_id       UUID,
  p_seconds       BIGINT,
  p_new_session   BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET
    watched_seconds      = COALESCE(watched_seconds, 0) + p_seconds,
    watched_minutes      = FLOOR((COALESCE(watched_seconds, 0) + p_seconds) / 60),
    today_watch_seconds  = CASE
                             WHEN last_video_watch_at IS NULL
                               OR DATE(last_video_watch_at AT TIME ZONE 'UTC') < CURRENT_DATE
                             THEN p_seconds
                             ELSE COALESCE(today_watch_seconds, 0) + p_seconds
                           END,
    total_watch_sessions = CASE
                             WHEN p_new_session
                             THEN COALESCE(total_watch_sessions, 0) + 1
                             ELSE COALESCE(total_watch_sessions, 0)
                           END,
    last_video_watch_at  = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Allow authenticated users to call the function
GRANT EXECUTE ON FUNCTION public.increment_watch_time(UUID, BIGINT, BOOLEAN)
  TO authenticated;
