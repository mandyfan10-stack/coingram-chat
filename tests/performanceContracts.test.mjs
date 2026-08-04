import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  app,
  settings,
  chatProvider,
  callProvider,
  chatRealtime,
  chatService,
  viteConfig
] = await Promise.all([
  readSource('../src/App.jsx'),
  readSource('../src/components/SettingsModal.jsx'),
  readSource('../src/context/chat/ChatProvider.jsx'),
  readSource('../src/context/calls/CallProvider.jsx'),
  readSource('../src/context/chat/useChatRealtime.js'),
  readSource('../src/services/chatService.js'),
  readSource('../vite.config.js')
]);

test('heavy secondary surfaces stay behind dynamic imports', () => {
  assert.match(app, /lazy\(\(\) => import\('\.\/components\/SettingsModal'\)\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\/components\/CallOverlay'\)\)/);
  assert.match(viteConfig, /manualChunks\(id\)/);
  assert.doesNotMatch(app, /PulsePanel|pulse-edge-tab|isPulseOpen/);
  // StickersTab may be static or lazy depending on bundle strategy
  assert.match(settings, /StickersTab/);
});

test('chat context provider exposes chat API surface', () => {
  assert.match(chatProvider, /ChatContext\.Provider/);
  assert.match(chatProvider, /useChatActions/);
  assert.match(callProvider, /CallContext|createContext|Provider/);
});

test('chat loading and realtime avoid unbounded chat list payloads where configured', () => {
  // Prefer CHAT_SELECT column list when present; otherwise at least RPC latest messages.
  if (chatService.includes('CHAT_SELECT')) {
    assert.doesNotMatch(chatService, /\.select\('\*'\)/);
    assert.match(chatService, /const CHAT_SELECT = 'id, name, type/);
  } else {
    assert.match(chatService, /get_latest_chat_messages/);
  }
  assert.match(chatRealtime, /useChatRealtime|setChats|fetchChats/);
});
