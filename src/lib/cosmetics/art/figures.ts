/**
 * Tekrar kullanılan figürler (cüce iskelet, hayalet, yarasa, örümcek…).
 * Hepsi YEREL koordinatta çizilir; çağıran `translate/rotate/scale` ile
 * yerleştirir. Saf SVG metni (bkz. kit.ts).
 */
import { OL, bone, limb, ribcage, skull } from "./kit";

type Pt = readonly [number, number];

export interface SkeletonPose {
  /** Sol/sağ kol: omuzdan (±4.2, 11.5) başlayan kırık çizgi. */
  armL: readonly Pt[];
  armR: readonly Pt[];
  /** Sol/sağ bacak: kalçadan (±2.2, 21.5) başlayan kırık çizgi. */
  legL: readonly Pt[];
  legR: readonly Pt[];
  /** Kafatası eğimi (derece). */
  tilt?: number;
  /** Kafatası üstüne şapka vb. (kafatası koordinatında). */
  hat?: string;
  /** Göz ışığı rengi. */
  glow?: string;
  /** Kol sarmalayıcısına eklenecek öznitelik (ör. el sallama animasyonu). */
  armRAttrs?: string;
  armLAttrs?: string;
  /** Elde tutulan nesne (sağ elin ucunda, kol grubunun içinde). */
  holdR?: string;
}

function hand([x, y]: Pt): string {
  return `<circle cx="${x}" cy="${y}" r="1.7" fill="#f6f0e4" stroke="${OL}" stroke-width="1.1"/>`;
}

function foot(pts: readonly Pt[]): string {
  const [x, y] = pts[pts.length - 1];
  const [px] = pts[pts.length - 2] ?? pts[0];
  const dir = x >= px ? 1 : -1;
  return `<ellipse cx="${x + dir * 1}" cy="${y}" rx="2.6" ry="1.6" fill="#f6f0e4" stroke="${OL}" stroke-width="1.1"/>`;
}

/** Cüce iskelet. `p`: kimlik öneki (kemik gradyanı `<p>bone` tanımlı olmalı). */
export function skeleton(p: string, pose: SkeletonPose): string {
  const arm = (pts: readonly Pt[], attrs?: string, hold?: string) =>
    `<g ${attrs ?? ""}>${limb(pts, 1.9)}${hand(pts[pts.length - 1])}${hold ?? ""}</g>`;
  return (
    limb(pose.legL, 2) +
    foot(pose.legL) +
    limb(pose.legR, 2) +
    foot(pose.legR) +
    ribcage() +
    arm(pose.armL, pose.armLAttrs) +
    arm(pose.armR, pose.armRAttrs, pose.holdR) +
    skull(p, pose.glow, { tilt: pose.tilt, hat: pose.hat })
  );
}

/** Cadı şapkası (kafatası koordinatında, tepeye oturur). */
export function witchHat(color = "#5b3a8c", band = "#ff9a3c"): string {
  return (
    `<g transform="translate(0 -8) rotate(-12)">` +
    `<path d="M-11 0.5C-6 -1.6 6 -1.6 11 0.5C8 2.2 -8 2.2 -11 0.5Z" fill="${color}" stroke="${OL}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M-6.4 -0.6C-5 -6 -2 -12 3 -16.5C3.6 -14.6 5 -13.6 7 -13.6C3.6 -11 4.4 -5 6.4 -0.6C2 0.4 -2 0.4 -6.4 -0.6Z" fill="${color}" stroke="${OL}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M-6 -1.4C-2 -0.6 2 -0.6 6 -1.4L5.6 -3.6C2 -2.8 -2 -2.8 -5.6 -3.6Z" fill="${band}" stroke="${OL}" stroke-width=".9"/>` +
    `<path d="M-3.4 -5C-2.6 -8 -1 -10.6 1 -12.6" stroke="#fff" stroke-opacity=".35" stroke-width="1.1" stroke-linecap="round" fill="none"/>` +
    `</g>`
  );
}

/** Yarasa (merkez 0,0; kanat açıklığı ~22). */
export function bat(color = "#2f2142", wing = "#4a3366"): string {
  return (
    `<path d="M0 -1.6C-2 -4.4 -5 -5.6 -8 -4.4C-9.6 -5.2 -11 -4.6 -11.6 -3C-9.8 -2.6 -9.4 -1.4 -9.6 -0.2C-8 -1 -6.6 -0.6 -5.8 0.6C-4.2 -0.6 -2 0 0 1.8C2 0 4.2 -0.6 5.8 0.6C6.6 -0.6 8 -1 9.6 -0.2C9.4 -1.4 9.8 -2.6 11.6 -3C11 -4.6 9.6 -5.2 8 -4.4C5 -5.6 2 -4.4 0 -1.6Z" fill="${wing}" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/>` +
    `<ellipse cx="0" cy="0" rx="2.4" ry="3" fill="${color}" stroke="${OL}" stroke-width="1"/>` +
    `<path d="M-1.8 -2.2L-2.2 -4.4L-0.8 -2.9M1.8 -2.2L2.2 -4.4L0.8 -2.9" fill="${color}" stroke="${OL}" stroke-width=".8" stroke-linejoin="round"/>` +
    `<circle cx="-0.9" cy="-0.6" r=".55" fill="#ffd36b"/><circle cx="0.9" cy="-0.6" r=".55" fill="#ffd36b"/>`
  );
}

/** Sevimli örümcek (merkez gövde 0,0; ipe tepeden asılı). */
export function spider(p: string): string {
  const legs = [-1, 1]
    .map((s) =>
      [
        `M${s * 2.6} -1.6C${s * 6} -5 ${s * 8} -4 ${s * 9.6} -1`,
        `M${s * 3} 0C${s * 7} -1.6 ${s * 9} 0 ${s * 10} 3`,
        `M${s * 3} 1.4C${s * 6.6} 1.6 ${s * 8} 4 ${s * 8.6} 7`,
        `M${s * 2.4} 2.8C${s * 5} 4.4 ${s * 5.6} 7 ${s * 5.6} 9.4`,
      ].join(""),
    )
    .join("");
  return (
    `<path d="${legs}" fill="none" stroke="${OL}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<ellipse cx="0" cy="-1" rx="5.4" ry="5" fill="url(#${p}spider)" stroke="${OL}" stroke-width="1.2"/>` +
    `<ellipse cx="0" cy="4" rx="3.6" ry="3" fill="url(#${p}spider)" stroke="${OL}" stroke-width="1.1"/>` +
    `<path d="M-2.8 -4C-1.6 -5.2 0.6 -5.4 2 -4.8" stroke="#fff" stroke-opacity=".45" stroke-width="1" stroke-linecap="round" fill="none"/>` +
    `<circle cx="-1.8" cy="3.6" r="1.5" fill="#fff"/><circle cx="1.8" cy="3.6" r="1.5" fill="#fff"/>` +
    `<circle cx="-1.6" cy="3.9" r=".8" fill="${OL}"/><circle cx="1.6" cy="3.9" r=".8" fill="${OL}"/>`
  );
}

/** Hayalet (merkez gövde ~0,0; yükseklik ~26). `blush`: yanak rengi. */
export function ghost(p: string, mood: "o" | "smile" = "o"): string {
  const mouth =
    mood === "o"
      ? `<ellipse cx="0" cy="1.6" rx="1.5" ry="1.9" fill="${OL}"/>`
      : `<path d="M-2 0.8Q0 3 2 0.8" stroke="${OL}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  return (
    `<path d="M-9.5 2C-9.5 -7 -5.4 -12 0 -12C5.4 -12 9.5 -7 9.5 2V11C9.5 12.6 8 13 7 11.8C6 10.6 4.6 10.6 3.8 12C3 13.4 1.2 13.6 0.2 12.2C-0.8 10.8 -2.6 10.8 -3.4 12.2C-4.2 13.6 -6 13.4 -6.8 12C-7.6 10.6 -9.5 11.4 -9.5 9Z" fill="url(#${p}ghost)" stroke="${OL}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M-6 -6C-4.6 -8.8 -2 -10 0.6 -10" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>` +
    `<path d="M-9.5 1.6C-12 2 -13 4 -12.4 5.6C-11 4.8 -10 4.8 -9.5 5.4M9.5 1.6C12 2 13 4 12.4 5.6C11 4.8 10 4.8 9.5 5.4" fill="url(#${p}ghost)" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<ellipse cx="-3.4" cy="-3" rx="1.6" ry="2.2" fill="${OL}"/><ellipse cx="3.4" cy="-3" rx="1.6" ry="2.2" fill="${OL}"/>` +
    `<circle cx="-2.9" cy="-3.8" r=".65" fill="#fff"/><circle cx="3.9" cy="-3.8" r=".65" fill="#fff"/>` +
    `<ellipse cx="-6" cy="0.4" rx="1.6" ry="1" fill="#ff8fb8" opacity=".7"/><ellipse cx="6" cy="0.4" rx="1.6" ry="1" fill="#ff8fb8" opacity=".7"/>` +
    mouth
  );
}

/** Balkabağı feneri (merkez 0,0; genişlik ~2w). Oyulmuş yüz `<p>pglow` ile parlar. */
export function pumpkin(p: string, w = 12, face: "happy" | "spooky" = "happy", faceAttrs = ""): string {
  const h = w * 0.86;
  const lobes = [-0.62, 0, 0.62]
    .map(
      (k) =>
        `<ellipse cx="${k * w}" cy="0" rx="${w * (k === 0 ? 0.5 : 0.48)}" ry="${h}" fill="url(#${p}pumpkin)" stroke="${OL}" stroke-width="1.3"/>`,
    )
    .join("");
  const s = w / 12;
  const eyes =
    face === "happy"
      ? `<path d="M${-5.6 * s} ${-1.6 * s}L${-3 * s} ${-4.6 * s}L${-0.8 * s} ${-1.6 * s}ZM${5.6 * s} ${-1.6 * s}L${3 * s} ${-4.6 * s}L${0.8 * s} ${-1.6 * s}Z"/>`
      : `<path d="M${-6 * s} ${-4 * s}L${-1.2 * s} ${-2.4 * s}L${-4.6 * s} ${-0.8 * s}ZM${6 * s} ${-4 * s}L${1.2 * s} ${-2.4 * s}L${4.6 * s} ${-0.8 * s}Z"/>`;
  const mouth = `<path d="M${-6.4 * s} ${1.6 * s}Q0 ${8.4 * s} ${6.4 * s} ${1.6 * s}Q${4.6 * s} ${3 * s} ${3 * s} ${2.4 * s}L${2.2 * s} ${4 * s}L${1 * s} ${2.8 * s}Q0 ${3 * s} ${-1 * s} ${2.8 * s}L${-2.2 * s} ${4 * s}L${-3 * s} ${2.4 * s}Q${-4.6 * s} ${3 * s} ${-6.4 * s} ${1.6 * s}Z"/>`;
  return (
    `<path d="M${-1 * s} ${-h + 1}C${-1.4 * s} ${-h - 3 * s} ${0.6 * s} ${-h - 5 * s} ${2.6 * s} ${-h - 5.4 * s}L${3 * s} ${-h - 3.6 * s}C${1.8 * s} ${-h - 3 * s} ${1.4 * s} ${-h - 1 * s} ${1.6 * s} ${-h + 1}Z" fill="#5f7a2e" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>` +
    lobes +
    `<path d="M${-w * 0.95} ${-h * 0.2}C${-w * 0.9} ${-h * 0.7} ${-w * 0.6} ${-h * 0.9} ${-w * 0.35} ${-h * 0.92}" stroke="#ffe0a8" stroke-opacity=".6" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
    `<g fill="url(#${p}pglow)" stroke="${OL}" stroke-width=".9" stroke-linejoin="round" ${faceAttrs}>${eyes}${mouth}</g>`
  );
}

/** Mum (taban 0,0; alev `flameAttrs` ile titrer). */
export function candle(p: string, h = 10, flameAttrs = ""): string {
  return (
    `<path d="M-2.6 0V${-h}C-2.6 ${-h - 1} 2.6 ${-h - 1} 2.6 ${-h}V0C2.6 1 -2.6 1 -2.6 0Z" fill="url(#${p}wax)" stroke="${OL}" stroke-width="1.1"/>` +
    `<path d="M-1.2 ${-h + 0.6}C-1.4 ${-h + 3} -0.4 ${-h + 4} -0.8 ${-h + 5.6}" stroke="#fff" stroke-opacity=".8" stroke-width="1" fill="none" stroke-linecap="round"/>` +
    `<path d="M0 ${-h - 0.6}V${-h - 2}" stroke="${OL}" stroke-width=".9"/>` +
    `<g ${flameAttrs}><path d="M0 ${-h - 9}C1.4 ${-h - 6} 2.6 ${-h - 4.4} 2.2 ${-h - 2.6}C1.9 ${-h - 1.2} -1.9 ${-h - 1.2} -2.2 ${-h - 2.6}C-2.6 ${-h - 4.4} -1.4 ${-h - 6} 0 ${-h - 9}Z" fill="url(#${p}flame)"/><path d="M0 ${-h - 5.6}C.7 ${-h - 4} 1 ${-h - 3.2} .7 ${-h - 2.4}C.4 ${-h - 1.8} -.4 ${-h - 1.8} -.7 ${-h - 2.4}C-1 ${-h - 3.2} -.7 ${-h - 4} 0 ${-h - 5.6}Z" fill="#fff8d6"/></g>`
  );
}

export { bone };
