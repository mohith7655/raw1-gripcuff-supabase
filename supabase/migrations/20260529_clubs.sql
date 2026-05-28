-- ── Clubs table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clubs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  category     text NOT NULL DEFAULT 'General',
  description  text,
  avatar_url   text,
  is_private   boolean NOT NULL DEFAULT false,
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count int NOT NULL DEFAULT 1,
  age_min      int,
  age_max      int,
  locations    jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Extended columns (safe to run even if table already existed without them)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS age_min     int;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS age_max     int;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS locations   jsonb;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Club members table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS club_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE clubs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

-- Clubs: anyone can read public clubs
DROP POLICY IF EXISTS "clubs_select" ON clubs;
CREATE POLICY "clubs_select" ON clubs
  FOR SELECT USING (is_private = false OR owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM club_members WHERE club_id = clubs.id AND user_id = auth.uid()));

-- Clubs: authenticated users can create
DROP POLICY IF EXISTS "clubs_insert" ON clubs;
CREATE POLICY "clubs_insert" ON clubs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- Clubs: only owner can update/delete
DROP POLICY IF EXISTS "clubs_update" ON clubs;
CREATE POLICY "clubs_update" ON clubs
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "clubs_delete" ON clubs;
CREATE POLICY "clubs_delete" ON clubs
  FOR DELETE USING (owner_id = auth.uid());

-- Club members: members can read their own club memberships; anyone can see public club members
DROP POLICY IF EXISTS "club_members_select" ON club_members;
CREATE POLICY "club_members_select" ON club_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND is_private = false)
  );

-- Club members: authenticated users can join (insert themselves)
DROP POLICY IF EXISTS "club_members_insert" ON club_members;
CREATE POLICY "club_members_insert" ON club_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Club members: users can leave (delete themselves); owners can remove anyone
DROP POLICY IF EXISTS "club_members_delete" ON club_members;
CREATE POLICY "club_members_delete" ON club_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
  );

-- ── Storage bucket: club-avatars ──────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
  VALUES ('club-avatars', 'club-avatars', true)
  ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "club_avatars_insert" ON storage.objects;
CREATE POLICY "club_avatars_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'club-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Anyone can read (bucket is public)
DROP POLICY IF EXISTS "club_avatars_select" ON storage.objects;
CREATE POLICY "club_avatars_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'club-avatars');

-- Owner can delete their own files
DROP POLICY IF EXISTS "club_avatars_delete" ON storage.objects;
CREATE POLICY "club_avatars_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'club-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
