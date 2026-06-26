-- Align notifications RLS with the Supabase-native identity model.
--
-- The original policies (see supabase/sql/notifications.sql) were written for the
-- legacy Firebase model: they required to_uid to equal the caller's firebase_uid,
-- resolved via public.auth_identity_map. But the app now writes and reads
-- to_uid = the Supabase auth uid (NotificationService.insert / NotificationProvider
-- use supabaseUserId). Because to_uid (supabase uid) never matched firebase_uid,
-- recipients could not SELECT their own notifications — and since Supabase Realtime
-- only delivers rows the subscriber can SELECT under RLS, the in-app top banner
-- never fired (and the unread bootstrap fetch came back empty).
--
-- This switches SELECT/UPDATE to compare against auth.uid() directly.

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications
for select
to authenticated
using (to_uid = auth.uid()::text);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications
for update
to authenticated
using (to_uid = auth.uid()::text)
with check (to_uid = auth.uid()::text);
