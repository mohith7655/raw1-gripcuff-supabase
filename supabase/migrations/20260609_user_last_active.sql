-- Presence: track when each user was last active in the app.
-- Powers the "Active today / Active now" indicator on profile cards.

alter table public.users
  add column if not exists last_active_at timestamptz;

create index if not exists users_last_active_at_idx
  on public.users (last_active_at desc);

-- The client pings this on app foreground. SECURITY DEFINER + auth.uid()
-- lets a signed-in user stamp their own row without a broad UPDATE policy.
create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
     set last_active_at = now()
   where id = auth.uid();
$$;

grant execute on function public.touch_last_active() to authenticated;
