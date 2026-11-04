import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "Cambia account",
  manage: "Gestisci account",
  add: "Aggiungi un account",
  title: "Gestisci account",
  description: "Passa da un account all'altro (fino a {max}) su questo dispositivo senza dover accedere di nuovo.",
  current: "Account attivo",
  switch: "Cambia",
  switching: "Cambio in corso…",
  remove: "Rimuovi",
  removeConfirm: "Vuoi rimuovere {name} dall'elenco degli account di questo dispositivo? Dovrai accedere di nuovo per tornarci.",
  needsLogin: "Accedi di nuovo",
  limitReached: "Puoi aggiungere fino a {max} account. Rimuovine uno per aggiungerne un altro.",
  failed: "Impossibile cambiare account. Riprova.",
  notFound: "Questo account non è più nell'elenco.",
  removed: "Account rimosso dall'elenco.",
  addTitle: "Aggiungi un account",
  addDescription: "Accedi con l'account che vuoi aggiungere. L'account attuale resta nell'elenco.",
  addCancel: "Annulla",
  savedTitle: "Account salvati",
  savedDescription: "Passa a un account che hai usato su questo dispositivo.",
  orSignIn: "oppure accedi con un altro account",
  inCallWarning: "Cambiando account verrai disconnesso dalla connessione vocale.",
} satisfies Translation<typeof accountSwitcherTr>;
