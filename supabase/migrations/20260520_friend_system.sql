-- ── Friend System Migration ────────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Ensure users table has email column and index
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_username_idx ON public.users (username);

-- 2. Friend requests table
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS friend_requests_receiver_idx ON public.friend_requests (receiver_id, status);
CREATE INDEX IF NOT EXISTS friend_requests_sender_idx   ON public.friend_requests (sender_id, status);

-- 3. Friendships table (canonical pair: user_a < user_b alphabetically)
CREATE TABLE IF NOT EXISTS public.friendships (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_b     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS friendships_user_a_idx ON public.friendships (user_a);
CREATE INDEX IF NOT EXISTS friendships_user_b_idx ON public.friendships (user_b);

-- 4. Auto-update updated_at on friend_requests
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER friend_requests_updated_at
    BEFORE UPDATE ON public.friend_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RLS — users table: authenticated users can read all profiles (required for email search)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
CREATE POLICY "users_select_authenticated"
    ON public.users FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
    ON public.users FOR UPDATE
    TO authenticated
    USING (id = auth.uid());

-- 6. RLS — friend_requests
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friend_requests_select" ON public.friend_requests;
CREATE POLICY "friend_requests_select"
    ON public.friend_requests FOR SELECT
    TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "friend_requests_insert" ON public.friend_requests;
CREATE POLICY "friend_requests_insert"
    ON public.friend_requests FOR INSERT
    TO authenticated
    WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "friend_requests_update" ON public.friend_requests;
CREATE POLICY "friend_requests_update"
    ON public.friend_requests FOR UPDATE
    TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "friend_requests_delete" ON public.friend_requests;
CREATE POLICY "friend_requests_delete"
    ON public.friend_requests FOR DELETE
    TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- 7. RLS — friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select" ON public.friendships;
CREATE POLICY "friendships_select"
    ON public.friendships FOR SELECT
    TO authenticated
    USING (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "friendships_insert" ON public.friendships;
CREATE POLICY "friendships_insert"
    ON public.friendships FOR INSERT
    TO authenticated
    WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "friendships_delete" ON public.friendships;
CREATE POLICY "friendships_delete"
    ON public.friendships FOR DELETE
    TO authenticated
    USING (user_a = auth.uid() OR user_b = auth.uid());

-- 8. Enable realtime for friend_requests (required for supabase.channel postgres_changes)
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
