import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** de — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Ordner erstellen",
    settingsTitle: "Ordnereinstellungen",
    nameLabel: "ORDNERNAME",
    defaultName: "Serverordner",
    colorLabel: "ORDNERFARBE",
    currentColor: "Ausgewählte Farbe",
    customColor: "Eigene Farbe",
    pickServers: "SERVER",
    pickHint: "Wähle mindestens zwei Server für den Ordner aus.",
    inFolder: "SERVER IM ORDNER ({count})",
    removeServer: "{name} aus dem Ordner entfernen",
    removeHint: "Der Ordner wird entfernt, wenn nur noch ein Server darin ist.",
    addServers: "SERVER HINZUFÜGEN",
    addServer: "{name} zum Ordner hinzufügen",
    create: "Ordner erstellen",
    done: "Fertig",
    createFailed: "Ordner konnte nicht erstellt werden",
    saveFailed: "Ordner konnte nicht gespeichert werden",
    removeFailed: "Server konnte nicht aus dem Ordner entfernt werden",
    addFailed: "Server konnte nicht zum Ordner hinzugefügt werden",
    newFolder: "Ordner erstellen",
    openSettings: "Ordnereinstellungen für {name}",
  },
  channelInvites: {
    title: "Einladungen",
    subtitle: "Einladungslinks zu diesem Kanal",
    intro: "Einladungslinks zu #{channel}. Wer beitritt, landet direkt in diesem Kanal.",
  },
} satisfies Translation<typeof parityScreensTr>;
