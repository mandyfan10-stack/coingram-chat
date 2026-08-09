import { isSupabaseConfigured, supabase } from '../supabaseClient.js';

/** Legacy positional API. New E2EE v2 code must never import this adapter. */
export const v1MessageCompatibilityAdapter = {
  async sendMessage(chatId, senderId, text, replyToId, media, customId = null) {
    const finalId = customId || crypto.randomUUID();
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('messages').insert({
        id: finalId,
        chat_id: chatId,
        sender_id: senderId,
        text,
        media,
        reply_to: replyToId
      }).select().single();
      if (error) throw error;
      return data;
    }
    return {
      id: finalId,
      senderId,
      senderName: 'Вы',
      text,
      timestamp: new Date(),
      replyTo: replyToId,
      media,
      read: false,
      reactions: []
    };
  }
};
