-- Keep public RPC helpers out of SECURITY DEFINER while preserving recursion-safe RLS checks.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_chat_member(
  target_chat_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.chat_members
    where chat_members.chat_id = target_chat_id
      and chat_members.profile_id = target_profile_id
  );
$function$;

create or replace function private.is_chat_admin(
  target_chat_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.chat_members
    where chat_members.chat_id = target_chat_id
      and chat_members.profile_id = target_profile_id
      and chat_members.role = 'admin'
  );
$function$;

revoke execute on function private.is_chat_member(uuid, uuid) from public;
revoke execute on function private.is_chat_admin(uuid, uuid) from public;
grant execute on function private.is_chat_member(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_chat_admin(uuid, uuid) to authenticated, service_role;

create or replace function public.is_chat_member(
  target_chat_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select target_profile_id = (select auth.uid())
    and private.is_chat_member(target_chat_id, target_profile_id);
$function$;

create or replace function public.is_chat_admin(
  chat_id uuid,
  user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select user_id = (select auth.uid())
    and private.is_chat_admin(chat_id, user_id);
$function$;

revoke execute on function public.is_chat_member(uuid, uuid) from public, anon;
revoke execute on function public.is_chat_admin(uuid, uuid) from public, anon;
grant execute on function public.is_chat_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_chat_admin(uuid, uuid) to authenticated, service_role;

create or replace function private.pin_chat_message(
  p_chat_id uuid,
  p_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_chat_type text;
  v_created_by uuid;
  v_settings jsonb;
  v_is_admin boolean;
  v_is_member boolean;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  select type, created_by, settings
  into v_chat_type, v_created_by, v_settings
  from public.chats
  where id = p_chat_id;

  if not found then
    return false;
  end if;

  if p_message_id is not null and not exists (
    select 1
    from public.messages
    where id = p_message_id and chat_id = p_chat_id
  ) then
    return false;
  end if;

  if v_created_by = (select auth.uid()) then
    null;
  else
    v_is_admin := private.is_chat_admin(p_chat_id, (select auth.uid()));
    v_is_member := private.is_chat_member(p_chat_id, (select auth.uid()));

    if v_chat_type = 'personal' and v_is_member then
      null;
    elsif v_chat_type = 'group'
      and (v_is_admin or (v_is_member and coalesce((v_settings->>'allow_pin_messages')::boolean, true))) then
      null;
    elsif v_chat_type = 'channel' and v_is_admin then
      null;
    else
      raise exception 'Недостаточно прав для закрепления сообщения в этом чате';
    end if;
  end if;

  update public.chats
  set pinned_message_id = p_message_id
  where id = p_chat_id;

  return true;
end;
$function$;

revoke execute on function private.pin_chat_message(uuid, uuid) from public;
grant execute on function private.pin_chat_message(uuid, uuid) to authenticated, service_role;

create or replace function public.pin_chat_message(
  p_chat_id uuid,
  p_message_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.pin_chat_message(p_chat_id, p_message_id);
$function$;

create or replace function public.unpin_chat_message(
  p_chat_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.pin_chat_message(p_chat_id, null);
$function$;

revoke execute on function public.pin_chat_message(uuid, uuid) from public, anon;
revoke execute on function public.unpin_chat_message(uuid) from public, anon;
grant execute on function public.pin_chat_message(uuid, uuid) to authenticated, service_role;
grant execute on function public.unpin_chat_message(uuid) to authenticated, service_role;

-- Match server-side limits to the client and keep encrypted blobs accepted.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array[
      'application/octet-stream',
      'audio/aac',
      'audio/flac',
      'audio/m4a',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/webm',
      'audio/x-m4a',
      'image/avif',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/ogg',
      'video/webm'
    ]::text[]
where id = 'chat-attachments';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/avif',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
where id = 'public-media';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array[
      'application/gzip',
      'application/json',
      'application/octet-stream',
      'application/x-tgsticker',
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/webm'
    ]::text[]
where id = 'stickers';