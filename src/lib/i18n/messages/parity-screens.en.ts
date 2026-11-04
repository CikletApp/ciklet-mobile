type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
import type { parityScreensTr } from "./parity-screens.tr";

/** parity-screens.tr.ts çevirisi. */
export const parityScreensEn = {
  folders: {
    createTitle: "Create Folder",
    settingsTitle: "Folder Settings",
    nameLabel: "FOLDER NAME",
    defaultName: "Server Folder",
    colorLabel: "FOLDER COLOR",
    currentColor: "Selected color",
    customColor: "Custom color",
    pickServers: "SERVERS",
    pickHint: "Pick at least two servers to put in the folder.",
    inFolder: "SERVERS IN FOLDER ({count})",
    removeServer: "Remove {name} from folder",
    removeHint: "The folder is removed when only one server is left in it.",
    addServers: "ADD SERVERS",
    addServer: "Add {name} to folder",
    create: "Create Folder",
    done: "Done",
    createFailed: "Couldn't create the folder",
    saveFailed: "Couldn't save the folder",
    removeFailed: "Couldn't remove the server from the folder",
    addFailed: "Couldn't add the server to the folder",
    newFolder: "Create folder",
    openSettings: "{name} folder settings",
  },
} as const satisfies Widen<typeof parityScreensTr>;
