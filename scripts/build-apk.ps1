<#
.SYNOPSIS
  Builds a local Ciklet release APK.

.DESCRIPTION
  Copies the project to an ASCII-only work directory, runs Expo prebuild and
  Gradle, then copies the APK back to dist/. The ASCII copy is required because
  the U+0130 character in the repository path breaks Expo template copying on
  Windows. See docs/BUILD.md.

.PARAMETER WorkDir
  Dedicated ASCII build directory. Default: USERPROFILE\ciklet-build

.PARAMETER Clean
  Recreates the work directory and node_modules from scratch.
#>
[CmdletBinding()]
param(
  [string]$WorkDir = (Join-Path $env:USERPROFILE "ciklet-build"),
  [switch]$Clean
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedWorkDir = [System.IO.Path]::GetFullPath($WorkDir)
$workRoot = [System.IO.Path]::GetPathRoot($resolvedWorkDir)
$userRoot = [System.IO.Path]::GetFullPath($env:USERPROFILE)
$sourceRoot = [System.IO.Path]::GetFullPath($projectRoot)

if ($resolvedWorkDir -eq $workRoot -or $resolvedWorkDir -eq $userRoot -or $resolvedWorkDir -eq $sourceRoot) {
  throw "WorkDir must be a dedicated build directory."
}
$WorkDir = $resolvedWorkDir

function Assert-Tool {
  param([string]$Name, [string]$Check, [string]$Hint)
  if (-not (Invoke-Expression $Check)) {
    throw "$Name was not found. $Hint (see docs/BUILD.md)"
  }
}

$lock = Join-Path $WorkDir ".build-lock"
if (Test-Path -LiteralPath $lock) {
  $age = (Get-Date) - (Get-Item -LiteralPath $lock).LastWriteTime
  if ($age.TotalMinutes -lt 45) {
    throw "Another build appears active (started $([int]$age.TotalMinutes) minutes ago)."
  }
  Remove-Item -LiteralPath $lock -Force
}

Write-Host "== Prerequisites ==" -ForegroundColor Cyan

Assert-Tool -Name "JDK" `
  -Check '(Get-Command java -ErrorAction SilentlyContinue) -ne $null' `
  -Hint "Install JDK 17: winget install Microsoft.OpenJDK.17"

if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
  throw "ANDROID_HOME is not configured. Install Android Studio and configure the SDK path."
}

$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$javaVersion = (& java -version 2>&1 | Select-Object -First 1)
$ErrorActionPreference = $previousErrorPreference
$sdkPath = $env:ANDROID_HOME
if (-not $sdkPath) { $sdkPath = $env:ANDROID_SDK_ROOT }
Write-Host "  java : $javaVersion"
Write-Host "  sdk  : $sdkPath"

Write-Host "`n== Preparing work directory ==" -ForegroundColor Cyan

if ($Clean -and (Test-Path -LiteralPath $WorkDir)) {
  Write-Host "  removing: $WorkDir"
  Remove-Item -LiteralPath $WorkDir -Recurse -Force
}

New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
New-Item -ItemType File -Path $lock -Force | Out-Null

$excludeDirs = @("node_modules", "android", "ios", ".git", ".expo", "dist")
robocopy $projectRoot $WorkDir /E /MT:16 /NFL /NDL /NJH /NJS /XD $excludeDirs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

Write-Host "  copied -> $WorkDir"

Push-Location $WorkDir
try {
  Write-Host "`n== Syncing dependencies ==" -ForegroundColor Cyan
  npm install --prefer-offline
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

  Write-Host "`n== Expo prebuild ==" -ForegroundColor Cyan
  $androidDir = Join-Path $WorkDir "android"
  $expectedPrefix = $WorkDir + [System.IO.Path]::DirectorySeparatorChar
  if (-not $androidDir.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Invalid Android build path."
  }
  if (Test-Path -LiteralPath $androidDir) {
    Remove-Item -LiteralPath $androidDir -Recurse -Force
  }
  npx expo prebuild --platform android
  if ($LASTEXITCODE -ne 0) { throw "Expo prebuild failed" }

  $mainApplication = Join-Path $androidDir "app/src/main/java/com/ciklet/mobile/MainApplication.kt"
  if (-not (Test-Path -LiteralPath $mainApplication)) {
    throw "Expo prebuild did not generate the expected Android source tree."
  }

  Write-Host "`n== Gradle assembleRelease ==" -ForegroundColor Cyan
  Push-Location $androidDir
  try {
    & ./gradlew.bat assembleRelease --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "Gradle assembleRelease failed" }
  } finally {
    Pop-Location
  }

  $apk = Join-Path $androidDir "app/build/outputs/apk/release/app-release.apk"
  if (-not (Test-Path -LiteralPath $apk)) { throw "APK was not produced: $apk" }

  $version = (Get-Content (Join-Path $projectRoot "app.json") | ConvertFrom-Json).expo.version
  $distDir = Join-Path $projectRoot "dist"
  New-Item -ItemType Directory -Force -Path $distDir | Out-Null
  $target = Join-Path $distDir "ciklet-$version.apk"
  Copy-Item -LiteralPath $apk -Destination $target -Force

  $sizeMb = [math]::Round((Get-Item -LiteralPath $target).Length / 1MB, 1)
  Write-Host "`n== Complete ==" -ForegroundColor Green
  Write-Host "  APK  : $target ($sizeMb MB)"
  Write-Host "  Note : signed with the local debug keystore; suitable for device testing only." -ForegroundColor Yellow
}
finally {
  Pop-Location
  Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
}
