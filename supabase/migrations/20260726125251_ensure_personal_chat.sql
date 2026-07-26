create or replace function public.ensure_personal_chat(p_target_profile_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_profile public.profiles%rowtype;
  personal_chat_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_target_profile_id is null or p_target_profile_id = caller_id then
    raise exception 'Invalid target profile' using errcode = '22023';
  end if;

  select profile.* into target_profile
  from public.profiles as profile
  where profile.id = p_target_profile_id;
  if not found then
    raise exception 'Target profile not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(caller_id::text, p_target_profile_id::text)
      || ':' || greatest(caller_id::text, p_target_profile_id::text),
      0
    )
  );

  select chat.id into personal_chat_id
  from public.chats as chat
  where chat.type = 'personal'
    and exists (
      select 1 from public.chat_members as member
      where member.chat_id = chat.id and member.profile_id = caller_id
    )
    and exists (
      select 1 from public.chat_members as member
      where member.chat_id = chat.id and member.profile_id = p_target_profile_id
    )
    and (
      select count(*) from public.chat_members as member where member.chat_id = chat.id
    ) = 2
  order by chat.created_at
  limit 1;

  if personal_chat_id is not null then
    return personal_chat_id;
  end if;

  insert into public.chats (
    name, type, avatar, avatar_color, created_by
  ) values (
    coalesce(target_profile.display_name, target_profile.username, 'Пользователь'),
    'personal',
    coalesce(target_profile.avatar, '👤'),
    target_profile.avatar_color,
    caller_id
  ) returning id into personal_chat_id;

  insert into public.chat_members (chat_id, profile_id, role)
  values
    (personal_chat_id, caller_id, 'member'),
    (personal_chat_id, p_target_profile_id, 'member');

  return personal_chat_id;
end;
$$;

revoke execute on function public.ensure_personal_chat(uuid) from public, anon;
grant execute on function public.ensure_personal_chat(uuid) to authenticated;