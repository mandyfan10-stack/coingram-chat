-- Coiny identities are synthetic ({username}@coiny.users.local or legacy
-- @tg-clone.com) and cannot receive mail. Hosted Supabase defaults to
-- "Confirm email", which then returns 400 on /auth/v1/token?grant_type=password
-- ("Email not confirmed") and blocks login. Auto-confirm only those addresses.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.auto_confirm_synthetic_auth_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and (
    new.email ilike '%@coiny.users.local'
    or new.email ilike '%@tg-clone.com'
  ) then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end;
$$;

revoke all on function private.auto_confirm_synthetic_auth_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_auto_confirm_synthetic on auth.users;
create trigger on_auth_user_auto_confirm_synthetic
  before insert on auth.users
  for each row
  execute function private.auto_confirm_synthetic_auth_email();

update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null
  and (
    email ilike '%@coiny.users.local'
    or email ilike '%@tg-clone.com'
  );

-- Resolve the real Auth email for a username so the client makes one
-- password grant instead of dual-path 400s (modern then legacy).
create or replace function public.resolve_username_auth_email(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from public.profiles as p
  join auth.users as u on u.id = p.id
  where p.username = pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, '')))
  limit 1;
$$;

revoke all on function public.resolve_username_auth_email(text) from public;
grant execute on function public.resolve_username_auth_email(text) to anon, authenticated;
