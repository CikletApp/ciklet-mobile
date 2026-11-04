import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** it — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Gioco",
  close: "Chiudi",
  openOnSteam: "Apri su Steam",
  viewOnSteam: "Visualizza su Steam",
  openWebsite: "Apri il sito ufficiale",
  viewOnIgdb: "Visualizza su IGDB",
  error: {
    gameNotFound: "Le informazioni su questo gioco non sono disponibili.",
    programNotFound: "Le informazioni su questa app non sono disponibili.",
    gameFailed: "Impossibile caricare le informazioni sul gioco.",
    programFailed: "Impossibile caricare le informazioni sull'app.",
  },
  about: {
    title: "Informazioni",
    showMore: "Mostra di più",
    showLess: "Mostra meno",
    source: "Fonte:",
    wikipediaLang: "Wikipedia ({lang})",
  },
  details: {
    title: "Dettagli",
    genre: "Genere",
    category: "Categoria",
    developer: "Sviluppatore",
    publisher: "Editore",
    releaseDate: "Data di uscita",
    firstRelease: "Prima uscita",
    platform: "Piattaforma",
    license: "Licenza",
    website: "Sito ufficiale",
    steamStore: "Negozio Steam",
  },
  license: {
    openSource: "Open source",
    freeware: "Freeware",
    proprietary: "Proprietaria",
  },
  sources: "Fonte: {list}",
  credits: {
    title: "Immagini: Wikimedia Commons",
    logo: "Logo",
    screenshot: "Screenshot",
    unknownLicense: "licenza nella pagina del file",
  },
} satisfies Translation<typeof gameDetailTr>;
