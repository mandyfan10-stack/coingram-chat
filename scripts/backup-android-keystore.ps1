#requires -Version 5.1
<#
.SYNOPSIS
  Verify the Android release keystore and write an AES-256 encrypted off-tree backup.

.DESCRIPTION
  Reads android/keystores/signing.properties + coingram-release.p12 (gitignored).
  Creates:
    <BackupRoot>/coingram-android-keystore-<UTC>.bin   encrypted payload
    <BackupRoot>/coingram-android-keystore-<UTC>.meta.json  non-secret metadata
    <BackupRoot>/RESTORE.txt

  Encryption password defaults to the keystore storePassword (one secret to remember).
  Override with -EncryptionPassword or env BACKUP_ENCRYPTION_PASSWORD.

  NEVER commit the .bin file or restore passwords into the git repo.
#>
[CmdletBinding()]
param(
  [string]$KeystoreDir = "",
  [string]$BackupRoot = "",
  [string]$EncryptionPassword = $env:BACKUP_ENCRYPTION_PASSWORD,
  [switch]$SkipGitHubSecretSync
)

$ErrorActionPreference = "Stop"
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $KeystoreDir) { $KeystoreDir = Join-Path $here "..\android\keystores" }
if (-not $BackupRoot) { $BackupRoot = Join-Path $env:USERPROFILE "Documents\Coingram-secure-backups" }
$KeystoreDir = [System.IO.Path]::GetFullPath($KeystoreDir)
$p12Path = Join-Path $KeystoreDir "coingram-release.p12"
$propsPath = Join-Path $KeystoreDir "signing.properties"

foreach ($p in @($p12Path, $propsPath)) {
  if (-not (Test-Path -LiteralPath $p)) {
    throw "Missing required file: $p"
  }
}

function Get-PropValue {
  param([string]$Path, [string]$Name)
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$Name=(.+)$" } | Select-Object -First 1
  if (-not $line) { throw "Property $Name not found in $Path" }
  return ($line -replace "^$Name=", "")
}

$storePassword = Get-PropValue $propsPath "storePassword"
$keyPassword = Get-PropValue $propsPath "keyPassword"
$keyAlias = Get-PropValue $propsPath "keyAlias"

if (-not $EncryptionPassword) {
  $EncryptionPassword = $storePassword
  Write-Host "Using storePassword as backup encryption password (override with -EncryptionPassword)."
}

# Verify keystore can be opened
$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
  throw "keytool not found on PATH (install a JDK)."
}

$listOut = & keytool -list -v -keystore $p12Path -storetype PKCS12 -storepass $storePassword 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $listOut -notmatch [regex]::Escape($keyAlias)) {
  throw "keytool -list failed or alias '$keyAlias' missing.`n$listOut"
}

$sha256 = if ($listOut -match "SHA256:\s*([0-9A-Fa-f:]+)") { $Matches[1] } else { $null }
$sha1 = if ($listOut -match "SHA1:\s*([0-9A-Fa-f:]+)") { $Matches[1] } else { $null }
$valid = if ($listOut -match "Valid from:\s*(.+)") { $Matches[1].Trim() } else { $null }

Write-Host "Keystore OK  alias=$keyAlias"
if ($sha256) { Write-Host "  SHA256=$sha256" }
if ($sha1) { Write-Host "  SHA1=$sha1" }

# Stage plaintext bundle in temp, then AES-encrypt
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss'Z'")
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("coingram-ks-stage-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Force -Path $stage | Out-Null

try {
  Copy-Item -LiteralPath $p12Path -Destination (Join-Path $stage "coingram-release.p12")
  Copy-Item -LiteralPath $propsPath -Destination (Join-Path $stage "signing.properties")

  $tarPath = Join-Path $stage "payload.tar"
  # Windows tar: create archive of the two files
  Push-Location $stage
  try {
    & tar -cf $tarPath "coingram-release.p12" "signing.properties"
    if ($LASTEXITCODE -ne 0) { throw "tar failed with exit $LASTEXITCODE" }
  } finally {
    Pop-Location
  }

  $plainBytes = [System.IO.File]::ReadAllBytes($tarPath)
  $aes = [System.Security.Cryptography.Aes]::Create()
  $aes.KeySize = 256
  $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
  $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7

  # Derive key from password with random salt (PBKDF2)
  $salt = New-Object byte[] 16
  $iv = New-Object byte[] 16
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($salt)
  $rng.GetBytes($iv)
  $rng.Dispose()

  $derive = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
    $EncryptionPassword,
    $salt,
    200000,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )
  $aes.Key = $derive.GetBytes(32)
  $aes.IV = $iv
  $derive.Dispose()

  $encryptor = $aes.CreateEncryptor()
  $cipher = $encryptor.TransformFinalBlock($plainBytes, 0, $plainBytes.Length)
  $encryptor.Dispose()
  $aes.Dispose()

  # File format: magic | version | salt | iv | ciphertext
  $magic = [Text.Encoding]::ASCII.GetBytes("CGKS1")
  $version = [byte[]]@(1)
  $outPath = Join-Path $BackupRoot "coingram-android-keystore-$stamp.bin"
  $fs = [System.IO.File]::Open($outPath, [System.IO.FileMode]::CreateNew)
  try {
    $fs.Write($magic, 0, $magic.Length)
    $fs.Write($version, 0, 1)
    $fs.Write($salt, 0, $salt.Length)
    $fs.Write($iv, 0, $iv.Length)
    $fs.Write($cipher, 0, $cipher.Length)
  } finally {
    $fs.Dispose()
  }

  $meta = [ordered]@{
    createdUtc        = (Get-Date).ToUniversalTime().ToString("o")
    format            = "CGKS1"
    kdf               = "PBKDF2-HMAC-SHA256"
    iterations        = 200000
    cipher            = "AES-256-CBC"
    keystoreFile      = "coingram-release.p12"
    propertiesFile    = "signing.properties"
    keyAlias          = $keyAlias
    certSha256        = $sha256
    certSha1          = $sha1
    certValidity      = $valid
    backupFile        = [IO.Path]::GetFileName($outPath)
    encryptionNote    = "Password is storePassword from signing.properties unless overridden at backup time."
    machine           = $env:COMPUTERNAME
    user              = $env:USERNAME
    projectHint       = "Documents/Coingram android release key"
  }
  $metaPath = Join-Path $BackupRoot "coingram-android-keystore-$stamp.meta.json"
  ($meta | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $metaPath -Encoding UTF8

  $restorePath = Join-Path $BackupRoot "RESTORE.txt"
  @"
CoinGram Android keystore - restore
===================================

Encrypted backup:  $([IO.Path]::GetFileName($outPath))
Metadata:          $([IO.Path]::GetFileName($metaPath))
Created (UTC):     $($meta.createdUtc)
Alias:             $keyAlias
Cert SHA-256:      $sha256

Restore (PowerShell, from repo root):

  powershell -File scripts/restore-android-keystore.ps1 ``
    -BackupFile "$outPath" ``
    -DestinationDir "android\keystores"

You will be prompted for the encryption password (default: storePassword
from the original signing.properties).

After restore, re-sync GitHub Actions secrets (optional):

  powershell -File scripts/sync-android-signing-secrets.ps1

OFF-MACHINE COPIES (required):
  1. Copy the .bin + .meta.json to an encrypted USB stick OR password manager vault attachment.
  2. Copy to a second physical location (another PC, safe deposit, cloud vault).
  3. Do NOT put the .bin inside the git repository.
  4. Losing this key blocks Play-style upgrades over existing release installs.
"@ | Set-Content -LiteralPath $restorePath -Encoding UTF8

  Write-Host ""
  Write-Host "Encrypted backup written:"
  Write-Host "  $outPath"
  Write-Host "  $metaPath"
  Write-Host "  $restorePath"
  Write-Host ""
  Write-Host "NEXT: copy .bin + .meta.json off this machine (USB / cloud vault)."
}
finally {
  if (Test-Path -LiteralPath $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if (-not $SkipGitHubSecretSync) {
  $sync = Join-Path $here "sync-android-signing-secrets.ps1"
  if (Test-Path -LiteralPath $sync) {
    Write-Host ""
    Write-Host "Syncing GitHub Actions Android signing secrets from local files..."
    & $sync
  }
}
