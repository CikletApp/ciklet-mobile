#!/usr/bin/env bash
#
# iOS — simülatörde açılış duman testi.
#
# Release yapılandırmasıyla simülatör için derler, bir iPhone simülatöründe
# açar ve uygulamanın bir süre ayakta kaldığını doğrular. Açılışta fırlayan
# JS istisnası (ör. bağlı olmayan bir yerel modülü içe aktaran kod) ya da
# dyld hatası Release'te uygulamayı düşürür; bu test onu IPA'yı cihaza
# vermeden yakalar. Cihazdaki her şeyi temsil etmez (imza, push, LiveContainer).
#
#   npm ci && bash scripts/ios/smoke-simulator.sh
#
# Çıktılar build/ios/ altında: simulator-screen.png, simulator-console.log,
# simulator-system.log, xcodebuild-simulator.log.

set -euo pipefail
# shellcheck source=scripts/ios/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

WAIT_SECONDS="${SMOKE_WAIT_SECONDS:-45}"

ios_prepare

# ── Simülatör seç: en yeni iOS çalışma zamanındaki ilk iPhone ─────────────
UDID="$(xcrun simctl list devices available --json | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
def runtime_version(identifier):
    try:
        return tuple(int(part) for part in identifier.rsplit("iOS-", 1)[1].split("-"))
    except (IndexError, ValueError):
        return (0,)
best = None
for runtime, entries in devices.items():
    if ".iOS-" not in runtime:
        continue
    for device in entries:
        if device.get("isAvailable") and device["name"].startswith("iPhone"):
            key = runtime_version(runtime)
            if best is None or key > best[0]:
                best = (key, device["udid"])
            break
print(best[1] if best else "")
')"
[[ -n "$UDID" ]] || fail "Kullanılabilir iPhone simülatörü yok."
log "Simülatör: $UDID"

# ── Derle: yalnızca o simülatörün mimarisi, Release (JS paketi gömülü) ────
SIM_DIR="$BUILD_DIR/simulator"
LOG_FILE="$BUILD_DIR/xcodebuild-simulator.log"
rm -rf "$SIM_DIR"
log "xcodebuild build — $SCHEME, Release, iOS Simulator (günlük: $LOG_FILE)"
run_xcodebuild "$LOG_FILE" \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "id=$UDID" \
  -derivedDataPath "$SIM_DIR" \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  build ||
  fail "Simülatör derlemesi başarısız."

APP="$(find "$SIM_DIR/Build/Products" -maxdepth 2 -type d -name "$SCHEME.app" | head -1)"
[[ -d "$APP" ]] || fail "Simülatör uygulaması bulunamadı."
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")"
EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Info.plist")"
# Apple Silicon'da arm64 kod en azından geçici (ad-hoc) imza ister.
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true

# ── Aç ve izle ────────────────────────────────────────────────────────────
xcrun simctl boot "$UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl install "$UDID" "$APP"

CONSOLE="$BUILD_DIR/simulator-console.log"
SYSTEM_LOG="$BUILD_DIR/simulator-system.log"
SCREENSHOT="$BUILD_DIR/simulator-screen.png"

log "$BUNDLE_ID açılıyor, $WAIT_SECONDS sn izlenecek"
xcrun simctl launch --terminate-running-process --console-pty "$UDID" "$BUNDLE_ID" >"$CONSOLE" 2>&1 &
LAUNCHER=$!
sleep "$WAIT_SECONDS"

xcrun simctl io "$UDID" screenshot "$SCREENSHOT" >/dev/null 2>&1 || true
ALIVE=0
if xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -q "UIKitApplication:$BUNDLE_ID"; then
  ALIVE=1
fi
xcrun simctl spawn "$UDID" log show --last 5m --style compact \
  --predicate "process == \"$EXECUTABLE\"" >"$SYSTEM_LOG" 2>/dev/null || true
kill "$LAUNCHER" >/dev/null 2>&1 || true

FATAL='Unhandled JS Exception|Symbol not found|Library not loaded|Terminating app due to uncaught exception|RCTFatal'
if grep -E -h "$FATAL" "$CONSOLE" "$SYSTEM_LOG" 2>/dev/null | head -20 >&2; then
  fail "Uygulama simülatörde açılışta hata verdi (günlükler artifact'ta)."
fi
[[ $ALIVE -eq 1 ]] || fail "Uygulama simülatörde $WAIT_SECONDS sn dolmadan kapandı."

log "Duman testi geçti: $BUNDLE_ID simülatörde $WAIT_SECONDS sn ayakta kaldı."

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat >>"$GITHUB_STEP_SUMMARY" <<SUMMARY
### iOS — simülatör duman testi

Uygulama Release yapılandırmasıyla simülatörde açıldı ve $WAIT_SECONDS sn ayakta kaldı. Ekran görüntüsü "ios-simulator-test" artifact'ında.
SUMMARY
fi
