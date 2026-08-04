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

test('runtime mode exports distinguish mock vs misconfigured production', () => {
  assert.match(supabaseClient, /export const isMockMode/);
  assert.match(supabaseClient, /export const isMisconfigured/);
  assert.match(supabaseClient, /VITE_ALLOW_MOCK/);
  assert.match(supabaseClient, /import\.meta\.env\.PROD/);
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

test('ICE servers are STUN-only without public TURN credentials', () => {
  assert.match(iceServers, /stun:/);
  assert.doesNotMatch(iceServers, /turn:/i);
  assert.doesNotMatch(iceServers, /openrelay/i);
  assert.doesNotMatch(iceServers, /credential\s*:/);
});
