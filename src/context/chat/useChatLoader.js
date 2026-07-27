import { useState, useCallback, useEffect } from 'react';
import { dataService } from '../../services/dataLayer';
import { getOfflineAttachment } from '../../utils/indexedDbHelper';
import { decryptMessageFields, resolveSharedKey } from './decryptHelpers';

/**
 * Load / paginate chat list and message history with E2EE decrypt.
 */
export function useChatLoader({
  currentUser,
  setChats,
  chatsRef,
  e2eePrivateKeyRef,
  sharedKeysCacheRef,
  setSharedKeysCache,
  activeChatId,
  e2eePrivateKey
}) {
  const [messagePagination, setMessagePagination] = useState({});

  const fetchChats = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await dataService.fetchChats(currentUser.id);

      const formattedChats = await Promise.all(data.map(async (chat) => {
        const otherMember = chat.type === 'personal'
          ? chat.members.find((m) => m.id !== currentUser.id)
          : null;

        let sharedKey = null;
        if (chat.type === 'personal' && otherMember && e2eePrivateKeyRef.current) {
          sharedKey = sharedKeysCacheRef.current[chat.id];
          if (!sharedKey && otherMember.publicKey) {
            sharedKey = await resolveSharedKey({
              chatId: chat.id,
              chat,
              currentUserId: currentUser.id,
              e2eePrivateKey: e2eePrivateKeyRef.current,
              sharedKeysCache: sharedKeysCacheRef.current,
              setSharedKeysCache
            });
          }
        }

        const messages = await Promise.all(
          chat.messages.map((m) => decryptMessageFields(m, sharedKey, chat.type === 'personal'))
        );

        return { ...chat, messages };
      }));

      let localQueue = [];
      try {
        localQueue = JSON.parse(localStorage.getItem('tg-offline-queue') || '[]');
      } catch {
        /* ignore */
      }

      for (const q of localQueue) {
        if (q.hasOfflineMedia && q.optimisticId) {
          try {
            const blob = await getOfflineAttachment(q.optimisticId);
            if (blob) q.media = URL.createObjectURL(blob);
          } catch (e) {
            console.error(e);
          }
        }
      }

      const updatedChats = formattedChats.map((c) => {
        const pendingMsgs = localQueue
          .filter((q) => q.chatId === c.id)
          .map((q) => ({
            id: q.optimisticId,
            senderId: currentUser.id,
            senderName: currentUser.name || 'Вы',
            text: q.text,
            media: q.media,
            replyTo: q.replyToId,
            read: false,
            timestamp: new Date(),
            isPending: !q.isFailed,
            isFailed: !!q.isFailed,
            isOptimistic: true
          }));

        return pendingMsgs.length > 0 ? { ...c, messages: [...c.messages, ...pendingMsgs] } : c;
      });

      setChats((previousChats) => updatedChats.map((nextChat) => {
        const existingChat = previousChats.find((chat) => chat.id === nextChat.id);
        if (!existingChat?.messages?.length) return nextChat;

        const refreshedById = new Map(nextChat.messages.map((message) => [message.id, message]));
        const existingMessages = existingChat.messages.map((message) => {
          const refreshed = refreshedById.get(message.id);
          if (!refreshed) return message;

          // Prefer decrypted local plaintext when already unlocked; always take
          // server-side delivery/read/reaction state so receipts survive refresh.
          const keepLocalBody = !message.isLocked || refreshed.isLocked;
          return {
            ...message,
            ...refreshed,
            text: keepLocalBody ? message.text : refreshed.text,
            media: keepLocalBody ? message.media : refreshed.media,
            isLocked: keepLocalBody ? message.isLocked : refreshed.isLocked,
            read: Boolean(message.read || refreshed.read),
            reads: refreshed.reads?.length ? refreshed.reads : message.reads,
            reactions: refreshed.reactions ?? message.reactions
          };
        });
        const knownMessageIds = new Set(existingMessages.map((message) => message.id));
        const missingPreviewMessages = nextChat.messages.filter(
          (message) => !knownMessageIds.has(message.id)
        );

        return {
          ...nextChat,
          messages: [...existingMessages, ...missingPreviewMessages].sort(
            (left, right) => new Date(left.timestamp) - new Date(right.timestamp)
          )
        };
      }));
    } catch (e) {
      console.error('Failed to load chats', e);
    }
  }, [currentUser, setSharedKeysCache, setChats, e2eePrivateKeyRef, sharedKeysCacheRef]);

  const loadActiveChatMessages = useCallback(async (chatId) => {
    if (!chatId || !currentUser) return;
    try {
      const msgs = await dataService.loadChatMessages(chatId, 30);
      const chat = chatsRef.current.find((c) => c.id === chatId);
      if (!chat) return;

      const sharedKey = await resolveSharedKey({
        chatId,
        chat,
        currentUserId: currentUser.id,
        e2eePrivateKey: e2eePrivateKeyRef.current,
        sharedKeysCache: sharedKeysCacheRef.current,
        setSharedKeysCache
      });

      const decryptedMsgs = await Promise.all(
        msgs.map((m) => decryptMessageFields(m, sharedKey, chat.type === 'personal'))
      );

      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages: decryptedMsgs } : c)));
      setMessagePagination((prev) => ({ ...prev, [chatId]: { loading: false, hasMore: msgs.length === 30 } }));
    } catch (e) {
      console.error(e);
    }
  }, [currentUser, setSharedKeysCache, setChats, chatsRef, e2eePrivateKeyRef, sharedKeysCacheRef]);

  const loadOlderMessages = useCallback(async (chatId) => {
    const chat = chatsRef.current.find((c) => c.id === chatId);
    const pagination = messagePagination[chatId];
    if (!chat || pagination?.loading || pagination?.hasMore === false || !chat.messages?.length) return 0;

    setMessagePagination((prev) => ({ ...prev, [chatId]: { ...prev[chatId], loading: true } }));
    try {
      const oldestTimestamp = chat.messages[0]?.timestamp;
      const older = await dataService.loadChatMessages(chatId, 30, oldestTimestamp);

      const sharedKey = await resolveSharedKey({
        chatId,
        chat,
        currentUserId: currentUser.id,
        e2eePrivateKey: e2eePrivateKeyRef.current,
        sharedKeysCache: sharedKeysCacheRef.current,
        setSharedKeysCache
      });

      const decrypted = await Promise.all(
        older.map((message) => decryptMessageFields(message, sharedKey, chat.type === 'personal'))
      );

      setChats((prev) => prev.map((c) => {
        if (c.id !== chatId) return c;
        const known = new Set(c.messages.map((message) => message.id));
        return { ...c, messages: [...decrypted.filter((message) => !known.has(message.id)), ...c.messages] };
      }));
      setMessagePagination((prev) => ({ ...prev, [chatId]: { loading: false, hasMore: older.length === 30 } }));
      return decrypted.length;
    } catch (error) {
      console.error('Failed to load older messages', error);
      setMessagePagination((prev) => ({ ...prev, [chatId]: { ...prev[chatId], loading: false } }));
      return 0;
    }
  }, [currentUser, messagePagination, setSharedKeysCache, setChats, chatsRef, e2eePrivateKeyRef, sharedKeysCacheRef]);

  useEffect(() => {
    if (activeChatId) {
      loadActiveChatMessages(activeChatId);
    }
  }, [activeChatId, e2eePrivateKey, loadActiveChatMessages]);

  return {
    messagePagination,
    fetchChats,
    loadActiveChatMessages,
    loadOlderMessages
  };
}
