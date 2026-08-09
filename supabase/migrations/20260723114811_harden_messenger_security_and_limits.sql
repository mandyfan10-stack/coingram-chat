-- Harden exposed messenger data, repair E2EE profile persistence, and add
-- server-side abuse controls. Every privileged function uses an empty
-- search_path and is only reachable through a trigger.

-- Move legacy encrypted private-key backups out of the globally visible
-- profiles table before removing the obsolete column.
-- The source column existed only on some live deployments, not in the
-- historical fresh bootstrap. Dynamic SQL prevents PostgreSQL from resolving
-- an absent source column before the existence guard can run.
do $block$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'encrypted_private_key'
  ) then
    execute $sql$
      insert into public.user_private_keys (id, encrypted_private_key)
      select profile.id, profile.encrypted_private_key
      from public.profiles as profile
      where profile.encrypted_private_key is not null
      on conflict (id) do nothing
    $sql$;
  end if;
end;
$block$;

alter table public.profiles
  drop column if exists encrypted_private_key;

-- Stories created before expires_at was introduced never received the column
-- because the original migration used CREATE TABLE IF NOT EXISTS.
alter table public.stories
  add column if not exists expires_at timestamptz;

update public.stories
set expires_at = coalesce(created_at, now()) + interval '24 hours'
where expires_at is null;

alter table public.stories
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

create index if not exists stories_expires_at_idx
  on public.stories (expires_at);

drop policy if exists "Stories are visible to authenticated users" on public.stories;
drop policy if exists "Authenticated users can view active stories" on public.stories;
create policy "Authenticated users can view active stories"
  on public.stories for select
  to authenticated
  using (expires_at > now());

-- Keep message identity and routing immutable. Authors may edit their content;
-- other chat members may only change reactions.
create or replace function public.validate_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.chat_id is distinct from old.chat_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Message identity and routing fields are immutable'
      using errcode = '42501';
  end if;

  if (select auth.uid()) is distinct from old.sender_id
     and (
       new.text is distinct from old.text
       or new.media is distinct from old.media
       or new.reply_to is distinct from old.reply_to
       or new.read is distinct from old.read
     ) then
    raise exception 'Only the sender may edit message content'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke execute on function public.validate_message_update()
  from public, anon, authenticated;

drop trigger if exists on_message_updated on public.messages;
create trigger on_message_updated
  before update on public.messages
  for each row execute function public.validate_message_update();

-- Prevent changing a chat into another type or transferring its ownership via
-- a broad UPDATE policy.
create or replace function public.validate_chat_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.type is distinct from old.type
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Chat identity, type and owner are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

revoke execute on function public.validate_chat_update()
  from public, anon, authenticated;

drop trigger if exists on_chat_updated on public.chats;
create trigger on_chat_updated
  before update on public.chats
  for each row execute function public.validate_chat_update();

-- Members may update their own notification/pin preferences. Only the chat
-- creator or an admin may change another member (including roles).
drop policy if exists "chat_members_update_policy" on public.chat_members;
create policy "chat_members_update_policy"
  on public.chat_members for update
  to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_chat_admin(chat_id, (select auth.uid()))
    or exists (
      select 1
      from public.chats
      where chats.id = chat_members.chat_id
        and chats.created_by = (select auth.uid())
    )
  )
  with check (
    profile_id = (select auth.uid())
    or public.is_chat_admin(chat_id, (select auth.uid()))
    or exists (
      select 1
      from public.chats
      where chats.id = chat_members.chat_id
        and chats.created_by = (select auth.uid())
    )
  );

create or replace function public.validate_chat_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  actor_is_admin boolean;
  actor_is_creator boolean;
begin
  if new.chat_id is distinct from old.chat_id
     or new.profile_id is distinct from old.profile_id
     or new.joined_at is distinct from old.joined_at then
    raise exception 'Chat membership identity is immutable'
      using errcode = '42501';
  end if;

  if actor = old.profile_id then
    if new.role is distinct from old.role then
      raise exception 'Members cannot change their own role'
        using errcode = '42501';
    end if;
    return new;
  end if;

  select exists (
    select 1
    from public.chat_members
    where chat_id = old.chat_id
      and profile_id = actor
      and role = 'admin'
  ) into actor_is_admin;

  select exists (
    select 1
    from public.chats
    where id = old.chat_id
      and created_by = actor
  ) into actor_is_creator;

  if not actor_is_admin and not actor_is_creator then
    raise exception 'Only chat administrators may update other members'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke execute on function public.validate_chat_member_update()
  from public, anon, authenticated;

drop trigger if exists on_chat_member_updated on public.chat_members;
create trigger on_chat_member_updated
  before update on public.chat_members
  for each row execute function public.validate_chat_member_update();

-- Bound data growth and reject malformed oversized message payloads.
alter table public.messages
  drop constraint if exists messages_text_size_check,
  drop constraint if exists messages_media_size_check,
  drop constraint if exists messages_reactions_size_check,
  add constraint messages_text_size_check
    check (octet_length(text) <= 65536),
  add constraint messages_media_size_check
    check (media is null or octet_length(media) <= 8192),
  add constraint messages_reactions_size_check
    check (octet_length(reactions::text) <= 16384);

create index if not exists messages_sender_created_at_idx
  on public.messages (sender_id, created_at desc);

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  short_window_count integer;
  long_window_count integer;
begin
  if actor is null then
    return new;
  end if;

  if new.sender_id is distinct from actor then
    raise exception 'Message sender must match the authenticated user'
      using errcode = '42501';
  end if;

  select
    count(*) filter (where created_at >= statement_timestamp() - interval '10 seconds'),
    count(*) filter (where created_at >= statement_timestamp() - interval '5 minutes')
  into short_window_count, long_window_count
  from public.messages
  where sender_id = actor
    and created_at >= statement_timestamp() - interval '5 minutes';

  if short_window_count >= 25 or long_window_count >= 300 then
    raise exception 'Message rate limit exceeded'
      using errcode = 'P0001',
            hint = 'Wait before sending more messages.';
  end if;

  return new;
end;
$function$;

revoke execute on function public.enforce_message_rate_limit()
  from public, anon, authenticated;

drop trigger if exists before_message_rate_limit on public.messages;
create trigger before_message_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

-- Minimize Data API privileges. RLS still determines which allowed rows are
-- visible, but API roles no longer receive unused table-wide permissions.
revoke all privileges on all tables in schema public from anon, authenticated;

grant select (
  id, username, display_name, avatar, avatar_color, bio, theme, wallpaper,
  last_seen, public_key, has_e2ee
) on public.profiles to authenticated;
grant update (
  display_name, avatar, avatar_color, bio, theme, wallpaper, last_seen,
  public_key, has_e2ee
) on public.profiles to authenticated;

grant select, insert, update, delete on public.chats to authenticated;
grant select, insert, update, delete on public.chat_members to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.user_private_keys to authenticated;
grant select, insert on public.message_reads to authenticated;
grant select, delete on public.stories to authenticated;
grant insert (user_id, media, caption) on public.stories to authenticated;
grant select on public.sticker_packs to authenticated;
grant select on public.stickers to authenticated;
grant select, insert, delete on public.user_sticker_packs to authenticated;

-- Existing public RPC endpoints are explicit; trigger helpers stay private.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_chat_member(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.is_chat_admin(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.pin_chat_message(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.unpin_chat_message(uuid)
  to authenticated, service_role;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
-- Restrict WebRTC/call signaling to private Realtime topics. User topics are
-- readable only by their owner and writable only by users sharing a chat.
create or replace function public.users_share_chat(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.chat_members first_membership
    join public.chat_members second_membership
      on second_membership.chat_id = first_membership.chat_id
    where first_membership.profile_id = first_user
      and second_membership.profile_id = second_user
  );
$function$;

revoke execute on function public.users_share_chat(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.users_share_chat(uuid, uuid)
  to authenticated, service_role;

-- Keep server and client limits aligned. application/octet-stream is required
-- because E2EE attachments are encrypted before upload.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array[
      'application/octet-stream',
      'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/ogg', 'video/webm',
      'audio/aac', 'audio/flac', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
      'audio/wav', 'audio/webm', 'audio/x-m4a'
    ]::text[]
where id = 'chat-attachments';
-- Do not expose private channel metadata to non-members.
drop policy if exists "chats_select_policy" on public.chats;
create policy "chats_select_policy"
  on public.chats for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or public.is_chat_member(id, (select auth.uid()))
    or (type = 'channel' and username is not null)
  );
