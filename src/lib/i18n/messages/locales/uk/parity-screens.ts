import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** uk — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Створити теку",
    settingsTitle: "Налаштування теки",
    nameLabel: "НАЗВА ТЕКИ",
    defaultName: "Тека серверів",
    colorLabel: "КОЛІР ТЕКИ",
    currentColor: "Вибраний колір",
    customColor: "Власний колір",
    pickServers: "СЕРВЕРИ",
    pickHint: "Виберіть щонайменше два сервери для теки.",
    inFolder: "СЕРВЕРИ В ТЕЦІ ({count})",
    removeServer: "Прибрати {name} з теки",
    removeHint: "Теку буде видалено, коли в ній залишиться один сервер.",
    addServers: "ДОДАТИ СЕРВЕРИ",
    addServer: "Додати {name} до теки",
    create: "Створити теку",
    done: "Готово",
    createFailed: "Не вдалося створити теку",
    saveFailed: "Не вдалося зберегти теку",
    removeFailed: "Не вдалося прибрати сервер з теки",
    addFailed: "Не вдалося додати сервер до теки",
    newFolder: "Створити теку",
    openSettings: "Налаштування теки {name}",
  },
} satisfies Translation<typeof parityScreensTr>;
