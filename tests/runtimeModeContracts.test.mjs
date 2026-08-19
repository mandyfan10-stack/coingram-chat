import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const supabaseClient = await readFile(
  new URL('../src/supabaseClient.js', import.meta.url),
  'utf8'
);
const appSource = await readFile(
  new URL('../src/App.jsx', import.meta.url),
  'utf8'
);
const authService = await readFile(
  new URL('../src/services/authService.js', import.meta.url),
  'utf8'
);
const iceServers = await readFile(
  new URL('../src/context/calls/iceServers.ts', import.meta.url),
  'utf8'
);

test('Supabase auth client recovers from a stuck navigator lock', () => {
  assert.match(supabaseClient, /detectSessionInUrl:\s*false/);
  assert.match(supabaseClient, /lock:\s*requestAuthLock/);
  assert.match(supabaseClient, /AbortError/);
});

test('runtime mode exports distinguish mock vs misconfigured production', () => {
  assert.match(supabaseClient, /export const isMockMode/);
  assert.match(supabaseClient, /export const isMisconfigured/);
  assert.match(supabaseClient, /VITE_ALLOW_MOCK/);
  assert.match(supabaseClient, /import\.meta\.env\.PROD/);
  assert.match(supabaseClient, /runtimeMockAllowed/);
  assert.match(supabaseClient, /!isProduction \|\| allowMockInProduction/);
});

test('App blocks misconfigured production before providers', () => {
  assert.match(appSource, /isMisconfigured/);
  assert.match(appSource, /MisconfiguredScreen/);
  assert.match(appSource, /VITE_ALLOW_MOCK/);
});

test('auth mock auto-create requires isMockMode', () => {
  assert.match(authService, /isMockMode/);
  assert.match(authService, /if \(!isMockMode\)/);
});

test('ICE servers fetch short-lived TURN credentials and never ship static relays', () => {
  assert.match(iceServers, /stun:/);
  assert.match(iceServers, /turn-credentials/);
  assert.match(iceServers, /normalizeFetchedIceServers/);
  assert.doesNotMatch(iceServers, /openrelay/i);
  assert.doesNotMatch(iceServers, /turn:turn\.example/i);
  assert.doesNotMatch(iceServers, /urls:\s*['"]turns?:/i);
});
