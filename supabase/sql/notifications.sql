-- notifications table
-- to_uid stores the Firebase UID of the recipient (firebaseUid), not the Supabase user ID.
-- This matches the Firestore notifications collection convention and the auth_identity_map.
-- RLS policies resolve the Supabase session UID → Firebase UID via auth_identity_map.

create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  to_uid      text        not null,
  from_uid    text        not null default '',
  from_name   text        not null default 'Someone',
  avatar      text,
  type        text        not null,
  title       text        not null,
  body        text        not null,
  read        boolean     not null default false,
  chat_id     text,
  message_id  text,
  request_id  text,
  session_id  text,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Index: fast unread lookup per recipient (the hot query path)
create index if not exists notifications_to_uid_read_idx
  on public.notifications (to_uid, read);

-- Index: mark-read-by-session lookups
create index if not exists notifications_session_id_idx
  on public.notifications (session_id);

-- INSERT: any authenticated user can send a notification to anyone.
-- Required because Alice (logged-in) writes a notification destined for Bob.
create policy if not exists "Authenticated users can insert notifications"
on public.notifications
for insert
to authenticated
with check (true);

-- SELECT: a user can only read notifications addressed to their own Firebase UID.
-- The subquery resolves supabase auth.uid() → firebase_uid via auth_identity_map.
create policy if not exists "Users can read own notifications"
on public.notifications
for select
using (
  to_uid = (
    select firebase_uid
    from public.auth_identity_map
    where supabase_user_id = auth.uid()
  )
);

-- UPDATE: a user can only flip the read flag on their own notifications.
create policy if not exists "Users can update own notifications"
on public.notifications
for update
using (
  to_uid = (
    select firebase_uid
    from public.auth_identity_map
    where supabase_user_id = auth.uid()
  )
)
with check (
  to_uid = (
    select firebase_uid
    from public.auth_identity_map
    where supabase_user_id = auth.uid()
  )
);
