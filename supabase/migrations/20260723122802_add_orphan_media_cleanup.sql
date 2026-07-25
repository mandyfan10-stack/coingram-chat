create table if not exists private.media_cleanup_config (
  singleton boolean primary key default true check (singleton),
  secret_hash text not null,
  updated_at timestamptz not null default now()
);

revoke all on private.media_cleanup_config from public, anon, authenticated;

drop function if exists public.verify_media_cleanup_secret(text);
create function public.verify_media_cleanup_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from private.media_cleanup_config
    where singleton
      and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  );
$function$;

revoke execute on function public.verify_media_cleanup_secret(text)
  from public, anon, authenticated;
grant execute on function public.verify_media_cleanup_secret(text)
  to service_role;