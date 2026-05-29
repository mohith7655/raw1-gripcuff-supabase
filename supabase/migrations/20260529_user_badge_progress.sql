-- user_badge_progress: one row per user per badge family.
-- Replaces the old user_badges table (single-tier flat list).

create table if not exists public.user_badge_progress (
  user_id          uuid        not null references auth.users(id) on delete cascade,
  badge_type       text        not null,  -- BadgeFamilyKey
  current_tier     smallint    not null default 0,
  current_progress integer     not null default 0,
  next_threshold   integer,
  earned_at        timestamptz default now(),
  updated_at       timestamptz default now(),
  primary key (user_id, badge_type)
);

-- RLS
alter table public.user_badge_progress enable row level security;

create policy "Users can read own badge progress"
  on public.user_badge_progress for select
  using (auth.uid() = user_id);

create policy "Users can upsert own badge progress"
  on public.user_badge_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own badge progress"
  on public.user_badge_progress for update
  using (auth.uid() = user_id);

-- Public read so leaderboards / friend profiles can show badges
create policy "Public can read badge progress"
  on public.user_badge_progress for select
  using (true);

-- Updated_at trigger
create or replace function public.set_badge_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_badge_updated_at
  before update on public.user_badge_progress
  for each row execute procedure public.set_badge_updated_at();

-- Migration: convert old user_badges rows (if table exists) to new format.
-- Maps old single-tier badge IDs to the nearest new family.
do $migration$
begin
  if exists (select 1 from information_schema.tables where table_name = 'user_badges') then
    insert into public.user_badge_progress (user_id, badge_type, current_tier, current_progress, earned_at)
    select
      ub.user_id,
      case
        when ub.badge_id in ('7_day_streak','14_day_streak','30_day_streak') then 'streak'
        when ub.badge_id = 'first_workout'     then 'consistency'
        when ub.badge_id = '100_workouts'      then 'consistency'
        when ub.badge_id = 'first_live_session' then 'social'
        else 'consistency'
      end as badge_type,
      1 as current_tier,
      0 as current_progress,
      ub.earned_at
    from public.user_badges ub
    on conflict (user_id, badge_type) do nothing;
  end if;
end;
$migration$;
