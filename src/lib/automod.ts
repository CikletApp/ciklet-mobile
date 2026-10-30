/**
 * AutoMod ve sunucu moderasyonu — ayar ekranının saf yardımcıları.
 *
 * Web `lib/automod.ts` (sınırlar, normalize/ayrıştırma, zaman aşımı
 * seçenekleri), `lib/automod-profanity.ts` (`foldTurkish`),
 * `lib/verification-level.ts` ve `lib/server-rules.ts` (RULES_TEXT_MAX)
 * dosyalarının mobilde gereken kısmının kopyası. Kurallar sunucuda uygulanır
 * (uç her alanı yeniden normalize eder); burası yalnızca taslağı webdeki
 * gibi düzenleyip kaydeder. Web değişirse burası da.
 */
import type { MessageKey, Translator } from "@/lib/i18n";

export const AUTOMOD_MAX_WORDS = 200;
export const AUTOMOD_MAX_WORD_LENGTH = 40;
export const AUTOMOD_MENTION_LIMIT_MAX = 50;
export const AUTOMOD_MAX_DOMAINS = 100;
export const AUTOMOD_MAX_EXEMPT = 100;
export const AUTOMOD_BLOCK_MESSAGE_MAX = 200;
export const AUTOMOD_CAPS_PERCENT_RANGE = { min: 50, max: 100 } as const;
export const AUTOMOD_CAPS_MIN_LETTERS_RANGE = { min: 5, max: 200 } as const;
export const AUTOMOD_SPAM_MESSAGES_RANGE = { min: 2, max: 50 } as const;
export const AUTOMOD_SPAM_WINDOW_RANGE = { min: 2, max: 120 } as const;
export const AUTOMOD_SPAM_DUPLICATES_RANGE = { min: 2, max: 20 } as const;

/** Kural kabul metninin tavanı (web lib/server-rules). */
export const RULES_TEXT_MAX = 4000;

export const AUTOMOD_TIMEOUT_OPTIONS: { seconds: number; key: MessageKey }[] = [
  { seconds: 0, key: "automod.timeout.none" },
  { seconds: 60, key: "automod.timeout.s60" },
  { seconds: 5 * 60, key: "automod.timeout.m5" },
  { seconds: 10 * 60, key: "automod.timeout.m10" },
  { seconds: 60 * 60, key: "automod.timeout.h1" },
  { seconds: 24 * 60 * 60, key: "automod.timeout.d1" },
  { seconds: 7 * 24 * 60 * 60, key: "automod.timeout.w1" },
];

export function automodTimeoutLabel(seconds: number, t: Translator): string {
  const option = AUTOMOD_TIMEOUT_OPTIONS.find((o) => o.seconds === seconds);
  return option ? t(option.key) : `${seconds} sn`;
}

export interface AutomodRules {
  profanityPreset: boolean;
  allowWords: string[];
  inviteFilter: boolean;
  blockedDomains: string[];
  capsFilter: boolean;
  capsPercent: number;
  capsMinLetters: number;
  spamFilter: boolean;
  spamMaxMessages: number;
  spamWindowSeconds: number;
  spamMaxDuplicates: number;
  profileFilter: boolean;
  warnInChannel: boolean;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
  blockMessage: string;
}

export const DEFAULT_AUTOMOD_RULES: Readonly<AutomodRules> = Object.freeze({
  profanityPreset: false,
  allowWords: [],
  inviteFilter: false,
  blockedDomains: [],
  capsFilter: false,
  capsPercent: 70,
  capsMinLetters: 12,
  spamFilter: false,
  spamMaxMessages: 6,
  spamWindowSeconds: 8,
  spamMaxDuplicates: 3,
  profileFilter: false,
  warnInChannel: false,
  exemptRoleIds: [],
  exemptChannelIds: [],
  blockMessage: "",
});

/** Türkçe büyük/küçük harf katlama (web lib/automod-profanity `foldTurkish`). */
function foldTurkish(s: string): string {
  return s.replace(/İ/g, "i").replace(/I/g, "ı").toLocaleLowerCase("tr-TR");
}

export function normalizeBlockedWords(input: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const w = foldTurkish(raw.trim()).replace(/\s+/g, " ");
    if (w.length < 2 || w.length > AUTOMOD_MAX_WORD_LENGTH) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= AUTOMOD_MAX_WORDS) break;
  }
  return out;
}

/** Virgül/satır ayrılmış metinden liste. */
export function parseBlockedWordsText(text: string): string[] {
  return normalizeBlockedWords(text.split(/[,\n]/));
}

export function normalizeMentionLimit(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(AUTOMOD_MENTION_LIMIT_MAX, Math.max(1, Math.floor(n)));
}

/** "https://www.Example.com/x" → "example.com"; geçersiz → null. */
export function normalizeDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^\*\./, "").replace(/^www\./, "");
  s = s.split(/[/?#:]/)[0] ?? "";
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) || s.length > 253) return null;
  return s;
}

export function normalizeAllowedDomains(input: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const d = normalizeDomain(raw);
    if (d && !out.includes(d)) out.push(d);
    if (out.length >= AUTOMOD_MAX_DOMAINS) break;
  }
  return out;
}

export function parseDomainsText(text: string): string[] {
  return normalizeAllowedDomains(text.split(/[,\s]+/));
}

function clampInt(value: unknown, range: { min: number; max: number }, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(n)));
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === "string" && ID_RE.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= AUTOMOD_MAX_EXEMPT) break;
  }
  return out;
}

/** Sunucudan ya da taslaktan gelen her şeyi geçerli kurallara çevirir. */
export function normalizeAutomodRules(raw: unknown): AutomodRules {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_AUTOMOD_RULES;
  return {
    profanityPreset: r.profanityPreset === true,
    allowWords: Array.isArray(r.allowWords) ? normalizeBlockedWords(r.allowWords) : [],
    inviteFilter: r.inviteFilter === true,
    blockedDomains: Array.isArray(r.blockedDomains) ? normalizeAllowedDomains(r.blockedDomains) : [],
    capsFilter: r.capsFilter === true,
    capsPercent: clampInt(r.capsPercent, AUTOMOD_CAPS_PERCENT_RANGE, d.capsPercent),
    capsMinLetters: clampInt(r.capsMinLetters, AUTOMOD_CAPS_MIN_LETTERS_RANGE, d.capsMinLetters),
    spamFilter: r.spamFilter === true,
    spamMaxMessages: clampInt(r.spamMaxMessages, AUTOMOD_SPAM_MESSAGES_RANGE, d.spamMaxMessages),
    spamWindowSeconds: clampInt(r.spamWindowSeconds, AUTOMOD_SPAM_WINDOW_RANGE, d.spamWindowSeconds),
    spamMaxDuplicates: clampInt(r.spamMaxDuplicates, AUTOMOD_SPAM_DUPLICATES_RANGE, d.spamMaxDuplicates),
    profileFilter: r.profileFilter === true,
    warnInChannel: r.warnInChannel === true,
    exemptRoleIds: normalizeIds(r.exemptRoleIds),
    exemptChannelIds: normalizeIds(r.exemptChannelIds),
    blockMessage: typeof r.blockMessage === "string" ? r.blockMessage.trim().slice(0, AUTOMOD_BLOCK_MESSAGE_MAX) : "",
  };
}

// ── Doğrulama seviyesi ve baskın kilidi (web lib/verification-level) ─────

export const VERIFICATION_LEVELS: { value: number; label: string; desc: string }[] = [
  { value: 0, label: "Yok", desc: "Herkes katılabilir" },
  { value: 1, label: "Düşük", desc: "E-posta doğrulanmış olmalı" },
  { value: 2, label: "Orta", desc: "E-posta doğrulanmış ve hesap en az 5 dakikalık" },
  { value: 3, label: "Yüksek", desc: "E-posta doğrulanmış ve hesap en az 10 dakikalık" },
  { value: 4, label: "En Yüksek", desc: "Telefon numarası doğrulanmış" },
];

export const MAX_VERIFICATION_LEVEL = 4;

export function parseVerificationLevel(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(MAX_VERIFICATION_LEVEL, n);
}

export function isRaidLocked(raidLockUntil: Date | string | null | undefined, now = Date.now()): boolean {
  if (!raidLockUntil) return false;
  const t = new Date(raidLockUntil).getTime();
  return Number.isFinite(t) && t > now;
}
