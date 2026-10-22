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
 * ── Geometri (birim: beyaz diskin yarıçapı R = 1) ─────────────────────
 *   • Ortada mor disk (r = LOGO_R), üstünde beyaz Ciklet ikonu. Çözücü
 *     merkezi ve ölçeği BU diskten bulur: görüntüdeki en dairesel mor leke.
 *   • 3 veri halkası, her biri SEGMENTS parça. Bit 1 = mor yay, bit 0 =
 *     soluk lavanta yay (halka görsel olarak kesintisiz kalsın).
 *   • Lime (yeşil) işaret noktası: 0. parçanın açısında, halkaların dışında.
 *     Çözücü yönü buradan alır; disk dönerken de okunur.
 *   • Bitler MSB'den başlar; halka 0 (en iç) parça 0..47, halka 1 48..95,
 *     halka 2 96..143. Parça i'nin merkez açısı = i · 2π/48 (ekran
 *     koordinatı: x = cx + r·cosθ, y = cy + r·sinθ; yani saat yönünde).
 */

export const VERSION = 1;
export const MAGIC = 0xc1;
export const ID_BYTES = 8;
export const SECRET_BYTES = 8;
export const PAYLOAD_BYTES = 1 + ID_BYTES + SECRET_BYTES + 1; // 18
export const SEGMENTS = 48;
export const RINGS = 3;
export const BITS = SEGMENTS * RINGS; // 144 = PAYLOAD_BYTES * 8

export const LOGO_R = 0.3;
/** Halka merkez yarıçapları (iç → dış). */
export const RING_R = [0.455, 0.585, 0.715] as const;
/** Halka kalınlığı (radyal). */
export const RING_W = 0.095;
/** Parçalar arası açısal boşluk — parça genişliğinin oranı. */
export const SEGMENT_GAP = 0.18;
export const MARKER_R = 0.86;
export const MARKER_DOT = 0.045;

export const COLORS = {
  purple: "#6010c9",
  pale: "#ece6f8",
  lime: "#a8e000",
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

export interface Arc {
  ring: number;
  index: number;
  bit: 0 | 1;
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
  const arcs: Arc[] = [];
  for (let ring = 0; ring < RINGS; ring++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const center = i * step;
      arcs.push({
        ring, index: i, bit: bits[ring * SEGMENTS + i] as 0 | 1,
        start: center - step / 2 + gap / 2,
        end: center + step / 2 - gap / 2,
        r: RING_R[ring],
      });
    }
  }
  return arcs;
}

/** SVG yay yolu; `cx,cy,scale` piksel. Yay `r` ortalı, `RING_W` kalın. */
export function arcPath(a: Arc, cx: number, cy: number, scale: number): string {
  const ro = (a.r + RING_W / 2) * scale, ri = (a.r - RING_W / 2) * scale;
  const p = (r: number, t: number) => `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
  const large = a.end - a.start > Math.PI ? 1 : 0;
  return `M${p(ro, a.start)} A${ro.toFixed(2)} ${ro.toFixed(2)} 0 ${large} 1 ${p(ro, a.end)} L${p(ri, a.end)} A${ri.toFixed(2)} ${ri.toFixed(2)} 0 ${large} 0 ${p(ri, a.start)} Z`;
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
  /** Beyaz diskin yarıçapı (piksel). */
  radius: number;
}

function isPurple(r: number, g: number, b: number): boolean {
  // #6010c9 ve kameradaki soluk/koyu halleri: mavi baskın, yeşil düşük.
  return b > 70 && b > r * 1.15 && b > g * 1.7 && r > g * 0.9;
}
function isLime(r: number, g: number, b: number): boolean {
  // #a8e000: yeşil baskın, mavi çok düşük.
  return g > 100 && g > b * 1.8 && g >= r * 0.95 && r > b;
}

/**
 * RGBA görüntüden kodu çözer. Kod görüntünün herhangi bir yerinde, herhangi
 * bir açıda olabilir; yalnızca kabaca cepheden çekilmiş olmalı (perspektif
 * düzeltmesi yok — kullanıcı zaten ekrana doğru tutuyor).
 *
 * Adımlar: (1) mor piksel maskesi → bağlı bileşenler → en dairesel ve en az
 * belli büyüklükteki leke = orta disk; merkez ve ölçek buradan. (2) lime
 * işaret → yön; bulunamazsa 48 dönüş denenir, CRC seçer. (3) her parçanın
 * merkezinde küçük bir yama örneklenip "morluk" ölçülür; eşik örneklerin
 * kendi dağılımından (iki küme arasındaki en büyük boşluk).
 */
export function decodeRingCode(img: DecodeInput): DecodeResult | null {
  const { data, width: w, height: h } = img;
  if (w < 40 || h < 40) return null;

  // 1) mor maske + bileşenler (4 komşuluk, yığınla).
  const purple = new Uint8Array(w * h);
  const limeXs: number[] = [], limeYs: number[] = [];
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (isPurple(r, g, b)) purple[i] = 1;
      else if (isLime(r, g, b)) { limeXs.push(x); limeYs.push(y); }
    }
  }

  const label = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  let best: { cx: number; cy: number; r: number; score: number } | null = null;
  let nextLabel = 0;
  const minArea = Math.max(60, (Math.min(w, h) * 0.04) ** 2);
  for (let seed = 0; seed < w * h; seed++) {
    if (!purple[seed] || label[seed] >= 0) continue;
    const id = nextLabel++;
    let area = 0, sx = 0, sy = 0, minX = w, maxX = 0, minY = h, maxY = 0;
    stack.push(seed); label[seed] = id;
    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % w, y = (p - x) / w;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      const nb = [p - 1, p + 1, p - w, p + w];
      if (x === 0) nb[0] = -1; if (x === w - 1) nb[1] = -1;
      for (const q of nb) if (q >= 0 && q < w * h && purple[q] && label[q] < 0) { label[q] = id; stack.push(q); }
    }
    if (area < minArea) continue;
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const aspect = Math.min(bw, bh) / Math.max(bw, bh);
    // Dolu daire ≈ π/4 = 0.785; ortadaki beyaz ikon bunu ~0.55'e indirir.
    // Halka yayı (ince, uzun) çok daha düşük kalır ve elenir.
    const fill = area / (bw * bh);
    if (aspect < 0.7 || fill < 0.42) continue;
    const score = area * aspect * fill;
    // Yarıçap alandan DEĞİL kutudan: ikon diskin içinden alan götürüyor.
    if (!best || score > best.score) best = { cx: sx / area, cy: sy / area, r: (bw + bh) / 4, score };
  }
  if (!best) return null;

  const R = best.r / LOGO_R;
  const { cx, cy } = best;
  if (cx - R * 0.8 < 0 || cy - R * 0.8 < 0 || cx + R * 0.8 > w || cy + R * 0.8 > h) return null;

  // Lime işaretin açısı — yalnızca diskin yakınındaki lime pikseller (arka
  // plandaki yeşil nesneler sayılmasın).
  let theta0: number | null = null;
  {
    let n = 0, sx = 0, sy = 0;
    for (let k = 0; k < limeXs.length; k++) {
      const dx = limeXs[k] - cx, dy = limeYs[k] - cy;
      const d = Math.hypot(dx, dy) / R;
      if (d > 0.74 && d < 0.98) { n++; sx += dx; sy += dy; }
    }
    if (n >= 3) theta0 = Math.atan2(sy, sx);
  }

  // 3) örnekleme: parça merkezinde (radyal ±RING_W/4, açısal ±%12) yama.
  const step = (Math.PI * 2) / SEGMENTS;
  const sample = (ring: number, theta: number): number => {
    let sum = 0, n = 0;
    for (let dr = -1; dr <= 1; dr++) {
      const rr = (RING_R[ring] + dr * RING_W * 0.22) * R;
      for (let dt = -1; dt <= 1; dt++) {
        const t = theta + dt * step * 0.12;
        const x = Math.round(cx + rr * Math.cos(t)), y = Math.round(cy + rr * Math.sin(t));
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        // "Morluk": mavi kanala göre kırmızı+yeşil düşüklüğü. Soluk lavanta
        // ile mor arasındaki ayrım beyaz dengesinden bağımsız kalsın diye
        // doğrudan parlaklık yerine oran.
        const r = data[i], g = data[i + 1], b = data[i + 2];
        sum += 1 - (r + g) / (2 * Math.max(b, 1));
        n++;
      }
    }
    return n ? sum / n : 0;
  };

  const tryOffset = (base: number): RingPayload | null => {
    const values = new Float32Array(BITS);
    for (let ring = 0; ring < RINGS; ring++)
      for (let i = 0; i < SEGMENTS; i++) values[ring * SEGMENTS + i] = sample(ring, base + i * step);
    // Eşik: sıralı değerlerde en büyük boşluğun ortası.
    const sorted = Array.from(values).sort((a, b) => a - b);
    let gapAt = 0, gap = -1;
    for (let k = 1; k < sorted.length; k++) if (sorted[k] - sorted[k - 1] > gap) { gap = sorted[k] - sorted[k - 1]; gapAt = k; }
    if (gap < 0.08) return null; // iki küme yok — bu kod değil ya da bulanık
    const thr = (sorted[gapAt] + sorted[gapAt - 1]) / 2;
    const bits = new Uint8Array(BITS);
    for (let k = 0; k < BITS; k++) bits[k] = values[k] > thr ? 1 : 0;
    return unpackPayload(bitsToPayload(bits));
  };

  if (theta0 !== null) {
    const p = tryOffset(theta0);
    if (p) return { ...p, center: { x: cx, y: cy }, radius: R };
  }
  // İşaret görülmediyse (parlama, kırpılma): tüm dönüşler, CRC karar verir.
  for (let i = 0; i < SEGMENTS; i++) {
    const p = tryOffset(i * step);
    if (p) return { ...p, center: { x: cx, y: cy }, radius: R };
  }
  return null;
}
