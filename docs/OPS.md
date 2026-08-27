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
| **Leaked-password protection** | **Enabled** (plan upgraded) | Keep on in Auth settings; re-check after any plan change |
| Unused indexes | Advisor informational | Reassess after real traffic; do not drop blindly |

Reference: [qa-security-report-2026-07-23.md](./qa-security-report-2026-07-23.md).

---

## Auth identity model

- New users: `{username}@coiny.users.local`  
- Legacy: `{username}@tg-clone.com` (dual-path login)  

These addresses are **not real mailboxes**. Hosted Supabase has **Confirm email** on by default; unconfirmed users then get HTTP 400 from `/auth/v1/token?grant_type=password`.

- Keep **Authentication → Providers → Email → Confirm email** **off** for this project.
- Migration `20260827120000_auto_confirm_synthetic_auth_emails.sql` auto-confirms only the two synthetic domains and backfills existing rows. Apply it to the hosted project (`supabase db push` or SQL editor).
- Username login first calls `resolve_username_auth_email` and then makes **one** password grant. Dual-path (modern → legacy) remains only as a fallback if the RPC is missing. A remaining 400 is a real credential failure, not the unused scheme.

**Ops note:** When deprecating legacy, plan a one-time user migration (Auth admin API) before removing the fallback in `authEmail.ts`.

---

## Android signing

| Item | Location / secret |
|------|-------------------|
| Local keystore | `android/keystores/` (gitignored) |
| Encrypted backup script | `scripts/backup-android-keystore.ps1` → `%USERPROFILE%\Documents\Coingram-secure-backups\` |
| Restore script | `scripts/restore-android-keystore.ps1` |
| CI sync | `scripts/sync-android-signing-secrets.ps1` (four `ANDROID_*` secrets) |
| Full guide | [SIGNING.md](./SIGNING.md) |

Local backup archive is created on-disk; **owner must still copy `.bin` + `.meta.json` off this machine** (USB / vault). Loss of the release keystore blocks upgrades over previous release installs.

See [RELEASING.md](./RELEASING.md).

---

## Windows Authenticode

| Item | Notes |
|------|--------|
| Current state | NSIS installer builds **unsigned** until a CA-issued code-signing cert is purchased |
| CI | Validates PFX, sets `WIN_CSC_*`, verifies signature with `Get-AuthenticodeSignature` when secrets exist |
| Secrets | `WINDOWS_CERTIFICATE_BASE64`, `WINDOWS_CERTIFICATE_PASSWORD` |
| Upload helper | `scripts/setup-windows-signing-secrets.ps1 -PfxPath <file.pfx>` |
| Action left | Purchase OV/EV (or Azure Trusted Signing) → run setup script → tag a release |

Until then, mention SmartScreen in release notes. Details: [SIGNING.md](./SIGNING.md).

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

- Buying Windows Authenticode certificates for the user  
- Running production migrations against live projects without review  
- Changing Supabase plan tiers without an explicit owner decision
