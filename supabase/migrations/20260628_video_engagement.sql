-- Per-user "Trying" and "Favorites" membership for videos, used to show
-- "X trying · Y favorites" counts on video cards.
-- (Client: lib/services/videoEngagementCounts.service.ts)

create table if not exists public.video_tries (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  video_id   text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.video_favorites (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  video_id   text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index if not exists video_tries_video_idx     on public.video_tries (video_id);
create index if not exists video_favorites_video_idx on public.video_favorites (video_id);

alter table public.video_tries     enable row level security;
alter table public.video_favorites enable row level security;

-- Reads are open to authenticated users (needed to aggregate global counts);
-- writes are restricted to the caller's own rows.
drop policy if exists "video_tries_select" on public.video_tries;
create policy "video_tries_select" on public.video_tries for select to authenticated using (true);
drop policy if exists "video_tries_insert" on public.video_tries;
create policy "video_tries_insert" on public.video_tries for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "video_tries_delete" on public.video_tries;
create policy "video_tries_delete" on public.video_tries for delete to authenticated using (user_id = auth.uid());

drop policy if exists "video_favorites_select" on public.video_favorites;
create policy "video_favorites_select" on public.video_favorites for select to authenticated using (true);
drop policy if exists "video_favorites_insert" on public.video_favorites;
create policy "video_favorites_insert" on public.video_favorites for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "video_favorites_delete" on public.video_favorites;
create policy "video_favorites_delete" on public.video_favorites for delete to authenticated using (user_id = auth.uid());

-- Batched per-video counts for a list of ids (one round-trip for a whole list).
create or replace function public.video_engagement_counts(p_ids text[])
returns table (video_id text, try_count bigint, favorite_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id as video_id,
    (select count(*) from public.video_tries     t where t.video_id = v.id) as try_count,
    (select count(*) from public.video_favorites f where f.video_id = v.id) as favorite_count
  from unnest(p_ids) as v(id);
$$;

grant execute on function public.video_engagement_counts(text[]) to authenticated;
