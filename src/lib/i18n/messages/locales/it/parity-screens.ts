import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** it — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Crea cartella",
    settingsTitle: "Impostazioni cartella",
    nameLabel: "NOME CARTELLA",
    defaultName: "Cartella server",
    colorLabel: "COLORE CARTELLA",
    currentColor: "Colore selezionato",
    customColor: "Colore personalizzato",
    pickServers: "SERVER",
    pickHint: "Scegli almeno due server da mettere nella cartella.",
    inFolder: "SERVER NELLA CARTELLA ({count})",
    removeServer: "Rimuovi {name} dalla cartella",
    removeHint: "La cartella viene rimossa quando vi resta un solo server.",
    addServers: "AGGIUNGI SERVER",
    addServer: "Aggiungi {name} alla cartella",
    create: "Crea cartella",
    done: "Fatto",
    createFailed: "Impossibile creare la cartella",
    saveFailed: "Impossibile salvare la cartella",
    removeFailed: "Impossibile rimuovere il server dalla cartella",
    addFailed: "Impossibile aggiungere il server alla cartella",
    newFolder: "Crea cartella",
    openSettings: "Impostazioni della cartella {name}",
  },
  channelInvites: {
    title: "Inviti",
    subtitle: "Link d’invito a questo canale",
    intro: "Link d’invito a #{channel}. Chi entra arriva direttamente in questo canale.",
  },
  threads: {
    autoArchive: "ARCHIVIA DOPO INATTIVITÀ",
    archive1h: "1 ora",
    archive24h: "24 ore",
    archive3d: "3 giorni",
    archive1w: "1 settimana",
  },
} satisfies Translation<typeof parityScreensTr>;
