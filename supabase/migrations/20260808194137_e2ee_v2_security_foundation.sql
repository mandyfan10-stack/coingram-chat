-- E2EE v2 / MLS security foundation. The feature remains disabled in clients
-- until the pinned OpenMLS WASM implementation and independent audit are ready.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists wallpaper_path text;

alter table public.chats
  add column if not exists avatar_path text;

alter table public.stories
  add column if not exists media_path text;

alter table public.messages
  add column if not exists media_path text,
  add column if not exists crypto_version smallint not null default 1,
  add column if not exists sender_device_id uuid,
  add column if not exists encrypted_payload bytea,
  alter column text drop not null;

create table if not exists public.e2ee_identities (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  identity_key bytea not null,
  key_version integer not null default 1 check (key_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint e2ee_identity_key_size check (octet_length(identity_key) between 32 and 4096)
);

create table if not exists public.e2ee_recovery_backups (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  format_version integer not null default 2 check (format_version >= 2),
  kdf text not null default 'argon2id' check (kdf = 'argon2id'),
  kdf_parameters jsonb not null,
  encrypted_backup text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint e2ee_recovery_backup_size check (octet_length(encrypted_backup) between 32 and 1048576)
);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_name text not null check (char_length(device_name) between 1 and 128),
  credential bytea not null,
  certificate bytea not null,
  certificate_signature bytea not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  constraint user_device_credential_size check (octet_length(credential) between 32 and 16384),
  constraint user_device_certificate_size check (octet_length(certificate) between 32 and 65536),
  constraint user_device_signature_size check (octet_length(certificate_signature) between 32 and 4096),
  constraint user_device_status_timestamps check (
    (status = 'pending' and approved_at is null and revoked_at is null)
    or (status = 'active' and approved_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

alter table public.messages
  drop constraint if exists messages_sender_device_id_fkey,
  add constraint messages_sender_device_id_fkey
    foreign key (sender_device_id) references public.user_devices(id) on delete restrict,
  drop constraint if exists messages_crypto_payload_check,
  add constraint messages_crypto_payload_check check (
    (crypto_version = 1 and encrypted_payload is null)
    or (
      crypto_version = 2
      and sender_device_id is not null
      and encrypted_payload is not null
      and text is null
      and media is null
      and media_path is null
      and reply_to is null
      and read is false
      and reactions = '[]'::jsonb
      and octet_length(encrypted_payload) between 16 and 1048576
    )
  );

create table if not exists public.e2ee_key_packages (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.user_devices(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  ciphersuite text not null default 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
    check (ciphersuite = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'),
  key_package bytea not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_for_chat uuid references public.chats(id) on delete set null,
  constraint e2ee_key_package_size check (octet_length(key_package) between 64 and 262144),
  constraint e2ee_key_package_expiry check (expires_at > created_at)
);

create table if not exists public.e2ee_conversations (
  chat_id uuid primary key references public.chats(id) on delete cascade,
  mls_group_id bytea not null unique,
  protocol_version smallint not null default 2 check (protocol_version = 2),
  activation_epoch bigint not null default 0 check (activation_epoch >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  activated_at timestamptz not null default now(),
  constraint e2ee_group_id_size check (octet_length(mls_group_id) between 16 and 255)
);

create table if not exists public.e2ee_handshake_events (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.e2ee_conversations(chat_id) on delete cascade,
  epoch bigint not null check (epoch >= 0),
  sequence bigint generated always as identity,
  sender_device_id uuid not null references public.user_devices(id) on delete restrict,
  event_type text not null check (event_type in ('proposal', 'commit')),
  encrypted_payload bytea not null,
  payload_hash bytea not null,
  created_at timestamptz not null default now(),
  unique (chat_id, sequence),
  constraint e2ee_handshake_payload_size check (octet_length(encrypted_payload) between 16 and 1048576),
  constraint e2ee_handshake_hash_size check (octet_length(payload_hash) = 32)
);

create table if not exists public.e2ee_welcomes (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.e2ee_conversations(chat_id) on delete cascade,
  epoch bigint not null check (epoch >= 0),
  sender_device_id uuid not null references public.user_devices(id) on delete restrict,
  recipient_device_id uuid not null references public.user_devices(id) on delete cascade,
  encrypted_payload bytea not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint e2ee_welcome_payload_size check (octet_length(encrypted_payload) between 16 and 1048576)
);

create table if not exists public.device_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_device_id uuid not null references public.user_devices(id) on delete cascade,
  to_device_id uuid not null references public.user_devices(id) on delete cascade,
  object_prefix text not null,
  encrypted_manifest bytea not null,
  manifest_hash bytea not null,
  chunk_count integer not null check (chunk_count between 1 and 10000),
  transfer_counter bigint not null check (transfer_counter > 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  completed_at timestamptz,
  unique (from_device_id, to_device_id, transfer_counter),
  constraint device_transfer_different_devices check (from_device_id <> to_device_id),
  constraint device_transfer_prefix check (object_prefix !~ '(^|/)\.\.(/|$)' and object_prefix !~ '[\\%]'),
  constraint device_transfer_manifest_size check (octet_length(encrypted_manifest) between 16 and 1048576),
  constraint device_transfer_hash_size check (octet_length(manifest_hash) = 32),
  constraint device_transfer_expiry check (expires_at > created_at and expires_at <= created_at + interval '1 hour')
);

create table if not exists private.e2ee_key_package_claims (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  target_user_id uuid not null,
  key_package_id uuid not null,
  claimed_at timestamptz not null default clock_timestamp()
);

create table if not exists private.media_upload_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default clock_timestamp()
);

create table if not exists private.sticker_import_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default clock_timestamp()
);

create index if not exists user_devices_user_status_idx on public.user_devices (user_id, status);
create index if not exists e2ee_key_packages_claim_idx
  on public.e2ee_key_packages (owner_id, expires_at, created_at) where claimed_at is null;
create index if not exists e2ee_handshake_chat_epoch_idx
  on public.e2ee_handshake_events (chat_id, epoch, sequence);
create index if not exists e2ee_welcomes_recipient_idx
  on public.e2ee_welcomes (recipient_device_id, created_at) where consumed_at is null;
create index if not exists device_transfers_recipient_idx
  on public.device_transfers (to_device_id, expires_at) where status = 'pending';
create index if not exists e2ee_key_package_claims_actor_idx
  on private.e2ee_key_package_claims (actor_id, claimed_at desc);
create index if not exists media_upload_attempts_user_idx
  on private.media_upload_attempts (user_id, attempted_at desc);
create index if not exists sticker_import_attempts_user_idx
  on private.sticker_import_attempts (user_id, attempted_at desc);
create index if not exists messages_crypto_route_idx
  on public.messages (chat_id, crypto_version, created_at desc);

alter table public.e2ee_identities enable row level security;
alter table public.e2ee_recovery_backups enable row level security;
alter table public.user_devices enable row level security;
alter table public.e2ee_key_packages enable row level security;
alter table public.e2ee_conversations enable row level security;
alter table public.e2ee_handshake_events enable row level security;
alter table public.e2ee_welcomes enable row level security;
alter table public.device_transfers enable row level security;

create policy "Authenticated users read identity keys"
  on public.e2ee_identities for select to authenticated using (true);
create policy "Owners insert identity keys"
  on public.e2ee_identities for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owners rotate identity keys"
  on public.e2ee_identities for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Owners manage recovery backups"
  on public.e2ee_recovery_backups for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Owners read devices"
  on public.user_devices for select to authenticated using (user_id = (select auth.uid()));
create policy "Chat members read peer active devices"
  on public.user_devices for select to authenticated using (
    status = 'active' and exists (
      select 1 from public.chat_members mine
      join public.chat_members peer on peer.chat_id = mine.chat_id
      where mine.profile_id = (select auth.uid()) and peer.profile_id = user_devices.user_id
    )
  );
create policy "Owners register pending devices"
  on public.user_devices for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy "Owners create key packages"
  on public.e2ee_key_packages for insert to authenticated with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.user_devices d
      where d.id = device_id and d.user_id = (select auth.uid()) and d.status = 'active'
    )
  );
create policy "Owners read unused key packages"
  on public.e2ee_key_packages for select to authenticated
  using (owner_id = (select auth.uid()) and claimed_at is null);
create policy "Owners delete unused key packages"
  on public.e2ee_key_packages for delete to authenticated
  using (owner_id = (select auth.uid()) and claimed_at is null);

create policy "Members read E2EE conversations"
  on public.e2ee_conversations for select to authenticated
  using (public.is_chat_member(chat_id, (select auth.uid())));
create policy "Members activate E2EE conversations"
  on public.e2ee_conversations for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_chat_member(chat_id, (select auth.uid())));

create policy "Members read handshake events"
  on public.e2ee_handshake_events for select to authenticated
  using (public.is_chat_member(chat_id, (select auth.uid())));
create policy "Active devices append handshake events"
  on public.e2ee_handshake_events for insert to authenticated with check (
    public.is_chat_member(chat_id, (select auth.uid())) and exists (
      select 1 from public.user_devices d
      where d.id = sender_device_id and d.user_id = (select auth.uid()) and d.status = 'active'
    )
  );

create policy "Recipient devices read welcomes"
  on public.e2ee_welcomes for select to authenticated using (
    exists (
      select 1 from public.user_devices d
      where d.id = recipient_device_id and d.user_id = (select auth.uid()) and d.status = 'active'
    )
  );
create policy "Active devices append welcomes"
  on public.e2ee_welcomes for insert to authenticated with check (
    public.is_chat_member(chat_id, (select auth.uid())) and exists (
      select 1 from public.user_devices d
      where d.id = sender_device_id and d.user_id = (select auth.uid()) and d.status = 'active'
    )
  );

create policy "Owners read transfers"
  on public.device_transfers for select to authenticated using (user_id = (select auth.uid()));
create policy "Active devices create transfers"
  on public.device_transfers for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.user_devices source_device
      join public.user_devices target_device on target_device.id = to_device_id
      where source_device.id = from_device_id
        and source_device.user_id = (select auth.uid())
        and target_device.user_id = (select auth.uid())
        and source_device.status = 'active'
        and target_device.status in ('pending', 'active')
    )
  );

create or replace function private.reject_e2ee_mutation()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  raise exception 'E2EE protocol records are append-only' using errcode = '42501';
end;
$function$;
revoke execute on function private.reject_e2ee_mutation() from public, anon, authenticated;

create trigger e2ee_conversations_append_only before update or delete on public.e2ee_conversations
  for each row execute function private.reject_e2ee_mutation();
create trigger e2ee_handshake_events_append_only before update or delete on public.e2ee_handshake_events
  for each row execute function private.reject_e2ee_mutation();
create trigger e2ee_welcomes_append_only before update or delete on public.e2ee_welcomes
  for each row execute function private.reject_e2ee_mutation();

create or replace function private.validate_v2_message_mutation()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if tg_op = 'DELETE' and old.crypto_version = 2 then
    raise exception 'MLS messages are append-only' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (old.crypto_version = 2 or new.crypto_version = 2) then
    raise exception 'MLS messages are append-only; append an encrypted application event' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;
revoke execute on function private.validate_v2_message_mutation() from public, anon, authenticated;
drop trigger if exists validate_v2_message_mutation on public.messages;
create trigger validate_v2_message_mutation before update or delete on public.messages
  for each row execute function private.validate_v2_message_mutation();

create or replace function private.validate_v2_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.crypto_version = 2 then
    if not exists (
      select 1 from public.user_devices d
      where d.id = new.sender_device_id
        and d.user_id = (select auth.uid())
        and d.status = 'active'
    ) then
      raise exception 'Unknown, foreign, or revoked sender device' using errcode = '42501';
    end if;
    if not exists (select 1 from public.e2ee_conversations c where c.chat_id = new.chat_id) then
      raise exception 'Conversation has not been activated for E2EE v2' using errcode = '42501';
    end if;
  elsif exists (select 1 from public.e2ee_conversations c where c.chat_id = new.chat_id) then
    raise exception 'This conversation requires E2EE v2' using errcode = '42501';
  end if;
  return new;
end;
$function$;
revoke execute on function private.validate_v2_message_insert() from public, anon, authenticated;
drop trigger if exists validate_v2_message_insert on public.messages;
create trigger validate_v2_message_insert before insert on public.messages
  for each row execute function private.validate_v2_message_insert();

create or replace function private.claim_e2ee_key_package(
  p_chat_id uuid,
  p_target_user_id uuid
)
returns table (key_package_id uuid, device_id uuid, key_package bytea, ciphersuite text)
language plpgsql security definer set search_path = '' as $function$
declare
  actor uuid := (select auth.uid());
  selected_id uuid;
begin
  if actor is null
     or not exists (select 1 from public.chat_members where chat_id = p_chat_id and profile_id = actor)
     or not exists (select 1 from public.chat_members where chat_id = p_chat_id and profile_id = p_target_user_id) then
    raise exception 'Chat membership required' using errcode = '42501';
  end if;

  if (select count(*) from private.e2ee_key_package_claims
      where actor_id = actor and claimed_at >= clock_timestamp() - interval '1 minute') >= 60 then
    raise exception 'KeyPackage claim rate limit exceeded' using errcode = 'P0001';
  end if;

  select kp.id into selected_id
  from public.e2ee_key_packages kp
  join public.user_devices d on d.id = kp.device_id
  where kp.owner_id = p_target_user_id
    and kp.claimed_at is null
    and kp.expires_at > clock_timestamp()
    and d.status = 'active'
  order by kp.created_at
  for update of kp skip locked
  limit 1;

  if selected_id is null then
    return;
  end if;

  update public.e2ee_key_packages kp
  set claimed_at = clock_timestamp(), claimed_by = actor, claimed_for_chat = p_chat_id
  where kp.id = selected_id;

  insert into private.e2ee_key_package_claims (actor_id, target_user_id, key_package_id)
  values (actor, p_target_user_id, selected_id);

  return query
  select kp.id, kp.device_id, kp.key_package, kp.ciphersuite
  from public.e2ee_key_packages kp where kp.id = selected_id;
end;
$function$;

create or replace function public.claim_e2ee_key_package(p_chat_id uuid, p_target_user_id uuid)
returns table (key_package_id uuid, device_id uuid, key_package bytea, ciphersuite text)
language sql security invoker set search_path = '' as $function$
  select * from private.claim_e2ee_key_package(p_chat_id, p_target_user_id);
$function$;

revoke execute on function private.claim_e2ee_key_package(uuid, uuid) from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.claim_e2ee_key_package(uuid, uuid) to authenticated, service_role;
revoke execute on function public.claim_e2ee_key_package(uuid, uuid) from public, anon;
grant execute on function public.claim_e2ee_key_package(uuid, uuid) to authenticated, service_role;

create or replace function private.activate_initial_e2ee_device(p_device_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare actor uuid := (select auth.uid());
begin
  if actor is null or exists (
    select 1 from public.user_devices where user_id = actor and status = 'active'
  ) then
    raise exception 'An active device must approve this device' using errcode = '42501';
  end if;
  update public.user_devices set status = 'active', approved_at = clock_timestamp()
  where id = p_device_id and user_id = actor and status = 'pending';
  return found;
end;
$function$;

create or replace function private.approve_e2ee_device(p_approver_device_id uuid, p_target_device_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not exists (
    select 1 from public.user_devices
    where id = p_approver_device_id and user_id = actor and status = 'active'
  ) then raise exception 'An active local device is required' using errcode = '42501'; end if;
  update public.user_devices set status = 'active', approved_at = clock_timestamp()
  where id = p_target_device_id and user_id = actor and status = 'pending';
  return found;
end;
$function$;

create or replace function private.revoke_e2ee_device(p_approver_device_id uuid, p_target_device_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not exists (
    select 1 from public.user_devices
    where id = p_approver_device_id and user_id = actor and status = 'active'
  ) then raise exception 'An active local device is required' using errcode = '42501'; end if;
  update public.user_devices set status = 'revoked', revoked_at = clock_timestamp()
  where id = p_target_device_id and user_id = actor and status in ('pending', 'active');
  return found;
end;
$function$;

create or replace function public.activate_initial_e2ee_device(p_device_id uuid)
returns boolean language sql security invoker set search_path = '' as $function$
  select private.activate_initial_e2ee_device(p_device_id);
$function$;
create or replace function public.approve_e2ee_device(p_approver_device_id uuid, p_target_device_id uuid)
returns boolean language sql security invoker set search_path = '' as $function$
  select private.approve_e2ee_device(p_approver_device_id, p_target_device_id);
$function$;
create or replace function public.revoke_e2ee_device(p_approver_device_id uuid, p_target_device_id uuid)
returns boolean language sql security invoker set search_path = '' as $function$
  select private.revoke_e2ee_device(p_approver_device_id, p_target_device_id);
$function$;

revoke execute on function private.activate_initial_e2ee_device(uuid),
  private.approve_e2ee_device(uuid, uuid), private.revoke_e2ee_device(uuid, uuid) from public, anon;
grant execute on function private.activate_initial_e2ee_device(uuid),
  private.approve_e2ee_device(uuid, uuid), private.revoke_e2ee_device(uuid, uuid) to authenticated, service_role;
revoke execute on function public.activate_initial_e2ee_device(uuid),
  public.approve_e2ee_device(uuid, uuid), public.revoke_e2ee_device(uuid, uuid) from public, anon;
grant execute on function public.activate_initial_e2ee_device(uuid),
  public.approve_e2ee_device(uuid, uuid), public.revoke_e2ee_device(uuid, uuid) to authenticated, service_role;

revoke all on public.e2ee_identities, public.e2ee_recovery_backups, public.user_devices,
  public.e2ee_key_packages, public.e2ee_conversations, public.e2ee_handshake_events,
  public.e2ee_welcomes, public.device_transfers from anon, authenticated;
grant select, insert, update on public.e2ee_identities to authenticated;
grant select, insert, update, delete on public.e2ee_recovery_backups to authenticated;
grant select, insert on public.user_devices to authenticated;
grant select, insert, delete on public.e2ee_key_packages to authenticated;
grant select, insert on public.e2ee_conversations to authenticated;
grant select, insert on public.e2ee_handshake_events to authenticated;
grant select, insert on public.e2ee_welcomes to authenticated;
grant select, insert on public.device_transfers to authenticated;
revoke all on public.messages from anon, authenticated;
grant select (id, chat_id, sender_id, reply_to, read, created_at, reactions, crypto_version,
  sender_device_id, encrypted_payload, text, media, media_path) on public.messages to authenticated;
grant insert (id, chat_id, sender_id, reply_to, crypto_version, sender_device_id, encrypted_payload,
  text, media, media_path) on public.messages to authenticated;
grant update (text, media, media_path, reply_to, read, reactions) on public.messages to authenticated;
grant delete on public.messages to authenticated;
grant insert (user_id, media, media_path, caption) on public.stories to authenticated;
grant select (avatar_path, wallpaper_path) on public.profiles to authenticated;

drop function if exists public.get_latest_chat_messages(uuid[]);
create function public.get_latest_chat_messages(p_chat_ids uuid[])
returns table (
  id uuid, chat_id uuid, sender_id uuid, text text, media text, reply_to uuid,
  legacy_read boolean, reactions jsonb, created_at timestamptz, read_by uuid[],
  crypto_version smallint, sender_device_id uuid, encrypted_payload bytea
)
language sql stable security invoker set search_path = '' as $function$
  select latest.id, latest.chat_id, latest.sender_id, latest.text, latest.media,
    latest.reply_to, latest.read, latest.reactions, latest.created_at,
    coalesce(array(
      select receipt.profile_id from public.message_reads receipt
      where receipt.message_id = latest.id order by receipt.read_at, receipt.profile_id
    ), '{}'::uuid[]),
    latest.crypto_version, latest.sender_device_id, latest.encrypted_payload
  from (
    select distinct on (message.chat_id) message.*
    from public.messages message
    where message.chat_id = any(coalesce(p_chat_ids, '{}'::uuid[]))
    order by message.chat_id, message.created_at desc, message.id desc
  ) latest;
$function$;
revoke execute on function public.get_latest_chat_messages(uuid[]) from public, anon;
grant execute on function public.get_latest_chat_messages(uuid[]) to authenticated, service_role;

-- Realtime Broadcast/Presence authorization. Only authenticated chat members
-- can join chat-scoped typing and call topics; online presence is deliberately
-- visible only to authenticated users. The project must disable public
-- Realtime channels in Dashboard settings.
drop policy if exists "Messenger call topics can receive" on realtime.messages;
drop policy if exists "Messenger call topics can send" on realtime.messages;
drop policy if exists "Coiny members receive private realtime" on realtime.messages;
create policy "Coiny members receive private realtime"
  on realtime.messages for select to authenticated using (
    (select realtime.topic()) = 'online-users' and extension = 'presence'
    or (
      (select realtime.topic()) ~ '^typing:chat:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and extension = 'broadcast'
      and public.is_chat_member(split_part((select realtime.topic()), ':', 3)::uuid, (select auth.uid()))
    )
    or (
      (select realtime.topic()) ~ '^call:chat:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(:media)?$'
      and extension = 'broadcast'
      and public.is_chat_member(split_part((select realtime.topic()), ':', 3)::uuid, (select auth.uid()))
    )
  );

drop policy if exists "Coiny members send private realtime" on realtime.messages;
create policy "Coiny members send private realtime"
  on realtime.messages for insert to authenticated with check (
    (select realtime.topic()) = 'online-users' and extension = 'presence'
    or (
      (select realtime.topic()) ~ '^typing:chat:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and extension = 'broadcast'
      and public.is_chat_member(split_part((select realtime.topic()), ':', 3)::uuid, (select auth.uid()))
    )
    or (
      (select realtime.topic()) ~ '^call:chat:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(:media)?$'
      and extension = 'broadcast'
      and public.is_chat_member(split_part((select realtime.topic()), ':', 3)::uuid, (select auth.uid()))
    )
  );

create or replace function private.consume_media_upload_quota(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $function$
begin
  delete from private.media_upload_attempts
  where attempted_at < clock_timestamp() - interval '1 hour';
  if (select count(*) from private.media_upload_attempts
      where user_id = p_user_id and attempted_at >= clock_timestamp() - interval '1 minute') >= 20 then
    return false;
  end if;
  insert into private.media_upload_attempts (user_id) values (p_user_id);
  return true;
end;
$function$;
revoke execute on function private.consume_media_upload_quota(uuid) from public, anon, authenticated;
grant execute on function private.consume_media_upload_quota(uuid) to service_role;

create or replace function public.consume_media_upload_quota(p_user_id uuid)
returns boolean language sql security invoker set search_path = '' as $function$
  select private.consume_media_upload_quota(p_user_id);
$function$;
revoke execute on function public.consume_media_upload_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_media_upload_quota(uuid) to service_role;

create or replace function private.consume_sticker_import_quota(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $function$
begin
  delete from private.sticker_import_attempts
  where attempted_at < clock_timestamp() - interval '1 hour';
  if (select count(*) from private.sticker_import_attempts
      where user_id = p_user_id and attempted_at >= clock_timestamp() - interval '10 minutes') >= 5 then
    return false;
  end if;
  insert into private.sticker_import_attempts (user_id) values (p_user_id);
  return true;
end;
$function$;
revoke execute on function private.consume_sticker_import_quota(uuid) from public, anon, authenticated;
grant execute on function private.consume_sticker_import_quota(uuid) to service_role;

-- PostgreSQL cannot rename an existing function input parameter with
-- CREATE OR REPLACE. The Edge Function calls this RPC with p_user_id, so
-- replace the old p_profile_id-named function explicitly.
drop function if exists public.consume_sticker_import_quota(uuid);
create or replace function public.consume_sticker_import_quota(p_user_id uuid)
returns boolean language sql security invoker set search_path = '' as $function$
  select private.consume_sticker_import_quota(p_user_id);
$function$;
revoke execute on function public.consume_sticker_import_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_sticker_import_quota(uuid) to service_role;

-- Replace the broad public-media bucket with purpose-specific access models.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 5242880, array['image/avif','image/jpeg','image/png','image/webp']::text[]),
  ('stories', 'stories', false, 10485760, array['image/avif','image/jpeg','image/png','image/webp']::text[]),
  ('wallpapers', 'wallpapers', false, 10485760, array['image/avif','image/jpeg','image/png','image/webp']::text[]),
  ('group-avatars', 'group-avatars', false, 5242880, array['image/avif','image/jpeg','image/png','image/webp']::text[]),
  ('history-transfers', 'history-transfers', false, 52428800, array['application/octet-stream']::text[])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets set public = false where id = 'public-media';
update storage.buckets set public = true where id = 'stickers';

drop policy if exists "Users upload their own public media" on storage.objects;
drop policy if exists "Users update their own public media" on storage.objects;
drop policy if exists "Users delete their own public media" on storage.objects;

create policy "Authenticated users read referenced legacy public media"
  on storage.objects for select to authenticated using (
    bucket_id = 'public-media' and (
      exists (
        select 1 from public.profiles p
        where split_part(split_part(p.avatar, '/public-media/', 2), '?', 1) = name
          and (storage.foldername(name))[1] = p.id::text
          and storage.filename(name) like 'avatar\_%' escape E'\\'
      )
      or exists (
        select 1 from public.stories s
        where s.expires_at > now()
          and split_part(split_part(s.media, '/public-media/', 2), '?', 1) = name
          and (storage.foldername(name))[1] = s.user_id::text
          and storage.filename(name) like 'story\_%' escape E'\\'
      )
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and split_part(split_part(p.wallpaper, '/public-media/', 2), '?', 1) = name
          and (storage.foldername(name))[1] = p.id::text
          and storage.filename(name) like 'wallpaper\_%' escape E'\\'
      )
    )
  );

create policy "Authenticated users read avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "Owners read wallpapers" on storage.objects for select to authenticated
  using (bucket_id = 'wallpapers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members read group avatars" on storage.objects for select to authenticated
  using (bucket_id = 'group-avatars' and exists (
    select 1 from public.chat_members cm
    where cm.chat_id::text = (storage.foldername(name))[1]
      and cm.profile_id = (select auth.uid())
  ));
create policy "Authenticated users read active story media" on storage.objects for select to authenticated
  using (bucket_id = 'stories' and exists (
    select 1 from public.stories s where s.media_path = name and s.expires_at > now()
  ));
create policy "Owners read history transfer chunks" on storage.objects for select to authenticated
  using (bucket_id = 'history-transfers' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Direct writes to image buckets intentionally have no client policy. A
-- validating Edge Function writes normalized images with the service role.
