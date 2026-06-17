-- Global, YouTube-style view counter per video (exercises + workouts).
-- One row per video_id holding the lifetime total view count, readable by all.

create table if not exists public.video_views (
  video_id    text        primary key,
  video_type  text        not null default 'exercise_library',
  view_count  bigint      not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.video_views enable row level security;

-- Counts are public — every user sees the same total, like YouTube.
drop policy if exists "video_views public read" on public.video_views;
create policy "video_views public read"
  on public.video_views for select
  using (true);

-- Atomic increment used on each watch. Upserts the row and bumps the counter,
-- returning the new total so the client can update its cache without a re-fetch.
create or replace function public.increment_video_view(
  p_video_id   text,
  p_video_type text default 'exercise_library'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total bigint;
begin
  insert into public.video_views (video_id, video_type, view_count, updated_at)
       values (p_video_id, p_video_type, 1, now())
  on conflict (video_id) do update
       set view_count = public.video_views.view_count + 1,
           updated_at = now()
  returning view_count into new_total;

  return new_total;
end;
$$;

grant execute on function public.increment_video_view(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
