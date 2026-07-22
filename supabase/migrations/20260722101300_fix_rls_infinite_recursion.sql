-- Fix 42P17 infinite recursion in chat_members and chats RLS policies

DROP FUNCTION IF EXISTS public.is_chat_member(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_chat_member(target_chat_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STRICT
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE chat_id = target_chat_id
      AND profile_id = target_profile_id
  );
$$
;

DROP POLICY IF EXISTS "chat_members_select_policy" ON public.chat_members;

CREATE POLICY "chat_members_select_policy" ON public.chat_members
FOR SELECT TO authenticated USING (
  profile_id = auth.uid()
  OR public.is_chat_member(chat_id, auth.uid())
);

DROP POLICY IF EXISTS "chats_select_policy" ON public.chats;

CREATE POLICY "chats_select_policy" ON public.chats
FOR SELECT TO authenticated USING (
  created_by = auth.uid()
  OR type = 'channel'
  OR public.is_chat_member(id, auth.uid())
);
