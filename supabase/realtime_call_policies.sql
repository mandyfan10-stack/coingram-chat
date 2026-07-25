-- Run with the Realtime policy editor/owner role in Supabase Dashboard.
-- The managed postgres role does not own realtime.messages.

drop policy if exists "Messenger call topics can receive" on realtime.messages;
create policy "Messenger call topics can receive"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) like 'call:chat:%'
    and public.is_chat_member(split_part((select realtime.topic()), ':', 3)::uuid, (select auth.uid()))
  );

drop policy if exists "Messenger call topics can send" on realtime.messages;
create policy "Messenger call topics can send"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) like 'call:chat:%'
    and public.is_chat_member(split_part((select realtime.topic()), ':', 3)::uuid, (select auth.uid()))
  );