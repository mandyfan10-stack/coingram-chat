-- Add role column to chat_members
ALTER TABLE public.chat_members 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'member' CHECK (role IN ('member', 'admin'));

-- Update policy to allow chat owners to update member roles
DROP POLICY IF EXISTS "Владельцы чатов могут изменять роли участников" ON public.chat_members;
CREATE POLICY "Владельцы чатов могут изменять роли участников"
  ON public.chat_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = chat_members.chat_id AND chats.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = chat_members.chat_id AND chats.created_by = auth.uid()
    )
  );
