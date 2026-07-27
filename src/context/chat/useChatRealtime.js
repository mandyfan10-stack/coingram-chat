import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { dataService } from '../../services/dataLayer';
import {
  importPublicKey,
  deriveSymmetricKey,
  decryptMessage
} from '../../utils/e2eeHelper';
import { playSound } from '../../utils/sounds';

/**
 * Supabase realtime: messages, members, presence, typing, stories; mock bootstrap.
 */
export function useChatRealtime({
  currentUser,
  setChats,
  fetchChats,
  fetchStories,
  markMessagesAsRead,
  setSharedKeysCache,
  e2eePrivateKeyRef,
  sharedKeysCacheRef,
  activeChatIdRef,
  setOnlineUsers,
  setTypingStatuses,
  typingChannelRef,
  typingTimeoutsRef
}) {
  useEffect(() => {
    if (dataService.isLive()) {
      if (currentUser) {
        fetchChats();
        fetchStories();

        const msgChannel = supabase
          .channel('db-messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
            const newMsg = payload.new;

            const isMe = newMsg.sender_id === currentUser.id;
            if (!isMe) {
              playSound('incoming');
              if (newMsg.chat_id === activeChatIdRef.current) {
                markMessagesAsRead(newMsg.chat_id);
              }
            }

            let decryptedText = newMsg.text;
            let decryptedMedia = newMsg.media;
            let isDecrypted = true;

            if (newMsg.text?.startsWith('e2ee:aes-gcm:') || newMsg.media?.startsWith('e2ee:aes-gcm:')) {
              let sharedKey = sharedKeysCacheRef.current[newMsg.chat_id];
              if (!sharedKey && e2eePrivateKeyRef.current) {
                try {
                  const { data: membersRaw } = await supabase
                    .from('chat_members')
                    .select('profile_id, profiles(public_key, has_e2ee)')
                    .eq('chat_id', newMsg.chat_id);

                  const otherMember = membersRaw?.find((m) => m.profile_id !== currentUser.id);
                  if (otherMember?.profiles?.public_key) {
                    const otherPublicKeyObj = await importPublicKey(otherMember.profiles.public_key);
                    sharedKey = await deriveSymmetricKey(e2eePrivateKeyRef.current, otherPublicKeyObj);
                    setSharedKeysCache((prev) => ({ ...prev, [newMsg.chat_id]: sharedKey }));
                  }
                } catch (err) {
                  console.error(err);
                }
              }

              if (sharedKey) {
                if (newMsg.text?.startsWith('e2ee:aes-gcm:')) {
                  try {
                    const parts = newMsg.text.replace('e2ee:aes-gcm:', '').split(':');
                    decryptedText = await decryptMessage(parts[0], parts[1], sharedKey);
                  } catch {
                    decryptedText = 'Зашифрованное сообщение';
                    isDecrypted = false;
                  }
                }
                if (newMsg.media?.startsWith('e2ee:aes-gcm:') && isDecrypted) {
                  try {
                    const parts = newMsg.media.replace('e2ee:aes-gcm:', '').split(':');
                    decryptedMedia = await decryptMessage(parts[0], parts[1], sharedKey);
                  } catch {
                    decryptedMedia = null;
                  }
                }
              } else {
                decryptedText = 'Зашифрованное сообщение';
                isDecrypted = false;
                decryptedMedia = null;
              }
            }

            setChats((prevChats) => {
              const chat = prevChats.find((c) => c.id === newMsg.chat_id);
              if (!chat) return prevChats;
              if (chat.messages.some((m) => m.id === newMsg.id)) return prevChats;

              const senderName = chat.members.find((m) => m.id === newMsg.sender_id)?.name || 'Пользователь';

              const formattedMsg = {
                id: newMsg.id,
                senderId: newMsg.sender_id,
                senderName,
                text: decryptedText,
                media: decryptedMedia,
                replyTo: newMsg.reply_to,
                read: newMsg.read,
                reactions: newMsg.reactions || [],
                timestamp: new Date(newMsg.created_at),
                isLocked: !isDecrypted
              };

              let replacedOptimistic = false;
              const nextMessages = chat.messages.map((m) => {
                if (isMe && m.isOptimistic && m.id === newMsg.id) {
                  replacedOptimistic = true;
                  return formattedMsg;
                }
                return m;
              });

              return prevChats.map((c) => {
                if (c.id === newMsg.chat_id) {
                  return {
                    ...c,
                    messages: replacedOptimistic ? nextMessages : [...c.messages, formattedMsg]
                  };
                }
                return c;
              });
            });
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
            const deletedMsgId = payload.old.id;
            setChats((prevChats) => prevChats.map((c) => ({
              ...c,
              messages: c.messages.filter((m) => m.id !== deletedMsgId)
            })));
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
            const updatedMsg = payload.new;
            setChats((prevChats) => prevChats.map((c) => {
              if (c.id === updatedMsg.chat_id) {
                return {
                  ...c,
                  messages: c.messages.map((m) => (m.id === updatedMsg.id ? {
                    ...m,
                    read: updatedMsg.read,
                    reactions: updatedMsg.reactions || []
                  } : m))
                };
              }
              return c;
            }));
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads' }, (payload) => {
            const receipt = payload.new;
            setChats((prevChats) => prevChats.map((chat) => ({
              ...chat,
              messages: chat.messages.map((message) => (
                message.id === receipt.message_id
                  ? {
                      ...message,
                      read: true,
                      reads: [...new Set([...(message.reads || []), receipt.profile_id])]
                    }
                  : message
              ))
            })));
          })
          .subscribe();

        const memberChannel = supabase
          .channel('db-members')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_members',
            filter: `profile_id=eq.${currentUser.id}`
          }, () => {
            fetchChats();
          })
          .subscribe();

        const presenceChannel = supabase.channel('online-users');
        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const onlineIds = Object.keys(state);

            setOnlineUsers((prevOnline) => {
              const nextOnline = new Set(onlineIds);
              const wentOffline = [...prevOnline].filter((id) => !nextOnline.has(id));

              if (wentOffline.length > 0) {
                setChats((prevChats) => prevChats.map((chat) => {
                  if (chat.type === 'personal') {
                    const other = chat.members?.find((m) => m.id !== currentUser.id);
                    if (other && wentOffline.includes(other.id)) {
                      const updatedMembers = chat.members.map((m) => (
                        m.id === other.id ? { ...m, lastSeen: new Date().toISOString() } : m
                      ));
                      return {
                        ...chat,
                        members: updatedMembers,
                        lastSeen: new Date().toISOString()
                      };
                    }
                  }
                  return chat;
                }));
              }
              return nextOnline;
            });
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({
                id: currentUser.id,
                online_at: new Date().toISOString()
              });
            }
          });

        const typingChannel = supabase.channel('typing-status');
        typingChannelRef.current = typingChannel;
        typingChannel
          .on('broadcast', { event: 'typing' }, (payload) => {
            const { userId, chatId, isTyping, userName } = payload.payload;
            if (typingTimeoutsRef.current[userId]) {
              clearTimeout(typingTimeoutsRef.current[userId]);
              delete typingTimeoutsRef.current[userId];
            }
            if (isTyping) {
              setTypingStatuses((prev) => {
                const chatStatuses = { ...prev[chatId], [userId]: userName };
                return { ...prev, [chatId]: chatStatuses };
              });
              typingTimeoutsRef.current[userId] = setTimeout(() => {
                setTypingStatuses((prev) => {
                  const chatStatuses = { ...prev[chatId] };
                  delete chatStatuses[userId];
                  return { ...prev, [chatId]: chatStatuses };
                });
                delete typingTimeoutsRef.current[userId];
              }, 6000);
            } else {
              setTypingStatuses((prev) => {
                const chatStatuses = { ...prev[chatId] };
                delete chatStatuses[userId];
                return { ...prev, [chatId]: chatStatuses };
              });
            }
          })
          .subscribe();

        const storiesChannel = supabase
          .channel('db-stories')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
            fetchStories();
          })
          .subscribe();

        return () => {
          msgChannel.unsubscribe();
          memberChannel.unsubscribe();
          presenceChannel.unsubscribe();
          typingChannel.unsubscribe();
          storiesChannel.unsubscribe();
          typingChannelRef.current = null;
        };
      }
    } else if (currentUser) {
      const saved = localStorage.getItem('tg-chats-mock');
      if (saved) {
        try {
          const parsed = JSON.parse(saved).map((chat) => ({
            ...chat,
            messages: chat.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
          }));
          setChats(parsed);
        } catch {
          setChats([]);
        }
      }
    }
  }, [
    currentUser,
    fetchChats,
    fetchStories,
    markMessagesAsRead,
    setSharedKeysCache,
    setChats,
    setOnlineUsers,
    setTypingStatuses,
    e2eePrivateKeyRef,
    sharedKeysCacheRef,
    activeChatIdRef,
    typingChannelRef,
    typingTimeoutsRef
  ]);
}
