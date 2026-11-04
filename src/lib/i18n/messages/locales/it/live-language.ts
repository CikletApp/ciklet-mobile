import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "Traduci",
    translating: "Traduzione in corso…",
    unsupported: "La traduzione non è supportata in questo browser",
    unsupportedDevice: "La traduzione non è supportata su questo dispositivo",
    remove: "Rimuovi traduzione",
  },
  footer: {
    translatedFrom: "Tradotto da: {language}",
    showOriginal: "Mostra originale",
    showTranslation: "Mostra traduzione",
    dismiss: "Chiudi traduzione",
    translating: "Traduzione in corso…",
    downloading: "Download del modello linguistico sul tuo dispositivo… {percent}%",
  },
  errors: {
    same: "Questo messaggio è già in {language}.",
    unavailable: "La traduzione sul dispositivo non è disponibile per questa coppia di lingue.",
    undetected: "Impossibile rilevare la lingua del messaggio.",
    empty: "Non c'è testo da tradurre.",
    failed: "Impossibile tradurre.",
  },
  settings: {
    title: "Lingua di destinazione della traduzione",
    description: "«Traduci» traduce i messaggi in questa lingua. La traduzione avviene sul tuo dispositivo; il contenuto dei messaggi non viene mai inviato ai server di Ciklet.",
    auto: "Lingua dell'interfaccia ({language})",
    unsupported: "Questo browser non supporta la traduzione sul dispositivo; usa una versione recente di Chrome o Edge.",
    unsupportedDevice: "Questo dispositivo non supporta la traduzione sul dispositivo.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "Sottotitoli",
  title: "Sottotitoli in tempo reale",
  publish: {
    label: "Sottotitola la mia voce",
    description: "La tua voce viene trascritta sul tuo dispositivo e inviata solo alle persone in questa chiamata. Nessun audio viene registrato.",
  },
  show: {
    label: "Mostra sottotitoli",
    description: "Il parlato dei partecipanti che hanno attivato i sottotitoli appare in fondo allo schermo.",
  },
  language: "Lingua parlata",
  languageAuto: "Lingua dell'interfaccia",
  indicator: "Sottotitoli attivi",
  indicatorHelp: "Questa persona trasmette la sua voce come sottotitoli.",
  status: {
    listening: "In ascolto…",
    muted: "Il tuo microfono è spento: sottotitoli in pausa.",
    unsupported: "Il riconoscimento vocale non è supportato su questo dispositivo.",
    denied: "L'autorizzazione al microfono o al riconoscimento vocale non è stata concessa.",
    e2eeBlocked: "Questo dispositivo non può crittografare i sottotitoli in una chiamata crittografata end-to-end; la trasmissione dei sottotitoli è disattivata.",
    e2ee: "I sottotitoli vengono inviati con crittografia end-to-end.",
    cloud: "Il tuo browser potrebbe usare un proprio servizio vocale per riconoscere la tua voce; l'audio non arriva mai ai server di Ciklet.",
    onDevice: "Il riconoscimento vocale avviene sul tuo dispositivo.",
    error: "Il riconoscimento vocale si è interrotto.",
  },
  empty: "Ancora nessun sottotitolo.",
} satisfies Translation<typeof liveCaptionsTr>;
