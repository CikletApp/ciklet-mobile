/**
 * Ad stili (Discord "Görünen Ad Stili") — görünen adın yazı tipi + renk
 * efekti. ciklet-web `src/lib/name-style.ts` ile BİREBİR kimlikler ve
 * kurallar (zod'suz mobil kopyası; PATCH şeması sunucuda).
 *
 * Saklama: `Profile.nameStyle` → `{ font, effect, colors }`.
 *  - font: `NAME_FONTS` kimliği ya da null (uygulama yazı tipi);
 *  - effect: `NAME_EFFECTS` kimliği ya da null (rol/tema rengi);
 *  - colors: efektin renkleri (#rrggbb), efekte göre 0–3 tane.
 *
 * Kademeler: `free` herkes, `mentol` Mentol Plus+, `store` mağazadan
 * (ürün kimliği yazı tipi/efekt kimliğiyle AYNI). Yazı tipleri mobilde
 * expo-font ile aynı Google ailelerinden yüklenir (lib/name-fonts).
 *
 * Saf modül (RN içe aktarmaz) — scripts/verify-cosmetics.mjs doğrular.
 */

export type NameStyleTier = "free" | "mentol" | "store";

export interface NameFont {
  id: string;
  /** Vitrin adı (Türkçe). */
  name: string;
  /** Google Fonts aile adı. */
  family: string;
  tier: NameStyleTier;
  /** Görsel boyut düzeltmesi: geniş piksel yazılar küçülür, ince olanlar büyür. */
  scale?: number;
  /** Ağırlık (aile tek ağırlıksa yok). */
  weight?: number;
}

export const NAME_FONTS: readonly NameFont[] = [
  // Ücretsiz.
  { id: "nf_bungee", name: "Blok", family: "Bungee", tier: "free", scale: 0.9 },
  { id: "nf_pacifico", name: "Sahil", family: "Pacifico", tier: "free", scale: 0.95 },
  // Mentol (Plus+).
  { id: "nf_terminal", name: "Terminal", family: "VT323", tier: "mentol", scale: 1.3 },
  { id: "nf_orbit", name: "Yörünge", family: "Audiowide", tier: "mentol", scale: 0.95 },
  { id: "nf_comic", name: "Çizgi Roman", family: "Bangers", tier: "mentol", scale: 1.12 },
  { id: "nf_royal", name: "Kraliyet", family: "Cinzel Decorative", tier: "mentol", weight: 700, scale: 0.95 },
  { id: "nf_lobster", name: "Istakoz", family: "Lobster", tier: "mentol", scale: 1.05 },
  // Mağaza.
  { id: "nf_pixel", name: "Madenci", family: "Pixelify Sans", tier: "store", weight: 600, scale: 1.05 },
  { id: "nf_arcade", name: "Atari Salonu", family: "Press Start 2P", tier: "store", scale: 0.68 },
  { id: "nf_nightmare", name: "Kâbus", family: "Nosifer", tier: "store", scale: 0.8 },
  { id: "nf_glitch", name: "Bozuk Sinyal", family: "Rubik Glitch", tier: "store" },
  { id: "nf_neonsign", name: "Neon Tabela", family: "Monoton", tier: "store", scale: 0.92 },
  { id: "nf_wetpaint", name: "Yaş Boya", family: "Rubik Wet Paint", tier: "store" },
  { id: "nf_gothic", name: "Gotik", family: "Grenze Gotisch", tier: "store", weight: 700, scale: 1.08 },
];

export type NameEffectKind = "solid" | "gradient" | "shimmer" | "neon" | "rainbow";

export interface NameEffect {
  id: string;
  name: string;
  kind: NameEffectKind;
  tier: NameStyleTier;
  /** Kaç renk alır (en az / en çok). */
  minColors: number;
  maxColors: number;
  /** Renk verilmemişse kullanılanlar. */
  defaultColors: readonly string[];
  animated: boolean;
}

export const NAME_EFFECTS: readonly NameEffect[] = [
  { id: "ne_solid", name: "Düz Renk", kind: "solid", tier: "free", minColors: 1, maxColors: 1, defaultColors: ["#4ade80"], animated: false },
  { id: "ne_gradient", name: "Gradyan", kind: "gradient", tier: "mentol", minColors: 2, maxColors: 3, defaultColors: ["#c6f432", "#9b5cff"], animated: false },
  { id: "ne_shimmer", name: "Parıltı", kind: "shimmer", tier: "store", minColors: 2, maxColors: 3, defaultColors: ["#ffd54f", "#ff8a3d"], animated: true },
  { id: "ne_neon", name: "Neon Nabız", kind: "neon", tier: "store", minColors: 1, maxColors: 1, defaultColors: ["#ff40ec"], animated: true },
  { id: "ne_rainbow", name: "Gökkuşağı", kind: "rainbow", tier: "store", minColors: 0, maxColors: 0, defaultColors: [], animated: true },
];

/** Gökkuşağı efektinin sabit renkleri (web `.ns-rainbow`). */
export const RAINBOW_COLORS: readonly string[] = ["#ff4d4d", "#ffb347", "#ffe14d", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6", "#ff4d4d"];

/** Hazır renk paleti (seçicide). */
export const NAME_COLOR_PALETTE: readonly string[] = [
  "#ffffff", "#ff5c5c", "#ff8a3d", "#ffd54f", "#c6f432", "#4ade80", "#2dd4bf",
  "#38bdf8", "#6366f1", "#9b5cff", "#e879f9", "#ff6fb5", "#a3a3a3", "#1f2937",
];

export const NAME_STYLE_MAX_COLORS = 3;

export type NameStyle = {
  font: string | null;
  effect: string | null;
  colors: string[];
};

const HEX = /^#[0-9a-f]{6}$/;

export function findNameFont(id: string | null | undefined): NameFont | null {
  if (!id) return null;
  return NAME_FONTS.find((f) => f.id === id) ?? null;
}

export function findNameEffect(id: string | null | undefined): NameEffect | null {
  if (!id) return null;
  return NAME_EFFECTS.find((e) => e.id === id) ?? null;
}

/** Renkleri efektin istediği sayıya getirir: fazlası atılır, eksik varsayılandan tamamlanır. */
function fitColors(effect: NameEffect | null, colors: readonly string[]): string[] {
  if (!effect || effect.maxColors === 0) return [];
  const out = colors.slice(0, effect.maxColors);
  for (let i = out.length; i < effect.minColors; i++) {
    out.push(effect.defaultColors[i] ?? effect.defaultColors[0] ?? "#ffffff");
  }
  return out;
}

/**
 * Herhangi bir değeri (API yanıtı, ağ geçidi yükü) güvenli bir ad stiline
 * çevirir. Bilinmeyen yazı tipi/efekt atılır, renkler yalnızca küçük harf
 * #rrggbb; geriye bir şey kalmazsa null. Çizen her yer bundan geçer.
 */
export function parseNameStyle(value: unknown): NameStyle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const font = findNameFont(typeof raw.font === "string" ? raw.font : null);
  const effect = findNameEffect(typeof raw.effect === "string" ? raw.effect : null);
  if (!font && !effect) return null;
  const colors = Array.isArray(raw.colors)
    ? raw.colors
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.toLowerCase())
        .filter((c) => HEX.test(c))
    : [];
  return { font: font?.id ?? null, effect: effect?.id ?? null, colors: fitColors(effect, colors) };
}

export function sameNameStyle(a: NameStyle | null, b: NameStyle | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.font === b.font && a.effect === b.effect && a.colors.join() === b.colors.join();
}

export type NameStyleAccess = "ok" | "unknown" | "mentol_required" | "not_owned";

/** Bir yazı tipi/efekt kimliği takılabilir mi? (asıl denetim sunucuda.) */
export function nameStyleItemAccess(id: string, viewer: { mentol: boolean; owned: boolean }): NameStyleAccess {
  const item = findNameFont(id) ?? findNameEffect(id);
  if (!item) return "unknown";
  if (item.tier === "mentol" && !viewer.mentol) return "mentol_required";
  if (item.tier === "store" && !viewer.owned) return "not_owned";
  return "ok";
}

/**
 * Kaydetmeden önce kilit denetimi: yalnızca DEĞİŞEN kimlikler (sunucuyla
 * aynı kural — Mentol'ü biten kullanıcı eski gradyanını korur).
 */
export function changedNameStyleIds(next: NameStyle | null, saved: NameStyle | null): string[] {
  if (!next) return [];
  return [next.font, next.effect].filter((id): id is string => !!id && id !== saved?.font && id !== saved?.effect);
}

// ── Çizim ─────────────────────────────────────────────────────────────

/** sRGB göreli parlaklık (0–1). */
export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * Okunurluk halesi: renkler çok koyuysa açık, çok açıksa koyu ince bir hale
 * (web ile aynı eşikler). Arada kalan renkler iki temada da okunur.
 */
export function nameStyleHalo(colors: readonly string[]): "light" | "dark" | null {
  if (colors.length === 0) return null;
  const avg = colors.reduce((sum, c) => sum + relativeLuminance(c), 0) / colors.length;
  if (avg < 0.05) return "light";
  if (avg > 0.75) return "dark";
  return null;
}

export interface NameStylePresentation {
  font: NameFont | null;
  effect: NameEffect | null;
  /** Düz/neon renk (rol rengini ezer); gradyan efektlerde yok. */
  color: string | null;
  /** Gradyan durakları (gradyan / parıltı / gökkuşağı); parıltıda ilk renk sona eklenir. */
  gradient: string[] | null;
  halo: "light" | "dark" | null;
  /** Yazı tipi ölçeği (1 = değişmez). */
  scale: number;
}

/**
 * Stili çizim kararlarına çevirir (components/ui/styled-name, saf —
 * testlenir). Efekt yoksa renk yok: rol rengi/tema rengi kalır.
 */
export function nameStylePresentation(style: NameStyle | null): NameStylePresentation {
  const font = findNameFont(style?.font);
  const effect = findNameEffect(style?.effect);
  const colors = style?.colors ?? [];
  let color: string | null = null;
  let gradient: string[] | null = null;
  if (effect?.kind === "solid" || effect?.kind === "neon") color = colors[0] ?? effect.defaultColors[0] ?? null;
  if (effect?.kind === "gradient") gradient = colors.length >= 2 ? [...colors] : [...effect.defaultColors];
  if (effect?.kind === "shimmer") {
    const base = colors.length >= 2 ? colors : effect.defaultColors;
    gradient = [...base, base[0]];
  }
  if (effect?.kind === "rainbow") gradient = [...RAINBOW_COLORS];
  const halo = effect && effect.kind !== "rainbow" ? nameStyleHalo(colors) : null;
  return { font, effect, color, gradient, halo, scale: font?.scale ?? 1 };
}
