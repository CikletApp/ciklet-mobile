import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "Server-Tag von {server}",
    generic: "Server-Tag",
  },
  settings: {
    title: "Server-Tag",
    description: "Mitglieder können diesen Tag neben ihrem Namen anzeigen. Wähle 2–4 Buchstaben oder Ziffern und ein Emoji-Abzeichen.",
    tagLabel: "Tag",
    tagPlaceholder: "TAG",
    tagHint: "2–4 Buchstaben oder Ziffern",
    badgeLabel: "Abzeichen",
    badgeHint: "Ein einzelnes Emoji",
    badgeClear: "Abzeichen entfernen",
    badgePick: "Emoji wählen",
    preview: "Vorschau",
    previewName: "Nutzer",
    enabledLabel: "Mitgliedern erlauben, den Tag zu verwenden",
    enabledDesc: "Solange deaktiviert, wird der Tag nirgends angezeigt.",
    needTag: "Lege einen Tag fest, bevor du ihn aktivierst.",
    invalidTag: "Der Tag muss aus 2–4 Buchstaben oder Ziffern bestehen.",
    save: "Speichern",
    saved: "Server-Tag gespeichert.",
    saveFailed: "Der Server-Tag konnte nicht gespeichert werden.",
  },
  profile: {
    title: "Server-Tag",
    description: "Wähle den Server-Tag, der neben deinem Namen angezeigt wird. Es werden nur Server aufgeführt, deren Tag aktiviert ist.",
    none: "Keine",
    empty: "Du bist auf keinem Server, dessen Tag du verwenden kannst.",
    selected: "Ausgewählt",
    updated: "Dein Server-Tag wurde aktualisiert.",
    removed: "Dein Server-Tag wurde entfernt.",
    failed: "Dein Server-Tag konnte nicht geändert werden.",
  },
  menu: {
    adopt: "Tag übernehmen",
    remove: "Tag entfernen",
  },
} satisfies Translation<typeof serverTagTr>;
