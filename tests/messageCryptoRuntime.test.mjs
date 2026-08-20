import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptMessageFields, resolveSharedKey } from '../src/context/chat/decryptHelpers.js';
import {
  encryptMessage,
  exportPublicKey,
  generateE2EEKeyPair
} from '../src/utils/e2eeHelper.js';

test('group messages bypass personal-message decryption', async () => {
  const message = {
    id: 'message-1',
    text: 'e2ee:aes-gcm:not-really-encrypted:iv',
    media: 'storage://chat-attachments/file.webp'
  };
  const result = await decryptMessageFields(message, null, false);
  assert.deepEqual(result, { ...message, isLocked: false });
});

test('personal encrypted messages stay locked until a shared key is available', async () => {
  const message = {
    id: 'message-1',
    text: 'e2ee:aes-gcm:ciphertext:iv',
    media: 'e2ee:aes-gcm:media-ciphertext:media-iv'
  };
  const result = await decryptMessageFields(message, null, true);
  assert.equal(result.text, 'Зашифрованное сообщение');
  assert.equal(result.media, null);
  assert.equal(result.isLocked, true);
});

test('personal message text and media decrypt with the shared AES key', async () => {
  const sharedKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const encryptedText = await encryptMessage('hello', sharedKey);
  const encryptedMedia = await encryptMessage('storage://chat-attachments/file.webp', sharedKey);
  const message = {
    id: 'message-1',
    text: `e2ee:aes-gcm:${encryptedText.ciphertext}:${encryptedText.iv}`,
    media: `e2ee:aes-gcm:${encryptedMedia.ciphertext}:${encryptedMedia.iv}`
  };

  const result = await decryptMessageFields(message, sharedKey, true);
  assert.equal(result.text, 'hello');
  assert.equal(result.media, 'storage://chat-attachments/file.webp');
  assert.equal(result.isLocked, false);
});

test('decryption failures hide corrupted ciphertext and media', async () => {
  const sharedKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const badText = await decryptMessageFields({
    text: 'e2ee:aes-gcm:00:00',
    media: 'e2ee:aes-gcm:00:00'
  }, sharedKey, true);
  assert.equal(badText.text, 'Зашифрованное сообщение');
  assert.equal(badText.media, null);
  assert.equal(badText.isLocked, true);

  const badMedia = await decryptMessageFields({
    text: 'plain preview',
    media: 'e2ee:aes-gcm:00:00'
  }, sharedKey, true);
  assert.equal(badMedia.text, 'plain preview');
  assert.equal(badMedia.media, null);
  assert.equal(badMedia.isLocked, false);
});

test('shared-key resolution handles non-personal, cached, and incomplete chats', async () => {
  const cachedKey = { id: 'cached-key' };
  const common = {
    chatId: 'chat-1',
    currentUserId: 'user-1',
    e2eePrivateKey: { id: 'private-key' },
    sharedKeysCache: {},
    setSharedKeysCache: () => assert.fail('cache must not be updated')
  };
  assert.equal(await resolveSharedKey({ ...common, chat: { type: 'group' } }), null);
  assert.equal(await resolveSharedKey({
    ...common,
    chat: { type: 'personal', members: [] },
    sharedKeysCache: { 'chat-1': cachedKey }
  }), cachedKey);
  assert.equal(await resolveSharedKey({
    ...common,
    chat: { type: 'personal', members: [] },
    e2eePrivateKey: null
  }), null);
  assert.equal(await resolveSharedKey({
    ...common,
    chat: { type: 'personal', members: [{ id: 'user-2' }] }
  }), null);
});

test('shared-key resolution derives and caches the personal-chat key', async () => {
  const alice = await generateE2EEKeyPair();
  const bob = await generateE2EEKeyPair();
  const bobPublicKey = await exportPublicKey(bob.publicKey);
  let cachedState = {};

  const sharedKey = await resolveSharedKey({
    chatId: 'chat-1',
    chat: {
      type: 'personal',
      members: [
        { id: 'user-1' },
        { id: 'user-2', publicKey: bobPublicKey }
      ]
    },
    currentUserId: 'user-1',
    e2eePrivateKey: alice.privateKey,
    sharedKeysCache: {},
    setSharedKeysCache: (updater) => {
      cachedState = updater(cachedState);
    }
  });

  assert.ok(sharedKey instanceof CryptoKey);
  assert.equal(cachedState['chat-1'], sharedKey);
});

test('shared-key resolution fails closed for an invalid public key', async () => {
  const alice = await generateE2EEKeyPair();
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  try {
    const sharedKey = await resolveSharedKey({
      chatId: 'chat-1',
      chat: {
        type: 'personal',
        members: [
          { id: 'user-1' },
          { id: 'user-2', publicKey: 'not-json' }
        ]
      },
      currentUserId: 'user-1',
      e2eePrivateKey: alice.privateKey,
      sharedKeysCache: {},
      setSharedKeysCache: () => assert.fail('invalid keys must not be cached')
    });
    assert.equal(sharedKey, null);
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], 'Failed to derive shared key:');
  } finally {
    console.error = originalError;
  }
});
