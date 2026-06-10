-- Profile photo gallery + hobby ranking.
--
-- 1. profile_photos — user-uploaded gallery images shown on the profile.
--    Public read (profile privacy is enforced at the app layer); owner manages
--    their own rows. Images live in the existing public `avatars` bucket under
--    a `gallery/<uid>/` prefix.
-- 2. profiles.hobby_ranks — map of hobby key -> rank (1..5) used to render the
--    "Top Hobbies" star/dot ranking.

create table if not exists public.profile_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  url         text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists profile_photos_user_idx
  on public.profile_photos (user_id, sort_order);

alter table public.profile_photos enable row level security;

drop policy if exists "profile_photos_public_read" on public.profile_photos;
create policy "profile_photos_public_read"
  on public.profile_photos for select
  using (true);

drop policy if exists "profile_photos_owner_insert" on public.profile_photos;
create policy "profile_photos_owner_insert"
  on public.profile_photos for insert
  with check (auth.uid() = user_id);

drop policy if exists "profile_photos_owner_update" on public.profile_photos;
create policy "profile_photos_owner_update"
  on public.profile_photos for update
  using (auth.uid() = user_id);

drop policy if exists "profile_photos_owner_delete" on public.profile_photos;
create policy "profile_photos_owner_delete"
  on public.profile_photos for delete
  using (auth.uid() = user_id);

alter table public.profiles
  add column if not exists hobby_ranks jsonb not null default '{}'::jsonb;
