ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_level text DEFAULT 'public';
