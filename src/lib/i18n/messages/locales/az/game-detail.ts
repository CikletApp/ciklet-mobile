import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** az — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Oyun",
  close: "Bağla",
  openOnSteam: "Steam-də aç",
  viewOnSteam: "Steam-də Bax",
  openWebsite: "Rəsmi Saytı Aç",
  viewOnIgdb: "IGDB-də Bax",
  error: {
    gameNotFound: "Bu oyun haqqında məlumat əlçatan deyil.",
    programNotFound: "Bu proqram haqqında məlumat əlçatan deyil.",
    gameFailed: "Oyun məlumatı yüklənmədi.",
    programFailed: "Proqram məlumatı yüklənmədi.",
  },
  about: {
    title: "Haqqında",
    showMore: "Daha çox göstər",
    showLess: "Daha az göstər",
    source: "Mənbə:",
    wikipediaLang: "Vikipediya ({lang})",
  },
  details: {
    title: "Təfərrüatlar",
    genre: "Janr",
    category: "Kateqoriya",
    developer: "Tərtibatçı",
    publisher: "Naşir",
    releaseDate: "Buraxılış tarixi",
    firstRelease: "İlk buraxılış",
    platform: "Platforma",
    license: "Lisenziya",
    website: "Rəsmi sayt",
    steamStore: "Steam mağazası",
  },
  license: {
    openSource: "Açıq mənbə",
    freeware: "Pulsuz",
    proprietary: "Mülkiyyətli",
  },
  sources: "Mənbə: {list}",
  credits: {
    title: "Şəkillər: Wikimedia Commons",
    logo: "Loqo",
    screenshot: "Ekran görüntüsü",
    unknownLicense: "lisenziya fayl səhifəsindədir",
  },
} satisfies Translation<typeof gameDetailTr>;
