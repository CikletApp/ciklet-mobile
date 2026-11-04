import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** nl — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Servers",
  home: "Directe berichten",
  addServer: "Server toevoegen",
  discover: "Servers ontdekken",
  download: "Apps downloaden",
  newActivity: "Nieuwe activiteit in #{channel}",
  voiceCount: "{count} in spraak",
  unread: "{count} ongelezen",
  keyboardHint: "Alt+Shift+Omhoog/Omlaag om te verplaatsen",
  folder: {
    defaultName: "Servermap",
    aria: "Map {name}, {count} servers",
    markRead: "Map als gelezen markeren",
    moveTo: "Verplaatsen naar:",
    settings: "Mapinstellingen",
    closeAll: "Alle mappen sluiten",
  },
  move: {
    top: "Helemaal bovenaan",
    up: "Eén omhoog",
    down: "Eén omlaag",
    bottom: "Helemaal onderaan",
  },
  server: {
    markRead: "Markeren als gelezen",
    removeFromFolder: "Uit map verwijderen",
    addToFolder: "Aan map toevoegen: {name}",
  },
  settings: {
    title: "Mapinstellingen",
    name: "Mapnaam",
    color: "Mapkleur",
    customColor: "Aangepaste kleur",
    done: "Klaar",
  },
  toast: {
    saveFailed: "Kan de servervolgorde niet opslaan; vorige indeling hersteld.",
    folderSaveFailed: "Kan de mapinstellingen niet opslaan.",
  },
} satisfies Translation<typeof serverRailTr>;
