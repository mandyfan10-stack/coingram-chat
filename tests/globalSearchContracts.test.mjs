import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dataLayer = await readFile(new URL('../src/services/dataLayer.js', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');
const modal = await readFile(new URL('../src/components/NewChatModal.jsx', import.meta.url), 'utf8');

test('profile search uses parameterized ilike filters instead of interpolated or syntax', () => {
  assert.match(dataLayer, /searchProfiles: async/);
  assert.match(dataLayer, /\.ilike\(column, pattern\)/);
  assert.doesNotMatch(sidebar, /\.or\(`username\.ilike/);
  assert.doesNotMatch(modal, /\.or\(`username\.ilike/);
});

test('search requests abort on query changes and ignore stale results', () => {
  assert.match(sidebar, /const controller = new AbortController\(\)/);
  assert.match(sidebar, /if \(!cancelled\) setGlobalResults/);
  assert.match(sidebar, /controller\.abort\(\)/);
  assert.match(modal, /if \(!cancelled\) setMemberResults/);
});

test('global results open existing personal chats instead of hiding or duplicating them', () => {
  assert.match(sidebar, /const existingChat = chats\.find/);
  assert.match(sidebar, /setActiveChatId\(existingChat\.id\)/);
});