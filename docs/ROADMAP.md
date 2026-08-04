# Ciklet Mobile — Yayın Yol Haritası

Bu belge, `ciklet-mobile` uygulamasının sıfırdan yayınlanabilir hale gelmesi
için izlenen dört fazı, her fazın çıktısını ve "bitti" kabul kriterlerini
tanımlar. Kaynak gerçeği `ciklet-web` mimarisidir; mobil hiçbir yerde kendi
veri modelini uydurmaz, `@ciklet/embedded-activities-sdk/types` sözleşmesine
yaslanır.

---

## 0. Mimari kabuller (fazlardan bağımsız)

| Konu | Karar | Gerekçe |
| --- | --- | --- |
| Çatı | Expo SDK 57 + React Native 0.86 + Expo Router | Mevcut iskelet zaten bu; dev-client + EAS kurulu. |
| Kimlik | `POST /api/mobile/auth` → NextAuth JWE, `Cookie:` başlığıyla taşınır | Web'deki **hiçbir** rota değişmez; `getServerSession` ve Socket.IO el sıkışması aynı yoldan doğrular. |
| Depolama | `expo-secure-store` (Keychain / Keystore) | Oturum token'ı kalıcı ve şifreli. |
| Sunucu durumu | TanStack Query | Web ile aynı; sayfalama sözleşmesi (`items` / `nextCursor`) ortak. |
| İstemci durumu | Zustand | Presence, okunmamış, taslak gibi soket-güdümlü durumlar. |
| Gerçek zamanlı | Socket.IO (`/api/socket/io`) | Web sunucusunun aynısı; olay adları birebir kopyalanır. |
| Ses/görüntü | LiveKit (`@livekit/react-native`) | Web ile aynı SFU, aynı token ucu (`GET /api/livekit`). |
| Stil | NativeWind v4 + tipli token katmanı | `className` ile hız, `tokens.ts` ile navigator/StyleSheet uyumu. |
| İkonlar | Kendi SVG setimiz (`react-native-svg`) | `@expo/vector-icons` SDK 57'de kullanımdan kaldırılıyor; ayrıca marka dili tamamen bize ait olmalı. |
| Marka | Ciklet paleti (`#d3be01` sarı) | Referans ekran görüntüleri yalnızca **yerleşim/etkileşim** kaynağıdır; hiçbir üçüncü taraf rengi, logosu, ikonu veya metni kullanılmaz. |

### Referans ekranlardan çıkarılan bilgi mimarisi

Ekran görüntüleri, **düzen ve etkileşim modeli** için referanstır. Uygulanan IA:

```
Alt sekmeler:  Ana Sayfa  ·  Bildirimler  ·  Sen
├── Ana Sayfa      → sunucu rayı + (sunucu seçili ise) kanal listesi
│                    (sunucu seçili değilse) DM listesi + arkadaş kısayolları
├── Bildirimler    → mention / arkadaşlık isteği / çağrı geçmişi
└── Sen            → profil kartı, durum, "Profili Düzenle", arkadaşlar

Yığın (modal/push):
  chat/channel/[channelId]     kanal sohbeti
  chat/direct/[directId]       DM sohbeti
  servers/[serverId]           kanal listesi
  servers/new                  sunucu oluştur / davetle katıl
  friends                      arkadaş listesi + istekler
  friends/add                  kullanıcı adıyla ekle / davet paylaş
  search                       genel arama (kişi/sunucu/kanal + filtreler)
  profile/edit                 Kullanıcı Profili ⇄ Sunucu Profilleri sekmeleri
  profile/[profileId]          kullanıcı profil sayfası (Mesaj/Sesli/Görüntülü)
  settings/*                   hesap, gizlilik, görünüm, dil, bildirimler
```

---

## Faz 1 — Mimari temel ve routing  ✅ *bu fazda teslim edildi*

**Amaç:** Ekranlar yazılmadan önce, altındaki her katmanın üretim seviyesinde
ve tipli olması.

### Teslim edilenler

1. **Yapılandırma katmanı** — `src/lib/config.ts`, `src/lib/device.ts`
   Ortam değişkeni doğrulaması, API/LiveKit kökü türetimi, `clientType` /
   `clientVersion` / kalıcı cihaz kimliği (giriş ucundaki donanım-ban
   kontrolü bunu bekliyor).

2. **HTTP katmanı** — `src/api/client.ts`, `endpoints.ts`, `query-keys.ts`
   - Tek `endpoints.ts` kaynağı: rota yolları kod tabanına dağılmaz.
   - `ciklet-web` uçlarının **iki farklı hata biçimi** (`{error}` JSON *ve*
     düz metin `NextResponse("Unauthorized")`) tek `ApiError`'a normalize edilir.
   - İstek zaman aşımı (`AbortController`), 401'de **tek seferlik sessiz
     yenileme + tekrar deneme**, ardından global oturum düşürme.
   - Eşzamanlı 401'lerde tek bir yenileme uçuşu (in-flight dedupe).

3. **Gerçek zamanlı katman** — `src/realtime/*`
   - `events.ts`: sunucudaki `io.ts` ile **birebir** doğrulanmış olay
     sözleşmesi (aşağıdaki "Düzeltilen sözleşme hataları"na bakın).
   - `socket.ts`: tekil bağlantı, oturum değişiminde yeniden kurulum,
     `AppState` ile arka planda kopma/ön planda toparlama, 30 sn heartbeat.
   - `use-chat-stream.ts`: `chat:subscribe` + `connect`'te yeniden abonelik
     + cache'e **doğrudan yazma** (invalidate değil — web ile aynı davranış).
   - `use-presence.ts` + `stores/presence.ts`: toplu ve tekil presence.

4. **Oturum yönetimi** — `src/stores/auth.ts`
   Kayan yenileme (son kullanma tarihine göre zamanlanmış), ön plana dönüşte
   tazeleme, `SecureStore`'da `expiresAt` saklama, tek noktadan çıkış.

5. **Navigasyon iskeleti** — `src/app/**`
   Sekmeli kabuk, `Stack.Protected` guard'ları, tüm rotaların yer tutucuları,
   tipli rota parametreleri, tema uygulanmış navigator seçenekleri.

6. **Tasarım sistemi çekirdeği** — `src/theme/tokens.ts`, `src/components/ui/*`
   Renk/aralık/yarıçap/tipografi token'ları, kendi SVG ikon setimiz,
   `Avatar` (presence rozetiyle), `Screen`, `Spinner`, `Pressable`.

### Bu fazda tespit edilip düzeltilen sözleşme hataları

| # | Sorun | Etki | Düzeltme |
| --- | --- | --- | --- |
| 1 | Mobil `use-chat-socket`, `chat:<id>` olayını dinliyordu. Sunucu ise `chat:<id>:messages` ve `chat:<id>:messages:update` yayınlıyor. | **Canlı mesaj hiç gelmiyordu.** | `realtime/events.ts` içinde `chatMessagesEvent()` / `chatUpdateEvent()`. |
| 2 | SDK'daki `chatRoom()` oda adını `chat:<id>` sanıyordu; sunucudaki oda adı `chatroom:<id>` ve istemci odaya **isimle katılmıyor**, `chat:subscribe` yayınlıyor. | Yanıltıcı API. | SDK'da kullanımdan kaldırıldı; doğru yardımcılar eklendi. |
| 3 | SDK `PresenceUpdatePayload` = `{profileId, presenceStatus}`. Sunucu `{userId, status}` yolluyor. | Presence hiç çözümlenmiyordu. | Sözleşme sunucuya göre düzeltildi. |
| 4 | SDK `presence:batch` tipi dizi. Sunucu `{statuses, activities}` nesnesi yolluyor. | Aynı. | Düzeltildi. |
| 5 | `SocketEvents.PRESENCE_SELF` "istemci → sunucu" diye belgelenmiş. Gerçekte istemci `presence:set_status` yollar, sunucu `presence:self` yayınlar. | Yanlış yön. | Ayrıldı ve belgelendi. |
| 6 | Yeniden bağlanmada `chat:subscribe` tekrarlanmıyordu. | Ağ dalgalanmasından sonra sohbet sessizleşiyordu. | `connect` olayında yeniden abonelik. |
| 7 | 401 sonrası oturum düşürme yoktu; token süresi dolunca uygulama sessizce boş ekrana düşüyordu. | Kullanıcı kilitleniyordu. | `client.ts` yenileme + global çıkış. |

### Faz 1 "bitti" kriteri
- [x] `tsc --noEmit` temiz.
- [x] Tüm rotalar erişilebilir, korumalı rotalar oturumsuz açılamıyor.
- [x] Soket bağlanıyor, `ready` alınıyor, presence toplu geliyor.
- [x] Kanal ve DM sohbetinde canlı mesaj cache'e yazılıyor.

---

## Faz 2 — UI/UX inşası

**Amaç:** Referans ekranlardaki yerleşim kalitesinde, Ciklet marka diliyle,
erişilebilir bileşenler.

### İş kalemleri
1. **Bileşen kütüphanesi** — `Button`, `Input`, `ListRow`, `SectionHeader`,
   `SegmentedTabs`, `BottomSheet`, `Badge`, `EmptyState`, `Skeleton`,
   `SwipeableRow`. Hepsi token tabanlı, haptik geri bildirimli.
2. **Ana Sayfa** — sunucu rayı (dikey, klasör desteği: `GET /api/folders`),
   kanal listesi (kategori/collapse), DM listesi (son mesaj önizlemesi,
   okunmamış rozeti, presence noktası).
3. **Sohbet ekranı** — `FlashList` tabanlı ters liste, tarih ayraçları,
   ardışık mesaj gruplama, yanıtlama, reaksiyon çubuğu, "yazıyor…"
   göstergesi, dosya/görsel önizleme, sistem mesajı kartları
   (`CALL_*`, `ACTIVITY_INVITE`).
4. **Profil** — `profile/[profileId]` (Mesaj / Sesli Arama / Görüntülü Arama,
   ortak sunucular, ortak arkadaşlar, not) ve `profile/edit`
   (**Kullanıcı Profili** ⇄ **Sunucu Profilleri** segment kontrolü; ikincisi
   `Member.nickname / serverPronouns / serverBio / serverImageUrl` alanlarını
   `PATCH /api/members/[memberId]` ile yazar).
5. **Arkadaşlar** — alfabetik bölümlenmiş liste, `Arkadaşlık İstekleri`
   sayacı, satır içi arama, hızlı eylem (ara / mesaj).
6. **Arama** — `GET /api/search` üstüne kategori sekmeleri (Kişiler /
   Sunucular / Kanallar) ve filtre menüsü.
7. **Ayarlar** — bölümlenmiş liste; hesap, gizlilik, görünüm (tema), dil,
   bildirimler, oturumlar (`GET /api/sessions`).
8. **Erişilebilirlik** — 44pt dokunma hedefi, `accessibilityLabel`,
   dinamik yazı boyutu, kontrast AA.

### Bilinen backend boşluğu — **grup DM**
Referans ekranlardaki "Yeni Grup" akışı **mevcut şemayla desteklenmiyor**:
`Direct` modeli `profileOneId` / `profileTwoId` ile **birebir** sohbete
kilitli. Grup DM için `ciklet-web` tarafında yeni model (`GroupDirect` +
`GroupDirectMember`) ve uçları gerekir. Faz 2'de bu ekran **kapsam dışı**
bırakılır; yerine "Arkadaş Ekle" ve "Sunucu Oluştur" akışları verilir.
Backend eklenirse Faz 4'te açılır.

---

## Faz 3 — State yönetimi ve backend entegrasyonu

**Amaç:** Her ekranın gerçek veriyle, iyimser güncellemeyle ve çevrimdışı
dayanıklılıkla çalışması.

1. **Mesaj gönderimi** — iyimser ekleme + `MESSAGE_ACK`, başarısızlıkta
   "tekrar dene" satırı, kuyruk (uygulama kapansa bile).
2. **Okunmamış durumu** — `GET /api/unread-counts`, `MESSAGE_ACK` soket
   olayı, `READ_STATE_UPDATED` dinleyicisi, rozet senkronizasyonu.
3. **Presence & zengin durum** — `presence:sync` ilk açılışta ve arkadaş
   listesi değiştikçe; `rich_presence:update` kartları.
4. **Arkadaşlık akışı** — istek gönder/kabul/reddet + `friend_request` /
   `friend_request_updated` soket olaylarıyla anlık liste güncellemesi.
5. **Profil düzenleme** — `PATCH /api/current-profile`, avatar yükleme
   (UploadThing ucu), kullanıcı adı değişimi (`POST /api/account/username`,
   şifre doğrulamalı).
6. **Kalıcılık** — TanStack Query kalıcı cache (MMKV/AsyncStorage), açılışta
   anlık render, arka planda tazeleme.
7. **Hata sınırları** — ekran bazlı `ErrorBoundary`, ağ yokken çevrimdışı
   şeridi (`expo-network`).

---

## Faz 4 — Aktiviteler, bildirimler ve yayın hazırlığı

1. **Sesli/görüntülü** — LiveKit odası, konuşan göstergesi, cihaz seçimi,
   arka plan sesi (`UIBackgroundModes: audio` zaten tanımlı), gelen çağrı
   ekranı (`incoming_call` / `call_accepted` / `call_denied` olayları).
2. **Aktiviteler** — `GET /api/activities` listesi, `activity_create` /
   `activity_join` / `activity_sync` soket akışı, aktivite `WebView`
   köprüsü (`@ciklet/embedded-activities-sdk` RPC'si üzerinden),
   `POST /api/activities/authorize` ile OAuth token değişimi.
3. **Bildirimler** — `expo-notifications` + EAS push, sunucu tarafında token
   kaydı ucu, kanal/DM bazlı sessize alma, derin bağlantı
   (`ciklet://chat/direct/<id>`).
4. **Performans** — `FlashList` ölçümü, `expo-image` bellek/disk politikası,
   Reanimated worklet'leri, Hermes bytecode, gereksiz render avı
   (React Compiler zaten `app.json`'da açık).
5. **Yayın** — EAS Build profilleri, iOS/Android mağaza varlıkları,
   gizlilik bildirimi, çökme raporlama, OTA güncelleme kanalı.

---

## ⚠️ ciklet-web'de kapatılması gereken boşluklar

Dört fazın uygulanması sırasında tespit edildi. Hiçbiri mobil tarafında
çözülemez; **backend değişikliği gerektirir**. Mobil, her birinde sessizce
bozulmak yerine kullanıcıya açık mesaj gösterir.

| # | Boşluk | Etki | Gereken |
| --- | --- | --- | --- |
| 1 | **Grup DM yok.** `Direct` modeli `profileOneId`/`profileTwoId` ile birebir sohbete kilitli. | "Yeni Grup" akışı hiç yapılamıyor. | Yeni model (`GroupDirect` + `GroupDirectMember`) ve uçları. |
| 2 | **Davetle katılımın API ucu yok.** İş, sunucu bileşeni sayfasında yapılıyor (`app/(invite)/(routes)/i/[inviteCode]/page.tsx`). `POST /api/servers/[id]/join` yalnızca `isPublic` sunucular için çalışıyor. | Mobilden gizli sunucuya davetle katılınamıyor. | O sayfadaki mantığın `POST /api/i/[code]/join` gibi bir uca taşınması. |
| 3 | **Push token kayıt ucu yok.** | Uygulama KAPALIYKEN bildirim gelmiyor; yalnızca arka planda soket ayaktayken yerel bildirim var. | `POST /api/push/register` + mesaj/çağrı olaylarında Expo Push API'sine gönderim yapan sunucu işi. |
| 4 | **`/api/directs` slim profil dönüyor**, SDK tipi tam `PublicProfile` vaat ediyor. | Tip yalanı; DM'den açılan profilde zengin alanlar boş. | Ya uç `PROFILE_PUBLIC_SELECT` kullanmalı, ya SDK tipi daraltılmalı (mobil ikincisini yaptı). |
| 5 | **SDK gerçek zamanlı sözleşmesi sunucuyla uyuşmuyordu** (`chatRoom`, `PresenceUpdatePayload`, `presence:batch`). | Canlı mesaj ve presence hiç çalışmıyordu. | `ciklet-sdk` kaynağı düzeltildi; **yayınlanması** gerekiyor (mobil şimdilik kendi kopyasını taşıyor). |

---

## Ek: Doğrulanmış backend sözleşmesi

### HTTP
| Uç | Yöntem | Notlar |
| --- | --- | --- |
| `/api/mobile/auth` | POST | `{username, password, clientType, clientVersion, hwid}` → `{token, cookieName, expiresAt, profile}` |
| `/api/mobile/auth/refresh` | POST | Geçerli token ile; 30 günlük yeni token |
| `/api/current-profile` | GET / PATCH | PATCH: `name, pronouns, bio, bannerColor, imageUrl, dmPermission, spamFilter, friendReq*` |
| `/api/servers` | GET / POST | Üye olunan sunucular (kanal + üye dahil) |
| `/api/members/mine` | GET | Kendi üyeliklerim (sunucu profili düzenleme için `memberId`) |
| `/api/members/[memberId]` | PATCH | `nickname, serverPronouns, serverBio, serverImageUrl, serverBannerColor` |
| `/api/directs` | GET | 1:1 sohbetler |
| `/api/directs/init` | POST | `{friendId}` → sohbet aç/oluştur |
| `/api/messages` | GET | `?channelId=&cursor=&density=` → `{items, nextCursor}` |
| `/api/direct-messages` | GET | `?directId=&cursor=&density=` |
| `/api/socket/messages` | POST | `?channelId=&serverId=` gövde `{content, fileUrl?}` |
| `/api/socket/direct-messages` | POST | `?directId=` |
| `/api/friends` | GET / POST | POST: `{targetUsername}` |
| `/api/friends/[friendId]` | PATCH / DELETE | Kabul / sil |
| `/api/search` | GET | `?q=` → `{servers, channels, people}` (min. 2 karakter) |
| `/api/unread-counts` | GET | `{channelUnreads, serverUnreads}` |
| `/api/read-state/unread` | POST | Okunmadı işaretle |
| `/api/livekit` | GET | `?room=&username=` → `{token}` |
| `/api/activities` | GET | Onaylı aktiviteler |
| `/api/sessions` | GET / DELETE | Aktif oturumlar |

> **Hata biçimi uyarısı:** Rotaların bir kısmı `NextResponse.json({error})`,
> bir kısmı `new NextResponse("Unauthorized")` düz metni döner. İstemci
> `client.ts` içinde ikisini de tek `ApiError`'a normalize eder.

### Socket.IO — `path: /api/socket/io`

**İstemci → sunucu:** `chat:subscribe` · `chat:unsubscribe` · `heartbeat` ·
`presence:idle` · `presence:set_status` · `presence:sync` ·
`rich_presence:update` · `typing` · `MESSAGE_ACK` · `friend_request` ·
`friend_request_updated` · `join_voice_channel` · `leave_voice_channel` ·
`get_active_voice_channels` · `incoming_call` · `call_accepted` ·
`call_denied` · `call_cancelled` · `activity_*`

**Sunucu → istemci:** `ready` · `chat:<id>:messages` ·
`chat:<id>:messages:update` · `presence:batch` · `presence:update` ·
`presence:self` · `rich_presence:update` · `typing` · `heartbeat_ack` ·
`READ_STATE_UPDATED` · `new_message` · `friend_request` ·
`friend_request_updated` · `voice_channel_update` · `active_voice_channels` ·
`incoming_call` · `call_*` · `activity_update` · `activity_sync` ·
`activity_current_state` · `activity_ended`
