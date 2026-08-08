# ciklet-web'de yapılması gereken işler

> Bu dosya **başka bir ajana devredilmek üzere** yazıldı. Depo:
> `d:\Projeler\CİKLET\ciklet-web`. Her görev bağımsızdır; sırayla veya ayrı
> ayrı yapılabilir.
>
> Görevlerin tamamı `ciklet-mobile` istemcisinin çalışması için gerekli.
> Mobil taraf bu sözleşmeleri **zaten bekleyecek şekilde yazıldı** — uçlar
> geldiğinde ek mobil değişiklik gerekmez (aksi belirtilmedikçe).

---

## Kesin kısıt: ÜCRETSİZ olacak

Hiçbir görev ücretli servis, abonelik veya kredi kartı gerektirmemeli.

- **Push için Expo Push Notification Service kullanılacak.** Ücretsiz,
  sınırsız, hesap/kart istemez. Uygulama zaten Expo ile derleniyor.
  Uç: `POST https://exp.host/--/api/v2/push/send` (kimlik doğrulama
  isteğe bağlı). FCM/APNs anahtarı YÖNETMEYE GEREK YOK — Expo aradaki
  röleyi üstlenir.
- Firebase Cloud Messaging'e doğrudan entegrasyon, OneSignal, Pusher,
  Twilio vb. **kullanılmayacak**.
- Yeni altyapı bileşeni (Redis kuyruğu, ayrı worker servisi vb.)
  eklenmeyecek; mevcut Next.js + Socket.IO süreci yeterli.

## Kesin kısıt: şema değişiklikleri EKLEMELİ (additive) olacak

`Dockerfile` başlangıçta `prisma db push` çalıştırıyor ve
`--accept-data-loss` **kullanmıyor**. Bu yüzden:

- Yeni model ve yeni **nullable** alan eklenebilir.
- Var olan alan silinemez, yeniden adlandırılamaz, tipi daraltılamaz.
- Var olan bir sütuna `@unique` **eklenemez** (bkz. `Profile.phoneNumber`
  üzerindeki yorum — benzersizlik uygulama katmanında zorlanıyor).

---

## Görev 1 — Push bildirimi altyapısı (öncelik: yüksek)

**Durum: TAMAMLANDI (2026-08-09).** Uygulama `PushDevice` modeliyle cihaz
tercihlerini saklıyor, Pages API kayıt ucu token devrini güvenle yapıyor ve
mesaj/çağrı olayları Expo Push Service'e en fazla 100'lük partilerle gidiyor.

**Sorun:** Uygulama tamamen kapalıyken kullanıcıya arama geldiğinde telefon
çalmıyor. Şu an bildirim yalnızca Socket.IO bağlantısı ayaktayken (uygulama
açık veya arka planda) çalışıyor; süreç öldüğünde soket de ölüyor.

### 1a. Prisma modeli

`prisma/schema.prisma` içine ekle:

```prisma
model PushToken {
  id        String   @id
  profileId String
  profile   Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  /// Expo push token: "ExponentPushToken[xxxxxxxx]"
  token     String
  /// "ios" | "android"
  platform  String?
  /// Aynı cihazın tekrar kaydında güncellenir; ölü token temizliği için.
  lastSeenAt DateTime @default(now())
  createdAt DateTime @default(now())

  @@index([profileId])
  @@index([token])
}
```

`Profile` modeline ilişki alanı ekle: `pushTokens PushToken[]`

> `token` alanına `@unique` EKLEME — yukarıdaki additive kısıtı. Tekrarları
> uygulama katmanında `findFirst` + `update` ile ele al.

### 1b. Kayıt ucu

`src/app/api/push/register/route.ts`

```
POST   /api/push/register    body: { token: string, platform?: string }
DELETE /api/push/register    body: { token: string }
```

- `currentProfile()` ile kimlik doğrula, yoksa 401.
- `token` biçimini doğrula: `ExponentPushToken[` ile başlamalı, uzunluk
  makul (< 200). Geçersizse 400.
- Aynı `token` başka bir profile kayıtlıysa **o kaydı devral** (cihaz el
  değiştirmiş olabilir): `profileId`'yi güncelle. Aksi halde eski sahibin
  bildirimlerini yeni kullanıcı alır — gizlilik ihlali.
- Aynı profil + aynı token varsa yalnızca `lastSeenAt` güncelle.
- DELETE: çıkışta çağrılır, kaydı siler.

### 1c. Gönderim yardımcısı

`src/lib/push.ts`

```ts
export async function sendPush(
  profileIds: string[],
  message: {
    title: string;
    body: string;
    /** Mobil derin bağlantı: "/chat/direct/<id>" gibi. */
    url?: string;
    /** "call" | "message" — mobil buna göre davranır. */
    kind?: string;
    /** Çağrılarda: davet kimliği ve arayan. */
    data?: Record<string, unknown>;
  }
): Promise<void>
```

Davranış:
- İlgili profillerin tüm token'larını çek.
- Expo'ya **toplu** gönder (tek istekte en fazla 100 mesaj — Expo sınırı).
- Gövde şekli:
  ```json
  {
    "to": "ExponentPushToken[...]",
    "title": "...",
    "body": "...",
    "data": { "url": "/chat/direct/abc", "kind": "call" },
    "sound": "default",
    "priority": "high",
    "channelId": "ciklet-calls"
  }
  ```
- Yanıttaki `DeviceNotRegistered` hatalı token'ları **veritabanından sil**;
  aksi halde ölü token'lar sonsuza dek denenir.
- **Gönderim asla isteği bloklamamalı**: `void sendPush(...).catch(...)`
  şeklinde ateşle-unut çağrılmalı. Push servisi yavaşsa çağrı kurulumu
  gecikmemeli.

### 1d. Çağrıda tetikleme

`src/pages/api/socket/io.ts` → `socket.on('incoming_call', ...)` içinde,
`io.to(receiverId).emit('incoming_call', ...)` satırının **hemen ardından**:

```ts
void sendPush([receiverId], {
  title: caller.name || caller.username,
  body: type === "video" ? "Görüntülü arıyor" : "Sesli arıyor",
  kind: "call",
  data: { callId, callerId: caller.id, directChannelId },
}).catch(() => {});
```

> Aranan kişi zaten çevrimiçiyse iki bildirim almasın diye
> `presenceManager.isOnline(receiverId)` kontrolü **YAPMA**: kullanıcı
> masaüstünde çevrimiçi olup telefonu cebinde olabilir. Mobil taraf
> uygulama ön plandayken push'u zaten bastırıyor.

### 1e. Mesajda tetikleme (isteğe bağlı, düşük öncelik)

`pages/api/socket/direct-messages/index.ts` içinde yeni DM oluşturulduğunda
alıcı **çevrimdışıysa** push gönder. Spam filtresinden geçen mesajlarda
gönderme (`isSpam` bayrağına bak).

---

## Görev 2 — `incoming_call` yüküne `directChannelId` ekle (öncelik: yüksek)

**Durum: TAMAMLANDI (2026-08-09).** Mobil gelen arama oturumunda bu alanı
doğrudan kullanıyor; eski sunucular için DM listesinden çözüm yedeği korunuyor.

**Sorun:** LiveKit oda adı olarak DM kimliği kullanılıyor
(`GET /api/livekit?room=<directId>` taraflığı ona göre doğruluyor). Ancak
`incoming_call` yayınında bu kimlik gönderilmiyor; aranan taraf odayı kendi
DM listesinden tahmin etmek zorunda kalıyor ve **aralarında hiç sohbet
yoksa çağrı bağlanamıyor**.

`src/pages/api/socket/io.ts`, `incoming_call` handler'ı `directChannelId`
değerini **zaten hesaplıyor**. Tek yapılacak yayına eklemek:

```ts
// ÖNCESİ
io.to(receiverId).emit('incoming_call', { caller, type, callId, expiresAt });

// SONRASI
io.to(receiverId).emit('incoming_call', {
  caller, type, callId, expiresAt, directChannelId,
});
```

`pending_call_invites` yayınında da aynı alan taşınmalı (`sendPendingCalls`).

Mobil istemci bu alanı geldiğinde otomatik kullanır; gelmezse mevcut
tahmin yoluna düşer. **Geriye dönük uyumlu.**

---

## Görev 3 — Davetle katılım ucu (öncelik: orta)

**Sorun:** Davet koduyla sunucuya katılmanın API karşılığı yok. İş bir
sunucu bileşeni sayfasında yapılıyor:
`src/app/(invite)/(routes)/i/[inviteCode]/page.tsx` (~66. satırda
`db.member.create`). `POST /api/servers/[id]/join` ise yalnızca `isPublic`
sunucular için çalışıyor, gizli sunucuya davetle giriş yolu yok.

Yeni uç: `POST /api/i/[inviteCode]/join`

- Kod geçerli mi, süresi dolmuş mu (`ServerInvite` varsa onu da denetle).
- Kullanıcı zaten üyeyse 200 + mevcut sunucuyu dön (hata değil).
- Sunucu yasağı (`ServerBan`) varsa 403.
- Üyelik oluştur, sunucuyu dön: `{ id, name, imageUrl }`.
- Mantığı sayfadan bu uca taşı; sayfa da bu ucu çağırsın ki **tek
  uygulama** kalsın (kopyala-yapıştır iki kod yolu istenmiyor).

Mobil `servers/new.tsx` ekranı bu ucu bekliyor; şu an kullanıcıya
"mobilden gizli sunucuya katılım desteklenmiyor" mesajı gösteriyor.

---

## Görev 4 — Ortak sunucular ucu (öncelik: düşük)

**Sorun:** Mobil profil ekranındaki "Ortak Sunucular" kartı kaldırıldı;
hesaplamak sunucu başına ayrı istek (N+1) gerektiriyor.

Yeni uç: `GET /api/profiles/[profileId]/mutual`

```json
{
  "servers": [{ "id": "...", "name": "...", "imageUrl": "..." }],
  "friendCount": 3
}
```

- Yalnızca **isteği yapanın da üye olduğu** sunucular dönmeli — aksi halde
  bir kullanıcının hangi sunucularda olduğu sızar.
- Hayalet üyelikler (`VISIBLE_MEMBER_WHERE`) hariç tutulmalı.

---

## Görev 5 — Grup DM (öncelik: düşük, en büyük iş)

**Sorun:** `Direct` modeli `profileOneId` / `profileTwoId` ile **birebir**
sohbete kilitli. Referans tasarımdaki "Yeni Grup" akışı yapılamıyor.

Gerekli:
- `GroupDirect` + `GroupDirectMember` modelleri (additive).
- `GroupDirectMessage` veya `DirectMessage`'a nullable `groupDirectId`.
- Uçlar: oluştur, üye ekle/çıkar, listele, mesaj gönder/oku.
- Socket.IO oda adları ve `verifyChatMembership` genişletmesi.

Bu görev diğerlerinden bağımsız ve büyüktür; en sona bırakılabilir.

---

## Zaten yapıldı — tekrar etme

Bu iki değişiklik ciklet-web'de **uygulandı**. İkisi de additive; mevcut
davranışı değiştirmiyor. Aynı dosyalara dokunacaksan üzerine yaz, geri alma.

1. **`GET /api/folders`** eklendi (`src/app/api/folders/route.ts`).
   Klasörlerin adını, rengini ve sırasını döner; web'in sunucu
   bileşenindeki (`components/navigation/v2/navigation-sidebar-loader.tsx`)
   sorgunun uç karşılığıdır. Mobil ray klasör rengini buradan alıyor.

2. **`GET /api/members/mine`** select'ine `server.profileId` eklendi
   (`src/app/api/members/mine/route.ts`). Mobil ray, sahip olunan sunucuya
   web'deki gibi altın çerçeve çiziyor; web de `isOwner`'ı zaten bu alandan
   türetiyor.

> ⚠️ Bu iki değişiklik **ciklet-web yeniden dağıtılana kadar** üretimde
> etkili olmaz. O zamana dek mobilde klasör rengi varsayılana düşer ve
> sahiplik çerçevesi hiç çizilmez — ikisi de sessizce bozulmaz, yalnızca
> görünmez.

---

## Doğrulama

Her görev sonrası:

```bash
pnpm lint
npx tsc --noEmit
```

Push için uçtan uca test: mobil uygulamayı **tamamen kapat** (arka plandan
da çıkar), başka bir hesaptan ara, telefonun çalması gerekir.
