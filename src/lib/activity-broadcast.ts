/**
 * Yayın sunumu — saf, bağımlılıksız (scripts/verify-activity-broadcast.mjs
 * doğrudan içe aktarır). ciklet-web `src/lib/activity-presentation.ts`
 * (broadcastPresentation) ve `src/lib/streaming-software.ts` ile AYNI kural.
 *
 * Yayın programı (OBS, Streamlabs, XSplit…) hiçbir yerde ADIYLA ve
 * İKONUYLA görünmez:
 *  - Twitch/Kick yayını (`STREAMING` + platform): oyun = kategori (`state`)
 *    → "Dead by Daylight yayını yapıyor"; kategori yoksa "Twitch'te yayında".
 *  - Yayın programı tek başına (masaüstü OBS'yi `STREAMING` bildiriyor):
 *    "Yayında".
 *  - Oyun + aynı anda yayın programı: masaüstü yalnızca oyunu bildiriyor,
 *    web istemcisi `broadcasting` işaretini koyuyor → "FC 27 yayını yapıyor".
 *  - Bot etkinliği bu kurala girmez.
 *
 * Tanıma ad listesiyle: uygulama kataloğunda "yayın programı" bayrağı yok;
 * ileride katalog girdisine bir bayrak eklenirse liste oraya taşınabilir.
 * Karşılaştırma normalize edilmiş adla (küçük harf, `.exe`siz, harf/rakam
 * dışı tek boşluk).
 */

const STREAMING_SOFTWARE = new Set([
  "obs", "obs studio", "obs64", "obs32",
  "streamlabs", "streamlabs obs", "streamlabs desktop", "slobs",
  "xsplit", "xsplit broadcaster", "xsplit core",
  "twitch studio", "twitchstudio",
  "prism live studio", "prismlivestudio",
  "meld studio",
  "vmix", "vmix64",
]);

/** Bağlı hesap yayınının adları — geçmiş satırında `platform` yok, ad kalıyor. */
const PLATFORM_ACTIVITY_NAMES = new Set(["twitch", "kick", "youtube"]);

export type BroadcastPlatform = "twitch" | "kick" | "youtube";

const PLATFORM_NAMES: Record<BroadcastPlatform, string> = { twitch: "Twitch", kick: "Kick", youtube: "YouTube" };

export function normalizeSoftwareName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\.exe$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Ad ya da süreç adı bilinen bir yayın programı mı. */
export function isStreamingSoftwareName(value: string | null | undefined): boolean {
  if (!value) return false;
  return STREAMING_SOFTWARE.has(normalizeSoftwareName(value));
}

export interface BroadcastSource {
  type?: string | number | null;
  name: string;
  state?: string | null;
  platform?: string | null;
  broadcasting?: boolean;
  bot?: boolean;
}

function broadcastPlatform(value: unknown): BroadcastPlatform | null {
  return value === "twitch" || value === "kick" || value === "youtube" ? value : null;
}

/** Etkinlik bir yayın programının kendisi mi (adı ve ikonu çizilmez). */
export function isStreamingSoftwareActivity(activity: BroadcastSource | null | undefined): boolean {
  if (!activity || activity.bot === true) return false;
  if (isStreamingSoftwareName(activity.name)) return true;
  if (activity.type !== "STREAMING" || broadcastPlatform(activity.platform)) return false;
  return !PLATFORM_ACTIVITY_NAMES.has(activity.name.trim().toLowerCase());
}

export interface BroadcastPresentation {
  /** Yayınlanan oyun; yoksa null — "Yayında". */
  game: string | null;
  /** Bağlı hesap yayını (Twitch/Kick). */
  platform: BroadcastPlatform | null;
  /** Etkinlik yayın programının kendisi: adı ve görseli çizilmez. */
  software: boolean;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Yayın değilse null. */
export function broadcastPresentation(activity: BroadcastSource | null | undefined): BroadcastPresentation | null {
  if (!activity || activity.bot === true) return null;
  const platform = broadcastPlatform(activity.platform);
  if (activity.type === "STREAMING" && platform) return { game: clean(activity.state), platform, software: false };
  if (isStreamingSoftwareActivity(activity)) return { game: null, platform: null, software: true };
  if ((activity.type === "PLAYING" || activity.type === "COMPETING") && activity.broadcasting === true) {
    return { game: clean(activity.name), platform: null, software: false };
  }
  return null;
}

/** Etiketler — i18n sözlüğündeki `activity.broadcast` ad alanıyla aynı şekil. */
export interface BroadcastLabels {
  /** "Yayında" */
  live: string;
  /** "{game} yayını yapıyor" */
  game: string;
  /** "{platform}'te yayında" */
  liveOn: string;
  /** Oyunsuz yayının başlığı: "Canlı yayın" */
  title: string;
}

/** "FC 27 yayını yapıyor" / "Yayında" / "Twitch'te yayında". */
export function broadcastText(broadcast: BroadcastPresentation, labels: BroadcastLabels): string {
  if (broadcast.game) return labels.game.replace("{game}", broadcast.game);
  if (broadcast.platform) return labels.liveOn.replace("{platform}", PLATFORM_NAMES[broadcast.platform]);
  return labels.live;
}
