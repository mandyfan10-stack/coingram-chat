import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chatAvatarFallback,
  firstAvatarLetter,
  personAvatarFallback,
  resolveAvatarToken,
} from '../src/context/chat/avatarFallback.js';

test('avatar tokens stay tokens and never fall through as visible words', () => {
  assert.equal(resolveAvatarToken('user'), 'user');
  assert.equal(resolveAvatarToken('group'), 'group');
  assert.equal(resolveAvatarToken('channel'), 'channel');
  assert.equal(resolveAvatarToken('👤'), 'user');
  assert.equal(resolveAvatarToken('👥'), 'group');
  assert.equal(resolveAvatarToken('Сергей'), null);
});

test('missing personal avatars use the first letter of the name', () => {
  assert.equal(firstAvatarLetter('сергей'), 'С');
  assert.equal(chatAvatarFallback({ type: 'personal', name: 'Анна', username: 'anna' }), 'Анна');
  assert.equal(personAvatarFallback({ display_name: 'Илья', username: 'ilya' }), 'Илья');
});

test('groups and channels keep type tokens instead of people names', () => {
  assert.equal(chatAvatarFallback({ type: 'group', name: 'Друзья' }), 'group');
  assert.equal(chatAvatarFallback({ type: 'channel', name: 'Новости' }), 'channel');
});
