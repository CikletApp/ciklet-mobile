import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** de — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Spiel",
  close: "Schließen",
  openOnSteam: "Auf Steam öffnen",
  viewOnSteam: "Auf Steam ansehen",
  openWebsite: "Offizielle Website öffnen",
  viewOnIgdb: "Auf IGDB ansehen",
  error: {
    gameNotFound: "Zu diesem Spiel sind keine Informationen verfügbar.",
    programNotFound: "Zu dieser App sind keine Informationen verfügbar.",
    gameFailed: "Spielinformationen konnten nicht geladen werden.",
    programFailed: "App-Informationen konnten nicht geladen werden.",
  },
  about: {
    title: "Info",
    showMore: "Mehr anzeigen",
    showLess: "Weniger anzeigen",
    source: "Quelle:",
    wikipediaLang: "Wikipedia ({lang})",
  },
  details: {
    title: "Details",
    genre: "Genre",
    category: "Kategorie",
    developer: "Entwickler",
    publisher: "Publisher",
    releaseDate: "Erscheinungsdatum",
    firstRelease: "Erstveröffentlichung",
    platform: "Plattform",
    license: "Lizenz",
    website: "Offizielle Website",
    steamStore: "Steam-Shop",
  },
  license: {
    openSource: "Open Source",
    freeware: "Freeware",
    proprietary: "Proprietär",
  },
  sources: "Quelle: {list}",
  credits: {
    title: "Bilder: Wikimedia Commons",
    logo: "Logo",
    screenshot: "Screenshot",
    unknownLicense: "Lizenz auf der Dateiseite",
  },
} satisfies Translation<typeof gameDetailTr>;
