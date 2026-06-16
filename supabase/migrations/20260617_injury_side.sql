-- Which side of the body is injured (for bilateral parts: left / right / both).

alter table public.users    add column if not exists injury_side text;
alter table public.profiles add column if not exists injury_side text;

notify pgrst, 'reload schema';
