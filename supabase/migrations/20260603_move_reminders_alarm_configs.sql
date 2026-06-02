-- Add per-alarm configuration to move_reminders.
-- alarm_configs stores each alarm's time, enabled state, and label.
ALTER TABLE public.move_reminders
    ADD COLUMN IF NOT EXISTS alarm_configs jsonb NOT NULL DEFAULT '[]';
