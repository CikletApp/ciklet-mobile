import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** pt-BR: game-stats.tr.ts (web locales/pt-BR/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Estatísticas de jogo",
    updated: "Atualizado {time}",
    by: "por {app}",
  },
  verified: {
    label: "Verificado",
    tooltip: "Jogo verificado — o desenvolvedor foi verificado pelo Ciklet",
  },
  privacy: {
    title: "Estatísticas de jogo",
    description: "Estatísticas que jogos e apps escrevem na seção Jogos do seu perfil. Cartões ocultos não aparecem para ninguém.",
    empty: "Nenhum jogo escreveu estatísticas no seu perfil ainda.",
    show: "Mostrar no meu perfil",
    remove: "Remover",
    hidden: "Oculto",
  },
} satisfies Translation<typeof gameStatsTr>;
