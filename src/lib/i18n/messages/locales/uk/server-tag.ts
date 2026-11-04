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
    description: "Учасники можуть показувати цей тег поруч зі своїм іменем. Виберіть 2–4 літери чи цифри та значок-емодзі.",
    tagLabel: "Тег",
    tagPlaceholder: "ТЕГ",
    tagHint: "2–4 літери чи цифри",
    badgeLabel: "Значок",
    badgeHint: "Один емодзі",
    badgeClear: "Прибрати значок",
    badgePick: "Вибрати емодзі",
    preview: "Попередній перегляд",
    previewName: "Користувач",
    enabledLabel: "Дозволити учасникам використовувати тег",
    enabledDesc: "Поки вимкнено, тег ніде не показується.",
    needTag: "Задайте тег, перш ніж вмикати його.",
    invalidTag: "Тег має складатися з 2–4 літер чи цифр.",
    save: "Зберегти",
    saved: "Тег сервера збережено.",
    saveFailed: "Не вдалося зберегти тег сервера.",
  },
  profile: {
    title: "Тег сервера",
    description: "Виберіть тег сервера, що показується поруч із вашим іменем. У списку лише сервери з увімкненим тегом.",
    none: "Немає",
    empty: "Ви не перебуваєте на жодному сервері, тег якого можна використати.",
    selected: "Вибрано",
    updated: "Ваш тег сервера оновлено.",
    removed: "Ваш тег сервера прибрано.",
    failed: "Не вдалося змінити ваш тег сервера.",
  },
  menu: {
    adopt: "Взяти тег",
    remove: "Прибрати тег",
  },
} satisfies Translation<typeof serverTagTr>;
