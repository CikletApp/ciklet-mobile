import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** es-ES — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Juego",
  close: "Cerrar",
  openOnSteam: "Abrir en Steam",
  viewOnSteam: "Ver en Steam",
  openWebsite: "Abrir sitio oficial",
  viewOnIgdb: "Ver en IGDB",
  error: {
    gameNotFound: "No hay información disponible sobre este juego.",
    programNotFound: "No hay información disponible sobre esta aplicación.",
    gameFailed: "No se ha podido cargar la información del juego.",
    programFailed: "No se ha podido cargar la información de la aplicación.",
  },
  about: {
    title: "Acerca de",
    showMore: "Mostrar más",
    showLess: "Mostrar menos",
    source: "Fuente:",
    wikipediaLang: "Wikipedia ({lang})",
  },
  details: {
    title: "Detalles",
    genre: "Género",
    category: "Categoría",
    developer: "Desarrollador",
    publisher: "Editor",
    releaseDate: "Fecha de lanzamiento",
    firstRelease: "Primer lanzamiento",
    platform: "Plataforma",
    license: "Licencia",
    website: "Sitio oficial",
    steamStore: "Tienda de Steam",
  },
  license: {
    openSource: "Código abierto",
    freeware: "Freeware",
    proprietary: "Propietario",
  },
  sources: "Fuente: {list}",
  credits: {
    title: "Imágenes: Wikimedia Commons",
    logo: "Logotipo",
    screenshot: "Captura de pantalla",
    unknownLicense: "licencia en la página del archivo",
  },
} satisfies Translation<typeof gameDetailTr>;
