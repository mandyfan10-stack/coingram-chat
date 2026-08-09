-- Dashboard fallback for projects where the migration role cannot manage the
-- locked realtime schema. Keep this equivalent to the canonical migration.

drop policy if exists "Messenger call topics can receive" on realtime.messages;
create policy "Messenger call topics can receive"
  on realtime.messages for select
  to authenticated
  using (
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

drop policy if exists "Messenger call topics can send" on realtime.messages;
create policy "Messenger call topics can send"
  on realtime.messages for insert
  to authenticated
  with check (
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
