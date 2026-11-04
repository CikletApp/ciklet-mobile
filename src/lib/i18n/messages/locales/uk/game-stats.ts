import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** uk: game-stats.tr.ts (web locales/uk/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Ігрова статистика",
    updated: "Оновлено {time}",
    by: "від {app}",
  },
  verified: {
    label: "Перевірено",
    tooltip: "Перевірена гра — її розробника підтвердив Ciklet",
  },
  privacy: {
    title: "Ігрова статистика",
    description: "Статистика, яку ігри та застосунки записують у розділ «Ігри» вашого профілю. Приховані картки ніхто не бачить.",
    empty: "Поки жодна гра не записала статистику у ваш профіль.",
    show: "Показувати в профілі",
    remove: "Вилучити",
    hidden: "Приховано",
  },
} satisfies Translation<typeof gameStatsTr>;
