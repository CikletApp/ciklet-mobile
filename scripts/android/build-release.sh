#!/usr/bin/env bash
#
# Android — üretim release APK'sı.
#
# GitHub Actions'ın Linux makinesinde de yerelde de (Git Bash, macOS, Linux)
# aynı şekilde çalışır:
#
#   npm ci && bash scripts/android/build-release.sh [çıktı-klasörü]   # varsayılan: dist
#
# Çıktı: <çıktı>/ciklet-<sürüm>-<commit>-prod.apk
#   - Sürüm = git commit sayısı (app.config.js). IPA ile aynı commit'ten
#     derlenince numaralar aynıdır (iş akışı ikisini birlikte çıkarır).
#   - İmza: android/app/debug.keystore — Expo şablonunun anahtarı, yerel
#     derlemelerle aynı; telefondaki uygulamanın üstüne kurulur.
#   - Adresler .env.production'dan (NODE_ENV=production).
#
# Gereksinimler: JDK 21 (ya da 17), Android SDK (ANDROID_HOME), Node 22.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-dist}"
case "$OUT_DIR" in
  /* | [A-Za-z]:*) ;;
  *) OUT_DIR="$ROOT/$OUT_DIR" ;;
esac

cd "$ROOT"
mkdir -p "$OUT_DIR"

log() { printf '\n▶ %s\n' "$*"; }
fail() {
  printf '\n✖ %s\n' "$*" >&2
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then printf '::error::%s\n' "$*"; fi
  exit 1
}

# Release paketi .env.production'ı yüklesin. Gradle'ın JS paketleme görevi
# ortamdaki NODE_ENV'e bakıyor; yoksa yerel .env (10.0.2.2) gömülüyordu.
export NODE_ENV=production
export CI=1 EXPO_NO_GIT_STATUS=1 EXPO_NO_TELEMETRY=1

[[ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]] || fail "ANDROID_HOME tanımlı değil (Android SDK)."
command -v java >/dev/null 2>&1 || fail "java bulunamadı (JDK 21)."
for tool in node npx git unzip; do
  command -v "$tool" >/dev/null 2>&1 || fail "'$tool' bulunamadı."
done

log "Java: $(java -version 2>&1 | head -1), Node $(node -v), commit $(git rev-parse --short=7 HEAD)"

# Metro dönüşüm önbelleği EXPO_PUBLIC_* değerlerini anahtarına katmıyor;
# eski bir yerel derlemenin önbelleği paketi yanlış adreslerle üretebiliyor.
rm -rf "$ROOT/node_modules/.cache" "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-* 2>/dev/null || true

# --clean: depoda android/ altında yalnızca birkaç izlenen dosya var; temiz
# klonda klasör yarım olduğu için şablondan baştan üretilmeli.
log "Expo prebuild (Android, temiz)"
npx expo prebuild --platform android --clean --no-install

log "Gradle assembleRelease"
(cd android && ./gradlew assembleRelease --no-daemon --console=plain -q) || fail "Gradle derlemesi başarısız."

APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
[[ -f "$APK" ]] || fail "APK üretilmedi: $APK"

VERSION="$(node -p 'require("./app.config.js")({ config: {} }).version')"
COMMIT="$(git rev-parse --short=7 HEAD)"

# ── Doğrulama: üretim adresleri gömülü, yerel yığın adresi yok ────────────
BUNDLE="$(mktemp)"
unzip -p "$APK" assets/index.android.bundle >"$BUNDLE" 2>/dev/null || fail "APK'da JS paketi yok."
while IFS='=' read -r key value; do
  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  [[ -n "$value" ]] || continue
  grep -a -q -F "$value" "$BUNDLE" ||
    fail "JS paketinde $key değeri ($value) yok — .env.production yüklenmemiş."
done < <(grep -E '^EXPO_PUBLIC_[A-Z0-9_]+=' .env.production || true)
if grep -a -q -F "10.0.2.2" "$BUNDLE"; then
  fail "JS paketinde yerel geliştirme adresi (10.0.2.2) var — .env.production yüklenmemiş."
fi
rm -f "$BUNDLE"

NAME="ciklet-${VERSION}-${COMMIT}-prod.apk"
cp "$APK" "$OUT_DIR/$NAME"
SIZE="$(du -h "$OUT_DIR/$NAME" | cut -f1 | tr -d ' ')"
log "Hazır: $OUT_DIR/$NAME ($SIZE) — sürüm $VERSION, commit $COMMIT"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "apk_path=$OUT_DIR/$NAME"
    echo "apk_name=${NAME%.apk}"
    echo "version=$VERSION"
  } >>"$GITHUB_OUTPUT"
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat >>"$GITHUB_STEP_SUMMARY" <<SUMMARY
### Android — release APK

| | |
|---|---|
| Dosya | \`$NAME\` ($SIZE) |
| Sürüm | $VERSION |
| Commit | $COMMIT |
SUMMARY
fi
