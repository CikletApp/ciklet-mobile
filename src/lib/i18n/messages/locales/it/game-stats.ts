import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** it: game-stats.tr.ts (web locales/it/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Statistiche di gioco",
    updated: "Aggiornato {time}",
    by: "da {app}",
  },
  verified: {
    label: "Verificato",
    tooltip: "Gioco verificato: il suo sviluppatore è stato verificato da Ciklet",
  },
  privacy: {
    title: "Statistiche di gioco",
    description: "Statistiche che giochi e app scrivono nella sezione Giochi del tuo profilo. Le schede nascoste non sono visibili a nessuno.",
    empty: "Nessun gioco ha ancora scritto statistiche sul tuo profilo.",
    show: "Mostra sul mio profilo",
    remove: "Rimuovi",
    hidden: "Nascosto",
  },
} satisfies Translation<typeof gameStatsTr>;
