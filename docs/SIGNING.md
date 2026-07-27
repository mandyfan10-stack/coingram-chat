# Signing — Android keystore & Windows Authenticode

Operational guide for release signing used by `.github/workflows/release.yml`.

---

## Android release keystore

| Item | Value |
|------|--------|
| Local files (gitignored) | `android/keystores/coingram-release.p12`, `signing.properties` |
| Alias | `coingram` (from `signing.properties`) |
| CI secrets | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |
| Loss impact | Cannot ship APK upgrades installable **over** previous release builds |

### Backup (required)

From the repo root on a machine that already has the keystore:

```powershell
powershell -File scripts/backup-android-keystore.ps1
```

This will:

1. Open the keystore with `keytool` and record cert fingerprints.
2. Write an **AES-256** encrypted archive to  
   `%USERPROFILE%\Documents\Coingram-secure-backups\coingram-android-keystore-<UTC>.bin`  
   plus `.meta.json` and `RESTORE.txt`.
3. Re-sync the four Android GitHub secrets from local files (unless `-SkipGitHubSecretSync`).

Encryption password defaults to `storePassword` from `signing.properties`. Override with `-EncryptionPassword` or `BACKUP_ENCRYPTION_PASSWORD`.

### Off-machine copies (owner checklist)

- [ ] Copy `.bin` + `.meta.json` to an **encrypted USB** stick (or hardware token vault).
- [ ] Copy to a **second location** (another PC, password-manager attachment, offline safe).
- [ ] Confirm restore works on a clean folder once:

```powershell
powershell -File scripts/restore-android-keystore.ps1 `
  -BackupFile "$env:USERPROFILE\Documents\Coingram-secure-backups\coingram-android-keystore-XXXX.bin" `
  -DestinationDir "$env:TEMP\coingram-ks-test"
```

- [ ] Do **not** commit `.bin`, `.p12`, or `signing.properties` to git.

### Re-sync CI only

```powershell
powershell -File scripts/sync-android-signing-secrets.ps1
```

---

## Windows Authenticode

| Item | Notes |
|------|--------|
| Current CI | Builds NSIS installer; signs **only if** secrets are set |
| Secrets | `WINDOWS_CERTIFICATE_BASE64` (PFX bytes as Base64), `WINDOWS_CERTIFICATE_PASSWORD` |
| Without secrets | Unsigned EXE → Windows SmartScreen warnings |
| Helper | `scripts/setup-windows-signing-secrets.ps1` |

### What you must purchase / obtain

Supabase Free→Pro style upgrade is **not** enough here. You need a **code signing certificate** from a public CA, typically:

| Option | Notes |
|--------|--------|
| **OV Code Signing** | Organization validated; cheaper; still SmartScreen reputation builds over time |
| **EV Code Signing** | Extended validation; faster SmartScreen reputation; often USB token / cloud HSM |
| **Azure Trusted Signing** | Microsoft cloud signing (subscription + identity validation); alternative to shipping a PFX |

Common vendors: DigiCert, Sectigo, SSL.com, GlobalSign. Expect identity/business verification (days–weeks).

**Self-signed certificates do not remove SmartScreen** and are not used in production releases.

### After you have a PFX

On your PC (PFX never committed to git):

```powershell
powershell -File scripts/setup-windows-signing-secrets.ps1 -PfxPath "C:\path\to\coiny-codesign.pfx"
# prompts for password; validates Code Signing EKU; sets GH secrets
```

Dry-run (no upload):

```powershell
powershell -File scripts/setup-windows-signing-secrets.ps1 -PfxPath "C:\path\to\coiny-codesign.pfx" -DryRun
```

Then cut a release tag as usual (`docs/RELEASING.md`). The Windows job will:

1. Decode and open the PFX before the Electron build.
2. Pass `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` to electron-builder.
3. Run `Get-AuthenticodeSignature` on the packaged installer.

### Cloud / token-based certs (no exportable PFX)

If your CA issues a **non-exportable** key (EV token, Azure Trusted Signing, DigiCert KeyLocker):

1. Do **not** use `WINDOWS_CERTIFICATE_BASE64`.
2. Extend the `windows` job with the vendor’s signing CLI (e.g. Azure Trusted Signing action, `smctl`, SSL.com eSigner).
3. Keep `docs/SIGNING.md` updated with the chosen path.

---

## Related

- [RELEASING.md](./RELEASING.md) — version tags and release flow  
- [OPS.md](./OPS.md) — residual platform risks  
- [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md) — phase F checklist  
