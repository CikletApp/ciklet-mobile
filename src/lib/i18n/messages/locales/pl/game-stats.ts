import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** pl: game-stats.tr.ts (web locales/pl/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Statystyki gier",
    updated: "Zaktualizowano {time}",
    by: "od {app}",
  },
  verified: {
    label: "Zweryfikowana",
    tooltip: "Zweryfikowana gra — jej twórca został zweryfikowany przez Ciklet",
  },
  privacy: {
    title: "Statystyki gier",
    description: "Statystyki, które gry i aplikacje zapisują w sekcji Gry na twoim profilu. Ukrytych kart nikt nie widzi.",
    empty: "Żadna gra nie zapisała jeszcze statystyk na twoim profilu.",
    show: "Pokaż na moim profilu",
    remove: "Usuń",
    hidden: "Ukryte",
  },
} satisfies Translation<typeof gameStatsTr>;
