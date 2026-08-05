<#
.SYNOPSIS
  Ciklet mobil — yerel release APK üretir.

.DESCRIPTION
  Projeyi ASCII bir çalışma dizinine kopyalar, prebuild + gradle çalıştırır
  ve APK'yı `dist/` altına geri getirir.

  ASCII kopya NEDEN gerekli: proje yolundaki `İ` (U+0130) karakteri
  `expo prebuild`in şablon kopyalama adımını Windows'ta bozuyor —
  `android/` dizini boş kalıyor ve paket yeniden adlandırma
  "MainApplication does not exist" ile patlıyor. Ayrıntı: docs/BUILD.md.

  Kalıcı çözüm üst klasörü ASCII yapmaktır (CİKLET → CIKLET); bu betik
  o yapılana kadar geçerli bir köprüdür.

.PARAMETER WorkDir
  ASCII çalışma dizini. Varsayılan: $env:USERPROFILE\ciklet-build

.PARAMETER Clean
  Çalışma dizinini ve node_modules'ü sıfırdan kurar (yavaş ama kesin).

.EXAMPLE
  .\scripts\build-apk.ps1
  .\scripts\build-apk.ps1 -Clean
#>
[CmdletBinding()]
param(
  [string]$WorkDir = (Join-Path $env:USERPROFILE "ciklet-build"),
  [switch]$Clean
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

function Assert-Tool {
  param([string]$Name, [string]$Check, [string]$Hint)
  if (-not (Invoke-Expression $Check)) {
    throw "$Name bulunamadı. $Hint (bkz. docs/BUILD.md)"
  }
}

# ── Eşzamanlı çalışmayı engelle ───────────────────────────────────────
# İki derleme aynı çalışma dizinini paylaşırsa biri diğerinin android/
# ağacını silerken prebuild patlıyor (yaşandı). Basit bir kilit dosyası
# yeterli: derleme zaten uzun sürüyor, kuyruğa almaya gerek yok.
$lock = Join-Path $WorkDir ".build-lock"
if (Test-Path $lock) {
  $age = (Get-Date) - (Get-Item $lock).LastWriteTime
  if ($age.TotalMinutes -lt 45) {
    throw "Başka bir derleme sürüyor gibi görünüyor ($([int]$age.TotalMinutes) dk önce başladı). Bitmesini bekle veya `"$lock`" dosyasını sil."
  }
  Remove-Item $lock -Force
}

Write-Host "== Ön koşullar ==" -ForegroundColor Cyan

Assert-Tool -Name "JDK" `
  -Check '(Get-Command java -ErrorAction SilentlyContinue) -ne $null' `
  -Hint "JDK 17 kur: winget install Microsoft.OpenJDK.17"

if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
  throw "ANDROID_HOME tanımlı değil. Android Studio kurup ortam değişkenini ayarla (bkz. docs/BUILD.md)."
}

$javaVersion = (& java -version 2>&1 | Select-Object -First 1)
Write-Host "  java : $javaVersion"
Write-Host "  sdk  : $($env:ANDROID_HOME ?? $env:ANDROID_SDK_ROOT)"

# ── ASCII çalışma dizinine kopyala ────────────────────────────────────
Write-Host "`n== Çalışma dizini hazırlanıyor ==" -ForegroundColor Cyan

# Kilidi kopyalamadan ÖNCE al: robocopy de aynı paylaşılan dizine yazıyor.
New-Item -ItemType File -Path $lock -Force | Out-Null

if ($Clean -and (Test-Path $WorkDir)) {
  Write-Host "  temizleniyor: $WorkDir"
  cmd /c rmdir /s /q "$WorkDir"
}

# node_modules ve android bilerek dışarıda: ilki çok yavaş kopyalanır ve
# eksik kopya modül çözümlemesini bozar, ikincisi prebuild tarafından
# yeniden üretilir.
$excludeDirs = @("node_modules", "android", "ios", ".git", ".expo", "dist")
robocopy $projectRoot $WorkDir /E /MT:16 /NFL /NDL /NJH /NJS /XD $excludeDirs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy başarısız (kod $LASTEXITCODE)" }

Write-Host "  kopyalandı -> $WorkDir"

Push-Location $WorkDir
try {
  if (-not (Test-Path "node_modules")) {
    Write-Host "`n== Bağımlılıklar kuruluyor ==" -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install başarısız" }
  }

  Write-Host "`n== Prebuild ==" -ForegroundColor Cyan
  if (Test-Path "android") { cmd /c rmdir /s /q "android" }
  npx expo prebuild --platform android
  if ($LASTEXITCODE -ne 0) { throw "prebuild başarısız" }

  if (-not (Test-Path "android/app/src/main/java/com/ciklet/mobile/MainApplication.kt")) {
    throw "prebuild android/ ağacını üretmedi — docs/BUILD.md'deki yol sorununa bak."
  }

  Write-Host "`n== Gradle assembleRelease ==" -ForegroundColor Cyan
  Write-Host "  (ilk derleme 20-40 dk sürebilir)"
  Push-Location "android"
  try {
    & ./gradlew.bat assembleRelease --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease başarısız" }
  } finally {
    Pop-Location
  }

  # ── APK'yı geri getir ───────────────────────────────────────────────
  $apk = Join-Path $WorkDir "android/app/build/outputs/apk/release/app-release.apk"
  if (-not (Test-Path $apk)) { throw "APK üretilmedi: $apk" }

  $version = (Get-Content (Join-Path $projectRoot "app.json") | ConvertFrom-Json).expo.version
  $distDir = Join-Path $projectRoot "dist"
  New-Item -ItemType Directory -Force -Path $distDir | Out-Null
  $target = Join-Path $distDir "ciklet-$version.apk"
  Copy-Item $apk $target -Force

  $sizeMb = [math]::Round((Get-Item $target).Length / 1MB, 1)
  Write-Host "`n== Bitti ==" -ForegroundColor Green
  Write-Host "  APK  : $target ($sizeMb MB)"
  Write-Host "  Kur  : adb install -r `"$target`""
  Write-Host "`n  Not: debug keystore ile imzalı — cihazda deneme için uygun," -ForegroundColor Yellow
  Write-Host "       Play Store'a yüklenemez (bkz. docs/BUILD.md)." -ForegroundColor Yellow
}
finally {
  Pop-Location
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
}
