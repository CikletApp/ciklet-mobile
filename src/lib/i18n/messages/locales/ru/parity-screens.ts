import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** ru — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Создать папку",
    settingsTitle: "Настройки папки",
    nameLabel: "НАЗВАНИЕ ПАПКИ",
    defaultName: "Папка серверов",
    colorLabel: "ЦВЕТ ПАПКИ",
    currentColor: "Выбранный цвет",
    customColor: "Свой цвет",
    pickServers: "СЕРВЕРЫ",
    pickHint: "Выберите как минимум два сервера для папки.",
    inFolder: "СЕРВЕРЫ В ПАПКЕ ({count})",
    removeServer: "Убрать {name} из папки",
    removeHint: "Папка удаляется, когда в ней остаётся один сервер.",
    addServers: "ДОБАВИТЬ СЕРВЕРЫ",
    addServer: "Добавить {name} в папку",
    create: "Создать папку",
    done: "Готово",
    createFailed: "Не удалось создать папку",
    saveFailed: "Не удалось сохранить папку",
    removeFailed: "Не удалось убрать сервер из папки",
    addFailed: "Не удалось добавить сервер в папку",
    newFolder: "Создать папку",
    openSettings: "Настройки папки {name}",
  },
  channelInvites: {
    title: "Приглашения",
    subtitle: "Ссылки-приглашения в этот канал",
    intro: "Ссылки-приглашения в #{channel}. Присоединившиеся сразу попадают в этот канал.",
  },
  threads: {
    autoArchive: "АРХИВИРОВАТЬ ПРИ НЕАКТИВНОСТИ",
    archive1h: "1 час",
    archive24h: "24 часа",
    archive3d: "3 дня",
    archive1w: "1 неделя",
  },
} satisfies Translation<typeof parityScreensTr>;
