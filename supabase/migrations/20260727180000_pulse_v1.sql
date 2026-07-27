-- Pulse v1: curated YouTube feed + social engagement (reactions, timed comments, views)

create table if not exists public.pulse_items (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null unique,
  title text not null,
  tags text[] not null default '{}',
  duration_sec integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pulse_reactions (
  item_id uuid not null references public.pulse_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, profile_id)
);

create table if not exists public.pulse_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.pulse_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  t_sec real not null check (t_sec >= 0),
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create table if not exists public.pulse_views (
  item_id uuid not null references public.pulse_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  watch_ms integer not null default 0 check (watch_ms >= 0),
  updated_at timestamptz not null default now(),
  primary key (item_id, profile_id)
);

create index if not exists pulse_comments_item_t_idx on public.pulse_comments (item_id, t_sec);
create index if not exists pulse_reactions_profile_idx on public.pulse_reactions (profile_id);
create index if not exists pulse_views_profile_idx on public.pulse_views (profile_id);
create index if not exists pulse_items_active_idx on public.pulse_items (is_active) where is_active;

alter table public.pulse_items enable row level security;
alter table public.pulse_reactions enable row level security;
alter table public.pulse_comments enable row level security;
alter table public.pulse_views enable row level security;

-- Items: read active only; no client writes (curated seed / service role)
drop policy if exists pulse_items_select on public.pulse_items;
create policy pulse_items_select on public.pulse_items
  for select to authenticated
  using (is_active = true);

-- Reactions
drop policy if exists pulse_reactions_select on public.pulse_reactions;
create policy pulse_reactions_select on public.pulse_reactions
  for select to authenticated
  using (true);

drop policy if exists pulse_reactions_insert on public.pulse_reactions;
create policy pulse_reactions_insert on public.pulse_reactions
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists pulse_reactions_delete on public.pulse_reactions;
create policy pulse_reactions_delete on public.pulse_reactions
  for delete to authenticated
  using (profile_id = (select auth.uid()));

-- Comments
drop policy if exists pulse_comments_select on public.pulse_comments;
create policy pulse_comments_select on public.pulse_comments
  for select to authenticated
  using (true);

drop policy if exists pulse_comments_insert on public.pulse_comments;
create policy pulse_comments_insert on public.pulse_comments
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

-- Views
drop policy if exists pulse_views_select on public.pulse_views;
create policy pulse_views_select on public.pulse_views
  for select to authenticated
  using (true);

drop policy if exists pulse_views_insert on public.pulse_views;
create policy pulse_views_insert on public.pulse_views
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists pulse_views_update on public.pulse_views;
create policy pulse_views_update on public.pulse_views
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select on public.pulse_items to authenticated;
grant select, insert, delete on public.pulse_reactions to authenticated;
grant select, insert on public.pulse_comments to authenticated;
grant select, insert, update on public.pulse_views to authenticated;

-- Curated catalog (embed-only YouTube ids)
insert into public.pulse_items (youtube_id, title, tags, duration_sec) values
  ('jNQXAC9IVRw', 'Me at the zoo', array['classic','funny','short'], 19),
  ('kJQP7kiw5Fk', 'Despacito', array['music','pop'], 282),
  ('9bZkp7q19f0', 'Gangnam Style', array['music','funny','dance'], 252),
  ('fJ9rUzIMcZQ', 'Bohemian Rhapsody', array['music','rock'], 355),
  ('OPf0YbXqDm0', 'Uptown Funk', array['music','pop','dance'], 270),
  ('hTWKbfoikeg', 'Smells Like Teen Spirit', array['music','rock'], 278),
  ('RgKAFK5djSk', 'See You Again', array['music','pop'], 237),
  ('JGwWNGJdvx8', 'Shape of You', array['music','pop'], 264),
  ('CevxZvSJLk8', 'Roar', array['music','pop'], 224),
  ('09R8_2nJtjg', 'Sugar', array['music','pop'], 242)
on conflict (youtube_id) do nothing;
