# Ciklet Mobile

Ciklet'in Android + iOS istemcisi. Expo (SDK 57) + Expo Router + TypeScript.

## Mimari bağlam

| Bağımlılık | Ne için |
|---|---|
| `ciklet-web` API (`https://ciklet.xyz`) | Tüm veri + auth (`/api/mobile/auth`) |
| `@ciklet/embedded-activities-sdk/types` | Paylaşılan tipler ve API/socket sözleşmeleri (GitHub'dan kurulur) |
| LiveKit (`wss://ciklet.xyz/rtc`) | Sesli/görüntülü kanallar |

Auth modeli: `/api/mobile/auth`'tan alınan NextAuth oturum token'ı SecureStore'da
saklanır ve her HTTP isteği + Socket.IO el sıkışmasına **Cookie başlığı** olarak
eklenir — sunucu tarafında hiçbir özel mobil rota yoktur, web ile aynı uçlar
kullanılır.

## Klasör düzeni

```
src/app/        Expo Router — sadece rota iskeleti
src/api/        fetch istemcisi + TanStack Query hook'ları
src/features/   ekran mantığı (chat/, voice/, ...)
src/lib/        socket, livekit, storage, config
src/stores/     Zustand (auth, ...)
src/theme/      renk token'ları (tailwind.config ile eş)
```

## Geliştirme

> **Önemli:** LiveKit native modül içerdiği için uygulama **Expo Go ile
> çalışmaz**; development build gerekir.

```bash
npm install
cp .env.example .env        # LAN IP'ni yaz (localhost telefondan görünmez)

# İlk development build (bir kez; sonrasında sadece JS değişir):
npx eas build --profile development --platform android
# build biten .apk'yı cihaza kur, sonra:
npx expo start
```

Yerel backend için: `ciklet-infra`'da `docker compose -f docker-compose.dev.yml up -d`
ve `ciklet-web`'de `pnpm dev`.

## Dağıtım

- `npx eas build --profile preview` → test cihazlarına internal dağıtım
- `npx eas build --profile production` → mağaza sürümü
- JS-only değişiklikler: `npx eas update` (OTA)
