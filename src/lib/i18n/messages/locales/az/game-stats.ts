import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** az: game-stats.tr.ts (web locales/az/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Oyun statistikası",
    updated: "{time} yeniləndi",
    by: "{app} tərəfindən",
  },
  verified: {
    label: "Təsdiqlənmiş",
    tooltip: "Təsdiqlənmiş oyun — tərtibatçısı Ciklet tərəfindən təsdiqlənib",
  },
  privacy: {
    title: "Oyun statistikası",
    description: "Oyunların və tətbiqlərin profilinin Oyunlar bölməsinə yazdığı statistika. Gizlətdiyin kartları heç kim görmür.",
    empty: "Hələ heç bir oyun profilinə statistika yazmayıb.",
    show: "Profilimdə göstər",
    remove: "Sil",
    hidden: "Gizli",
  },
} satisfies Translation<typeof gameStatsTr>;
