/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "Nessun timeout",
    s60: "60 secondi",
    m5: "5 minuti",
    m10: "10 minuti",
    h1: "1 ora",
    d1: "1 giorno",
    w1: "1 settimana",
  },
  settings: {
    words: {
      title: "AutoMod — Parole vietate",
      description: "Separa con virgole o a capo; vengono confrontate le parole intere, termina con * per trovare un prefisso. Vengono rilevati anche i trucchi di scrittura (lettere ripetute, cifre/simboli, separatori). I messaggi corrispondenti non possono essere inviati (vengono rimossi se arrivano tramite il gateway). Fino a {max} parole.",
      placeholder: "parola1, parola2, prefisso*",
      count: "{count, plural, one {# parola} many {# parole} other {# parole}}",
    },
    mentions: {
      title: "AutoMod — Spam di menzioni",
      description: "Blocca un messaggio che tagga più di questo numero di persone o ruoli diversi. Lascia vuoto per disattivare (max {max}).",
      off: "Disattivo",
    },
    linkFilter: {
      title: "AutoMod — Filtro link",
      description: "Se attivo, i link sono consentiti solo verso i domini qui sotto (e i loro sottodomini); gli allegati sono sempre consentiti. Fino a {max} domini.",
      emptyWarning: "Nessun dominio consentito: ogni link viene bloccato.",
    },
    actionsSection: {
      title: "AutoMod — Azioni",
      description: "Un messaggio che viola una regola viene sempre bloccato. Facoltativamente l'autore viene messo in timeout e l'evento viene pubblicato nel tuo canale di moderazione e nel canale del messaggio.",
      timeout: "Timeout",
      alertChannel: "Canale di moderazione",
      noAlert: "Nessun avviso",
    },
    preset: {
      title: "AutoMod — Filtro volgarità in turco",
      description: "Un elenco completo e pronto all'uso di volgarità e insulti in turco. Rileva anche i trucchi di scrittura (lettere ripetute, 4→a, 1→ı, 0→o, $→s, separazioni con punti o spazi) e ignora parole innocue come \"sıkıntı\", \"amaç\" o \"piknik\".",
      enable: "Attiva con un clic",
      enabled: "Attivo",
      allowTitle: "Parole consentite",
      allowDescription: "Parole che non devono mai essere bloccate (separa con virgole o a capo; termina con * per un prefisso). Si applica sia all'elenco predefinito sia all'elenco delle parole vietate.",
      allowPlaceholder: "amina, parola*",
    },
    spam: {
      title: "AutoMod — Rilevamento spam",
      description: "Blocca i messaggi dei membri che inviano molti messaggi in poco tempo o ripetono lo stesso contenuto.",
      maxMessages: "Messaggi massimi",
      window: "Intervallo (secondi)",
      duplicates: "Ripetizioni dello stesso messaggio (60 s)",
    },
    caps: {
      title: "AutoMod — Troppe maiuscole",
      description: "Blocca i messaggi in cui la quota di lettere maiuscole supera quella indicata (esclusi i messaggi brevi).",
      percent: "Quota di maiuscole (%)",
      minLetters: "Lettere minime",
    },
    links: {
      inviteTitle: "Blocca i link di invito",
      inviteDescription: "Gli inviti ai server Ciklet e Discord non possono essere condivisi.",
      blockedTitle: "Domini bloccati",
      blockedDescription: "I link verso questi domini (e sottodomini) vengono bloccati anche quando il filtro link è disattivato.",
    },
    profile: {
      title: "AutoMod — Filtro nome utente e profilo",
      description: "Nome visualizzato, nome utente, nickname nel server e bio devono superare l'elenco delle parole vietate e (se attivo) il filtro volgarità. Un membro che non li supera non può inviare messaggi finché non li corregge; nickname e bio del server di questo tipo non vengono salvati.",
    },
    actions: {
      warnTitle: "Riga di avviso nel canale",
      warnDescription: "Un breve avviso di AutoMod viene pubblicato nel canale del messaggio bloccato (il contenuto non viene mostrato).",
      blockMessageTitle: "Messaggio mostrato al mittente",
      blockMessageDescription: "Lascia vuoto per mostrare la spiegazione propria della regola.",
      blockMessagePlaceholder: "Questo messaggio viola le regole del server.",
    },
    exempt: {
      title: "AutoMod — Esenzioni",
      description: "I membri con il permesso Gestisci messaggi sono sempre esenti. Anche questi ruoli e canali (compresi i loro thread) non vengono controllati.",
      roles: "Ruoli esenti",
      channels: "Canali esenti",
      none: "Nessuna selezione",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "LIVE",
  settings: {
    hint: "Collega il tuo account per mostrare \"Live\" sul tuo profilo mentre sei in diretta",
    broadcaster: "Permessi da streamer",
    broadcasterHint: "Permette ai ruoli collegati di leggere i tuoi abbonati",
    grantBroadcaster: "Collega come streamer",
    connect: "Collega",
    reconnect: "Ricollega",
    disconnect: "Rimuovi",
    disconnected: "Collegamento a {platform} rimosso.",
    disconnectFailed: "Impossibile rimuovere il collegamento a {platform}.",
    liveNow: "In diretta ora",
  },
  linkedRoles: {
    title: "Ruoli collegati",
    description: "Collega un ruolo a un abbonamento al tuo canale Twitch o Kick. Quando i membri collegano il proprio account, il ruolo viene assegnato automaticamente se hanno i requisiti e rimosso quando l'abbonamento termina (la verifica si ripete ogni mezz'ora). Solo il proprietario del server può configurarlo, per il proprio canale.",
    ownerOnly: "Solo il proprietario del server può gestire i ruoli collegati.",
    role: "Ruolo",
    platform: "Piattaforma",
    requirement: "Requisito",
    subscriber: "Abbonato al mio canale",
    follower: "Segue il mio canale",
    followerTwitchOnly: "Il requisito follower è solo per Twitch (Kick non segnala chi smette di seguire).",
    add: "Collega",
    remove: "Rimuovi",
    empty: "Ancora nessun ruolo collegato.",
    loading: "Caricamento…",
    needsBroadcaster: "Prima collega il tuo account {platform} con \"Collega come streamer\" in Impostazioni → Profilo → Collegamenti.",
    created: "Ruolo collegato creato.",
    createFailed: "Impossibile creare il ruolo collegato.",
    removeFailed: "Impossibile rimuovere il ruolo collegato.",
    granted: "{count, plural, one {# membro} many {# membri} other {# membri}}",
    lastSynced: "Ultima verifica: {time}",
    selectRole: "Seleziona un ruolo",
  },

} satisfies Translation<typeof streamingTr>;
