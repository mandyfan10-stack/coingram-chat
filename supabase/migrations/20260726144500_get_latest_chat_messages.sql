create or replace function public.get_latest_chat_messages(p_chat_ids uuid[])
returns table (
  id uuid,
  chat_id uuid,
  sender_id uuid,
  text text,
  media text,
  reply_to uuid,
  legacy_read boolean,
  reactions jsonb,
  created_at timestamptz,
  read_by uuid[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    latest.id,
    latest.chat_id,
    latest.sender_id,
    latest.text,
    latest.media,
    latest.reply_to,
    latest.read as legacy_read,
    latest.reactions,
    latest.created_at,
    coalesce(
      array(
        select receipt.profile_id
        from public.message_reads as receipt
        where receipt.message_id = latest.id
        order by receipt.read_at, receipt.profile_id
      ),
      '{}'::uuid[]
    ) as read_by
  from (
    select distinct on (message.chat_id)
      message.id,
      message.chat_id,
      message.sender_id,
      message.text,
      message.media,
      message.reply_to,
      message.read,
      message.reactions,
      message.created_at
    from public.messages as message
    where message.chat_id = any(coalesce(p_chat_ids, '{}'::uuid[]))
    order by message.chat_id, message.created_at desc, message.id desc
  ) as latest;
$$;

revoke execute on function public.get_latest_chat_messages(uuid[])
  from public, anon;
grant execute on function public.get_latest_chat_messages(uuid[])
  to authenticated;