import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "Vertalen",
    translating: "Bezig met vertalen…",
    unsupported: "Vertalen wordt niet ondersteund in deze browser",
    unsupportedDevice: "Vertalen wordt niet ondersteund op dit apparaat",
    remove: "Vertaling verwijderen",
  },
  footer: {
    translatedFrom: "Vertaald uit het {language}",
    showOriginal: "Origineel tonen",
    showTranslation: "Vertaling tonen",
    dismiss: "Vertaling sluiten",
    translating: "Bezig met vertalen…",
    downloading: "Taalmodel wordt naar je apparaat gedownload… {percent}%",
  },
  errors: {
    same: "Dit bericht is al in het {language}.",
    unavailable: "Vertalen op het apparaat is niet beschikbaar voor deze taalcombinatie.",
    undetected: "Kon de taal van het bericht niet herkennen.",
    empty: "Er is geen tekst om te vertalen.",
    failed: "Kon niet vertalen.",
  },
  settings: {
    title: "Doeltaal voor vertalingen",
    description: "‘Vertalen’ vertaalt berichten naar deze taal. Het vertalen gebeurt op je apparaat; berichtinhoud wordt nooit naar Ciklet-servers verzonden.",
    auto: "Interfacetaal ({language})",
    unsupported: "Deze browser ondersteunt geen vertaling op het apparaat; gebruik een recente versie van Chrome of Edge.",
    unsupportedDevice: "Dit apparaat ondersteunt geen vertaling op het apparaat.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "Ondertiteling",
  title: "Live ondertiteling",
  publish: {
    label: "Mijn spraak ondertitelen",
    description: "Je spraak wordt op je apparaat omgezet in tekst en alleen naar mensen in dit gesprek verzonden. Er wordt geen audio opgenomen.",
  },
  show: {
    label: "Ondertiteling tonen",
    description: "Spraak van deelnemers die ondertiteling hebben ingeschakeld, verschijnt onderaan het scherm.",
  },
  language: "Gesproken taal",
  languageAuto: "Interfacetaal",
  indicator: "Ondertiteling aan",
  indicatorHelp: "Deze persoon zendt zijn of haar spraak uit als ondertiteling.",
  status: {
    listening: "Aan het luisteren…",
    muted: "Je microfoon staat uit — ondertiteling gepauzeerd.",
    unsupported: "Spraakherkenning wordt niet ondersteund op dit apparaat.",
    denied: "Toestemming voor microfoon of spraakherkenning is niet gegeven.",
    e2eeBlocked: "Dit apparaat kan ondertiteling niet versleutelen in een end-to-end versleuteld gesprek; ondertiteling uitzenden staat uit.",
    e2ee: "Ondertiteling wordt end-to-end versleuteld verzonden.",
    cloud: "Je browser gebruikt mogelijk een eigen spraakdienst om je spraak te herkennen; audio gaat nooit naar Ciklet-servers.",
    onDevice: "Spraakherkenning draait op je apparaat.",
    error: "Spraakherkenning is gestopt.",
  },
  empty: "Nog geen ondertiteling.",
} satisfies Translation<typeof liveCaptionsTr>;
