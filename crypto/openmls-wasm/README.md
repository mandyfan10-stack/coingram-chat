# OpenMLS WASM security gate

E2EE v2 is deliberately fail-closed. The client build rejects
`VITE_E2EE_V2_ENABLED=true` until this directory contains the audited custom
wrapper and its committed `Cargo.lock`, and `public/openmls` contains the
matching wasm-bindgen output.

The dependency is pinned by `OPENMLS_PIN.json`. The upstream demonstration
wrapper is not used directly: it currently selects a different ciphersuite and
does not implement Coiny's encrypted persistence and multi-device state
contract.

The wrapper must expose only the worker operations used by
`src/workers/mls.worker.ts`, use
`MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`, and must not enable OpenMLS
`content-debug` or `crypto-debug` features. Before enabling the flag, CI must
run `cargo fmt --check`, clippy with warnings denied, unit and known-answer
tests, `cargo audit`, a reproducible double build, wasm-bindgen tests, and verify
`OPENMLS_WASM_SHA256`. Production approval additionally requires the SHA-256
of an independent audit report in `E2EE_V2_AUDIT_REPORT_SHA256`.

No placeholder Rust implementation is included because an unreviewed crypto
wrapper would create a false security boundary. Until the gate is satisfied,
v1 remains readable and every v2 operation throws before processing data.
