import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** pl — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Misje",
  subtitle: "Graj, rozmawiaj, odkrywaj — za ukończone misje zdobywasz Ciklet i nagrody.",
  balance: "Twoje saldo Ciklet",
  lifetime: "Łącznie zdobyto: {points}",
  unit: "Ciklet",
  disclaimer:
    "Punkty Ciklet to waluta używana wyłącznie w aplikacji: nie mają wartości w prawdziwych pieniądzach, nie można ich wymienić na liry tureckie (TL) ani żadną inną walutę, sprzedać ani przekazać nikomu innemu. Punkty Ciklet można wydawać tylko na przedmioty profilowe w Sklepie.",
  goStore: "Przejdź do Sklepu",
  loading: "Wczytywanie misji…",
  loadError: "Nie udało się wczytać misji.",
  empty: "Obecnie nie ma otwartych misji. Nowe wkrótce pojawią się tutaj.",
  tabs: {
    open: "Otwarte misje",
    done: "Ukończone",
  },
  kind: {
    playGame: "Graj w {game} przez {minutes, plural, one {# minutę} few {# minuty} many {# minut} other {# minuty}}",
    voice: "Spędź {minutes, plural, one {# minutę} few {# minuty} many {# minut} other {# minuty}} na kanale głosowym",
    activity: "Spędź {minutes, plural, one {# minutę} few {# minuty} many {# minut} other {# minuty}} w aktywności {app}",
    activityAny: "Spędź {minutes, plural, one {# minutę} few {# minuty} many {# minut} other {# minuty}} w aplikacji aktywności",
    createServer: "Utwórz swój pierwszy serwer",
    inviteFriend: "Sprowadź na swój serwer {count, plural, one {# osobę} few {# osoby} many {# osób} other {# osoby}} za pomocą linku z zaproszeniem",
    streakDay: "{count, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} z rzędu: {source} przez {minutes} min każdego dnia",
    streakWeek: "{count, plural, one {# tydzień} few {# tygodnie} many {# tygodni} other {# tygodnia}} z rzędu: {source} przez {minutes} min każdego tygodnia",
  },
  source: {
    voice: "spędzaj czas na kanale głosowym",
    game: "graj w {game}",
    activity: "korzystaj z aplikacji aktywności",
  },
  progress: {
    minutes: "{value} / {target} min",
    count: "{value} / {target}",
    days: "{value} / {target} dni",
    weeks: "{value} / {target} tyg.",
  },
  action: {
    enroll: "Przyjmij misję",
    claim: "Odbierz nagrodę",
    claimed: "Odebrano",
    inProgress: "W toku",
    expired: "Wygasła",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days, plural, one {# dzień} few {# dni} many {# dni} other {# dnia}} Mentol {plan}",
    item: "{name}",
  },
  sponsor: "Przedstawia: {name}",
  endsAt: "Koniec: {date}",
  noEnd: "Bez daty końcowej",
  claimUntil: "Odbierz do {date}",
  toast: {
    enrolled: "Misja przyjęta — postęp jest liczony od teraz.",
    claimed: "Nagroda odebrana!",
    alreadyClaimed: "Ta nagroda została już przez ciebie odebrana.",
    itemOwned: "Masz już przedmiot z nagrody; dodano Ciklet i pozostałe nagrody.",
    failed: "Coś poszło nie tak.",
  },
  how: {
    title: "Jak liczony jest postęp?",
    enroll: "Postęp jest liczony od chwili przyjęcia misji, nigdy wcześniej.",
    game: "Czas gry pochodzi z historii aktywności zgłaszanej przez aplikację desktopową.",
    voice: "Czas na kanale głosowym liczy się tylko wtedy, gdy na kanale są co najmniej dwie osoby.",
    once: "Nagrodę za każdą misję można odebrać raz na konto.",
  },
  store: {
    buyWithPoints: "Zdobądź za {points} Ciklet",
    notEnough: "Potrzeba {points} Ciklet",
    bought: "Zdobyto {name} za Ciklet",
    earn: "Zdobywaj Ciklet w misjach",
  },
} satisfies Translation<typeof questsTr>;
