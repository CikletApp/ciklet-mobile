import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "Сменить аккаунт",
  manage: "Управление аккаунтами",
  add: "Добавить аккаунт",
  title: "Управление аккаунтами",
  description: "Переключайтесь между аккаунтами на этом устройстве (до {max}) без повторного входа.",
  current: "Активный аккаунт",
  switch: "Переключить",
  switching: "Переключение…",
  remove: "Удалить",
  removeConfirm: "Удалить {name} из списка аккаунтов на этом устройстве? Чтобы вернуться, придётся войти снова.",
  needsLogin: "Войти снова",
  limitReached: "Можно добавить не более {max} аккаунтов. Удалите один, чтобы добавить другой.",
  failed: "Не удалось сменить аккаунт. Попробуйте ещё раз.",
  notFound: "Этого аккаунта больше нет в списке.",
  removed: "Аккаунт удалён из списка.",
  addTitle: "Добавить аккаунт",
  addDescription: "Войдите в аккаунт, который хотите добавить. Текущий аккаунт останется в списке.",
  addCancel: "Отмена",
  savedTitle: "Сохранённые аккаунты",
  savedDescription: "Переключитесь на аккаунт, который вы использовали на этом устройстве.",
  orSignIn: "или войдите в другой аккаунт",
  inCallWarning: "При смене аккаунта голосовое подключение будет разорвано.",
} satisfies Translation<typeof accountSwitcherTr>;
