import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const callProvider = await readFile(new URL('../src/context/calls/CallProvider.jsx', import.meta.url), 'utf8');
const callOverlay = await readFile(new URL('../src/components/CallOverlay.jsx', import.meta.url), 'utf8');
const callMedia = await readFile(new URL('../src/context/calls/useCallMedia.js', import.meta.url), 'utf8');
const callSources = [callProvider, callMedia].join('\n');

test('call video elements rebind their streams after the overlay is restored', () => {
  assert.match(callOverlay, /\[localVideoStream, isMinimized\]/);
  assert.match(callOverlay, /\[remoteVideoStream, isMinimized\]/);
  assert.match(callOverlay, /srcObject = localVideoStream;[\s\S]*?\.play\(\)\.catch/);
  assert.match(callOverlay, /srcObject = remoteVideoStream;[\s\S]*?\.play\(\)\.catch/);
});

test('group peers are registered from both join and signaling events', () => {
  assert.match(callProvider, /const ensureGroupParticipant = \(peerId\)/);
  assert.ok((callProvider.match(/ensureGroupParticipant\(senderId\)/g) || []).length >= 2);
});

test('new group peers receive the currently active camera or screen track', () => {
  assert.match(callProvider, /const activeVideoStream = localVideoStreamRef\.current/);
  assert.match(callProvider, /track\.readyState === 'live'/);
  assert.match(callProvider, /pcInstance\.addTrack\(track, activeVideoStream\)/);
});

test('group media updates finish for every peer before renegotiation', () => {
  assert.doesNotMatch(callSources, /forEach\(async/);
  assert.ok((callSources.match(/await Promise\.all\(Object\.keys\(pcsRef\.current\)\.map/g) || []).length >= 4);
});

test('group participant list is reconciled from Supabase Presence', () => {
  assert.match(callProvider, /presence:\s*\{ key: currentUserRef\.current\.id \}/);
  assert.match(callProvider, /\.on\('presence', \{ event: 'sync' \}/);
  assert.match(callProvider, /activeCallChannel\.presenceState\(\)/);
  assert.match(callProvider, /await activeCallChannel\.track\(\{/);
  assert.match(callSources, /activeCallChannelRef\.current\.track\(\{/);
});

test('group call metadata is resolved from the call chat instead of the open chat', () => {
  assert.match(callProvider, /const callChat = chats\.find\(c => c\.id === callState\.chatId\)/);
  assert.match(callProvider, /callChatRef\.current\?\.members/);
  assert.doesNotMatch(callProvider, /activeChatRef/);
});
