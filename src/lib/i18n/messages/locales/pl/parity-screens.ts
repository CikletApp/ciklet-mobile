import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** pl — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Utwórz folder",
    settingsTitle: "Ustawienia folderu",
    nameLabel: "NAZWA FOLDERU",
    defaultName: "Folder serwerów",
    colorLabel: "KOLOR FOLDERU",
    currentColor: "Wybrany kolor",
    customColor: "Własny kolor",
    pickServers: "SERWERY",
    pickHint: "Wybierz co najmniej dwa serwery do folderu.",
    inFolder: "SERWERY W FOLDERZE ({count})",
    removeServer: "Usuń {name} z folderu",
    removeHint: "Folder zostanie usunięty, gdy zostanie w nim tylko jeden serwer.",
    addServers: "DODAJ SERWERY",
    addServer: "Dodaj {name} do folderu",
    create: "Utwórz folder",
    done: "Gotowe",
    createFailed: "Nie udało się utworzyć folderu",
    saveFailed: "Nie udało się zapisać folderu",
    removeFailed: "Nie udało się usunąć serwera z folderu",
    addFailed: "Nie udało się dodać serwera do folderu",
    newFolder: "Utwórz folder",
    openSettings: "Ustawienia folderu {name}",
  },
} satisfies Translation<typeof parityScreensTr>;
