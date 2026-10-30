import type { serverTagTr } from "./server-tag.tr";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTagEn = {
  pill: {
    tooltip: "{server} server tag",
    generic: "Server tag",
  },
  settings: {
    title: "Server Tag",
    description: "Members can show this tag next to their name. Pick 2–4 letters or numbers and an emoji badge.",
    tagLabel: "Tag",
    tagPlaceholder: "TAG",
    tagHint: "2–4 letters or numbers",
    badgeLabel: "Badge",
    badgeHint: "A single emoji",
    badgeClear: "Remove badge",
    badgePick: "Pick emoji",
    preview: "Preview",
    previewName: "User",
    enabledLabel: "Let members use the tag",
    enabledDesc: "While off, the tag is not shown anywhere.",
    needTag: "Set a tag before turning it on.",
    invalidTag: "The tag must be 2–4 letters or numbers.",
    save: "Save",
    saved: "Server tag saved.",
    saveFailed: "Couldn't save the server tag.",
  },
  profile: {
    title: "Server Tag",
    description: "Choose the server tag shown next to your name. Only servers with their tag turned on are listed.",
    none: "None",
    empty: "You're not in any server whose tag you can use.",
    selected: "Selected",
    updated: "Your server tag was updated.",
    removed: "Your server tag was removed.",
    failed: "Couldn't change your server tag.",
  },
  menu: {
    adopt: "Adopt Tag",
    remove: "Remove Tag",
  },
} satisfies Widen<typeof serverTagTr>;
