import { fw } from "./fonts";
import {
  DEFAULT_THEME,
  THEMES,
  buildPalette,
  getTheme,
  normalizeCustomColors,
  type CustomColors,
  type ThemeId,
  type ThemePalette,
} from "./palette";

export {
  DEFAULT_THEME,
  THEMES,
  getTheme,
  type CustomColors,
  type ThemeId,
  type ThemePalette,
  type ThemePreference,
} from "./palette";

/**
 * Ciklet tasarım token'ları.
 *
 * Renkler `theme/palette.ts` içinde, ciklet-web'in tema kaydı
 * (`src/lib/themes.ts`) ve renk türetimiyle (`src/lib/theme-palette.ts`)
 * birebir aynı hesapla üretilir. Burada yalnızca etkin paletin tutulduğu
 * yer ve temadan bağımsız ölçekler var.
 */

// ── Marka (tüm temalarda sabit) ─────────────────────────────────────

export const brand = {
  /** Ciklet lime — logo ve bildirim ışığı. Tema vurgusu DEĞİL. */
  primary: "#98cb00",
  /** Ciklet camgöbeği. */
  secondary: "#45f3ff",
} as const;

// ── Tema paletleri ──────────────────────────────────────────────────

/** Hazır temaların özel renk uygulanmamış paletleri (önizleme kartları için). */
export const themes = Object.fromEntries(
  THEMES.map((theme) => [theme.id, buildPalette(theme.source)])
) as Record<ThemeId, ThemePalette>;

/**
 * Etkin palet. Renk nesnesi bir Proxy olduğu için bileşenlerin
 * `colors.bg` kullanımı değişmeden tema geçişinde yeni paleti okur. Kök
 * tema store'u değiştiğinde navigator ağacı anahtarla yeniden kurulur.
 */
let activePalette: ThemePalette = themes[DEFAULT_THEME];

export function setActiveTheme(themeId: ThemeId, custom: CustomColors = {}) {
  const clean = normalizeCustomColors(custom);
  activePalette = Object.keys(clean).length
    ? buildPalette({ ...getTheme(themeId).source, ...clean })
    : themes[themeId];
}

/** Etkin paletin anlık kopyası — düz nesne bekleyen API'ler için. */
export function getActivePalette(): ThemePalette {
  return activePalette;
}

export const colors = new Proxy({} as ThemePalette, {
  get: (_target, property: keyof ThemePalette) => activePalette[property],
});

// ── Ölçek ───────────────────────────────────────────────────────────

/** 4pt tabanlı aralık ölçeği. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  /** Bento kart yarıçapı — web'deki bento-item-radius (16px). */
  bento: 16,
  /** Bento kabuğunun dış yarıçapı — web'deki bento-wrapper-radius. */
  bentoWrapper: 28,
  full: 9999,
} as const;

/**
 * Tipografi. `lineHeight` değerleri Türkçe'nin uzun sözcükleri ve
 * ğ/ş/ç gibi alt-çıkıntılı harfleri için bilerek geniş tutuldu.
 */
export const typography = {
  displayLg: { fontSize: 28, lineHeight: 34, get fontWeight() { return fw(700).fontWeight; }, get fontFamily() { return fw(700).fontFamily; } },
  display: { fontSize: 22, lineHeight: 28, get fontWeight() { return fw(700).fontWeight; }, get fontFamily() { return fw(700).fontFamily; } },
  title: { fontSize: 17, lineHeight: 22, get fontWeight() { return fw(600).fontWeight; }, get fontFamily() { return fw(600).fontFamily; } },
  body: { fontSize: 15, lineHeight: 21, get fontWeight() { return fw(400).fontWeight; }, get fontFamily() { return fw(400).fontFamily; } },
  bodyStrong: { fontSize: 15, lineHeight: 21, get fontWeight() { return fw(600).fontWeight; }, get fontFamily() { return fw(600).fontFamily; } },
  caption: { fontSize: 13, lineHeight: 18, get fontWeight() { return fw(400).fontWeight; }, get fontFamily() { return fw(400).fontFamily; } },
  /** Bölüm başlıkları — büyük harf, aralıklı. */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    get fontWeight() { return fw(700).fontWeight; },
    get fontFamily() { return fw(700).fontFamily; },
  },
} as const;

/** Erişilebilirlik: dokunma hedefi asla bunun altına inmemeli. */
export const MIN_TOUCH_TARGET = 44;
