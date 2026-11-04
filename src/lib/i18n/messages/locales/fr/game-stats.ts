import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** fr: game-stats.tr.ts (web locales/fr/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Statistiques de jeu",
    updated: "Mis à jour {time}",
    by: "par {app}",
  },
  verified: {
    label: "Vérifié",
    tooltip: "Jeu vérifié — son développeur a été vérifié par Ciklet",
  },
  privacy: {
    title: "Statistiques de jeu",
    description: "Les statistiques que les jeux et applications écrivent dans la section Jeux de ton profil. Les cartes masquées ne sont visibles par personne.",
    empty: "Aucun jeu n’a encore écrit de statistiques sur ton profil.",
    show: "Afficher sur mon profil",
    remove: "Retirer",
    hidden: "Masqué",
  },
} satisfies Translation<typeof gameStatsTr>;
