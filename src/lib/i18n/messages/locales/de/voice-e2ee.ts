import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "Ende-zu-Ende-verschlüsselt",
    connecting: "Verschlüsselung wird eingerichtet …",
    mixed: "Unverschlüsselter Teilnehmer anwesend",
    unsupported: "Unverschlüsselte Verbindung",
  },
  title: "Ende-zu-Ende-Verschlüsselung",
  body: {
    encrypted:
      "Deine Stimme, dein Video und deine Bildschirmübertragung werden nur auf den Geräten der Personen in diesem Anruf entschlüsselt. Niemand sonst, nicht einmal die Server von Ciklet, kann den Inhalt sehen.",
    connecting: "Verschlüsselungsschlüssel werden mit den Teilnehmern ausgetauscht.",
    mixed:
      "Einige Teilnehmer nutzen eine Version ohne Ende-zu-Ende-Verschlüsselung. Ihr Ton wird unverschlüsselt gesendet und sie können verschlüsselte Teilnehmer nicht hören.",
    unsupported:
      "Dieses Gerät oder dieser Browser unterstützt keine Ende-zu-Ende-Verschlüsselung: Dein Ton wird unverschlüsselt gesendet und du kannst verschlüsselte Teilnehmer nicht hören. Aktualisiere Ciklet oder nutze ein aktuelles Chrome, Edge, Firefox oder Safari.",
  },
  code: {
    title: "Sprach-Privatsphärecode",
    help: "Vergleiche diesen Code mit den anderen Teilnehmern (lies ihn zum Beispiel laut vor). Wenn alle denselben Code sehen, ist der Anruf Ende-zu-Ende-verschlüsselt und niemand hört dazwischen mit. Der Code ändert sich, wenn jemand beitritt oder geht.",
    copy: "Code kopieren",
    copied: "Code kopiert",
    waiting: "Der Code erscheint, sobald die Schlüssel bereit sind.",
  },
  unencrypted: {
    title: "Unverschlüsselte Teilnehmer",
    badge: "Unverschlüsselter Teilnehmer",
  },
  pending: "Warte auf Verschlüsselung",
} satisfies Translation<typeof voiceE2eeTr>;
