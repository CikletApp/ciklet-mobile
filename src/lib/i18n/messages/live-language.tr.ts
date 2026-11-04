/**
 * Mesaj çevirisi (lib/translation) ve canlı altyazı (lib/live-captions).
 * Türkçe kaynak; İngilizcesi live-language.en.ts. Mobil `translation` ve
 * `liveCaptions` ile aynı metinler.
 */
export const translationTr = {
  menu: {
    translate: "Çevir",
    translating: "Çevriliyor…",
    unsupported: "Bu tarayıcıda çeviri desteklenmiyor",
    unsupportedDevice: "Bu cihazda çeviri desteklenmiyor",
    remove: "Çeviriyi kaldır",
  },
  footer: {
    translatedFrom: "{language} dilinden çevrildi",
    showOriginal: "Orijinali göster",
    showTranslation: "Çeviriyi göster",
    dismiss: "Çeviriyi kapat",
    translating: "Çevriliyor…",
    downloading: "Dil modeli cihaza indiriliyor… %{percent}",
  },
  errors: {
    same: "Bu mesaj zaten {language}.",
    unavailable: "Bu dil çifti için cihazda çeviri yok.",
    undetected: "Mesajın dili algılanamadı.",
    empty: "Çevrilecek metin yok.",
    failed: "Çeviri yapılamadı.",
  },
  settings: {
    title: "Hedef çeviri dili",
    description: "“Çevir” mesajları bu dile çevirir. Çeviri cihazında yapılır; mesaj içeriği Ciklet sunucularına gönderilmez.",
    auto: "Arayüz dili ({language})",
    unsupported: "Bu tarayıcı cihaz üstü çeviriyi desteklemiyor; Chrome ya da Edge'in güncel sürümünü kullan.",
    unsupportedDevice: "Bu cihaz cihaz üstü çeviriyi desteklemiyor.",
  },
};

export const liveCaptionsTr = {
  button: "Altyazılar",
  title: "Canlı altyazı",
  publish: {
    label: "Konuşmamı altyazıla",
    description: "Konuşman cihazında yazıya çevrilir ve yalnızca bu aramadakilere gönderilir. Ses kaydı tutulmaz.",
  },
  show: {
    label: "Altyazıları göster",
    description: "Altyazı yayınını açan katılımcıların konuşmaları ekranın altında görünür.",
  },
  language: "Konuşma dili",
  languageAuto: "Arayüz dili",
  indicator: "Altyazı açık",
  indicatorHelp: "Bu kişi konuşmasını altyazı olarak yayınlıyor.",
  status: {
    listening: "Dinleniyor…",
    muted: "Mikrofonun kapalı — altyazı duraklatıldı.",
    unsupported: "Bu cihazda konuşma tanıma desteklenmiyor.",
    denied: "Mikrofon ya da konuşma tanıma izni verilmedi.",
    e2eeBlocked: "Bu cihaz uçtan uca şifreli aramada altyazıyı şifreleyemiyor; altyazı yayını kapalı.",
    e2ee: "Altyazılar uçtan uca şifreli gönderilir.",
    cloud: "Tarayıcın konuşmanı tanımak için kendi konuşma hizmetini kullanabilir; ses Ciklet sunucularına gitmez.",
    onDevice: "Konuşma tanıma cihazında yapılıyor.",
    error: "Konuşma tanıma durdu.",
  },
  empty: "Henüz altyazı yok.",
};
