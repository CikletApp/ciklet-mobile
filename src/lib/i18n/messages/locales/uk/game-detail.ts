import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** uk — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Гра",
  close: "Закрити",
  openOnSteam: "Відкрити в Steam",
  viewOnSteam: "Переглянути в Steam",
  openWebsite: "Відкрити офіційний сайт",
  viewOnIgdb: "Переглянути на IGDB",
  error: {
    gameNotFound: "Інформація про цю гру недоступна.",
    programNotFound: "Інформація про цей застосунок недоступна.",
    gameFailed: "Не вдалося завантажити інформацію про гру.",
    programFailed: "Не вдалося завантажити інформацію про застосунок.",
  },
  about: {
    title: "Про гру",
    showMore: "Показати більше",
    showLess: "Показати менше",
    source: "Джерело:",
    wikipediaLang: "Вікіпедія ({lang})",
  },
  details: {
    title: "Подробиці",
    genre: "Жанр",
    category: "Категорія",
    developer: "Розробник",
    publisher: "Видавець",
    releaseDate: "Дата виходу",
    firstRelease: "Перший випуск",
    platform: "Платформа",
    license: "Ліцензія",
    website: "Офіційний сайт",
    steamStore: "Магазин Steam",
  },
  license: {
    openSource: "Відкритий код",
    freeware: "Безкоштовна",
    proprietary: "Власницька",
  },
  sources: "Джерело: {list}",
  credits: {
    title: "Зображення: Wikimedia Commons",
    logo: "Логотип",
    screenshot: "Знімок екрана",
    unknownLicense: "ліцензія на сторінці файлу",
  },
} satisfies Translation<typeof gameDetailTr>;
