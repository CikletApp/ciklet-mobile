/**
 * Yayın sunumu — saf, bağımlılıksız (scripts/verify-activity-broadcast.mjs
 * doğrudan içe aktarır). ciklet-web `src/lib/activity-presentation.ts`
 * (broadcastPresentation) ve `src/lib/streaming-software.ts` ile AYNI kural.
 *
 * Yayın programı (OBS, Streamlabs, XSplit…) hiçbir yerde ADIYLA ve
 * İKONUYLA görünmez:
 *  - Twitch/Kick yayını (`STREAMING` + platform): oyun = masaüstünün
 *    bildirdiği oyun (`game`, sunucu birleştirir), yoksa kategori (`state`)
 *    → "Dead by Daylight yayını yapıyor"; ikisi de yoksa "Twitch'te yayında".
 *    Kanal adresi (`url`) varsa kart dokununca yayını açar (streamWatchUrl).
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
  /** Yayına eklenen masaüstü oyunu (yalnızca `STREAMING`). */
  game?: string | null;
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
  if (activity.type === "STREAMING" && platform) return { game: clean(activity.game) ?? clean(activity.state), platform, software: false };
  if (isStreamingSoftwareActivity(activity)) return { game: null, platform: null, software: true };
  if ((activity.type === "PLAYING" || activity.type === "COMPETING") && activity.broadcasting === true) {
    return { game: clean(activity.name), platform: null, software: false };
  }
  return null;
}

const STREAM_WATCH_PATTERNS: readonly RegExp[] = [
  /^https:\/\/(?:www\.)?(?:twitch\.tv|kick\.com)\/[A-Za-z0-9_-]{2,25}$/,
  /^https:\/\/(?:www\.|m\.)?youtube\.com\/(?:watch\?v=[A-Za-z0-9_-]{11}|live\/[A-Za-z0-9_-]{11}|@[A-Za-z0-9_.-]{3,30}|channel\/UC[A-Za-z0-9_-]{22})$/,
  /^https:\/\/youtu\.be\/[A-Za-z0-9_-]{11}$/,
];

/**
 * "Yayını İzle" adresi olarak açılabilir mi — ciklet-web
 * lib/streaming/activity `isStreamWatchUrl` ve ağ geçidi
 * `presence::stream_watch_platform` ile AYNI izin listesi.
 */
export function isStreamWatchUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 96) return false;
  return STREAM_WATCH_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Yayının izleme adresi (yalnızca `STREAMING` + izin listesi); bağlı yayın
 * yoksa (yalnızca OBS + oyun) null — kart dokununca bir şey açmaz.
 */
export function streamWatchUrl(activity: { type?: string | number | null; url?: string | null } | null | undefined): string | null {
  if (!activity || activity.type !== "STREAMING") return null;
  return isStreamWatchUrl(activity.url) ? activity.url : null;
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
