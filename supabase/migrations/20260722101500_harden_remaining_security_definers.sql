-- Harden remaining SECURITY DEFINER functions and remove broad sticker policies.

-- Trigger functions are invoked by their triggers, never through the Data API.
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.validate_message_update() set search_path = '';
revoke execute on function public.validate_message_update() from public, anon, authenticated;

-- This legacy helper has no policy, trigger, or client dependency.
alter function public.is_message_unmodified(uuid, uuid, uuid, text, text, uuid)
  set search_path = '';
revoke execute on function public.is_message_unmodified(uuid, uuid, uuid, text, text, uuid)
  from public, anon, authenticated;

-- Pinning RPCs enforce authorization internally and are only for signed-in users.
alter function public.pin_chat_message(uuid, uuid) set search_path = '';
revoke execute on function public.pin_chat_message(uuid, uuid) from public, anon;
grant execute on function public.pin_chat_message(uuid, uuid) to authenticated;

alter function public.unpin_chat_message(uuid) set search_path = '';
revoke execute on function public.unpin_chat_message(uuid) from public, anon;
grant execute on function public.unpin_chat_message(uuid) to authenticated;

-- The stickers bucket is public, so object delivery does not need a SELECT
-- policy. Imports use the service-role Edge Function, which bypasses RLS.
drop policy if exists "Sticker media is publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload sticker media" on storage.objects;
