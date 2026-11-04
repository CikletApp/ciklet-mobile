import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** it — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Server",
  home: "Messaggi diretti",
  addServer: "Aggiungi un server",
  discover: "Esplora server",
  download: "Scarica le app",
  newActivity: "Nuova attività in #{channel}",
  voiceCount: "{count} in vocale",
  unread: "{count} non letti",
  keyboardHint: "Alt+Maiusc+Su/Giù per spostare",
  folder: {
    defaultName: "Cartella server",
    aria: "Cartella {name}, {count} server",
    markRead: "Segna cartella come letta",
    moveTo: "Sposta in:",
    settings: "Impostazioni cartella",
    closeAll: "Chiudi tutte le cartelle",
  },
  move: {
    top: "In cima",
    up: "Su di uno",
    down: "Giù di uno",
    bottom: "In fondo",
  },
  server: {
    markRead: "Segna come già letto",
    removeFromFolder: "Rimuovi dalla cartella",
    addToFolder: "Aggiungi alla cartella: {name}",
  },
  settings: {
    title: "Impostazioni cartella",
    name: "Nome cartella",
    color: "Colore cartella",
    customColor: "Colore personalizzato",
    done: "Fatto",
  },
  toast: {
    saveFailed: "Impossibile salvare l’ordine dei server; ripristinato il layout precedente.",
    folderSaveFailed: "Impossibile salvare le impostazioni della cartella.",
  },
} satisfies Translation<typeof serverRailTr>;
