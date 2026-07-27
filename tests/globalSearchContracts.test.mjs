import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const chatProvider = await readFile(new URL('../src/context/chat/ChatProvider.jsx', import.meta.url), 'utf8');
const chatActions = await readFile(new URL('../src/context/chat/useChatActions.js', import.meta.url), 'utf8');

const chatService = await readFile(new URL('../src/services/chatService.js', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');
const drawer = await readFile(new URL('../src/components/MainMenuDrawer.jsx', import.meta.url), 'utf8');
const modal = await readFile(new URL('../src/components/NewChatModal.jsx', import.meta.url), 'utf8');
const personalChatMigration = await readFile(new URL('../supabase/migrations/20260726125251_ensure_personal_chat.sql', import.meta.url), 'utf8');
const privateWrapperMigration = await readFile(new URL('../supabase/migrations/20260726125625_move_personal_chat_function_private.sql', import.meta.url), 'utf8');

test('profile search uses parameterized ilike filters instead of interpolated or syntax', () => {
  assert.match(chatService, /searchProfiles: async/);
  assert.match(chatService, /\.ilike\(column, pattern\)/);
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
test('clicking a profile always resolves and activates a personal chat by profile id', () => {
  assert.match(sidebar, /createChat\(user, 'personal'\)/);
  assert.match(sidebar, /if \(chat\) \{[\s\S]*setActiveChatId\(chat\.id\)/);
  assert.match(chatService, /\.rpc\('ensure_personal_chat', \{ p_target_profile_id: profile\.id \}\)/);
  assert.match(sidebar, /className="chat-item global-search-result"/);
  assert.match(chatProvider, /<ChatContext\.Provider[\s\S]*createChat:[\s\S]*deleteMessage:/);
});

test('chat context exposes the operations consumed by messenger surfaces', () => {
  assert.match(chatProvider, /chats,\s+setChats,\s+fetchChats:/);
  assert.match(drawer, /const \{ currentUser, updateProfile \} = useAuth\(\)/);
  assert.doesNotMatch(drawer, /updateProfile,[\s\S]*= useChat\(\)/);
});

test('a newly resolved personal chat is available locally before background refresh', () => {
  assert.match(chatActions, /setChats\(\(previous\) => \{/);
  assert.match(chatActions, /return \[createdChat, \.\.\.previous\]/);
  assert.match(chatActions, /fetchChats\(\)\.catch/);
});

test('personal chat creation is atomic, deduplicated, and access-controlled', () => {
  assert.match(personalChatMigration, /pg_advisory_xact_lock/i);
  assert.match(personalChatMigration, /security definer/i);
  assert.match(personalChatMigration, /caller_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(personalChatMigration, /revoke execute[\s\S]*from public, anon/i);
  assert.match(personalChatMigration, /grant execute[\s\S]*to authenticated/i);
  assert.match(privateWrapperMigration, /security invoker/i);
});
