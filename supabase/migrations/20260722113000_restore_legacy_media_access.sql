drop policy if exists "Chat members read referenced attachments" on storage.objects;

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
      or exists (
        select 1
        from public.messages
        where split_part(split_part(messages.media, 'chat-attachments/', 2), '?', 1) = storage.objects.name
          and public.is_chat_member(messages.chat_id, (select auth.uid()))
      )
      or exists (
        select 1
        from public.profiles
        where split_part(split_part(profiles.avatar, 'chat-attachments/', 2), '?', 1) = storage.objects.name
      )
    )
  );

insert into storage.buckets (id, name, public)
values ('public-media', 'public-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Users upload their own public media" on storage.objects;
create policy "Users upload their own public media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update their own public media" on storage.objects;
create policy "Users update their own public media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete their own public media" on storage.objects;
create policy "Users delete their own public media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );