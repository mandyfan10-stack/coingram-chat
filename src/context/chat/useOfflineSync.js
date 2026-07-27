import { useState, useEffect, useCallback } from 'react';
import { dataService } from '../../services/dataLayer';
import {
  loadOfflineQueue,
  saveOfflineQueue,
  processOfflineQueueItem,
  isNetworkError
} from '../../services/offlineQueue';
import { deleteOfflineAttachment } from '../../utils/indexedDbHelper';

/**
 * Offline queue state and sync when the client comes back online.
 */
export function useOfflineSync({
  currentUser,
  chats,
  setChats,
  e2eePrivateKeyRef,
  sharedKeysCacheRef,
  setSharedKeysCache
}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => loadOfflineQueue());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    saveOfflineQueue(offlineQueue);
  }, [offlineQueue]);

  const markMessageAsFailed = useCallback((chatId, optimisticId) => {
    setChats((prevChats) => prevChats.map((c) => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: c.messages.map((m) => (m.id === optimisticId ? { ...m, isFailed: true, isPending: false } : m))
        };
      }
      return c;
    }));
    setOfflineQueue((prev) => prev.map((q) => (q.optimisticId === optimisticId ? { ...q, isFailed: true, isPending: false } : q)));
  }, [setChats]);

  const syncOfflineMessages = useCallback(async () => {
    if (!dataService.isLive() || offlineQueue.length === 0) return;
    const queueToProcess = offlineQueue.filter((q) => !q.isFailed);
    if (queueToProcess.length === 0) return;

    for (const item of queueToProcess) {
      try {
        const chat = chats.find((c) => c.id === item.chatId);
        const { data, finalMediaUrl } = await processOfflineQueueItem(item, {
          chat,
          currentUser,
          e2eePrivateKey: e2eePrivateKeyRef.current,
          sharedKey: sharedKeysCacheRef.current[item.chatId] || null,
          onSharedKey: (sharedKey) => {
            setSharedKeysCache((prev) => ({ ...prev, [chat.id]: sharedKey }));
          }
        });

        if (data) {
          setChats((prevChats) => prevChats.map((c) => {
            if (c.id === item.chatId) {
              return {
                ...c,
                messages: c.messages.map((m) => {
                  if (m.id === item.optimisticId) {
                    return {
                      ...m,
                      id: data.id,
                      media: finalMediaUrl,
                      isPending: false,
                      isOptimistic: false
                    };
                  }
                  return m;
                })
              };
            }
            return c;
          }));

          setOfflineQueue((prev) => prev.filter((q) => q.queueId !== item.queueId));
        }
      } catch (err) {
        console.error('Failed to sync offline message:', err);
        if (isNetworkError(err)) {
          setIsOnline(false);
          break;
        } else {
          markMessageAsFailed(item.chatId, item.optimisticId);
        }
      }
    }
  }, [offlineQueue, chats, currentUser, markMessageAsFailed, setSharedKeysCache, setChats, e2eePrivateKeyRef, sharedKeysCacheRef]);

  const retrySendMessage = useCallback(async (optimisticId) => {
    const item = offlineQueue.find((q) => q.optimisticId === optimisticId);
    if (!item) return;

    setChats((prevChats) => prevChats.map((c) => {
      if (c.id === item.chatId) {
        return {
          ...c,
          messages: c.messages.map((m) => (m.id === optimisticId ? { ...m, isFailed: false, isPending: true } : m))
        };
      }
      return c;
    }));

    setOfflineQueue((prev) => prev.map((q) => (q.optimisticId === optimisticId ? { ...q, isFailed: false, isPending: true } : q)));

    if (navigator.onLine) {
      setIsOnline(true);
      setTimeout(() => { syncOfflineMessages(); }, 50);
    }
  }, [offlineQueue, syncOfflineMessages, setChats]);

  const deleteFailedMessage = useCallback(async (optimisticId) => {
    const item = offlineQueue.find((q) => q.optimisticId === optimisticId);
    if (!item) return;

    setChats((prevChats) => prevChats.map((c) => {
      if (c.id === item.chatId) {
        return { ...c, messages: c.messages.filter((m) => m.id !== optimisticId) };
      }
      return c;
    }));

    setOfflineQueue((prev) => prev.filter((q) => q.optimisticId !== optimisticId));
    try {
      await deleteOfflineAttachment(optimisticId);
    } catch (e) {
      console.error(e);
    }
  }, [offlineQueue, setChats]);

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      syncOfflineMessages();
    }
  }, [isOnline, offlineQueue.length, syncOfflineMessages]);

  return {
    isOnline,
    setIsOnline,
    offlineQueue,
    setOfflineQueue,
    markMessageAsFailed,
    syncOfflineMessages,
    retrySendMessage,
    deleteFailedMessage
  };
}
