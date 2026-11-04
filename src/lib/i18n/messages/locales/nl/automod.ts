/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "Geen time-out",
    s60: "60 seconden",
    m5: "5 minuten",
    m10: "10 minuten",
    h1: "1 uur",
    d1: "1 dag",
    w1: "1 week",
  },
  settings: {
    words: {
      title: "AutoMod — Geblokkeerde woorden",
      description: "Scheid met komma's of nieuwe regels; hele woorden worden gematcht, eindig met * om een voorvoegsel te matchen. Spellingtrucs worden ook herkend (herhaalde letters, cijfers/symbolen, scheidingstekens). Berichten die matchen kunnen niet worden verstuurd (ze worden verwijderd als ze via de gateway binnenkomen). Maximaal {max} woorden.",
      placeholder: "woord1, woord2, voorvoegsel*",
      count: "{count, plural, one {# woord} other {# woorden}}",
    },
    mentions: {
      title: "AutoMod — Vermeldingsspam",
      description: "Blokkeert een bericht dat meer dan dit aantal verschillende personen of rollen tagt. Laat leeg om uit te zetten (max. {max}).",
      off: "Uit",
    },
    linkFilter: {
      title: "AutoMod — Linkfilter",
      description: "Als dit aan staat, zijn links alleen toegestaan naar de onderstaande domeinen (en hun subdomeinen); bijlagen zijn altijd toegestaan. Maximaal {max} domeinen.",
      emptyWarning: "Geen toegestane domeinen: elke link wordt geblokkeerd.",
    },
    actionsSection: {
      title: "AutoMod — Acties",
      description: "Een bericht dat een regel overtreedt, wordt altijd geblokkeerd. Optioneel krijgt de afzender een time-out en wordt het voorval gemeld in je moderatiekanaal en in het kanaal van het bericht.",
      timeout: "Time-out",
      alertChannel: "Moderatiekanaal",
      noAlert: "Geen meldingen",
    },
    preset: {
      title: "AutoMod — Turks scheldwoordenfilter",
      description: "Een kant-en-klare, uitgebreide lijst met Turkse scheldwoorden en beledigingen. Herkent ook spellingtrucs (herhaalde letters, 4→a, 1→ı, 0→o, $→s, opsplitsen met punten of spaties) en laat onschuldige woorden zoals \"sıkıntı\", \"amaç\" of \"piknik\" met rust.",
      enable: "Met één klik inschakelen",
      enabled: "Aan",
      allowTitle: "Toegestane woorden",
      allowDescription: "Woorden die nooit tegengehouden mogen worden (scheid met komma's of nieuwe regels; eindig met * voor een voorvoegsel). Geldt voor zowel de kant-en-klare lijst als de lijst met geblokkeerde woorden.",
      allowPlaceholder: "amina, woord*",
    },
    spam: {
      title: "AutoMod — Spamdetectie",
      description: "Blokkeert berichten van leden die in korte tijd veel berichten versturen of dezelfde inhoud herhalen.",
      maxMessages: "Max. berichten",
      window: "Tijdvenster (seconden)",
      duplicates: "Herhalingen van hetzelfde bericht (60 s)",
    },
    caps: {
      title: "AutoMod — Te veel hoofdletters",
      description: "Blokkeert berichten waarin meer dan het opgegeven aandeel van de letters een hoofdletter is (korte berichten uitgezonderd).",
      percent: "Aandeel hoofdletters (%)",
      minLetters: "Minimumaantal letters",
    },
    links: {
      inviteTitle: "Uitnodigingslinks blokkeren",
      inviteDescription: "Serveruitnodigingen van Ciklet en Discord kunnen niet worden gedeeld.",
      blockedTitle: "Geblokkeerde domeinen",
      blockedDescription: "Links naar deze domeinen (en subdomeinen) worden geblokkeerd, ook als het linkfilter uit staat.",
    },
    profile: {
      title: "AutoMod — Gebruikersnaam- en profielfilter",
      description: "Weergavenaam, gebruikersnaam, serverbijnaam en bio moeten door de lijst met geblokkeerde woorden en (indien ingeschakeld) het scheldwoordenfilter komen. Een lid dat niet slaagt, kan geen berichten versturen tot het is aangepast; zulke bijnamen en serverbio's worden niet opgeslagen.",
    },
    actions: {
      warnTitle: "Waarschuwingsregel in kanaal",
      warnDescription: "Er wordt een korte AutoMod-melding geplaatst in het kanaal van het geblokkeerde bericht (de inhoud wordt niet getoond).",
      blockMessageTitle: "Bericht dat de afzender ziet",
      blockMessageDescription: "Laat leeg om de eigen uitleg van de regel te tonen.",
      blockMessagePlaceholder: "Dit bericht overtreedt de serverregels.",
    },
    exempt: {
      title: "AutoMod — Uitzonderingen",
      description: "Leden met Berichten beheren zijn altijd uitgezonderd. Deze rollen en kanalen (inclusief hun threads) worden ook niet gecontroleerd.",
      roles: "Uitgezonderde rollen",
      channels: "Uitgezonderde kanalen",
      none: "Niets geselecteerd",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "LIVE",
  settings: {
    hint: "Verbind je account om \"Live\" op je profiel te tonen terwijl je streamt",
    broadcaster: "Streamerrechten",
    broadcasterHint: "Laat gekoppelde rollen je abonnees uitlezen",
    grantBroadcaster: "Verbinden als streamer",
    connect: "Verbinden",
    reconnect: "Opnieuw verbinden",
    disconnect: "Verwijderen",
    disconnected: "Verbinding met {platform} verwijderd.",
    disconnectFailed: "Kon de verbinding met {platform} niet verwijderen.",
    liveNow: "Nu live",
  },
  linkedRoles: {
    title: "Gekoppelde rollen",
    description: "Koppel een rol aan een abonnement op je Twitch- of Kick-kanaal. Als leden hun account verbinden, krijgen ze de rol automatisch als ze eraan voldoen, en wordt hij verwijderd als het abonnement afloopt (elk halfuur opnieuw gecontroleerd). Alleen de servereigenaar kan dit instellen, voor het eigen kanaal.",
    ownerOnly: "Alleen de servereigenaar kan gekoppelde rollen beheren.",
    role: "Rol",
    platform: "Platform",
    requirement: "Vereiste",
    subscriber: "Geabonneerd op mijn kanaal",
    follower: "Volgt mijn kanaal",
    followerTwitchOnly: "De volgersvereiste werkt alleen met Twitch (Kick meldt niet wanneer iemand ontvolgt).",
    add: "Koppelen",
    remove: "Verwijderen",
    empty: "Nog geen gekoppelde rollen.",
    loading: "Laden…",
    needsBroadcaster: "Verbind eerst je {platform}-account met \"Verbinden als streamer\" onder Instellingen → Profiel → Verbindingen.",
    created: "Gekoppelde rol aangemaakt.",
    createFailed: "Kon de gekoppelde rol niet aanmaken.",
    removeFailed: "Kon de gekoppelde rol niet verwijderen.",
    granted: "{count, plural, one {# lid} other {# leden}}",
    lastSynced: "Laatst gecontroleerd: {time}",
    selectRole: "Selecteer een rol",
  },

} satisfies Translation<typeof streamingTr>;
