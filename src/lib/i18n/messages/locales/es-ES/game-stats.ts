import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** es-ES: game-stats.tr.ts (web locales/es-ES/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Estadísticas de juego",
    updated: "Actualizado {time}",
    by: "por {app}",
  },
  verified: {
    label: "Verificado",
    tooltip: "Juego verificado: Ciklet ha verificado a su desarrollador",
  },
  privacy: {
    title: "Estadísticas de juego",
    description: "Estadísticas que los juegos y aplicaciones escriben en la sección Juegos de tu perfil. Nadie ve las tarjetas ocultas.",
    empty: "Todavía ningún juego ha escrito estadísticas en tu perfil.",
    show: "Mostrar en mi perfil",
    remove: "Quitar",
    hidden: "Oculto",
  },
} satisfies Translation<typeof gameStatsTr>;
