-- Allow authenticated clients to discover/cache YouTube videos into pulse_items.
-- Upserts are insert-only on conflict (unique youtube_id); no public updates.

alter table public.pulse_items
  add column if not exists source text not null default 'curated';

comment on column public.pulse_items.source is 'curated | youtube_api';

drop policy if exists pulse_items_insert_authenticated on public.pulse_items;
create policy pulse_items_insert_authenticated on public.pulse_items
  for insert to authenticated
  with check (true);

grant insert on public.pulse_items to authenticated;
