import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** nl — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Missies",
  subtitle: "Speel, chat, ontdek — met voltooide missies verdien je Ciklet en beloningen.",
  balance: "Je Ciklet-saldo",
  lifetime: "Totaal verdiend: {points}",
  unit: "Ciklet",
  disclaimer:
    "Ciklet-punten zijn een virtuele munteenheid die alleen in de app wordt gebruikt: ze hebben geen waarde in echt geld, kunnen niet worden omgezet in Turkse lira (TL) of een andere munteenheid, kunnen niet worden verkocht en kunnen niet aan iemand anders worden overgedragen. Ciklet-punten kunnen alleen worden uitgegeven aan profielitems in de Winkel.",
  goStore: "Naar de Winkel",
  loading: "Missies laden…",
  loadError: "Kon de missies niet laden.",
  empty: "Er zijn op dit moment geen missies open. Binnenkort verschijnen hier nieuwe.",
  tabs: {
    open: "Open missies",
    done: "Voltooid",
  },
  kind: {
    playGame: "Speel {minutes} minuten {game}",
    voice: "Breng {minutes} minuten door in een spraakkanaal",
    activity: "Breng {minutes} minuten door in de activiteit {app}",
    activityAny: "Breng {minutes} minuten door in een activiteitenapp",
    createServer: "Maak je eerste server",
    inviteFriend: "{count, plural, one {Breng # persoon naar je server met je uitnodigingslink} other {Breng # personen naar je server met je uitnodigingslink}}",
    streakDay: "{count, plural, one {# dag op rij} other {# dagen op rij}}: elke dag {minutes} minuten {source}",
    streakWeek: "{count, plural, one {# week op rij} other {# weken op rij}}: elke week {minutes} minuten {source}",
  },
  source: {
    voice: "in spraak rondhangen",
    game: "{game} spelen",
    activity: "een activiteitenapp gebruiken",
  },
  progress: {
    minutes: "{value} / {target} min",
    count: "{value} / {target}",
    days: "{value} / {target} dagen",
    weeks: "{value} / {target} weken",
  },
  action: {
    enroll: "Missie accepteren",
    claim: "Beloning ophalen",
    claimed: "Opgehaald",
    inProgress: "Bezig",
    expired: "Verlopen",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days, plural, one {# dag Mentol {plan}} other {# dagen Mentol {plan}}}",
    item: "{name}",
  },
  sponsor: "Aangeboden door {name}",
  endsAt: "Eindigt: {date}",
  noEnd: "Geen einddatum",
  claimUntil: "Ophalen vóór {date}",
  toast: {
    enrolled: "Missie geaccepteerd — de voortgang telt vanaf nu.",
    claimed: "Beloning opgehaald!",
    alreadyClaimed: "Je hebt deze beloning al opgehaald.",
    itemOwned: "Je had het beloningsitem al; Ciklet en andere beloningen zijn toegevoegd.",
    failed: "Er is iets misgegaan.",
  },
  how: {
    title: "Hoe wordt de voortgang geteld?",
    enroll: "De voortgang telt vanaf het moment dat je een missie accepteert, nooit eerder.",
    game: "Speeltijd komt uit de activiteitengeschiedenis die de desktopapp doorgeeft.",
    voice: "Spraaktijd telt alleen zolang er minstens twee mensen in het kanaal zijn.",
    once: "De beloning van elke missie kan één keer per account worden opgehaald.",
  },
  store: {
    buyWithPoints: "Nemen voor {points} Ciklet",
    notEnough: "Vereist {points} Ciklet",
    bought: "{name} genomen met Ciklet",
    earn: "Verdien Ciklet met missies",
  },
} satisfies Translation<typeof questsTr>;
