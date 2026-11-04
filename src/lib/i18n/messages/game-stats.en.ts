import type { gameStatsTr } from "./game-stats.tr";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** English for game-stats.tr.ts. */
export const gameStatsEn = {
  card: {
    title: "Game Stats",
    updated: "Updated {time}",
    by: "by {app}",
  },
  verified: {
    label: "Verified",
    tooltip: "Verified game — its developer was verified by Ciklet",
  },
  privacy: {
    title: "Game Stats",
    description: "Stats that games and apps write to the Games section of your profile. Hidden cards are not shown to anyone.",
    empty: "No game has written stats to your profile yet.",
    show: "Show on my profile",
    remove: "Remove",
    hidden: "Hidden",
  },
} satisfies Widen<typeof gameStatsTr>;
