import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** de — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Server",
  home: "Direktnachrichten",
  addServer: "Server hinzufügen",
  discover: "Server entdecken",
  download: "Apps herunterladen",
  newActivity: "Neue Aktivität in #{channel}",
  voiceCount: "{count} im Sprachkanal",
  unread: "{count} ungelesen",
  keyboardHint: "Alt+Umschalt+Pfeil hoch/runter zum Verschieben",
  folder: {
    defaultName: "Serverordner",
    aria: "Ordner {name}, {count} Server",
    markRead: "Ordner als gelesen markieren",
    moveTo: "Verschieben nach:",
    settings: "Ordnereinstellungen",
    closeAll: "Alle Ordner schließen",
  },
  move: {
    top: "Ganz nach oben",
    up: "Eins nach oben",
    down: "Eins nach unten",
    bottom: "Ganz nach unten",
  },
  server: {
    markRead: "Als gelesen markieren",
    removeFromFolder: "Aus Ordner entfernen",
    addToFolder: "Zum Ordner hinzufügen: {name}",
  },
  settings: {
    title: "Ordnereinstellungen",
    name: "Ordnername",
    color: "Ordnerfarbe",
    customColor: "Eigene Farbe",
    done: "Fertig",
  },
  toast: {
    saveFailed: "Die Serverreihenfolge konnte nicht gespeichert werden; vorheriges Layout wiederhergestellt.",
    folderSaveFailed: "Ordnereinstellungen konnten nicht gespeichert werden.",
  },
} satisfies Translation<typeof serverRailTr>;
