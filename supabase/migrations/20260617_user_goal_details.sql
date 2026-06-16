-- Goal detail fields for the "My Goal" screen.
--   weight_loss_kg : kg the user wants to lose (weight_loss goal)
--   target_muscles : up to 3 muscle groups to grow (muscle_growth goal)

alter table public.users    add column if not exists weight_loss_kg numeric;
alter table public.users    add column if not exists target_muscles jsonb;

alter table public.profiles add column if not exists weight_loss_kg numeric;
alter table public.profiles add column if not exists target_muscles jsonb;

notify pgrst, 'reload schema';
