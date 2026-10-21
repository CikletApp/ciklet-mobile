/**
 * CSS gradyan metni → SVG belgesi. Web'in kozmetik verisi bazı katmanları
 * CSS `background` metni olarak taşıyor (profil efektlerinin `tint`'i:
 * `radial-gradient(90% 55% at 0% 0%, rgba(…), transparent 70%)`,
 * `linear-gradient(180deg, transparent 50%, rgba(…))`). React Native'de CSS
 * gradyanı yok; aynı metni `react-native-svg` ile çizilebilen bir `<svg>`
 * belgesine çeviririz (lib/cosmetics/art ile aynı yol: `SvgXml`).
 *
 * Yalnızca kozmetik verisinde geçen alt küme desteklenir: virgülle ayrılmış
 * katmanlar; `linear-gradient(<açı>deg, …)` ve
 * `radial-gradient(<rx>% <ry>% at <x>% <y>%, …)`; renkler `#rgb/#rrggbb`,
 * `rgb()/rgba()` ve `transparent`; durak konumu `%` (verilmezse eşit
 * aralık, CSS kuralı). Tanınmayan katman sessizce atlanır.
 *
 * Belge 100×100 viewBox, `preserveAspectRatio="none"`: kutunun en/boy
 * oranına gerilir, böylece yüzdeler CSS'teki gibi kutuya göre çalışır.
 * Saf modül — scripts/verify-cosmetics.mjs doğrular.
 */

export interface GradientStop {
  /** 0–1 */
  offset: number;
  /** `rgb(r,g,b)` ya da `#rrggbb` */
  color: string;
  /** 0–1 */
  opacity: number;
}

export type GradientLayer =
  | { kind: "linear"; angle: number; stops: GradientStop[] }
  | { kind: "radial"; rx: number; ry: number; cx: number; cy: number; stops: GradientStop[] };

/** Üst düzey virgüllerden böler (parantez içindekiler korunur). */
export function splitTopLevel(input: string, separator = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === separator && depth === 0) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Renk → `{ color, opacity }`; tanınmazsa null. `transparent` rengi sonradan komşudan alır. */
export function parseCssColor(raw: string): { color: string; opacity: number; transparent?: boolean } | null {
  const value = raw.trim().toLowerCase();
  if (value === "transparent") return { color: "rgb(0,0,0)", opacity: 0, transparent: true };
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return { color: `#${h}`, opacity: 1 };
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(value);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
    const [r, g, b] = parts.map((n) => Math.round(Math.min(255, Math.max(0, n))));
    const a = parts.length >= 4 && Number.isFinite(parts[3]) ? clamp01(parts[3]) : 1;
    return { color: `rgb(${r},${g},${b})`, opacity: a };
  }
  return null;
}

function parseStops(parts: readonly string[]): GradientStop[] | null {
  const raw: { color: string; opacity: number; transparent?: boolean; offset: number | null }[] = [];
  for (const part of parts) {
    const m = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(part.trim());
    if (!m) return null;
    const color = parseCssColor(m[1]);
    if (!color) return null;
    raw.push({ ...color, offset: m[2] === undefined ? null : clamp01(Number(m[2]) / 100) });
  }
  if (raw.length < 2) return null;
  // CSS: ilk/son konumsuz durak 0/1; aradakiler bilinen komşular arasında eşit.
  if (raw[0].offset === null) raw[0].offset = 0;
  if (raw[raw.length - 1].offset === null) raw[raw.length - 1].offset = 1;
  for (let i = 1; i < raw.length - 1; i++) {
    if (raw[i].offset !== null) continue;
    let j = i;
    while (raw[j].offset === null) j++;
    const from = raw[i - 1].offset as number;
    const to = raw[j].offset as number;
    for (let k = i; k < j; k++) raw[k].offset = from + ((to - from) * (k - i + 1)) / (j - i + 1);
  }
  // Konumlar azalmasın (CSS: öncekinden küçükse öncekine eşitlenir).
  for (let i = 1; i < raw.length; i++) raw[i].offset = Math.max(raw[i].offset as number, raw[i - 1].offset as number);
  // Saydam durak komşu rengini alır: SVG renkleri ön-çarpımsız karıştırır,
  // siyah saydam duraktan geçiş grimsi bir hale bırakırdı.
  for (let i = 0; i < raw.length; i++) {
    if (!raw[i].transparent) continue;
    const near = raw.slice(i + 1).find((s) => !s.transparent) ?? [...raw.slice(0, i)].reverse().find((s) => !s.transparent);
    if (near) raw[i].color = near.color;
  }
  return raw.map((s) => ({ offset: Math.round((s.offset as number) * 1000) / 1000, color: s.color, opacity: s.opacity }));
}

/** Tek gradyan katmanı; desteklenmeyen biçimde null. */
export function parseGradientLayer(layer: string): GradientLayer | null {
  const m = /^(linear|radial)-gradient\((.*)\)$/s.exec(layer.trim());
  if (!m) return null;
  const args = splitTopLevel(m[2]);
  if (args.length < 2) return null;
  if (m[1] === "linear") {
    const angle = /^(-?[\d.]+)deg$/.exec(args[0]);
    const stops = parseStops(angle ? args.slice(1) : args);
    if (!stops) return null;
    return { kind: "linear", angle: angle ? Number(angle[1]) : 180, stops };
  }
  const shape = /^(-?[\d.]+)%\s+(-?[\d.]+)%\s+at\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/.exec(args[0]);
  if (!shape) return null;
  const stops = parseStops(args.slice(1));
  if (!stops) return null;
  const [rx, ry, cx, cy] = shape.slice(1, 5).map(Number);
  if (rx <= 0 || ry <= 0) return null;
  return { kind: "radial", rx, ry, cx, cy, stops };
}

/** Virgülle ayrılmış CSS `background` metninin gradyan katmanları (yazıldığı sırayla; ilki en üstte). */
export function parseCssGradients(css: string | null | undefined): GradientLayer[] {
  if (!css) return [];
  return splitTopLevel(css)
    .map(parseGradientLayer)
    .filter((layer): layer is GradientLayer => layer !== null);
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

function stopsXml(stops: readonly GradientStop[]): string {
  return stops
    .map((s) => `<stop offset="${r3(s.offset)}" stop-color="${s.color}"${s.opacity === 1 ? "" : ` stop-opacity="${r3(s.opacity)}"`}/>`)
    .join("");
}

/**
 * Katmanlar → tam `<svg>` metni (boş liste → null). CSS'te ilk katman en
 * üstte; SVG'de sonra çizilen üstte — sıra ters çevrilir.
 */
export function gradientLayersSvg(layers: readonly GradientLayer[], prefix = "g"): string | null {
  if (layers.length === 0) return null;
  let defs = "";
  let body = "";
  [...layers].reverse().forEach((layer, i) => {
    const id = `${prefix}${i}`;
    if (layer.kind === "linear") {
      // CSS açısı: 0deg yukarı, 90deg sağa, 180deg aşağı (kutu birimlerinde).
      const rad = (layer.angle * Math.PI) / 180;
      const dx = Math.sin(rad) / 2;
      const dy = -Math.cos(rad) / 2;
      defs += `<linearGradient id="${id}" x1="${r3(0.5 - dx)}" y1="${r3(0.5 - dy)}" x2="${r3(0.5 + dx)}" y2="${r3(0.5 + dy)}">${stopsXml(layer.stops)}</linearGradient>`;
    } else {
      // Elips: yarıçap rx (yatay); dikey ry/rx oranıyla merkezden ölçeklenir.
      const k = r3(layer.ry / layer.rx);
      defs += `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${layer.cx}" cy="${layer.cy}" r="${layer.rx}" gradientTransform="translate(${layer.cx} ${layer.cy}) scale(1 ${k}) translate(${-layer.cx} ${-layer.cy})">${stopsXml(layer.stops)}</radialGradient>`;
    }
    body += `<rect width="100" height="100" fill="url(#${id})"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs>${defs}</defs>${body}</svg>`;
}

/** CSS `background` gradyan metni → `<svg>` metni (çizilecek katman yoksa null). */
export function cssGradientSvg(css: string | null | undefined, prefix = "g"): string | null {
  return gradientLayersSvg(parseCssGradients(css), prefix);
}
