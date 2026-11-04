import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** de: game-stats.tr.ts (web locales/de/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Spielstatistiken",
    updated: "Aktualisiert {time}",
    by: "von {app}",
  },
  verified: {
    label: "Verifiziert",
    tooltip: "Verifiziertes Spiel – der Entwickler wurde von Ciklet verifiziert",
  },
  privacy: {
    title: "Spielstatistiken",
    description: "Statistiken, die Spiele und Apps in den Spiele-Bereich deines Profils schreiben. Ausgeblendete Karten sieht niemand.",
    empty: "Noch hat kein Spiel Statistiken in dein Profil geschrieben.",
    show: "In meinem Profil anzeigen",
    remove: "Entfernen",
    hidden: "Ausgeblendet",
  },
} satisfies Translation<typeof gameStatsTr>;
