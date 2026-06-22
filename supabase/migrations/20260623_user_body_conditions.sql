-- Body conditions powering the "How I look now" tightness / injury markers.
-- Each entry is { part, type: 'tightness' | 'injury', side? } so the body figure
-- can highlight tight or injured areas alongside the existing metrics.

alter table public.users    add column if not exists body_conditions jsonb;
alter table public.profiles add column if not exists body_conditions jsonb;
