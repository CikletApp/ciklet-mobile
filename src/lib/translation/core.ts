/**
 * Mesaj çevirisi — platformdan bağımsız çekirdek.
 *
 * BU DOSYA web (`ciklet-web/src/lib/translation/core.ts`) ve mobil
 * (`ciklet-mobile/src/lib/translation/core.ts`) depolarında BİREBİR AYNIDIR;
 * web birim testi (tests/unit/translation-core.test.ts) yan yana duran kopyayı
 * karşılaştırır. Bağımlılık yok.
 *
 * Çeviri HER ZAMAN cihazda yapılır: web/masaüstünde tarayıcının yerleşik
 * Translator/LanguageDetector API'si, mobilde ML Kit (Android) ve Apple
 * Translation (iOS). Mesaj içeriği Ciklet sunucusuna ya da ücretli bir
 * çeviri servisine GİTMEZ. Burada yalnızca:
 *  - hedef dil seçimi (ayar → arayüz dili),
 *  - korunan parçalar (kod, bağlantı, bahsetme, özel emoji, zaman damgası)
 *    çeviriye girmesin diye metni parçalara bölme,
 *  - istemci içi önbellek (mesaj kimliği + içerik özeti + hedef dil),
 *  - motoru çağıran akış (`translateMessage`).
 */

/** Ayar değeri: "auto" arayüz dilini izler. */
export const TRANSLATION_TARGET_AUTO = "auto";
export type TranslationTargetPreference = typeof TRANSLATION_TARGET_AUTO | string;

/**
 * Ayarlardaki hedef dil listesi. Chrome/Edge Translator, ML Kit ve Apple
 * Translation'ın ortak kümesinden yaygın olanlar; bir çiftin gerçekten
 * desteklenip desteklenmediğini motor çalışma anında söyler.
 */
export const TRANSLATION_LANGUAGES = [
  "tr", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "uk", "ar",
  "fa", "hi", "ja", "ko", "zh", "zh-Hant", "az", "el", "sv", "da", "fi", "no",
  "cs", "ro", "hu", "bg", "he", "id", "vi", "th",
] as const;
export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

/** Tek mesajda çevrilecek en uzun metin (Ciklet mesaj sınırı 4000). */
export const MAX_TRANSLATION_CHARS = 4000;

/** BCP 47 etiketini listedeki koda indirger ("en-US" → "en", "zh-TW" → "zh-Hant"). */
export function normalizeLanguageTag(tag: string | null | undefined): string | null {
  if (typeof tag !== "string") return null;
  const clean = tag.trim().replace(/_/g, "-");
  if (!clean || clean.length > 35 || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(clean)) return null;
  const parts = clean.split("-");
  const base = parts[0].toLowerCase();
  if (base === "zh") {
    const rest = parts.slice(1).map((p) => p.toLowerCase());
    if (rest.includes("hant") || rest.includes("tw") || rest.includes("hk") || rest.includes("mo")) return "zh-Hant";
    return "zh";
  }
  // Norveççe: Bokmål/Nynorsk tek "no" altında.
  if (base === "nb" || base === "nn") return "no";
  // Eski İbranice kodu.
  if (base === "iw") return "he";
  return base;
}

export function isTranslationLanguage(code: unknown): code is TranslationLanguage {
  return typeof code === "string" && (TRANSLATION_LANGUAGES as readonly string[]).includes(code);
}

/** Ayardan geçerli hedef dil: tanınan kod ya da arayüz dili. */
export function resolveTargetLanguage(preference: string | null | undefined, uiLocale: string): string {
  if (preference && preference !== TRANSLATION_TARGET_AUTO) {
    const code = normalizeLanguageTag(preference);
    if (code && isTranslationLanguage(code)) return code;
  }
  return normalizeLanguageTag(uiLocale) ?? "tr";
}

/** Ayarın saklanan biçimi: tanınmayan değer "auto". */
export function parseTargetPreference(raw: string | null | undefined): TranslationTargetPreference {
  if (!raw || raw === TRANSLATION_TARGET_AUTO) return TRANSLATION_TARGET_AUTO;
  const code = normalizeLanguageTag(raw);
  return code && isTranslationLanguage(code) ? code : TRANSLATION_TARGET_AUTO;
}

export function sameLanguage(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeLanguageTag(a);
  const y = normalizeLanguageTag(b);
  return Boolean(x && y && x === y);
}

/** Dil adı, arayüz dilinde ("en" → "İngilizce"). Intl yoksa kod. */
export function languageName(code: string, displayLocale: string): string {
  try {
    const names = new Intl.DisplayNames([displayLocale], { type: "language" });
    const name = names.of(code);
    if (name && name !== code) return name.charAt(0).toLocaleUpperCase(displayLocale) + name.slice(1);
  } catch {
    /* Intl.DisplayNames yok (eski motor). */
  }
  return code;
}

// ── Korunan parçalar ────────────────────────────────────────────────────

export type TranslationSegment = { kind: "text" | "keep"; value: string };

/**
 * Çeviriye girmeyecek parçalar, öncelik sırasıyla:
 *  - ``` kod bloğu ```, `satır içi kod`
 *  - <@id>, <@&id>, <#id>, <a:ad:id>, <:ad:id>, <t:123:R> gibi açılı etiketler
 *  - http(s) bağlantıları
 *  - @kullanıcı bahsetmeleri ve :emoji_adı: kısa kodları
 */
const KEEP_RE =
  /```[\s\S]*?```|`[^`\n]+`|<(?:@[!&]?|#|a?:[A-Za-z0-9_~]+:|t:)[^<>\s]*>|https?:\/\/[^\s<>]+|(?<![\p{L}\p{N}_])@[\p{L}\p{N}_.]+|:[A-Za-z0-9_+-]{2,32}:/gu;

/** Harf içermeyen metin (yalnızca boşluk, noktalama, emoji) çevrilmez. */
const HAS_LETTER_RE = /\p{L}/u;

export function splitForTranslation(text: string): TranslationSegment[] {
  const out: TranslationSegment[] = [];
  const push = (kind: TranslationSegment["kind"], value: string) => {
    if (!value) return;
    const effective = kind === "text" && !HAS_LETTER_RE.test(value) ? "keep" : kind;
    const last = out[out.length - 1];
    if (last && last.kind === effective) last.value += value;
    else out.push({ kind: effective, value });
  };
  let index = 0;
  for (const match of text.matchAll(KEEP_RE)) {
    const start = match.index ?? 0;
    push("text", text.slice(index, start));
    push("keep", match[0]);
    index = start + match[0].length;
  }
  push("text", text.slice(index));
  return out;
}

export function joinSegments(segments: TranslationSegment[]): string {
  return segments.map((s) => s.value).join("");
}

/** Çevrilecek düz metin var mı (yalnızca bağlantı/emoji/kod ise yok). */
export function hasTranslatableText(text: string | null | undefined): boolean {
  if (!text) return false;
  return splitForTranslation(text).some((s) => s.kind === "text");
}

/** Dil algılamaya verilecek metin: korunan parçalar atılır. */
export function detectionSample(text: string): string {
  return splitForTranslation(text)
    .filter((s) => s.kind === "text")
    .map((s) => s.value)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

// ── Önbellek ────────────────────────────────────────────────────────────

/** FNV-1a 32 bit — önbellek anahtarı için içerik özeti (güvenlik değil). */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export type CachedTranslation =
  | { kind: "translated"; text: string; source: string; target: string }
  | { kind: "same"; source: string; target: string };

/**
 * Bellek içi LRU önbellek. Anahtar mesaj kimliği + içerik özeti + hedef
 * dil: mesaj düzenlenince ya da hedef dil değişince eski sonuç kullanılmaz.
 * Kalıcı değil — sayfa/uygulama kapanınca silinir; içerik cihazdan çıkmaz.
 */
export class TranslationCache {
  private readonly map = new Map<string, CachedTranslation>();

  constructor(private readonly max = 300) {}

  static key(messageId: string, content: string, target: string): string {
    return `${messageId}\u0000${hashText(content)}\u0000${target}`;
  }

  get(messageId: string, content: string, target: string): CachedTranslation | undefined {
    const key = TranslationCache.key(messageId, content, target);
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
    }
    return hit;
  }

  set(messageId: string, content: string, target: string, value: CachedTranslation): void {
    const key = TranslationCache.key(messageId, content, target);
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

// ── Akış ────────────────────────────────────────────────────────────────

export type TranslationErrorCode =
  /** Bu cihazda/tarayıcıda çeviri API'si yok. */
  | "unsupported"
  /** Dil çifti desteklenmiyor. */
  | "unavailable"
  /** Kaynak dil algılanamadı. */
  | "undetected"
  /** Çevrilecek metin yok ya da çok uzun. */
  | "empty"
  | "failed";

export class TranslationError extends Error {
  constructor(readonly code: TranslationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "TranslationError";
  }
}

/** Platform motoru (tarayıcı Translator API, ML Kit, Apple Translation). */
export interface TranslationEngine {
  /** Kaynak dili algılar; emin değilse `null`. */
  detect(text: string): Promise<string | null>;
  /** `text`'i (korunan parça içermez) `source` → `target` çevirir. */
  translate(text: string, source: string, target: string): Promise<string>;
}

export interface TranslateMessageInput {
  engine: TranslationEngine;
  cache: TranslationCache;
  messageId: string;
  content: string;
  target: string;
}

/**
 * Önbellek → algıla → aynı dilse dokunma → yalnızca düz metin parçalarını
 * çevir → korunan parçalarla yeniden birleştir → önbelleğe yaz.
 */
export async function translateMessage(input: TranslateMessageInput): Promise<CachedTranslation> {
  const { engine, cache, messageId, content } = input;
  const target = normalizeLanguageTag(input.target) ?? input.target;
  const cached = cache.get(messageId, content, target);
  if (cached) return cached;

  if (!content || content.length > MAX_TRANSLATION_CHARS || !hasTranslatableText(content)) {
    throw new TranslationError("empty");
  }
  const sample = detectionSample(content);
  const detected = normalizeLanguageTag(await engine.detect(sample));
  if (!detected) throw new TranslationError("undetected");

  if (sameLanguage(detected, target)) {
    const same: CachedTranslation = { kind: "same", source: detected, target };
    cache.set(messageId, content, target, same);
    return same;
  }

  const segments = splitForTranslation(content);
  const translated: TranslationSegment[] = [];
  for (const segment of segments) {
    if (segment.kind === "keep") {
      translated.push(segment);
      continue;
    }
    // Baştaki/sondaki boşluk ve satır sonları motorda kaybolabilir; korunur.
    const lead = segment.value.match(/^\s*/)?.[0] ?? "";
    const trail = segment.value.slice(lead.length).match(/\s*$/)?.[0] ?? "";
    const core = segment.value.slice(lead.length, segment.value.length - trail.length);
    const result = await engine.translate(core, detected, target);
    translated.push({ kind: "text", value: lead + (typeof result === "string" && result ? result : core) + trail });
  }
  const value: CachedTranslation = { kind: "translated", text: joinSegments(translated), source: detected, target };
  cache.set(messageId, content, target, value);
  return value;
}
