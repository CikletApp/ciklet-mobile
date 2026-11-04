import type { liveCaptionsTr, translationTr } from "./live-language.tr";
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export const translationEn = {
  menu: {
    translate: "Translate",
    translating: "Translating…",
    unsupported: "Translation isn't supported in this browser",
    unsupportedDevice: "Translation isn't supported on this device",
    remove: "Remove translation",
  },
  footer: {
    translatedFrom: "Translated from {language}",
    showOriginal: "Show original",
    showTranslation: "Show translation",
    dismiss: "Close translation",
    translating: "Translating…",
    downloading: "Downloading language model to your device… {percent}%",
  },
  errors: {
    same: "This message is already in {language}.",
    unavailable: "On-device translation isn't available for this language pair.",
    undetected: "Couldn't detect the message's language.",
    empty: "There's no text to translate.",
    failed: "Couldn't translate.",
  },
  settings: {
    title: "Translation target language",
    description: "“Translate” translates messages into this language. Translation happens on your device; message content is never sent to Ciklet servers.",
    auto: "Interface language ({language})",
    unsupported: "This browser doesn't support on-device translation; use a recent version of Chrome or Edge.",
    unsupportedDevice: "This device doesn't support on-device translation.",
  },
} satisfies Widen<typeof translationTr>;

export const liveCaptionsEn = {
  button: "Captions",
  title: "Live captions",
  publish: {
    label: "Caption my speech",
    description: "Your speech is transcribed on your device and sent only to people in this call. No audio is recorded.",
  },
  show: {
    label: "Show captions",
    description: "Speech from participants who turned on captions appears at the bottom of the screen.",
  },
  language: "Speech language",
  languageAuto: "Interface language",
  indicator: "Captions on",
  indicatorHelp: "This person is broadcasting their speech as captions.",
  status: {
    listening: "Listening…",
    muted: "Your mic is off — captions paused.",
    unsupported: "Speech recognition isn't supported on this device.",
    denied: "Microphone or speech recognition permission wasn't granted.",
    e2eeBlocked: "This device can't encrypt captions in an end-to-end encrypted call; caption broadcasting is off.",
    e2ee: "Captions are sent end-to-end encrypted.",
    cloud: "Your browser may use its own speech service to recognize your speech; audio never goes to Ciklet servers.",
    onDevice: "Speech recognition runs on your device.",
    error: "Speech recognition stopped.",
  },
  empty: "No captions yet.",
} satisfies Widen<typeof liveCaptionsTr>;
