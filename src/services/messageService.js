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

  toggleReaction: async (messageId, newReactions) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('messages')
        .update({ reactions: newReactions })
        .eq('id', messageId);
      if (error) throw error;
    }
  },

  markMessagesAsRead: async (chatId, userId) => {
    if (!isSupabaseConfigured) return;

    const { data: unreadMsgs, error: messagesError } = await supabase
      .from('messages')
      .select('id')
      .eq('chat_id', chatId)
      .neq('sender_id', userId);

    if (messagesError) throw messagesError;

    if (unreadMsgs && unreadMsgs.length > 0) {
      const ids = unreadMsgs.map((m) => m.id);
      const readRows = ids.map((id) => ({
        message_id: id,
        profile_id: userId
      }));

      const { error: readsError } = await supabase
        .from('message_reads')
        .upsert(readRows, {
          onConflict: 'message_id,profile_id',
          ignoreDuplicates: true
        });

      if (readsError) throw readsError;

      // Also flip messages.read so senders get a postgres UPDATE event.
      // message_reads INSERT realtime is flaky for some clients; UPDATE on
      // messages is already subscribed and drives the double blue check UI.
      const { error: flagError } = await supabase
        .from('messages')
        .update({ read: true })
        .in('id', ids)
        .eq('read', false);

      if (flagError) throw flagError;
    }
  }
};
