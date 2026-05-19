create table if not exists public.auth_identity_map (
  supabase_user_id uuid primary key references auth.users(id) on delete cascade,
  firebase_uid text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auth_identity_map enable row level security;

create policy if not exists "Users can read own identity map"
on public.auth_identity_map
for select
using (auth.uid() = supabase_user_id);

create policy if not exists "Users can upsert own identity map"
on public.auth_identity_map
for insert
with check (auth.uid() = supabase_user_id);

create policy if not exists "Users can update own identity map"
on public.auth_identity_map
for update
using (auth.uid() = supabase_user_id)
with check (auth.uid() = supabase_user_id);

