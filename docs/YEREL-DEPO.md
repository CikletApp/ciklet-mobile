# Yerel öncelikli depo: WhatsApp modeli ve Ciklet uyarlaması

Bu belge mobil istemcinin mesajları, sesli mesajları ve dosyaları nasıl
cihazda tuttuğunu anlatır. Hedef WhatsApp'taki deneyim: uygulama açılınca
sohbetler ağı beklemeden görünür, internet yokken yazılan mesaj saat
simgesiyle bekler, bir kez inen medya bir daha inmez.

## 1. WhatsApp istemcisi nasıl çalışıyor (kısa araştırma)

- **Cihazdaki veritabanı (`msgstore.db`).** Android'de uygulamanın
  `databases/` klasöründe bir SQLite dosyası var. `messages` tablosunda
  sohbet kimliği (`key_remote_jid`), yön (`key_from_me`), istemcinin ürettiği
  mesaj kimliği (`key_id`), gövde, **durum**, milisaniyelik zaman damgası ve
  medya sütunları (MIME, boyut, ad, karma) duruyor. `(key_remote_jid,
  key_from_me, key_id)` üzerinde tekil bir indeks var. Bu indeks yeniden
  gönderimde çift kaydı önlüyor. Asıl kaynak sunucu değil, bu dosya: ekran
  her zaman yerelden okur.
- **Gönderim kuyruğu ve tikler.** Mesaj önce yerel veritabanına yazılır,
  sonra gönderilir. **Saat** mesajın hâlâ telefonda gönderilmeyi beklediğini
  gösterir (bağlantı yok, sunucu ulaşılamıyor ya da büyük dosya yükleniyor).
  **Tek gri tik** sunucuya ulaştı demek, **çift gri tik** alıcının cihazına
  ulaştı, **çift mavi tik** okundu. Çevrimdışıyken mesajlar kuyrukta kalır,
  bağlantı gelince sırayla gider. Uygulama kapanıp açılsa da kaybolmaz,
  çünkü kuyruk diskte durur.
- **Medya cihaza iner, yerelden açılır.** Fotoğraf, ses, video ve belgeler
  telefonun medya klasörüne indirilir. Sonraki her açılış yerel dosyadan
  yapılır. **Otomatik indirme** kuralları mobil veri, Wi-Fi ve dolaşım için
  ayrı ayrı belirlenir; her biri için fotoğraf, ses, video ve belge seçilebilir.
  Sesli mesajlar pratikte hep iner.
- **Açılışta ağ beklenmez.** Sohbet listesi ve son mesajlar yerel
  veritabanından ilk karede çizilir. Bağlantı kurulunca yalnızca aradaki
  fark (delta) iner ve yerel kopyayla birleşir.
- **Arka plan senkronu.** Push bildirimi uygulamayı arkada uyandırır, yeni
  mesajlar daha kullanıcı açmadan yerele yazılır.

Kaynaklar: [Group-IB, WhatsApp forensic artifacts](https://www.group-ib.com/blog/whatsapp-forensic-artifacts/),
[msgstore şeması (stackpointer)](https://stackpointer.io/security/decrypt-whatsapp-database-messages/261/),
[WhatsApp SSS: otomatik indirme](https://whatsapp.com/faq/en/iphone/28041114),
[Panda Security: tik işaretleri](https://www.pandasecurity.com/en/mediacenter/whatsapp-check-marks/).

## 2. Ciklet'e uyarlama

### 2.1 Yerel veritabanı: `src/lib/local-db.ts`

Tek bir `ciklet.db` dosyası (expo-sqlite, WAL, `synchronous=NORMAL`) var.
Şema sürümü `PRAGMA user_version` ile tutulur.

| Tablo | İçerik |
|---|---|
| `messages(chat_id, id, created_at, expires_at, bytes, json)` | Mesajın sunucu biçimi (JSON). Birincil anahtar `(chat_id, id)`; `(chat_id, created_at DESC)` ve kısmi `expires_at` indeksleri var. |
| `chats(chat_id, saved_at, last_access, next_cursor)` | Sohbet kesiminin meta bilgisi ve LRU zamanı. |
| `media(name, url, kind, bytes, last_access)` | İndirilen medya dizini. |
| `kv(key, value, updated_at)` | Küçük anlık görüntüler: sohbet listesi, okunmamışlar, arkadaşlar, üyelikler, profil, gönderim kuyruğu. |

İlk karede gereken küçük okumalar **eşzamanlıdır** ve birkaç ms sürer.
Yazmalar **eşzamansızdır**, tek bir kuyruktan geçer ve her biri tek
transaction'da yapılır. Böylece ana iş parçacığı bloklanmaz ve işlemler iç
içe geçmez. Web'de veritabanı yoktur (`local-db.web.ts`); orada eski
AsyncStorage kalıcılığı sürer.

### 2.2 Mesajlar: `src/features/chat/message-store.ts`

- **Değişmez:** bir sohbet için diskte tutulan mesajlar, sunucu geçmişinin
  en yeni ucundan geriye **boşluksuz bir kesimdir**. `next_cursor`,
  kesimin bittiği yerden sunucuya sorulacak imleçtir; `NULL` geçmişin
  başına ulaşıldığı anlamına gelir.
- **Okuma:** sohbet açılınca ilk 50 mesaj diskten eşzamanlı okunur
  (`initialData`) ve ağ beklenmez. Eski sayfalar önce diskten gelir
  (`readStoredPage`), kesim bitince sunucudan. En yeni sayfa her zaman
  sunucudan tazelenir.
- **Delta senkron:** `message-sync` mantığı değişmedi. En yeni sayfa
  çekilir, eksikler eklenir. Sayfanın tamamı yeniyse arada boşluk vardır;
  bu durumda geçmiş baştan çekilir.
- **Yazma:** sorgu önbelleği değiştikçe sohbet başına 1,5 sn ertelenir;
  uygulama arka plana geçerken hemen yazılır. Anlık görüntünün en eski
  mesajı diskte varsa (örtüşme), diskteki daha eski kısım korunur. Örtüşme
  yoksa eski kesim atılır. Kesim aralığında olup yeni kopyada olmayan
  mesajlar silinir (silinmiş ya da süresi dolmuş). Değişmeyen satır yeniden
  yazılmaz. Saf kurallar `message-db-logic.ts` dosyasındadır.
- **Sınırlar:** sohbet başına 1000 mesaj, en çok 300 sohbet ve toplam 64 MB.
  Sınır aşılınca en uzun süredir açılmayan sohbetler silinir (LRU). Açık
  sohbet silinmez.
- **Kaybolan mesajlar:** süresi geçmiş mesaj okumada süzülür. Açılışta ve
  her ön plana dönüşte `expires_at <= şimdi` olan satırlar silinir. Önbellek
  anlık görüntüsü de süresi dolanı yazmaz (`message-expiry` ile aynı kural).

### 2.3 Sohbet listesi ve okunmamışlar: `src/api/query-client.ts`

`directs`, `unread-counts`, `friends`, `memberships` ve `current-profile`
yanıtları `kv` tablosunda tutulur. Modül yüklenirken önbelleğe eşzamanlı
olarak tohumlanır; özgün güncellenme zamanı da korunur. Bu yüzden liste ilk
karede hazırdır, ekran açılınca bayat sayılıp arkada tazelenir. İskelet
yalnızca hiç veri yokken görünür.

`stores/auth.ts` son doğrulanan profili saklar. Oturum varsa kabuk
`/api/current-profile` yanıtını beklemeden açılır, profil arkada doğrulanır.
401 gelirse çıkış yapılır. Çevrimdışıyken token yenilemesi başarısız olsa
da oturum korunur.

### 2.4 Gönderim kuyruğu: `src/stores/outbox.ts` ve `src/features/chat/outbox-sender.ts`

- Her mesaj (metin, sesli mesaj, dosya) önce kuyruğa `queued` olarak yazılır.
  Kuyruk `kv.outbox` olarak diskte durur ve açılışta eşzamanlı okunur.
  Satırda saat simgesi görünür; dosya yükleniyorsa yüzdesi de yazar.
- Motor kök düzende bir kez başlar ve ekrandan bağımsızdır. Tetikleyiciler:
  yeni kayıt, NetInfo'nun "bağlandı" bildirimi, ağ geçidinin yeniden
  bağlanması, ön plana dönüş ve bekleme süresinin dolması.
- **Sıra:** bir sohbette mesajlar yazıldıkları sırayla gider. Uçuştaki ya da
  bekleyen mesaj sonrakileri bekletir. Kalıcı olarak başarısız olan mesaj
  sırayı tıkamaz.
- **Yeniden deneme:** ağ hatası deneme sayılmaz, bağlantı gelince yine
  gönderilir. 5xx ve 429 yanıtlarında üstel bekleme uygulanır (1 sn'den 60
  sn'ye, sapmalı) ve en çok 6 deneme yapılır. 4xx kalıcı hatadır; satırda
  "Gönderilemedi — Tekrar dene / Sil" çıkar.
- **Dosyalar:** sesli mesaj ve çevrimdışıyken seçilen dosya `documents/outbox/`
  klasörüne kopyalanır. Motor önce yükler, adresi kayda yazar (tekrar
  denemede yeniden yüklemez), sonra gönderir. Başarılı olunca yerel kopya
  medya önbelleğine alınır; kendi sesli mesajın ağsız çalar.
- **Çift gönderim:** HTTP gönderim ucu (`/api/socket/*-messages`) gövdeyi
  `.strict()` şemayla doğruluyor ve **istemci nonce'u kabul etmiyor**.
  Ağ geçidinin `clientNonce` alanı yalnızca ağ geçidi üzerinden gönderimde
  geri yansıtılıyor; HTTP yolunda `null`. Bu yüzden yanıt gelmeden kopan
  istek **belirsiz** işaretlenir. Yeniden gönderilmeden önce sohbetin en
  yeni sayfasında, kayıttan sonra yazılmış aynı içerikli kendi mesajımız
  aranır; varsa yeniden gönderilmez.
  *Sunucu işi:* gövdeye isteğe bağlı bir `clientNonce` alanı eklenir ve
  `(yazar, nonce)` için kısa süreli tekillik uygulanırsa bu tahmin kalkar.
  Nonce zarfta yansıtılırsa yayın eşleştirmesi de içerik yerine nonce'la
  yapılabilir.

### 2.5 Medya: `src/lib/media-cache.ts`

- Sesli mesaj, video ve dosyalar `documents/media/` klasörüne iner. Dosya
  adı URL karmasından türetilir (FNV-1a, 64 bit). Dizin `media`
  tablosundadır; toplam 1 GB aşılınca en eski erişilenler silinir. İndirme
  önce `.part` dosyasına yapılır, bitince yerine taşınır.
- Görseller expo-image disk önbelleğindedir (`cachePolicy="memory-disk"`).
- **Otomatik indirme:** Ayarlar › Sohbet altında üç anahtar var:
  "Sesli mesajlar" (her ağda, varsayılan açık), "Video ve dosyalar: Wi-Fi
  ile" (varsayılan açık) ve "… mobil veri ile" (varsayılan kapalı). Ağ türü
  NetInfo'dan okunur.
- **Sesli mesaj arka plan kuyruğu** (`features/chat/voice-prefetch.ts` →
  `prefetchVoice`, saf kurallar `lib/media-prefetch-logic.ts`): bir sohbet
  önbelleği dolduğunda ya da değiştiğinde (diskten ilk sayfa, sunucu
  sayfası, sayfalama, canlı gelen mesaj) en yeni 600 mesaj taranır, en yeni
  50 sesli mesaj kuyruğa girer. Kuyruk tekilleştirir, cihazdakini atlar, en
  yeniyi önce indirir, aynı anda en çok 2 indirme yapar ve en çok 300 iş
  tutar. Çevrimdışıyken bekler; hata 2 sn'den 5 dk'ya üstel beklemeyle 5 kez
  denenir. Bağlantı gelince ve ön plana dönünce beklemeler sıfırlanır.
  Sunucunun bildirdiği boyut 15 MB'ı aşarsa indirme kesilir. Kuyruğun kendi
  yuvaları var; kullanıcının dokunduğu indirme onun arkasında beklemez.
  Oynatıcı yerel dosyayı kullanır. Dosya henüz inmemişse düğmede ilerleme
  halkası görünür.
- Dosya kartındaki "İndir" ve video oynatma yerel kopya varsa ağa çıkmaz.
- Aynı ekranda depolama kullanımı, "Medya önbelleğini temizle" ve "Yerel
  mesajları sil" seçenekleri var.
- **Sesli mesaj ilk dokunuş:** önceden `play()` kaynak yüklenmeden
  çağrılıyordu ve ilk dokunuş yutuluyordu. Artık oynatıcı yerel dosyadan
  kurulur (yoksa önce indirilir). `isLoaded` olana kadar düğmede gösterge
  döner, sonra kendiliğinden çalar.

### 2.6 Gizlilik

Çıkış, oturum süresinin dolması ya da ban durumunda `clearPersistedCache`
şunları siler: veritabanının bütün tabloları (ardından VACUUM), bekleyen
kuyruk ve hazırlanan dosyaları, medya klasörünü ve expo-image disk ve bellek
önbelleğini.

## 3. Henüz yapılmayanlar

- **Tikler:** tek tik ve çift tik için sunucunun alıcı tarafı teslim ve okundu
  bilgisini mesaj başına yayınlaması gerekiyor. Şu an yalnızca saat
  (bekliyor) ve başarısız durumu gösteriliyor.
- **Push ile arka plan senkronu:** bildirim geldiğinde arka planda
  `syncLatestMessages` çalıştırıp yerele yazmak (expo-task-manager ile
  arka plan bildirim görevi). Şu an senkron ön plandaki bildirim olayında
  ve sohbet açılınca yapılıyor.
- **Sunucu tarafı nonce:** bkz. 2.4.
