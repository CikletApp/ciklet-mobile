import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** nl — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Game",
  close: "Sluiten",
  openOnSteam: "Openen in Steam",
  viewOnSteam: "Bekijken op Steam",
  openWebsite: "Officiële site openen",
  viewOnIgdb: "Bekijken op IGDB",
  error: {
    gameNotFound: "Er is geen informatie over deze game beschikbaar.",
    programNotFound: "Er is geen informatie over deze app beschikbaar.",
    gameFailed: "Kon de game-informatie niet laden.",
    programFailed: "Kon de app-informatie niet laden.",
  },
  about: {
    title: "Over",
    showMore: "Meer tonen",
    showLess: "Minder tonen",
    source: "Bron:",
    wikipediaLang: "Wikipedia ({lang})",
  },
  details: {
    title: "Details",
    genre: "Genre",
    category: "Categorie",
    developer: "Ontwikkelaar",
    publisher: "Uitgever",
    releaseDate: "Releasedatum",
    firstRelease: "Eerste release",
    platform: "Platform",
    license: "Licentie",
    website: "Officiële site",
    steamStore: "Steam-winkel",
  },
  license: {
    openSource: "Open source",
    freeware: "Freeware",
    proprietary: "Propriëtair",
  },
  sources: "Bron: {list}",
  credits: {
    title: "Afbeeldingen: Wikimedia Commons",
    logo: "Logo",
    screenshot: "Schermafbeelding",
    unknownLicense: "licentie op bestandspagina",
  },
} satisfies Translation<typeof gameDetailTr>;
