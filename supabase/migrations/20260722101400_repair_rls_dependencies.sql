-- Repair the policies removed by 20260722101300_fix_rls_infinite_recursion.sql.
--
-- The previous migration dropped public.is_chat_member(uuid, uuid) with
-- CASCADE, removing every RLS and Storage policy that referenced it. Keep both
-- membership helpers non-recursive, bind them to the authenticated user, and
-- recreate all dependent policies without another cascading drop.

create or replace function public.is_chat_member(
  target_chat_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile_id = (select auth.uid())
    and exists (
      select 1
      from public.chat_members
      where chat_members.chat_id = target_chat_id
        and chat_members.profile_id = target_profile_id
    );
$$;

revoke execute on function public.is_chat_member(uuid, uuid) from public, anon;
grant execute on function public.is_chat_member(uuid, uuid) to authenticated;

create or replace function public.is_chat_admin(
  chat_id uuid,
  user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select $2 = (select auth.uid())
    and exists (
      select 1
      from public.chat_members
      where chat_members.chat_id = $1
        and chat_members.profile_id = $2
        and chat_members.role = 'admin'
    );
$$;

revoke execute on function public.is_chat_admin(uuid, uuid) from public, anon;
grant execute on function public.is_chat_admin(uuid, uuid) to authenticated;

-- Chats ---------------------------------------------------------------------

drop policy if exists "chats_select_policy" on public.chats;
create policy "chats_select_policy"
  on public.chats for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or type = 'channel'
    or public.is_chat_member(id, (select auth.uid()))
  );

drop policy if exists "chats_update_policy" on public.chats;
create policy "chats_update_policy"
  on public.chats for update
  to authenticated
  using (
    created_by = (select auth.uid())
    or public.is_chat_admin(id, (select auth.uid()))
    or (
      type = 'personal'
      and public.is_chat_member(id, (select auth.uid()))
    )
  )
  with check (
    created_by = (select auth.uid())
    or public.is_chat_admin(id, (select auth.uid()))
    or (
      type = 'personal'
      and public.is_chat_member(id, (select auth.uid()))
    )
  );

drop policy if exists "chats_delete_policy" on public.chats;
create policy "chats_delete_policy"
  on public.chats for delete
  to authenticated
  using (
    created_by = (select auth.uid())
    or (
      type = 'personal'
      and public.is_chat_member(id, (select auth.uid()))
    )
  );

-- Chat members ---------------------------------------------------------------

drop policy if exists "chat_members_select_policy" on public.chat_members;
create policy "chat_members_select_policy"
  on public.chat_members for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_chat_member(chat_id, (select auth.uid()))
  );

drop policy if exists "chat_members_insert_policy" on public.chat_members;
create policy "chat_members_insert_policy"
  on public.chat_members for insert
  to authenticated
  with check (
    (
      profile_id = (select auth.uid())
      and exists (
        select 1
        from public.chats
        where chats.id = chat_members.chat_id
          and (
            chats.type = 'channel'
            or (chats.type = 'group' and chats.username is not null)
          )
      )
    )
    or exists (
      select 1
      from public.chats
      where chats.id = chat_members.chat_id
        and (
          chats.created_by = (select auth.uid())
          or public.is_chat_admin(chat_members.chat_id, (select auth.uid()))
        )
    )
    or (
      public.is_chat_member(chat_id, (select auth.uid()))
      and exists (
        select 1
        from public.chats
        where chats.id = chat_members.chat_id
          and chats.type = 'group'
          and coalesce((chats.settings ->> 'allow_add_members')::boolean, true)
      )
    )
  );

-- Messages ------------------------------------------------------------------

drop policy if exists "messages_select_policy" on public.messages;
create policy "messages_select_policy"
  on public.messages for select
  to authenticated
  using (
    public.is_chat_member(chat_id, (select auth.uid()))
    or exists (
      select 1
      from public.chats
      where chats.id = messages.chat_id
        and chats.type = 'channel'
        and chats.username is not null
    )
  );

drop policy if exists "messages_insert_policy" on public.messages;
create policy "messages_insert_policy"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      public.is_chat_member(chat_id, (select auth.uid()))
      or exists (
        select 1
        from public.chats
        where chats.id = messages.chat_id
          and chats.type = 'channel'
          and (
            chats.created_by = (select auth.uid())
            or public.is_chat_admin(chat_id, (select auth.uid()))
          )
      )
    )
  );

drop policy if exists "messages_update_policy" on public.messages;
create policy "messages_update_policy"
  on public.messages for update
  to authenticated
  using (public.is_chat_member(chat_id, (select auth.uid())))
  with check (public.is_chat_member(chat_id, (select auth.uid())));

-- Message reads --------------------------------------------------------------

drop policy if exists "message_reads_select_policy" on public.message_reads;
create policy "message_reads_select_policy"
  on public.message_reads for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages
      where messages.id = message_reads.message_id
        and public.is_chat_member(messages.chat_id, (select auth.uid()))
    )
  );

drop policy if exists "message_reads_insert_policy" on public.message_reads;
create policy "message_reads_insert_policy"
  on public.message_reads for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1
      from public.messages
      where messages.id = message_reads.message_id
        and public.is_chat_member(messages.chat_id, (select auth.uid()))
    )
  );

-- Private encrypted chat attachments ----------------------------------------

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists "Allow authenticated insert to chat-attachments" on storage.objects;
drop policy if exists "Allow authenticated select from chat-attachments" on storage.objects;
drop policy if exists "Users upload their own chat attachments" on storage.objects;
drop policy if exists "Chat members read referenced attachments" on storage.objects;
drop policy if exists "Users update their own chat attachments" on storage.objects;
drop policy if exists "Users delete their own chat attachments" on storage.objects;

create policy "Users upload their own chat attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_chat_member(
      ((storage.foldername(name))[1])::uuid,
      (select auth.uid())
    )
  );

create policy "Chat members read referenced attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_chat_member(
        ((storage.foldername(name))[1])::uuid,
        (select auth.uid())
      )
    )
  );

create policy "Users update their own chat attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_chat_member(
      ((storage.foldername(name))[1])::uuid,
      (select auth.uid())
    )
  );

create policy "Users delete their own chat attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (storage.foldername(name))[2] = (select auth.uid())::text
    )
  );
