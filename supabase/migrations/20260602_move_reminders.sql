-- move_reminders: one row per user — stores their "Reminder to Move" config.
-- Uses UNIQUE(user_id) so upsert on conflict is safe.
CREATE TABLE IF NOT EXISTS public.move_reminders (
    id                   uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id              uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    enabled              boolean      NOT NULL DEFAULT false,
    title                text         NOT NULL DEFAULT 'Reminder to Move',
    start_time           text         NOT NULL DEFAULT '08:00',
    end_time             text         NOT NULL DEFAULT '20:00',
    interval_minutes     integer      NOT NULL DEFAULT 60,
    workout_duration_min integer      NOT NULL DEFAULT 1,
    generated_times      text[]       NOT NULL DEFAULT '{}',
    recurring            boolean      NOT NULL DEFAULT true,
    created_at           timestamptz  DEFAULT now(),
    updated_at           timestamptz  DEFAULT now(),
    UNIQUE (user_id)
);

ALTER TABLE public.move_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own move reminders"
    ON public.move_reminders
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
