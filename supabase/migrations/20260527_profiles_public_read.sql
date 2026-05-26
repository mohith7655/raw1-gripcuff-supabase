-- ── Public profiles + users read policies ─────────────────────────────────────
-- Allows unauthenticated visitors (anon role) to read profiles and users
-- by qr_slug or username. This powers the /u/:slug QR-scan profile page
-- rendered by the Netlify function at netlify/functions/profile.ts.
--
-- Both tables are needed because user identity (full_name, username,
-- avatar_url) lives in `users` while social fields (bio, hobbies, gym,
-- qr_slug) live in `profiles`.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read_anon" ON public.profiles;
CREATE POLICY "profiles_public_read_anon"
    ON public.profiles FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_public_read_anon" ON public.users;
CREATE POLICY "users_public_read_anon"
    ON public.users FOR SELECT
    TO anon
    USING (true);
