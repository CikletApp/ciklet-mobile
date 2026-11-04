import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** ru — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "Игра",
  close: "Закрыть",
  openOnSteam: "Открыть в Steam",
  viewOnSteam: "Смотреть в Steam",
  openWebsite: "Открыть официальный сайт",
  viewOnIgdb: "Смотреть на IGDB",
  error: {
    gameNotFound: "Информация об этой игре недоступна.",
    programNotFound: "Информация об этом приложении недоступна.",
    gameFailed: "Не удалось загрузить информацию об игре.",
    programFailed: "Не удалось загрузить информацию о приложении.",
  },
  about: {
    title: "Об игре",
    showMore: "Показать больше",
    showLess: "Свернуть",
    source: "Источник:",
    wikipediaLang: "Википедия ({lang})",
  },
  details: {
    title: "Подробности",
    genre: "Жанр",
    category: "Категория",
    developer: "Разработчик",
    publisher: "Издатель",
    releaseDate: "Дата выхода",
    firstRelease: "Первый выпуск",
    platform: "Платформа",
    license: "Лицензия",
    website: "Официальный сайт",
    steamStore: "Магазин Steam",
  },
  license: {
    openSource: "Открытый исходный код",
    freeware: "Бесплатное ПО",
    proprietary: "Проприетарное",
  },
  sources: "Источник: {list}",
  credits: {
    title: "Изображения: Wikimedia Commons",
    logo: "Логотип",
    screenshot: "Скриншот",
    unknownLicense: "лицензия на странице файла",
  },
} satisfies Translation<typeof gameDetailTr>;
