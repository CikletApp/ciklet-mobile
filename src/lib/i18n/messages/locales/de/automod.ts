/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "Kein Timeout",
    s60: "60 Sekunden",
    m5: "5 Minuten",
    m10: "10 Minuten",
    h1: "1 Stunde",
    d1: "1 Tag",
    w1: "1 Woche",
  },
  settings: {
    words: {
      title: "AutoMod – Blockierte Wörter",
      description: "Trenne mit Kommas oder Zeilenumbrüchen; es werden ganze Wörter erkannt, ein * am Ende erkennt einen Wortanfang. Schreibtricks werden ebenfalls erkannt (wiederholte Buchstaben, Ziffern/Symbole, Trennzeichen). Passende Nachrichten können nicht gesendet werden (über das Gateway eingehende werden entfernt). Bis zu {max} Wörter.",
      placeholder: "wort1, wort2, anfang*",
      count: "{count, plural, one {# Wort} other {# Wörter}}",
    },
    mentions: {
      title: "AutoMod – Erwähnungsspam",
      description: "Blockiert eine Nachricht, die mehr als so viele verschiedene Personen oder Rollen markiert. Leer lassen zum Deaktivieren (max. {max}).",
      off: "Aus",
    },
    linkFilter: {
      title: "AutoMod – Linkfilter",
      description: "Wenn aktiviert, sind Links nur zu den unten stehenden Domains (und ihren Subdomains) erlaubt; Anhänge sind immer erlaubt. Bis zu {max} Domains.",
      emptyWarning: "Keine erlaubten Domains: Jeder Link wird blockiert.",
    },
    actionsSection: {
      title: "AutoMod – Aktionen",
      description: "Eine Nachricht, die gegen eine Regel verstößt, wird immer blockiert. Optional erhält der Autor ein Timeout und der Vorfall wird in deinem Moderationskanal und im Kanal der Nachricht gemeldet.",
      timeout: "Timeout",
      alertChannel: "Moderationskanal",
      noAlert: "Keine Meldungen",
    },
    preset: {
      title: "AutoMod – Türkischer Schimpfwortfilter",
      description: "Eine fertige, umfassende Liste türkischer Schimpfwörter und Beleidigungen. Sie erkennt auch Schreibtricks (wiederholte Buchstaben, 4→a, 1→ı, 0→o, $→s, Trennung mit Punkten oder Leerzeichen) und lässt harmlose Wörter wie „sıkıntı“, „amaç“ oder „piknik“ in Ruhe.",
      enable: "Mit einem Klick aktivieren",
      enabled: "An",
      allowTitle: "Erlaubte Wörter",
      allowDescription: "Wörter, die nie erfasst werden sollen (mit Kommas oder Zeilenumbrüchen trennen; * am Ende für einen Wortanfang). Gilt sowohl für die Vorlage als auch für die Liste blockierter Wörter.",
      allowPlaceholder: "amina, wort*",
    },
    spam: {
      title: "AutoMod – Spamerkennung",
      description: "Blockiert Nachrichten von Mitgliedern, die in kurzer Zeit viele Nachrichten senden oder denselben Inhalt wiederholen.",
      maxMessages: "Max. Nachrichten",
      window: "Zeitfenster (Sekunden)",
      duplicates: "Wiederholungen derselben Nachricht (60 s)",
    },
    caps: {
      title: "AutoMod – Übermäßige Großschreibung",
      description: "Blockiert Nachrichten, bei denen mehr als der angegebene Anteil der Buchstaben großgeschrieben ist (kurze Nachrichten ausgenommen).",
      percent: "Anteil Großbuchstaben (%)",
      minLetters: "Mindestanzahl Buchstaben",
    },
    links: {
      inviteTitle: "Einladungslinks blockieren",
      inviteDescription: "Server-Einladungen von Ciklet und Discord können nicht geteilt werden.",
      blockedTitle: "Blockierte Domains",
      blockedDescription: "Links zu diesen Domains (und Subdomains) werden blockiert, auch wenn der Linkfilter aus ist.",
    },
    profile: {
      title: "AutoMod – Filter für Benutzernamen und Profile",
      description: "Anzeigename, Benutzername, Server-Spitzname und Bio müssen die Liste blockierter Wörter und (falls aktiviert) den Schimpfwortfilter bestehen. Ein Mitglied, das durchfällt, kann keine Nachrichten senden, bis es das behebt; solche Spitznamen und Server-Bios werden nicht gespeichert.",
    },
    actions: {
      warnTitle: "Warnzeile im Kanal",
      warnDescription: "Im Kanal der blockierten Nachricht wird ein kurzer AutoMod-Hinweis gepostet (der Inhalt wird nicht angezeigt).",
      blockMessageTitle: "Nachricht an den Absender",
      blockMessageDescription: "Leer lassen, um die Erklärung der Regel selbst anzuzeigen.",
      blockMessagePlaceholder: "Diese Nachricht verstößt gegen die Serverregeln.",
    },
    exempt: {
      title: "AutoMod – Ausnahmen",
      description: "Mitglieder mit „Nachrichten verwalten“ sind immer ausgenommen. Diese Rollen und Kanäle (einschließlich ihrer Threads) werden ebenfalls nicht geprüft.",
      roles: "Ausgenommene Rollen",
      channels: "Ausgenommene Kanäle",
      none: "Nichts ausgewählt",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "LIVE",
  settings: {
    hint: "Verknüpfe dein Konto, um auf deinem Profil „Live“ anzuzeigen, während du streamst",
    broadcaster: "Streamer-Berechtigungen",
    broadcasterHint: "Erlaubt verknüpften Rollen, deine Abonnenten auszulesen",
    grantBroadcaster: "Als Streamer verknüpfen",
    connect: "Verknüpfen",
    reconnect: "Erneut verknüpfen",
    disconnect: "Entfernen",
    disconnected: "{platform}-Verknüpfung entfernt.",
    disconnectFailed: "{platform}-Verknüpfung konnte nicht entfernt werden.",
    liveNow: "Jetzt live",
  },
  linkedRoles: {
    title: "Verknüpfte Rollen",
    description: "Verbinde eine Rolle mit einem Abo deines Twitch- oder Kick-Kanals. Wenn Mitglieder ihr Konto verknüpfen, erhalten sie die Rolle automatisch, sofern sie die Bedingung erfüllen, und verlieren sie, wenn das Abo endet (alle halbe Stunde neu geprüft). Nur der Serverbesitzer kann das für seinen eigenen Kanal einrichten.",
    ownerOnly: "Nur der Serverbesitzer kann verknüpfte Rollen verwalten.",
    role: "Rolle",
    platform: "Plattform",
    requirement: "Bedingung",
    subscriber: "Hat meinen Kanal abonniert",
    follower: "Folgt meinem Kanal",
    followerTwitchOnly: "Die Follower-Bedingung gibt es nur bei Twitch (Kick meldet kein Entfolgen).",
    add: "Verknüpfen",
    remove: "Entfernen",
    empty: "Noch keine verknüpften Rollen.",
    loading: "Wird geladen …",
    needsBroadcaster: "Verknüpfe zuerst dein {platform}-Konto über „Als Streamer verknüpfen“ unter Einstellungen → Profil → Verknüpfungen.",
    created: "Verknüpfte Rolle erstellt.",
    createFailed: "Verknüpfte Rolle konnte nicht erstellt werden.",
    removeFailed: "Verknüpfte Rolle konnte nicht entfernt werden.",
    granted: "{count, plural, one {# Mitglied} other {# Mitglieder}}",
    lastSynced: "Zuletzt geprüft: {time}",
    selectRole: "Rolle auswählen",
  },

} satisfies Translation<typeof streamingTr>;
