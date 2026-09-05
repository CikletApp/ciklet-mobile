#!/usr/bin/env bash
#
# Yerel imzasız IPA üretir (macOS + Xcode gerekir).
#
# Çıktı: dist/ciklet-unsigned.ipa — jailbreakli cihaza TrollStore veya
# AppSync Unified ile doğrudan kurulabilir.
#
# ⚠️ İmzasız derlemede PUSH BİLDİRİMİ ÇALIŞMAZ: APNs kaydı Apple'ın verdiği
# `aps-environment` yetkisini ister ve imzalama kapatıldığında o yetki
# düşer. Uygulama AÇIKKEN gelen aramalar ve mesajlar soket üzerinden
# geldiği için çalışır; uygulama KAPALIYKEN bildirim gelmez.
# Push'u denemek için docs/BUILD.md içindeki EAS yolunu kullan.
#
# Kullanım:
#   ./scripts/build-ipa.sh
#   EXPO_PUBLIC_API_URL=https://ornek.dev ./scripts/build-ipa.sh

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS derlemesi yalnızca macOS'ta yapılabilir (Xcode başka platformda yok)." >&2
  echo "Mac'in yoksa: .github/workflows/ios-ipa.yml iş akışını GitHub'dan çalıştır." >&2
  exit 1
fi

command -v xcodebuild >/dev/null || { echo "xcodebuild bulunamadı. Xcode kur." >&2; exit 1; }
command -v pod >/dev/null || { echo "CocoaPods bulunamadı: sudo gem install cocoapods" >&2; exit 1; }

echo "▸ Bağımlılıklar"
npm ci

echo "▸ Native proje üretiliyor (expo prebuild)"
# `--clean`: ios/ depoda tutulmuyor; her derleme app.json'dan sıfırdan
# üretiliyor ki eklenti değişiklikleri (bildirim sesi, arka plan modları)
# mutlaka uygulansın.
npx expo prebuild --platform ios --clean --no-install

echo "▸ CocoaPods"
(cd ios && pod install)

cd ios
WORKSPACE=$(ls -d ./*.xcworkspace | head -n1)
# Şema adı app.json'daki `name`den türüyor; projeden okumak, uygulama adı
# değiştiğinde betiği kırmaz.
SCHEME=$(xcodebuild -workspace "$WORKSPACE" -list -json | node -e "
  let raw='';process.stdin.on('data',c=>raw+=c).on('end',()=>{
    const {workspace}=JSON.parse(raw);
    console.log(workspace.schemes.find(s=>!s.startsWith('Pods'))??workspace.schemes[0]);
  });")

echo "▸ Derleniyor: $WORKSPACE / $SCHEME (Release, imzasız)"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGN_ENTITLEMENTS="" \
  build

APP=$(ls -d build/Build/Products/Release-iphoneos/*.app | head -n1)
echo "▸ Paketleniyor: $APP"

# IPA, içinde `Payload/<Uygulama>.app` olan bir zip'tir. Xcode'un
# `-exportArchive` adımı imza istediği için imzasız derlemede paket elle
# kuruluyor.
rm -rf Payload
mkdir -p Payload
cp -R "$APP" Payload/
mkdir -p "$ROOT/dist"
rm -f "$ROOT/dist/ciklet-unsigned.ipa"
zip -qry "$ROOT/dist/ciklet-unsigned.ipa" Payload
rm -rf Payload

echo
echo "✓ Hazır: dist/ciklet-unsigned.ipa"
ls -lh "$ROOT/dist/ciklet-unsigned.ipa"
