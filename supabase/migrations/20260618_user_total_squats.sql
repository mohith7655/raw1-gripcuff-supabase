-- Lifetime squats counter shown on the profile pill.
-- Accumulated from the challenge lobby reps and the move-reminder prompt.

alter table public.users    add column if not exists total_squats integer not null default 0;
alter table public.profiles add column if not exists total_squats integer not null default 0;

-- Atomic increment used by the app (avoids read-modify-write races).
create or replace function public.add_squats(p_uid uuid, p_count integer)
returns integer
language plpgsql
security definer
as $$
declare
  new_total integer;
begin
  update public.users
     set total_squats = coalesce(total_squats, 0) + greatest(p_count, 0)
   where id = p_uid
   returning total_squats into new_total;

  update public.profiles
     set total_squats = new_total
   where id = p_uid;

  return new_total;
end;
$$;

grant execute on function public.add_squats(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
