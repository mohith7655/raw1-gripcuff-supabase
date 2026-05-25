-- ── User Access Migration ────────────────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor → New Query

-- 1. user_access table — source of truth for Gripcuff and Stripe access
CREATE TABLE IF NOT EXISTS public.user_access (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    access_type             TEXT        NOT NULL CHECK (access_type IN ('gripcuff', 'subscription')),
    order_number            TEXT,
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    stripe_session_id       TEXT,
    is_active               BOOLEAN     NOT NULL DEFAULT true,
    granted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS user_access_user_id_idx ON public.user_access (user_id);
CREATE INDEX IF NOT EXISTS user_access_stripe_sub_idx ON public.user_access (stripe_subscription_id);

-- 2. Add access columns to users table for fast boot-time lookup
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS has_access  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS access_type TEXT;

-- 3. Row Level Security on user_access
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_access_select_own" ON public.user_access;
CREATE POLICY "user_access_select_own" ON public.user_access
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_access_insert_own" ON public.user_access;
CREATE POLICY "user_access_insert_own" ON public.user_access
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_access_update_own" ON public.user_access;
CREATE POLICY "user_access_update_own" ON public.user_access
    FOR UPDATE USING (auth.uid() = user_id);

-- 4. Enable Realtime so the app can subscribe to payment confirmations
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_access;
