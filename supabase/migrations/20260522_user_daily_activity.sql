-- user_daily_activity: one row per (user, day) — source of truth for streaks.
-- watched_minutes is incremented atomically via upsert_daily_watch_minutes().
-- Streak is derived by reading consecutive days with watched_minutes > 0.
CREATE TABLE IF NOT EXISTS public.user_daily_activity (
    id                 uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id            uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_date      date         NOT NULL,
    watched_minutes    numeric      DEFAULT 0,
    completed_workouts integer      DEFAULT 0,
    created_at         timestamptz  DEFAULT now(),
    updated_at         timestamptz  DEFAULT now(),
    UNIQUE (user_id, activity_date)
);

ALTER TABLE public.user_daily_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily activity"
    ON public.user_daily_activity
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Atomic upsert + increment.
-- Creates the row for p_date if missing; otherwise adds p_minutes to watched_minutes.
CREATE OR REPLACE FUNCTION public.upsert_daily_watch_minutes(
    p_user_id  uuid,
    p_date     date,
    p_minutes  numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_daily_activity (user_id, activity_date, watched_minutes)
    VALUES (p_user_id, p_date, p_minutes)
    ON CONFLICT (user_id, activity_date)
    DO UPDATE SET
        watched_minutes = user_daily_activity.watched_minutes + EXCLUDED.watched_minutes,
        updated_at      = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_daily_watch_minutes(uuid, date, numeric)
    TO authenticated;
