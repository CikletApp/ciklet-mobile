/**
 * Ciklet Halkası v1 — telefonla girişte masaüstünün gösterdiği, YALNIZCA
 * Ciklet mobil uygulamasının okuduğu dairesel kod.
 *
 * Bu dosya ciklet-web/src/lib/device-login/ring-code.ts'in BİREBİR KOPYASI
 * (orada üretici, burada çözücü kullanılır). Burada düzenlemeyin: web'deki
 * dosyayı değiştirip kopyalayın. Biçim değişirse `VERSION` artar ve iki
 * taraf birlikte yayınlanır.
 *
 * ── Neden QR değil ────────────────────────────────────────────────────
 * Standart QR'ı her kamera uygulaması okur; kullanıcı "ne çıkacak" diye
 * telefonun kamerasına tutar, anlamsız bir metin görür. Kodun kendisi bir
 * gizlilik katmanı DEĞİL (güvenlik tek kullanımlık sır + telefonda onay ile
 * sağlanıyor, bkz. lib/device-login/store.ts); ama yalnızca Ciklet'in
 * tanıdığı bir biçim hem markayı taşıyor hem de yanlış uygulamayla okuma
 * karışıklığını baştan kesiyor.
 *
 * ── Yük (18 bayt = 144 bit) ───────────────────────────────────────────
 *   [0]      0xC1  — sihirli bayt / sürüm; çözücü yanlış hizayı buradan eler
 *   [1..8]   istek kimliği (8 bayt)
 *   [9..16]  sır (8 bayt)
 *   [17]     CRC-8 (poly 0x07), 0..16 üzerinde
 *
 * ── Geometri (birim: en dış halkanın dış yarıçapı R = 1) ────────────
 *   • Arka plan YOK: kod koyu zemin (giriş kartı) üstünde durur.
 *   • Ortada beyaz Ciklet ikonu, serbest (dolu disk yok). Çözücü merkezi
 *     ve ölçeği BU ikondan bulur: en/boy oranı 1,35 olan beyaz leke.
 *   • 3 ince halka, her biri SEGMENTS yuvarlak uçlu parça. Parça 0 LİME:
 *     o halkanın yön işareti. Kalan 49 parça veri — bit 1 parlak lavanta,
 *     bit 0 koyu mor. Halkalar BİRBİRİNDEN BAĞIMSIZ döner; yön her halka
 *     için ayrı bulunur, bu yüzden işaret her halkada var.
 *   • Bitler MSB'den; halka 0 (en iç) veri 0..48, halka 1 49..97, halka 2
 *     98..146 (144 kullanılır, son 3 bit sıfır). Parça i'nin merkez açısı
 *     = i · 2π/50 (ekran koordinatı: x = cx + r·cosθ, y = cy + r·sinθ).
 */

export const VERSION = 1;
export const MAGIC = 0xc1;
export const ID_BYTES = 8;
export const SECRET_BYTES = 8;
export const PAYLOAD_BYTES = 1 + ID_BYTES + SECRET_BYTES + 1; // 18
export const SEGMENTS = 50;
export const DATA_PER_RING = SEGMENTS - 1; // 0. parça işaret
export const RINGS = 3;
export const BITS = PAYLOAD_BYTES * 8; // 144 ≤ 147

/** İkon genişliği (birim R) ve en/boy oranı (ic-ikon.svg: 93.29 × 68.89). */
export const ICON_W = 0.5;
export const ICON_ASPECT = 68.89 / 93.29;
/** Halka merkez yarıçapları (iç → dış). */
export const RING_R = [0.64, 0.78, 0.92] as const;
/** Halka kalınlığı (radyal). */
export const RING_W = 0.075;
/** Parçalar arası açısal boşluk — parça genişliğinin oranı. */
export const SEGMENT_GAP = 0.3;

export const COLORS = {
  /** bit 1 */
  bright: "#cdb6ff",
  /** bit 0 */
  dim: "#3a1f6b",
  /** yön işareti */
  lime: "#a8e000",
  /** ikon */
  white: "#ffffff",
} as const;

export interface RingPayload {
  id: Uint8Array;
  secret: Uint8Array;
}

// ── Yük ────────────────────────────────────────────────────────────────

export function crc8(bytes: Uint8Array, end = bytes.length): number {
  let crc = 0;
  for (let i = 0; i < end; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

export function packPayload({ id, secret }: RingPayload): Uint8Array {
  if (id.length !== ID_BYTES || secret.length !== SECRET_BYTES) throw new Error("ring-code: yük uzunluğu");
  const out = new Uint8Array(PAYLOAD_BYTES);
  out[0] = MAGIC;
  out.set(id, 1);
  out.set(secret, 1 + ID_BYTES);
  out[PAYLOAD_BYTES - 1] = crc8(out, PAYLOAD_BYTES - 1);
  return out;
}

export function unpackPayload(bytes: Uint8Array): RingPayload | null {
  if (bytes.length !== PAYLOAD_BYTES) return null;
  if (bytes[0] !== MAGIC) return null;
  if (crc8(bytes, PAYLOAD_BYTES - 1) !== bytes[PAYLOAD_BYTES - 1]) return null;
  return { id: bytes.slice(1, 1 + ID_BYTES), secret: bytes.slice(1 + ID_BYTES, PAYLOAD_BYTES - 1) };
}

export function payloadToBits(bytes: Uint8Array): Uint8Array {
  const bits = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) for (let b = 0; b < 8; b++) bits[i * 8 + b] = (bytes[i] >> (7 - b)) & 1;
  return bits;
}

/** Veri biti k hangi halkanın hangi parçasında (parça 0 işaret, veri 1'den başlar). */
export function bitSlot(k: number): { ring: number; index: number } {
  return { ring: Math.floor(k / DATA_PER_RING), index: 1 + (k % DATA_PER_RING) };
}

export function bitsToPayload(bits: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(bits.length >> 3);
  for (let i = 0; i < bytes.length; i++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | (bits[i * 8 + b] & 1);
    bytes[i] = v;
  }
  return bytes;
}

// ── Metin biçimi (ağ üzerinde taşınan hali) ────────────────────────────

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (b !== undefined) out += B64[(n >> 6) & 63];
    if (c !== undefined) out += B64[n & 63];
  }
  return out;
}

export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const out: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of text) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 0xff); }
  }
  return Uint8Array.from(out);
}

/** Mobilin sunucuya gönderdiği biçim: `CKL1.<base64url(id)>.<base64url(secret)>`. */
export function formatCode(p: RingPayload): string {
  return `CKL${VERSION}.${toBase64Url(p.id)}.${toBase64Url(p.secret)}`;
}

export function parseCode(text: unknown): RingPayload | null {
  if (typeof text !== "string") return null;
  const m = /^CKL1\.([A-Za-z0-9_-]{11})\.([A-Za-z0-9_-]{11})$/.exec(text.trim());
  if (!m) return null;
  const id = fromBase64Url(m[1]), secret = fromBase64Url(m[2]);
  if (!id || !secret || id.length !== ID_BYTES || secret.length !== SECRET_BYTES) return null;
  return { id, secret };
}

// ── Geometri (çizim için) ──────────────────────────────────────────────

export type SegmentKind = "marker" | 1 | 0;

export interface Arc {
  ring: number;
  index: number;
  kind: SegmentKind;
  /** Radyan, ekran koordinatı (saat yönü). */
  start: number;
  end: number;
  /** Birim yarıçap cinsinden. */
  r: number;
}

/** Her parçanın yayı — çizen taraf (SVG, Skia…) bununla yolu kurar. */
export function layoutArcs(bits: Uint8Array): Arc[] {
  if (bits.length !== BITS) throw new Error("ring-code: bit sayısı");
  const step = (Math.PI * 2) / SEGMENTS;
  const gap = step * SEGMENT_GAP;
  const slots = new Map<string, 0 | 1>();
  for (let k = 0; k < BITS; k++) {
    const s = bitSlot(k);
    slots.set(`${s.ring}:${s.index}`, bits[k] as 0 | 1);
  }
  const arcs: Arc[] = [];
  for (let ring = 0; ring < RINGS; ring++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const center = i * step;
      const kind: SegmentKind = i === 0 ? "marker" : (slots.get(`${ring}:${i}`) ?? 0);
      arcs.push({ ring, index: i, kind, start: center - step / 2 + gap / 2, end: center + step / 2 - gap / 2, r: RING_R[ring] });
    }
  }
  return arcs;
}

/** SVG yay yolu (yalnızca orta çizgi; `stroke-width` = RING_W·scale, yuvarlak uçlu). */
export function arcPath(a: Arc, cx: number, cy: number, scale: number): string {
  const r = a.r * scale;
  const p = (t: number) => `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
  const large = a.end - a.start > Math.PI ? 1 : 0;
  return `M${p(a.start)} A${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${p(a.end)}`;
}

// ── Çözücü ─────────────────────────────────────────────────────────────

export interface DecodeInput {
  /** RGBA, satır-majör. */
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export interface DecodeResult extends RingPayload {
  center: { x: number; y: number };
  /** En dış halkanın dış yarıçapı (piksel). */
  radius: number;
}

function isWhite(r: number, g: number, b: number): boolean {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mn > 150 && mx - mn < 60;
}
/** Lime'lık: yeşil, kırmızı ve mavinin üstünde ne kadar. */
function limeness(r: number, g: number, b: number): number {
  return (g - Math.max(r, b)) / 255;
}
/**
 * İşaret sayılacak en düşük lime'lık. Sıcak ışıkta lime sarıya kayıp
 * kırmızıya yaklaşıyor (ölçüldü: sepia .25'te 0,08); lavanta ve mor hep
 * negatif, beyaz ve koyu zemin ~0 — 0,05 güvenli bir ayraç.
 */
const LIME_MIN = 0.05;

/**
 * RGBA görüntüden kodu çözer. Kod görüntünün herhangi bir yerinde olabilir;
 * halkalar herhangi bir açıda, birbirinden bağımsız. Yalnızca kabaca
 * cepheden çekilmiş olmalı (perspektif düzeltmesi yok).
 *
 * Adımlar: (1) beyaz piksel maskesi → bağlı bileşenler → ikona benzeyen
 * (en/boy ≈ 1,35) leke; yakın beyaz parçalar (balon) birleştirilir; merkez
 * ve ölçek kutudan. Aday birden fazlaysa çevresinde halka bulunan kazanır.
 * (2) Her halkada ince açısal taramayla en lime nokta = o halkanın 0.
 * parçası. (3) Parça merkezlerinde parlaklık örneklenir; eşik örneklerin
 * kendi dağılımından (iki küme arasındaki en büyük boşluk).
 */
export function decodeRingCode(img: DecodeInput): DecodeResult | null {
  const { data, width: w, height: h } = img;
  if (w < 40 || h < 40) return null;

  const white = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (isWhite(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) white[i] = 1;

  // Bileşenler.
  interface Blob { area: number; minX: number; maxX: number; minY: number; maxY: number }
  const label = new Int32Array(w * h).fill(-1);
  const blobs: Blob[] = [];
  const stack: number[] = [];
  const minArea = Math.max(25, (Math.min(w, h) * 0.02) ** 2);
  for (let seed = 0; seed < w * h; seed++) {
    if (!white[seed] || label[seed] >= 0) continue;
    const id = blobs.length;
    const b: Blob = { area: 0, minX: w, maxX: 0, minY: h, maxY: 0 };
    stack.push(seed); label[seed] = id;
    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % w, y = (p - x) / w;
      b.area++;
      if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x; if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of nb) if (q >= 0 && q < w * h && white[q] && label[q] < 0) { label[q] = id; stack.push(q); }
    }
    blobs.push(b);
  }

  // İkon adayı: yeterince büyük lekeler, yakın komşularıyla birleştirilmiş.
  const candidates = blobs.filter((b) => b.area >= minArea).sort((a, b) => b.area - a.area).slice(0, 12);
  const sample = (x: number, y: number) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return null;
    const i = (yi * w + xi) * 4;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };
  let best: { cx: number; cy: number; Rx: number; Ry: number; score: number } | null = null;
  for (const seed of candidates) {
    let { minX, maxX, minY, maxY } = seed;
    const size = Math.max(maxX - minX, maxY - minY) + 1;
    for (const o of candidates) {
      if (o === seed) continue;
      const ocx = (o.minX + o.maxX) / 2, ocy = (o.minY + o.maxY) / 2;
      if (Math.abs(ocx - (minX + maxX) / 2) < size * 0.9 && Math.abs(ocy - (minY + maxY) / 2) < size * 0.6) {
        minX = Math.min(minX, o.minX); maxX = Math.max(maxX, o.maxX); minY = Math.min(minY, o.minY); maxY = Math.max(maxY, o.maxY);
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const aspect = bw / bh;
    if (aspect < 1.05 || aspect > 1.8) continue;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    // Yatay ve dikey ölçek AYRI: telefon hafif eğik tutulunca halkalar elips
    // olur; tek bir yarıçap dış halkayı ıskalardı.
    const Rx = bw / ICON_W, Ry = bh / (ICON_W * ICON_ASPECT);
    if (Rx / Ry < 0.75 || Rx / Ry > 1.33) continue;
    if (cx - Rx < -Rx * 0.1 || cy - Ry < -Ry * 0.1 || cx + Rx > w + Rx * 0.1 || cy + Ry > h + Ry * 0.1) continue;
    // Çevresinde halka var mı: her halkada en az bir lime nokta ve parlaklık çeşitliliği.
    let score = 0;
    for (const rr of RING_R) {
      let maxLime = -1;
      for (let k = 0; k < 120; k++) {
        const t = (k / 120) * Math.PI * 2;
        const px = sample(cx + rr * Rx * Math.cos(t), cy + rr * Ry * Math.sin(t));
        if (px) maxLime = Math.max(maxLime, limeness(px[0], px[1], px[2]));
      }
      if (maxLime > LIME_MIN) score += 1;
    }
    if (score === 0) continue;
    score = score * 1e6 + bw * bh;
    if (!best || score > best.score) best = { cx, cy, Rx, Ry, score };
  }
  if (!best) return null;
  const { cx, cy, Rx, Ry } = best;
  const at = (r: number, t: number) => sample(cx + r * Rx * Math.cos(t), cy + r * Ry * Math.sin(t));

  const step = (Math.PI * 2) / SEGMENTS;
  // Halkanın yönü: ince taramada en lime açı; radyal ortalama.
  // Radyal tolerans: halka, eğik çekimde (perspektif) beklenen yarıçaptan
  // birkaç piksel kayabilir. Her ölçüm halka kalınlığı boyunca beş radyal
  // noktaya bakar ve EN YÜKSEĞİNİ alır: parlak parça bir noktada bile
  // görünüyorsa parlak sayılır; koyu parça ve boşluk her noktada koyu.
  const RADIAL = [-0.6, -0.3, 0, 0.3, 0.6].map((k) => k * RING_W);
  const probe = (ring: number, t: number, metric: (r: number, g: number, b: number) => number): number => {
    let best = -1;
    for (const dr of RADIAL) {
      const px = at(RING_R[ring] + dr, t);
      if (px) best = Math.max(best, metric(px[0], px[1], px[2]));
    }
    return best;
  };
  const lum = (r: number, g: number, b: number) => (r + g + b) / 765;

  // Halkanın yönü: ince açısal taramada lime'lık; işaret parçasının
  // MERKEZİ alınır (tepe değerin %70'ini aşan açıların dairesel ortalaması).
  // Yalnızca en yüksek değer alınsaydı parçanın kenarına denk gelir, sonraki
  // örnekler parça aralarındaki boşluklara düşerdi.
  const markerAngle = (ring: number): number | null => {
    const N = SEGMENTS * 8;
    const vals = new Float32Array(N);
    let max = -1;
    for (let k = 0; k < N; k++) {
      vals[k] = probe(ring, (k / N) * Math.PI * 2, limeness);
      if (vals[k] > max) max = vals[k];
    }
    if (max <= LIME_MIN) return null;
    let sx = 0, sy = 0;
    for (let k = 0; k < N; k++) {
      if (vals[k] < max * 0.7) continue;
      const t = (k / N) * Math.PI * 2;
      sx += Math.cos(t); sy += Math.sin(t);
    }
    return Math.atan2(sy, sx);
  };
  // Parça parlaklığı: açısal küçük yama, radyal en yüksek.
  const brightness = (ring: number, theta: number): number => {
    let sum = 0;
    for (let dt = -1; dt <= 1; dt++) sum += probe(ring, theta + dt * step * 0.1, lum);
    return sum / 3;
  };
  // Açı inceltme: işaret merkezi küçük kodda bir-iki piksel sapabiliyor; 50
  // parçada bu, örnekleri boşluğa düşürmeye yetiyor. Veri parçalarının
  // kendisi hakem: parlaklıkların varyansı, örnekler parça merkezlerine
  // oturduğunda tepe yapar, boşluklara kaydıkça düşer.
  const ringValues = (ring: number, t0: number): Float32Array => {
    let bestVals: Float32Array | null = null, bestVar = -1;
    for (let j = -4; j <= 4; j++) {
      const d = t0 + j * step * 0.08;
      const vals = new Float32Array(DATA_PER_RING);
      let mean = 0;
      for (let i = 1; i < SEGMENTS; i++) { vals[i - 1] = brightness(ring, d + i * step); mean += vals[i - 1]; }
      mean /= DATA_PER_RING;
      let v = 0;
      for (const x of vals) v += (x - mean) ** 2;
      if (v > bestVar) { bestVar = v; bestVals = vals; }
    }
    return bestVals as Float32Array;
  };

  const values = new Float32Array(BITS);
  for (let ring = 0; ring < RINGS; ring++) {
    const t0 = markerAngle(ring);
    if (t0 === null) return null;
    const vals = ringValues(ring, t0);
    for (let i = 0; i < DATA_PER_RING; i++) {
      const k = ring * DATA_PER_RING + i;
      if (k < BITS) values[k] = vals[i];
    }
  }
  const sorted = Array.from(values).sort((a, b) => a - b);
  let gapAt = 0, gap = -1;
  for (let k = 1; k < sorted.length; k++) if (sorted[k] - sorted[k - 1] > gap) { gap = sorted[k] - sorted[k - 1]; gapAt = k; }
  if (gap < 0.06) return null;
  const thr = (sorted[gapAt] + sorted[gapAt - 1]) / 2;
  const bits = new Uint8Array(BITS);
  for (let k = 0; k < BITS; k++) bits[k] = values[k] > thr ? 1 : 0;
  const payload = unpackPayload(bitsToPayload(bits));
  return payload ? { ...payload, center: { x: cx, y: cy }, radius: (Rx + Ry) / 2 } : null;
}
