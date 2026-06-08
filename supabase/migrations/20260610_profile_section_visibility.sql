-- Per-section profile visibility.
-- Map of section key -> true when the owner has marked that section private
-- (hidden from everyone else). Absent / false = public. Defaults to {} (all public).

alter table public.profiles
  add column if not exists section_visibility jsonb not null default '{}'::jsonb;
