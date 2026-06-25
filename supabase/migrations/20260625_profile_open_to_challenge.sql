-- "Open to Challenge" profile section.
-- The list of exercises a user is open to being challenged on (e.g. squats,
-- pullups). Stored as a text[] of canonical exercise keys; absent/empty = the
-- user hasn't opted into any challenges. Defaults to an empty array.

alter table public.profiles
  add column if not exists open_to_challenge_exercises text[] not null default '{}'::text[];
