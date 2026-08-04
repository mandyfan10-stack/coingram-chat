-- Atomic message reaction toggle (per-user merge) + optional lockdown so
-- reactions can only change via this RPC (session GUC coiny.reaction_rpc).

create or replace function public.toggle_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  msg_chat_id uuid;
  raw_reactions jsonb;
  items jsonb;
  item jsonb;
  emoji_text text;
  user_id_text text;
  users text[];
  found boolean := false;
  new_items jsonb := '[]'::jsonb;
  emoji_key text;
begin
  if actor is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  emoji_text := trim(coalesce(p_emoji, ''));
  if emoji_text = '' or char_length(emoji_text) > 16 then
    raise exception 'Invalid reaction emoji'
      using errcode = '22023';
  end if;

  if emoji_text ~ '[\x00-\x1F\x7F]' then
    raise exception 'Invalid reaction emoji'
      using errcode = '22023';
  end if;

  select messages.chat_id, messages.reactions
    into msg_chat_id, raw_reactions
  from public.messages
  where messages.id = p_message_id
  for update;

  if msg_chat_id is null then
    raise exception 'Message not found'
      using errcode = 'P0002';
  end if;

  if not private.is_chat_member(msg_chat_id, actor) then
    raise exception 'Not a chat member'
      using errcode = '42501';
  end if;

  user_id_text := actor::text;
  items := coalesce(raw_reactions, '[]'::jsonb);
  if jsonb_typeof(items) is distinct from 'array' then
    items := '[]'::jsonb;
  end if;

  for item in
    select value
    from jsonb_array_elements(items) as t(value)
  loop
    emoji_key := coalesce(item->>'emoji', '');

    if item ? 'users' and jsonb_typeof(item->'users') = 'array' then
      select coalesce(array_agg(u order by ord), array[]::text[])
        into users
      from jsonb_array_elements_text(item->'users') with ordinality as t(u, ord);
    elsif item ? 'userId' and nullif(item->>'userId', '') is not null then
      users := array[item->>'userId'];
    else
      users := array[]::text[];
    end if;

    if emoji_key = emoji_text then
      found := true;
      if user_id_text = any (users) then
        users := array_remove(users, user_id_text);
      else
        users := array_append(users, user_id_text);
      end if;

      if coalesce(cardinality(users), 0) > 0 then
        new_items := new_items || jsonb_build_array(
          jsonb_build_object(
            'emoji', emoji_key,
            'count', cardinality(users),
            'users', to_jsonb(users)
          )
        );
      end if;
    elsif coalesce(cardinality(users), 0) > 0 and emoji_key <> '' then
      new_items := new_items || jsonb_build_array(
        jsonb_build_object(
          'emoji', emoji_key,
          'count', cardinality(users),
          'users', to_jsonb(users)
        )
      );
    end if;
  end loop;

  if not found then
    new_items := new_items || jsonb_build_array(
      jsonb_build_object(
        'emoji', emoji_text,
        'count', 1,
        'users', to_jsonb(array[user_id_text])
      )
    );
  end if;

  -- Allow validate_message_update to accept this reactions write only.
  perform set_config('coiny.reaction_rpc', '1', true);

  update public.messages
  set reactions = new_items
  where id = p_message_id;

  return new_items;
end;
$function$;

revoke execute on function public.toggle_message_reaction(uuid, text)
  from public, anon;
grant execute on function public.toggle_message_reaction(uuid, text)
  to authenticated;

-- Lock direct client overwrites of reactions; only the RPC may change them.
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

  if new.reactions is distinct from old.reactions
     and current_setting('coiny.reaction_rpc', true) is distinct from '1' then
    raise exception 'Reactions may only be changed via toggle_message_reaction'
      using errcode = '42501';
  end if;

  if (select auth.uid()) is distinct from old.sender_id then
    -- Non-senders may: set read=true (receipts). Content remains sender-only.
    -- Reactions are handled above via RPC GUC.
    if new.text is distinct from old.text
       or new.media is distinct from old.media
       or new.reply_to is distinct from old.reply_to then
      raise exception 'Only the sender may edit message content'
        using errcode = '42501';
    end if;

    if new.read is distinct from old.read and new.read is not true then
      raise exception 'Only the sender may edit message content'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

revoke execute on function public.validate_message_update()
  from public, anon, authenticated;
