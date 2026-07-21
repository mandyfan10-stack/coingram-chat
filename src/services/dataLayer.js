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
      const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
      const user = mockUsers.find(u => u.username === username && u.password === password);
      if (!user) {
        return { error: new Error('Неправильный логин или пароль') };
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
      const { data: memberships, error: memberErr } = await supabase
        .from('chat_members')
        .select('chat_id, notifications, pinned')
        .eq('profile_id', userId);

      if (memberErr) throw memberErr;
      if (!memberships || memberships.length === 0) return [];

      const chatIds = memberships.map(m => m.chat_id);
      const { data: chatList, error: chatErr } = await supabase
        .from('chats')
        .select('*')
        .in('id', chatIds);

      if (chatErr) throw chatErr;

      return await Promise.all((chatList || []).map(async (chat) => {
        const { data: membersRaw } = await supabase
          .from('chat_members')
          .select('profile_id, role, profiles(display_name, username, avatar, avatar_color, bio, last_seen, public_key, has_e2ee)')
          .eq('chat_id', chat.id);

        const membership = memberships.find(m => m.chat_id === chat.id);

        const formattedMembers = (membersRaw || []).map(m => ({
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

        // Fetch ONLY the latest message to avoid loading full history
        const { data: latestMsgRaw } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const latestMsg = latestMsgRaw && latestMsgRaw.length > 0 ? latestMsgRaw[0] : null;
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
      }));
    } else {
      // Mock mode
      const saved = localStorage.getItem('tg-chats-mock');
      if (saved) {
        try {
          return JSON.parse(saved).map(chat => ({
            ...chat,
            messages: chat.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
          }));
        } catch (e) {
          return [];
        }
      }
      return [];
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
      const { data: unreadMsgs } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chatId)
        .neq('sender_id', userId);

      if (unreadMsgs && unreadMsgs.length > 0) {
        const readRows = unreadMsgs.map(m => ({
          message_id: m.id,
          profile_id: userId
        }));

        // Insert into message_reads ignoring duplicates
        await supabase
          .from('message_reads')
          .insert(readRows);
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
      return [];
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
      return {
        id: `story-mock-${Date.now()}`,
        userId,
        media,
        caption,
        created_at: new Date().toISOString()
      };
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

  importStickerPack: async (userId, packName) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('import-sticker-pack', {
        body: { packName, userId }
      });
      if (error) throw error;
      return data;
    } else {
      return null;
    }
  }
};
