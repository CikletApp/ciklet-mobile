import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "End-to-end versleuteld",
    connecting: "Versleuteling instellen…",
    mixed: "Onversleutelde deelnemer aanwezig",
    unsupported: "Onversleutelde verbinding",
  },
  title: "End-to-endversleuteling",
  body: {
    encrypted:
      "Je stem, video en schermdeling worden alleen ontsleuteld op de apparaten van de mensen in dit gesprek. Niemand anders, zelfs de servers van Ciklet niet, kan de inhoud zien.",
    connecting: "Versleutelingssleutels uitwisselen met de deelnemers.",
    mixed:
      "Sommige deelnemers gebruiken een versie zonder end-to-endversleuteling. Hun audio wordt onversleuteld verstuurd en ze kunnen versleutelde deelnemers niet horen.",
    unsupported:
      "Dit apparaat of deze browser ondersteunt geen end-to-endversleuteling: je audio wordt onversleuteld verstuurd en je kunt versleutelde deelnemers niet horen. Werk Ciklet bij of gebruik een recente versie van Chrome, Edge, Firefox of Safari.",
  },
  code: {
    title: "Privacycode voor spraak",
    help: "Vergelijk deze code met de andere deelnemers (lees hem bijvoorbeeld hardop voor). Als iedereen dezelfde code ziet, is het gesprek end-to-end versleuteld en luistert niemand tussendoor mee. De code verandert als iemand binnenkomt of vertrekt.",
    copy: "Code kopiëren",
    copied: "Code gekopieerd",
    waiting: "De code verschijnt zodra de sleutels klaar zijn.",
  },
  unencrypted: {
    title: "Onversleutelde deelnemers",
    badge: "Onversleutelde deelnemer",
  },
  pending: "Wacht op versleuteling",
} satisfies Translation<typeof voiceE2eeTr>;
