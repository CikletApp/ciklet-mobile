/**
 * Web `lib/i18n/locales.ts` ile AYNI dil listesi (kopya) — web değişirse burası da.
 */
/**
 * Desteklenen arayüz dilleri ve dile bağlı sabitler. Bağımlılıksız; hem
 * sözlük çekirdeği (index.ts) hem biçimleyiciler (format.ts) buradan okur.
 *
 * Kimlikler Discord'un dil kodlarıyla aynı (`es-ES`, `pt-BR`, `zh-CN`),
 * çerezde ve `<html lang>`da bu biçimde durur.
 */
export const LOCALES = [
  "tr",
  "en",
  "de",
  "fr",
  "es-ES",
  "pt-BR",
  "ru",
  "it",
  "pl",
  "az",
  "ar",
  "ja",
  "ko",
  "zh-CN",
  "uk",
  "nl",
] as const;
export type Locale = (typeof LOCALES)[number];

/** Türkçe kaynak, İngilizce yedek — ikisi her pakette hazır; diğerleri tembel yüklenir. */
export type BundledLocale = "tr" | "en";
export type LazyLocale = Exclude<Locale, BundledLocale>;

export const DEFAULT_LOCALE: Locale = "tr";
/** Eksik çevirinin düştüğü dil (Türkçe hariç; Türkçe kendi kaynağıdır). */
export const FALLBACK_LOCALE: Locale = "en";

/** Dil seçicide her dil KENDİ adıyla görünür. */
export const LOCALE_NAMES: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  "es-ES": "Español",
  "pt-BR": "Português do Brasil",
  ru: "Русский",
  it: "Italiano",
  pl: "Polski",
  az: "Azərbaycan dili",
  ar: "العربية",
  ja: "日本語",
  ko: "한국어",
  "zh-CN": "中文（简体）",
  uk: "Українська",
  nl: "Nederlands",
};

/** Intl'e giden BCP 47 etiketi (tarih, sayı, çoğul kuralları). */
export const INTL_LOCALES: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  "es-ES": "es-ES",
  "pt-BR": "pt-BR",
  ru: "ru-RU",
  it: "it-IT",
  pl: "pl-PL",
  az: "az-Latn-AZ",
  ar: "ar",
  ja: "ja-JP",
  ko: "ko-KR",
  "zh-CN": "zh-CN",
  uk: "uk-UA",
  nl: "nl-NL",
};

/** Sağdan sola yazılan diller (`<html dir="rtl">`). */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(["ar"]);

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.has(locale);
}

export function localeDirection(locale: Locale): "rtl" | "ltr" {
  return isRtlLocale(locale) ? "rtl" : "ltr";
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Tek bir dil etiketini (tarayıcı / cihaz) desteklenen dile eşler:
 * tam eşleşme (büyük-küçük harf duyarsız), sonra ana dil. Geleneksel Çince
 * (zh-TW, zh-HK, zh-Hant) basitleştirilmişe eşlenmez.
 */
export function matchLocaleTag(tag: string | null | undefined): Locale | null {
  const clean = (tag ?? "").trim().replace(/_/g, "-").toLowerCase();
  if (!clean || clean === "*") return null;
  const exact = LOCALES.find((l) => l.toLowerCase() === clean);
  if (exact) return exact;
  const [base, ...rest] = clean.split("-");
  if (base === "zh" && rest.some((part) => part === "tw" || part === "hk" || part === "mo" || part === "hant")) return null;
  return LOCALES.find((l) => l.toLowerCase().split("-")[0] === base) ?? null;
}

/**
 * Accept-Language başlığındaki ilk desteklenen dil (q sırasıyla). Başlık
 * var ama hiçbir dil desteklenmiyorsa İngilizce (Discord'un varsayılanı);
 * başlık hiç yoksa null (çağıran varsayılan dile düşer).
 */
export function matchAcceptLanguage(acceptLanguage: string | null | undefined): Locale | null {
  const entries = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag?.trim() ?? "", weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.tag && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  if (entries.length === 0) return null;
  for (const entry of entries) {
    const locale = matchLocaleTag(entry.tag);
    if (locale) return locale;
  }
  return entries.some((entry) => entry.tag !== "*") ? FALLBACK_LOCALE : null;
}

/**
 * Yalnızca Türkçe + İngilizce içeriği olan yerler (yasal metinler, sunucu
 * duyuruları) için: Türkçe dışındaki her dil İngilizce içeriği okur.
 */
export function bundledLocale(locale: Locale): BundledLocale {
  return locale === "tr" ? "tr" : "en";
}
