import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** pl — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Gra",
  close: "Zamknij",
  openOnSteam: "Otwórz w Steam",
  viewOnSteam: "Zobacz w Steam",
  openWebsite: "Otwórz oficjalną stronę",
  viewOnIgdb: "Zobacz w IGDB",
  error: {
    gameNotFound: "Informacje o tej grze są niedostępne.",
    programNotFound: "Informacje o tej aplikacji są niedostępne.",
    gameFailed: "Nie udało się wczytać informacji o grze.",
    programFailed: "Nie udało się wczytać informacji o aplikacji.",
  },
  about: {
    title: "Informacje",
    showMore: "Pokaż więcej",
    showLess: "Pokaż mniej",
    source: "Źródło:",
    wikipediaLang: "Wikipedia ({lang})",
  },
  details: {
    title: "Szczegóły",
    genre: "Gatunek",
    category: "Kategoria",
    developer: "Twórca",
    publisher: "Wydawca",
    releaseDate: "Data premiery",
    firstRelease: "Pierwsze wydanie",
    platform: "Platforma",
    license: "Licencja",
    website: "Oficjalna strona",
    steamStore: "Sklep Steam",
  },
  license: {
    openSource: "Otwarte oprogramowanie",
    freeware: "Freeware",
    proprietary: "Własnościowa",
  },
  sources: "Źródło: {list}",
  credits: {
    title: "Obrazy: Wikimedia Commons",
    logo: "Logo",
    screenshot: "Zrzut ekranu",
    unknownLicense: "licencja na stronie pliku",
  },
} satisfies Translation<typeof gameDetailTr>;
