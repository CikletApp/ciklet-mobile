import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "Тег сервера {server}",
    generic: "Тег сервера",
  },
  settings: {
    title: "Тег сервера",
    description: "Участники могут показывать этот тег рядом со своим именем. Выберите 2–4 буквы или цифры и значок-эмодзи.",
    tagLabel: "Тег",
    tagPlaceholder: "ТЕГ",
    tagHint: "2–4 буквы или цифры",
    badgeLabel: "Значок",
    badgeHint: "Один эмодзи",
    badgeClear: "Убрать значок",
    badgePick: "Выбрать эмодзи",
    preview: "Предпросмотр",
    previewName: "Пользователь",
    enabledLabel: "Разрешить участникам использовать тег",
    enabledDesc: "Пока выключено, тег нигде не отображается.",
    needTag: "Задайте тег, прежде чем включать его.",
    invalidTag: "Тег должен состоять из 2–4 букв или цифр.",
    save: "Сохранить",
    saved: "Тег сервера сохранён.",
    saveFailed: "Не удалось сохранить тег сервера.",
  },
  profile: {
    title: "Тег сервера",
    description: "Выберите тег сервера, который будет показан рядом с вашим именем. В списке только серверы с включённым тегом.",
    none: "Нет",
    empty: "Вы не состоите ни в одном сервере, тег которого можно использовать.",
    selected: "Выбрано",
    updated: "Ваш тег сервера обновлён.",
    removed: "Ваш тег сервера удалён.",
    failed: "Не удалось изменить тег сервера.",
  },
  menu: {
    adopt: "Использовать тег",
    remove: "Убрать тег",
  },
} satisfies Translation<typeof serverTagTr>;
