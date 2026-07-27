-- Link a Coiny user to their YouTube account (OAuth) for Pulse recommendations.

create table if not exists public.pulse_youtube_accounts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  channel_id text,
  channel_title text,
  access_token text,
  expires_at timestamptz,
  taste jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pulse_youtube_accounts is 'YouTube OAuth link + derived taste for Pulse ranking';
comment on column public.pulse_youtube_accounts.taste is '{ tags, channels, queries, likedVideoIds }';

alter table public.pulse_youtube_accounts enable row level security;

drop policy if exists pulse_yt_select_own on public.pulse_youtube_accounts;
create policy pulse_yt_select_own on public.pulse_youtube_accounts
  for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists pulse_yt_insert_own on public.pulse_youtube_accounts;
create policy pulse_yt_insert_own on public.pulse_youtube_accounts
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists pulse_yt_update_own on public.pulse_youtube_accounts;
create policy pulse_yt_update_own on public.pulse_youtube_accounts
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists pulse_yt_delete_own on public.pulse_youtube_accounts;
create policy pulse_yt_delete_own on public.pulse_youtube_accounts
  for delete to authenticated
  using (profile_id = (select auth.uid()));

grant select, insert, update, delete on public.pulse_youtube_accounts to authenticated;
