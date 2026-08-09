import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNetworkError,
  createOfflineQueueItem
} from '../src/services/offlineQueueCore.js';
import { processOfflineQueueItem } from '../src/services/offlineQueue.js';

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
        }
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
  assert.match(result.finalMediaUrl, /^storage:\/\/chat-attachments\//);
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

test('offline media survives a send failure and a 409 upload retry completes it', async () => {
  const deleted = [];
  let uploadAttempt = 0;
  let sendAttempt = 0;
  const item = createOfflineQueueItem({
    chatId: 'group-1',
    senderId: 'user-1',
    text: 'retry media',
    optimisticId: 'opt-retry-media',
    hasOfflineMedia: true,
    mediaType: 'image'
  });
  const deps = {
    chat: { type: 'group', name: 'G', members: [] },
    currentUser: { id: 'user-1' },
    e2eePrivateKey: null,
    sharedKey: null,
    getAttachment: async () => new Blob(['image'], { type: 'image/webp' }),
    deleteAttachment: async (id) => { deleted.push(id); },
    extensionForMedia: () => 'webp',
    storage: {
      from: () => ({
        upload: async () => {
          uploadAttempt += 1;
          return uploadAttempt === 1
            ? { error: null }
            : { error: { statusCode: '409', message: 'The resource already exists' } };
        }
      })
    },
    sendMessage: async () => {
      sendAttempt += 1;
      if (sendAttempt === 1) throw new Error('failed to fetch');
      return { id: item.optimisticId };
    }
  };

  await assert.rejects(() => processOfflineQueueItem(item, deps), /failed to fetch/);
  assert.deepEqual(deleted, [], 'the only local copy must survive until the message insert succeeds');

  const result = await processOfflineQueueItem(item, deps);
  assert.equal(result.data.id, item.optimisticId);
  assert.deepEqual(deleted, [item.optimisticId]);
});

test('lost insert response accepts only the matching existing optimistic message', async () => {
  const item = createOfflineQueueItem({
    chatId: 'group-1', senderId: 'user-1', text: 'once', optimisticId: 'stable-id'
  });
  const duplicate = Object.assign(new Error('duplicate key'), { code: '23505' });
  const baseDeps = {
    chat: { type: 'group', name: 'G', members: [] },
    currentUser: { id: 'user-1' },
    e2eePrivateKey: null,
    sharedKey: null,
    sendMessage: async () => { throw duplicate; }
  };

  const result = await processOfflineQueueItem(item, {
    ...baseDeps,
    findMessageById: async () => ({ id: 'stable-id', chat_id: 'group-1', sender_id: 'user-1' })
  });
  assert.equal(result.data.id, 'stable-id');

  await assert.rejects(() => processOfflineQueueItem(item, {
    ...baseDeps,
    findMessageById: async () => ({ id: 'stable-id', chat_id: 'other-chat', sender_id: 'user-1' })
  }), (error) => error === duplicate);
});
