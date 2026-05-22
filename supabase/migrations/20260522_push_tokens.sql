-- Push tokens for Expo push notifications
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token       TEXT        NOT NULL,
    platform    TEXT        NOT NULL DEFAULT 'unknown',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read tokens (needed to send push notifications client-side)
CREATE POLICY "push_tokens_select" ON public.user_push_tokens
    FOR SELECT TO authenticated USING (true);

-- Users can only write their own token
CREATE POLICY "push_tokens_insert" ON public.user_push_tokens
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_tokens_update" ON public.user_push_tokens
    FOR UPDATE TO authenticated USING (user_id = auth.uid());
