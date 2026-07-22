import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { getOfflineAttachment, deleteOfflineAttachment } from '../utils/indexedDbHelper';

// Helper to convert date to ISO string safely
const toISO = (date) => (date instanceof Date ? date.toISOString() : date);

export const dataService = {
  isLive: () => isSupabaseConfigured,

  // 1. Auth Operations
  signUp: async (username, password, displayName) => {
    if (isSupabaseConfigured) {
      const email = `${username}@tg-clone.com`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            display_name: displayName
          }
        }
      });
      if (error) return { error };
      return { data: { id: data.user.id, name: displayName, username } };
    } else {
      const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
      if (mockUsers.some(u => u.username === username)) {
        return { error: new Error('Данное имя пользователя уже занято!') };
      }
      const newUser = {
        id: `user-mock-${Date.now()}`,
        username,
        name: displayName,
        avatarColor: 'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
        bio: '',
        theme: 'telegram-blue',
        wallpaper: 'classic',
        avatar: '🪙'
      };
      mockUsers.push({ ...newUser, password });
      localStorage.setItem('tg-mock-users', JSON.stringify(mockUsers));
      return { data: newUser };
    }
  },

  signIn: async (username, password) => {
    if (isSupabaseConfigured) {
      const email = `${username}@tg-clone.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) return { error };
      return { data: { id: data.user.id } };
    } else {
      let mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
      let user = mockUsers.find(u => u.username === username && u.password === password);
      
      if (!user) {
        const newUser = {
          id: `user-mock-${Date.now()}`,
          username,
          name: username,
          password: password,
          avatarColor: 'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
          bio: '',
          theme: 'telegram-blue',
          wallpaper: 'classic',
          avatar: '🪙'
        };
        mockUsers.push(newUser);
        localStorage.setItem('tg-mock-users', JSON.stringify(mockUsers));
        user = newUser;
      }
      
      const { password: _, ...cleanUser } = user;
      localStorage.setItem('tg-user-mock', JSON.stringify(cleanUser));
      return { data: cleanUser };
    }
  },

  signOut: async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('tg-user-mock');
    }
  },

  // 2. Profile Operations
  fetchProfile: async (userId) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    } else {
      const savedUser = localStorage.getItem('tg-user-mock');
      return savedUser ? JSON.parse(savedUser) : null;
    }
  },

  updateProfile: async (userId, fields) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: fields.name,
          bio: fields.bio,
          avatar_color: fields.avatarColor,
          theme: fields.theme,
          wallpaper: fields.wallpaper,
          avatar: fields.avatar
        })
        .eq('id', userId);
      if (error) throw error;
    } else {
      const savedUser = localStorage.getItem('tg-user-mock');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        const updated = { ...parsed, ...fields };
        localStorage.setItem('tg-user-mock', JSON.stringify(updated));
        
        const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
        const idx = mockUsers.findIndex(u => u.username === parsed.username);
        if (idx !== -1) {
          mockUsers[idx] = { ...mockUsers[idx], ...fields };
          localStorage.setItem('tg-mock-users', JSON.stringify(mockUsers));
        }
      }
    }
  },

  // 3. E2EE Key Backup Operations
  saveE2EEBackup: async (userId, encryptedPrivKeyStr) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('user_private_keys')
        .upsert({ id: userId, encrypted_private_key: encryptedPrivKeyStr });
      if (error) throw error;
    } else {
      localStorage.setItem(`coingram-backup-privkey-${userId}`, encryptedPrivKeyStr);
    }
  },

  getE2EEBackup: async (userId) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('user_private_keys')
        .select('encrypted_private_key')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ? data.encrypted_private_key : null;
    } else {
      return localStorage.getItem(`coingram-backup-privkey-${userId}`);
    }
  },

  deleteE2EEBackup: async (userId) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('user_private_keys')
        .delete()
        .eq('id', userId);
      if (error) throw error;
    } else {
      localStorage.removeItem(`coingram-backup-privkey-${userId}`);
    }
  },

  // 4. Chat Management
  fetchChats: async (userId) => {
    if (isSupabaseConfigured) {
      // 1. Query all chats accessible via Supabase RLS (includes member chats + public channels/groups)
      let { data: rawChats, error: chatErr } = await supabase
        .from('chats')
        .select('*');

      if (chatErr) throw chatErr;
      if (!rawChats) rawChats = [];

      // 2. Ensure "Избранное" (Saved Messages) exists for userId in Supabase
      const hasSaved = rawChats.some(c => c.name === 'Избранное' && (c.created_by === userId || c.type === 'personal'));
      if (!hasSaved) {
        try {
          const { data: newSaved } = await supabase
            .from('chats')
            .insert({
              name: 'Избранное',
              type: 'personal',
              avatar: '🔖',
              avatar_color: 'linear-gradient(135deg, #3a7bd5 0%, #3a6073 100%)',
              created_by: userId
            })
            .select()
            .single();

          if (newSaved) {
            await supabase.from('chat_members').insert({
              chat_id: newSaved.id,
              profile_id: userId,
              role: 'owner'
            });
            await supabase.from('messages').insert({
              chat_id: newSaved.id,
              sender_id: userId,
              text: 'Добро пожаловать в Избранное! 🔖 Сохраняйте здесь нужные сообщения и файлы.'
            });
            rawChats.unshift(newSaved);
          }
        } catch (e) {
          console.warn("Failed to auto-create Saved Messages:", e);
        }
      }

      // 3. Fetch user memberships
      let { data: memberships } = await supabase
        .from('chat_members')
        .select('chat_id, notifications, pinned')
        .eq('profile_id', userId);

      const memberChatIds = new Set((memberships || []).map(m => m.chat_id));

      // 4. Auto-join user to public channels/groups if not already in chat_members
      for (const chat of rawChats) {
        if (!memberChatIds.has(chat.id) && (chat.type === 'channel' || chat.type === 'group')) {
          try {
            await supabase.from('chat_members').insert({
              chat_id: chat.id,
              profile_id: userId,
              role: 'member'
            });
            memberChatIds.add(chat.id);
          } catch (e) {
            console.warn("Failed to auto-join public chat:", e);
          }
        }
      }

      const chatList = rawChats;
      const chatIds = chatList.map(c => c.id);

      if (chatIds.length === 0) return [];

      // Fetch all members for these chats in one query
      const { data: allMembersRaw } = await supabase
        .from('chat_members')
        .select('chat_id, profile_id, role, profiles(display_name, username, avatar, avatar_color, bio, last_seen, public_key, has_e2ee)')
        .in('chat_id', chatIds);

      // Fetch latest messages efficiently using a batched Promise.all
      const latestMsgPromises = chatIds.map(id =>
        supabase
          .from('messages')
          .select('*')
          .eq('chat_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
      );
      const latestMsgResponses = await Promise.all(latestMsgPromises);
      const latestMessagesMap = {};
      latestMsgResponses.forEach((res, idx) => {
        if (res.data && res.data.length > 0) {
          latestMessagesMap[chatIds[idx]] = res.data[0];
        }
      });

      return (chatList || []).map((chat) => {
        const membersRaw = (allMembersRaw || []).filter(m => m.chat_id === chat.id);
        const membership = (memberships || []).find(m => m.chat_id === chat.id);

        const formattedMembers = membersRaw.map(m => ({
          id: m.profile_id,
          name: m.profiles?.display_name || m.profiles?.username || 'Пользователь',
          username: m.profiles?.username || '',
          avatar: m.profiles?.avatar || '👤',
          avatarColor: m.profiles?.avatar_color || '#ccc',
          bio: m.profiles?.bio || '',
          role: m.role || 'member',
          lastSeen: m.profiles?.last_seen || null,
          publicKey: m.profiles?.public_key || null,
          hasE2ee: m.profiles?.has_e2ee || false
        }));

        const otherMember = chat.type === 'personal'
          ? formattedMembers.find(m => m.id !== userId)
          : null;

        const latestMsg = latestMessagesMap[chat.id] || null;
        let messages = [];
        if (latestMsg) {
          messages = [{
            id: latestMsg.id,
            senderId: latestMsg.sender_id,
            senderName: formattedMembers.find(member => member.id === latestMsg.sender_id)?.name || 'Пользователь',
            text: latestMsg.text,
            media: latestMsg.media,
            replyTo: latestMsg.reply_to,
            read: latestMsg.read,
            reactions: latestMsg.reactions || [],
            timestamp: new Date(latestMsg.created_at)
          }];
        }

        const defaultSettings = {
          only_admins_can_post: chat.type === 'channel',
          allow_media: true,
          allow_add_members: true,
          allow_pin_messages: true
        };

        return {
          id: chat.id,
          name: otherMember ? otherMember.name : chat.name,
          type: chat.type,
          avatar: otherMember ? otherMember.avatar : chat.avatar,
          avatarColor: otherMember ? otherMember.avatarColor : chat.avatar_color,
          bio: otherMember ? otherMember.bio : chat.bio,
          username: otherMember ? otherMember.username : chat.username,
          createdBy: chat.created_by,
          pinned: membership?.pinned || false,
          notifications: membership?.notifications ?? true,
          members: formattedMembers,
          settings: chat.settings ? { ...defaultSettings, ...chat.settings } : defaultSettings,
          lastSeen: otherMember ? otherMember.lastSeen : null,
          messages
        };
      });
    } else {
      // Mock mode
      const saved = localStorage.getItem('tg-chats-mock');
      let chats = saved ? JSON.parse(saved) : [];
      
      if (!chats || chats.length === 0) {
        chats = [
          {
            id: 'mock-saved-messages',
            name: 'Saved Messages 🔖',
            type: 'personal',
            avatar: '🔖',
            avatarColor: '#5a9ae6',
            bio: 'Ваши сохраненные сообщения',
            username: 'saved_messages',
            createdBy: 'system',
            pinned: true,
            notifications: false,
            members: [],
            settings: { only_admins_can_post: false, allow_media: true, allow_add_members: false, allow_pin_messages: true },
            lastSeen: null,
            messages: []
          },
          {
            id: 'mock-echo-bot',
            name: 'Echo Bot 🤖',
            type: 'personal',
            avatar: '🤖',
            avatarColor: '#6cc452',
            bio: 'Я эхо-бот. Отправь мне сообщение.',
            username: 'echo_bot',
            createdBy: 'system',
            pinned: false,
            notifications: true,
            members: [],
            settings: { only_admins_can_post: false, allow_media: true, allow_add_members: false, allow_pin_messages: true },
            lastSeen: null,
            messages: []
          },
          {
            id: 'mock-quiz-bot',
            name: 'Quiz Master 🧠',
            type: 'personal',
            avatar: '🧠',
            avatarColor: '#e6905a',
            bio: 'Отвечай на вопросы.',
            username: 'quiz_bot',
            createdBy: 'system',
            pinned: false,
            notifications: true,
            members: [],
            settings: { only_admins_can_post: false, allow_media: true, allow_add_members: false, allow_pin_messages: true },
            lastSeen: null,
            messages: []
          },
          {
            id: 'mock-weather-bot',
            name: 'Weather Bot 🌤️',
            type: 'personal',
            avatar: '🌤️',
            avatarColor: '#5ad8e6',
            bio: 'Узнай погоду.',
            username: 'weather_bot',
            createdBy: 'system',
            pinned: false,
            notifications: true,
            members: [],
            settings: { only_admins_can_post: false, allow_media: true, allow_add_members: false, allow_pin_messages: true },
            lastSeen: null,
            messages: []
          },
          {
            id: 'mock-coingram-news',
            name: 'CoinGram News 🚀',
            type: 'channel',
            avatar: '🚀',
            avatarColor: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
            bio: 'Официальные новости.',
            username: 'coingram_news',
            createdBy: 'system',
            pinned: false,
            notifications: true,
            members: [],
            settings: { only_admins_can_post: true, allow_media: true, allow_add_members: true, allow_pin_messages: true },
            lastSeen: null,
            messages: [{ id: 'msg-news-1', senderId: 'system', senderName: 'CoinGram News 🚀', text: 'Добро пожаловать в CoinGram!', timestamp: new Date().toISOString(), read: true, reactions: [] }]
          },
          {
            id: 'mock-coingram-community',
            name: 'CoinGram Community 👥',
            type: 'group',
            avatar: '👥',
            avatarColor: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
            bio: 'Общение пользователей.',
            username: '',
            createdBy: 'system',
            pinned: false,
            notifications: true,
            members: [],
            settings: { only_admins_can_post: false, allow_media: true, allow_add_members: true, allow_pin_messages: true },
            lastSeen: null,
            messages: []
          }
        ];
        localStorage.setItem('tg-chats-mock', JSON.stringify(chats));
      }
      
      try {
        return chats.map(chat => ({
          ...chat,
          messages: chat.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
      } catch (e) {
        return [];
      }
    }
  },

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
      
      // Fetch reads for these messages
      const messageIds = (data || []).map(m => m.id);
      let reads = [];
      if (messageIds.length > 0) {
        const { data: readsData } = await supabase
          .from('message_reads')
          .select('message_id, profile_id')
          .in('message_id', messageIds);
        reads = readsData || [];
      }

      // Format messages in ascending order (older first for UI chat area)
      return (data || []).map(m => {
        const msgReads = reads.filter(r => r.message_id === m.id);
        return {
          id: m.id,
          senderId: m.sender_id,
          text: m.text,
          media: m.media,
          replyTo: m.reply_to,
          read: m.read || msgReads.length > 0, // Fallback to legacy read or check message_reads
          reads: msgReads.map(r => r.profile_id),
          reactions: m.reactions || [],
          timestamp: new Date(m.created_at)
        };
      }).reverse();
    } else {
      // Mock Mode: already loaded locally, just slice them
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
    }
  },

  createChat: async (userId, target, type, initialMembers = []) => {
    if (isSupabaseConfigured) {
      if (type === 'personal') {
        const cleanTarget = target.trim().toLowerCase();
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', cleanTarget)
          .single();

        if (error || !profile) {
          throw new Error(`Пользователь с никнеймом "${target}" не найден.`);
        }
        if (profile.id === userId) {
          throw new Error("Вы не можете создать чат с самим собой.");
        }

        const { data: newChat, error: chatErr } = await supabase
          .from('chats')
          .insert({
            name: profile.display_name || profile.username,
            type: 'personal',
            avatar: profile.avatar || '👤',
            avatar_color: profile.avatar_color,
            created_by: userId
          })
          .select()
          .single();

        if (chatErr) throw chatErr;

        const { error: membersErr } = await supabase
          .from('chat_members')
          .insert([
            { chat_id: newChat.id, profile_id: userId },
            { chat_id: newChat.id, profile_id: profile.id }
          ]);

        if (membersErr) throw membersErr;
        return newChat;
      } else {
        const { data: newChat, error: chatErr } = await supabase
          .from('chats')
          .insert({
            name: target,
            type: type,
            avatar: type === 'channel' ? '📢' : '👥',
            avatar_color: type === 'channel' ? 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' : 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
            created_by: userId,
            settings: {
              only_admins_can_post: type === 'channel',
              allow_media: true,
              allow_add_members: true,
              allow_pin_messages: true
            }
          })
          .select()
          .single();

        if (chatErr) throw chatErr;

        const memberRows = [{ chat_id: newChat.id, profile_id: userId }];
        if (Array.isArray(initialMembers)) {
          for (const m of initialMembers) {
            const profileId = typeof m === 'object' ? m.id : m;
            if (profileId && profileId !== userId) {
              if (!memberRows.some(row => row.profile_id === profileId)) {
                memberRows.push({ chat_id: newChat.id, profile_id: profileId });
              }
            }
          }
        }

        const { error: memberErr } = await supabase
          .from('chat_members')
          .insert(memberRows);

        if (memberErr) throw memberErr;
        return newChat;
      }
    } else {
      // Mock mode create
      const isGroup = type === 'group';
      const isChannel = type === 'channel';
      const name = target;
      
      const memberObjects = [{ id: userId, name: 'Вы', avatar: '🪙' }];
      if (Array.isArray(initialMembers)) {
        for (const m of initialMembers) {
          const memberId = typeof m === 'object' ? m.id : m;
          const memberName = typeof m === 'object' ? (m.display_name || m.username || m.name) : `User-${m}`;
          const memberAvatar = typeof m === 'object' ? (m.avatar || '👤') : '👤';
          if (memberId && memberId !== userId && !memberObjects.some(mo => mo.id === memberId)) {
            memberObjects.push({ id: memberId, name: memberName, avatar: memberAvatar });
          }
        }
      }

      const newChat = {
        id: `chat-mock-${Date.now()}`,
        name: name,
        type: type,
        avatar: isChannel ? '📢' : (isGroup ? '👥' : '👤'),
        avatarColor: isChannel ? 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' : 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
        pinned: false,
        notifications: true,
        bio: isChannel ? 'Новый канал' : (isGroup ? 'Новая группа' : 'Новый контакт'),
        createdBy: userId,
        settings: {
          only_admins_can_post: isChannel,
          allow_media: true,
          allow_add_members: true,
          allow_pin_messages: true
        },
        members: memberObjects,
        messages: []
      };
      return newChat;
    }
  },

  deleteChat: async (userId, chatId, chatType, createdBy) => {
    if (isSupabaseConfigured) {
      const isCreator = createdBy === userId;
      const isPersonal = chatType === 'personal';

      if (isPersonal || isCreator) {
        const { error } = await supabase
          .from('chats')
          .delete()
          .eq('id', chatId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('chat_members')
          .delete()
          .eq('chat_id', chatId)
          .eq('profile_id', userId);
        if (error) throw error;
      }
      return true;
    } else {
      return true;
    }
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
    } else {
      const newMessage = {
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
      return newMessage;
    }
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
    if (isSupabaseConfigured) {
      // 1. Fetch unread messages in the chat not sent by current user
      const { data: unreadMsgs, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chatId)
        .neq('sender_id', userId);

      if (messagesError) throw messagesError;

      if (unreadMsgs && unreadMsgs.length > 0) {
        const readRows = unreadMsgs.map(m => ({
          message_id: m.id,
          profile_id: userId
        }));

        // Upsert makes repeated read receipts idempotent and avoids 409 conflicts.
        const { error: readsError } = await supabase
          .from('message_reads')
          .upsert(readRows, {
            onConflict: 'message_id,profile_id',
            ignoreDuplicates: true
          });

        if (readsError) throw readsError;
      }
    }
  },

  addMemberToChat: async (chatId, username) => {
    if (isSupabaseConfigured) {
      const cleanUsername = username.trim().toLowerCase();
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanUsername)
        .single();

      if (profileErr || !profile) {
        throw new Error(`Пользователь с никнеймом "${username}" не найден.`);
      }

      const { error: insertErr } = await supabase
        .from('chat_members')
        .insert({ chat_id: chatId, profile_id: profile.id });

      if (insertErr) throw insertErr;

      return {
        id: profile.id,
        name: profile.display_name || profile.username,
        username: profile.username,
        avatar: profile.avatar || '👤',
        avatarColor: profile.avatar_color || '#ccc',
        bio: profile.bio || ''
      };
    } else {
      const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
      const user = mockUsers.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
      if (!user) {
        throw new Error(`Пользователь с никнеймом "${username}" не найден.`);
      }
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar || '👤',
        avatarColor: user.avatarColor || '#ccc',
        bio: user.bio || ''
      };
    }
  },

  toggleMemberRole: async (chatId, profileId, targetRole) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('chat_members')
        .update({ role: targetRole })
        .eq('chat_id', chatId)
        .eq('profile_id', profileId);
      if (error) throw error;
    }
  },

  updateChatAvatar: async (chatId, base64Avatar) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('chats')
        .update({ avatar: base64Avatar })
        .eq('id', chatId);
      if (error) throw error;
    }
  },

  updateChatSettings: async (chatId, newSettings) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('chats')
        .update({ settings: newSettings })
        .eq('id', chatId);
      if (error) throw error;
    }
  },

  // 5. Stories
  fetchStories: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('stories')
        .select('*, profiles(display_name, username, avatar, avatar_color)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    } else {
      let savedStories = [];
      try {
        const stored = localStorage.getItem('tg-stories-mock');
        if (stored) savedStories = JSON.parse(stored);
      } catch (e) {}

      if (savedStories.length === 0) {
        savedStories = [
          {
            id: 'demo-story-1',
            user_id: 'system',
            profiles: { display_name: 'Команда CoinGram', avatar: '📢', avatar_color: '#3b82f6' },
            media: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
            caption: 'Обновление CoinGram 1.20.0! 🚀',
            created_at: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 'demo-story-2',
            user_id: 'system',
            profiles: { display_name: 'Демо Бот', avatar: '🤖', avatar_color: '#ef4444' },
            media: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2000&auto=format&fit=crop',
            caption: 'Привет из Демо-режима 🪙',
            created_at: new Date(Date.now() - 7200000).toISOString()
          }
        ];
        localStorage.setItem('tg-stories-mock', JSON.stringify(savedStories));
      }
      return savedStories;
    }
  },

  publishStory: async (userId, media, caption) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('stories')
        .insert({
          user_id: userId,
          media,
          caption
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const savedUser = JSON.parse(localStorage.getItem('tg-user-mock') || '{}');
      const newStory = {
        id: `story-mock-${Date.now()}`,
        user_id: userId,
        profiles: {
          display_name: savedUser.name || 'Вы',
          username: savedUser.username || '',
          avatar: savedUser.avatar || '🪙',
          avatar_color: savedUser.avatarColor || '#ccc'
        },
        media,
        caption,
        created_at: new Date().toISOString()
      };
      
      let savedStories = [];
      try {
        const stored = localStorage.getItem('tg-stories-mock');
        if (stored) savedStories = JSON.parse(stored);
      } catch (e) {}
      
      savedStories.push(newStory);
      localStorage.setItem('tg-stories-mock', JSON.stringify(savedStories));
      
      return newStory;
    }
  },

  // 6. Stickers
  fetchStickers: async (userId) => {
    if (isSupabaseConfigured) {
      const { data: userPacks, error: err1 } = await supabase
        .from('user_sticker_packs')
        .select('pack_id, sticker_packs(*)')
        .eq('user_id', userId);

      if (err1) throw err1;

      return await Promise.all((userPacks || []).map(async (up) => {
        const pack = up.sticker_packs;
        if (!pack) return null;
        const { data: stickerList, error: err2 } = await supabase
          .from('stickers')
          .select('*')
          .eq('pack_id', pack.id)
          .order('created_at', { ascending: true });

        if (err2) throw err2;

        return {
          id: pack.id,
          name: pack.name,
          title: pack.title,
          is_animated: pack.is_animated,
          is_video: pack.is_video,
          stickers: (stickerList || []).map(s => ({
            id: s.id,
            emoji: s.emoji,
            filePath: s.file_path,
            width: s.width,
            height: s.height
          }))
        };
      }));
    } else {
      return null;
    }
  },

  importStickerPack: async (_userId, packName) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('import-sticker-pack', {
        body: { packName }
      });
      if (error) throw error;
      return data;
    } else {
      return null;
    }
  }
};
