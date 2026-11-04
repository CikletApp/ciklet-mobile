import type { serverRailTr } from "./server-rail.tr";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** Server rail v2 — English (web `ns/server-rail.en.ts` kopyası). */
export const serverRailEn = {
  label: "Servers",
  home: "Direct Messages",
  addServer: "Add a Server",
  discover: "Discover Servers",
  download: "Download Apps",
  newActivity: "New activity in #{channel}",
  voiceCount: "{count} in voice",
  unread: "{count} unread",
  keyboardHint: "Alt+Shift+Up/Down to move",
  folder: {
    defaultName: "Server Folder",
    aria: "{name} folder, {count} servers",
    markRead: "Mark Folder As Read",
    moveTo: "Move to:",
    settings: "Folder Settings",
    closeAll: "Close All Folders",
  },
  move: {
    top: "To the top",
    up: "Up one",
    down: "Down one",
    bottom: "To the bottom",
  },
  server: {
    markRead: "Mark As Read",
    removeFromFolder: "Remove From Folder",
    addToFolder: "Add to folder: {name}",
  },
  settings: {
    title: "Folder Settings",
    name: "Folder Name",
    color: "Folder Color",
    customColor: "Custom color",
    done: "Done",
  },
  toast: {
    saveFailed: "Couldn't save your server order; restored the previous layout.",
    folderSaveFailed: "Couldn't save folder settings.",
  },
} satisfies Widen<typeof serverRailTr>;
