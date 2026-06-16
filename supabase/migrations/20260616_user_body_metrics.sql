-- Body metrics powering the "How I look now" profile section.
-- height_cm / weight_kg complement the existing age + gender columns so the
-- profile can render a body silhouette that morphs to the user's proportions.

alter table public.users    add column if not exists height_cm numeric;
alter table public.users    add column if not exists weight_kg numeric;

alter table public.profiles add column if not exists height_cm numeric;
alter table public.profiles add column if not exists weight_kg numeric;
