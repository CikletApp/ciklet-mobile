/**
 * Gece gökyüzü, ateş ve buz, bahar bahçesi ve Türkiye avatar süsleri.
 * Çizim kuralları için bkz. types.ts / kit.ts.
 */
import { OL, anim, blob, cloudBand, lin, polar, rad, radU, rng, sparklePath, starPath, svgDoc, wavyArc } from "./kit";
import { DECO_VIEWBOX, type DecorationArt } from "./types";

const doc = (body: string) => svgDoc(DECO_VIEWBOX, body, 'overflow="visible"');

function twinkleStar(x: number, y: number, r: number, fill: string, delay: number, four = true): string {
  return `<g ${anim("twinkle", x, y, delay, 1.6 + (delay % 1))}><path d="${four ? sparklePath(x, y, r) : starPath(x, y, r)}" fill="${fill}"/></g>`;
}

/* ── Hilal ve Yıldızlar ───────────────────────────────────────────────── */
const crescentMoon: DecorationArt = {
  back: (p) =>
    doc(
      `<defs>` +
        lin(`${p}moon`, [[0, "#fffbe6"], [0.45, "#ffe58a"], [1, "#f2b33d"]], 0, 0, 1, 1) +
        radU(`${p}halo`, [[0.55, "#ffe9a8", 0], [0.8, "#ffd66b", 0.4], [1, "#ffd66b", 0]], 56, 56, 72) +
        `<mask id="${p}cut"><rect x="-20" y="-20" width="170" height="170" fill="#fff"/><circle cx="71" cy="71" r="56" fill="#000"/></mask>` +
        `</defs>` +
        `<g ${anim("pulse", 56, 56, 0, 3.4)}><circle cx="56" cy="56" r="72" fill="url(#${p}halo)" mask="url(#${p}cut)"/></g>` +
        `<g mask="url(#${p}cut)">` +
        `<circle cx="60" cy="60" r="58" fill="url(#${p}moon)" stroke="${OL}" stroke-width="1.8"/>` +
        `<circle cx="16" cy="40" r="4.2" fill="#e9a93a" opacity=".55"/><circle cx="34" cy="14" r="3" fill="#e9a93a" opacity=".5"/><circle cx="10" cy="68" r="2.4" fill="#e9a93a" opacity=".5"/>` +
        `<path d="M8 52C10 34 22 18 40 10" stroke="#fff" stroke-opacity=".85" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
        `</g>`,
    ),
  front: (p) =>
    doc(
      `<defs>${lin(`${p}cloud`, [[0, "#ffffff"], [1, "#cfd8ff"]])}</defs>` +
        `<g ${anim("drift", 20, 106, 0, 6)}>` +
        `<path d="M4 110C2 103 8 98 14 100C16 93 26 91 30 97C35 95 41 99 40 105C44 106 45 112 40 114H8C4 114 3 112 4 110Z" fill="url(#${p}cloud)" stroke="${OL}" stroke-width="1.4" stroke-linejoin="round"/>` +
        `<path d="M14 104C16 101 19 100 22 101" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
        `</g>` +
        twinkleStar(112, 24, 5, "#fff6c9", 0, false) +
        twinkleStar(122, 50, 3.4, "#ffffff", 0.7) +
        twinkleStar(116, 84, 4, "#ffe58a", 1.3, false) +
        twinkleStar(96, 8, 3, "#ffffff", 1.8) +
        twinkleStar(124, 70, 2.2, "#ffe58a", 0.4),
    ),
};

/* ── Galaksi Yörüngesi ────────────────────────────────────────────────── */
const ORBIT_TILT = -18;
const ORBIT_RY = 0.3;

function planet(p: string): string {
  // Yörünge düzleminin basıklığını geri al: gezegen yuvarlak kalsın.
  return (
    `<g transform="scale(1 ${1 / ORBIT_RY})">` +
    `<circle r="7.4" fill="url(#${p}planet)" stroke="${OL}" stroke-width="1.4"/>` +
    `<path d="M-6 -1.6C-2 -3 3 -3.4 7 -2.2M-6.6 2C-2 1 3 1.4 6.4 2.6" stroke="#fff" stroke-opacity=".3" stroke-width="1.2" fill="none"/>` +
    `<ellipse rx="12" ry="3.2" transform="rotate(-16)" fill="none" stroke="${OL}" stroke-width="3"/>` +
    `<ellipse rx="12" ry="3.2" transform="rotate(-16)" fill="none" stroke="#ffd7a8" stroke-width="1.6"/>` +
    `<path d="M-7.4 0A7.4 7.4 0 0 1 7.4 0" transform="rotate(-16)" fill="url(#${p}planet)"/>` +
    `<circle cx="-2.6" cy="-3" r="1.8" fill="#fff" opacity=".7"/>` +
    `</g>`
  );
}

function orbit(p: string, front: boolean): string {
  const ring =
    `<ellipse rx="60" ry="${60 * ORBIT_RY}" fill="none" stroke="url(#${p}orbit)" stroke-width="5" opacity=".35"/>` +
    `<ellipse rx="60" ry="${60 * ORBIT_RY}" fill="none" stroke="url(#${p}orbit)" stroke-width="1.8"/>`;
  const spin =
    `<g transform="scale(1 ${ORBIT_RY})"><g ${anim("spin", 0, 0, 0, 14)}>` +
    `<g transform="translate(60 0)"><g ${anim("spin-rev", 0, 0, 0, 14)}>${planet(p)}</g></g>` +
    `<g transform="translate(-60 0)"><g ${anim("spin-rev", 0, 0, 0, 14)}><g transform="scale(1 ${1 / ORBIT_RY})"><circle r="3" fill="#9ff3ff" stroke="${OL}" stroke-width="1.1"/><circle cx="-1" cy="-1" r=".9" fill="#fff"/></g></g></g>` +
    `</g></g>`;
  const clip = front ? ` clip-path="url(#${p}front)"` : "";
  return `<g transform="translate(64 64) rotate(${ORBIT_TILT})"${clip}>${ring}${spin}</g>`;
}

const galaxyDefs = (p: string) =>
  lin(`${p}orbit`, [[0, "#7cf3ff"], [0.5, "#b388ff"], [1, "#ff7ad9"]], 0, 0, 1, 0) +
  rad(`${p}planet`, [[0, "#ffd29a"], [0.6, "#ff8a65"], [1, "#b8406a"]], 0.35, 0.3, 0.75) +
  `<clipPath id="${p}front"><rect x="-80" y="0" width="160" height="60"/></clipPath>`;

const galaxyOrbit: DecorationArt = {
  back: (p) =>
    doc(
      `<defs>${galaxyDefs(p)}${radU(`${p}neb`, [[0.6, "#7c4dff", 0], [0.78, "#7c4dff", 0.5], [0.9, "#18c8ff", 0.25], [1, "#18c8ff", 0]], 64, 64, 66)}</defs>` +
        `<g ${anim("pulse", 64, 64, 0, 3)}><circle cx="64" cy="64" r="66" fill="url(#${p}neb)"/></g>` +
        orbit(p, false),
    ),
  front: (p) => {
    const r = rng(7);
    let dust = "";
    for (let i = 0; i < 6; i++) {
      const [x, y] = polar(64, 64, 54 + r() * 10, -170 + i * 30 + r() * 10);
      dust += twinkleStar(x, y, 1.6 + r() * 2.4, i % 2 ? "#c9f6ff" : "#ffffff", i * 0.37);
    }
    return doc(`<defs>${galaxyDefs(p)}</defs>` + orbit(p, true) + dust);
  },
};

/* ── Alev Halkası ─────────────────────────────────────────────────────── */
function flamePath(h: number, w: number): string {
  return `M0 ${-h}C${w * 0.25} ${-h * 0.72} ${w * 1.05} ${-h * 0.5} ${w * 0.9} ${-h * 0.16}C${w * 0.8} ${h * 0.08} ${w * 0.4} ${h * 0.16} 0 ${h * 0.16}C${-w * 0.4} ${h * 0.16} ${-w * 0.8} ${h * 0.08} ${-w * 0.9} ${-h * 0.16}C${-w * 1.05} ${-h * 0.46} ${-w * 0.1} ${-h * 0.6} ${-w * 0.15} ${-h * 0.82}C${-w * 0.1} ${-h * 0.9} ${-w * 0.05} ${-h * 0.96} 0 ${-h}Z`;
}

function flame(p: string, deg: number, r: number, h: number, w: number, delay: number): string {
  const [x, y] = polar(64, 64, r, deg);
  // Alevler dışa doğru ama yukarı kıvrılır (ısı yükselir).
  const out = deg + 90;
  const up = 0;
  let diff = ((up - out + 540) % 360) - 180;
  diff *= 0.4;
  const rot = out + diff;
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot.toFixed(1)})"><g ${anim("flicker", 0, 0, delay, 0.7 + (delay % 0.5))}>` +
    `<path d="${flamePath(h, w)}" fill="url(#${p}fl)" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="${flamePath(h * 0.55, w * 0.5)}" fill="url(#${p}core)"/>` +
    `</g></g>`
  );
}

const flameDefs = (p: string) =>
  lin(`${p}fl`, [[0, "#ff2d1a"], [0.45, "#ff7a00"], [1, "#ffd23a"]]) + lin(`${p}core`, [[0, "#ffd23a"], [1, "#fffbe0"]]);

const flameRing: DecorationArt = {
  back: (p) => {
    let flames = "";
    const N = 16;
    for (let i = 0; i < N; i++) {
      const deg = -90 + (360 * i) / N + (i % 2 ? 6 : 0);
      // Üst yarıda daha uzun alevler (yükselen ısı).
      const top = Math.max(0, -Math.sin((deg * Math.PI) / 180));
      flames += flame(p, deg, 44, 14 + top * 12 + (i % 3) * 2, 6 + top * 1.6, (i * 0.23) % 1);
    }
    return doc(
      `<defs>${flameDefs(p)}${radU(`${p}glow`, [[0.6, "#ff5a00", 0], [0.76, "#ff7a00", 0.55], [1, "#ff3d00", 0]], 64, 60, 68)}</defs>` +
        `<g ${anim("pulse", 64, 64, 0, 1.4)}><circle cx="64" cy="60" r="68" fill="url(#${p}glow)"/></g>` +
        flames,
    );
  },
  front: (p) => {
    let front = "";
    [104, 122, 140, 160, 58, 76].forEach((deg, i) => {
      front += flame(p, deg, 47, 12 + (i % 2) * 4, 5.4, i * 0.31);
    });
    const embers = [
      [20, 14, 0],
      [104, 6, 0.6],
      [118, 30, 1.2],
      [8, 50, 1.7],
      [58, -2, 0.9],
    ]
      .map(([x, y, d]) => `<g ${anim("twinkle", x, y, d, 1.2)}><circle cx="${x}" cy="${y}" r="1.8" fill="#ffd23a"/><circle cx="${x}" cy="${y}" r="3.6" fill="#ff7a00" opacity=".35"/></g>`)
      .join("") +
      // Alevlerden kopup yükselen kıvılcımlar.
      [
        [30, 30, 0],
        [96, 22, 0.9],
        [64, 12, 1.7],
        [14, 70, 2.4],
        [114, 62, 1.2],
        [46, 8, 2.9],
      ]
        .map(([x, y, d]) => `<g ${anim("ember", x, y, d, 2.2)}><circle cx="${x}" cy="${y}" r="1.2" fill="#fff1a8"/><circle cx="${x}" cy="${y}" r="2.6" fill="#ff8a00" opacity=".4"/></g>`)
        .join("");
    return doc(`<defs>${flameDefs(p)}</defs>` + front + embers);
  },
};

/* ── Buz Kristali Tacı ────────────────────────────────────────────────── */
function shard(p: string, deg: number, r: number, L: number, w: number, delay: number): string {
  const [x, y] = polar(64, 64, r, deg);
  return (
    `<g transform="translate(${x} ${y}) rotate(${deg + 90})"><g ${anim("breathe", 0, 0, delay, 3)}>` +
    `<path d="M${-w} 2L${-w * 0.92} ${-L * 0.68}L0 ${-L}L${w * 0.92} ${-L * 0.68}L${w} 2Z" fill="url(#${p}iceR)" stroke="${OL}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M${-w + 0.8} 1.6L${-w * 0.92 + 0.6} ${-L * 0.68}L0 ${-L + 1.4}L0 1.6Z" fill="url(#${p}iceL)"/>` +
    `<path d="M${-w * 0.5} ${-L * 0.2}L${-w * 0.45} ${-L * 0.6}" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
    `</g></g>`
  );
}

function snowflake(x: number, y: number, r: number, delay: number): string {
  let d = "";
  for (let k = 0; k < 6; k++) {
    const [ex, ey] = polar(x, y, r, k * 60);
    const [bx, by] = polar(x, y, r * 0.55, k * 60);
    const [l1x, l1y] = polar(bx, by, r * 0.35, k * 60 - 50);
    const [l2x, l2y] = polar(bx, by, r * 0.35, k * 60 + 50);
    d += `M${x} ${y}L${ex} ${ey}M${bx} ${by}L${l1x} ${l1y}M${bx} ${by}L${l2x} ${l2y}`;
  }
  return `<g ${anim("twinkle", x, y, delay, 2.2)}><path d="${d}" stroke="#eaf9ff" stroke-width="1.1" stroke-linecap="round"/></g>`;
}

const iceCrown: DecorationArt = {
  back: (p) => {
    const spec: [number, number, number][] = [
      [-158, 14, 5],
      [-140, 20, 6],
      [-122, 26, 6.4],
      [-106, 30, 7],
      [-90, 36, 7.6],
      [-74, 30, 7],
      [-58, 26, 6.4],
      [-40, 20, 6],
      [-22, 14, 5],
    ];
    return doc(
      `<defs>${lin(`${p}iceL`, [[0, "#ffffff"], [1, "#c8f1ff"]])}${lin(`${p}iceR`, [[0, "#9fe3ff"], [1, "#3f9fd8"]])}${radU(`${p}frost`, [[0.62, "#bff0ff", 0], [0.8, "#bff0ff", 0.45], [1, "#bff0ff", 0]], 64, 64, 64)}</defs>` +
        `<g ${anim("pulse", 64, 64, 0, 3)}><circle cx="64" cy="64" r="64" fill="url(#${p}frost)"/></g>` +
        spec.map(([deg, L, w], i) => shard(p, deg, 45, L, w, i * 0.4)).join(""),
    );
  },
  front: (p) => {
    // Kenarı saran kırağı: ince buz bandı + kristal boncuklar.
    const band = wavyArc(64, 64, 48, 1, 12, 0, -172, -8);
    let beads = "";
    for (let deg = -164; deg <= -16; deg += 18) {
      const [x, y] = polar(64, 64, 48, deg);
      beads += `<path d="M${x} ${y - 3.2}L${x + 2.2} ${y}L${x} ${y + 3.2}L${x - 2.2} ${y}Z" fill="url(#${p}iceL)" stroke="${OL}" stroke-width=".9"/>`;
    }
    return doc(
      `<defs>${lin(`${p}iceL`, [[0, "#ffffff"], [1, "#9fe3ff"]])}</defs>` +
        `<path d="${band}" fill="none" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="${band}" fill="none" stroke="#bfefff" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="${band}" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="1 4" stroke-linecap="round"/>` +
        beads +
        snowflake(14, 94, 5, 0.3) +
        snowflake(116, 96, 4, 1.1) +
        snowflake(6, 120, 3, 1.6) +
        twinkleStar(64, -4, 4, "#ffffff", 0.8) +
        twinkleStar(24, 6, 3, "#dff6ff", 1.4),
    );
  },
};

/* ── Çiçek Çelengi ────────────────────────────────────────────────────── */
function leafShape(x: number, y: number, rot: number, s: number, fill: string): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C3 -4 9 -5 13 -1C9 3 3 3 0 0Z" fill="${fill}" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/><path d="M1 0H10" stroke="#2f5a1c" stroke-opacity=".45" stroke-width=".7"/></g>`;
}

function blossom(p: string, x: number, y: number, s: number, kind: "pink" | "daisy" | "blue", rot = 0): string {
  if (kind === "daisy") {
    const petals = Array.from({ length: 10 }, (_, k) => `<ellipse cx="0" cy="-4.6" rx="1.5" ry="3.6" transform="rotate(${k * 36})" fill="#ffffff" stroke="${OL}" stroke-width=".8"/>`).join("");
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${petals}<circle r="2.6" fill="url(#${p}sun)" stroke="${OL}" stroke-width=".9"/></g>`;
  }
  const c = kind === "pink" ? `url(#${p}petal)` : `url(#${p}blue)`;
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<path d="M0 0C-3.6 -2 -4.4 -6.4 -2 -8.4C-1 -7.4 1 -7.4 2 -8.4C4.4 -6.4 3.6 -2 0 0Z" transform="rotate(${a})" fill="${c}" stroke="${OL}" stroke-width=".9" stroke-linejoin="round"/>`)
    .join("");
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${petals}<circle r="1.9" fill="#ffd54a" stroke="${OL}" stroke-width=".8"/><circle cx="-.6" cy="-.6" r=".6" fill="#fff"/></g>`;
}

function butterfly(p: string): string {
  return (
    `<g ${anim("flutter", 0, 0, 0, 0.35)}>` +
    `<path d="M0 0C-4 -8 -11 -9 -11 -4C-11 -1 -6 1 0 0ZM0 0C-3 3 -8 7 -9 4C-10 2 -6 0 0 0Z" fill="url(#${p}wing)" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M0 0C4 -8 11 -9 11 -4C11 -1 6 1 0 0ZM0 0C3 3 8 7 9 4C10 2 6 0 0 0Z" fill="url(#${p}wing)" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/>` +
    `<circle cx="-6" cy="-4.4" r="1.3" fill="#fff" opacity=".8"/><circle cx="6" cy="-4.4" r="1.3" fill="#fff" opacity=".8"/>` +
    `</g>` +
    `<path d="M0 -4V4" stroke="${OL}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M0 -4C-1 -6 -2 -7 -3 -7M0 -4C1 -6 2 -7 3 -7" stroke="${OL}" stroke-width=".7" fill="none"/>`
  );
}

const flowerDefs = (p: string) =>
  lin(`${p}petal`, [[0, "#fff0f6"], [0.6, "#ffb3d1"], [1, "#ff7fb0"]]) +
  lin(`${p}blue`, [[0, "#eef6ff"], [1, "#8fb8ff"]]) +
  rad(`${p}sun`, [[0, "#fff3a6"], [1, "#ffbf1f"]]) +
  lin(`${p}leaf`, [[0, "#a6dd6b"], [1, "#4f9a3a"]]) +
  lin(`${p}wing`, [[0, "#ffe1f0"], [1, "#c58bff"]], 0, 0, 1, 1);

const flowerWreath: DecorationArt = {
  front: (p) => {
    let leaves = "";
    const r = rng(11);
    for (let deg = 70; deg <= 262; deg += 9) {
      const out = r() > 0.5;
      const [x, y] = polar(64, 64, out ? 50 : 47, deg);
      leaves += leafShape(x, y, deg + (out ? 70 : -110) + r() * 30, 0.9 + r() * 0.3, `url(#${p}leaf)`);
    }
    const vine = wavyArc(64, 64, 49, 1.4, 9, 0, 66, 266);
    const flowers =
      blossom(p, ...polar(64, 64, 50, 250), 1.2, "pink", 10) +
      blossom(p, ...polar(64, 64, 51, 232), 0.9, "daisy") +
      blossom(p, ...polar(64, 64, 49, 214), 0.75, "blue", 30) +
      blossom(p, ...polar(64, 64, 50, 186), 1.15, "pink", -20) +
      blossom(p, ...polar(64, 64, 51, 160), 0.8, "daisy") +
      blossom(p, ...polar(64, 64, 49, 140), 1.25, "pink", 40) +
      blossom(p, ...polar(64, 64, 50, 118), 0.75, "blue") +
      blossom(p, ...polar(64, 64, 50, 98), 1, "daisy") +
      blossom(p, ...polar(64, 64, 49, 76), 0.85, "pink", 12);
    return doc(
      `<defs>${flowerDefs(p)}</defs>` +
        `<path d="${vine}" fill="none" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="${vine}" fill="none" stroke="#5d9a3a" stroke-width="1.6" stroke-linecap="round"/>` +
        leaves +
        flowers +
        `<g transform="translate(108 22) rotate(18)"><g ${anim("float", 0, 0, 0, 2.6)}>${butterfly(p)}</g></g>` +
        twinkleStar(120, 46, 3, "#fff3fa", 0.5) +
        twinkleStar(92, 6, 2.6, "#ffffff", 1.2),
    );
  },
};

/* ── Mantar Halkası ───────────────────────────────────────────────────── */
function mushroom(p: string, x: number, y: number, rot: number, s: number, cap: string, dots: boolean): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">` +
    `<path d="M-3.4 2C-3.8 -3 -3 -8 -2.6 -10H2.6C3 -8 3.8 -3 3.4 2C2 3 -2 3 -3.4 2Z" fill="url(#${p}stem)" stroke="${OL}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M-1.6 -1V-8" stroke="#fff" stroke-opacity=".7" stroke-width="1" stroke-linecap="round"/>` +
    `<path d="M-11 -9C-11 -17 -5 -21 0 -21C5 -21 11 -17 11 -9C11 -7.4 9 -7 0 -7C-9 -7 -11 -7.4 -11 -9Z" fill="${cap}" stroke="${OL}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M-9 -8.4C-4 -6.6 4 -6.6 9 -8.4" stroke="${OL}" stroke-opacity=".4" stroke-width=".9" fill="none"/>` +
    (dots ? `<ellipse cx="-5" cy="-14" rx="2" ry="1.6" fill="#fff"/><ellipse cx="2" cy="-17.6" rx="1.6" ry="1.2" fill="#fff"/><ellipse cx="6" cy="-12" rx="1.6" ry="1.3" fill="#fff"/><ellipse cx="-1" cy="-11" rx="1.1" ry=".9" fill="#fff"/>` : "") +
    `<path d="M-7.6 -13.6C-6.4 -17 -3.4 -19 -0.4 -19.2" stroke="#fff" stroke-opacity=".6" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
    `</g>`
  );
}

function firefly(x: number, y: number, delay: number): string {
  return `<g ${anim("twinkle", x, y, delay, 1.4)}><circle cx="${x}" cy="${y}" r="5" fill="url(#ffglow)"/><circle cx="${x}" cy="${y}" r="1.5" fill="#fbffc8"/></g>`;
}

const mushroomRing: DecorationArt = {
  front: (p) => {
    const moss = cloudBand(64, 64, 45, 52.5, 92, 196, 13);
    const grass = [100, 112, 126, 150, 172, 188]
      .map((deg) => {
        const [x, y] = polar(64, 64, 52, deg);
        const [tx, ty] = polar(64, 64, 60, deg - 6);
        return `M${x} ${y}Q${(x + tx) / 2 + 1} ${(y + ty) / 2} ${tx} ${ty}`;
      })
      .join("");
    return doc(
      `<defs>` +
        lin(`${p}moss`, [[0, "#8fd16a"], [1, "#3f7d34"]], 0, 0, 1, 1) +
        lin(`${p}stem`, [[0, "#fffaf0"], [1, "#e3d2b8"]], 0, 0, 1, 0) +
        rad(`${p}red`, [[0, "#ff8a7a"], [0.6, "#e8352b"], [1, "#a8121d"]], 0.4, 0.3, 0.8) +
        rad(`${p}brown`, [[0, "#e7b98a"], [0.6, "#b0703e"], [1, "#7a4420"]], 0.4, 0.3, 0.8) +
        rad(`${p}violet`, [[0, "#e6c9ff"], [0.6, "#9b5de5"], [1, "#5b2a9a"]], 0.4, 0.3, 0.8) +
        `<radialGradient id="ffglow"><stop offset="0" stop-color="#f6ff8a" stop-opacity=".9"/><stop offset="1" stop-color="#c8ff4a" stop-opacity="0"/></radialGradient>`.replace(/ffglow/g, `${p}ff`) +
        `</defs>` +
        `<path d="${moss}" fill="url(#${p}moss)" stroke="${OL}" stroke-width="1.4" stroke-linejoin="round"/>` +
        `<path d="${grass}" fill="none" stroke="#5aa53c" stroke-width="1.6" stroke-linecap="round"/>` +
        mushroom(p, ...polar(64, 64, 53, 176), 66, 0.8, `url(#${p}brown)`, false) +
        mushroom(p, ...polar(64, 64, 52, 148), 46, 1.25, `url(#${p}red)`, true) +
        mushroom(p, ...polar(64, 64, 52, 126), 28, 0.9, `url(#${p}violet)`, true) +
        mushroom(p, ...polar(64, 64, 52, 106), 14, 0.7, `url(#${p}red)`, true) +
        [
          [14, 30, 0],
          [30, 6, 0.8],
          [108, 16, 0.4],
          [122, 52, 1.3],
          [6, 64, 1.8],
        ]
          .map(([x, y, d]) => firefly(x, y, d).replace("url(#ffglow)", `url(#${p}ff)`))
          .join(""),
    );
  },
};

/* ── Ay Yıldız (Türkiye) ──────────────────────────────────────────────── */
/** Ay-yıldız (bayrak oranlarına yakın; yükseklik G). */
function crescentStar(x: number, y: number, G: number, fill = "#fff", bg = "#e30a17"): string {
  return (
    `<circle cx="${x}" cy="${y}" r="${G * 0.25}" fill="${fill}"/>` +
    `<circle cx="${x + G * 0.0625}" cy="${y}" r="${G * 0.2}" fill="${bg}"/>` +
    `<path d="${starPath(x + G * 0.3, y, G * 0.125, G * 0.05, 180)}" fill="${fill}"/>`
  );
}

const turkiye: DecorationArt = {
  back: (p) =>
    doc(
      `<defs>${radU(`${p}glow`, [[0.62, "#e30a17", 0], [0.78, "#ff2a36", 0.55], [1, "#e30a17", 0]], 64, 64, 64)}</defs>` +
        `<g ${anim("pulse", 64, 64, 0, 2.4)}><circle cx="64" cy="64" r="64" fill="url(#${p}glow)"/></g>`,
    ),
  front: (p) => {
    // Alt yarıyı saran kırmızı ipek kurdele.
    const ribbon = wavyArc(64, 64, 50, 1.6, 4, 0, 24, 156);
    const [px, py] = polar(64, 64, 51, -140);
    const [tx, ty] = polar(64, 64, 76, -140);
    return doc(
      `<defs>${lin(`${p}silk`, [[0, "#ff4b55"], [0.5, "#e30a17"], [1, "#a8000d"]])}${lin(`${p}flag`, [[0, "#ff2b37"], [0.5, "#e30a17"], [1, "#c20010"]], 0, 0, 1, 1)}${lin(`${p}gold`, [[0, "#fff2b0"], [1, "#d69a1c"]])}</defs>` +
        `<path d="${ribbon}" fill="none" stroke="${OL}" stroke-width="9.4" stroke-linecap="round"/>` +
        `<path d="${ribbon}" fill="none" stroke="url(#${p}silk)" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="${wavyArc(64, 64, 48.4, 1.6, 4, 0, 34, 146)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.1" stroke-linecap="round"/>` +
        `<g transform="translate(64 114)"><circle r="8.4" fill="#e30a17" stroke="${OL}" stroke-width="1.5"/><circle r="6.8" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>${crescentStar(-2.4, 0, 14)}</g>` +
        // Direk + dalgalanan bayrak.
        `<path d="M${px} ${py}L${tx} ${ty}" stroke="${OL}" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M${px} ${py}L${tx} ${ty}" stroke="url(#${p}gold)" stroke-width="1.8" stroke-linecap="round"/>` +
        `<circle cx="${tx}" cy="${ty}" r="2.4" fill="url(#${p}gold)" stroke="${OL}" stroke-width="1.1"/>` +
        `<g transform="translate(${tx + 1} ${ty + 1.6}) rotate(-12)"><g ${anim("flag", 0, 0, 0, 1.6)}>` +
        blob(16, 21, 15, 2.4, "#000", 0.12) +
        `<path d="M0 0C8 -2.4 16 2.4 30 -0.6V18.4C16 21.4 8 16.6 0 19Z" fill="url(#${p}flag)" stroke="${OL}" stroke-width="1.4" stroke-linejoin="round"/>` +
        `<path d="M0 0C8 -2.4 16 2.4 30 -0.6V3C16 6 8 1.2 0 3.4Z" fill="#fff" opacity=".18"/>` +
        crescentStar(10, 9.4, 18) +
        `</g></g>` +
        twinkleStar(114, 30, 4, "#ffffff", 0.2, false) +
        twinkleStar(122, 58, 2.8, "#ffd6d9", 1) +
        twinkleStar(100, 10, 2.6, "#ffffff", 1.6),
    );
  },
};

export const NATURE_DECORATIONS: Record<string, DecorationArt> = {
  hilal: crescentMoon,
  galaksi: galaxyOrbit,
  alev: flameRing,
  buz_taci: iceCrown,
  cicek: flowerWreath,
  mantar: mushroomRing,
  turkiye,
};

