import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** pt-BR — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Jogo",
  close: "Fechar",
  openOnSteam: "Abrir na Steam",
  viewOnSteam: "Ver na Steam",
  openWebsite: "Abrir site oficial",
  viewOnIgdb: "Ver no IGDB",
  error: {
    gameNotFound: "Não há informações disponíveis sobre este jogo.",
    programNotFound: "Não há informações disponíveis sobre este app.",
    gameFailed: "Não foi possível carregar as informações do jogo.",
    programFailed: "Não foi possível carregar as informações do app.",
  },
  about: {
    title: "Sobre",
    showMore: "Mostrar mais",
    showLess: "Mostrar menos",
    source: "Fonte:",
    wikipediaLang: "Wikipédia ({lang})",
  },
  details: {
    title: "Detalhes",
    genre: "Gênero",
    category: "Categoria",
    developer: "Desenvolvedora",
    publisher: "Distribuidora",
    releaseDate: "Data de lançamento",
    firstRelease: "Primeiro lançamento",
    platform: "Plataforma",
    license: "Licença",
    website: "Site oficial",
    steamStore: "Loja da Steam",
  },
  license: {
    openSource: "Código aberto",
    freeware: "Freeware",
    proprietary: "Proprietário",
  },
  sources: "Fonte: {list}",
  credits: {
    title: "Imagens: Wikimedia Commons",
    logo: "Logo",
    screenshot: "Captura de tela",
    unknownLicense: "licença na página do arquivo",
  },
} satisfies Translation<typeof gameDetailTr>;
