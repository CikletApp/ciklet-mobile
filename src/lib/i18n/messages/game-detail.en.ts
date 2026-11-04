type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
import type { gameDetailTr } from "./game-detail.tr";

/** English for game-detail.tr.ts. */
export const gameDetailEn = {
  fallbackTitle: "Game",
  close: "Close",
  openOnSteam: "Open on Steam",
  viewOnSteam: "View on Steam",
  openWebsite: "Open Official Site",
  viewOnIgdb: "View on IGDB",
  error: {
    gameNotFound: "Information about this game isn't available.",
    programNotFound: "Information about this app isn't available.",
    gameFailed: "Couldn't load game information.",
    programFailed: "Couldn't load app information.",
  },
  about: {
    title: "About",
    showMore: "Show more",
    showLess: "Show less",
    source: "Source:",
    wikipediaLang: "Wikipedia ({lang})",
  },
  details: {
    title: "Details",
    genre: "Genre",
    category: "Category",
    developer: "Developer",
    publisher: "Publisher",
    releaseDate: "Release date",
    firstRelease: "First release",
    platform: "Platform",
    license: "License",
    website: "Official site",
    steamStore: "Steam store",
  },
  license: {
    openSource: "Open source",
    freeware: "Freeware",
    proprietary: "Proprietary",
  },
  sources: "Source: {list}",
  credits: {
    title: "Images: Wikimedia Commons",
    logo: "Logo",
    screenshot: "Screenshot",
    unknownLicense: "license on file page",
  },
} as const satisfies Widen<typeof gameDetailTr>;
