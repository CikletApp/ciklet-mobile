import { useCallback } from "react";

import { usePreferences } from "@/stores/preferences";
import { formatMessage, type MessageVars } from "./message-format";
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  INTL_LOCALES,
  isLocale,
  matchLocaleTag,
  type LazyLocale,
  type Locale,
} from "./locales";
import { en } from "./messages/en";
import { tr, type Messages } from "./messages/tr";
import type { Translation } from "./messages/translation";

/**
 * Dil altyapısı — bağımlılıksız, tipli sözlük (web `lib/i18n` deseni).
 *
 *  - Kaynak dil Türkçe (messages/tr.ts); anahtar şekli oradan türer.
 *  - Anahtar nokta yolu: `t("settings.rows.account")`; yanlış anahtar
 *    derleme hatası.
 *  - Türkçe + İngilizce hemen hazır; diğer diller (messages/locales/<dil>/)
 *    ilk kullanıldıklarında `require` ile değerlendirilir (açılışta
 *    yalnızca seçili dil işlenir).
 *  - Eksik çeviri (anahtar yok) İngilizceye, o da yoksa Türkçeye düşer.
 *  - Çoğul: ICU `{count, plural, one {…} other {…}}` (message-format.ts).
 *  - Tercih tercihler deposunda (`locale`); "system" cihaz dilini izler,
 *    cihaz dili desteklenmiyorsa İngilizce (web'deki Accept-Language ile aynı).
 *
 * Geçiş kademeli: metinler sözlüğe taşındıkça çevrilir; taşınmamış metin
 * Türkçe kalır.
 */
export {
  LOCALES,
  LOCALE_NAMES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  INTL_LOCALES,
  isLocale,
  isRtlLocale,
  localeDirection,
  matchLocaleTag,
  type Locale,
} from "./locales";

export type LocalePreference = "system" | Locale;

type Dictionary = Translation<Messages>;

const DICTIONARIES: Partial<Record<Locale, Dictionary>> = { tr, en };

/* eslint-disable @typescript-eslint/no-require-imports */
const LOADERS: Record<LazyLocale, () => Dictionary> = {
  de: () => require("./messages/locales/de").messages,
  fr: () => require("./messages/locales/fr").messages,
  "es-ES": () => require("./messages/locales/es-ES").messages,
  "pt-BR": () => require("./messages/locales/pt-BR").messages,
  ru: () => require("./messages/locales/ru").messages,
  it: () => require("./messages/locales/it").messages,
  pl: () => require("./messages/locales/pl").messages,
  az: () => require("./messages/locales/az").messages,
  ar: () => require("./messages/locales/ar").messages,
  ja: () => require("./messages/locales/ja").messages,
  ko: () => require("./messages/locales/ko").messages,
  "zh-CN": () => require("./messages/locales/zh-CN").messages,
  uk: () => require("./messages/locales/uk").messages,
  nl: () => require("./messages/locales/nl").messages,
};
/* eslint-enable @typescript-eslint/no-require-imports */

function dictionary(locale: Locale): Dictionary | undefined {
  let dict = DICTIONARIES[locale];
  if (!dict && locale in LOADERS) {
    dict = LOADERS[locale as LazyLocale]();
    DICTIONARIES[locale] = dict;
  }
  return dict;
}

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

/**
 * Cihaz dili. `expo-localization` bağımlılığı yerine Hermes'in `Intl`
 * uygulaması: varsayılan yerel ayar işletim sisteminin dilidir.
 * Desteklenmeyen dil İngilizce; okunamazsa Türkçe.
 */
export function deviceLocale(): Locale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    if (tag) return matchLocaleTag(tag) ?? FALLBACK_LOCALE;
  } catch {
    /* Intl yoksa varsayılan. */
  }
  return DEFAULT_LOCALE;
}

export function resolveLocale(preference: LocalePreference | null | undefined): Locale {
  return isLocale(preference) ? preference : deviceLocale();
}

function lookup(dict: Dictionary | undefined, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  // Boş dize bilinçli olabilir (söz dizimi); anahtar yoksa yedeğe düşülür.
  return typeof node === "string" ? node : undefined;
}

export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const chain: Locale[] = locale === "tr" ? ["tr", FALLBACK_LOCALE] : [locale, FALLBACK_LOCALE, "tr"];
  for (const candidate of chain) {
    const text = lookup(dictionary(candidate), key);
    if (text !== undefined) return formatMessage(text, vars, INTL_LOCALES[candidate]);
  }
  return key;
}

export type Translator = (key: MessageKey, vars?: MessageVars) => string;

export function translator(locale: Locale): Translator {
  return (key, vars) => translate(locale, key, vars);
}

/** Etkin dil; tercih değişince bileşen yeniden çizilir. */
export function useLocale(): Locale {
  const preference = usePreferences((state) => state.locale);
  return resolveLocale(preference);
}

/** Bileşen içinde çeviri: `const t = useT(); t("tabs.chats")`. */
export function useT(): Translator {
  const locale = useLocale();
  return useCallback<Translator>((key, vars) => translate(locale, key, vars), [locale]);
}

/** React dışı çağrılar (bildirim metinleri vb.) için anlık çevirici. */
export function currentTranslator(): Translator {
  return translator(resolveLocale(usePreferences.getState().locale));
}
