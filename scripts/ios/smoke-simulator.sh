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
# Çıktılar build/ios/ altında: simulator-screen.png, simulator-stdout.log,
# simulator-stderr.log, simulator-system.log, simulator-crash/, xcodebuild-simulator.log.

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
# İmza KAPATILMAZ: Xcode simülatör için yerel (ad-hoc, "Sign to Run Locally")
# imzalar ve benzetilmiş yetkileri gömer. CODE_SIGNING_ALLOWED=NO ile imzasız
# kalan uygulama simülatörde hiç başlamıyordu (süreçten tek günlük satırı yok).
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
  CODE_SIGN_IDENTITY=- \
  DEVELOPMENT_TEAM= \
  build ||
  fail "Simülatör derlemesi başarısız."

APP="$(find "$SIM_DIR/Build/Products" -maxdepth 2 -type d -name "$SCHEME.app" | head -1)"
[[ -d "$APP" ]] || fail "Simülatör uygulaması bulunamadı."
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")"
EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Info.plist")"
codesign --verify --deep --strict "$APP" 2>&1 | head -5 || true

# ── Aç ve izle ────────────────────────────────────────────────────────────
xcrun simctl boot "$UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl install "$UDID" "$APP"

STDOUT_LOG="$BUILD_DIR/simulator-stdout.log"
STDERR_LOG="$BUILD_DIR/simulator-stderr.log"
SYSTEM_LOG="$BUILD_DIR/simulator-system.log"
SCREENSHOT="$BUILD_DIR/simulator-screen.png"
CRASH_DIR="$BUILD_DIR/simulator-crash"
REPORTS="$HOME/Library/Logs/DiagnosticReports"
MARKER="$BUILD_DIR/.launch-marker"
rm -rf "$CRASH_DIR"
mkdir -p "$CRASH_DIR" "$REPORTS"
: >"$MARKER"

log "$BUNDLE_ID açılıyor, $WAIT_SECONDS sn izlenecek"
LAUNCH_OUTPUT="$(xcrun simctl launch --terminate-running-process \
  --stdout="$STDOUT_LOG" --stderr="$STDERR_LOG" "$UDID" "$BUNDLE_ID" 2>&1)" ||
  fail "simctl launch başarısız: $LAUNCH_OUTPUT"
echo "$LAUNCH_OUTPUT"
PID="$(printf '%s\n' "$LAUNCH_OUTPUT" | sed -nE 's/^.*: ([0-9]+)$/\1/p' | tail -1)"
[[ -n "$PID" ]] || fail "simctl launch süreç kimliği vermedi: $LAUNCH_OUTPUT"

# Simülatördeki uygulama sunucuda sıradan bir süreç: kimliğiyle izlenir.
ALIVE_FOR=0
while ((ALIVE_FOR < WAIT_SECONDS)); do
  kill -0 "$PID" 2>/dev/null || break
  sleep 3
  ALIVE_FOR=$((ALIVE_FOR + 3))
done

xcrun simctl io "$UDID" screenshot "$SCREENSHOT" >/dev/null 2>&1 || true
xcrun simctl spawn "$UDID" log show --last 5m --style compact \
  --predicate "process == \"$EXECUTABLE\" OR eventMessage CONTAINS[c] \"$BUNDLE_ID\"" \
  >"$SYSTEM_LOG" 2>/dev/null || true
find "$REPORTS" -newer "$MARKER" -name "${EXECUTABLE}*" -exec cp {} "$CRASH_DIR/" \; 2>/dev/null || true

FATAL='Unhandled JS Exception|Symbol not found|Library not loaded|Terminating app due to uncaught exception|RCTFatal|CODESIGNING'
FOUND=0
if grep -E -h "$FATAL" "$STDOUT_LOG" "$STDERR_LOG" "$SYSTEM_LOG" "$CRASH_DIR"/* 2>/dev/null | head -20 >&2; then
  FOUND=1
fi
if [[ -n "$(ls -A "$CRASH_DIR" 2>/dev/null)" ]]; then
  echo "── çökme raporu (ilk 60 satır) ──" >&2
  head -n 60 "$(ls -t "$CRASH_DIR"/* | head -1)" >&2 || true
  FOUND=1
fi

if ((FOUND == 1)) || ((ALIVE_FOR < WAIT_SECONDS)); then
  echo "── simülatör günlüğü (son 40 satır) ──" >&2
  tail -n 40 "$SYSTEM_LOG" >&2 || true
  fail "Uygulama simülatörde $ALIVE_FOR. saniyede kapandı ya da hata verdi (günlükler artifact'ta)."
fi

kill "$PID" >/dev/null 2>&1 || true
log "Duman testi geçti: $BUNDLE_ID simülatörde $WAIT_SECONDS sn ayakta kaldı."

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat >>"$GITHUB_STEP_SUMMARY" <<SUMMARY
### iOS — simülatör duman testi

Uygulama Release yapılandırmasıyla simülatörde açıldı ve $WAIT_SECONDS sn ayakta kaldı. Ekran görüntüsü "ios-simulator-test" artifact'ında.
SUMMARY
fi
