/**
 * İsim plakası sahneleri — 160×48 viewBox, satırın SAĞINA yaslanır
 * (yükseklik = satır yüksekliği). Sahnenin sol kenarı bileşende CSS
 * maskesiyle saydamlaşır; isim solda okunaklı kalır (bkz.
 * components/store/nameplate). Saf SVG metni, `p` kimlik önekiyle.
 */
import { OL, anim, boneDefs, lin, rad, radU, rng, sparklePath, starPath, svgDoc } from "./kit";
import { bat, skeleton } from "./figures";

export const NAMEPLATE_VIEWBOX = "0 0 160 48";
export const NAMEPLATE_ASPECT = 160 / 48;

const doc = (body: string) => svgDoc(NAMEPLATE_VIEWBOX, body, 'preserveAspectRatio="xMaxYMid slice"');

function stars(seed: number, count: number, color = "#fff", yMax = 30, xMin = 30): string {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = xMin + r() * (160 - xMin);
    const y = 2 + r() * yMax;
    const s = 0.5 + r() * 0.9;
    out += i % 3 === 0 ? `<g ${anim("twinkle", x, y, r() * 2, 1.6 + r())}><path d="${sparklePath(x, y, s * 2.4)}" fill="${color}"/></g>` : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(s * 0.6).toFixed(2)}" fill="${color}" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  }
  return out;
}

/* ── İskelet Dansı ───────────────────────────────────────────────────── */
function dancingSkeletons(p: string): string {
  const a = skeleton(p, {
    armL: [[-4.2, 11.5], [-8.6, 7], [-9.6, 1.6]],
    armR: [[4.2, 11.5], [8.6, 7], [9.6, 1.6]],
    legL: [[-2.2, 21.5], [-5, 26], [-6.6, 30.6]],
    legR: [[2.2, 21.5], [5.4, 25.6], [4.4, 30.6]],
    tilt: -8,
  });
  const b = skeleton(p, {
    armL: [[-4.2, 11.5], [-9, 14], [-12, 11]],
    armR: [[4.2, 11.5], [8, 7], [7.4, 1.6]],
    legL: [[-2.2, 21.5], [-3, 26.4], [-2.6, 31]],
    legR: [[2.2, 21.5], [7.6, 22.6], [11.4, 19]],
    tilt: 10,
    glow: "#ffd36b",
  });
  return (
    `<g transform="translate(92 15) scale(.78)"><g ${anim("bob", 0, 30, 0, 0.9)}><g ${anim("sway", 0, 30, 0.3, 1.8)}>${a}</g></g></g>` +
    `<g transform="translate(124 16) scale(.74)"><g ${anim("bob", 0, 30, 0.45, 0.9)}><g ${anim("sway", 0, 30, 1.2, 1.8)}>${b}</g></g></g>`
  );
}

const skeletonDance = (p: string) =>
  doc(
    `<defs>${boneDefs(p)}${lin(`${p}sky`, [[0, "#1d1238"], [0.7, "#3f2366"], [1, "#6a3a8a"]])}${radU(`${p}moon`, [[0, "#fff8dc"], [0.5, "#ffe9a8", 0.6], [1, "#ffd27a", 0]], 148, 10, 16)}${lin(`${p}hill`, [[0, "#2a1d40"], [1, "#140c22"]])}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      stars(3, 14, "#f3e8ff") +
      `<g ${anim("pulse", 148, 10, 0, 3)}><circle cx="148" cy="10" r="16" fill="url(#${p}moon)"/></g>` +
      `<circle cx="148" cy="10" r="6.4" fill="#fff6d6"/>` +
      `<path d="M40 48C64 38 96 40 120 42C136 43 150 40 160 37V48Z" fill="url(#${p}hill)"/>` +
      // Mezar taşları.
      `<path d="M66 44V38C66 34.6 73 34.6 73 38V44Z" fill="#6c6688" stroke="${OL}" stroke-width=".9"/><path d="M147 42V37.4C147 34.6 152.6 34.6 152.6 37.4V42Z" fill="#6c6688" stroke="${OL}" stroke-width=".9"/>` +
      `<path d="M69.5 37V41.4M67.8 38.8H71.2" stroke="${OL}" stroke-width=".8"/>` +
      dancingSkeletons(p) +
      `<g transform="translate(58 12) scale(.6)"><g ${anim("bob", 0, 0, 0.2, 1.8)}>${bat()}</g></g>` +
      `<g transform="translate(76 6) scale(.45)"><g ${anim("bob", 0, 0, 1, 2.2)}>${bat()}</g></g>`,
  );

/* ── Perili Orman ────────────────────────────────────────────────────── */
function pine(x: number, base: number, h: number, fill: string): string {
  const w = h * 0.36;
  return `<path d="M${x} ${base - h}L${x + w * 0.55} ${base - h * 0.62}H${x + w * 0.3}L${x + w * 0.85} ${base - h * 0.3}H${x + w * 0.5}L${x + w} ${base}H${x - w}L${x - w * 0.5} ${base - h * 0.3}H${x - w * 0.85}L${x - w * 0.3} ${base - h * 0.62}H${x - w * 0.55}Z" fill="${fill}"/>`;
}

const hauntedForest = (p: string) => {
  const r = rng(9);
  let far = "";
  let near = "";
  for (let i = 0; i < 9; i++) far += pine(44 + i * 14 + r() * 6, 46, 22 + r() * 12, "#24365a");
  for (let i = 0; i < 6; i++) near += pine(52 + i * 21 + r() * 8, 50, 26 + r() * 14, "#101a30");
  const eyes = [
    [84, 38, 0],
    [128, 40, 1.2],
  ]
    .map(([x, y, d]) => `<g ${anim("twinkle", x, y, d, 2.4)}><circle cx="${x - 1.4}" cy="${y}" r=".9" fill="#ffe14a"/><circle cx="${x + 1.4}" cy="${y}" r=".9" fill="#ffe14a"/></g>`)
    .join("");
  return doc(
    `<defs>${lin(`${p}sky`, [[0, "#0c1630"], [0.6, "#1f3560"], [1, "#4b6a8f"]])}${radU(`${p}moon`, [[0, "#f6fbff"], [0.45, "#d8ecff", 0.55], [1, "#bcd8ff", 0]], 112, 14, 18)}${lin(`${p}fog`, [[0, "#c8d8ff", 0], [0.5, "#dfe8ff", 0.55], [1, "#c8d8ff", 0]], 0, 0, 1, 0)}${lin(`${p}ghost`, [[0, "#ffffff"], [1, "#c9d6ff"]])}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      stars(21, 10, "#e8f1ff", 22) +
      `<circle cx="112" cy="14" r="18" fill="url(#${p}moon)"/><circle cx="112" cy="14" r="7.6" fill="#f4f9ff"/><circle cx="109" cy="12" r="1.6" fill="#d5e3f5"/><circle cx="114.6" cy="17" r="1.1" fill="#d5e3f5"/>` +
      far +
      `<g ${anim("drift", 100, 40, 0, 7)}><rect x="30" y="34" width="140" height="10" rx="5" fill="url(#${p}fog)"/></g>` +
      near +
      eyes +
      `<g transform="translate(146 20)"><g ${anim("float", 0, 0, 0, 3)}><path d="M-5 2C-5 -3 -2.6 -6 0 -6C2.6 -6 5 -3 5 2V7L3.4 5.6L1.6 7L0 5.6L-1.6 7L-3.4 5.6L-5 7Z" fill="url(#${p}ghost)" stroke="${OL}" stroke-width=".9" stroke-linejoin="round"/><circle cx="-1.8" cy="-1.4" r=".9" fill="${OL}"/><circle cx="1.8" cy="-1.4" r=".9" fill="${OL}"/><ellipse cx="0" cy="1.4" rx=".8" ry="1" fill="${OL}"/></g></g>` +
      `<g ${anim("drift", 120, 46, 2, 8)}><rect x="40" y="42" width="130" height="8" rx="4" fill="url(#${p}fog)"/></g>`,
  );
};

/* ── Uyuyan Kedi ─────────────────────────────────────────────────────── */
const sleepingCat = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#ffd6e8"], [0.55, "#d8c2ff"], [1, "#a998e6"]])}${lin(`${p}cat`, [[0, "#ffd3a1"], [0.6, "#f5a35b"], [1, "#d9792f"]])}${lin(`${p}branch`, [[0, "#9a6a46"], [1, "#5e3b24"]])}${lin(`${p}leaf`, [[0, "#b9e58a"], [1, "#5fa043"]])}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      `<circle cx="70" cy="40" r="20" fill="#fff" opacity=".22"/><circle cx="58" cy="14" r="9" fill="#fff" opacity=".25"/>` +
      // Dal.
      `<path d="M50 40C80 34 110 33 160 30V36C120 38 90 40 52 44C49 44 48 41 50 40Z" fill="url(#${p}branch)" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="M140 32C146 24 152 22 158 22" fill="none" stroke="${OL}" stroke-width="2.6" stroke-linecap="round"/><path d="M140 32C146 24 152 22 158 22" fill="none" stroke="#7d5237" stroke-width="1.2" stroke-linecap="round"/>` +
      [
        [62, 40, 200],
        [150, 22, -40],
        [134, 33, 150],
        [156, 28, 30],
      ]
        .map(([x, y, a]) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0C2 -3 6 -4 9 -1C6 2 2 2 0 0Z" fill="url(#${p}leaf)" stroke="${OL}" stroke-width=".8"/></g>`)
        .join("") +
      // Kıvrılmış kedi (somun gibi), kuyruğu daldan sarkar.
      `<g ${anim("sway", 98, 34, 0, 3)}><path d="M98 34C96 40 97 46 100 47" fill="none" stroke="${OL}" stroke-width="4.4" stroke-linecap="round"/><path d="M98 34C96 40 97 46 100 47" fill="none" stroke="#e58c40" stroke-width="2.8" stroke-linecap="round"/></g>` +
      `<g ${anim("breathe", 112, 34, 0, 2.6)}>` +
      `<path d="M96 33C96 24 104 19 113 19C121 19 127 23 128 30C128 33 126 34 112 34.6C100 35 96 35 96 33Z" fill="url(#${p}cat)" stroke="${OL}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M104 22C106 24 106 27 104 29M110 20C112 22 112 25 110 27" stroke="#c96a26" stroke-width="1.2" fill="none" stroke-linecap="round"/>` +
      `</g>` +
      `<path d="M120 25L121 18.6L125 22.6ZM127 24L130 18.4L131.4 24Z" fill="url(#${p}cat)" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>` +
      `<path d="M119 30C119 24 123 21.6 127 21.6C131.4 21.6 134 24.4 134 28.4C134 31.6 131 33.6 126.6 33.6C122 33.6 119 32.6 119 30Z" fill="url(#${p}cat)" stroke="${OL}" stroke-width="1.2"/>` +
      `<path d="M122.6 28.4Q124 29.6 125.4 28.4M128.6 28.4Q130 29.6 131.4 28.4" stroke="${OL}" stroke-width=".9" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="122.8" cy="30.6" rx="1.3" ry=".8" fill="#ff8fb0" opacity=".7"/><ellipse cx="131.4" cy="30.6" rx="1.3" ry=".8" fill="#ff8fb0" opacity=".7"/>` +
      `<path d="M126.4 30.6L127 31.4L127.6 30.6" stroke="${OL}" stroke-width=".7" fill="none"/>` +
      `<g ${anim("float", 138, 14, 0, 2.4)}><text x="138" y="16" font-family="sans-serif" font-weight="800" font-size="7" fill="#fff" stroke="${OL}" stroke-width=".5">z</text></g>` +
      `<g ${anim("float", 146, 8, 1.2, 2.4)}><text x="146" y="10" font-family="sans-serif" font-weight="800" font-size="5" fill="#fff" stroke="${OL}" stroke-width=".4">z</text></g>`,
  );

/* ── Kızılgerdan ─────────────────────────────────────────────────────── */
const robin = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#bfe3ff"], [1, "#eaf6ff"]])}${lin(`${p}body`, [[0, "#9c7b5e"], [1, "#6d5038"]])}${rad(`${p}breast`, [[0, "#ffb070"], [0.7, "#f2662a"], [1, "#d2491a"]], 0.4, 0.4, 0.7)}${lin(`${p}branch`, [[0, "#8e6446"], [1, "#55361f"]])}${rad(`${p}berry`, [[0, "#ff8a8a"], [0.6, "#e0182d"], [1, "#9a0f1f"]], 0.35, 0.3, 0.7)}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      `<circle cx="150" cy="6" r="12" fill="#fff" opacity=".5"/>` +
      `<path d="M60 38C76 34 98 36 120 35C138 34 150 30 160 26" fill="none" stroke="${OL}" stroke-width="4" stroke-linecap="round"/><path d="M60 38C76 34 98 36 120 35C138 34 150 30 160 26" fill="none" stroke="url(#${p}branch)" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M98 36C96 41 92 44 88 45" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/><path d="M98 36C96 41 92 44 88 45" fill="none" stroke="#7a5236" stroke-width="1.2" stroke-linecap="round"/>` +
      // Kar birikintisi dalda.
      `<path d="M66 36C70 33 76 33 80 35M126 33C132 30 140 29 146 30" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>` +
      [
        [86, 44],
        [90, 46],
        [83, 41],
        [146, 34],
        [150, 31.6],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="url(#${p}berry)" stroke="${OL}" stroke-width=".8"/><circle cx="${x - 0.7}" cy="${y - 0.7}" r=".6" fill="#fff"/>`)
        .join("") +
      // Kuş.
      `<g ${anim("bob", 118, 34, 0, 1.4)}>` +
      `<path d="M106 22L98 26L105 27Z" fill="#5a3f2b" stroke="${OL}" stroke-width=".9" stroke-linejoin="round"/>` +
      `<path d="M104 24C104 16 110 11 117 11C123 11 127 15 127 21C127 28 122 33 114 33C108 33 104 29 104 24Z" fill="url(#${p}body)" stroke="${OL}" stroke-width="1.2"/>` +
      `<path d="M116 15C122 15 126 19 126 24C126 29 121 32.6 115 32.6C111 32.6 109 29 110 25C111 20 112 15 116 15Z" fill="url(#${p}breast)"/>` +
      `<path d="M106 22C108 20 111 21 112 24C110 26 107 26 106 22Z" fill="#5a3f2b" opacity=".6"/>` +
      `<g ${anim("twitch", 120, 16, 0.4, 3.4)}><circle cx="121" cy="15.6" r="1.4" fill="${OL}"/><circle cx="121.4" cy="15.2" r=".45" fill="#fff"/><path d="M126 16.4L130 17.4L126 18.6Z" fill="#3a2a1e" stroke="${OL}" stroke-width=".6" stroke-linejoin="round"/></g>` +
      `<path d="M113 33L112 35.6M117 33L117 35.6" stroke="${OL}" stroke-width="1" stroke-linecap="round"/>` +
      `</g>` +
      [
        [70, 6, 0],
        [96, 4, 1.4],
        [140, 14, 0.8],
        [152, 40, 2],
      ]
        .map(([x, y, d]) => `<g ${anim("np-fall", x, y, d, 4)}><circle cx="${x}" cy="${y}" r="1.2" fill="#fff"/></g>`)
        .join(""),
  );

/* ── Mantar Bahçesi ──────────────────────────────────────────────────── */
function npMushroom(p: string, x: number, y: number, s: number, cap: string): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M-2.4 0C-2.8 -4 -2.2 -7 -2 -8H2C2.2 -7 2.8 -4 2.4 0Z" fill="#fff4e2" stroke="${OL}" stroke-width="1"/>` +
    `<path d="M-8 -7.4C-8 -13 -4 -16 0 -16C4 -16 8 -13 8 -7.4C8 -6.4 6 -6 0 -6C-6 -6 -8 -6.4 -8 -7.4Z" fill="${cap}" stroke="${OL}" stroke-width="1.1"/>` +
    `<circle cx="-3.6" cy="-11" r="1.3" fill="#fff"/><circle cx="2" cy="-13.4" r="1" fill="#fff"/><circle cx="4.4" cy="-9.4" r="1.1" fill="#fff"/>` +
    `<path d="M-5.6 -10.4C-4.6 -13 -2.4 -14.4 0 -14.6" stroke="#fff" stroke-opacity=".6" stroke-width="1" fill="none" stroke-linecap="round"/>` +
    `</g>`
  );
}

const mushroomGarden = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#0d2a2a"], [0.6, "#14403a"], [1, "#1f5a44"]])}${lin(`${p}ground`, [[0, "#3f8a3a"], [1, "#1d4a22"]])}${rad(`${p}red`, [[0, "#ff8a7a"], [0.6, "#e8352b"], [1, "#a8121d"]], 0.4, 0.3, 0.8)}${rad(`${p}teal`, [[0, "#b9fff0"], [0.6, "#2fc9b0"], [1, "#127a6c"]], 0.4, 0.3, 0.8)}${radU(`${p}ff`, [[0, "#f6ff8a", 0.95], [1, "#c8ff4a", 0]], 0, 0, 5)}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      `<path d="M20 48C50 40 80 38 110 40C130 41 148 38 160 36V48Z" fill="url(#${p}ground)"/>` +
      `<path d="M60 42Q62 36 64 41M72 41Q73 35 76 40M134 39Q136 33 138 38M150 38Q151 33 154 37" stroke="#7fd36a" stroke-width="1.2" fill="none" stroke-linecap="round"/>` +
      npMushroom(p, 104, 42, 1.1, `url(#${p}red)`) +
      npMushroom(p, 120, 41, 0.7, `url(#${p}teal)`) +
      npMushroom(p, 142, 40, 1.25, `url(#${p}red)`) +
      npMushroom(p, 88, 43, 0.6, `url(#${p}teal)`) +
      [
        [70, 18, 0],
        [92, 10, 0.7],
        [118, 22, 1.4],
        [132, 8, 0.4],
        [154, 18, 1.9],
        [80, 30, 1.1],
      ]
        .map(([x, y, d]) => `<g transform="translate(${x} ${y})"><g ${anim("twinkle", 0, 0, d, 1.4)}><circle r="5" fill="url(#${p}ff)"/><circle r="1.2" fill="#fbffc8"/></g></g>`)
        .join(""),
  );

/* ── Kuzey Işıkları ──────────────────────────────────────────────────── */
const northernLights = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#06101f"], [0.7, "#0e2340"], [1, "#183a5a"]])}${lin(`${p}aur`, [[0, "#3dffb4", 0], [0.4, "#3dffb4", 0.75], [1, "#7c4dff", 0]])}${lin(`${p}aur2`, [[0, "#b07cff", 0], [0.5, "#b07cff", 0.6], [1, "#2de0ff", 0]])}${lin(`${p}mt`, [[0, "#3a5372"], [1, "#16263c"]])}${lin(`${p}mt2`, [[0, "#22344d"], [1, "#0b1424"]])}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      stars(5, 18, "#dff3ff", 26) +
      `<g ${anim("drift", 110, 16, 0, 6)}><path d="M40 26C60 6 80 22 100 10C118 0 136 16 160 4V20C138 30 118 14 100 24C80 36 60 20 40 34Z" fill="url(#${p}aur)"/></g>` +
      `<g ${anim("drift", 110, 16, 2.4, 7)}><path d="M60 22C78 12 96 24 116 14C132 6 146 14 160 10V18C146 24 132 16 116 24C96 34 78 22 60 30Z" fill="url(#${p}aur2)"/></g>` +
      `<path d="M30 48L58 30L70 38L92 18L112 36L126 26L146 40L160 32V48Z" fill="url(#${p}mt)"/>` +
      `<path d="M92 18L86 24L90 23L93 26L96 22L99 24Z M126 26L122 29L126 28.4L129 30Z" fill="#eaf4ff"/>` +
      `<path d="M50 48L80 36L100 44L124 34L148 46L160 42V48Z" fill="url(#${p}mt2)"/>`,
  );

/* ── Kor Kıvılcımları ────────────────────────────────────────────────── */
const embers = (p: string) => {
  const r = rng(17);
  let sparks = "";
  for (let i = 0; i < 12; i++) {
    const x = 56 + r() * 104;
    const y = 30 + r() * 18;
    sparks += `<g ${anim("np-rise", x, y, r() * 3, 2.4 + r() * 1.6)}><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.7 + r() * 0.9).toFixed(2)}" fill="${i % 3 ? "#ffcf5a" : "#ff7a1f"}"/></g>`;
  }
  const flames = [
    [112, 48, 16, 6, 0],
    [128, 48, 22, 7, 0.3],
    [144, 48, 18, 6.4, 0.6],
    [156, 48, 12, 5, 0.2],
  ]
    .map(
      ([x, y, h, w, d]) =>
        `<g transform="translate(${x} ${y})"><g ${anim("flicker", 0, 0, d, 0.8)}><path d="M0 ${-h}C${w * 0.3} ${-h * 0.7} ${w} ${-h * 0.5} ${w * 0.9} ${-h * 0.15}C${w * 0.8} 2 ${-w * 0.8} 2 ${-w * 0.9} ${-h * 0.15}C${-w} ${-h * 0.45} ${-w * 0.2} ${-h * 0.6} 0 ${-h}Z" fill="url(#${p}fl)"/><path d="M0 ${-h * 0.5}C${w * 0.5} ${-h * 0.3} ${w * 0.5} 0 0 0C${-w * 0.5} 0 ${-w * 0.5} ${-h * 0.3} 0 ${-h * 0.5}Z" fill="#fff3b0"/></g></g>`,
    )
    .join("");
  return doc(
    `<defs>${lin(`${p}sky`, [[0, "#1a0a0a"], [0.6, "#3a1208"], [1, "#6e1f06"]])}${lin(`${p}fl`, [[0, "#ffd23a"], [0.5, "#ff7a00"], [1, "#ff2d1a"]], 0, 1, 0, 0)}${radU(`${p}heat`, [[0, "#ff7a00", 0.7], [1, "#ff3d00", 0]], 136, 50, 40)}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      `<g ${anim("pulse", 136, 50, 0, 1.6)}><circle cx="136" cy="50" r="40" fill="url(#${p}heat)"/></g>` +
      flames +
      sparks,
  );
};

/* ── Sakura Rüzgârı ──────────────────────────────────────────────────── */
function petal(x: number, y: number, rot: number, fill: string): string {
  return `<path d="M0 0C-2.6 -1.6 -3 -4.6 -1.2 -6C-0.4 -5.2 0.4 -5.2 1.2 -6C3 -4.6 2.6 -1.6 0 0Z" transform="translate(${x} ${y}) rotate(${rot})" fill="${fill}" stroke="#d45a8a" stroke-width=".5"/>`;
}

const sakura = (p: string) => {
  const r = rng(23);
  let flowers = "";
  const spots = [
    [118, 6],
    [128, 12],
    [140, 4],
    [150, 14],
    [106, 14],
    [134, 22],
    [156, 26],
    [146, 30],
  ];
  for (const [x, y] of spots) {
    const s = 0.8 + r() * 0.5;
    flowers += `<g transform="translate(${x} ${y}) scale(${s.toFixed(2)}) rotate(${(r() * 70).toFixed(0)})">${[0, 72, 144, 216, 288].map((a) => petal(0, 0, a, `url(#${p}petal)`)).join("")}<circle r="1.3" fill="#ffd54a"/></g>`;
  }
  let falling = "";
  for (let i = 0; i < 8; i++) {
    const x = 60 + r() * 96;
    const y = -4 + r() * 20;
    falling += `<g ${anim("np-fall", x, y, r() * 4, 3.4 + r() * 2)}>${petal(x, y, r() * 360, "#ffc1da")}</g>`;
  }
  return doc(
    `<defs>${lin(`${p}sky`, [[0, "#ffe9f2"], [0.6, "#ffd0e3"], [1, "#f6b7d2"]])}${lin(`${p}petal`, [[0, "#ffffff"], [1, "#ff9cc4"]])}${lin(`${p}branch`, [[0, "#6d4a3e"], [1, "#3f2a22"]])}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      `<circle cx="84" cy="34" r="18" fill="#fff" opacity=".35"/>` +
      `<path d="M160 0C150 6 138 8 126 9C116 10 108 14 100 18M138 8C142 14 148 20 158 24M126 9C130 16 136 22 142 30" fill="none" stroke="${OL}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="M160 0C150 6 138 8 126 9C116 10 108 14 100 18M138 8C142 14 148 20 158 24M126 9C130 16 136 22 142 30" fill="none" stroke="url(#${p}branch)" stroke-width="1.8" stroke-linecap="round"/>` +
      flowers +
      falling,
  );
};

/* ── Al Bayrak ───────────────────────────────────────────────────────── */
const flag = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#ff2a36"], [0.5, "#e30a17"], [1, "#b8000f"]], 0, 0, 1, 1)}${lin(`${p}fold`, [[0, "#000", 0], [0.5, "#000", 0.22], [1, "#000", 0]], 0, 0, 1, 0)}${lin(`${p}sheen`, [[0, "#fff", 0], [0.5, "#fff", 0.35], [1, "#fff", 0]], 0, 0, 1, 0)}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      // Kumaş kıvrımları (yavaşça kayar).
      `<g ${anim("drift", 100, 24, 0, 5)}><rect x="60" y="0" width="22" height="48" fill="url(#${p}fold)"/><rect x="100" y="0" width="26" height="48" fill="url(#${p}fold)"/><rect x="138" y="0" width="22" height="48" fill="url(#${p}fold)"/><rect x="80" y="0" width="16" height="48" fill="url(#${p}sheen)"/></g>` +
      `<g ${anim("breathe", 122, 24, 0, 3)}>` +
      `<circle cx="116" cy="24" r="15" fill="#fff"/><circle cx="119.75" cy="24" r="12" fill="#e30a17"/>` +
      `<path d="${starPath(134, 24, 7.5, 3, 180)}" fill="#fff"/>` +
      `</g>` +
      [
        [70, 10, 0],
        [88, 38, 1],
        [152, 8, 0.5],
        [154, 40, 1.5],
      ]
        .map(([x, y, d]) => `<g ${anim("twinkle", x, y, d, 1.8)}><path d="${sparklePath(x, y, 2.6)}" fill="#fff"/></g>`)
        .join(""),
  );

/* ── Yıldız Yolu (galaksi) ───────────────────────────────────────────── */
const galaxy = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#0a0620"], [0.6, "#1a0f45"], [1, "#2a1460"]])}${radU(`${p}neb`, [[0, "#ff5ad1", 0.55], [0.5, "#7c4dff", 0.3], [1, "#18c8ff", 0]], 110, 26, 46)}${rad(`${p}planet`, [[0, "#9ff3ff"], [0.6, "#4a8cff"], [1, "#2a3fa8"]], 0.35, 0.3, 0.75)}${lin(`${p}trail`, [[0, "#fff", 0], [1, "#fff", 0.9]], 0, 0, 1, 0)}</defs>` +
      `<rect width="160" height="48" fill="url(#${p}sky)"/>` +
      `<g ${anim("pulse", 110, 26, 0, 4)}><ellipse cx="110" cy="26" rx="56" ry="30" fill="url(#${p}neb)"/></g>` +
      stars(31, 20, "#fff", 44) +
      `<g ${anim("bob", 138, 24, 0, 3.2)}>` +
      `<circle cx="138" cy="24" r="10" fill="url(#${p}planet)" stroke="${OL}" stroke-width="1.1"/>` +
      `<ellipse cx="138" cy="24" rx="17" ry="4.4" transform="rotate(-14 138 24)" fill="none" stroke="${OL}" stroke-width="3"/>` +
      `<ellipse cx="138" cy="24" rx="17" ry="4.4" transform="rotate(-14 138 24)" fill="none" stroke="#ffd7a8" stroke-width="1.6"/>` +
      `<path d="M128 24A10 10 0 0 1 148 24" transform="rotate(-14 138 24)" fill="url(#${p}planet)"/>` +
      `<circle cx="134.4" cy="20" r="2.4" fill="#fff" opacity=".6"/>` +
      `</g>` +
      `<g ${anim("np-shoot", 100, 8, 0, 4)}><path d="M78 2L100 8" stroke="url(#${p}trail)" stroke-width="1.4" stroke-linecap="round"/><circle cx="100" cy="8" r="1.4" fill="#fff"/></g>`,
  );

export const NAMEPLATE_ART: Record<string, (p: string) => string> = {
  np_iskelet_dansi: skeletonDance,
  np_perili_orman: hauntedForest,
  np_uyuyan_kedi: sleepingCat,
  np_kizilgerdan: robin,
  np_mantar_bahcesi: mushroomGarden,
  np_kuzey_isiklari: northernLights,
  np_kor: embers,
  np_sakura: sakura,
  np_al_bayrak: flag,
  np_yildiz_yolu: galaxy,
};

