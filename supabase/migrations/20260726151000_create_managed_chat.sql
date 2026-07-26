create or replace function public.create_managed_chat(
  p_name text,
  p_type text,
  p_member_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_name text := btrim(coalesce(p_name, ''));
  new_chat_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_type not in ('group', 'channel') then
    raise exception 'Unsupported chat type' using errcode = '22023';
  end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 100 then
    raise exception 'Chat name must contain 1 to 100 characters' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_member_ids), 0) > 200 then
    raise exception 'Too many initial members' using errcode = '22023';
  end if;

  insert into public.chats (
    name, type, avatar, avatar_color, created_by, settings
  ) values (
    clean_name,
    p_type,
    case when p_type = 'channel' then '📢' else '👥' end,
    case when p_type = 'channel'
      then 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)'
      else 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)'
    end,
    caller_id,
    jsonb_build_object(
      'only_admins_can_post', p_type = 'channel',
      'allow_media', true,
      'allow_add_members', true,
      'allow_pin_messages', true
    )
  ) returning id into new_chat_id;

  insert into public.chat_members (chat_id, profile_id, role)
  select new_chat_id, member_id,
    case when member_id = caller_id then 'admin' else 'member' end
  from (
    select distinct unnest(array_append(coalesce(p_member_ids, '{}'::uuid[]), caller_id)) as member_id
  ) members
  where member_id is not null;

  return new_chat_id;
end;
$$;

revoke execute on function public.create_managed_chat(text, text, uuid[])
  from public, anon;
grant execute on function public.create_managed_chat(text, text, uuid[])
  to authenticated;