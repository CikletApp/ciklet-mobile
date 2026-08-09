import { fontFamily } from "./fonts";

/**
 * Ciklet tasarım token'ları.
 *
 * Renkler `ciklet-web/src/app/theme.css` ile BİREBİR aynı HSL bileşenlerinden
 * üretilir; iki istemcinin markası tek kaynaktan sürer. Değerler HSL
 * dizesi olarak tutulur (React Native `hsl(h, s%, l%)` biçimini doğrudan
 * ayrıştırır) — böylece hex'e elle çevirirken oluşan sapma riski yoktur.
 *
 * ⚠️ Bu dosyadaki hiçbir renk üçüncü taraf bir platformdan alınmamıştır.
 * (Önceki iskeletteki #111214 / #1e1f22 / #2b2d31 / #d3be01 değerleri
 * Ciklet paletine ait DEĞİLDİ ve kaldırılmıştır.)
 */

const hsl = (h: number, s: number, l: number, alpha?: number) =>
  alpha === undefined ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${alpha})`;

// ── Marka (tüm temalarda sabit) ─────────────────────────────────────

export const brand = {
  /** Ciklet lime — birincil eylem rengi. */
  primary: "#98cb00",
  /** Ciklet camgöbeği — vurgular, bağlantılar. */
  secondary: "#45f3ff",
} as const;

// ── Tema paletleri ──────────────────────────────────────────────────

export interface ThemePalette {
  /** Uygulama zemini. */
  bg: string;
  /** Zeminden daha koyu katman (kenar çubuğu arkası, modal örtüsü altı). */
  deep: string;
  /** Kart / panel yüzeyi. */
  panel: string;
  /** Yükseltilmiş yüzey (girdi alanı, basılı hâl). */
  raised: string;
  /** Ayraç ve kenarlık. */
  border: string;
  /** En yüksek kontrastlı metin (başlıklar). */
  bright: string;
  /** Gövde metni. */
  text: string;
  /** İkincil metin, yer tutucu. */
  muted: string;
  /** Etkileşimli marka rengi (tema başına okunabilirlik için ayarlanır). */
  brand: string;
  /** Marka üzerine gelen metin — kontrast için. */
  onBrand: string;
  danger: string;
  success: string;
  warning: string;
  /** Presence renkleri. */
  online: string;
  idle: string;
  dnd: string;
  offline: string;
  /** Kendi gönderdiğin mesajın baloncuğu — marka renginin soluk hâli. */
  bubbleOwn: string;
  /** Karşı tarafın baloncuğu. */
  bubbleOther: string;
  /** Zengin durum vurgusu ("… Oynuyor"). */
  accent: string;
  /** Bento kartlarının yüzeyi (web: --bento-item). */
  bento: string;
  /** Bento kabuğunun zemini (web: --main-bg). Kartlardan bir tık koyu. */
  bentoShell: string;
  /** Bento kartlarının ince kenarlığı. */
  bentoBorder: string;
  /** Modal ve medya üzeri karartma yüzeyi. */
  scrim: string;
  /** Native gölge renk değeri. */
  shadow: string;
  /** Fotoğraf/logo tabanlı canlı kartların yüksek kontrast metni. */
  mediaText: string;
  mediaMuted: string;
  mediaScrim: string;
  mediaButtonText: string;
}

export type ThemeId = "night" | "mist" | "oled" | "light";

/** Gece — varsayılan koyu tema (web ile aynı). */
const night: ThemePalette = {
  bg: hsl(225, 8, 9),
  deep: hsl(228, 10, 6),
  panel: hsl(225, 6, 13),
  raised: hsl(225, 6, 17),
  border: hsl(225, 6, 17),
  bright: hsl(0, 0, 98),
  text: hsl(210, 9, 82),
  muted: hsl(210, 8, 58),
  brand: hsl(74, 100, 40),
  onBrand: hsl(228, 10, 6),
  danger: hsl(0, 78, 60),
  success: hsl(145, 62, 42),
  warning: hsl(40, 86, 57),
  online: hsl(145, 62, 42),
  idle: hsl(40, 86, 57),
  dnd: hsl(0, 78, 60),
  offline: hsl(210, 8, 45),
  bubbleOwn: hsl(74, 100, 40, 0.18),
  bubbleOther: hsl(225, 6, 16),
  accent: "#45f3ff",
  bento: "#232428",
  bentoBorder: "rgba(250, 250, 250, 0.05)",
  bentoShell: "#131417",
  scrim: "rgba(6, 7, 9, 0.62)",
  shadow: "rgba(0, 0, 0, 0.28)",
  mediaText: "#ffffff",
  mediaMuted: "rgba(255, 255, 255, 0.72)",
  mediaScrim: "rgba(0, 0, 0, 0.25)",
  mediaButtonText: "#111214",
};

/** Sis — yumuşak, gri tonlu koyu tema. */
const mist: ThemePalette = {
  ...night,
  bg: hsl(225, 6, 20),
  deep: hsl(225, 7, 17),
  panel: hsl(225, 6, 23),
  raised: hsl(225, 5, 30),
  border: hsl(225, 5, 30),
  text: hsl(220, 9, 85),
  muted: hsl(222, 9, 74),
  brand: hsl(74, 100, 42),
  danger: hsl(0, 78, 63),
  success: hsl(145, 60, 45),
  warning: hsl(40, 88, 58),
  online: hsl(145, 60, 45),
  idle: hsl(40, 88, 58),
  dnd: hsl(0, 78, 63),
  offline: hsl(222, 9, 55),
  bubbleOwn: hsl(74, 100, 42, 0.2),
  bubbleOther: hsl(225, 6, 27),
  accent: "#45f3ff",
  bento: "#383a40",
  bentoBorder: "rgba(250, 250, 250, 0.06)",
  bentoShell: "#313338",
  scrim: "rgba(23, 24, 28, 0.62)",
  shadow: "rgba(0, 0, 0, 0.24)",
};

/** Zifir — OLED ekranlarda pil dostu saf siyah. */
const oled: ThemePalette = {
  ...night,
  bg: hsl(0, 0, 0),
  deep: hsl(0, 0, 0),
  panel: hsl(0, 0, 5),
  raised: hsl(0, 0, 12),
  border: hsl(0, 0, 12),
  text: hsl(0, 0, 80),
  muted: hsl(0, 0, 55),
  brand: hsl(74, 100, 42),
  onBrand: hsl(0, 0, 0),
  danger: hsl(0, 78, 58),
  success: hsl(145, 62, 42),
  warning: hsl(40, 86, 57),
  online: hsl(145, 62, 42),
  idle: hsl(40, 86, 57),
  dnd: hsl(0, 78, 58),
  offline: hsl(0, 0, 40),
  bubbleOwn: hsl(74, 100, 42, 0.2),
  bubbleOther: hsl(0, 0, 9),
  accent: "#45f3ff",
  bento: "#0e0e0e",
  bentoBorder: "rgba(250, 250, 250, 0.07)",
  bentoShell: "#000000",
  scrim: "rgba(0, 0, 0, 0.72)",
  shadow: "rgba(0, 0, 0, 0.42)",
};

/** Aydınlık. */
const light: ThemePalette = {
  bg: "#f7f7f8",
  deep: "#f2f3f5",
  panel: "#ffffff",
  raised: "#f0f0f2",
  border: "#e0e0e4",
  bright: hsl(240, 10, 4),
  text: hsl(240, 6, 18),
  muted: "#46545a",
  brand: hsl(74, 100, 34),
  onBrand: "#ffffff",
  danger: hsl(0, 74, 52),
  success: hsl(145, 63, 36),
  warning: hsl(40, 90, 45),
  online: hsl(145, 63, 36),
  idle: hsl(40, 90, 45),
  dnd: hsl(0, 74, 52),
  offline: "#8b949c",
  bubbleOwn: "rgba(152, 203, 0, 0.22)",
  bubbleOther: "#ececed",
  accent: "#0f7f8c",
  bento: "#eaeaea",
  bentoBorder: "rgba(0, 0, 0, 0.05)",
  bentoShell: "#f7f7f8",
  scrim: "rgba(20, 22, 26, 0.38)",
  shadow: "rgba(16, 18, 22, 0.18)",
  mediaText: "#ffffff",
  mediaMuted: "rgba(255, 255, 255, 0.72)",
  mediaScrim: "rgba(0, 0, 0, 0.25)",
  mediaButtonText: "#111214",
};

export const themes: Record<ThemeId, ThemePalette> = { night, mist, oled, light };

export const DEFAULT_THEME: ThemeId = "night";

/**
 * Faz 1'de tek tema aktiftir; tema seçici Faz 2'de (Ayarlar → Görünüm)
 * bu kaydı okuyacak. Navigator seçenekleri ve StyleSheet'ler bu nesneyi
 * kullanır — `className` kullanamayan her yer.
 */
/**
 * Etkin paletin kimliği. Renk nesnesi bir Proxy olduğu için mevcut
 * bileşenlerin `colors.bg` kullanımı değişmeden, tema geçişinde yeni paleti
 * okur. Kök tema store'u değiştiğinde tüm uygulama yeniden render edilir.
 */
let activeThemeId: ThemeId = DEFAULT_THEME;

export function setActiveTheme(themeId: ThemeId) {
  activeThemeId = themeId;
}

export const colors = new Proxy({} as ThemePalette, {
  get: (_target, property: keyof ThemePalette) =>
    themes[activeThemeId][property],
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
  displayLg: { fontSize: 28, lineHeight: 34, fontWeight: "700", get fontFamily() { return fontFamily(700); } },
  display: { fontSize: 22, lineHeight: 28, fontWeight: "700", get fontFamily() { return fontFamily(700); } },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "600", get fontFamily() { return fontFamily(600); } },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400", get fontFamily() { return fontFamily(400); } },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600", get fontFamily() { return fontFamily(600); } },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400", get fontFamily() { return fontFamily(400); } },
  /** Bölüm başlıkları — büyük harf, aralıklı. */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.6,
    get fontFamily() { return fontFamily(700); },
  },
} as const;

/** Erişilebilirlik: dokunma hedefi asla bunun altına inmemeli. */
export const MIN_TOUCH_TARGET = 44;
