import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFLINE_QUEUE_STORAGE_KEY,
  loadOfflineQueue,
  saveOfflineQueue,
  isNetworkError,
  createOfflineQueueItem
} from '../src/services/offlineQueueCore.js';
import { processOfflineQueueItem } from '../src/services/offlineQueue.js';

function installLocalStorageMock() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); }
  };
  return store;
}

test('loadOfflineQueue returns [] for empty or corrupt storage', () => {
  installLocalStorageMock();
  assert.deepEqual(loadOfflineQueue(), []);
  localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, '{not-json');
  assert.deepEqual(loadOfflineQueue(), []);
});

test('saveOfflineQueue round-trips queue entries', () => {
  installLocalStorageMock();
  const queue = [
    createOfflineQueueItem({
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'hello offline',
      optimisticId: 'msg-1'
    })
  ];
  saveOfflineQueue(queue);
  const loaded = loadOfflineQueue();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].chatId, 'chat-1');
  assert.equal(loaded[0].text, 'hello offline');
  assert.equal(loaded[0].isPending, true);
  assert.equal(loaded[0].isFailed, false);
});

test('isNetworkError detects fetch/network failure messages', () => {
  assert.equal(isNetworkError(new Error('TypeError: failed to fetch')), true);
  assert.equal(isNetworkError(new Error('FetchError: timeout')), true);
  assert.equal(isNetworkError(new Error('NetworkError when attempting to fetch resource')), true);
  assert.equal(isNetworkError(new Error('permission denied')), false);
});

test('processOfflineQueueItem sends plaintext group message without E2EE', async () => {
  const calls = [];
  const item = createOfflineQueueItem({
    chatId: 'group-1',
    senderId: 'user-1',
    text: 'queued group msg',
    optimisticId: 'opt-1',
    replyToId: null
  });

  const result = await processOfflineQueueItem(item, {
    chat: { type: 'group', name: 'Community', members: [] },
    currentUser: { id: 'user-1' },
    e2eePrivateKey: null,
    sharedKey: null,
    sendMessage: async (chatId, senderId, text, replyToId, media, customId) => {
      calls.push({ chatId, senderId, text, replyToId, media, customId });
      return { id: customId, text };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].text, 'queued group msg');
  assert.equal(calls[0].customId, 'opt-1');
  assert.equal(result.data.id, 'opt-1');
  assert.equal(result.finalMediaUrl, null);
});

test('processOfflineQueueItem uploads offline media then deletes local attachment', async () => {
  const deleted = [];
  const uploaded = [];
  const item = createOfflineQueueItem({
    chatId: 'group-1',
    senderId: 'user-1',
    text: '🎤 Голосовое сообщение',
    optimisticId: 'opt-media',
    hasOfflineMedia: true,
    mediaType: 'audio'
  });

  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });

  const result = await processOfflineQueueItem(item, {
    chat: { type: 'group', name: 'Community', members: [] },
    currentUser: { id: 'user-1' },
    e2eePrivateKey: null,
    sharedKey: null,
    getAttachment: async (id) => {
      assert.equal(id, 'opt-media');
      return blob;
    },
    deleteAttachment: async (id) => { deleted.push(id); },
    extensionForMedia: () => 'webm',
    storage: {
      from: () => ({
        upload: async (path, body, opts) => {
          uploaded.push({ path, body, opts });
          return { error: null };
        },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/${path}` } })
      })
    },
    sendMessage: async (_c, _s, text, _r, media, customId) => ({
      id: customId,
      text,
      media
    })
  });

  assert.equal(uploaded.length, 1);
  assert.match(uploaded[0].path, /group-1\/user-1\/msg_opt-media/);
  assert.equal(deleted[0], 'opt-media');
  assert.match(result.finalMediaUrl, /^https:\/\/cdn\.test\//);
});

test('processOfflineQueueItem fails when offline media blob is missing', async () => {
  const item = createOfflineQueueItem({
    chatId: 'group-1',
    senderId: 'user-1',
    text: 'media',
    optimisticId: 'missing',
    hasOfflineMedia: true
  });

  await assert.rejects(
    () => processOfflineQueueItem(item, {
      chat: { type: 'group', name: 'G', members: [] },
      currentUser: { id: 'user-1' },
      e2eePrivateKey: null,
      sharedKey: null,
      getAttachment: async () => null,
      extensionForMedia: () => 'bin',
      sendMessage: async () => ({ id: 'x' })
    }),
    /локальном хранилище/
  );
});
