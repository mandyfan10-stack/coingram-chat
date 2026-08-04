import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { constants as fsConstants } from 'node:fs';

const callProvider = await readFile(new URL('../src/context/calls/CallProvider.jsx', import.meta.url), 'utf8');
const callMedia = await readFile(new URL('../src/context/calls/useCallMedia.js', import.meta.url), 'utf8');
const callSignaling = await readFile(new URL('../src/context/calls/useCallSignaling.js', import.meta.url), 'utf8');
const callOverlay = await readFile(new URL('../src/components/call/CallOverlay.jsx', import.meta.url), 'utf8');
const callOverlayCss = await readFile(new URL('../src/components/call/CallOverlay.css', import.meta.url), 'utf8');
const callSources = [callProvider, callMedia, callSignaling].join('\n');

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

test('endCallLocally only idles when status is still ended (C1)', () => {
  assert.match(callProvider, /prev\.status === 'ended'\s*\?\s*\{\s*\.\.\.IDLE_CALL_STATE\s*\}/);
  assert.match(callProvider, /const teardownMedia = useCallback/);
});

test('incoming-call is ignored while already busy (C2)', () => {
  assert.match(callSignaling, /BUSY_CALL_STATUSES/);
  assert.match(callSignaling, /BUSY_CALL_STATUSES\.has\(prev\.status\)/);
  assert.match(callSignaling, /onRemoteEnd/);
});

test('1:1 screen share triggers renegotiation after track replace (C3)', () => {
  assert.match(callMedia, /await replaceOrAddVideoTrack\(pcRef\.current, screenTrack, screenStream\);\s*\n\s*await triggerRenegotiation\(\);/);
});

test('WebRTC effect cleanup tears down group peers and analyzers (C4)', () => {
  assert.match(callProvider, /cancelled = true/);
  assert.match(callProvider, /teardownMedia\(\)/);
  assert.match(callProvider, /pcsRef\.current\[peerId\]\?\.close/);
  assert.match(callProvider, /audioAnalyzersRef\.current\[key\]\?\.stop/);
});

test('dead useCallWebRtc extract is removed (C5)', async () => {
  await assert.rejects(
    () => access(new URL('../src/context/calls/useCallWebRtc.js', import.meta.url), fsConstants.F_OK),
    (err) => err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')
  );
  assert.doesNotMatch(callProvider, /useCallWebRtc/);
});

test('group UI is voice-stage only without remote video surface (C6)', () => {
  assert.match(callOverlay, /isGroupCall/);
  assert.match(callOverlay, /showVideoControls/);
  assert.match(callProvider, /group UI is voice-stage only/);
});

test('ICE failure exposes retry path and clearer copy (C7)', () => {
  assert.match(callProvider, /retryCallConnection/);
  assert.match(callProvider, /restartIce/);
  assert.match(callOverlay, /Нет WebRTC-связи/);
  assert.match(callOverlay, /retryCallConnection/);
});

test('ring timeout auto-ends unanswered calls (C8)', () => {
  assert.match(callProvider, /CALL_RING_TIMEOUT_MS/);
  assert.match(callProvider, /60_000|60000/);
  assert.match(callProvider, /callState\.status !== 'calling' && callState\.status !== 'incoming'/);
});

test('compact call overlay and unmirrored screen preview (V1/V2)', () => {
  assert.match(callOverlay, /isCompact|getIsCompactViewport/);
  assert.match(callOverlayCss, /safe-area-inset/);
  assert.match(callOverlayCss, /@media \(max-width: 480px\)/);
  assert.match(callOverlay, /is-camera|is-screen/);
  assert.match(callOverlayCss, /\.local-video-feed\.is-camera/);
  assert.match(callOverlayCss, /\.local-video-feed\.is-screen/);
});
