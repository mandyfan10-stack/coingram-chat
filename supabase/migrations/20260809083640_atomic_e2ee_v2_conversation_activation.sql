-- Activate an MLS conversation and append its initial commit in one database
-- transaction. The private implementation performs authorization itself
-- because SECURITY DEFINER bypasses table RLS.
create or replace function private.activate_e2ee_conversation(
  p_chat_id uuid,
  p_mls_group_id bytea,
  p_activation_epoch bigint,
  p_sender_device_id uuid,
  p_initial_commit bytea,
  p_payload_hash bytea
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.chat_members member
    where member.chat_id = p_chat_id
      and member.profile_id = actor
  ) then
    raise exception 'Chat membership is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_devices device
    where device.id = p_sender_device_id
      and device.user_id = actor
      and device.status = 'active'
  ) then
    raise exception 'An active owned device is required' using errcode = '42501';
  end if;

  insert into public.e2ee_conversations (
    chat_id, mls_group_id, activation_epoch, created_by
  ) values (
    p_chat_id, p_mls_group_id, p_activation_epoch, actor
  );

  insert into public.e2ee_handshake_events (
    chat_id, epoch, sender_device_id, event_type, encrypted_payload, payload_hash
  ) values (
    p_chat_id, p_activation_epoch, p_sender_device_id, 'commit', p_initial_commit, p_payload_hash
  );
end;
$function$;

create or replace function public.activate_e2ee_conversation(
  p_chat_id uuid,
  p_mls_group_id bytea,
  p_activation_epoch bigint,
  p_sender_device_id uuid,
  p_initial_commit bytea,
  p_payload_hash bytea
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.activate_e2ee_conversation(
    p_chat_id,
    p_mls_group_id,
    p_activation_epoch,
    p_sender_device_id,
    p_initial_commit,
    p_payload_hash
  );
$function$;

revoke execute on function private.activate_e2ee_conversation(uuid, bytea, bigint, uuid, bytea, bytea)
  from public, anon;
grant execute on function private.activate_e2ee_conversation(uuid, bytea, bigint, uuid, bytea, bytea)
  to authenticated, service_role;

revoke execute on function public.activate_e2ee_conversation(uuid, bytea, bigint, uuid, bytea, bytea)
  from public, anon;
grant execute on function public.activate_e2ee_conversation(uuid, bytea, bigint, uuid, bytea, bytea)
  to authenticated, service_role;
