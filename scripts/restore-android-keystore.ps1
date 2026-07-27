#requires -Version 5.1
<#
.SYNOPSIS
  Decrypt a CGKS1 Android keystore backup into android/keystores/.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$DestinationDir = "",
  [string]$EncryptionPassword = $env:BACKUP_ENCRYPTION_PASSWORD
)

$ErrorActionPreference = "Stop"
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $DestinationDir) { $DestinationDir = Join-Path $here "..\android\keystores" }
$BackupFile = [System.IO.Path]::GetFullPath($BackupFile)
$DestinationDir = [System.IO.Path]::GetFullPath($DestinationDir)

if (-not (Test-Path -LiteralPath $BackupFile)) {
  throw "Backup not found: $BackupFile"
}

if (-not $EncryptionPassword) {
  $secure = Read-Host "Backup encryption password" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $EncryptionPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$bytes = [System.IO.File]::ReadAllBytes($BackupFile)
$magic = [Text.Encoding]::ASCII.GetString($bytes, 0, 5)
if ($magic -ne "CGKS1") { throw "Unknown backup magic: $magic" }
$version = $bytes[5]
if ($version -ne 1) { throw "Unsupported backup version: $version" }

$salt = $bytes[6..21]
$iv = $bytes[22..37]
$cipher = $bytes[38..($bytes.Length - 1)]

$aes = [System.Security.Cryptography.Aes]::Create()
$aes.KeySize = 256
$aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
$aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7

$derive = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
  $EncryptionPassword,
  [byte[]]$salt,
  200000,
  [System.Security.Cryptography.HashAlgorithmName]::SHA256
)
$aes.Key = $derive.GetBytes(32)
$aes.IV = [byte[]]$iv
$derive.Dispose()

try {
  $decryptor = $aes.CreateDecryptor()
  $plain = $decryptor.TransformFinalBlock([byte[]]$cipher, 0, $cipher.Length)
  $decryptor.Dispose()
} catch {
  throw "Decryption failed - wrong password or corrupt file. $($_.Exception.Message)"
} finally {
  $aes.Dispose()
}

$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("coingram-ks-restore-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Force -Path $stage | Out-Null
try {
  $tarPath = Join-Path $stage "payload.tar"
  [System.IO.File]::WriteAllBytes($tarPath, $plain)
  Push-Location $stage
  try {
    & tar -xf $tarPath
    if ($LASTEXITCODE -ne 0) { throw "tar extract failed" }
  } finally {
    Pop-Location
  }

  New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $stage "coingram-release.p12") -Destination (Join-Path $DestinationDir "coingram-release.p12") -Force
  Copy-Item -LiteralPath (Join-Path $stage "signing.properties") -Destination (Join-Path $DestinationDir "signing.properties") -Force

  $props = Join-Path $DestinationDir "signing.properties"
  $storePassword = (Get-Content $props | Where-Object { $_ -match '^storePassword=(.+)$' } | ForEach-Object { $Matches[1] })
  $keyAlias = (Get-Content $props | Where-Object { $_ -match '^keyAlias=(.+)$' } | ForEach-Object { $Matches[1] })
  $listOut = & keytool -list -keystore (Join-Path $DestinationDir "coingram-release.p12") -storetype PKCS12 -storepass $storePassword 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -or $listOut -notmatch [regex]::Escape($keyAlias)) {
    throw "Restored keystore failed verification.`n$listOut"
  }

  Write-Host "Restored to $DestinationDir"
  Write-Host "keytool verification OK (alias=$keyAlias)"
}
finally {
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}
