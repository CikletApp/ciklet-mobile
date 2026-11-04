import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "Crittografia end-to-end",
    connecting: "Configurazione della crittografia…",
    mixed: "Partecipante non crittografato presente",
    unsupported: "Connessione non crittografata",
  },
  title: "Crittografia end-to-end",
  body: {
    encrypted:
      "La tua voce, il tuo video e la tua condivisione schermo vengono decrittografati solo sui dispositivi delle persone in questa chiamata. Nessun altro, nemmeno i server di Ciklet, può vederne il contenuto.",
    connecting: "Scambio delle chiavi di crittografia con i partecipanti.",
    mixed:
      "Alcuni partecipanti usano una versione senza crittografia end-to-end. Il loro audio viene inviato senza crittografia e non possono sentire i partecipanti crittografati.",
    unsupported:
      "Questo dispositivo o browser non supporta la crittografia end-to-end: il tuo audio viene inviato senza crittografia e non puoi sentire i partecipanti crittografati. Aggiorna Ciklet o usa una versione recente di Chrome, Edge, Firefox o Safari.",
  },
  code: {
    title: "Codice privacy vocale",
    help: "Confronta questo codice con gli altri partecipanti (ad esempio leggendolo ad alta voce). Se tutti vedono lo stesso codice, la chiamata è crittografata end-to-end e nessuno sta ascoltando nel mezzo. Il codice cambia quando qualcuno entra o esce.",
    copy: "Copia codice",
    copied: "Codice copiato",
    waiting: "Il codice appare quando le chiavi sono pronte.",
  },
  unencrypted: {
    title: "Partecipanti non crittografati",
    badge: "Partecipante non crittografato",
  },
  pending: "In attesa della crittografia",
} satisfies Translation<typeof voiceE2eeTr>;
