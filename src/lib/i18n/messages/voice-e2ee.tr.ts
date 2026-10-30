/**
 * Uçtan uca şifreli sesli/görüntülü arama (lib/voice-e2ee): kontrol çubuğundaki
 * kilit, ses gizlilik kodu, şifrelenmemiş katılımcı uyarıları.
 * Türkçe kaynak; İngilizcesi voice-e2ee.en.ts. Web `ns/voice-e2ee.tr.ts` ile AYNI metinler.
 */
export const voiceE2eeTr = {
  status: {
    encrypted: "Uçtan uca şifreli",
    connecting: "Şifreleme kuruluyor…",
    mixed: "Şifrelenmemiş katılımcı var",
    unsupported: "Şifrelenmemiş bağlantı",
  },
  title: "Uçtan uca şifreleme",
  body: {
    encrypted:
      "Sesin, görüntün ve ekran paylaşımın yalnızca bu aramadaki katılımcıların cihazlarında çözülür. Ciklet sunucuları dahil kimse içeriği göremez.",
    connecting: "Katılımcılarla şifreleme anahtarları değiş tokuş ediliyor.",
    mixed:
      "Bazı katılımcılar uçtan uca şifrelemeyi desteklemeyen bir sürüm kullanıyor. Onların sesi şifrelenmeden iletilir ve onlar şifreli katılımcıları duyamaz.",
    unsupported:
      "Bu cihaz ya da tarayıcı uçtan uca şifrelemeyi desteklemiyor: sesin şifrelenmeden iletiliyor ve şifreli katılımcıları duyamazsın. Ciklet'i güncelle ya da Chrome, Edge, Firefox veya Safari'nin güncel sürümünü kullan.",
  },
  code: {
    title: "Ses gizlilik kodu",
    help: "Bu kodu diğer katılımcılarla karşılaştır (örneğin sesli oku). Herkeste aynıysa arama uçtan uca şifreli ve araya giren kimse yok. Biri katıldığında ya da ayrıldığında kod değişir.",
    copy: "Kodu kopyala",
    copied: "Kod kopyalandı",
    waiting: "Kod, anahtarlar hazır olunca görünür.",
  },
  unencrypted: {
    title: "Şifrelenmemiş katılımcılar",
    badge: "Şifrelenmemiş katılımcı",
  },
  pending: "Şifreleme bekleniyor",
} as const;
