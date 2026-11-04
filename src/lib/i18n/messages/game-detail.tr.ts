/**
 * Oyun / program detay penceresi (components/games/game-detail-dialog).
 * Türkçe kaynak; İngilizcesi game-detail.en.ts (aynı şekil zorunlu).
 * Çeviri kademeli: başlık çubuğu, açıklama, detaylar ve kaynak/atıf metinleri
 * burada; pencerenin kalan metinleri henüz Türkçe.
 */
export const gameDetailTr = {
  fallbackTitle: "Oyun",
  close: "Kapat",
  openOnSteam: "Steam'de aç",
  viewOnSteam: "Steam'de Görüntüle",
  openWebsite: "Resmi Siteyi Aç",
  viewOnIgdb: "IGDB'de Görüntüle",
  error: {
    gameNotFound: "Bu oyunun bilgisine ulaşılamıyor.",
    programNotFound: "Bu programın bilgisine ulaşılamıyor.",
    gameFailed: "Oyun bilgisi yüklenemedi.",
    programFailed: "Program bilgisi yüklenemedi.",
  },
  about: {
    title: "Hakkında",
    showMore: "Devamını göster",
    showLess: "Daha az göster",
    source: "Kaynak:",
    wikipediaLang: "Wikipedia ({lang})",
  },
  details: {
    title: "Detaylar",
    genre: "Tür",
    category: "Kategori",
    developer: "Geliştirici",
    publisher: "Yayıncı",
    releaseDate: "Çıkış tarihi",
    firstRelease: "İlk sürüm",
    platform: "Platform",
    license: "Lisans",
    website: "Resmi site",
    steamStore: "Steam mağazası",
  },
  license: {
    openSource: "Açık kaynak",
    freeware: "Ücretsiz",
    proprietary: "Sahipli",
  },
  sources: "Kaynak: {list}",
  credits: {
    title: "Görseller: Wikimedia Commons",
    logo: "Logo",
    screenshot: "Ekran görüntüsü",
    unknownLicense: "lisans dosya sayfasında",
  },
} as const;
