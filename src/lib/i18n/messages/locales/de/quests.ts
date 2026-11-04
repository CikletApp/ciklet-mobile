import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** de — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Quests",
  subtitle: "Spielen, chatten, entdecken – mit abgeschlossenen Quests verdienst du Ciklet und Belohnungen.",
  balance: "Dein Ciklet-Guthaben",
  lifetime: "Insgesamt verdient: {points}",
  unit: "Ciklet",
  disclaimer:
    "Ciklet-Punkte sind eine In-App-Währung, die nur innerhalb der App verwendet wird: Sie haben keinen Echtgeldwert, können nicht in türkische Lira (TL) oder eine andere Währung umgetauscht, nicht verkauft und nicht an andere übertragen werden. Ciklet-Punkte können nur für Profilartikel im Shop ausgegeben werden.",
  goStore: "Zum Shop",
  loading: "Quests werden geladen …",
  loadError: "Quests konnten nicht geladen werden.",
  empty: "Gerade sind keine Quests offen. Neue erscheinen bald hier.",
  tabs: {
    open: "Offene Quests",
    done: "Abgeschlossen",
  },
  kind: {
    playGame: "Spiele {game} {minutes} Minuten lang",
    voice: "Verbringe {minutes} Minuten in einem Sprachkanal",
    activity: "Verbringe {minutes} Minuten in der Aktivität {app}",
    activityAny: "Verbringe {minutes} Minuten in einer Aktivitäts-App",
    createServer: "Erstelle deinen ersten Server",
    inviteFriend: "Hol mit deinem Einladungslink {count, plural, one {# Person} other {# Personen}} auf deinen Server",
    streakDay: "{count, plural, one {# Tag} other {# Tage}} in Folge: jeden Tag {minutes} Minuten {source}",
    streakWeek: "{count, plural, one {# Woche} other {# Wochen}} in Folge: jede Woche {minutes} Minuten {source}",
  },
  source: {
    voice: "im Sprachkanal abhängen",
    game: "{game} spielen",
    activity: "eine Aktivitäts-App nutzen",
  },
  progress: {
    minutes: "{value} / {target} Min.",
    count: "{value} / {target}",
    days: "{value} / {target} Tage",
    weeks: "{value} / {target} Wochen",
  },
  action: {
    enroll: "Quest annehmen",
    claim: "Belohnung abholen",
    claimed: "Abgeholt",
    inProgress: "Läuft",
    expired: "Abgelaufen",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days, plural, one {# Tag} other {# Tage}} Mentol {plan}",
    item: "{name}",
  },
  sponsor: "Präsentiert von {name}",
  endsAt: "Endet: {date}",
  noEnd: "Kein Enddatum",
  claimUntil: "Abholen bis {date}",
  toast: {
    enrolled: "Quest angenommen – der Fortschritt wird ab jetzt gezählt.",
    claimed: "Belohnung abgeholt!",
    alreadyClaimed: "Du hast diese Belohnung bereits abgeholt.",
    itemOwned: "Du besitzt den Belohnungsartikel bereits; Ciklet und andere Belohnungen wurden hinzugefügt.",
    failed: "Etwas ist schiefgelaufen.",
  },
  how: {
    title: "Wie wird der Fortschritt gezählt?",
    enroll: "Der Fortschritt zählt ab dem Moment, in dem du eine Quest annimmst, nie vorher.",
    game: "Die Spielzeit stammt aus dem Aktivitätsverlauf, den die Desktop-App meldet.",
    voice: "Sprachzeit zählt nur, solange mindestens zwei Personen im Kanal sind.",
    once: "Die Belohnung jeder Quest kann pro Konto einmal abgeholt werden.",
  },
  store: {
    buyWithPoints: "Für {points} Ciklet holen",
    notEnough: "Benötigt {points} Ciklet",
    bought: "{name} mit Ciklet geholt",
    earn: "Verdiene Ciklet mit Quests",
  },
} satisfies Translation<typeof questsTr>;
