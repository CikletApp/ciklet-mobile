/**
 * Mesaj gövdesindeki Discord uyumlu küçük işaretler — ciklet-web
 * `lib/message-markup`, `lib/custom-emoji`, `lib/mention-pattern` ve
 * `lib/silent-message` ile aynı desenler. Desenler iki istemcide birebir
 * aynı olmalı: biri pil çizip öbürü düz metin bırakırsa kullanıcı aynı
 * mesajı iki farklı şekilde görür.
 */

// ── Zaman damgası `<t:unix:stil>` ─────────────────────────────────────

export type TimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R";

export const TIMESTAMP_SOURCE = "<t:(\\d{1,13})(?::([tTdDfFR]))?>";

const timeShort = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });
const timeLong = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateShort = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateLong = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateTimeFull = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const RELATIVE_UNITS: [number, string][] = [
  [60, "saniye"],
  [60, "dakika"],
  [24, "saat"],
  [7, "gün"],
  [4.34524, "hafta"],
  [12, "ay"],
  [Number.POSITIVE_INFINITY, "yıl"],
];

/**
 * "3 dakika önce", "2 gün sonra". Hermes'te `Intl.RelativeTimeFormat`
 * her cihazda yok; Türkçe kalıp elle kurulur (web `numeric: "auto"` gibi
 * dün/yarın/şimdi dahil).
 */
export function formatRelative(unixSeconds: number, nowMs = Date.now()): string {
  let diff = (unixSeconds * 1000 - nowMs) / 1000;
  if (Math.abs(diff) < 10) return "şimdi";
  for (const [step, unit] of RELATIVE_UNITS) {
    if (Math.abs(diff) < step) {
      const value = Math.round(Math.abs(diff));
      if (unit === "gün" && value === 1) return diff < 0 ? "dün" : "yarın";
      return `${value} ${unit} ${diff < 0 ? "önce" : "sonra"}`;
    }
    diff /= step;
  }
  return `${Math.round(Math.abs(diff))} yıl ${diff < 0 ? "önce" : "sonra"}`;
}

/** Damgayı cihazın saat diliminde biçimler. Geçersiz değer ham belirteç döner. */
export function formatTimestamp(unixSeconds: number, style: TimestampStyle, nowMs = Date.now()): string {
  const date = new Date(unixSeconds * 1000);
  if (!Number.isFinite(unixSeconds) || Number.isNaN(date.getTime())) return `<t:${unixSeconds}>`;
  switch (style) {
    case "t":
      return timeShort.format(date);
    case "T":
      return timeLong.format(date);
    case "d":
      return dateShort.format(date);
    case "D":
      return dateLong.format(date);
    case "F":
      return dateTimeFull.format(date);
    case "R":
      return formatRelative(unixSeconds, nowMs);
    case "f":
    default:
      return dateTime.format(date);
  }
}

// ── Sunucu emojisi `<:ad:id>` ─────────────────────────────────────────

export const CUSTOM_EMOJI_SOURCE = "<:([A-Za-z0-9_]{1,32}):([A-Za-z0-9-]{8,64})>";

export interface CustomEmojiRef {
  name: string;
  id: string;
}

export function formatCustomEmoji(ref: CustomEmojiRef): string {
  return `<:${ref.name}:${ref.id}>`;
}

/** Metnin tamamı tek bir belirteç mi (tepki çipi için). */
export function parseCustomEmojiToken(text: string): CustomEmojiRef | null {
  const match = new RegExp(`^${CUSTOM_EMOJI_SOURCE}$`).exec(text.trim());
  return match ? { name: match[1], id: match[2] } : null;
}

/** Yalnızca sunucu emojilerinden (ve boşluktan) oluşan mesaj — büyük çizim; en çok 8. */
export function isCustomEmojiOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(CUSTOM_EMOJI_SOURCE, "g");
  if (trimmed.replace(pattern, "").replace(/\s+/g, "").length > 0) return false;
  return (trimmed.match(pattern) ?? []).length <= 8;
}

// ── Toplu bahsetmeler ve roller ───────────────────────────────────────

export type BroadcastKind = "everyone" | "here";

/** Okuyanın dilindeki ad — mobil arayüz Türkçe. */
export const BROADCAST_LABEL: Record<BroadcastKind, string> = { everyone: "herkes", here: "burada" };

/** Yazımda kabul edilen adlar (web `BROADCAST_ALIASES`); depoda kanonik İngilizce. */
const BROADCAST_ALIASES: Record<string, BroadcastKind> = {
  everyone: "everyone",
  herkes: "everyone",
  here: "here",
  burada: "here",
};

export function broadcastKindOf(word: string): BroadcastKind | null {
  return BROADCAST_ALIASES[word.toLocaleLowerCase("tr-TR")] ?? null;
}

/** Kullanıcı adı deseni (web `MENTION_PATTERN`) — Türkçe harfler ve nokta dahil. */
export const MENTION_SOURCE = "@([a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ.]+)";

/** `<@&rolId>` (web `ROLE_MENTION_PATTERN`). */
export const ROLE_MENTION_SOURCE = "<@&([A-Za-z0-9-]{1,64})>";

// ── Sessiz mesaj ──────────────────────────────────────────────────────

export const SILENT_PREFIX = "@sessiz";

/**
 * `@silent` / `@sessiz` ön eki (web `parseSilentPrefix`). Ön eki sunucu
 * soyar ve `metadata.silent` yazar; istemci yalnızca yazma çubuğundaki
 * işareti göstermek için bakar.
 */
export function hasSilentPrefix(content: string): boolean {
  const head = content.replace(/^\s+/, "").toLocaleLowerCase("tr-TR");
  return /^@(silent|sessiz)[ \n]/.test(head);
}

/** Ön eki (varsa) kaldırır ya da ekler — yazma çubuğundaki "Sessiz" anahtarı. */
export function toggleSilentPrefix(content: string): string {
  const trimmed = content.replace(/^\s+/, "");
  const match = /^@(silent|sessiz)[ \n]+/i.exec(trimmed);
  if (match) return trimmed.slice(match[0].length);
  return `${SILENT_PREFIX} ${trimmed}`;
}
