import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { toISO } from './serviceUtils';

export const messageService = {
  loadChatMessages: async (chatId, limit = 30, beforeTimestamp = null) => {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (beforeTimestamp) {
        query = query.lt('created_at', toISO(beforeTimestamp));
      }

      const { data, error } = await query;
      if (error) throw error;

      const messageIds = (data || []).map(m => m.id);
      let reads = [];
      if (messageIds.length > 0) {
        const { data: readsData } = await supabase
          .from('message_reads')
          .select('message_id, profile_id')
          .in('message_id', messageIds);
        reads = readsData || [];
      }

      return (data || []).map(m => {
        const msgReads = reads.filter(r => r.message_id === m.id);
        return {
          id: m.id,
          senderId: m.sender_id,
          text: m.text,
          media: m.media,
          replyTo: m.reply_to,
          read: m.read || msgReads.length > 0,
          reads: msgReads.map(r => r.profile_id),
          reactions: m.reactions || [],
          timestamp: new Date(m.created_at)
        };
      }).reverse();
    }

    const saved = localStorage.getItem('tg-chats-mock');
    if (saved) {
      const chats = JSON.parse(saved);
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        const msgs = chat.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
        return msgs.slice(-limit);
      }
    }
    return [];
  },

  clearChatMessages: async (chatId) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);
      if (error) throw error;
    }
    return true;
  },

  sendMessage: async (chatId, senderId, text, replyToId, media, customId = null) => {
    const finalId = customId || crypto.randomUUID();
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          id: finalId,
          chat_id: chatId,
          sender_id: senderId,
          text: text,
          media: media,
          reply_to: replyToId
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    return {
      id: finalId,
      senderId,
      senderName: 'Вы',
      text: text,
      timestamp: new Date(),
      replyTo: replyToId,
      media: media,
      read: false,
      reactions: []
    };
  },

  deleteMessage: async (messageId) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
    }
  },

  /**
   * Toggle a reaction via atomic RPC (server merges per-user).
   * `emoji` is required for live mode; mock may pass precomputed arrays via legacy path.
   */
  toggleReaction: async (messageId, emojiOrReactions) => {
    if (isSupabaseConfigured) {
      const emoji = typeof emojiOrReactions === 'string'
        ? emojiOrReactions
        : null;
      if (!emoji) {
        throw new Error('toggleReaction requires an emoji string in live mode');
      }
      const { data, error } = await supabase.rpc('toggle_message_reaction', {
        p_message_id: messageId,
        p_emoji: emoji,
      });
      if (error) throw error;
      return data;
    }
    return emojiOrReactions;
  },

  markMessagesAsRead: async (chatId, userId) => {
    if (!isSupabaseConfigured) return;

    const { data, error } = await supabase.rpc('mark_chat_as_read', {
      p_chat_id: chatId,
    });
    if (error) throw error;
    return data;
  },
};
