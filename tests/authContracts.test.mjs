import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authContext = await readFile(new URL('../src/context/AuthContext.jsx', import.meta.url), 'utf8');
const dataLayer = await readFile(new URL('../src/services/dataLayer.js', import.meta.url), 'utf8');

test('auth state callbacks do not await Supabase profile calls directly', () => {
  assert.doesNotMatch(authContext, /onAuthStateChange\s*\(\s*async/);
  assert.doesNotMatch(authContext, /auth\.getSession\(\)/);
  assert.match(authContext, /setTimeout\(async \(\) =>/);
  assert.match(authContext, /signOut\(\{ scope: 'local' \}\)/);
  assert.match(dataLayer, /\.maybeSingle\(\)/);
});