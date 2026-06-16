-- Body-transformation goal powering the "My Goal" profile screen.
--   body_goal   : 'weight_loss' | 'muscle_growth' | 'injury_rehab'
--   injury_area : body part (only meaningful when body_goal = 'injury_rehab')

alter table public.users    add column if not exists body_goal   text;
alter table public.users    add column if not exists injury_area text;

alter table public.profiles add column if not exists body_goal   text;
alter table public.profiles add column if not exists injury_area text;

notify pgrst, 'reload schema';
