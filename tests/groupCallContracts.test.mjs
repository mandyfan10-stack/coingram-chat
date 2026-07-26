import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const callContext = await readFile(new URL('../src/context/CallContext.jsx', import.meta.url), 'utf8');
const callOverlay = await readFile(new URL('../src/components/CallOverlay.jsx', import.meta.url), 'utf8');

test('call video elements rebind their streams after the overlay is restored', () => {
  assert.match(callOverlay, /\[localVideoStream, isMinimized\]/);
  assert.match(callOverlay, /\[remoteVideoStream, isMinimized\]/);
  assert.match(callOverlay, /srcObject = localVideoStream;[\s\S]*?\.play\(\)\.catch/);
  assert.match(callOverlay, /srcObject = remoteVideoStream;[\s\S]*?\.play\(\)\.catch/);
});

test('group peers are registered from both join and signaling events', () => {
  assert.match(callContext, /const ensureGroupParticipant = \(peerId\)/);
  assert.ok((callContext.match(/ensureGroupParticipant\(senderId\)/g) || []).length >= 2);
});

test('new group peers receive the currently active camera or screen track', () => {
  assert.match(callContext, /const activeVideoStream = localVideoStreamRef\.current/);
  assert.match(callContext, /track\.readyState === 'live'/);
  assert.match(callContext, /pcInstance\.addTrack\(track, activeVideoStream\)/);
});

test('group media updates finish for every peer before renegotiation', () => {
  assert.doesNotMatch(callContext, /forEach\(async/);
  assert.ok((callContext.match(/await Promise\.all\(Object\.keys\(pcsRef\.current\)\.map/g) || []).length >= 4);
});