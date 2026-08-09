-- Add covering indexes for foreign keys and optimize owner-based RLS checks.

create index if not exists chat_members_profile_id_idx
  on public.chat_members (profile_id);

create index if not exists chats_created_by_idx
  on public.chats (created_by);

-- The live project already had this field when the original optimization was
-- captured, but the historical bootstrap did not. Restore the schema contract
-- before creating its index or the later pin/unpin RPCs.
alter table public.chats
  add column if not exists pinned_message_id uuid;

do $block$
begin
  if not exists (
    select 1
    from pg_constraint constraint_record
    join pg_attribute column_record
      on column_record.attrelid = constraint_record.conrelid
      and column_record.attnum = any(constraint_record.conkey)
    where constraint_record.conrelid = 'public.chats'::regclass
      and constraint_record.contype = 'f'
      and constraint_record.confrelid = 'public.messages'::regclass
      and column_record.attname = 'pinned_message_id'
  ) then
    alter table public.chats
      add constraint chats_pinned_message_id_fkey
      foreign key (pinned_message_id)
      references public.messages(id)
      on delete set null;
  end if;
end;
$block$;

create index if not exists chats_pinned_message_id_idx
  on public.chats (pinned_message_id);

create index if not exists message_reads_profile_id_idx
  on public.message_reads (profile_id);

create index if not exists messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at desc);

create index if not exists messages_reply_to_idx
  on public.messages (reply_to);

create index if not exists messages_sender_id_idx
  on public.messages (sender_id);

create index if not exists stickers_pack_id_created_at_idx
  on public.stickers (pack_id, created_at);

create index if not exists stories_user_id_idx
  on public.stories (user_id);

create index if not exists user_sticker_packs_pack_id_idx
  on public.user_sticker_packs (pack_id);

-- Cache auth.uid() once per statement instead of evaluating it for every row.
-- Policy names differ between the historical bootstrap and older live
-- deployments, so target the unique table/command contracts instead of names.
do $block$
declare
  policy_record record;
begin
  for policy_record in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and (tablename, cmd) in (
        ('stories', 'INSERT'),
        ('stories', 'DELETE'),
        ('user_sticker_packs', 'SELECT'),
        ('user_sticker_packs', 'INSERT'),
        ('user_sticker_packs', 'DELETE'),
        ('chat_members', 'DELETE'),
        ('messages', 'DELETE'),
        ('profiles', 'UPDATE'),
        ('chats', 'INSERT')
      )
  loop
    if policy_record.tablename = 'stories' and policy_record.cmd = 'INSERT' then
      execute format('alter policy %I on public.stories with check ((select auth.uid()) = user_id)', policy_record.policyname);
    elsif policy_record.tablename = 'stories' and policy_record.cmd = 'DELETE' then
      execute format('alter policy %I on public.stories using ((select auth.uid()) = user_id)', policy_record.policyname);
    elsif policy_record.tablename = 'user_sticker_packs' and policy_record.cmd = 'SELECT' then
      execute format('alter policy %I on public.user_sticker_packs using ((select auth.uid()) = user_id)', policy_record.policyname);
    elsif policy_record.tablename = 'user_sticker_packs' and policy_record.cmd = 'INSERT' then
      execute format('alter policy %I on public.user_sticker_packs with check ((select auth.uid()) = user_id)', policy_record.policyname);
    elsif policy_record.tablename = 'user_sticker_packs' and policy_record.cmd = 'DELETE' then
      execute format('alter policy %I on public.user_sticker_packs using ((select auth.uid()) = user_id)', policy_record.policyname);
    elsif policy_record.tablename = 'chat_members' and policy_record.cmd = 'DELETE' then
      execute format('alter policy %I on public.chat_members using ((select auth.uid()) = profile_id)', policy_record.policyname);
    elsif policy_record.tablename = 'messages' and policy_record.cmd = 'DELETE' then
      execute format('alter policy %I on public.messages using ((select auth.uid()) = sender_id)', policy_record.policyname);
    elsif policy_record.tablename = 'profiles' and policy_record.cmd = 'UPDATE' then
      execute format('alter policy %I on public.profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id)', policy_record.policyname);
    elsif policy_record.tablename = 'chats' and policy_record.cmd = 'INSERT' then
      execute format('alter policy %I on public.chats with check ((select auth.uid()) = created_by)', policy_record.policyname);
    end if;
  end loop;
end;
$block$;

-- Normalize private-key policies because the live project contains truncated
-- legacy names and lacks ownership-preserving UPDATE/DELETE checks.

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_private_keys'
  loop
    execute format(
      'drop policy %I on public.user_private_keys',
      existing_policy.policyname
    );
  end loop;
end
$$;

create policy "user_private_keys_select_policy"
  on public.user_private_keys for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "user_private_keys_insert_policy"
  on public.user_private_keys for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "user_private_keys_update_policy"
  on public.user_private_keys for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "user_private_keys_delete_policy"
  on public.user_private_keys for delete
  to authenticated
  using ((select auth.uid()) = id);
