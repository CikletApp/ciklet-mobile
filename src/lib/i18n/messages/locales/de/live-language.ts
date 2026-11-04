import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "Übersetzen",
    translating: "Wird übersetzt …",
    unsupported: "Übersetzung wird in diesem Browser nicht unterstützt",
    unsupportedDevice: "Übersetzung wird auf diesem Gerät nicht unterstützt",
    remove: "Übersetzung entfernen",
  },
  footer: {
    translatedFrom: "Übersetzt aus {language}",
    showOriginal: "Original anzeigen",
    showTranslation: "Übersetzung anzeigen",
    dismiss: "Übersetzung schließen",
    translating: "Wird übersetzt …",
    downloading: "Sprachmodell wird auf dein Gerät geladen … {percent} %",
  },
  errors: {
    same: "Diese Nachricht ist bereits auf {language}.",
    unavailable: "Für dieses Sprachpaar ist keine Übersetzung auf dem Gerät verfügbar.",
    undetected: "Die Sprache der Nachricht konnte nicht erkannt werden.",
    empty: "Es gibt keinen Text zum Übersetzen.",
    failed: "Übersetzung fehlgeschlagen.",
  },
  settings: {
    title: "Zielsprache für Übersetzungen",
    description: "„Übersetzen“ übersetzt Nachrichten in diese Sprache. Die Übersetzung erfolgt auf deinem Gerät; Nachrichteninhalte werden nie an Ciklet-Server gesendet.",
    auto: "Sprache der Benutzeroberfläche ({language})",
    unsupported: "Dieser Browser unterstützt keine Übersetzung auf dem Gerät; nutze eine aktuelle Version von Chrome oder Edge.",
    unsupportedDevice: "Dieses Gerät unterstützt keine Übersetzung auf dem Gerät.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "Untertitel",
  title: "Live-Untertitel",
  publish: {
    label: "Meine Sprache untertiteln",
    description: "Deine Sprache wird auf deinem Gerät transkribiert und nur an Personen in diesem Anruf gesendet. Es wird kein Ton aufgezeichnet.",
  },
  show: {
    label: "Untertitel anzeigen",
    description: "Die Sprache von Teilnehmern, die Untertitel aktiviert haben, erscheint unten auf dem Bildschirm.",
  },
  language: "Gesprochene Sprache",
  languageAuto: "Sprache der Benutzeroberfläche",
  indicator: "Untertitel an",
  indicatorHelp: "Diese Person überträgt ihre Sprache als Untertitel.",
  status: {
    listening: "Hört zu …",
    muted: "Dein Mikrofon ist aus – Untertitel pausiert.",
    unsupported: "Spracherkennung wird auf diesem Gerät nicht unterstützt.",
    denied: "Die Berechtigung für Mikrofon oder Spracherkennung wurde nicht erteilt.",
    e2eeBlocked: "Dieses Gerät kann Untertitel in einem Ende-zu-Ende-verschlüsselten Anruf nicht verschlüsseln; die Untertitelübertragung ist aus.",
    e2ee: "Untertitel werden Ende-zu-Ende-verschlüsselt gesendet.",
    cloud: "Dein Browser verwendet möglicherweise einen eigenen Sprachdienst zur Erkennung; Audio wird nie an Ciklet-Server gesendet.",
    onDevice: "Die Spracherkennung läuft auf deinem Gerät.",
    error: "Spracherkennung wurde beendet.",
  },
  empty: "Noch keine Untertitel.",
} satisfies Translation<typeof liveCaptionsTr>;
