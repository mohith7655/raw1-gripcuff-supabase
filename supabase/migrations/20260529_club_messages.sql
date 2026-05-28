-- Club group chat messages
CREATE TABLE IF NOT EXISTS club_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE club_messages ENABLE ROW LEVEL SECURITY;

-- Members can read messages in clubs they belong to
CREATE POLICY "club_messages_select" ON club_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_messages.club_id
        AND club_members.user_id = auth.uid()
    )
  );

-- Members can insert their own messages
CREATE POLICY "club_messages_insert" ON club_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_messages.club_id
        AND club_members.user_id = auth.uid()
    )
  );

-- Only the sender can delete their message
CREATE POLICY "club_messages_delete" ON club_messages
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast fetch by club
CREATE INDEX IF NOT EXISTS club_messages_club_id_idx ON club_messages(club_id, created_at DESC);
