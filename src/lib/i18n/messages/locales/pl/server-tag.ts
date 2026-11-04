import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** pl — server-tag.tr.ts çevirisi. */
export const serverTag = {
  pill: {
    tooltip: "Tag serwera {server}",
    generic: "Tag serwera",
  },
  settings: {
    title: "Tag serwera",
    description: "Członkowie mogą wyświetlać ten tag obok swojej nazwy. Wybierz 2–4 litery lub cyfry i odznakę emoji.",
    tagLabel: "Etykieta",
    tagPlaceholder: "TAG",
    tagHint: "2–4 litery lub cyfry",
    badgeLabel: "Odznaka",
    badgeHint: "Pojedyncze emoji",
    badgeClear: "Usuń odznakę",
    badgePick: "Wybierz emoji",
    preview: "Podgląd",
    previewName: "Użytkownik",
    enabledLabel: "Pozwól członkom używać tagu",
    enabledDesc: "Gdy ta opcja jest wyłączona, tag nie jest nigdzie wyświetlany.",
    needTag: "Ustaw tag, zanim go włączysz.",
    invalidTag: "Tag musi składać się z 2–4 liter lub cyfr.",
    save: "Zapisz",
    saved: "Tag serwera zapisany.",
    saveFailed: "Nie udało się zapisać tagu serwera.",
  },
  profile: {
    title: "Tag serwera",
    description: "Wybierz tag serwera wyświetlany obok twojej nazwy. Na liście są tylko serwery z włączonym tagiem.",
    none: "Brak",
    empty: "Nie należysz do żadnego serwera, którego tagu możesz używać.",
    selected: "Wybrano",
    updated: "Twój tag serwera został zaktualizowany.",
    removed: "Twój tag serwera został usunięty.",
    failed: "Nie udało się zmienić twojego tagu serwera.",
  },
  menu: {
    adopt: "Przyjmij tag",
    remove: "Usuń tag",
  },
} satisfies Translation<typeof serverTagTr>;
