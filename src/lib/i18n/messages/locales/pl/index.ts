import { automod, streaming } from "./automod";
import { safety } from "./safety";
import { voiceE2ee } from "./voice-e2ee";
import { serverGuide } from "./server-guide";
import { serverTag } from "./server-tag";
import { serverBoost } from "./server-boost";
import { accountSwitcher } from "./account-switcher";
import { familyCenter } from "./family-center";
import { gameStats } from "./game-stats";
import { gameDetail } from "./game-detail";
import { compliance } from "./compliance";
import { quests } from "./quests";
import { settingsAccount } from "./settings-account";
import { settingsGeneral } from "./settings-general";
import { settingsMedia } from "./settings-media";
import { liveCaptions, translation } from "./live-language";
import { moreScreens } from "./more-screens";
import { parityScreens } from "./parity-screens";
import type { Messages } from "../../tr";
import type { Translation } from "../../translation";

/** pl sözlüğü — şekil tr.ts'ten; eksik anahtar İngilizceye düşer. */
export const messages = {
  common: {
    cancel: "Anuluj",
    save: "Zapisz",
    close: "Zamknij",
    system: "Systemowy",
    on: "Wł.",
    off: "Wył.",
  },
  tabs: {
    chats: "Czaty",
    servers: "Serwery",
    notifications: "Powiadomienia",
    me: "Ty",
    unread: "{label}, {count, plural, one {# nieprzeczytana} few {# nieprzeczytane} many {# nieprzeczytanych} other {# nieprzeczytanej}}",
  },
  messagePreview: {
    voice: "🎤 Wiadomość głosowa",
    voiceWithDuration: "🎤 Wiadomość głosowa ({duration})",
    activity: "🎮 Aktywność: {name}",
    activityUnnamed: "🎮 Zaproszenie do aktywności",
    image: "📷 Zdjęcie",
    video: "🎥 Wideo",
    gif: "GIF",
    sticker: "Naklejka",
    clip: "🎬 Klip",
    file: "📎 {name}",
    attachment: "📎 Załącznik",
  },
  activity: {
    broadcast: {
      live: "Na żywo",
      game: "Streamuje {game}",
      liveOn: "Na żywo na {platform}",
      title: "Transmisja na żywo",
      watch: "Oglądaj transmisję",
    },
  },
  appCommands: {
    commands: "Polecenia",
    apps: "Aplikacje",
    optional: "Opcjonalne",
    required: "Wymagane",
    true: "Prawda",
    false: "Fałsz",
    chooseFile: "Wybierz plik",
    loading: "Wczytywanie…",
    noSuggestions: "Brak sugestii",
    timedOut: "Aplikacja nie odpowiedziała na czas",
    selectUser: "Wybierz użytkownika",
    selectRole: "Wybierz rolę",
    selectChannel: "Wybierz kanał",
    selectMentionable: "Wybierz użytkownika lub rolę",
    enterValue: "Wpisz wartość",
    enterNumber: "Wpisz liczbę",
    runFailed: "Nie udało się wykonać polecenia.",
  },
  messageComponents: {
    choose: "Dokonaj wyboru",
    chooseOption: "Wybierz opcję",
    search: "Szukaj",
    noResults: "Brak wyników",
    loading: "Wczytywanie…",
    confirm: "Wybierz",
    clear: "Wyczyść",
    selectedCount: "Wybrano: {count}",
    selectRange: "{min}–{max} wyborów",
    unknown: "Nieznany",
    botNoResponse: "{name} nie odpowiedział.",
    interactionFailed: "Nie udało się rozpocząć interakcji.",
    formNoResponse: "Bot nie odpowiedział na formularz.",
    formFailed: "Nie udało się wysłać formularza.",
    formLabel: "Formularz bota",
    submit: "Wyślij",
    cancel: "Anuluj",
    requiredMark: "Wymagane",
    uploadFile: "Prześlij plik",
    uploading: "Przesyłanie…",
    uploadFailed: "Nie udało się przesłać pliku.",
    removeFile: "Usuń",
    fileLimit: "Maks. {max, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}",
    allowedTypes: "Dozwolone: {types}",
    fileTypeRejected: "Ten typ pliku nie jest akceptowany.",
    download: "Pobierz",
    spoiler: "Spoiler",
    show: "Pokaż",
    openImage: "Powiększ obraz",
    attachment: "Załącznik",
  },
  settings: {
    title: "Ustawienia",
    editProfile: "Edytuj swój profil",
    sections: {
      account: "ACCOUNT SETTINGS",
      app: "APP SETTINGS",
      support: "SUPPORT",
      session: "SESSION",
    },
    rows: {
      account: "Konto",
      mentol: "Mentol",
      privacy: "Prywatność, dane i kontakty",
      friendRequests: "Zaproszenia do znajomych",
      authorizedApps: "Autoryzowane aplikacje",
      voice: "Głos i wideo",
      appearance: "Wygląd",
      chat: "Czat",
      notifications: "Powiadomienia",
      activity: "Status aktywności",
      help: "Help",
      helpSubtitle: "Wsparcie, opinie, warunki",
      scanLogin: "Zeskanuj kod",
      scanLoginSubtitle: "Zaloguj się na komputerze za pomocą telefonu",
    },
    scanLogin: {
      title: "Zeskanuj kod",
      hint: "Nakieruj aparat na obracający się pierścień na ekranie logowania na komputerze.",
      permissionTitle: "Potrzebny dostęp do aparatu",
      permissionBody: "Potrzebujemy aparatu, aby odczytać kod z twojego komputera.",
      permissionAction: "Zezwól",
      openSettings: "Otwórz ustawienia",
      searching: "Szukanie kodu…",
      checking: "Sprawdzanie kodu…",
      gone: "Ten kod wygasł. Poczekaj, aż komputer go odświeży, i zeskanuj ponownie.",
      confirmTitle: "Zalogować się na komputerze?",
      confirmBody: "Jeśli to nie ty rozpocząłeś(-ęłaś) logowanie, odrzuć je. Nigdy nie udostępniaj kodu.",
      device: "Urządzenie",
      location: "Lokalizacja",
      ip: "Adres IP",
      time: "Time",
      justNow: "Just now",
      approve: "Tak, zaloguj",
      reject: "Nie, to nie ja",
      approved: "Zatwierdzono. Logowanie na komputerze.",
      rejected: "Odrzucono. Kod na komputerze zostanie odświeżony.",
      failed: "Nie udało się wysłać zatwierdzenia. Spróbuj ponownie.",
      unknownLocation: "Nieznany",
    },
    logout: {
      action: "Wyloguj się",
      title: "Wyloguj się",
      message: "Zostaniesz wylogowany(-a) na tym urządzeniu.",
    },
    memberSince: "W Ciklet od {date}",
    appearance: {
      title: "Wygląd",
      motion: {
        title: "REDUCE MOTION",
        description:
          "Ogranicza przejścia, wysuwane panele i pulsujące animacje. Opcja Systemowy korzysta z ustawień dostępności telefonu.",
      },
      language: {
        title: "LANGUAGE",
        description: "Język interfejsu. Tłumaczenie wciąż trwa; nieprzetłumaczone teksty są wyświetlane po angielsku lub turecku.",
        system: "Język urządzenia ({name})",
        restartRtl: "Zamknij i ponownie otwórz aplikację, aby zastosować nowy kierunek tekstu.",
      },
    },
    voice: {
      title: "Głos i wideo",
      inputMode: "INPUT MODE",
      vad: "Aktywacja głosem",
      ptt: "Naciśnij, aby mówić",
      pttHint:
        "Gdy opcja Naciśnij, aby mówić jest włączona, mikrofon na kanałach głosowych jest początkowo wyciszony; przytrzymaj przycisk na ekranie, aby mówić.",
      noise: "NOISE SUPPRESSION",
      noiseOff: "Wył.",
      noiseStandard: "Standardowa",
      noiseOffHint: "Twój głos jest wysyłany bez obróbki (instrumenty, mikrofony studyjne).",
      noiseStandardHint: "Wbudowana redukcja szumów urządzenia.",
      noiseAdvancedNote: "Zaawansowana redukcja szumów (RNNoise) jest na razie dostępna tylko w przeglądarce i aplikacji desktopowej.",
      inputVolume: "INPUT VOLUME",
      outputVolume: "OUTPUT VOLUME",
      deviceNote:
        "Telefon zarządza urządzeniami wejściowymi i wyjściowymi automatycznie. Urządzenia Bluetooth lub przewodowe wybierzesz w systemowym panelu dźwięku.",
    },
    notifications: {
      title: "Powiadomienia",
      permission: "NOTIFICATION PERMISSION",
      master: "Powiadomienia Ciklet",
      masterDescription: "Zezwól na powiadomienia na tym urządzeniu.",
      permissionDenied: "Powiadomienia są wyłączone w ustawieniach systemu.",
      types: "NOTIFICATION TYPES",
      messages: "Wiadomości i wzmianki",
      calls: "Połączenia przychodzące",
      friends: "Zaproszenia do znajomych",
      sounds: "Dźwięki powiadomień",
      lockScreen: "CALLS ON LOCK SCREEN",
      fullScreenOff: "Uprawnienie do połączeń na pełnym ekranie jest wyłączone",
      fullScreenBody:
        "Android wymaga osobnego uprawnienia, aby dzwonić na pełnym ekranie na ekranie blokady, gdy aplikacja jest zamknięta. Bez niego połączenia są wyświetlane tylko jako powiadomienie.",
      openSettings: "Otwórz ustawienia",
      overrides: "SERVER, CHANNEL AND CHAT OVERRIDES",
      overridesEmpty:
        "Brak własnych ustawień. Przytrzymaj serwer, kanał lub czat i wybierz Powiadomienia, aby je dodać.",
      reset: "Przywróć domyślne",
    },
  },
  automod: automod,
  safety: safety,
  voiceE2ee: voiceE2ee,
  streaming: streaming,
  serverGuide: serverGuide,
  serverTag: serverTag,
  serverBoost: serverBoost,
  /** Hesap değiştirici (web ile aynı anahtarlar) — account-switcher.en.ts. */
  accountSwitcher: accountSwitcher,
  /** Aile Merkezi (web ile aynı anahtarlar) — family-center.en.ts. */
  familyCenter: familyCenter,
  gameStats: gameStats,
  gameDetail: gameDetail,
  compliance: compliance,
  quests: quests,
  settingsAccount: settingsAccount,
  settingsGeneral: settingsGeneral,
  settingsMedia: settingsMedia,
  translation: translation,
  liveCaptions: liveCaptions,
  moreScreens: moreScreens,
  parityScreens: parityScreens,
} satisfies Translation<Messages>;
