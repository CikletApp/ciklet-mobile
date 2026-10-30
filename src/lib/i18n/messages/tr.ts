import { automodTr, streamingTr } from "./automod.tr";
import { safetyTr } from "./safety.tr";
import { voiceE2eeTr } from "./voice-e2ee.tr";
import { serverGuideTr } from "./server-guide.tr";
import { serverTagTr } from "./server-tag.tr";
import { serverBoostTr } from "./server-boost.tr";

/**
 * Türkçe sözlük — KAYNAK. Anahtar yapısı buradan türer; diğer diller
 * (en.ts) aynı şekli `satisfies Messages` ile taşımak zorunda, eksik anahtar
 * derleme hatasıdır. Yeni metin önce buraya eklenir (web `lib/i18n` ile
 * aynı düzen; anahtarlar mobil ekranlara göre).
 *
 * Değişken: `{ad}` (translate'e verilen `vars` ile doldurulur).
 */
export const tr = {
  common: {
    cancel: "Vazgeç",
    save: "Kaydet",
    close: "Kapat",
    system: "Sistem",
    on: "Açık",
    off: "Kapalı",
  },
  tabs: {
    chats: "Sohbetler",
    servers: "Sunucular",
    notifications: "Bildirimler",
    me: "Sen",
    unread: "{label}, {count} okunmamış",
  },
  /** Önizleme etiketleri — yanıt alıntısı, bildirim, sohbet listesi (lib/message-preview). */
  messagePreview: {
    voice: "🎤 Sesli mesaj",
    voiceWithDuration: "🎤 Sesli mesaj ({duration})",
    activity: "🎮 Etkinlik: {name}",
    activityUnnamed: "🎮 Etkinlik daveti",
    image: "📷 Fotoğraf",
    video: "🎥 Video",
    gif: "GIF",
    sticker: "Çıkartma",
    clip: "🎬 Klip",
    file: "📎 {name}",
    attachment: "📎 Ek",
  },
  /** Etkinlik metinleri. `broadcast`: yayın (lib/activity-broadcast) — yayın programının adı yazmaz. */
  activity: {
    broadcast: {
      live: "Yayında",
      game: "{game} yayını yapıyor",
      liveOn: "{platform}'te yayında",
      title: "Canlı yayın",
      /** Twitch/Kick kanalını tarayıcıda açan düğme. */
      watch: "Yayını İzle",
    },
  },
  /** Uygulama komutları — "/" listesi, komut kipi, "Uygulamalar" bölümleri (web ile aynı metinler). */
  appCommands: {
    commands: "Komutlar",
    apps: "Uygulamalar",
    optional: "İsteğe bağlı",
    required: "Zorunlu",
    true: "Doğru",
    false: "Yanlış",
    chooseFile: "Dosya seç",
    loading: "Yükleniyor…",
    noSuggestions: "Öneri bulunamadı",
    timedOut: "Uygulama zamanında yanıt vermedi",
    selectUser: "Bir kullanıcı seç",
    selectRole: "Bir rol seç",
    selectChannel: "Bir kanal seç",
    selectMentionable: "Bir kullanıcı ya da rol seç",
    enterValue: "Bir değer gir",
    enterNumber: "Bir sayı gir",
    runFailed: "Komut çalıştırılamadı.",
  },
  /** Mesaj bileşenleri ve bot formları (web lib/i18n ns/message-components ile aynı metinler). */
  messageComponents: {
    choose: "Seç…",
    chooseOption: "Bir seçenek seç",
    search: "Ara",
    noResults: "Sonuç bulunamadı",
    loading: "Yükleniyor…",
    confirm: "Seç",
    clear: "Temizle",
    selectedCount: "{count} seçildi",
    selectRange: "{min}–{max} seçim",
    unknown: "Bilinmeyen",
    botNoResponse: "{name} yanıt vermedi.",
    interactionFailed: "Etkileşim başlatılamadı.",
    formNoResponse: "Bot forma yanıt vermedi.",
    formFailed: "Form gönderilemedi.",
    formLabel: "Bot formu",
    submit: "Gönder",
    cancel: "İptal",
    requiredMark: "Zorunlu",
    uploadFile: "Dosya yükle",
    uploading: "Yükleniyor…",
    uploadFailed: "Dosya yüklenemedi.",
    removeFile: "Kaldır",
    fileLimit: "En fazla {max} dosya",
    allowedTypes: "İzin verilen: {types}",
    fileTypeRejected: "Bu dosya türü kabul edilmiyor.",
    download: "İndir",
    spoiler: "Spoiler",
    show: "Göster",
    openImage: "Görseli büyüt",
    attachment: "Ek",
  },
  settings: {
    title: "Ayarlar",
    editProfile: "Profilini düzenle",
    sections: {
      account: "HESAP AYARLARI",
      app: "UYGULAMA AYARLARI",
      support: "DESTEK",
      session: "OTURUM",
    },
    rows: {
      account: "Hesap",
      mentol: "Mentol",
      privacy: "Gizlilik, Veri ve Sosyal",
      friendRequests: "Arkadaşlık İstekleri",
      authorizedApps: "Yetkili Uygulamalar",
      voice: "Ses ve Video",
      appearance: "Görünüm",
      chat: "Sohbet",
      notifications: "Bildirimler",
      activity: "Etkinlik Durumu",
      help: "Yardım",
      helpSubtitle: "Destek, geri bildirim, koşullar",
      scanLogin: "Kodu tara",
      scanLoginSubtitle: "Masaüstüne telefonla giriş",
    },
    scanLogin: {
      title: "Kodu tara",
      hint: "Masaüstündeki giriş ekranında dönen halkayı çerçeveye al.",
      permissionTitle: "Kamera izni gerekli",
      permissionBody: "Masaüstündeki kodu okuyabilmek için kameraya erişmemiz gerekiyor.",
      permissionAction: "İzin ver",
      openSettings: "Ayarları aç",
      searching: "Kod aranıyor…",
      checking: "Kod doğrulanıyor…",
      gone: "Bu kodun süresi dolmuş. Masaüstünde yenilenmesini bekleyip tekrar tara.",
      confirmTitle: "Masaüstünde giriş yapılsın mı?",
      confirmBody: "Bu isteği sen başlatmadıysan reddet. Kodu kimseyle paylaşma.",
      device: "Cihaz",
      location: "Konum",
      ip: "IP adresi",
      time: "Zaman",
      justNow: "Az önce",
      approve: "Evet, giriş yap",
      reject: "Hayır, bu ben değilim",
      approved: "Onaylandı. Masaüstünde oturum açılıyor.",
      rejected: "Reddedildi. Masaüstündeki kod yenilenecek.",
      failed: "Onay gönderilemedi. Tekrar dene.",
      unknownLocation: "Bilinmiyor",
    },
    logout: {
      action: "Çıkış Yap",
      title: "Çıkış yap",
      message: "Oturumun bu cihazda kapatılacak.",
    },
    memberSince: "{date} tarihinden beri Ciklet’te",
    appearance: {
      title: "Görünüm",
      motion: {
        title: "HAREKETİ AZALT",
        description:
          "Geçişleri, kayan panelleri ve nabız animasyonlarını kısar. Sistem, telefonun erişilebilirlik ayarını izler.",
      },
      language: {
        title: "DİL",
        description: "Arayüz dili. Çeviri sürüyor; henüz çevrilmeyen metinler Türkçe görünür.",
        system: "Cihaz dili ({name})",
      },
    },
    voice: {
      title: "Ses ve Video",
      inputMode: "GİRİŞ MODU",
      vad: "Ses etkinliği",
      ptt: "Bas konuş",
      pttHint:
        "Bas konuş açıkken mikrofon ses kanalında kapalı başlar; konuşmak için ekrandaki düğmeyi basılı tut.",
      inputVolume: "MİKROFON SEVİYESİ",
      outputVolume: "HOPARLÖR SEVİYESİ",
      deviceNote:
        "Mobil işletim sistemi giriş ve çıkış aygıtını otomatik yönetir. Bluetooth veya kablolu cihaz seçimi sistem ses panelinden yapılır.",
    },
    notifications: {
      title: "Bildirimler",
      permission: "BİLDİRİM İZNİ",
      master: "Ciklet bildirimleri",
      masterDescription: "Bu cihazda bildirim gösterilmesine izin ver.",
      permissionDenied: "Bildirim izni sistem ayarlarından kapalı.",
      types: "BİLDİRİM TÜRLERİ",
      messages: "Mesajlar ve bahsetmeler",
      calls: "Gelen aramalar",
      friends: "Arkadaşlık istekleri",
      sounds: "Bildirim sesleri",
      lockScreen: "KİLİT EKRANINDA ARAMA",
      fullScreenOff: "Tam ekran arama izni kapalı",
      fullScreenBody:
        "Android, uygulama kapalıyken gelen aramanın kilit ekranında tam ekran çalması için ayrı bir izin istiyor. Kapalıyken arama yalnızca üstte bildirim olarak görünür.",
      openSettings: "Ayarları aç",
      overrides: "SUNUCU, KANAL VE SOHBET AYARLARI",
      overridesEmpty:
        "Henüz özel ayar yok. Bir sunucuya, kanala ya da sohbete basılı tutup Bildirimler'i seçerek ekleyebilirsin.",
      reset: "Varsayılana dön",
    },
  },
  /** AutoMod ayarları (Sunucu Ayarları → Moderasyon) — automod.tr.ts. */
  automod: automodTr,
  safety: safetyTr,
  voiceE2ee: voiceE2eeTr,
  /** Yayın bağlantıları ve bağlantılı roller — automod.tr.ts. */
  streaming: streamingTr,
  /** Sunucu Rehberi (web ile aynı anahtarlar) — server-guide.tr.ts. */
  serverGuide: serverGuideTr,
  /** Sunucu etiketi (web ile aynı anahtarlar) — server-tag.tr.ts. */
  serverTag: serverTagTr,
  /** Sunucu Takviyesi (web ile aynı anahtarlar) — server-boost.tr.ts. */
  serverBoost: serverBoostTr,
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** Her dilin taşıması gereken şekil. */
export type Messages = Widen<typeof tr>;
