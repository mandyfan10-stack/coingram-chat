import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authContext = await readFile(new URL('../src/context/AuthContext.jsx', import.meta.url), 'utf8');
const authService = await readFile(new URL('../src/services/authService.js', import.meta.url), 'utf8');
const authEmail = await readFile(new URL('../src/services/authEmail.ts', import.meta.url), 'utf8');
const dataLayer = await readFile(new URL('../src/services/dataLayer.js', import.meta.url), 'utf8');

test('auth state callbacks do not await Supabase profile calls directly', () => {
  assert.doesNotMatch(authContext, /onAuthStateChange\s*\(\s*async/);
  assert.doesNotMatch(authContext, /auth\.getSession\(\)/);
  assert.match(authContext, /setTimeout\(async \(\) =>/);
  assert.match(authContext, /signOut\(\{ scope: 'local' \}\)/);
  assert.match(authService, /\.maybeSingle\(\)/);
  assert.match(dataLayer, /fetchProfile:\s*authService\.fetchProfile/);
});

test('auth uses dual-path internal emails without hardcoding only tg-clone on signup', () => {
  assert.match(authService, /validateAuthEmail/);
  assert.match(authService, /email: validated\.email/);
  assert.match(authService, /buildSignupAuthEmail/);
  assert.match(authService, /buildSignInEmailCandidates/);
  assert.match(authEmail, /coiny\.users\.local/);
  assert.match(authEmail, /tg-clone\.com/);
  assert.doesNotMatch(authService, /\$\{username\}@tg-clone\.com/);
  assert.match(authService, /passwordHash/);
  assert.match(authService, /hashMockPassword/);
});
