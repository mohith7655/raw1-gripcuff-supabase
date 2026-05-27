-- ── Add user detail columns to profiles table ────────────────────────────────
-- These columns mirror key fields from the `users` table so that the
-- ScannedProfileScreen can show full data via the public `profiles` table
-- (which has anon read access), without requiring RLS-protected access
-- to the `users` table.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).

-- 1) Add columns (IF NOT EXISTS prevents errors if already present)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age              integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender           text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_access       boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_type      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_streak   integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS best_streak      integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS completed_workouts integer DEFAULT 0;

-- 2) Backfill existing rows from the users table
UPDATE public.profiles p
SET
  email              = u.email,
  age                = u.age,
  gender             = u.gender,
  date_of_birth      = u.date_of_birth,
  phone              = u.phone,
  has_access         = COALESCE(u.has_access, false),
  access_type        = u.access_type,
  current_streak     = COALESCE(u.current_streak, 0),
  best_streak        = COALESCE(u.best_streak, 0),
  completed_workouts = COALESCE(u.completed_workouts, 0)
FROM public.users u
WHERE p.id = u.id;

-- 3) Create a trigger function that syncs users → profiles on every UPDATE/INSERT
CREATE OR REPLACE FUNCTION public.sync_user_to_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, username, avatar_url, email,
    age, gender, date_of_birth, phone,
    has_access, access_type,
    current_streak, best_streak, completed_workouts
  ) VALUES (
    NEW.id, NEW.full_name, NEW.username, NEW.avatar_url, NEW.email,
    NEW.age, NEW.gender, NEW.date_of_birth, NEW.phone,
    COALESCE(NEW.has_access, false), NEW.access_type,
    COALESCE(NEW.current_streak, 0), COALESCE(NEW.best_streak, 0),
    COALESCE(NEW.completed_workouts, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name          = EXCLUDED.full_name,
    username           = EXCLUDED.username,
    avatar_url         = EXCLUDED.avatar_url,
    email              = EXCLUDED.email,
    age                = EXCLUDED.age,
    gender             = EXCLUDED.gender,
    date_of_birth      = EXCLUDED.date_of_birth,
    phone              = EXCLUDED.phone,
    has_access         = EXCLUDED.has_access,
    access_type        = EXCLUDED.access_type,
    current_streak     = EXCLUDED.current_streak,
    best_streak        = EXCLUDED.best_streak,
    completed_workouts = EXCLUDED.completed_workouts;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Attach the trigger
DROP TRIGGER IF EXISTS trg_sync_user_to_profile ON public.users;
CREATE TRIGGER trg_sync_user_to_profile
  AFTER INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_to_profile();
