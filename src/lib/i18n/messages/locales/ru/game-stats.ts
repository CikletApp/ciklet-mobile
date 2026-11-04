import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** ru: game-stats.tr.ts (web locales/ru/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "Игровая статистика",
    updated: "Обновлено {time}",
    by: "от {app}",
  },
  verified: {
    label: "Проверено",
    tooltip: "Проверенная игра — её разработчик подтверждён Ciklet",
  },
  privacy: {
    title: "Игровая статистика",
    description: "Статистика, которую игры и приложения записывают в раздел «Игры» вашего профиля. Скрытые карточки никто не видит.",
    empty: "Пока ни одна игра не записала статистику в ваш профиль.",
    show: "Показывать в профиле",
    remove: "Удалить",
    hidden: "Скрыто",
  },
} satisfies Translation<typeof gameStatsTr>;
