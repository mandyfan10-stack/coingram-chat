-- Demo bots (echo / quiz / weather) exist only in client mock mode.
-- They were seeded into production profiles via supabase_schema.sql and
-- appear in global search / personal chats, but never reply when live.
-- Remove those profiles and any personal chats that still reference them.

do $$
declare
  bot_ids uuid[];
begin
  select coalesce(array_agg(id), array[]::uuid[])
  into bot_ids
  from public.profiles
  where id in (
      '00000000-0000-0000-0000-000000000003'::uuid,
      '00000000-0000-0000-0000-000000000004'::uuid,
      '00000000-0000-0000-0000-000000000005'::uuid
    )
    or username in ('echo_bot', 'quiz_bot', 'weather_bot');

  if cardinality(bot_ids) = 0 then
    raise notice 'No mock demo bot profiles found — nothing to delete.';
    return;
  end if;

  -- Drop personal chats that include a bot member (messages/members cascade).
  delete from public.chats c
  where c.type = 'personal'
    and exists (
      select 1
      from public.chat_members cm
      where cm.chat_id = c.id
        and cm.profile_id = any (bot_ids)
    );

  -- Any remaining memberships / messages from bots in other chat types.
  delete from public.chat_members
  where profile_id = any (bot_ids);

  delete from public.messages
  where sender_id = any (bot_ids);

  delete from public.profiles
  where id = any (bot_ids);

  raise notice 'Removed % mock demo bot profile(s).', cardinality(bot_ids);
end $$;
