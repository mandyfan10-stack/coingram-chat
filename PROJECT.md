# Project: Coiny E2EE & WebRTC Optimization & Hardening

## Architecture
- **E2EE Subsystem**: ECDH (P-256) + AES-GCM 256 zero-knowledge client-side encryption. Keys stored as non-extractable (`extractable: false`) `CryptoKey` objects in IndexedDB (`e2ee-keys` store). Backups encrypted via PBKDF2 (600,000 iterations, SHA-256). MITM protection via SHA-256 public key Safety Numbers (`getUint32`).
- **WebRTC Call Engine**: 1:1 and group voice/video mesh built on `RTCPeerConnection` and private Supabase Realtime channels (`call:chat:${chatId}:media` & `call:chat:${chatId}`). Perfect Negotiation (`polite`/`impolite`) glare resolution. ICE restart SDP offer transmission with `{ iceRestart: true }` and telemetry. Complete resource teardown (peer connections, AudioContext analyzers, DOM audio feeds) on presence disconnects.
- **Quality Assurance & Verification**: 124 unit/crypto tests via Node `test` runner (`npm test`: 100% pass rate) and strict TypeScript compilation (`npm run typecheck`: 0 errors).

## Feature Inventory & Requirement Mapping
| # | Feature / Requirement | Description | Milestone | Source |
|---|------------------------|-------------|-----------|--------|
| 1 | Private Key Non-Extractability & Zero-Knowledge | Fix `importPrivateKey(jwk, extractable)` signature, enforce `extractable: false` across all IndexedDB/context flows, verify zero plaintext key exposure in localStorage/server. | M1 | R1 |
| 2 | PBKDF2 & Crypto Hardening | Enforce 600,000 iterations PBKDF2 in backup/restore, fix `getUint32` in `computeSafetyNumber`, eliminate modulo bias in Base32 recovery code generation. | M1 | R1 |
| 3 | WebRTC ICE Restart & Signaling | Repair `retryCallConnection()` to send new SDP offer (`createOffer({ iceRestart: true })`) over signaling channel; improve ICE failover logging telemetry. | M2 | R2 |
| 4 | WebRTC Group Mesh Glare & Leaks | Implement Perfect Negotiation (`polite`/`impolite`) for group mesh joining to prevent `InvalidStateError`; teardown `RTCPeerConnection`, `AudioContext`, and DOM `<audio>` elements on abrupt presence disconnects. | M2 | R2 |
| 5 | Audio Analyzer & Track Lifecycle | Stop prior `AudioContext` analyzers before replacement in `ontrack`; clean up orphaned remote DOM `<audio>` feeds on stream change. | M2 | R2 |
| 6 | QA & Regression Defense | Add unit test assertions for `privateKey.extractable === false`, PBKDF2 600k iterations, ciphertext tamper rejection, and WebRTC mock connection teardown. Verify 100% `npm test` (97+ pass) and `npm run typecheck` (0 errors). | M3 | R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: E2EE Crypto Hardening & Key Isolation | Fix `importPrivateKey` parameter, enforce non-extractability, fix `computeSafetyNumber` `getUint32`, Base32 recovery code bias fix. | none | DONE |
| 2 | M2: WebRTC ICE Resilience & Track Teardown | Fix ICE restart signaling offer, Perfect Negotiation for group glare, abrupt presence teardown (PC, AudioContext, DOM audio), analyzer replacement cleanup. | M1 | DONE |
| 3 | M3: QA, Test Hardening & Final Gate | Add explicit unit test assertions for key extractability, PBKDF2 600k iterations, AES-GCM tamper rejection, WebRTC mock teardown; full audit & verification. | M1, M2 | DONE |

## Interface Contracts
### E2EE Subsystem (`src/utils/e2eeHelper.js` ↔ `E2EEContext.jsx`)
- `importPrivateKey(jwkString: string, extractable?: boolean): Promise<CryptoKey>`
- `computeSafetyNumber(keyA: string, keyB: string): Promise<string>` — returns `"##### ##### ##### ##### #####"` using `getUint32`.
- `backupPrivateKey(privateKeyJwk: string, password?: string, recoveryCode?: string): Promise<{ password_backup, recovery_backup }>` — uses 600,000 iterations PBKDF2.

### WebRTC Signaling & Connection (`src/context/calls/` ↔ UI)
- `retryCallConnection(): Promise<void>` — calls `pc.restartIce()`, generates offer with `iceRestart: true`, and broadcasts over signaling.
- `teardownMedia()` — closes all `pcsRef`, stops all `audioAnalyzersRef`, removes `.webrtc-remote-audio-feed` elements, stops all local tracks.

## Code Layout
- `src/utils/e2eeHelper.js`: E2EE cryptographic helper functions.
- `src/context/E2EEContext.jsx`: React context managing key loading, unlock, backup, and IndexedDB sync.
- `src/utils/indexedDbHelper.js`: IndexedDB `e2ee-keys` object store operations.
- `src/context/calls/CallProvider.jsx`: WebRTC call provider, peer connection state machine, mesh signaling.
- `src/context/calls/iceServers.ts`: ICE server definitions and `createPeerConnection`.
- `src/context/calls/useCallSignaling.js`: Supabase Realtime channel setup for calls.
- `src/context/calls/useCallMedia.js`: Media track toggle and renegotiation helpers.
- `src/context/calls/audioAnalyzer.js`: Web Audio API `AudioContext` volume analyzer.
- `testE2EE.js` & `tests/*.test.mjs`: Node test runner suite.
