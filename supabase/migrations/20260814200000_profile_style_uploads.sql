-- User-uploaded profile style: decoration, banner, badge.
-- Catalog IDs stay in place but are no longer required to equip a look.

alter table public.profile_cosmetics
  add column if not exists avatar_decoration_ref text,
  add column if not exists profile_banner_ref text,
  add column if not exists badge_ref text;

comment on column public.profile_cosmetics.avatar_decoration_ref is
  'storage://profile-cosmetics/{userId}/decoration_*.webp';
comment on column public.profile_cosmetics.profile_banner_ref is
  'storage://profile-cosmetics/{userId}/banner_*.webp';
comment on column public.profile_cosmetics.badge_ref is
  'storage://profile-cosmetics/{userId}/badge_*.webp';

create or replace function private.is_own_profile_style_ref(p_user_id uuid, p_slot text, p_ref text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select
    p_ref is null
    or (
      p_slot in ('decoration', 'banner', 'badge')
      and p_ref ~ (
        '^storage://profile-cosmetics/'
        || p_user_id::text
        || '/'
        || p_slot
        || '_[0-9a-f-]{36}\.webp$'
      )
    );
$function$;

revoke execute on function private.is_own_profile_style_ref(uuid, text, text) from public, anon, authenticated;

create or replace function private.set_profile_style(p_slot text, p_reference text)
returns table (
  avatar_decoration_ref text,
  profile_banner_ref text,
  badge_ref text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  next_ref text := nullif(btrim(coalesce(p_reference, '')), '');
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_slot not in ('decoration', 'banner', 'badge') then
    raise exception 'Unknown profile style slot' using errcode = '22023';
  end if;
  if not private.is_own_profile_style_ref(actor, p_slot, next_ref) then
    raise exception 'Profile style must be an owned sanitized upload' using errcode = '42501';
  end if;

  perform private.ensure_profile_rewards(actor);

  update public.profile_cosmetics
  set
    avatar_decoration_ref = case when p_slot = 'decoration' then next_ref else profile_cosmetics.avatar_decoration_ref end,
    profile_banner_ref = case when p_slot = 'banner' then next_ref else profile_cosmetics.profile_banner_ref end,
    badge_ref = case when p_slot = 'badge' then next_ref else profile_cosmetics.badge_ref end,
    updated_at = clock_timestamp()
  where user_id = actor;

  return query
  select
    cosmetics.avatar_decoration_ref,
    cosmetics.profile_banner_ref,
    cosmetics.badge_ref
  from public.profile_cosmetics cosmetics
  where cosmetics.user_id = actor;
end;
$function$;

create or replace function public.set_profile_style(p_slot text, p_reference text)
returns table (
  avatar_decoration_ref text,
  profile_banner_ref text,
  badge_ref text
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.set_profile_style(p_slot, p_reference);
$function$;

revoke execute on function private.set_profile_style(text, text) from public, anon;
revoke execute on function public.set_profile_style(text, text) from public, anon;
grant execute on function private.set_profile_style(text, text) to authenticated, service_role;
grant execute on function public.set_profile_style(text, text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-cosmetics',
  'profile-cosmetics',
  false,
  5242880,
  array['image/avif', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users read profile cosmetics" on storage.objects;
create policy "Authenticated users read profile cosmetics"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-cosmetics');

drop policy if exists "Owners write profile cosmetics" on storage.objects;
create policy "Owners write profile cosmetics"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-cosmetics'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners update profile cosmetics" on storage.objects;
create policy "Owners update profile cosmetics"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-cosmetics'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners delete profile cosmetics" on storage.objects;
create policy "Owners delete profile cosmetics"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-cosmetics'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
