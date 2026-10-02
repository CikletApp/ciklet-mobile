#!/usr/bin/env bash
#
# iOS betiklerinin ortak hazırlığı: build-unsigned.sh ve smoke-simulator.sh
# bunu `source` eder. Çağıran `set -euo pipefail` açmış olmalı.
#
# Sağladıkları:
#   ROOT, BUILD_DIR, log, fail, run_xcodebuild
#   ios_prepare: ortam + Xcode seçimi + temiz prebuild; ardından WORKSPACE,
#                SCHEME, XCODE, XCODE_VERSION tanımlıdır.
#
# Gereksinimler: Xcode 26.4+ (Expo SDK 57), CocoaPods, Node 22, python3
# (AdMob'un derleme betiği app.json'u python3 ile okuyor).
# İsteğe bağlı ortam: XCODE_APP=/Applications/Xcode.app (Xcode'u elle seç).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="$ROOT/build/ios"
MIN_XCODE="26.4"

log() { printf '\n▶ %s\n' "$*"; }

fail() {
  printf '\n✖ %s\n' "$*" >&2
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then printf '::error::%s\n' "$*"; fi
  exit 1
}

# a >= b ? (nokta ayrımlı sürümler, ör. 26.4.1 >= 26.4)
version_ge() {
  awk -v a="$1" -v b="$2" 'BEGIN {
    n = split(a, x, "."); m = split(b, y, "."); k = (n > m ? n : m)
    for (i = 1; i <= k; i++) {
      xi = (i <= n ? x[i] + 0 : 0); yi = (i <= m ? y[i] + 0 : 0)
      if (xi > yi) exit 0
      if (xi < yi) exit 1
    }
    exit 0
  }'
}

xcode_version_of() {
  /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$1/Contents/Info.plist" 2>/dev/null || echo 0
}

# Seçim sırası: XCODE_APP → zaten seçili Xcode (yeterince yeniyse; platformları
# kurulu olan odur) → /Applications altındaki en yeni beta OLMAYAN Xcode.
pick_xcode() {
  if [[ -n "${XCODE_APP:-}" ]]; then
    echo "$XCODE_APP"
    return
  fi
  local current
  current="$(xcode-select -p 2>/dev/null || true)"
  current="${current%/Contents/Developer}"
  if [[ -d "$current" ]] && version_ge "$(xcode_version_of "$current")" "$MIN_XCODE"; then
    echo "$current"
    return
  fi
  local best="" best_version="0" app version
  for app in /Applications/Xcode*.app; do
    [[ -d "$app" ]] || continue
    case "$app" in *[Bb]eta*) continue ;; esac
    version="$(xcode_version_of "$app")"
    if version_ge "$version" "$best_version"; then
      best="$app"
      best_version="$version"
    fi
  done
  echo "$best"
}

# xcodebuild'i çalıştırır; tam günlük $1'e yazılır, hata olursa özeti basar.
run_xcodebuild() {
  local log_file="$1" status=0
  shift
  if command -v xcbeautify >/dev/null 2>&1; then
    xcodebuild "$@" 2>&1 | tee "$log_file" | xcbeautify --quiet || status=$?
  else
    xcodebuild "$@" >"$log_file" 2>&1 || status=$?
  fi
  if [[ $status -ne 0 ]]; then
    echo "── xcodebuild hataları ──" >&2
    grep -E "(error|fatal error):|\*\* (ARCHIVE|BUILD) FAILED" "$log_file" | head -60 >&2 || true
    echo "── günlüğün sonu ──" >&2
    tail -n 60 "$log_file" >&2 || true
  fi
  return "$status"
}

ios_prepare() {
  cd "$ROOT"
  mkdir -p "$BUILD_DIR"

  # Self-hosted runner LaunchAgent olarak koşarken PATH Homebrew'u içermeyebilir.
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  # CocoaPods UTF-8 olmayan yerel ayarda "Unicode Normalization" hatasıyla düşer.
  export LANG="en_US.UTF-8" LC_ALL="en_US.UTF-8"
  # Release paketi .env.production'ı yüklesin (yerel .env değil).
  export NODE_ENV=production
  # app.config.js iOS hedefini bilsin (Firebase eklentileri iOS'ta çıkarılır).
  export CIKLET_PREBUILD_PLATFORM=ios
  export CI=1 EXPO_NO_GIT_STATUS=1 EXPO_NO_TELEMETRY=1

  local tool
  for tool in node npx pod python3 git zip; do
    command -v "$tool" >/dev/null 2>&1 || fail "'$tool' bulunamadı. (CocoaPods: brew install cocoapods)"
  done

  XCODE="$(pick_xcode)"
  [[ -n "$XCODE" && -d "$XCODE" ]] || fail "Xcode bulunamadı (/Applications/Xcode*.app)."
  export DEVELOPER_DIR="$XCODE/Contents/Developer"
  XCODE_VERSION="$(xcode_version_of "$XCODE")"
  version_ge "$XCODE_VERSION" "$MIN_XCODE" ||
    fail "Xcode $XCODE_VERSION eski; Expo SDK 57 için $MIN_XCODE+ gerekli ($XCODE)."
  xcrun --sdk iphoneos --show-sdk-version >/dev/null 2>&1 ||
    fail "Xcode $XCODE_VERSION içinde iOS SDK yok (Xcode > Settings > Components)."

  log "Xcode $XCODE_VERSION ($XCODE), iOS SDK $(xcrun --sdk iphoneos --show-sdk-version), Node $(node -v), CocoaPods $(pod --version)"

  # Metro dönüşüm önbelleği EXPO_PUBLIC_* değerlerini anahtarına katmıyor;
  # eski bir yerel derlemenin önbelleği paketi yanlış adreslerle üretebiliyor.
  rm -rf "$ROOT/node_modules/.cache" "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-* 2>/dev/null || true

  log "Expo prebuild (iOS, temiz)"
  npx expo prebuild --platform ios --clean

  WORKSPACE="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
  [[ -n "$WORKSPACE" ]] || fail "ios/*.xcworkspace yok — pod install çalışmamış."
  SCHEME="$(basename "$WORKSPACE" .xcworkspace)"
}
