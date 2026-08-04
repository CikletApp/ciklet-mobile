# Ciklet Mobile

Ciklet'in Android + iOS istemcisi. Expo (SDK 57) + Expo Router + TypeScript.

Fazlı yol haritası ve mimari kararlar: **[docs/ROADMAP.md](docs/ROADMAP.md)**

## Mimari bağlam

| Bağımlılık | Ne için |
|---|---|
| `ciklet-web` API (`https://ciklet.xyz`) | Tüm veri + kimlik (`/api/mobile/auth`) |
| `@ciklet/embedded-activities-sdk/types` | Paylaşılan tipler ve API/socket sözleşmeleri (GitHub'dan kurulur) |
| LiveKit (`wss://ciklet.xyz/rtc`) | Sesli/görüntülü kanallar |

**Kimlik modeli:** `/api/mobile/auth`'tan alınan NextAuth oturum token'ı
SecureStore'da saklanır ve her HTTP isteği + Socket.IO el sıkışmasına **Cookie
başlığı** olarak eklenir — sunucu tarafında hiçbir özel mobil rota yoktur, web
ile aynı uçlar kullanılır. Token 30 günlük; son kullanmaya 3 gün kala kayan
yenileme devreye girer, 401'de tek seferlik sessiz yenileme denenir.

## Klasör düzeni

```
src/app/          Expo Router — YALNIZCA rota dosyaları, iş mantığı yok
  (auth)/           giriş
  (tabs)/           Ana Sayfa · Bildirimler · Sen
  chat/             kanal ve DM sohbetleri
  servers/          kanal listesi
  friends/          arkadaşlar, arkadaş ekle
  profile/          profil görüntüleme ve düzenleme
  settings/         ayarlar

src/api/          HTTP katmanı
  client.ts         fetch sarmalayıcı: zaman aşımı, 401 yenileme, hata modeli
  endpoints.ts      tüm uç noktaların TEK kaynağı
  query-keys.ts     TanStack Query anahtar fabrikası
  types.ts          SDK'da henüz olmayan yanıt tipleri
  hooks/            veri hook'ları (profil, sunucu, DM, arkadaş, mesaj, arama)

src/realtime/     Socket.IO katmanı
  events.ts         sunucuyla BİREBİR doğrulanmış olay sözleşmesi
  socket.ts         tekil bağlantı, yeniden abonelik, heartbeat
  provider.tsx      oturum + AppState bağlantısı, presence yayınları
  use-chat-stream.ts sohbet aboneliği ve cache'e doğrudan yazma

src/features/     ekran mantığı (chat/, ileride voice/, activities/)
src/components/ui tasarım sistemi primitifleri (ikon, avatar, ekran kabuğu)
src/stores/       Zustand (auth, presence)
src/theme/        tasarım token'ları — ciklet-web theme.css ile eş
src/lib/          config, storage, device, livekit
```

### Kural: rota dosyaları ince kalır

`src/app/**` içindeki dosyalar yalnızca parametre okur, hook çağırır ve bir
görünüm render eder. Veri dönüşümü `api/hooks`'a, ekran mantığı
`features/`'a, yeniden kullanılabilir görsel parçalar `components/ui`'ye ait.

## Tema

Renkler `ciklet-web/src/app/theme.css` içindeki **Gece** temasıyla birebir
aynı HSL bileşenlerinden gelir. Marka: `#98cb00` (lime) / `#45f3ff` (camgöbeği).

İki dosya ikiz tutulmalıdır — biri değişirse diğeri de:
- `src/theme/tokens.ts` — TypeScript tarafı (navigator, StyleSheet)
- `tailwind.config.js` — NativeWind `className` tarafı

## Geliştirme

> **Önemli:** LiveKit ve `react-native-svg` native modül içerdiği için
> uygulama **Expo Go ile çalışmaz**; development build gerekir.

```bash
npm install
cp .env.example .env        # LAN IP'ni yaz (localhost telefondan görünmez)

# İlk development build (bir kez; sonrasında sadece JS değişir):
npx eas build --profile development --platform android
# build biten .apk'yı cihaza kur, sonra:
npm start
```

Yerel backend için: `ciklet-infra`'da `docker compose -f docker-compose.dev.yml up -d`
ve `ciklet-web`'de `pnpm dev`.

### Doğrulama

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm run doctor      # expo-doctor: sürüm uyumu
```

Rota tipleri (`.expo/types/router.d.ts`) dev sunucusu tarafından üretilir;
yeni bir rota ekledikten sonra `npm start` çalıştırılmadan `typecheck`
eski rota listesine bakar.

## Dağıtım

- `npx eas build --profile preview` → test cihazlarına internal dağıtım
- `npx eas build --profile production` → mağaza sürümü
- JS-only değişiklikler: `npx eas update` (OTA)
