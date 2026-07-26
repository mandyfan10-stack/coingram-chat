create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.ensure_personal_chat(uuid) set schema private;

revoke execute on function private.ensure_personal_chat(uuid) from public, anon;
grant execute on function private.ensure_personal_chat(uuid) to authenticated;

create function public.ensure_personal_chat(p_target_profile_id uuid)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.ensure_personal_chat(p_target_profile_id);
$$;

revoke execute on function public.ensure_personal_chat(uuid) from public, anon;
grant execute on function public.ensure_personal_chat(uuid) to authenticated;