-- Web Push (browser/PWA) subscriptions for the Netlify-hosted web app.
-- Each row is one browser endpoint. A user may have several (phone + laptop, etc).
-- Sending happens server-side (Netlify function with the service-role key), so no
-- broad SELECT policy is required — owners only manage their own rows.

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint    TEXT        NOT NULL,
    p256dh      TEXT        NOT NULL,
    auth        TEXT        NOT NULL,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_id_idx
    ON public.web_push_subscriptions (user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner can read/write only their own subscriptions. The send function uses the
-- service-role key and bypasses RLS entirely.
CREATE POLICY "web_push_select_own" ON public.web_push_subscriptions
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "web_push_insert_own" ON public.web_push_subscriptions
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "web_push_update_own" ON public.web_push_subscriptions
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "web_push_delete_own" ON public.web_push_subscriptions
    FOR DELETE TO authenticated USING (user_id = auth.uid());
