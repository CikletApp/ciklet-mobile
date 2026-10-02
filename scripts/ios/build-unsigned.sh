#!/usr/bin/env bash
#
# iOS — imzasız IPA derlemesi.
#
# GitHub Actions'ın macOS makinesinde de, kendi Mac'inde de (self-hosted
# runner ya da elle Terminal'den) aynı şekilde çalışır:
#
#   npm ci && bash scripts/ios/build-unsigned.sh [çıktı-klasörü]   # varsayılan: dist
#
# Çıktı: <çıktı>/ciklet-<sürüm>-<commit>-unsigned.ipa
#   - Sürüm = git commit sayısı (app.config.js). Sığ klonda sayı yanlış
#     çıkar; CI'da tam geçmişle (fetch-depth: 0) klonlanmalı.
#   - İMZASIZ: cihaza doğrudan kurulamaz. AltStore, Sideloadly, ESign gibi
#     bir araçla kendi Apple kimliğinle imzalanıp yüklenir.
#
# Gereksinimler: Xcode 26.4+ (Expo SDK 57), CocoaPods, Node 22, python3
# (AdMob'un derleme betiği app.json'u python3 ile okuyor).
#
# İsteğe bağlı ortam: XCODE_APP=/Applications/Xcode.app (Xcode'u elle seç).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-dist}"
[[ "$OUT_DIR" = /* ]] || OUT_DIR="$ROOT/$OUT_DIR"
BUILD_DIR="$ROOT/build/ios"
LOG_FILE="$BUILD_DIR/xcodebuild.log"
MIN_XCODE="26.4"

cd "$ROOT"
mkdir -p "$OUT_DIR" "$BUILD_DIR"

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

# ── Ortam ─────────────────────────────────────────────────────────────────
# Self-hosted runner LaunchAgent olarak koşarken PATH Homebrew'u içermeyebilir.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# CocoaPods UTF-8 olmayan yerel ayarda "Unicode Normalization" hatasıyla düşer.
export LANG="en_US.UTF-8" LC_ALL="en_US.UTF-8"
# Release paketi .env.production'ı yüklesin (yerel .env değil).
export NODE_ENV=production
# app.config.js / react-native.config.js iOS hedefini bilsin.
export CIKLET_PREBUILD_PLATFORM=ios
export CI=1 EXPO_NO_GIT_STATUS=1 EXPO_NO_TELEMETRY=1

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

# ── Prebuild + CocoaPods ──────────────────────────────────────────────────
log "Expo prebuild (iOS, temiz)"
npx expo prebuild --platform ios --clean

WORKSPACE="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
[[ -n "$WORKSPACE" ]] || fail "ios/*.xcworkspace yok — pod install çalışmamış."
SCHEME="$(basename "$WORKSPACE" .xcworkspace)"
ARCHIVE="$BUILD_DIR/$SCHEME.xcarchive"

# ── Arşiv (imzasız) ───────────────────────────────────────────────────────
log "xcodebuild archive — $SCHEME, Release, imzasız (günlük: $LOG_FILE)"
rm -rf "$ARCHIVE"

archive() {
  local args=(
    -workspace "$WORKSPACE"
    -scheme "$SCHEME"
    -configuration Release
    -destination "generic/platform=iOS"
    -archivePath "$ARCHIVE"
    CODE_SIGNING_ALLOWED=NO
    CODE_SIGNING_REQUIRED=NO
    CODE_SIGN_IDENTITY=
    archive
  )
  if command -v xcbeautify >/dev/null 2>&1; then
    xcodebuild "${args[@]}" 2>&1 | tee "$LOG_FILE" | xcbeautify --quiet
  else
    xcodebuild "${args[@]}" >"$LOG_FILE" 2>&1
  fi
}

if ! archive; then
  echo "── xcodebuild hataları ──" >&2
  grep -E "(error|fatal error):|\*\* ARCHIVE FAILED" "$LOG_FILE" | head -60 >&2 || true
  echo "── günlüğün sonu ──" >&2
  tail -n 60 "$LOG_FILE" >&2 || true
  fail "xcodebuild archive başarısız."
fi

APP="$ARCHIVE/Products/Applications/$SCHEME.app"
[[ -d "$APP" ]] || fail "Arşivde uygulama yok: $APP"

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$1" "$APP/Info.plist" 2>/dev/null || true
}

VERSION="$(plist_value CFBundleShortVersionString)"
BUILD_NUMBER="$(plist_value CFBundleVersion)"
BUNDLE_ID="$(plist_value CFBundleIdentifier)"
COMMIT="$(git rev-parse --short=7 HEAD)"

# ── Doğrulama: açılışta çökme ve yanlış sunucu adresi yakalanır ───────────
[[ -n "$(plist_value GADApplicationIdentifier)" ]] ||
  fail "Info.plist'te GADApplicationIdentifier yok — AdMob SDK açılışta çöker."

JS_BUNDLE="$APP/main.jsbundle"
[[ -f "$JS_BUNDLE" ]] || fail "main.jsbundle yok — JS paketi uygulamaya gömülmemiş."
EXPECTED_API="$(grep -E '^EXPO_PUBLIC_API_URL=' .env.production | head -1 | cut -d= -f2- | tr -d '\r' || true)"
if [[ -n "$EXPECTED_API" ]] && ! grep -a -q -F "$EXPECTED_API" "$JS_BUNDLE"; then
  fail "JS paketinde üretim adresi ($EXPECTED_API) yok."
fi
if grep -a -q -E "10\.0\.2\.2|localhost:3000" "$JS_BUNDLE"; then
  fail "JS paketinde yerel geliştirme adresi var — .env.production yüklenmemiş."
fi

# ── IPA: Payload/<Uygulama>.app → zip ─────────────────────────────────────
NAME="ciklet-${VERSION}-${COMMIT}-unsigned.ipa"
STAGE="$BUILD_DIR/ipa"
rm -rf "$STAGE"
mkdir -p "$STAGE/Payload"
ditto "$APP" "$STAGE/Payload/$(basename "$APP")"
rm -f "$OUT_DIR/$NAME"
(cd "$STAGE" && zip -qry "$OUT_DIR/$NAME" Payload)
SIZE="$(du -h "$OUT_DIR/$NAME" | cut -f1 | tr -d ' ')"

log "Hazır: $OUT_DIR/$NAME ($SIZE) — sürüm $VERSION ($BUILD_NUMBER), $BUNDLE_ID, commit $COMMIT"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "ipa_path=$OUT_DIR/$NAME"
    echo "ipa_name=${NAME%.ipa}"
    echo "version=$VERSION"
  } >>"$GITHUB_OUTPUT"
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat >>"$GITHUB_STEP_SUMMARY" <<SUMMARY
### iOS — imzasız IPA

| | |
|---|---|
| Dosya | \`$NAME\` ($SIZE) |
| Sürüm (derleme) | $VERSION ($BUILD_NUMBER) |
| Paket kimliği | $BUNDLE_ID |
| Commit | $COMMIT |
| Xcode | $XCODE_VERSION |

İmzasız: cihaza kurmak için AltStore, Sideloadly ya da ESign gibi bir araçla kendi Apple kimliğinle imzala.
SUMMARY
fi
