-- Server-authoritative profile collectibles and booster economy.
-- Public RPCs remain security invoker; privileged mutations live in private.

create schema if not exists private;

create table if not exists public.reward_rarities (
  id text primary key,
  label text not null,
  color text not null,
  drop_weight smallint not null,
  sort_order smallint not null unique,
  constraint reward_rarities_id_check
    check (id in ('legendary', 'mythic', 'epic', 'rare', 'standard')),
  constraint reward_rarities_color_check
    check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint reward_rarities_weight_check
    check (drop_weight > 0 and drop_weight <= 100)
);

create table if not exists public.reward_catalog (
  id text primary key,
  category text not null,
  rarity_id text not null references public.reward_rarities(id) on update cascade,
  display_name text not null,
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  constraint reward_catalog_category_check
    check (category in ('avatar_decoration', 'profile_effect', 'badge'))
);

create index if not exists reward_catalog_rarity_id_idx
  on public.reward_catalog (rarity_id)
  where active;

create table if not exists public.user_reward_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins integer not null default 10,
  progress_seconds integer not null default 0,
  last_heartbeat_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  constraint user_reward_accounts_coins_check check (coins >= 0),
  constraint user_reward_accounts_progress_check
    check (progress_seconds >= 0 and progress_seconds < 3600)
);

create table if not exists public.user_collectibles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.reward_catalog(id) on update cascade on delete restrict,
  acquired_at timestamptz not null default clock_timestamp(),
  primary key (user_id, item_id)
);

create index if not exists user_collectibles_item_id_idx
  on public.user_collectibles (item_id);

create table if not exists public.profile_cosmetics (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  avatar_decoration_id text references public.reward_catalog(id) on update cascade on delete set null,
  profile_effect_id text references public.reward_catalog(id) on update cascade on delete set null,
  badge_id text references public.reward_catalog(id) on update cascade on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists profile_cosmetics_avatar_decoration_id_idx
  on public.profile_cosmetics (avatar_decoration_id)
  where avatar_decoration_id is not null;
create index if not exists profile_cosmetics_profile_effect_id_idx
  on public.profile_cosmetics (profile_effect_id)
  where profile_effect_id is not null;
create index if not exists profile_cosmetics_badge_id_idx
  on public.profile_cosmetics (badge_id)
  where badge_id is not null;

create or replace function private.validate_profile_cosmetics_categories()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.avatar_decoration_id is not null and not exists (
    select 1 from public.reward_catalog
    where id = new.avatar_decoration_id and category = 'avatar_decoration'
  ) then
    raise exception 'avatar_decoration_id has another category' using errcode = '23514';
  end if;
  if new.profile_effect_id is not null and not exists (
    select 1 from public.reward_catalog
    where id = new.profile_effect_id and category = 'profile_effect'
  ) then
    raise exception 'profile_effect_id has another category' using errcode = '23514';
  end if;
  if new.badge_id is not null and not exists (
    select 1 from public.reward_catalog
    where id = new.badge_id and category = 'badge'
  ) then
    raise exception 'badge_id has another category' using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke execute on function private.validate_profile_cosmetics_categories() from public, anon, authenticated;

drop trigger if exists validate_profile_cosmetics_categories on public.profile_cosmetics;
create trigger validate_profile_cosmetics_categories
  before insert or update of avatar_decoration_id, profile_effect_id, badge_id
  on public.profile_cosmetics
  for each row execute function private.validate_profile_cosmetics_categories();

insert into public.reward_rarities (id, label, color, drop_weight, sort_order)
values
  ('legendary', 'Легендарное', '#ffd700', 5, 1),
  ('mythic', 'Мифическое', '#eb4b4b', 12, 2),
  ('epic', 'Эпическое', '#d32ce6', 18, 3),
  ('rare', 'Редкое', '#8847ff', 28, 4),
  ('standard', 'Базовое', '#4b69ff', 37, 5)
on conflict (id) do update set
  label = excluded.label,
  color = excluded.color,
  drop_weight = excluded.drop_weight,
  sort_order = excluded.sort_order;

insert into public.reward_catalog (id, category, rarity_id, display_name, description)
values
  ('frame_royal_gold', 'avatar_decoration', 'legendary', 'Лавр', 'Тонкий лавровый ободок вокруг аватара'),
  ('badge_crown', 'badge', 'legendary', 'Император', 'Знак высокого статуса'),
  ('glow_solar', 'profile_effect', 'legendary', 'Полдень', 'Тёплый дневной свет на карточке'),
  ('frame_inferno_flame', 'avatar_decoration', 'mythic', 'Уголёк', 'Тёплый след активности'),
  ('badge_fire', 'badge', 'mythic', 'Пламя', 'Знак яркой активности'),
  ('frame_cyber_wave', 'avatar_decoration', 'epic', 'Сигнал', 'Кольцо набора сообщения'),
  ('badge_diamond', 'badge', 'epic', 'Алмаз', 'Грань коллекционного знака'),
  ('glow_amethyst', 'profile_effect', 'epic', 'Чернила', 'Глубокая чернильная заливка'),
  ('frame_amethyst_crystal', 'avatar_decoration', 'rare', 'Сургуч', 'Оттиск печати у аватара'),
  ('badge_lightning', 'badge', 'rare', 'Искра', 'Короткий импульс'),
  ('glow_sapphire', 'profile_effect', 'rare', 'Иней', 'Холодная бумажная полоса'),
  ('frame_neon_cyan', 'avatar_decoration', 'standard', 'Волна', 'Линия входящего сообщения'),
  ('frame_emerald_shield', 'avatar_decoration', 'standard', 'Тучка', 'Маленькая тучка над аватаром'),
  ('badge_rocket', 'badge', 'standard', 'Ракета', 'Знак нового чата'),
  ('badge_coin', 'badge', 'standard', 'Пионер', 'Первый знак Coiny')
on conflict (id) do update set
  category = excluded.category,
  rarity_id = excluded.rarity_id,
  display_name = excluded.display_name,
  description = excluded.description,
  active = true;

alter table public.reward_rarities enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.user_reward_accounts enable row level security;
alter table public.user_collectibles enable row level security;
alter table public.profile_cosmetics enable row level security;

drop policy if exists reward_rarities_authenticated_read on public.reward_rarities;
create policy reward_rarities_authenticated_read
  on public.reward_rarities for select to authenticated using (true);

drop policy if exists reward_catalog_authenticated_read on public.reward_catalog;
create policy reward_catalog_authenticated_read
  on public.reward_catalog for select to authenticated using (true);

drop policy if exists user_reward_accounts_owner_read on public.user_reward_accounts;
create policy user_reward_accounts_owner_read
  on public.user_reward_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_collectibles_owner_read on public.user_collectibles;
create policy user_collectibles_owner_read
  on public.user_collectibles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists profile_cosmetics_authenticated_read on public.profile_cosmetics;
create policy profile_cosmetics_authenticated_read
  on public.profile_cosmetics for select to authenticated using (true);

revoke all on public.reward_rarities from public, anon, authenticated;
revoke all on public.reward_catalog from public, anon, authenticated;
revoke all on public.user_reward_accounts from public, anon, authenticated;
revoke all on public.user_collectibles from public, anon, authenticated;
revoke all on public.profile_cosmetics from public, anon, authenticated;

grant select on public.reward_rarities, public.reward_catalog to authenticated;
grant select on public.user_reward_accounts, public.user_collectibles to authenticated;
grant select on public.profile_cosmetics to authenticated;
grant all on public.reward_rarities, public.reward_catalog to service_role;
grant all on public.user_reward_accounts, public.user_collectibles, public.profile_cosmetics to service_role;

create or replace function private.ensure_profile_rewards(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null or not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'Authenticated profile is required' using errcode = '42501';
  end if;

  insert into public.user_reward_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.user_collectibles (user_id, item_id)
  values (p_user_id, 'badge_coin')
  on conflict (user_id, item_id) do nothing;

  insert into public.profile_cosmetics (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$function$;

create or replace function private.initialize_profile_rewards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.ensure_profile_rewards(new.id);
  return new;
end;
$function$;

revoke execute on function private.ensure_profile_rewards(uuid) from public, anon, authenticated;
revoke execute on function private.initialize_profile_rewards() from public, anon, authenticated;

drop trigger if exists initialize_profile_rewards on public.profiles;
create trigger initialize_profile_rewards
  after insert on public.profiles
  for each row execute function private.initialize_profile_rewards();

select private.ensure_profile_rewards(id) from public.profiles;

create or replace function private.pick_reward_rarity(p_roll numeric)
returns text
language sql
stable
set search_path = ''
as $function$
  with weighted as (
    select
      id,
      drop_weight,
      sum(drop_weight) over (order by sort_order) as upper_bound
    from public.reward_rarities
  )
  select id
  from weighted
  where greatest(0::numeric, least(p_roll, 99.999999::numeric)) >= upper_bound - drop_weight
    and greatest(0::numeric, least(p_roll, 99.999999::numeric)) < upper_bound
  order by upper_bound
  limit 1;
$function$;

create or replace function private.open_profile_booster()
returns table (
  item_id text,
  rarity text,
  is_duplicate boolean,
  cashback integer,
  coins integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  wallet_coins integer;
  picked_rarity text;
  picked_item text;
  inserted_count integer;
  duplicate_result boolean;
  cashback_result integer;
  updated_coins integer;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform private.ensure_profile_rewards(actor);

  select account.coins
    into wallet_coins
  from public.user_reward_accounts account
  where account.user_id = actor
  for update;

  if wallet_coins < 10 then
    raise exception 'Недостаточно монет для открытия бустера' using errcode = 'P0001';
  end if;

  picked_rarity := private.pick_reward_rarity(random() * 100);

  select catalog.id
    into picked_item
  from public.reward_catalog catalog
  where catalog.rarity_id = picked_rarity and catalog.active
  order by random()
  limit 1;

  if picked_item is null then
    raise exception 'В выбранной редкости нет активных предметов' using errcode = 'P0001';
  end if;

  insert into public.user_collectibles (user_id, item_id)
  values (actor, picked_item)
  on conflict (user_id, item_id) do nothing;
  get diagnostics inserted_count = row_count;

  duplicate_result := inserted_count = 0;
  cashback_result := case when duplicate_result then 5 else 0 end;
  updated_coins := wallet_coins - 10 + cashback_result;

  update public.user_reward_accounts
  set coins = updated_coins, updated_at = clock_timestamp()
  where user_id = actor;

  return query select picked_item, picked_rarity, duplicate_result, cashback_result, updated_coins;
end;
$function$;

create or replace function private.record_reward_activity()
returns table (coins integer, progress_seconds integer, awarded_coins integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  current_coins integer;
  current_progress integer;
  previous_heartbeat timestamptz;
  heartbeat_now timestamptz := clock_timestamp();
  active_delta integer := 0;
  total_progress integer;
  earned integer;
  next_progress integer;
  next_coins integer;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform private.ensure_profile_rewards(actor);

  select account.coins, account.progress_seconds, account.last_heartbeat_at
    into current_coins, current_progress, previous_heartbeat
  from public.user_reward_accounts account
  where account.user_id = actor
  for update;

  if previous_heartbeat is not null then
    active_delta := least(
      30,
      greatest(0, floor(extract(epoch from heartbeat_now - previous_heartbeat))::integer)
    );
  end if;

  total_progress := current_progress + active_delta;
  earned := (total_progress / 3600) * 10;
  next_progress := total_progress % 3600;
  next_coins := current_coins + earned;

  update public.user_reward_accounts
  set
    coins = next_coins,
    progress_seconds = next_progress,
    last_heartbeat_at = heartbeat_now,
    updated_at = heartbeat_now
  where user_id = actor;

  return query select next_coins, next_progress, earned;
end;
$function$;

create or replace function private.claim_reward_refill()
returns table (coins integer, awarded_coins integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  current_coins integer;
  awarded integer := 0;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform private.ensure_profile_rewards(actor);

  select account.coins
    into current_coins
  from public.user_reward_accounts account
  where account.user_id = actor
  for update;

  if current_coins < 10 then
    current_coins := current_coins + 10;
    awarded := 10;
    update public.user_reward_accounts
    set coins = current_coins, updated_at = clock_timestamp()
    where user_id = actor;
  end if;

  return query select current_coins, awarded;
end;
$function$;

create or replace function private.set_profile_cosmetic(p_category text, p_item_id text)
returns table (
  avatar_decoration_id text,
  profile_effect_id text,
  badge_id text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_category not in ('avatar_decoration', 'profile_effect', 'badge') then
    raise exception 'Unknown collectible category' using errcode = '22023';
  end if;

  perform private.ensure_profile_rewards(actor);

  if p_item_id is not null and not exists (
    select 1
    from public.user_collectibles owned
    join public.reward_catalog catalog on catalog.id = owned.item_id
    where owned.user_id = actor
      and owned.item_id = p_item_id
      and catalog.category = p_category
      and catalog.active
  ) then
    raise exception 'Collectible is not owned or has another category' using errcode = '42501';
  end if;

  update public.profile_cosmetics cosmetics
  set
    avatar_decoration_id = case when p_category = 'avatar_decoration' then p_item_id else cosmetics.avatar_decoration_id end,
    profile_effect_id = case when p_category = 'profile_effect' then p_item_id else cosmetics.profile_effect_id end,
    badge_id = case when p_category = 'badge' then p_item_id else cosmetics.badge_id end,
    updated_at = clock_timestamp()
  where cosmetics.user_id = actor;

  return query
  select cosmetics.avatar_decoration_id, cosmetics.profile_effect_id, cosmetics.badge_id
  from public.profile_cosmetics cosmetics
  where cosmetics.user_id = actor;
end;
$function$;

create or replace function public.open_profile_booster()
returns table (item_id text, rarity text, is_duplicate boolean, cashback integer, coins integer)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.open_profile_booster();
$function$;

create or replace function public.record_reward_activity()
returns table (coins integer, progress_seconds integer, awarded_coins integer)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.record_reward_activity();
$function$;

create or replace function public.claim_reward_refill()
returns table (coins integer, awarded_coins integer)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.claim_reward_refill();
$function$;

create or replace function public.set_profile_cosmetic(p_category text, p_item_id text)
returns table (avatar_decoration_id text, profile_effect_id text, badge_id text)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.set_profile_cosmetic(p_category, p_item_id);
$function$;

revoke execute on function private.pick_reward_rarity(numeric) from public, anon, authenticated;
revoke execute on function private.open_profile_booster() from public, anon;
revoke execute on function private.record_reward_activity() from public, anon;
revoke execute on function private.claim_reward_refill() from public, anon;
revoke execute on function private.set_profile_cosmetic(text, text) from public, anon;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.open_profile_booster() to authenticated, service_role;
grant execute on function private.record_reward_activity() to authenticated, service_role;
grant execute on function private.claim_reward_refill() to authenticated, service_role;
grant execute on function private.set_profile_cosmetic(text, text) to authenticated, service_role;

revoke execute on function public.open_profile_booster() from public, anon;
revoke execute on function public.record_reward_activity() from public, anon;
revoke execute on function public.claim_reward_refill() from public, anon;
revoke execute on function public.set_profile_cosmetic(text, text) from public, anon;

grant execute on function public.open_profile_booster() to authenticated, service_role;
grant execute on function public.record_reward_activity() to authenticated, service_role;
grant execute on function public.claim_reward_refill() to authenticated, service_role;
grant execute on function public.set_profile_cosmetic(text, text) to authenticated, service_role;
