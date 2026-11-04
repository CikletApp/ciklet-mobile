import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** pl — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Serwery",
  home: "Wiadomości prywatne",
  addServer: "Dodaj serwer",
  discover: "Odkrywaj serwery",
  download: "Pobierz aplikacje",
  newActivity: "Nowa aktywność na #{channel}",
  voiceCount: "Na głosowym: {count}",
  unread: "Nieprzeczytane: {count}",
  keyboardHint: "Alt+Shift+Góra/Dół, aby przenieść",
  folder: {
    defaultName: "Folder serwerów",
    aria: "Folder {name}, serwery: {count}",
    markRead: "Oznacz folder jako przeczytany",
    moveTo: "Przenieś do:",
    settings: "Ustawienia folderu",
    closeAll: "Zamknij wszystkie foldery",
  },
  move: {
    top: "Na samą górę",
    up: "O jeden w górę",
    down: "O jeden w dół",
    bottom: "Na sam dół",
  },
  server: {
    markRead: "Oznacz jako przeczytane",
    removeFromFolder: "Usuń z folderu",
    addToFolder: "Dodaj do folderu: {name}",
  },
  settings: {
    title: "Ustawienia folderu",
    name: "Nazwa folderu",
    color: "Kolor folderu",
    customColor: "Własny kolor",
    done: "Gotowe",
  },
  toast: {
    saveFailed: "Nie udało się zapisać kolejności serwerów; przywrócono poprzedni układ.",
    folderSaveFailed: "Nie udało się zapisać ustawień folderu.",
  },
} satisfies Translation<typeof serverRailTr>;
