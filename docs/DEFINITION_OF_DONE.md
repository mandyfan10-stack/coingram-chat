# Definition of Done — remediation plan (A–G)

Checklist for the Coiny tech-debt / quality plan executed on the `Documents/Coingram` tree.

Legend: ✅ done in code · ⏳ ops / budget · ➖ deferred by design

---

## Phase A — Quick fixes

- [x] No stale app version literals in `src/` (use `import.meta.env.APP_VERSION`)
- [x] `npm run release:verify -- vX.Y.Z` checks package.json + src literals
- [x] `npm run clean:artifacts` / `clean:all` + README hygiene section
- [x] Update-check skips when `APP_VERSION` missing

## Phase B — God-file decomposition

- [x] B1: pure utils extracted (sounds, formatLastSeen, offline helpers, mocks)
- [x] B5: `dataLayer` → auth / chat / message / media services + facade
- [x] B2: `ChatContext` → `src/context/chat/*` hooks
- [x] B4: `CallContext` → `src/context/calls/*`
- [x] B3: `ChatArea` → `src/components/chat/*`
- [x] B6: `SettingsModal` → `src/components/settings/*` tabs
- [x] Public APIs preserved (`useChat`, `useCalls`, `dataService`, imports)

## Phase C — Auth dual-path

- [x] Modern signup email `@coiny.users.local`
- [x] Login dual-path modern → legacy `@tg-clone.com`
- [x] Username validation; mock `passwordHash`
- [x] README + unit tests (`authEmail`)

## Phase D — Gradual TypeScript

- [x] `tsconfig.json`, `typescript` devDep
- [x] Shared types in `src/types/`
- [x] Core modules on TS (`authEmail`, `mediaValidation`, `reactionUtils`, ICE, themes, …)
- [x] `npm run typecheck` in CI + release workflows
- [x] `e2eeHelper.d.ts` for JS crypto surface

## Phase E — Test gaps

- [x] Offline queue unit tests + injectable process path
- [x] WebRTC e2e asserts live remote audio feeds (fake devices)
- [x] E2EE regression (wrong secret, reload re-derive, Safety Number UI)
- [x] `docs/live-e2e.md` secrets table + manual checklists

## Phase F — Platform / ops

- [x] Document residual risks in [OPS.md](./OPS.md)
- [x] Releasing / keystore / E2E secrets cross-linked
- [x] Supabase leaked-password protection (plan upgraded + enabled by owner)
- [x] Android keystore encrypted backup tooling + local archive + CI secret re-sync ([SIGNING.md](./SIGNING.md))
- [ ] ⏳ Owner: copy keystore `.bin` off-machine (USB / second vault) and tick checklist in SIGNING.md
- [x] Windows Authenticode CI path hardened (PFX validate + signature check + setup script)
- [ ] ⏳ Purchase OV/EV (or Azure Trusted Signing) + run `setup-windows-signing-secrets.ps1`

## Phase G — Documentation

- [x] [ARCHITECTURE.md](./ARCHITECTURE.md)
- [x] README structure section updated (post-refactor)
- [x] This DoD document

---

## Quality gates (must stay green)

```bash
npm run lint
npm run typecheck
npm test
npm run build
# optional with secrets:
npm run test:e2e
```

---

## Explicit out of scope (unchanged)

- Full TypeScript rewrite of all JSX contexts  
- iOS Capacitor target  
- Signal Double Ratchet replacement for ECDH+AES  
- Custom backend replacing Supabase  
- UI redesign  
