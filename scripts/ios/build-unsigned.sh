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
# Ortam, Xcode seçimi ve prebuild ortak: scripts/ios/common.sh.

set -euo pipefail
# shellcheck source=scripts/ios/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

OUT_DIR="${1:-dist}"
[[ "$OUT_DIR" = /* ]] || OUT_DIR="$ROOT/$OUT_DIR"
mkdir -p "$OUT_DIR"

ios_prepare

ARCHIVE="$BUILD_DIR/$SCHEME.xcarchive"
LOG_FILE="$BUILD_DIR/xcodebuild.log"

# ── Arşiv (imzasız) ───────────────────────────────────────────────────────
log "xcodebuild archive — $SCHEME, Release, imzasız (günlük: $LOG_FILE)"
rm -rf "$ARCHIVE"
run_xcodebuild "$LOG_FILE" \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY= \
  archive ||
  fail "xcodebuild archive başarısız."

APP="$ARCHIVE/Products/Applications/$SCHEME.app"
[[ -d "$APP" ]] || fail "Arşivde uygulama yok: $APP"

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$1" "$APP/Info.plist" 2>/dev/null || true
}

# ── Doğrulama: çerçeveler arası eksik Swift sembolü ───────────────────────
# Uygulamadaki her ikili dosyanın, gömülü bir çerçeveye ait (Swift modül adı
# eşleşen) tanımsız sembolleri, uygulamadaki bir ikilide tanımlı olmalı.
# Olmazsa dyld açılışta "Symbol not found" ile düşer (hazır derlenmiş
# ExpoModulesCore ↔ kaynaktan derlenen ExpoModulesJSI uyumsuzluğu böyleydi).
check_linked_symbols() {
  local work="$BUILD_DIR/symbols" images=() modules=() framework name image
  rm -rf "$work"
  mkdir -p "$work"
  images+=("$APP/$(plist_value CFBundleExecutable)")
  for framework in "$APP"/Frameworks/*.framework; do
    [[ -d "$framework" ]] || continue
    name="$(basename "$framework" .framework)"
    images+=("$framework/$name")
    modules+=("${#name}${name}")
  done
  : >"$work/defined"
  for image in "${images[@]}"; do
    xcrun nm -gU "$image" 2>/dev/null | awk '{print $NF}' >>"$work/defined"
  done
  sort -u "$work/defined" -o "$work/defined"
  local pattern
  pattern="^_\\\$s($(IFS='|'; echo "${modules[*]}"))"
  local broken=0
  for image in "${images[@]}"; do
    { xcrun nm -u "$image" 2>/dev/null || true; } | awk '{print $NF}' |
      { grep -E "$pattern" || true; } | sort -u >"$work/undefined"
    comm -23 "$work/undefined" "$work/defined" >"$work/missing"
    if [[ -s "$work/missing" ]]; then
      echo "Eksik semboller — $(basename "$image"):" >&2
      head -5 "$work/missing" >&2
      broken=1
    fi
  done
  return "$broken"
}

if ! check_linked_symbols; then
  fail "Çerçeveler arası eksik sembol var — uygulama açılışta dyld hatasıyla düşer."
fi

VERSION="$(plist_value CFBundleShortVersionString)"
BUILD_NUMBER="$(plist_value CFBundleVersion)"
BUNDLE_ID="$(plist_value CFBundleIdentifier)"
COMMIT="$(git rev-parse --short=7 HEAD)"

# ── Doğrulama: açılışta çökme ve yanlış sunucu adresi yakalanır ───────────
[[ -n "$(plist_value GADApplicationIdentifier)" ]] ||
  fail "Info.plist'te GADApplicationIdentifier yok — AdMob SDK açılışta çöker."

JS_BUNDLE="$APP/main.jsbundle"
[[ -f "$JS_BUNDLE" ]] || fail "main.jsbundle yok — JS paketi uygulamaya gömülmemiş."
# .env.production'daki her EXPO_PUBLIC_* değeri pakete gömülmüş olmalı;
# Android emülatörünün yerel yığın adresi (10.0.2.2, yerel .env) olmamalı.
# "localhost:3000" ARANMAZ: UploadThing ve expo-router kendi varsayılan
# adreslerinde bu dizeyi taşıyor, uygulamanın yapılandırmasıyla ilgisi yok.
while IFS='=' read -r key value; do
  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  [[ -n "$value" ]] || continue
  grep -a -q -F "$value" "$JS_BUNDLE" ||
    fail "JS paketinde $key değeri ($value) yok — .env.production yüklenmemiş."
done < <(grep -E '^EXPO_PUBLIC_[A-Z0-9_]+=' .env.production || true)
if grep -a -q -F "10.0.2.2" "$JS_BUNDLE"; then
  fail "JS paketinde yerel geliştirme adresi (10.0.2.2) var — .env.production yüklenmemiş."
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
