import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** fr — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Jeu",
  close: "Fermer",
  openOnSteam: "Ouvrir sur Steam",
  viewOnSteam: "Voir sur Steam",
  openWebsite: "Ouvrir le site officiel",
  viewOnIgdb: "Voir sur IGDB",
  error: {
    gameNotFound: "Aucune information disponible sur ce jeu.",
    programNotFound: "Aucune information disponible sur cette application.",
    gameFailed: "Impossible de charger les informations du jeu.",
    programFailed: "Impossible de charger les informations de l’application.",
  },
  about: {
    title: "À propos",
    showMore: "Afficher plus",
    showLess: "Afficher moins",
    source: "Source :",
    wikipediaLang: "Wikipédia ({lang})",
  },
  details: {
    title: "Détails",
    genre: "Genre",
    category: "Catégorie",
    developer: "Développeur",
    publisher: "Éditeur",
    releaseDate: "Date de sortie",
    firstRelease: "Première sortie",
    platform: "Plateforme",
    license: "Licence",
    website: "Site officiel",
    steamStore: "Boutique Steam",
  },
  license: {
    openSource: "Open source",
    freeware: "Gratuiciel",
    proprietary: "Propriétaire",
  },
  sources: "Source : {list}",
  credits: {
    title: "Images : Wikimedia Commons",
    logo: "Logo",
    screenshot: "Capture d’écran",
    unknownLicense: "licence sur la page du fichier",
  },
} satisfies Translation<typeof gameDetailTr>;
