#requires -Version 5.1
<#
.SYNOPSIS
  Encode a Windows code-signing PFX and upload Authenticode secrets for release.yml.

.EXAMPLE
  powershell -File scripts/setup-windows-signing-secrets.ps1 -PfxPath .\certs\coiny-codesign.pfx
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$PfxPath,
  [string]$PfxPassword = $env:WINDOWS_CERTIFICATE_PASSWORD,
  [string]$Repo = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$PfxPath = [System.IO.Path]::GetFullPath($PfxPath)
if (-not (Test-Path -LiteralPath $PfxPath)) {
  throw "PFX not found: $PfxPath"
}

if (-not $PfxPassword) {
  $secure = Read-Host "PFX password" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $PfxPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

# Validate PFX opens
try {
  $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
    $PfxPath,
    $PfxPassword,
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
  )
} catch {
  throw "Cannot open PFX (wrong password or corrupt file): $($_.Exception.Message)"
}

$eku = ($cert.Extensions | Where-Object { $_ -is [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension] })
$hasCodeSign = $false
if ($eku) {
  foreach ($oid in $eku.EnhancedKeyUsages) {
    if ($oid.Value -eq "1.3.6.1.5.5.7.3.3") { $hasCodeSign = $true }
  }
}

Write-Host "PFX OK"
Write-Host "  Subject:   $($cert.Subject)"
Write-Host "  Issuer:    $($cert.Issuer)"
Write-Host "  NotAfter:  $($cert.NotAfter.ToString('u'))"
Write-Host "  Thumbprint:$($cert.Thumbprint)"
Write-Host "  CodeSign EKU: $hasCodeSign"
if (-not $hasCodeSign) {
  Write-Warning "Certificate may lack Code Signing EKU (1.3.6.1.5.5.7.3.3). Confirm with your CA."
}

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($PfxPath))
Write-Host "  Base64 length: $($b64.Length)"

if ($DryRun) {
  Write-Host "DryRun: not uploading secrets."
  $cert.Dispose()
  return
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is required (or re-run with -DryRun)."
}
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "gh is not authenticated. Run: gh auth login" }

$repoArgs = @()
if ($Repo) { $repoArgs = @("-R", $Repo) }

$b64 | gh secret set WINDOWS_CERTIFICATE_BASE64 @repoArgs
$PfxPassword | gh secret set WINDOWS_CERTIFICATE_PASSWORD @repoArgs

Write-Host "GitHub secrets set: WINDOWS_CERTIFICATE_BASE64, WINDOWS_CERTIFICATE_PASSWORD"
Write-Host "Next release tag will Authenticode-sign the NSIS installer (electron-builder WIN_CSC_*)."
$cert.Dispose()
