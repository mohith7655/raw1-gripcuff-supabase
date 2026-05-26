-- ── Public profiles read policy ───────────────────────────────────────────────
-- Allows unauthenticated visitors (anon role) to read profiles by qr_slug
-- or username. This powers the /u/:slug QR-scan profile page rendered by
-- the Netlify function at netlify/functions/profile.ts.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read_anon" ON public.profiles;
CREATE POLICY "profiles_public_read_anon"
    ON public.profiles FOR SELECT
    TO anon
    USING (true);

-- Authenticated users should also still be able to read all profiles
-- (e.g. for friend search, suggestions, scanned-profile screen).
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);
