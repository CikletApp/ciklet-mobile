import { useCallback } from "react";

import { usePreferences } from "@/stores/preferences";
import { en } from "./messages/en";
import { tr, type Messages } from "./messages/tr";

/**
 * Dil altyapısı — bağımlılıksız, tipli sözlük (web `lib/i18n` deseni).
 *
 *  - Kaynak dil Türkçe (messages/tr.ts); diğer diller aynı şekli taşır.
 *  - Anahtar nokta yolu: `t("settings.rows.account")`; yanlış anahtar
 *    derleme hatası.
 *  - Eksik çeviri (çalışma zamanında boş dize) Türkçeye düşer.
 *  - Tercih tercihler deposunda (`locale`); "system" cihaz dilini izler,
 *    cihaz dili desteklenmiyorsa Türkçe.
 *
 * Geçiş kademeli: metinler sözlüğe taşındıkça çevrilir; taşınmamış metin
 * Türkçe kalır. İlk etapta sekme çubuğu ve ayar ekranları taşındı.
 */
export const LOCALES = ["tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type LocalePreference = "system" | Locale;
export const DEFAULT_LOCALE: Locale = "tr";

export const LOCALE_NAMES: Record<Locale, string> = { tr: "Türkçe", en: "English" };

const DICTIONARIES: Record<Locale, Messages> = { tr, en };

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Cihaz dili. `expo-localization` bağımlılığı yerine Hermes'in `Intl`
 * uygulaması: varsayılan yerel ayar işletim sisteminin dilidir.
 */
export function deviceLocale(): Locale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  } catch {
    /* Intl yoksa varsayılan. */
  }
  return DEFAULT_LOCALE;
}

export function resolveLocale(preference: LocalePreference | null | undefined): Locale {
  return isLocale(preference) ? preference : deviceLocale();
}

function lookup(dict: Messages, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" && node ? node : undefined;
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = lookup(DICTIONARIES[locale] ?? tr, key) ?? lookup(tr, key) ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string;

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
