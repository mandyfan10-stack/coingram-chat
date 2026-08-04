-- Server-side mark-chat-as-read: insert missing receipts and flip messages.read
-- without shipping every message id to the client.

create index if not exists messages_chat_id_sender_id_idx
  on public.messages (chat_id, sender_id);

create or replace function public.mark_chat_as_read(p_chat_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  inserted_count integer := 0;
begin
  if actor is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if p_chat_id is null then
    raise exception 'chat_id is required'
      using errcode = '22023';
  end if;

  if not private.is_chat_member(p_chat_id, actor) then
    raise exception 'Not a chat member'
      using errcode = '42501';
  end if;

  -- New receipts for other people's messages the actor has not yet marked.
  with candidates as (
    select m.id as message_id
    from public.messages as m
    where m.chat_id = p_chat_id
      and m.sender_id is distinct from actor
      and not exists (
        select 1
        from public.message_reads as r
        where r.message_id = m.id
          and r.profile_id = actor
      )
  ),
  inserted as (
    insert into public.message_reads (message_id, profile_id)
    select c.message_id, actor
    from candidates as c
    on conflict (message_id, profile_id) do nothing
    returning 1
  )
  select count(*)::integer into inserted_count from inserted;

  -- Denormalized flag for sender blue-check UI + messages UPDATE realtime.
  -- Same semantics as the previous client-side bulk update.
  update public.messages as m
  set read = true
  where m.chat_id = p_chat_id
    and m.sender_id is distinct from actor
    and m.read is distinct from true;

  return inserted_count;
end;
$function$;

revoke execute on function public.mark_chat_as_read(uuid)
  from public, anon;
grant execute on function public.mark_chat_as_read(uuid)
  to authenticated;
