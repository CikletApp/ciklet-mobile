import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** pl — account-switcher.tr.ts çevirisi. */
export const accountSwitcher = {
  menuItem: "Przełącz konta",
  manage: "Zarządzaj kontami",
  add: "Dodaj konto",
  title: "Zarządzaj kontami",
  description: "Przełączaj się na tym urządzeniu między {max, plural, one {# kontem} few {# kontami} many {# kontami} other {# konta}} bez ponownego logowania.",
  current: "Aktywne konto",
  switch: "Przełącz",
  switching: "Przełączanie…",
  remove: "Usuń",
  removeConfirm: "Usunąć {name} z listy kont na tym urządzeniu? Aby wrócić, musisz zalogować się ponownie.",
  needsLogin: "Zaloguj się ponownie",
  limitReached: "Możesz dodać maksymalnie {max, plural, one {# konto} few {# konta} many {# kont} other {# konta}}. Usuń jedno, aby dodać kolejne.",
  failed: "Nie udało się przełączyć konta. Spróbuj ponownie.",
  notFound: "Tego konta nie ma już na liście.",
  removed: "Konto usunięte z listy.",
  addTitle: "Dodaj konto",
  addDescription: "Zaloguj się na konto, które chcesz dodać. Twoje obecne konto pozostanie na liście.",
  addCancel: "Anuluj",
  savedTitle: "Zapisane konta",
  savedDescription: "Przełącz się na konto, którego używałeś na tym urządzeniu.",
  orSignIn: "lub zaloguj się na inne konto",
  inCallWarning: "Przełączenie konta rozłączy cię z kanałem głosowym.",
} satisfies Translation<typeof accountSwitcherTr>;
