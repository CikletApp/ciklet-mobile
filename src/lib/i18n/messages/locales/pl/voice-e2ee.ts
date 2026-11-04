import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "Szyfrowanie end-to-end",
    connecting: "Konfigurowanie szyfrowania…",
    mixed: "Obecny jest niezaszyfrowany uczestnik",
    unsupported: "Połączenie niezaszyfrowane",
  },
  title: "Szyfrowanie end-to-end",
  body: {
    encrypted:
      "Twój głos, obraz i udostępniany ekran są odszyfrowywane wyłącznie na urządzeniach osób biorących udział w tej rozmowie. Nikt inny, nawet serwery Ciklet, nie widzi ich treści.",
    connecting: "Wymiana kluczy szyfrowania z uczestnikami.",
    mixed:
      "Niektórzy uczestnicy korzystają z wersji bez szyfrowania end-to-end. Ich dźwięk jest przesyłany bez szyfrowania i nie słyszą zaszyfrowanych uczestników.",
    unsupported:
      "To urządzenie lub przeglądarka nie obsługuje szyfrowania end-to-end: twój dźwięk jest przesyłany bez szyfrowania i nie słyszysz zaszyfrowanych uczestników. Zaktualizuj Ciklet lub użyj aktualnej wersji Chrome, Edge, Firefox albo Safari.",
  },
  code: {
    title: "Kod prywatności głosu",
    help: "Porównaj ten kod z innymi uczestnikami (np. przeczytajcie go na głos). Jeśli wszyscy widzą ten sam kod, rozmowa jest szyfrowana end-to-end i nikt nie podsłuchuje po drodze. Kod zmienia się, gdy ktoś dołącza lub wychodzi.",
    copy: "Kopiuj kod",
    copied: "Kod skopiowany",
    waiting: "Kod pojawi się, gdy klucze będą gotowe.",
  },
  unencrypted: {
    title: "Niezaszyfrowani uczestnicy",
    badge: "Niezaszyfrowany uczestnik",
  },
  pending: "Oczekiwanie na szyfrowanie",
} satisfies Translation<typeof voiceE2eeTr>;
