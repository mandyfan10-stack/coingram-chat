-- Legacy stories were stored in the private chat-attachments bucket.
-- Authenticated users may read an object only when it is referenced by a visible story.
alter policy "Chat members read referenced attachments"
on storage.objects
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
    or exists (
      select 1
      from public.stories
      where split_part(split_part(stories.media, 'chat-attachments/', 2), '?', 1) = storage.objects.name
    )
  )
);
