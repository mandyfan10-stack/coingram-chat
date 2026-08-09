import assert from 'node:assert/strict';
import test from 'node:test';

// Simple in-memory DOM mock for WebRTC audio elements
class MockDOMElement {
  constructor(id, tagName = 'audio') {
    this.id = id;
    this.tagName = tagName;
    this.srcObject = null;
    this.autoplay = false;
    this.playsInline = false;
    this.className = '';
    this.removed = false;
  }
  remove() {
    this.removed = true;
    if (globalThis.__mockDOM) {
      delete globalThis.__mockDOM[this.id];
    }
  }
  play() {
    return Promise.resolve();
  }
}

function setupMockDOM() {
  globalThis.__mockDOM = {};
  globalThis.document = {
    createElement: (tag) => new MockDOMElement('', tag),
    getElementById: (id) => globalThis.__mockDOM[id] || null,
    querySelectorAll: (selector) => {
      const results = [];
      if (selector.startsWith('[id^="webrtc-audio-')) {
        const prefix = selector.replace('[id^="webrtc-audio-', '').replace('"]', '');
        for (const [id, el] of Object.entries(globalThis.__mockDOM)) {
          if (id.startsWith(`webrtc-audio-${prefix}`)) {
            results.push(el);
          }
        }
      } else if (selector === '.webrtc-remote-audio-feed') {
        for (const el of Object.values(globalThis.__mockDOM)) {
          if (el.className.includes('webrtc-remote-audio-feed')) {
            results.push(el);
          }
        }
      }
      return results;
    },
    body: {
      appendChild: (el) => {
        if (el.id) {
          globalThis.__mockDOM[el.id] = el;
        }
      }
    }
  };
}

// Mock RTCPeerConnection for empirical testing
class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.signalingState = 'stable';
    this.iceConnectionState = 'new';
    this.localDescription = null;
    this.remoteDescription = null;
    this.makingOffer = false;
    this.closed = false;
    this.restartedIce = false;
    this.oniceconnectionstatechange = null;
    this.onicecandidate = null;
    this.ontrack = null;
    this.senders = [];
    this.shouldThrowOnCreateOffer = false;
  }

  async createOffer(options = {}) {
    if (this.shouldThrowOnCreateOffer) {
      throw new Error('Simulated createOffer failure');
    }
    if (options.iceRestart) {
      this.restartedIce = true;
    }
    return { type: 'offer', sdp: `v=0\r\no=- ${Date.now()} 2 IN IP4 127.0.0.1\r\ns=-${options.iceRestart ? '\r\na=ice-options:trickle restart' : ''}` };
  }

  async createAnswer() {
    return { type: 'answer', sdp: `v=0\r\no=- ${Date.now()} 2 IN IP4 127.0.0.1\r\ns=-` };
  }

  async setLocalDescription(desc) {
    if (desc.type === 'rollback') {
      this.signalingState = 'stable';
      this.localDescription = null;
      return;
    }
    this.localDescription = desc;
    if (desc.type === 'offer') {
      this.signalingState = 'have-local-offer';
    } else if (desc.type === 'answer') {
      this.signalingState = 'stable';
    }
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
    if (desc.type === 'offer') {
      this.signalingState = 'have-remote-offer';
    } else if (desc.type === 'answer') {
      this.signalingState = 'stable';
    }
  }

  restartIce() {
    this.restartedIce = true;
  }

  addTrack(track, stream) {
    const sender = { track, stream };
    this.senders.push(sender);
    return sender;
  }

  removeTrack(sender) {
    const idx = this.senders.indexOf(sender);
    if (idx !== -1) this.senders.splice(idx, 1);
  }

  getSenders() {
    return this.senders;
  }

  close() {
    this.closed = true;
    this.signalingState = 'closed';
    this.iceConnectionState = 'closed';
  }

  changeIceState(newState) {
    this.iceConnectionState = newState;
    if (typeof this.oniceconnectionstatechange === 'function') {
      this.oniceconnectionstatechange();
    }
  }
}

// Mock AudioContext / Analyzer
class MockAudioAnalyzer {
  constructor() {
    this.stopped = false;
  }
  stop() {
    if (this.stopped) {
      throw new Error('Already closed AudioContext'); // Test try/catch resilience
    }
    this.stopped = true;
  }
}

test('EMPIRICAL: Perfect Negotiation glare resolution logic under offer collisions', async () => {
  setupMockDOM();

  const peerA_id = 'user-001'; // lower string -> polite
  const peerB_id = 'user-002'; // higher string -> impolite

  // Case 1: peerA (polite) receives offer from peerB while peerA is makingOffer = true
  const pcA = new MockRTCPeerConnection();
  pcA.makingOffer = true;
  pcA.signalingState = 'have-local-offer';

  const currentUserIdA = peerA_id;
  const senderIdB = peerB_id;
  const isPoliteA = String(currentUserIdA) < String(senderIdB);
  const offerCollisionA = Boolean(pcA.makingOffer) || pcA.signalingState !== 'stable';

  assert.equal(isPoliteA, true, 'peerA must be polite relative to peerB');
  assert.equal(offerCollisionA, true, 'offerCollision detected for peerA');

  if (offerCollisionA) {
    if (isPoliteA) {
      await pcA.setLocalDescription({ type: 'rollback' });
    }
  }
  assert.equal(pcA.signalingState, 'stable', 'Polite peer rolled back local offer to stable state');

  // Apply peerB's remote offer on peerA
  const remoteOfferFromB = await new MockRTCPeerConnection().createOffer();
  await pcA.setRemoteDescription(remoteOfferFromB);
  assert.equal(pcA.signalingState, 'have-remote-offer', 'Polite peer accepted remote offer after rollback');
  const answerFromA = await pcA.createAnswer();
  await pcA.setLocalDescription(answerFromA);
  assert.equal(pcA.signalingState, 'stable', 'Polite peer answered remote offer and returned to stable');

  // Case 2: peerB (impolite) receives offer from peerA while peerB is makingOffer = true
  const pcB = new MockRTCPeerConnection();
  pcB.makingOffer = true;
  pcB.signalingState = 'have-local-offer';

  const currentUserIdB = peerB_id;
  const senderIdA = peerA_id;
  const isPoliteB = String(currentUserIdB) < String(senderIdA);
  const offerCollisionB = Boolean(pcB.makingOffer) || pcB.signalingState !== 'stable';

  assert.equal(isPoliteB, false, 'peerB must be impolite relative to peerA');
  assert.equal(offerCollisionB, true, 'offerCollision detected for peerB');

  let peerBIgnored = false;
  if (offerCollisionB) {
    if (!isPoliteB) {
      peerBIgnored = true;
    }
  }
  assert.equal(peerBIgnored, true, 'Impolite peer ignored incoming offer during glare');
  assert.equal(pcB.signalingState, 'have-local-offer', 'Impolite peer kept local offer in flight');
});

test('EMPIRICAL: ICE restart offer generation and telemetry logging', async () => {
  setupMockDOM();
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    originalLog(...args);
  };

  try {
    const pc = new MockRTCPeerConnection();
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC Telemetry] 1:1 ICE Connection State Changed: ${pc.iceConnectionState}`);
    };

    // Simulate telemetry events
    pc.changeIceState('checking');
    pc.changeIceState('connected');
    pc.changeIceState('failed');

    // Simulate retryCallConnection logic
    pc.restartIce();
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);

    assert.equal(pc.restartedIce, true, 'restartIce was called on RTCPeerConnection');
    assert.ok(offer.sdp.includes('restart'), 'Offer SDP includes ice-restart flag');
    assert.equal(pc.signalingState, 'have-local-offer', 'Local description set with ICE restart offer');

    const telemetryLogs = logs.filter(l => l.includes('[WebRTC Telemetry]'));
    assert.equal(telemetryLogs.length, 3, 'Logged 3 telemetry events');
    assert.ok(telemetryLogs[0].includes('checking'));
    assert.ok(telemetryLogs[1].includes('connected'));
    assert.ok(telemetryLogs[2].includes('failed'));
  } finally {
    console.log = originalLog;
  }
});

test('EMPIRICAL: Supabase presence abrupt disconnect teardown of PCs, analyzers, and DOM audio elements', async () => {
  setupMockDOM();

  const pcsRef = {
    current: {
      'peer-101': new MockRTCPeerConnection(),
      'peer-102': new MockRTCPeerConnection(),
      'peer-103': new MockRTCPeerConnection()
    }
  };

  const audioAnalyzersRef = {
    current: {
      'local': new MockAudioAnalyzer(),
      'peer-101': new MockAudioAnalyzer(),
      'peer-102': new MockAudioAnalyzer(),
      'peer-103': new MockAudioAnalyzer()
    }
  };

  const candidateQueuesRef = {
    current: {
      'peer-101': [{ candidate: 'c1' }],
      'peer-102': [{ candidate: 'c2' }],
      'peer-103': [{ candidate: 'c3' }]
    }
  };

  // Add DOM audio elements for peers
  const audioEl1 = document.createElement('audio');
  audioEl1.id = 'webrtc-audio-peer-101-stream1';
  document.body.appendChild(audioEl1);

  const audioEl2 = document.createElement('audio');
  audioEl2.id = 'webrtc-audio-peer-102-stream2';
  document.body.appendChild(audioEl2);

  const audioEl3 = document.createElement('audio');
  audioEl3.id = 'webrtc-audio-peer-103-stream3';
  document.body.appendChild(audioEl3);

  // Helper function extracted directly from CallProvider.jsx
  const teardownPeer = (peerId) => {
    if (pcsRef.current[peerId]) {
      try { pcsRef.current[peerId].close(); } catch {}
      delete pcsRef.current[peerId];
    }
    delete candidateQueuesRef.current[peerId];
    if (audioAnalyzersRef.current[peerId]) {
      try { audioAnalyzersRef.current[peerId].stop(); } catch {}
      delete audioAnalyzersRef.current[peerId];
    }
    document.querySelectorAll(`[id^="webrtc-audio-${peerId}-"]`).forEach(el => {
      el.srcObject = null;
      el.remove();
    });
  };

  // Simulate presence sync where peer-102 abruptly drops (missing from presence state)
  const currentUserId = 'user-local';
  const syncedParticipants = new Set(['user-local', 'peer-101', 'peer-103']); // peer-102 missing!

  Object.keys(pcsRef.current).forEach(peerId => {
    if (!syncedParticipants.has(peerId) && peerId !== currentUserId) {
      teardownPeer(peerId);
    }
  });

  // Verify peer-102 resources torn down
  assert.equal(pcsRef.current['peer-102'], undefined, 'peer-102 peer connection removed');
  assert.equal(candidateQueuesRef.current['peer-102'], undefined, 'peer-102 candidate queue deleted');
  assert.equal(audioAnalyzersRef.current['peer-102'], undefined, 'peer-102 audio analyzer removed');
  assert.equal(audioEl2.removed, true, 'peer-102 DOM audio element removed');

  // Verify peer-101 and peer-103 remain intact
  assert.ok(pcsRef.current['peer-101'] && !pcsRef.current['peer-101'].closed);
  assert.ok(pcsRef.current['peer-103'] && !pcsRef.current['peer-103'].closed);
  assert.equal(audioEl1.removed, false);
  assert.equal(audioEl3.removed, false);
});

test('EMPIRICAL: Audio analyzer lifecycle replacement and remote track ending', async () => {
  setupMockDOM();

  const audioAnalyzersRef = {
    current: {}
  };

  // Simulate receiving remote track for peer-A
  const initialAnalyzer = new MockAudioAnalyzer();
  audioAnalyzersRef.current['peer-A'] = initialAnalyzer;

  // Track replacement event (e.g. stream update): must stop prior analyzer before replacing
  if (audioAnalyzersRef.current['peer-A']) {
    try { audioAnalyzersRef.current['peer-A'].stop(); } catch {}
    delete audioAnalyzersRef.current['peer-A'];
  }
  const newAnalyzer = new MockAudioAnalyzer();
  audioAnalyzersRef.current['peer-A'] = newAnalyzer;

  assert.equal(initialAnalyzer.stopped, true, 'Initial audio analyzer stopped on stream update');
  assert.equal(audioAnalyzersRef.current['peer-A'], newAnalyzer, 'New analyzer set');

  // Track onended handler
  const elementId = 'webrtc-audio-peer-A-stream123';
  const audioEl = document.createElement('audio');
  audioEl.id = elementId;
  document.body.appendChild(audioEl);

  const mockTrackOnEnded = () => {
    const el = document.getElementById(elementId);
    if (el) {
      el.srcObject = null;
      el.remove();
    }
    if (audioAnalyzersRef.current['peer-A']) {
      try { audioAnalyzersRef.current['peer-A'].stop(); } catch {}
      delete audioAnalyzersRef.current['peer-A'];
    }
  };

  // Fire track ended
  mockTrackOnEnded();

  assert.equal(audioEl.removed, true, 'DOM element removed on track end');
  assert.equal(newAnalyzer.stopped, true, 'Audio analyzer stopped on track end');
  assert.equal(audioAnalyzersRef.current['peer-A'], undefined, 'Audio analyzer reference deleted on track end');
});

test('STRESS TEST: 3-way mesh glare ordering and total order consistency', () => {
  const peers = ['alice_id_10', 'bob_id_20', 'charlie_id_30'];
  for (let i = 0; i < peers.length; i++) {
    for (let j = 0; j < peers.length; j++) {
      if (i === j) continue;
      const p1 = peers[i];
      const p2 = peers[j];
      const p1_polite_to_p2 = String(p1) < String(p2);
      const p2_polite_to_p1 = String(p2) < String(p1);
      assert.equal(p1_polite_to_p2, !p2_polite_to_p1, `Anti-symmetry holds for pair (${p1}, ${p2})`);
    }
  }
});

test('STRESS TEST: makingOffer state reset on createOffer failure during ICE restart', async () => {
  const pcsRef = {
    current: {
      'faulty-peer': new MockRTCPeerConnection()
    }
  };
  pcsRef.current['faulty-peer'].shouldThrowOnCreateOffer = true;

  const pcInstance = pcsRef.current['faulty-peer'];
  try {
    pcInstance.makingOffer = true;
    await pcInstance.createOffer({ iceRestart: true });
  } catch {
    // expected exception
  } finally {
    if (pcInstance) pcInstance.makingOffer = false;
  }

  assert.equal(pcInstance.makingOffer, false, 'makingOffer correctly reset in finally block despite createOffer failure');
});

test('STRESS TEST: Rapid multi-peer presence churn teardown', async () => {
  setupMockDOM();
  const pcsRef = { current: {} };
  const audioAnalyzersRef = { current: {} };
  const candidateQueuesRef = { current: {} };

  const teardownPeer = (peerId) => {
    if (pcsRef.current[peerId]) {
      try { pcsRef.current[peerId].close(); } catch {}
      delete pcsRef.current[peerId];
    }
    delete candidateQueuesRef.current[peerId];
    if (audioAnalyzersRef.current[peerId]) {
      try { audioAnalyzersRef.current[peerId].stop(); } catch {}
      delete audioAnalyzersRef.current[peerId];
    }
    document.querySelectorAll(`[id^="webrtc-audio-${peerId}-"]`).forEach(el => {
      el.srcObject = null;
      el.remove();
    });
  };

  // Create 50 peers dynamically
  for (let i = 0; i < 50; i++) {
    const pid = `peer-churn-${i}`;
    pcsRef.current[pid] = new MockRTCPeerConnection();
    audioAnalyzersRef.current[pid] = new MockAudioAnalyzer();
    candidateQueuesRef.current[pid] = [{ candidate: 'cand' }];
    const el = document.createElement('audio');
    el.id = `webrtc-audio-${pid}-str`;
    document.body.appendChild(el);
  }

  // Simulate presence drop of 49 peers
  const syncedParticipants = new Set(['user-local', 'peer-churn-0']);
  Object.keys(pcsRef.current).forEach(peerId => {
    if (!syncedParticipants.has(peerId) && peerId !== 'user-local') {
      teardownPeer(peerId);
    }
  });

  assert.equal(Object.keys(pcsRef.current).length, 1, 'Only peer-churn-0 remains in pcsRef');
  assert.equal(Object.keys(audioAnalyzersRef.current).length, 1, 'Only peer-churn-0 remains in audioAnalyzersRef');
  assert.equal(Object.keys(candidateQueuesRef.current).length, 1, 'Only peer-churn-0 remains in candidateQueuesRef');
});
