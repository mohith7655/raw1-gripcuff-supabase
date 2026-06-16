-- Multi-select injured body parts for the "My Goal" recovery question.

alter table public.users    add column if not exists injury_areas jsonb;
alter table public.profiles add column if not exists injury_areas jsonb;

notify pgrst, 'reload schema';
