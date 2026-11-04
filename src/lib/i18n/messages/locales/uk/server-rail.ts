import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** uk — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Сервери",
  home: "Особисті повідомлення",
  addServer: "Додати сервер",
  discover: "Шукати сервери",
  download: "Завантажити застосунки",
  newActivity: "Нова активність у #{channel}",
  voiceCount: "У голосовому: {count}",
  unread: "Непрочитаних: {count}",
  keyboardHint: "Alt+Shift+Вгору/Вниз — перемістити",
  folder: {
    defaultName: "Тека серверів",
    aria: "Тека {name}, серверів: {count}",
    markRead: "Позначити теку прочитаною",
    moveTo: "Перемістити:",
    settings: "Налаштування теки",
    closeAll: "Закрити всі теки",
  },
  move: {
    top: "На самий верх",
    up: "На одну вгору",
    down: "На одну вниз",
    bottom: "В самий низ",
  },
  server: {
    markRead: "Позначити як прочитане",
    removeFromFolder: "Прибрати з теки",
    addToFolder: "Додати до теки: {name}",
  },
  settings: {
    title: "Налаштування теки",
    name: "Назва теки",
    color: "Колір теки",
    customColor: "Власний колір",
    done: "Готово",
  },
  toast: {
    saveFailed: "Не вдалося зберегти порядок серверів; відновлено попередній вигляд.",
    folderSaveFailed: "Не вдалося зберегти налаштування теки.",
  },
} satisfies Translation<typeof serverRailTr>;
