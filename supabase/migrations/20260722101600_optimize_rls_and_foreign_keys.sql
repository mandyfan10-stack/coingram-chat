-- Add covering indexes for foreign keys and optimize owner-based RLS checks.

create index if not exists chat_members_profile_id_idx
  on public.chat_members (profile_id);

create index if not exists chats_created_by_idx
  on public.chats (created_by);

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

alter policy "Users can insert their own stories"
  on public.stories
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete their own stories"
  on public.stories
  using ((select auth.uid()) = user_id);

alter policy "Users can view their own installed packs"
  on public.user_sticker_packs
  using ((select auth.uid()) = user_id);

alter policy "Users can add/delete their own installed packs"
  on public.user_sticker_packs
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete their own installed packs"
  on public.user_sticker_packs
  using ((select auth.uid()) = user_id);

alter policy "chat_members_delete_policy"
  on public.chat_members
  using ((select auth.uid()) = profile_id);

alter policy "messages_delete_policy"
  on public.messages
  using ((select auth.uid()) = sender_id);

alter policy "profiles_update_policy"
  on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "chats_insert_policy"
  on public.chats
  with check ((select auth.uid()) = created_by);

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
