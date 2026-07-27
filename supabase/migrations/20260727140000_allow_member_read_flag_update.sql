-- Allow any chat member to mark messages as read (flip messages.read -> true).
-- Content fields remain sender-only. This powers read-receipt UI via the
-- existing messages UPDATE realtime subscription.

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

  if (select auth.uid()) is distinct from old.sender_id then
    -- Non-senders may: set read=true (receipts) and update reactions.
    -- They may not change message content.
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
