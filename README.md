# Ciklet Mobile

Ciklet'in Android + iOS istemcisi. Expo (SDK 57) + Expo Router + TypeScript.

Fazlı yol haritası ve mimari kararlar: **[docs/ROADMAP.md](docs/ROADMAP.md)**

## Mimari bağlam

| Bağımlılık | Ne için |
|---|---|
| `ciklet-web` API (`https://ciklet.xyz`) | Tüm veri + kimlik (`/api/mobile/auth`) |
| `@ciklet/embedded-activities-sdk/types` | Paylaşılan tipler ve API/socket sözleşmeleri (GitHub'dan kurulur) |
| Ağ geçidi (`wss://ciklet.xyz/gateway/ws`) | Tüm gerçek zamanlı olaylar (ADR-0012) |
| LiveKit (`wss://ciklet.xyz`) | Sesli/görüntülü kanallar |

**Kimlik modeli:** `/api/mobile/auth`'tan alınan NextAuth oturum token'ı
SecureStore'da saklanır ve her HTTP isteği + Socket.IO el sıkışmasına **Cookie
başlığı** olarak eklenir — sunucu tarafında hiçbir özel mobil rota yoktur, web
ile aynı uçlar kullanılır. Token 30 günlük; son kullanmaya 3 gün kala kayan
yenileme devreye girer, 401'de tek seferlik sessiz yenileme denenir.

## Bilgi mimarisi

**Sohbetler ve Sunucular ayrı sekmelerdir.** Önceden Ana Sayfa'nın solunda
kalıcı 64px'lik bir sunucu rayı vardı ve sağdaki panel seçime göre DM
listesine ya da kanal listesine dönüşüyordu; yani mesaj listesi sürekli dar
yaşıyor ve bir sunucuya bakmak onu ekrandan tamamen kaldırıyordu. Şimdi
ikisi de kendi evinde ve biri diğerinin yerini almıyor.

Grup sohbetleri desteklenir (`POST /api/directs/groups`). Grup/birebir
ayrımını çözen TEK yer `useDirectDisplay` — ekranlar `profileOne`/`profileTwo`
alanlarını doğrudan okumaz, çünkü **grup satırlarında bu iki alan anlamsızdır**
(ciklet-web ikisini de grup sahibine bağlıyor). Bu kural bozulduğunda gruplar
"kendinle sohbet" sanılıp listeden eleniyordu.

Okunmamış durumu `readCursor` **snowflake**'i ile hesaplanır (ADR-0002); eski
`readStates` dizisi artık dönmüyor. Karşılaştırma `lib/snowflake.ts`
üzerinden yapılmalı — snowflake 2^53'ü aştığı için `Number` sessizce yuvarlar.

> ⚠️ Kanal ve sunucu okunmamış rozetleri `/api/unread-counts` ucundan gelir
> ve o uç şu an ciklet-web'de ÖLÜ PostgreSQL tablolarını okuyor (ADR-0006
> kapsamında düşürülmeyi bekliyorlar). Yani bu rozetler doğru değil ve
> düzeltme web tarafında. Mobil ucu olduğu gibi tüketiyor; uç düzelince
> mobilde ek iş yok.

## Klasör düzeni

```
src/app/          Expo Router — YALNIZCA rota dosyaları, iş mantığı yok
  (auth)/           giriş
  (tabs)/           Sohbetler · Sunucular · Bildirimler · Sen
  chat/             kanal ve DM sohbetleri
  directs/          grup kurma, grup bilgisi
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

src/realtime/     Ağ geçidi katmanı (Rust, ADR-0012 — Socket.IO KALDIRILDI)
  gateway.ts        tekil WebSocket, yeniden bağlanma, abonelik, heartbeat
  events.ts         ağ geçidiyle BİREBİR olay sözleşmesi + zarf dönüştürücü
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

Web ile aynı 7 atmosfer (Ametist varsayılan, Gece, Sis, Porselen, Obsidyen,
Okyanus, Orman) + Sistem. Her tema beş kaynak renkten (zemin, menü, sohbet,
panel, vurgu) türetilir; metin/kenarlık/vurgu kontrasta göre hesaplanır.
Kayıt ve hesap `src/theme/palette.ts` içinde, ciklet-web'deki
`src/lib/themes.ts` + `src/lib/theme-palette.ts` ile birebir. Mentol
planında kişisel palet açılır.

Bileşenler `colors` (etkin paletin Proxy'si) okur. Düz nesne bekleyen
yerler (navigator seçenekleri) `useTheme((s) => s.palette)` kullanmalı:
React Compiler modül sabiti olan Proxy'ye bağlı hesabı önbelleğe alıyor. NativeWind kullanılmıyor —
`className` tarafı ve `tailwind.config.js` kaldırıldı, iki dosyayı ikiz
tutma yükü de onunla birlikte gitti.

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
ve `ciklet-web`'de `pnpm dev`. Yerelde nginx yok: ağ geçidi doğrudan
`ws://<LAN-IP>:4000/ws` (üretimde `/gateway/ws`). `.env`'de
`EXPO_PUBLIC_GATEWAY_URL` bunu söyler; `.env` değişince Metro `--clear` ile
yeniden başlatılmalı (değerler pakete gömülüyor).

**Android emülatörü** (yerel yığınla):

```bash
# API ve ağ geçidi 10.0.2.2 üzerinden (emülatörün bilgisayar takma adresi):
#   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
#   EXPO_PUBLIC_GATEWAY_URL=ws://10.0.2.2:4000/ws
# Yerel LiveKit ICE adayı olarak 127.0.0.1 ilan ediyor; emülatörde bu
# cihazın kendisi. Sinyal ve ICE-TCP yönlendirilir, medya TCP'den kurulur:
adb reverse tcp:7880 tcp:7880
adb reverse tcp:7881 tcp:7881
#   EXPO_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

Yerel Turnstile anahtarı `10.0.2.2` alan adına izin vermediği için kayıt
captcha'sı emülatörde çizilmez (20 sn sonra "yüklenemedi" gösterilir);
kayıt testleri için `adb reverse tcp:3000 tcp:3000` + `localhost` kullan.

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
