import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_MEDIA_ACCEPT, MAX_CHAT_MEDIA_BYTES, extensionForMedia, validateChatMedia } from '../src/utils/mediaValidation.js';

const fakeFile = (type, size = 128, name = 'file') => ({ type, size, name });

test('accepts every supported messenger media family', () => {
  assert.equal(validateChatMedia(fakeFile('image/png')).kind, 'image');
  assert.equal(validateChatMedia(fakeFile('video/mp4')).kind, 'video');
  assert.equal(validateChatMedia(fakeFile('audio/webm')).kind, 'audio');
  assert.match(CHAT_MEDIA_ACCEPT, /video\/webm/);
});

test('rejects empty, oversized, and unknown media', () => {
  assert.throws(() => validateChatMedia(fakeFile('image/png', 0)), /пуст/i);
  assert.throws(() => validateChatMedia(fakeFile('image/png', MAX_CHAT_MEDIA_BYTES + 1)), /15 МБ/);
  assert.throws(() => validateChatMedia(fakeFile('application/pdf')), /не поддерживается/i);
});

test('normalizes safe storage extensions from MIME', () => {
  assert.equal(extensionForMedia('image/jpeg'), 'jpg');
  assert.equal(extensionForMedia('audio/mpeg'), 'mp3');
  assert.equal(extensionForMedia('video/webm'), 'webm');
});