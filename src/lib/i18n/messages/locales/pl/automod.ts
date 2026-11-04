/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "Bez wyciszenia",
    s60: "60 sekund",
    m5: "5 minut",
    m10: "10 minut",
    h1: "1 godzina",
    d1: "1 dzień",
    w1: "1 tydzień",
  },
  settings: {
    words: {
      title: "AutoMod — Zablokowane słowa",
      description: "Oddzielaj przecinkami lub nowymi wierszami; dopasowywane są całe słowa, zakończ znakiem *, aby dopasować przedrostek. Wyłapywane są też sztuczki z pisownią (powtórzone litery, cyfry/symbole, separatory). Pasujących wiadomości nie można wysłać (jeśli przyjdą przez bramę, zostaną usunięte). Maksymalnie {max, plural, one {# słowo} few {# słowa} many {# słów} other {# słowa}}.",
      placeholder: "słowo1, słowo2, przedrostek*",
      count: "{count, plural, one {# słowo} few {# słowa} many {# słów} other {# słowa}}",
    },
    mentions: {
      title: "AutoMod — Spam wzmiankami",
      description: "Blokuje wiadomość oznaczającą więcej niż podana liczba różnych osób lub ról. Zostaw puste, aby wyłączyć (maks. {max}).",
      off: "Wył.",
    },
    linkFilter: {
      title: "AutoMod — Filtr linków",
      description: "Gdy jest włączony, dozwolone są tylko linki do poniższych domen (i ich subdomen); załączniki są zawsze dozwolone. Maksymalnie {max, plural, one {# domena} few {# domeny} many {# domen} other {# domeny}}.",
      emptyWarning: "Brak dozwolonych domen: każdy link jest blokowany.",
    },
    actionsSection: {
      title: "AutoMod — Działania",
      description: "Wiadomość łamiąca regułę jest zawsze blokowana. Opcjonalnie autor zostaje wyciszony, a zdarzenie trafia na kanał moderacji i na kanał wiadomości.",
      timeout: "Wyciszenie",
      alertChannel: "Kanał moderacji",
      noAlert: "Bez powiadomień",
    },
    preset: {
      title: "AutoMod — Turecki filtr wulgaryzmów",
      description: "Gotowa, obszerna lista tureckich wulgaryzmów i obelg. Wyłapuje też sztuczki z pisownią (powtórzone litery, 4→a, 1→ı, 0→o, $→s, rozdzielanie kropkami lub spacjami) i nie rusza niewinnych słów, takich jak „sıkıntı”, „amaç” czy „piknik”.",
      enable: "Włącz jednym kliknięciem",
      enabled: "Wł.",
      allowTitle: "Dozwolone słowa",
      allowDescription: "Słowa, które nigdy nie powinny być wyłapywane (oddzielaj przecinkami lub nowymi wierszami; zakończ znakiem * dla przedrostka). Dotyczy zarówno gotowej listy, jak i listy zablokowanych słów.",
      allowPlaceholder: "amina, słowo*",
    },
    spam: {
      title: "AutoMod — Wykrywanie spamu",
      description: "Blokuje wiadomości członków, którzy wysyłają wiele wiadomości w krótkim czasie lub powtarzają tę samą treść.",
      maxMessages: "Maks. liczba wiadomości",
      window: "Okno (sekundy)",
      duplicates: "Powtórzenia tej samej wiadomości (60 s)",
    },
    caps: {
      title: "AutoMod — Nadmiar wielkich liter",
      description: "Blokuje wiadomości, w których udział wielkich liter przekracza podaną wartość (z wyjątkiem krótkich wiadomości).",
      percent: "Udział wielkich liter (%)",
      minLetters: "Minimalna liczba liter",
    },
    links: {
      inviteTitle: "Blokuj linki z zaproszeniami",
      inviteDescription: "Nie można udostępniać zaproszeń na serwery Ciklet i Discord.",
      blockedTitle: "Zablokowane domeny",
      blockedDescription: "Linki do tych domen (i subdomen) są blokowane nawet wtedy, gdy filtr linków jest wyłączony.",
    },
    profile: {
      title: "AutoMod — Filtr nazw użytkowników i profili",
      description: "Nazwa wyświetlana, nazwa użytkownika, pseudonim na serwerze i opis muszą przejść przez listę zablokowanych słów i (jeśli jest włączony) filtr wulgaryzmów. Członek, który nie przejdzie, nie może wysyłać wiadomości, dopóki tego nie poprawi; takie pseudonimy i opisy serwerowe nie są zapisywane.",
    },
    actions: {
      warnTitle: "Ostrzeżenie na kanale",
      warnDescription: "Na kanale zablokowanej wiadomości pojawia się krótka informacja od AutoMod (treść nie jest pokazywana).",
      blockMessageTitle: "Wiadomość pokazywana nadawcy",
      blockMessageDescription: "Zostaw puste, aby pokazać wyjaśnienie samej reguły.",
      blockMessagePlaceholder: "Ta wiadomość łamie zasady serwera.",
    },
    exempt: {
      title: "AutoMod — Wyjątki",
      description: "Członkowie z uprawnieniem Zarządzanie wiadomościami są zawsze wyłączeni. Te role i kanały (łącznie z ich wątkami) również nie są sprawdzane.",
      roles: "Wyłączone role",
      channels: "Wyłączone kanały",
      none: "Nic nie wybrano",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "NA ŻYWO",
  settings: {
    hint: "Połącz konto, aby podczas transmisji w twoim profilu było widać „Na żywo”",
    broadcaster: "Uprawnienia nadawcy",
    broadcasterHint: "Pozwala połączonym rolom odczytywać twoich subskrybentów",
    grantBroadcaster: "Połącz jako nadawca",
    connect: "Połącz",
    reconnect: "Połącz ponownie",
    disconnect: "Usuń",
    disconnected: "Połączenie z {platform} usunięte.",
    disconnectFailed: "Nie udało się usunąć połączenia z {platform}.",
    liveNow: "Teraz na żywo",
  },
  linkedRoles: {
    title: "Połączone role",
    description: "Powiąż rolę z subskrypcją twojego kanału na Twitchu lub Kicku. Gdy członkowie połączą swoje konto, rola zostanie przyznana automatycznie, jeśli spełniają warunki, i odebrana, gdy subskrypcja się skończy (weryfikacja co pół godziny). Skonfigurować to może tylko właściciel serwera, dla własnego kanału.",
    ownerOnly: "Połączonymi rolami może zarządzać tylko właściciel serwera.",
    role: "Rola",
    platform: "Platforma",
    requirement: "Wymaganie",
    subscriber: "Subskrybuje mój kanał",
    follower: "Obserwuje mój kanał",
    followerTwitchOnly: "Wymaganie obserwowania działa tylko na Twitchu (Kick nie zgłasza przestania obserwowania).",
    add: "Połącz",
    remove: "Usuń",
    empty: "Brak połączonych ról.",
    loading: "Wczytywanie…",
    needsBroadcaster: "Najpierw połącz konto {platform} opcją „Połącz jako nadawca” w Ustawienia → Profil → Połączenia.",
    created: "Połączona rola utworzona.",
    createFailed: "Nie udało się utworzyć połączonej roli.",
    removeFailed: "Nie udało się usunąć połączonej roli.",
    granted: "{count, plural, one {# członek} few {# członków} many {# członków} other {# członka}}",
    lastSynced: "Ostatnia weryfikacja: {time}",
    selectRole: "Wybierz rolę",
  },

} satisfies Translation<typeof streamingTr>;
