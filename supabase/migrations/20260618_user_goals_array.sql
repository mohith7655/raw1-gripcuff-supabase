-- Stepped goal builder — ordered list of typed goals for the "My Goal" screen.

alter table public.users    add column if not exists goals jsonb;
alter table public.profiles add column if not exists goals jsonb;

notify pgrst, 'reload schema';
