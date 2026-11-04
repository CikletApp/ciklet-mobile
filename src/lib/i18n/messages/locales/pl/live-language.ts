import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "Przetłumacz",
    translating: "Tłumaczenie…",
    unsupported: "Ta przeglądarka nie obsługuje tłumaczenia",
    unsupportedDevice: "To urządzenie nie obsługuje tłumaczenia",
    remove: "Usuń tłumaczenie",
  },
  footer: {
    translatedFrom: "Przetłumaczono z języka: {language}",
    showOriginal: "Pokaż oryginał",
    showTranslation: "Pokaż tłumaczenie",
    dismiss: "Zamknij tłumaczenie",
    translating: "Tłumaczenie…",
    downloading: "Pobieranie modelu językowego na twoje urządzenie… {percent}%",
  },
  errors: {
    same: "Ta wiadomość jest już w języku: {language}.",
    unavailable: "Tłumaczenie na urządzeniu nie jest dostępne dla tej pary języków.",
    undetected: "Nie udało się wykryć języka wiadomości.",
    empty: "Nie ma tekstu do przetłumaczenia.",
    failed: "Nie udało się przetłumaczyć.",
  },
  settings: {
    title: "Język docelowy tłumaczenia",
    description: "„Przetłumacz” tłumaczy wiadomości na ten język. Tłumaczenie odbywa się na twoim urządzeniu; treść wiadomości nigdy nie trafia na serwery Ciklet.",
    auto: "Język interfejsu ({language})",
    unsupported: "Ta przeglądarka nie obsługuje tłumaczenia na urządzeniu; użyj aktualnej wersji Chrome lub Edge.",
    unsupportedDevice: "To urządzenie nie obsługuje tłumaczenia na urządzeniu.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "Napisy",
  title: "Napisy na żywo",
  publish: {
    label: "Twórz napisy z mojej mowy",
    description: "Twoja mowa jest transkrybowana na twoim urządzeniu i wysyłana tylko do osób w tej rozmowie. Dźwięk nie jest nagrywany.",
  },
  show: {
    label: "Pokazuj napisy",
    description: "Mowa uczestników, którzy włączyli napisy, pojawia się na dole ekranu.",
  },
  language: "Język mowy",
  languageAuto: "Język interfejsu",
  indicator: "Napisy włączone",
  indicatorHelp: "Ta osoba udostępnia swoją mowę jako napisy.",
  status: {
    listening: "Słucham…",
    muted: "Twój mikrofon jest wyłączony — napisy wstrzymane.",
    unsupported: "To urządzenie nie obsługuje rozpoznawania mowy.",
    denied: "Nie przyznano uprawnień do mikrofonu lub rozpoznawania mowy.",
    e2eeBlocked: "To urządzenie nie może szyfrować napisów w rozmowie szyfrowanej end-to-end; przesyłanie napisów jest wyłączone.",
    e2ee: "Napisy są wysyłane z szyfrowaniem end-to-end.",
    cloud: "Twoja przeglądarka może korzystać z własnej usługi rozpoznawania mowy; dźwięk nigdy nie trafia na serwery Ciklet.",
    onDevice: "Rozpoznawanie mowy działa na twoim urządzeniu.",
    error: "Rozpoznawanie mowy zostało zatrzymane.",
  },
  empty: "Brak napisów.",
} satisfies Translation<typeof liveCaptionsTr>;
