#requires -Version 5.1
<#
.SYNOPSIS
  Push local android/keystores materials into GitHub Actions secrets for release.yml.
#>
[CmdletBinding()]
param(
  [string]$KeystoreDir = "",
  [string]$Repo = ""
)

$ErrorActionPreference = "Stop"
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $KeystoreDir) { $KeystoreDir = Join-Path $here "..\android\keystores" }
$KeystoreDir = [System.IO.Path]::GetFullPath($KeystoreDir)
$p12Path = Join-Path $KeystoreDir "coingram-release.p12"
$propsPath = Join-Path $KeystoreDir "signing.properties"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is required."
}
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "gh is not authenticated. Run: gh auth login" }

function Get-PropValue {
  param([string]$Path, [string]$Name)
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$Name=(.+)$" } | Select-Object -First 1
  if (-not $line) { throw "Property $Name not found in $Path" }
  return ($line -replace "^$Name=", "")
}

if (-not (Test-Path -LiteralPath $p12Path)) { throw "Missing $p12Path" }
if (-not (Test-Path -LiteralPath $propsPath)) { throw "Missing $propsPath" }

$storePassword = Get-PropValue $propsPath "storePassword"
$keyPassword = Get-PropValue $propsPath "keyPassword"
$keyAlias = Get-PropValue $propsPath "keyAlias"

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($p12Path))
$repoArgs = @()
if ($Repo) { $repoArgs = @("-R", $Repo) }

$b64 | gh secret set ANDROID_KEYSTORE_BASE64 @repoArgs
$storePassword | gh secret set ANDROID_KEYSTORE_PASSWORD @repoArgs
$keyAlias | gh secret set ANDROID_KEY_ALIAS @repoArgs
$keyPassword | gh secret set ANDROID_KEY_PASSWORD @repoArgs

Write-Host "GitHub secrets updated:"
Write-Host "  ANDROID_KEYSTORE_BASE64 ($($b64.Length) chars base64)"
Write-Host "  ANDROID_KEYSTORE_PASSWORD"
Write-Host "  ANDROID_KEY_ALIAS ($keyAlias)"
Write-Host "  ANDROID_KEY_PASSWORD"
