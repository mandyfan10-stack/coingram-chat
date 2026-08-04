import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const helper = await readFile(new URL('../src/utils/indexedDbHelper.js', import.meta.url), 'utf8');
const loader = await readFile(new URL('../src/context/chat/useChatLoader.js', import.meta.url), 'utf8');

test('offline IndexedDB schema version is at least 3 and never opens a lower version without fallback', () => {
  const versionMatch = helper.match(/const DB_VERSION\s*=\s*(\d+)/);
  assert.ok(versionMatch, 'DB_VERSION constant missing');
  assert.ok(Number(versionMatch[1]) >= 3, `DB_VERSION must be >= 3 (got ${versionMatch[1]})`);
  assert.match(helper, /VersionError/);
  assert.match(helper, /indexedDB\.open\(DB_NAME\)/);
});

test('fetchChats loader tolerates non-array chat payloads and missing messages/members', () => {
  assert.match(loader, /Array\.isArray\(data\)/);
  assert.match(loader, /Array\.isArray\(chat\?\.members\)/);
  assert.match(loader, /Array\.isArray\(chat\?\.messages\)/);
  assert.match(loader, /Array\.isArray\(parsed\)/);
});
