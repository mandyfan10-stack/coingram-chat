export const OFFLINE_QUEUE_STORAGE_KEY = 'tg-offline-queue';

/** @returns {Array<object>} */
export function loadOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/** @param {Array<object>} queue */
export function saveOfflineQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

/** @param {unknown} err */
export function isNetworkError(err) {
  const message = err?.message || '';
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return offline
    || /FetchError/i.test(message)
    || /failed to fetch/i.test(message)
    || /networkerror/i.test(message)
    || /NetworkError/i.test(message);
}

/**
 * Build a queue entry for an optimistic offline send.
 */
export function createOfflineQueueItem({
  chatId,
  senderId,
  text,
  replyToId = null,
  media = null,
  optimisticId,
  hasOfflineMedia = false,
  mediaType = null
}) {
  return {
    queueId: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chatId,
    senderId,
    text,
    replyToId,
    media,
    optimisticId,
    hasOfflineMedia,
    mediaType,
    isPending: true,
    isFailed: false
  };
}
