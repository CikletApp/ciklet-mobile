import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "Tag del server {server}",
    generic: "Tag del server",
  },
  settings: {
    title: "Tag del server",
    description: "I membri possono mostrare questo tag accanto al proprio nome. Scegli 2–4 lettere o numeri e un'emoji come badge.",
    tagLabel: "Etichetta",
    tagPlaceholder: "TAG",
    tagHint: "2–4 lettere o numeri",
    badgeLabel: "Badge",
    badgeHint: "Una sola emoji",
    badgeClear: "Rimuovi badge",
    badgePick: "Scegli emoji",
    preview: "Anteprima",
    previewName: "Utente",
    enabledLabel: "Consenti ai membri di usare il tag",
    enabledDesc: "Se disattivato, il tag non viene mostrato da nessuna parte.",
    needTag: "Imposta un tag prima di attivarlo.",
    invalidTag: "Il tag deve contenere 2–4 lettere o numeri.",
    save: "Salva",
    saved: "Tag del server salvato.",
    saveFailed: "Impossibile salvare il tag del server.",
  },
  profile: {
    title: "Tag del server",
    description: "Scegli il tag del server da mostrare accanto al tuo nome. Sono elencati solo i server con il tag attivo.",
    none: "Nessuna",
    empty: "Non fai parte di nessun server di cui puoi usare il tag.",
    selected: "Selezionato",
    updated: "Il tuo tag del server è stato aggiornato.",
    removed: "Il tuo tag del server è stato rimosso.",
    failed: "Impossibile cambiare il tuo tag del server.",
  },
  menu: {
    adopt: "Adotta tag",
    remove: "Rimuovi tag",
  },
} satisfies Translation<typeof serverTagTr>;
