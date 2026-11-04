import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** nl — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Map maken",
    settingsTitle: "Mapinstellingen",
    nameLabel: "MAPNAAM",
    defaultName: "Servermap",
    colorLabel: "MAPKLEUR",
    currentColor: "Geselecteerde kleur",
    customColor: "Aangepaste kleur",
    pickServers: "SERVERS",
    pickHint: "Kies minstens twee servers voor de map.",
    inFolder: "SERVERS IN MAP ({count})",
    removeServer: "{name} uit de map halen",
    removeHint: "De map wordt verwijderd als er nog maar één server in zit.",
    addServers: "SERVERS TOEVOEGEN",
    addServer: "{name} aan de map toevoegen",
    create: "Map maken",
    done: "Klaar",
    createFailed: "Map kon niet worden gemaakt",
    saveFailed: "Map kon niet worden opgeslagen",
    removeFailed: "Server kon niet uit de map worden gehaald",
    addFailed: "Server kon niet aan de map worden toegevoegd",
    newFolder: "Map maken",
    openSettings: "Mapinstellingen van {name}",
  },
} satisfies Translation<typeof parityScreensTr>;
