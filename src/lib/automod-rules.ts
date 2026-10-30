/**
 * AutoMod v2 kural modeli — ciklet-web `src/lib/automod-rules.ts`'in mobilde
 * gereken kısmı (türler, sınırlar, taslak oluşturma, normalleştirme). Kural
 * eşleştirmesi sunucuda; burası yalnızca ayar ekranının taslağını webdeki
 * gibi düzenler. İki tarafta birlikte değişmeli.
 */
import { AUTOMOD_REGEX_MAX_LENGTH, validateAutomodRegex } from "@/lib/automod-regex";

/** Türkçe katlama (web lib/automod-profanity `foldTurkish`). */
function foldTurkish(s: string): string {
  return s.replace(/İ/g, "i").replace(/I/g, "ı").toLocaleLowerCase("tr-TR");
}

export type AutomodRuleType = "keyword" | "preset" | "mention_spam" | "member_profile";
export const AUTOMOD_RULE_TYPES: readonly AutomodRuleType[] = ["keyword", "preset", "mention_spam", "member_profile"];
export type AutomodPreset = "profanity";
export const AUTOMOD_PRESETS: readonly AutomodPreset[] = ["profanity"];

/** Tür başına en çok kural (Discord: 6 anahtar kelime, diğerleri 1). */
export const AUTOMOD_RULE_LIMITS: Readonly<Record<AutomodRuleType, number>> = {
  keyword: 6,
  preset: 1,
  mention_spam: 1,
  member_profile: 1,
};
export const AUTOMOD_RULE_NAME_MAX = 100;
export const AUTOMOD_KEYWORDS_MAX = 1000;
export const AUTOMOD_KEYWORD_LENGTH_MAX = 60;
export const AUTOMOD_REGEX_PATTERNS_MAX = 10;
export const AUTOMOD_ALLOW_LIST_MAX = 100;
export const AUTOMOD_PRESET_ALLOW_LIST_MAX = 1000;
export const AUTOMOD_RULE_MENTION_LIMIT_MAX = 50;
export const AUTOMOD_RULE_BLOCK_MESSAGE_MAX = 150;
export const AUTOMOD_RULE_EXEMPT_MAX = 50;
/** Zaman aşımı seçenekleri (sn) — lib/automod AUTOMOD_TIMEOUT_OPTIONS ile aynı. */
export const AUTOMOD_RULE_TIMEOUTS: readonly number[] = [0, 60, 300, 600, 3600, 86400, 604800];

export interface AutomodRuleActions {
  /** Mesajı engelle (gönderilmez; ağ geçidi yolunda silinir). */
  block: boolean;
  /** Gönderene gösterilecek özel metin (boşsa varsayılan). */
  blockMessage: string;
  /** Uyarı gönderilecek kanal; null = uyarı yok. */
  alertChannelId: string | null;
  /** Yazara zaman aşımı (sn); 0 = yok. */
  timeoutSeconds: number;
  /** Üye etkileşimlerini engelle (karantina). */
  quarantine: boolean;
}

export interface AutomodRuleV2 {
  id: string;
  name: string;
  type: AutomodRuleType;
  enabled: boolean;
  keywords: string[];
  regexPatterns: string[];
  allowList: string[];
  presets: AutomodPreset[];
  mentionLimit: number;
  raidProtection: boolean;
  actions: AutomodRuleActions;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
}

export const DEFAULT_RULE_ACTIONS: Readonly<AutomodRuleActions> = Object.freeze({
  block: true,
  blockMessage: "",
  alertChannelId: null,
  timeoutSeconds: 0,
  quarantine: false,
});

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function newRuleId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Yeni kural taslağı (arayüz "Kural Oluştur"). */
export function createAutomodRule(type: AutomodRuleType, name: string): AutomodRuleV2 {
  return {
    id: newRuleId(),
    name,
    type,
    enabled: true,
    keywords: [],
    regexPatterns: [],
    allowList: [],
    presets: type === "preset" ? ["profanity"] : [],
    mentionLimit: type === "mention_spam" ? 10 : 0,
    raidProtection: type === "mention_spam",
    actions: { ...DEFAULT_RULE_ACTIONS, block: type !== "member_profile", quarantine: type === "member_profile" },
    exemptRoleIds: [],
    exemptChannelIds: [],
  };
}

// ── Normalleştirme / doğrulama ──────────────────────────────────────────

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === "string" && ID_RE.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= AUTOMOD_RULE_EXEMPT_MAX) break;
  }
  return out;
}

/** Anahtar kelime: katlanmış, boşlukları sıkıştırılmış; jokerler yalnızca baş/son. */
export function normalizeKeyword(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const w = foldTurkish(raw.trim()).replace(/\s+/g, " ");
  const core = w.replace(/^\*/, "").replace(/\*$/, "");
  if (core.length < 2 || w.length > AUTOMOD_KEYWORD_LENGTH_MAX || core.includes("*")) return null;
  return w;
}

export function normalizeKeywordList(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const w = normalizeKeyword(raw);
    if (!w || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

/** Virgül/satır ayrılmış metin → liste (arayüz). */
export function parseKeywordText(text: string, max = AUTOMOD_KEYWORDS_MAX): string[] {
  return normalizeKeywordList(text.split(/[,\n]/), max);
}

function normalizeActions(raw: unknown, type: AutomodRuleType): AutomodRuleActions {
  const a = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const timeout = typeof a.timeoutSeconds === "number" && AUTOMOD_RULE_TIMEOUTS.includes(a.timeoutSeconds) ? a.timeoutSeconds : 0;
  const alert = typeof a.alertChannelId === "string" && ID_RE.test(a.alertChannelId) ? a.alertChannelId : null;
  return {
    // Profil kuralında mesaj engeli yok: karantina zaten gönderimi durdurur.
    block: type === "member_profile" ? false : a.block !== false,
    blockMessage: type === "member_profile" ? "" : str(a.blockMessage, AUTOMOD_RULE_BLOCK_MESSAGE_MAX),
    alertChannelId: alert,
    timeoutSeconds: timeout,
    // Profil kuralı her zaman karantinaya alır (Discord "Block Member Interactions").
    quarantine: type === "member_profile" ? true : a.quarantine === true,
  };
}

export interface RuleListIssue {
  index: number;
  message: string;
}

/**
 * Tek kural. `strict`: geçersiz düzenli ifade HATA (kayıt ucu); değilse
 * sessizce düşer (veritabanından okuma — bozuk veri sunucuyu kilitlemesin).
 */
export function normalizeAutomodRule(raw: unknown, options: { strict?: boolean } = {}): { rule: AutomodRuleV2 | null; error?: string } {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!r) return { rule: null, error: "Kural geçersiz." };
  const type = AUTOMOD_RULE_TYPES.includes(r.type as AutomodRuleType) ? (r.type as AutomodRuleType) : null;
  if (!type) return { rule: null, error: "Kural türü geçersiz." };
  const usesWords = type === "keyword" || type === "member_profile";
  const regexPatterns: string[] = [];
  if (usesWords && Array.isArray(r.regexPatterns)) {
    for (const p of r.regexPatterns) {
      if (typeof p !== "string" || !p.trim()) continue;
      const pattern = p.trim();
      const err = Array.from(pattern).length > AUTOMOD_REGEX_MAX_LENGTH ? `Desen en çok ${AUTOMOD_REGEX_MAX_LENGTH} karakter olabilir.` : validateAutomodRegex(pattern);
      if (err) {
        if (options.strict) return { rule: null, error: `Düzenli ifade geçersiz (${pattern.slice(0, 40)}): ${err}` };
        continue;
      }
      if (!regexPatterns.includes(pattern)) regexPatterns.push(pattern);
    }
    if (options.strict && regexPatterns.length > AUTOMOD_REGEX_PATTERNS_MAX) {
      return { rule: null, error: `Bir kuralda en çok ${AUTOMOD_REGEX_PATTERNS_MAX} düzenli ifade olabilir.` };
    }
  }
  const presets = (Array.isArray(r.presets) ? r.presets : []).filter((p): p is AutomodPreset => AUTOMOD_PRESETS.includes(p as AutomodPreset));
  const mentionLimit = typeof r.mentionLimit === "number" && Number.isFinite(r.mentionLimit) ? Math.min(AUTOMOD_RULE_MENTION_LIMIT_MAX, Math.max(1, Math.floor(r.mentionLimit))) : 10;
  const name = str(r.name, AUTOMOD_RULE_NAME_MAX);
  return {
    rule: {
      id: typeof r.id === "string" && ID_RE.test(r.id) ? r.id : newRuleId(),
      name: name || defaultRuleName(type),
      type,
      enabled: r.enabled !== false,
      keywords: usesWords ? normalizeKeywordList(r.keywords, AUTOMOD_KEYWORDS_MAX) : [],
      regexPatterns: regexPatterns.slice(0, AUTOMOD_REGEX_PATTERNS_MAX),
      allowList: type === "mention_spam" ? [] : normalizeKeywordList(r.allowList, type === "preset" ? AUTOMOD_PRESET_ALLOW_LIST_MAX : AUTOMOD_ALLOW_LIST_MAX),
      presets: type === "preset" || type === "member_profile" ? [...new Set(presets)] : [],
      mentionLimit: type === "mention_spam" ? mentionLimit : 0,
      raidProtection: type === "mention_spam" ? r.raidProtection === true : false,
      actions: normalizeActions(r.actions, type),
      exemptRoleIds: ids(r.exemptRoleIds),
      exemptChannelIds: ids(r.exemptChannelIds),
    },
  };
}

export function defaultRuleName(type: AutomodRuleType): string {
  switch (type) {
    case "keyword":
      return "Özel kelimeler";
    case "preset":
      return "Hazır listeler";
    case "mention_spam":
      return "Bahsetme spam'i";
    case "member_profile":
      return "Üye profili";
  }
}

/**
 * Liste: tür sınırları (6 / 1 / 1 / 1) ve tekrarsız kimlik. `strict` kipte
 * ilk sorun hata olarak döner.
 */
export function normalizeAutomodRuleList(raw: unknown, options: { strict?: boolean } = {}): { rules: AutomodRuleV2[]; error?: string } {
  if (!Array.isArray(raw)) return options.strict ? { rules: [], error: "Kural listesi geçersiz." } : { rules: [] };
  const counts: Record<AutomodRuleType, number> = { keyword: 0, preset: 0, mention_spam: 0, member_profile: 0 };
  const out: AutomodRuleV2[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const { rule, error } = normalizeAutomodRule(item, options);
    if (!rule) {
      if (options.strict) return { rules: [], error };
      continue;
    }
    if (counts[rule.type] >= AUTOMOD_RULE_LIMITS[rule.type]) {
      if (options.strict) return { rules: [], error: limitMessage(rule.type) };
      continue;
    }
    counts[rule.type] += 1;
    if (seen.has(rule.id)) rule.id = newRuleId();
    seen.add(rule.id);
    out.push(rule);
  }
  return { rules: out };
}

function limitMessage(type: AutomodRuleType): string {
  return type === "keyword" ? `En fazla ${AUTOMOD_RULE_LIMITS.keyword} anahtar kelime kuralı olabilir.` : "Bu türden yalnızca bir kural olabilir.";
}
