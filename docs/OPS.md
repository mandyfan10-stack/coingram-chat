# Operations & residual platform risks

Engineering items that depend on **billing, certificates, or operational choices** rather than code refactors (plan phase **F**).

---

## Supabase

| Item | Status | Action |
|------|--------|--------|
| RLS on app tables | Enabled (see migrations + security report) | Keep migrations as source of truth |
| Message rate limits | 25 / 10s, 300 / 5 min per user | Monitor abuse in production |
| Auth rate limits | 30 req / 5 min / IP | Keep; raise only with evidence |
| Storage 15 MiB + MIME allowlist | Server-side | Keep aligned with `mediaValidation.ts` |
| Orphan media cleanup Edge Function | Scheduled daily | Verify Vault secrets & cron after deploys |
| **Leaked-password protection** | **Unavailable on Free plan** | Accept risk **or** upgrade Supabase plan and enable in Auth settings |
| Unused indexes | Advisor informational | Reassess after real traffic; do not drop blindly |

Reference: [qa-security-report-2026-07-23.md](./qa-security-report-2026-07-23.md).

---

## Auth identity model

- New users: `{username}@coiny.users.local`  
- Legacy: `{username}@tg-clone.com` (dual-path login)  

**Ops note:** When deprecating legacy, plan a one-time user migration (Auth admin API) before removing the fallback in `authEmail.ts`.

---

## Android signing

| Item | Location / secret |
|------|-------------------|
| Local keystore | `android/keystores/` (gitignored) |
| Backup | Follow `android/keystores/BACKUP-INSTRUCTIONS.txt` — **off-machine encrypted copy required** |
| CI | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |

Loss of the release keystore blocks play-store-style upgrades over previous release builds.

See [RELEASING.md](./RELEASING.md).

---

## Windows Authenticode

| Item | Notes |
|------|--------|
| Current state | NSIS installer builds **without** trusted signature → SmartScreen warnings |
| CI readiness | Secrets `WINDOWS_CERTIFICATE_BASE64`, `WINDOWS_CERTIFICATE_PASSWORD` |
| Action | Purchase EV/OV code-signing cert → add secrets → re-run release workflow |

Until then, document SmartScreen for end users in release notes.

---

## GitHub Actions secrets (E2E)

Required for job `live-e2e` / `npm run test:e2e`:

- `E2E_USER_A` / `E2E_PASSWORD_A` / `E2E_ENCRYPTION_PASSWORD_A`  
- `E2E_USER_B` / `E2E_PASSWORD_B` / `E2E_ENCRYPTION_PASSWORD_B`  

Without them, live tests are **skipped** (unit suite still runs).

Full table: [live-e2e.md](./live-e2e.md).

---

## Local disk hygiene

Build artifacts are gitignored but grow large:

```bash
npm run clean:artifacts   # dist, dist-electron, android builds, playwright reports
npm run clean:all         # + node_modules
```

Prefer GitHub Releases for installers over keeping every `Setup *.exe` locally.

---

## Monitoring checklist (production)

1. Supabase Auth error rate / blocked IPs  
2. Message RPC latency (`get_latest_chat_messages`, `create_managed_chat`)  
3. Storage growth vs orphan cleanup job success  
4. Realtime connection errors on call topics  
5. CI: lint → typecheck → test → build on every PR  

---

## Explicit non-goals (this doc)

- Buying certificates or plan upgrades for the user  
- Running production migrations against live projects without review  
- Enabling features that require paid Supabase tiers without a decision  
