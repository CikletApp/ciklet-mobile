/**
 * Tema kaydı ve renk türetimi — ciklet-web ile BİREBİR.
 *
 * Kaynak: `ciklet-web/src/lib/themes.ts` (7 hazır atmosfer) ve
 * `ciklet-web/src/lib/theme-palette.ts` (`buildThemeVariables`). Web bir
 * temayı beş renkle tanımlıyor (zemin, menü, sohbet, panel, vurgu); geri
 * kalan her şey — metin, soluk metin, kenarlık, vurgunun okunur hâli —
 * bu beş renkten KONTRASTA bakılarak hesaplanıyor. Mobil aynı hesabı aynı
 * sabitlerle yapar; böylece "Ametist" iki istemcide aynı mor, kullanıcının
 * özel paleti de aynı kontrast kurallarıyla okunur kalır.
 *
 * Buradaki bir sayıyı değiştirmeden önce web'deki karşılığına bak: iki
 * istemcinin ayrışması, aynı hesapta farklı renk görmek demek.
 */

export type ThemeId = "amethyst" | "night" | "mist" | "light" | "oled" | "ocean" | "forest";
export type ThemePreference = ThemeId | "system";

/** Bir temanın beş kaynak rengi (web: `ThemePalette`). */
export interface ThemeSource {
  /** Ana zemin — en dış katman. */
  canvas: string;
  /** Menüler: gezinme, sohbet ve kanal listeleri. */
  menu: string;
  /** Mesajların bulunduğu alan. */
  chat: string;
  /** Kartlar, başlıklar, ayar yüzeyleri. */
  panel: string;
  /** Seçimler ve renkli detaylar. */
  accent: string;
}

export type CustomColors = Partial<ThemeSource>;
export const COLOR_FIELDS = ["canvas", "menu", "chat", "panel", "accent"] as const;

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** Kart altındaki kısa tür etiketi (web ile aynı metin). */
  kind: string;
  source: ThemeSource;
}

const define = (id: ThemeId, label: string, description: string, source: ThemeSource, kind = "Koyu tema"): ThemeMeta => ({
  id,
  label,
  description,
  kind,
  source,
});

export const THEMES: ThemeMeta[] = [
  define("amethyst", "Ametist", "Ciklet moru. Kendine ait bir atmosfer.", { canvas: "#120d1d", menu: "#1a1228", chat: "#21182f", panel: "#2a203a", accent: "#b28af0" }, "Ciklet’in rengi"),
  define("night", "Gece", "Dingin, dengeli ve derin.", { canvas: "#101117", menu: "#161820", chat: "#1d2029", panel: "#252934", accent: "#b0cf78" }),
  define("mist", "Sis", "Yumuşak grafit ve lavanta tonları.", { canvas: "#24252e", menu: "#2c2d39", chat: "#343541", panel: "#3e404e", accent: "#c5b1ef" }),
  define("light", "Porselen", "Aydınlık bir zemin, hafif mor dokunuşlar.", { canvas: "#eeebf4", menu: "#f2eff8", chat: "#fcfbff", panel: "#ffffff", accent: "#6010c9" }, "Açık tema"),
  define("oled", "Obsidyen", "Koyu ve sade, siyah deliğe dönüşmeyen derinlik.", { canvas: "#000000", menu: "#050507", chat: "#09090d", panel: "#121218", accent: "#b8d883" }, "Saf siyah"),
  define("ocean", "Okyanus", "Gece mavisi ve ferah turkuaz.", { canvas: "#0c151e", menu: "#111e2a", chat: "#182837", panel: "#203444", accent: "#72d6d0" }),
  define("forest", "Orman", "Koyu yeşilin sakinliği, lime’ın enerjisi.", { canvas: "#101813", menu: "#17231b", chat: "#1d2d24", panel: "#293a2f", accent: "#b7d879" }),
];

export const THEME_IDS: ThemeId[] = THEMES.map((theme) => theme.id);
export const DEFAULT_THEME: ThemeId = "amethyst";

export function getTheme(id: ThemeId): ThemeMeta {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as string[]).includes(value);
}

export function normalizeCustomColors(value: unknown): CustomColors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: CustomColors = {};
  for (const field of COLOR_FIELDS) {
    const color = (value as Record<string, unknown>)[field];
    if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) result[field] = color.toLowerCase();
  }
  return result;
}

// ── Renk matematiği (web `buildThemeVariables` içindekiyle aynı) ─────

const rgb = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

/** İki hex rengi `amount` oranında karıştırır (0 → first, 1 → second). */
export function mix(first: string, second: string, amount: number): string {
  const a = rgb(first);
  const b = rgb(second);
  return "#" + a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, "0")).join("");
}

/** Hex rengi saydamlıkla `rgba()` dizesine çevirir. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const luminance = (hex: string) =>
  rgb(hex)
    .map((value) => value / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);

export const contrast = (a: string, b: string) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

const INK_LIGHT = "#f7f5fc";
const INK_DARK = "#171220";

/** Zeminin üstünde en okunur mürekkep: açık ya da koyu. */
export const ink = (background: string) =>
  contrast(background, INK_LIGHT) >= contrast(background, INK_DARK) ? INK_LIGHT : INK_DARK;

/** Rengi, zeminde en az 4.5:1 kontrast verene kadar mürekkebe doğru iter. */
export function readable(color: string, background: string): string {
  const target = ink(background);
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, target, step / 20);
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return target;
}

const hsl = (h: number, s: number, l: number) => `hsl(${h}, ${s}%, ${l}%)`;

// ── Mobil paleti ───────────────────────────────────────────────────

export interface ThemePalette {
  /** Açık/koyu ayrımı — tema KİMLİĞİNE değil buna bakılır (özel palet Porselen'i koyulaştırabilir). */
  scheme: "light" | "dark";
  /** Ana zemin (web: canvas / --main-bg). */
  canvas: string;
  /** Liste ekranlarının zemini (web: menu bölgesi). `bg` ile aynı. */
  menu: string;
  /** Sohbet ekranının zemini (web: chat bölgesi). */
  chat: string;
  /** Uygulama zemini — liste ve ayar ekranları. */
  bg: string;
  /** Zeminden daha koyu gömme yüzey (girdi, kod bloğu, medya yer tutucu). */
  deep: string;
  /** Kart / panel yüzeyi. */
  panel: string;
  /** Yükseltilmiş yüzey (basılı hâl, çip, ikincil düğme). */
  raised: string;
  /** Ayraç ve kenarlık. */
  border: string;
  /** En yüksek kontrastlı metin (başlıklar). */
  bright: string;
  /** Gövde metni. */
  text: string;
  /** İkincil metin, yer tutucu. */
  muted: string;
  /** Vurgu rengi — zeminde okunur hâli (web: --appearance-accent-readable). */
  brand: string;
  /** Vurgunun üstündeki metin. */
  onBrand: string;
  /** Vurgunun yüzeye karışmış hafif tonu (seçili satır, aktif çip). */
  brandSoft: string;
  danger: string;
  success: string;
  warning: string;
  online: string;
  idle: string;
  dnd: string;
  offline: string;
  /** Kendi gönderdiğin mesajın baloncuğu. */
  bubbleOwn: string;
  /** Karşı tarafın baloncuğu. */
  bubbleOther: string;
  /** İkincil vurgu — zengin durum ("… Oynuyor"), bağlantılar. */
  accent: string;
  /** Bento kartlarının yüzeyi (web: --bento-item). */
  bento: string;
  /** Bento kabuğunun zemini (web: --main-bg). */
  bentoShell: string;
  /** Bento kartlarının ince kenarlığı. */
  bentoBorder: string;
  /** Modal ve medya üzeri karartma. */
  scrim: string;
  /** Native gölge rengi. */
  shadow: string;
  /** Fotoğraf/logo üstündeki metin — temadan bağımsız. */
  mediaText: string;
  mediaMuted: string;
  mediaScrim: string;
  mediaButtonText: string;
}

/** Ciklet camgöbeği — ikincil vurgunun kaynağı. */
const CYAN = "#45f3ff";

/**
 * Beş kaynak renkten mobil paletini üretir.
 *
 * Metin ve vurgu PANEL'e göre hesaplanır (web'de de öyle), ardından menü
 * zeminine karşı bir kez daha okunur hâle getirilir: liste ekranları menü
 * renginde durduğu için açık temada panelde yeten kontrast menüde kalmayabilir.
 */
export function buildPalette(source: ThemeSource): ThemePalette {
  const { canvas, menu, chat, panel, accent } = source;
  const foreground = ink(panel);
  const light = foreground === INK_DARK;
  const muted = readable(readable(mix(panel, foreground, 0.64), panel), menu);
  const brand = readable(readable(accent, panel), menu);
  const danger = light ? hsl(0, 70, 44) : hsl(0, 80, 68);
  const success = light ? hsl(145, 60, 30) : hsl(145, 57, 57);
  const warning = light ? hsl(37, 90, 32) : hsl(42, 88, 63);

  return {
    scheme: light ? "light" : "dark",
    canvas,
    menu,
    chat,
    bg: menu,
    deep: light ? canvas : mix(canvas, menu, 0.35),
    panel,
    raised: mix(panel, foreground, light ? 0.06 : 0.07),
    border: mix(panel, foreground, 0.14),
    bright: foreground,
    text: mix(panel, foreground, 0.86),
    muted,
    brand,
    onBrand: ink(brand),
    brandSoft: mix(panel, accent, light ? 0.1 : 0.16),
    danger,
    success,
    warning,
    online: success,
    idle: warning,
    dnd: danger,
    offline: mix(panel, foreground, 0.42),
    bubbleOwn: mix(chat, accent, light ? 0.14 : 0.2),
    bubbleOther: mix(chat, foreground, light ? 0.05 : 0.07),
    accent: readable(CYAN, panel),
    bento: panel,
    bentoShell: canvas,
    bentoBorder: withAlpha(foreground, light ? 0.08 : 0.06),
    scrim: light ? "rgba(23, 18, 32, 0.38)" : withAlpha(canvas, 0.7),
    shadow: light ? "rgba(23, 18, 32, 0.14)" : "rgba(0, 0, 0, 0.34)",
    mediaText: "#ffffff",
    mediaMuted: "rgba(255, 255, 255, 0.72)",
    mediaScrim: "rgba(0, 0, 0, 0.25)",
    mediaButtonText: "#111214",
  };
}

/**
 * Tek bir bölgenin (menü, sohbet, panel) kendi zeminine göre okunur
 * renkleri — web'deki `--region-*` değişkenleri. Açık menü ile koyu sohbet
 * aynı paletteyse ikisi de kendi zemininde okunur kalır.
 */
export function buildRegion(background: string, accent: string) {
  const text = ink(background);
  return {
    bg: background,
    text,
    muted: readable(mix(background, text, 0.65), background),
    raised: mix(background, text, 0.045),
    border: mix(background, text, 0.15),
    accent: readable(accent, background),
  };
}
