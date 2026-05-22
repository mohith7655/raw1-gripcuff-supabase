-- Messages table for peer-to-peer chat
CREATE TABLE IF NOT EXISTS public.messages (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id     TEXT        NOT NULL,
    sender_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    text        TEXT        NOT NULL,
    read        BOOLEAN     DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for paginating a conversation newest-first
CREATE INDEX IF NOT EXISTS messages_chat_created_idx
    ON public.messages (chat_id, created_at ASC);

-- Required for Supabase Realtime: include all columns in the replication
-- stream so the realtime filter (chat_id=eq.X) works correctly.
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add to the realtime publication so postgres_changes subscriptions fire.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- chat_id is "{sortedUid1}_{sortedUid2}". UUIDs use hyphens so '_' only appears
-- as the separator — split_part correctly extracts each participant.
CREATE POLICY "messages_select" ON public.messages
    FOR SELECT TO authenticated
    USING (
        split_part(chat_id, '_', 1) = auth.uid()::text OR
        split_part(chat_id, '_', 2) = auth.uid()::text
    );

CREATE POLICY "messages_insert" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_update_read" ON public.messages
    FOR UPDATE TO authenticated
    USING (
        split_part(chat_id, '_', 1) = auth.uid()::text OR
        split_part(chat_id, '_', 2) = auth.uid()::text
    )
    WITH CHECK (true);
