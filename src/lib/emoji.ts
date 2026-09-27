import { parse } from "@twemoji/parser";

import { API_BASE_URL } from "@/lib/config";

/**
 * Emoji — her yerde Twemoji (web'le aynı: ciklet-web `lib/twemoji.ts`).
 *
 * Telefonun kendi emoji yazı tipi KULLANILMIYOR: aynı emoji web'de Twemoji,
 * Android'de Google, iOS'ta Apple çizimiyle görünüyordu ve Dokimorji
 * bayrakları (özel kullanım alanı kod noktaları) hiçbir yazı tipinde yok —
 * mobilde boş kutu olarak çıkıyorlardı.
 *
 * Görseller web'in kullandığı CDN ve sürümden gelir; 72×72 PNG seçildi:
 * listede yüzlerce küçük emojiyi çizmek SVG'den ucuz. Görsel önbelleği işletim
 * sistemi tutuyor, bir kez inen emoji bir daha inmez.
 */

/** Web'le AYNI sürüm; değişirse iki taraf birlikte güncellenmeli. */
const TWEMOJI_PNG_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/72x72/";

export interface Dokimorji {
  id: string;
  /** Mesaj metnindeki karakter (Plane 15 özel kullanım alanı). */
  native: string;
  name: string;
  keywords: string[];
  /**
   * Seçicideki kategori (emoji-mart kimliği, ör. "flags"). Bayraklar Türk
   * bayrağının hemen arkasına yerleşir — web'le aynı.
   */
  category: string;
  /** Mutlak görsel adresi. */
  url: string;
}

/**
 * Yedek liste — web `components/emoji-picker.tsx` ile aynı beş bayrak.
 * Sunucu `/dokimorji/manifest.json` sunduğunda o geçerli olur (yeni
 * Dokimorji'ler uygulama güncellemesi gerektirmeden görünsün diye).
 */
const FALLBACK_ITEMS: (Omit<Dokimorji, "url"> & { path: string })[] = [
  { id: "flag-dt", category: "flags", native: "\u{F0001}", name: "Doğu Türkistan Bayrağı", keywords: ["doğu", "türkistan", "kökbayrak", "bayrak"], path: "/dokimorji/svg/dogu-turkistan.svg" },
  { id: "flag-kktc", category: "flags", native: "\u{F0002}", name: "Kuzey Kıbrıs Türk Cumhuriyeti Bayrağı", keywords: ["kuzey", "kıbrıs", "kktc", "bayrak"], path: "/dokimorji/svg/kktc.svg" },
  { id: "flag-osm", category: "flags", native: "\u{F0003}", name: "Osmanlı Bayrağı", keywords: ["osmanlı", "bayrak", "tarih"], path: "/dokimorji/svg/osmanli.svg" },
  { id: "flag-kayi", category: "flags", native: "\u{F0004}", name: "Kayı Boyu Bayrağı", keywords: ["kayı", "boyu", "bayrak", "tarih"], path: "/dokimorji/svg/kayi-boyu.svg" },
  { id: "flag-tdt", category: "flags", native: "\u{F0005}", name: "Türk Teşkilatı Bayrağı", keywords: ["türk", "teşkilat", "bayrak"], path: "/dokimorji/svg/turk-teskilati.svg" },
];

function absolute(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

let dokimorjiList: Dokimorji[] = FALLBACK_ITEMS.map(({ path, ...item }) => ({ ...item, url: absolute(path) }));
let dokimorjiByNative = new Map(dokimorjiList.map((item) => [item.native, item]));

export function getDokimorji(): Dokimorji[] {
  return dokimorjiList;
}

/** Sunucu manifestini uygular; biçimi bozuk girdiler atlanır. */
export function setDokimorji(items: unknown) {
  if (!Array.isArray(items)) return;
  const next: Dokimorji[] = [];
  for (const raw of items as Record<string, unknown>[]) {
    const native = typeof raw?.native === "string" ? raw.native : null;
    const url = typeof raw?.url72 === "string" ? raw.url72 : typeof raw?.url === "string" ? raw.url : null;
    if (!native || !url || typeof raw.id !== "string") continue;
    next.push({
      id: raw.id,
      native,
      name: typeof raw.name === "string" ? raw.name : raw.id,
      keywords: Array.isArray(raw.keywords) ? raw.keywords.filter((k): k is string => typeof k === "string") : [],
      category: typeof raw.category === "string" && raw.category ? raw.category : "flags",
      url: absolute(url),
    });
  }
  if (next.length === 0) return;
  dokimorjiList = next;
  dokimorjiByNative = new Map(next.map((item) => [item.native, item]));
}

/**
 * Sunucudaki listeyi okur (`/dokimorji/manifest.json`, web'in tek kaynağı).
 * Yoksa ya da okunamazsa yedek liste geçerli kalır; hata gösterilmez.
 */
export async function loadDokimorjiManifest(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/dokimorji/manifest.json`);
    if (!res.ok) return;
    const json = (await res.json()) as { items?: unknown };
    setDokimorji(json.items);
  } catch {
    /* Çevrimdışı ya da manifest yok: yedek liste. */
  }
}

/**
 * Plane 15 özel kullanım alanı — Dokimorji'nin kod noktaları buradan (web
 * U+F0000–U+F00FF aralığını ayırdı; geniş tutmak zarar vermez: listede
 * olmayan kod noktası metin olarak kalır).
 */
const PRIVATE_USE = /[\u{F0000}-\u{FFFFD}]/gu;

export type EmojiSegment =
  | { kind: "text"; text: string }
  | { kind: "emoji"; text: string; url: string };

const buildUrl = (codepoints: string) => `${TWEMOJI_PNG_BASE}${codepoints}.png`;

/** Metni yazı ve emoji parçalarına böler. Emoji yoksa tek yazı parçası. */
export function splitEmoji(text: string): EmojiSegment[] {
  const found: { start: number; end: number; text: string; url: string }[] = [];

  for (const entity of parse(text, { assetType: "png", buildUrl })) {
    if (entity.url) found.push({ start: entity.indices[0], end: entity.indices[1], text: entity.text, url: entity.url });
  }
  for (const match of text.matchAll(PRIVATE_USE)) {
    const item = dokimorjiByNative.get(match[0]);
    if (item && match.index !== undefined) {
      found.push({ start: match.index, end: match.index + match[0].length, text: match[0], url: item.url });
    }
  }
  if (found.length === 0) return [{ kind: "text", text }];

  found.sort((a, b) => a.start - b.start);
  const segments: EmojiSegment[] = [];
  let cursor = 0;
  for (const entry of found) {
    if (entry.start < cursor) continue;
    if (entry.start > cursor) segments.push({ kind: "text", text: text.slice(cursor, entry.start) });
    segments.push({ kind: "emoji", text: entry.text, url: entry.url });
    cursor = entry.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });
  return segments;
}

/** Tek bir emojinin görseli (seçici, tepkiler); tanınmıyorsa null. */
export function emojiUrl(native: string): string | null {
  const segment = splitEmoji(native).find((part) => part.kind === "emoji");
  return segment && segment.kind === "emoji" ? segment.url : null;
}

/**
 * Yalnızca emojiden oluşan kısa mesaj mı (büyük çizilir)? Web'le aynı sınır:
 * 1–8 emoji, arada yalnızca boşluk.
 */
export function isEmojiOnly(text: string): boolean {
  const segments = splitEmoji(text.trim());
  const emojis = segments.filter((part) => part.kind === "emoji").length;
  return (
    emojis >= 1 &&
    emojis <= 8 &&
    segments.every((part) => part.kind === "emoji" || part.text.trim() === "")
  );
}
