/**
 * Telefonda çalan medya → rich presence (saf mantık; RN bağımlılığı yok,
 * scripts/verify-media-activity.mjs ile doğrulanır).
 *
 * Biçim masaüstüyle BİREBİR (ciklet-desktop contract `DetectedActivity`,
 * web `lib/desktop/presence.toWireActivity`):
 *   type        LISTENING (müzik) / WATCHING (YouTube)
 *   name        uygulama adı — masaüstünün kullandığı dizeler ("Spotify",
 *               "YouTube Music", "YouTube"): web ve masaüstü ikon/renk
 *               seçimini (YouTube simgesi, YouTube Music kırmızısı) ada göre
 *               yapıyor
 *   details     parça / video başlığı
 *   state       sanatçı
 *   processName paket adı (masaüstünde exe / SMTC uygulama kimliği)
 *   largeImageUrl  kapak — yalnızca sunucuya yüklenmiş kısa yol
 *               (/api/presence/covers/<sha256>); data URL ağa ÇIKMAZ
 *               (ağ geçidi `rich_presence.update`'i 8 KB ile sınırlıyor)
 *   timestamps  parça başlangıç/bitiş (epoch ms), süre biliniyorsa
 *
 * Ek alan `device: "mobile"`: etkinliğin telefondan geldiğini işaretler
 * (arkadaşların kartında telefon simgesi). Ağ geçidi etkinlik gövdesini
 * olduğu gibi taşıyor (gateway/src/events.rs RichPresencePayload,
 * `deny_unknown_fields` yok); `platform` alanı Twitch/Kick yayınına ait
 * olduğundan ayrı bir ad seçildi.
 */
import type { RichPresence } from "@/api/types";

/** Etkinliği telefondan geldiğini işaretleyen alan gönderilsin mi. */
export const SEND_MOBILE_MARKER = true;
export const MOBILE_DEVICE = "mobile";

export type MediaKind = "music" | "video";

/** Native modülün (modules/ciklet-media) bildirdiği oturum — burada yapısal kopya. */
export interface MediaSessionInfo {
  packageName: string;
  appName: string | null;
  appCategory: string | null;
  title: string;
  artist: string | null;
  album: string | null;
  durationMs: number;
  positionMs: number;
  playing: boolean;
}

export interface MediaSharing {
  music: boolean;
  video: boolean;
}

interface KnownApp {
  name: string;
  kind: MediaKind;
}

/**
 * Bilinen uygulamalar. Adlar masaüstü kataloğundaki / SMTC eşlemesindeki
 * adlarla aynı (ciklet-desktop src-tauri/src/media.rs).
 */
export const KNOWN_MEDIA_APPS: Readonly<Record<string, KnownApp>> = {
  "com.spotify.music": { name: "Spotify", kind: "music" },
  "com.spotify.lite": { name: "Spotify", kind: "music" },
  "com.google.android.apps.youtube.music": { name: "YouTube Music", kind: "music" },
  "app.revanced.android.apps.youtube.music": { name: "YouTube Music", kind: "music" },
  "com.google.android.youtube": { name: "YouTube", kind: "video" },
  "app.revanced.android.youtube": { name: "YouTube", kind: "video" },
  "com.vanced.android.youtube": { name: "YouTube", kind: "video" },
  "com.apple.android.music": { name: "Apple Music", kind: "music" },
  "com.soundcloud.android": { name: "SoundCloud", kind: "music" },
  "deezer.android.app": { name: "Deezer", kind: "music" },
  "com.aspiro.tidal": { name: "TIDAL", kind: "music" },
  "com.amazon.mp3": { name: "Amazon Music", kind: "music" },
};

/**
 * Medya oturumu açan ama "dinliyor" sayılmaması gereken uygulamalar:
 * tarayıcılar (hangi sitede ne izlendiği gizli kalmalı; masaüstü de
 * tarayıcıyı yalnızca YouTube penceresinde gösteriyor), sesli mesaj ve kısa
 * video oynatan sosyal uygulamalar, navigasyon / asistan.
 */
const IGNORED_PACKAGES = new Set([
  "com.android.chrome",
  "com.chrome.beta",
  "com.chrome.dev",
  "org.mozilla.firefox",
  "org.mozilla.firefox_beta",
  "com.sec.android.app.sbrowser",
  "com.opera.browser",
  "com.opera.gx",
  "com.brave.browser",
  "com.microsoft.emmx",
  "com.duckduckgo.mobile.android",
  "com.vivaldi.browser",
  "com.yandex.browser",
  "com.mi.globalbrowser",
  "com.whatsapp",
  "com.whatsapp.w4b",
  "org.telegram.messenger",
  "org.thunderdog.challegram",
  "com.instagram.android",
  "com.snapchat.android",
  "com.zhiliaoapp.musically",
  "com.ss.android.ugc.trill",
  "com.facebook.katana",
  "com.facebook.orca",
  "com.discord",
  "com.twitter.android",
  "com.google.android.googlequicksearchbox",
  "com.google.android.apps.maps",
  "com.waze",
  "com.google.android.dialer",
  "com.samsung.android.dialer",
]);

const MAX_TEXT = 128;

/** Kod noktası sınırında keser (web `clampText` ile aynı). */
export function clampText(value: string | null | undefined, max = MAX_TEXT): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;
  return Array.from(trimmed).slice(0, max).join("");
}

/** Etiketi okunamayan paketin adı: "com.example.podcastapp" → "Podcastapp". */
export function fallbackAppName(packageName: string): string {
  const generic = new Set(["android", "app", "apps", "mobile", "music", "player", "com", "org", "net"]);
  const parts = packageName.split(".").filter((part) => part && !generic.has(part.toLowerCase()));
  const last = parts[parts.length - 1] ?? packageName;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

/** Paket → (ad, tür); paylaşılmayacaksa null. */
export function resolveMediaApp(
  session: Pick<MediaSessionInfo, "packageName" | "appName" | "appCategory">
): KnownApp | null {
  const known = KNOWN_MEDIA_APPS[session.packageName];
  if (known) return known;
  if (IGNORED_PACKAGES.has(session.packageName)) return null;
  if (session.appCategory === "game") return null;
  const name = clampText(session.appName) ?? fallbackAppName(session.packageName);
  return { name, kind: session.appCategory === "video" ? "video" : "music" };
}

export interface MediaActivityOptions {
  sharing: MediaSharing;
  /** Epoch ms — test edilebilirlik için dışarıdan. */
  now: number;
  /** Aynı uygulamada süren dinlemenin başlangıcı; parça değişince sabit kalır. */
  startedAt?: number;
  /** Sunucuya yüklenmiş kapak yolu (yoksa kapaksız). */
  coverUrl?: string | null;
}

/**
 * Oturum → ağa gidecek etkinlik. Çalmıyorsa, uygulama paylaşılmıyorsa ya da
 * kategorisi kapalıysa null.
 */
export function toMediaActivity(
  session: MediaSessionInfo | null,
  options: MediaActivityOptions
): RichPresence | null {
  if (!session || !session.playing) return null;
  const app = resolveMediaApp(session);
  if (!app) return null;
  if (app.kind === "music" ? !options.sharing.music : !options.sharing.video) return null;

  const title = clampText(session.title);
  if (!title) return null;

  const position = Math.max(0, session.positionMs || 0);
  const trackStart = Math.round(options.now - position);

  const activity: RichPresence = {
    type: app.kind === "video" ? "WATCHING" : "LISTENING",
    name: app.name,
    details: title,
    processName: session.packageName,
    startedAt: options.startedAt && options.startedAt > 0 ? options.startedAt : trackStart,
  };

  const state = clampText(session.artist) ?? clampText(session.album);
  if (state) activity.state = state;

  if (session.durationMs > 0) {
    activity.timestamps = { start: trackStart, end: trackStart + Math.round(session.durationMs) };
  }

  if (options.coverUrl && HOSTED_COVER_PATH.test(options.coverUrl)) {
    activity.largeImageUrl = options.coverUrl;
  }

  if (SEND_MOBILE_MARKER) activity.device = MOBILE_DEVICE;
  return activity;
}

/** Kendi kapak depomuzun yolu (web lib/desktop/presence.ts HOSTED_COVER_PATH). */
export const HOSTED_COVER_PATH = /^\/api\/presence\/covers\/[0-9a-f]{64}$/;

/** Aynı etkinliğin tekrar yayınlanmasını önlemek için kararlı anahtar. */
export function activityKey(activity: RichPresence | null): string {
  return activity ? JSON.stringify(activity) : "null";
}

/** Başkasının etkinliği telefondan mı geliyor (kartta telefon simgesi). */
export function isMobileActivity(activity: { device?: unknown } | null | undefined): boolean {
  return activity?.device === MOBILE_DEVICE;
}

/** Kapak önbelleği anahtarı — aynı parçanın kapağı bir kez yüklenir. */
export function artworkCacheKey(session: Pick<MediaSessionInfo, "packageName" | "title" | "artist">, base64: string): string {
  return `${session.packageName}\u0000${session.title}\u0000${session.artist ?? ""}\u0000${base64.length}\u0000${base64.slice(-48)}`;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) table[BASE64_ALPHABET.charCodeAt(i)] = i;
  return table;
})();

/** base64 → bayt (Hermes'te `atob` sürüme bağlı; elle çözülür). Geçersizse null. */
export function decodeBase64(value: string): Uint8Array | null {
  const clean = value.replace(/=+$/, "");
  if (clean.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const digit = code < 128 ? BASE64_LOOKUP[code] : -1;
    if (digit < 0) return null;
    buffer = ((buffer << 6) | digit) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out.slice(0, index);
}
