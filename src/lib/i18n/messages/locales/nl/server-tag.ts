import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "Servertag van {server}",
    generic: "Servertag",
  },
  settings: {
    title: "Servertag",
    description: "Leden kunnen deze tag naast hun naam tonen. Kies 2–4 letters of cijfers en een emoji-badge.",
    tagLabel: "Tag",
    tagPlaceholder: "TAG",
    tagHint: "2–4 letters of cijfers",
    badgeLabel: "Badge",
    badgeHint: "Eén emoji",
    badgeClear: "Badge verwijderen",
    badgePick: "Emoji kiezen",
    preview: "Voorbeeld",
    previewName: "Gebruiker",
    enabledLabel: "Leden de tag laten gebruiken",
    enabledDesc: "Zolang dit uit staat, wordt de tag nergens getoond.",
    needTag: "Stel een tag in voordat je dit aanzet.",
    invalidTag: "De tag moet uit 2–4 letters of cijfers bestaan.",
    save: "Opslaan",
    saved: "Servertag opgeslagen.",
    saveFailed: "Kon de servertag niet opslaan.",
  },
  profile: {
    title: "Servertag",
    description: "Kies de servertag die naast je naam wordt getoond. Alleen servers waarvan de tag aan staat, worden weergegeven.",
    none: "Geen",
    empty: "Je zit niet in een server waarvan je de tag kunt gebruiken.",
    selected: "Geselecteerd",
    updated: "Je servertag is bijgewerkt.",
    removed: "Je servertag is verwijderd.",
    failed: "Kon je servertag niet wijzigen.",
  },
  menu: {
    adopt: "Tag overnemen",
    remove: "Tag verwijderen",
  },
} satisfies Translation<typeof serverTagTr>;
