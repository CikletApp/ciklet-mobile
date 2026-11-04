import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** nl: game-stats.tr.ts (web locales/nl/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Gamestatistieken",
    updated: "Bijgewerkt {time}",
    by: "door {app}",
  },
  verified: {
    label: "Geverifieerd",
    tooltip: "Geverifieerde game — de ontwikkelaar is geverifieerd door Ciklet",
  },
  privacy: {
    title: "Gamestatistieken",
    description: "Statistieken die games en apps naar het gedeelte Games van je profiel schrijven. Verborgen kaarten ziet niemand.",
    empty: "Er heeft nog geen game statistieken naar je profiel geschreven.",
    show: "Tonen op mijn profiel",
    remove: "Verwijderen",
    hidden: "Verborgen",
  },
} satisfies Translation<typeof gameStatsTr>;
