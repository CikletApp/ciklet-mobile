import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** it — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Missioni",
  subtitle: "Gioca, chatta, esplora: le missioni completate ti fanno guadagnare Ciklet e ricompense.",
  balance: "Il tuo saldo Ciklet",
  lifetime: "Totale guadagnato: {points}",
  unit: "Ciklet",
  disclaimer:
    "I punti Ciklet sono una valuta interna utilizzabile solo all'interno dell'app: non hanno valore in denaro reale, non possono essere convertiti in lire turche (TL) né in altre valute, non possono essere venduti né trasferiti ad altri. I punti Ciklet possono essere spesi solo per oggetti del profilo nel Negozio.",
  goStore: "Vai al Negozio",
  loading: "Caricamento delle missioni…",
  loadError: "Impossibile caricare le missioni.",
  empty: "Al momento non ci sono missioni disponibili. Le nuove appariranno presto qui.",
  tabs: {
    open: "Missioni aperte",
    done: "Completate",
  },
  kind: {
    playGame: "Gioca a {game} per {minutes} minuti",
    voice: "Trascorri {minutes} minuti in un canale vocale",
    activity: "Trascorri {minutes} minuti nell'attività {app}",
    activityAny: "Trascorri {minutes} minuti in un'app di attività",
    createServer: "Crea il tuo primo server",
    inviteFriend: "{count, plural, one {Porta # persona nel tuo server con il tuo link di invito} many {Porta # persone nel tuo server con il tuo link di invito} other {Porta # persone nel tuo server con il tuo link di invito}}",
    streakDay: "{count, plural, one {# giorno di fila} many {# giorni di fila} other {# giorni di fila}}: {source} per {minutes} minuti ogni giorno",
    streakWeek: "{count, plural, one {# settimana di fila} many {# settimane di fila} other {# settimane di fila}}: {source} per {minutes} minuti ogni settimana",
  },
  source: {
    voice: "passa del tempo in vocale",
    game: "gioca a {game}",
    activity: "usa un'app di attività",
  },
  progress: {
    minutes: "{value} / {target} min",
    count: "{value} / {target}",
    days: "{value} / {target} giorni",
    weeks: "{value} / {target} settimane",
  },
  action: {
    enroll: "Accetta missione",
    claim: "Riscatta ricompensa",
    claimed: "Riscattata",
    inProgress: "In corso",
    expired: "Scaduta",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days, plural, one {# giorno di Mentol {plan}} many {# giorni di Mentol {plan}} other {# giorni di Mentol {plan}}}",
    item: "{name}",
  },
  sponsor: "Offerta da {name}",
  endsAt: "Termina: {date}",
  noEnd: "Nessuna data di fine",
  claimUntil: "Riscatta entro il {date}",
  toast: {
    enrolled: "Missione accettata: il progresso inizia a contare da ora.",
    claimed: "Ricompensa riscattata!",
    alreadyClaimed: "Hai già riscattato questa ricompensa.",
    itemOwned: "Possedevi già l'oggetto della ricompensa; i Ciklet e le altre ricompense sono stati aggiunti.",
    failed: "Qualcosa è andato storto.",
  },
  how: {
    title: "Come viene calcolato il progresso?",
    enroll: "Il progresso conta dal momento in cui accetti una missione, mai prima.",
    game: "Il tempo di gioco deriva dalla cronologia delle attività riportata dall'app desktop.",
    voice: "Il tempo in vocale conta solo quando nel canale ci sono almeno due persone.",
    once: "La ricompensa di ogni missione può essere riscattata una sola volta per account.",
  },
  store: {
    buyWithPoints: "Ottieni per {points} Ciklet",
    notEnough: "Servono {points} Ciklet",
    bought: "Hai ottenuto {name} con i Ciklet",
    earn: "Guadagna Ciklet con le missioni",
  },
} satisfies Translation<typeof questsTr>;
