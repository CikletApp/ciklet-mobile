import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** ru — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Серверы",
  home: "Личные сообщения",
  addServer: "Добавить сервер",
  discover: "Найти серверы",
  download: "Скачать приложения",
  newActivity: "Новая активность в #{channel}",
  voiceCount: "В голосовом: {count}",
  unread: "Непрочитанных: {count}",
  keyboardHint: "Alt+Shift+Вверх/Вниз — переместить",
  folder: {
    defaultName: "Папка серверов",
    aria: "Папка {name}, серверов: {count}",
    markRead: "Отметить папку как прочитанную",
    moveTo: "Переместить:",
    settings: "Настройки папки",
    closeAll: "Закрыть все папки",
  },
  move: {
    top: "В самый верх",
    up: "На одну вверх",
    down: "На одну вниз",
    bottom: "В самый низ",
  },
  server: {
    markRead: "Отметить как прочитанное",
    removeFromFolder: "Убрать из папки",
    addToFolder: "Добавить в папку: {name}",
  },
  settings: {
    title: "Настройки папки",
    name: "Название папки",
    color: "Цвет папки",
    customColor: "Свой цвет",
    done: "Готово",
  },
  toast: {
    saveFailed: "Не удалось сохранить порядок серверов; восстановлен прежний вид.",
    folderSaveFailed: "Не удалось сохранить настройки папки.",
  },
} satisfies Translation<typeof serverRailTr>;
