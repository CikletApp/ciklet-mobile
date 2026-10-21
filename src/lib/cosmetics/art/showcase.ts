/**
 * Vitrin sahneleri — mağaza kartında ürünün ARKASINA serilen atmosferik
 * tam kart çizimi (ay ışıklı mezarlık, korlu karanlık, kutup ışıklı gök…).
 * Ürün (süslü avatar / plaka / efekt) bunun üstünde gösterilir.
 *
 * 320×200 viewBox, `xMidYMid slice` (kartın oranına göre kırpılır). Hareket
 * `ck-a` sınıflarıyla (kapsayıcıda `ck-live` gerekir). Saf SVG metni.
 */
import { anim, lin, rad, radU, rng, sparklePath, starPath, svgDoc } from "./kit";
import { bat } from "./figures";

export type ShowcaseBackdropId = "mezarlik" | "pastel" | "gece" | "ates" | "buz" | "bahar" | "orman" | "turkiye";

const doc = (body: string) => svgDoc("0 0 320 200", body, 'preserveAspectRatio="xMidYMid slice"');

function starfield(seed: number, count: number, yMax: number, color = "#fff"): string {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = r() * 320;
    const y = r() * yMax;
    const s = 0.4 + r() * 1.1;
    out +=
      i % 4 === 0
        ? `<g ${anim("twinkle", x, y, r() * 3, 1.6 + r() * 2)}><path d="${sparklePath(x, y, s * 3)}" fill="${color}"/></g>`
        : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(s * 0.7).toFixed(2)}" fill="${color}" opacity="${(0.35 + r() * 0.6).toFixed(2)}"/>`;
  }
  return out;
}

function rising(seed: number, count: number, color: string, glow: string, yFrom = 150): string {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = r() * 320;
    const y = yFrom + r() * 50;
    out += `<g ${anim("sc-rise", x, y, r() * 6, 5 + r() * 4)}><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2.6 + r() * 2).toFixed(1)}" fill="${glow}" opacity=".35"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + r() * 0.8).toFixed(1)}" fill="${color}"/></g>`;
  }
  return out;
}

function deadTree(x: number, base: number, s: number, fill: string): string {
  return `<g transform="translate(${x} ${base}) scale(${s})"><path d="M-3 0C-2 -14 -3 -26 -1 -38C-6 -44 -14 -46 -20 -52C-13 -50 -7 -48 -1 -44C0 -50 -3 -58 -8 -64C-2 -60 1 -54 2 -46C6 -52 12 -54 18 -60C13 -52 8 -46 3 -38C4 -26 4 -14 5 0Z" fill="${fill}"/></g>`;
}

function tomb(x: number, base: number, s: number, fill: string, cross = false): string {
  return cross
    ? `<path transform="translate(${x} ${base}) scale(${s})" d="M-2 0V-14H-7V-18H-2V-24H2V-18H7V-14H2V0Z" fill="${fill}"/>`
    : `<path transform="translate(${x} ${base}) scale(${s})" d="M-7 0V-12C-7 -20 7 -20 7 -12V0Z" fill="${fill}"/>`;
}

/** Yavaşça sürüklenen sis şeridi (`<p>fog` gradyanı tanımlı olmalı). */
function fog(p: string, y: number, h: number, delay: number): string {
  // Kabarık üst kenarlı, alta doğru erüyen sis bulutu.
  let d = `M-40 ${y + h}V${y + h * 0.55}`;
  for (let x = -40; x < 360; x += 40) d += `Q${x + 20} ${y - h * 0.15} ${x + 40} ${y + h * 0.5}`;
  d += `V${y + h}Z`;
  return `<g ${anim("sc-drift", 160, y, delay, 14)}><path d="${d}" fill="url(#${p}fog)"/></g>`;
}

/* ── Ay ışıklı mezarlık ───────────────────────────────────────────────── */
const graveyard = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#120a26"], [0.55, "#2c1752"], [1, "#4a2a6e"]])}${radU(`${p}moon`, [[0, "#fff6dc", 0.95], [0.25, "#ffe6a8", 0.45], [1, "#9a6cff", 0]], 236, 52, 90)}${lin(`${p}fog`, [[0, "#d6c9ff", 0.45], [1, "#8f74e0", 0]])}${lin(`${p}hill`, [[0, "#22163a"], [1, "#0c0716"]])}</defs>` +
      `<rect width="320" height="200" fill="url(#${p}sky)"/>` +
      starfield(3, 46, 110, "#efe6ff") +
      `<g ${anim("pulse", 236, 52, 0, 5)}><circle cx="236" cy="52" r="90" fill="url(#${p}moon)"/></g>` +
      `<circle cx="236" cy="52" r="24" fill="#fff8e2"/><circle cx="228" cy="46" r="4.4" fill="#eadbb0" opacity=".7"/><circle cx="244" cy="60" r="3" fill="#eadbb0" opacity=".7"/><circle cx="242" cy="42" r="2" fill="#eadbb0" opacity=".6"/>` +
      `<path d="M0 150C60 132 110 140 160 146C220 152 270 132 320 138V200H0Z" fill="#1d1233"/>` +
      deadTree(40, 150, 1.5, "#140b26") +
      deadTree(290, 142, 1.2, "#140b26") +
      fog(p, 128, 22, 0) +
      `<path d="M0 168C70 156 140 162 200 166C250 170 290 160 320 162V200H0Z" fill="url(#${p}hill)"/>` +
      tomb(70, 170, 1.4, "#2c2048") +
      tomb(104, 168, 1.1, "#2c2048", true) +
      tomb(214, 168, 1.3, "#2c2048") +
      tomb(256, 170, 1, "#2c2048", true) +
      // Demir parmaklık.
      `<path d="M0 186H320M0 180H320" stroke="#0e0819" stroke-width="2"/>` +
      Array.from({ length: 33 }, (_, i) => `M${i * 10} 192V176L${i * 10 + 2} 172L${i * 10 + 4} 176V192`).reduce((a, d) => a + d, `<path d="`) +
      `" fill="#0e0819"/>` +
      fog(p, 160, 26, 5) +
      `<g transform="translate(120 46) scale(1.1)"><g ${anim("bob", 0, 0, 0.3, 2.2)}>${bat("#160d26", "#2e1d48")}</g></g>` +
      `<g transform="translate(150 30) scale(.8)"><g ${anim("bob", 0, 0, 1.1, 2.6)}>${bat("#160d26", "#2e1d48")}</g></g>` +
      `<g transform="translate(286 92) scale(.7)"><g ${anim("bob", 0, 0, 0.7, 2)}>${bat("#160d26", "#2e1d48")}</g></g>` +
      rising(7, 8, "#b9ffdf", "#5cffb0", 150),
  );

/* ── Pastel (sevimli) ─────────────────────────────────────────────────── */
const pastel = (p: string) => {
  const r = rng(12);
  let bokeh = "";
  for (let i = 0; i < 14; i++) {
    const x = r() * 320;
    const y = r() * 200;
    bokeh += `<g ${anim("sc-float", x, y, r() * 6, 6 + r() * 4)}><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(8 + r() * 22).toFixed(1)}" fill="#fff" opacity="${(0.08 + r() * 0.16).toFixed(2)}"/></g>`;
  }
  let hearts = "";
  for (let i = 0; i < 7; i++) {
    const x = 20 + r() * 280;
    const y = 120 + r() * 70;
    const s = 0.6 + r() * 0.7;
    hearts += `<g ${anim("sc-rise", x, y, r() * 7, 7 + r() * 4)}><path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})" d="M0 4C-6 -1 -7 -6 -3.6 -7.4C-1.6 -8.2 0 -6.6 0 -5.4C0 -6.6 1.6 -8.2 3.6 -7.4C7 -6 6 -1 0 4Z" fill="#ff8fbf" opacity=".75"/></g>`;
  }
  return doc(
    `<defs>${lin(`${p}sky`, [[0, "#ffd9ec"], [0.5, "#e9d4ff"], [1, "#c9dcff"]], 0, 0, 1, 1)}${lin(`${p}cl`, [[0, "#ffffff"], [1, "#f3eaff"]])}</defs>` +
      `<rect width="320" height="200" fill="url(#${p}sky)"/>` +
      bokeh +
      cloud(p, 40, 40, 1.4, 0) +
      cloud(p, 250, 30, 1.1, 3) +
      cloud(p, 200, 170, 1.6, 6) +
      cloud(p, 60, 176, 1.2, 2) +
      hearts +
      [
        [90, 80],
        [230, 110],
        [280, 60],
        [30, 120],
      ]
        .map(([x, y], i) => `<g ${anim("twinkle", x, y, i * 0.7, 2)}><path d="${sparklePath(x, y, 6)}" fill="#fff"/></g>`)
        .join(""),
  );
};

function cloud(p: string, x: number, y: number, s: number, delay: number): string {
  return `<g ${anim("sc-drift", x, y, delay, 12)}><path transform="translate(${x} ${y}) scale(${s})" d="M-26 8C-30 0 -24 -8 -16 -6C-14 -14 -2 -16 2 -8C6 -14 18 -12 18 -4C26 -4 30 4 24 8Z" fill="url(#${p}cl)" opacity=".9"/></g>`;
}

/* ── Gece gökyüzü ─────────────────────────────────────────────────────── */
const nightSky = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#050818"], [0.6, "#121a44"], [1, "#2a2a6a"]])}${lin(`${p}milky`, [[0, "#9fb8ff", 0], [0.5, "#c9b8ff", 0.35], [1, "#ff9ad5", 0]], 0, 1, 1, 0)}${radU(`${p}neb`, [[0, "#ff5ad1", 0.35], [1, "#ff5ad1", 0]], 90, 60, 90)}${radU(`${p}neb2`, [[0, "#3fc8ff", 0.3], [1, "#3fc8ff", 0]], 250, 100, 110)}</defs>` +
      `<rect width="320" height="200" fill="url(#${p}sky)"/>` +
      `<g ${anim("pulse", 90, 60, 0, 6)}><rect width="320" height="200" fill="url(#${p}neb)"/></g>` +
      `<rect width="320" height="200" fill="url(#${p}neb2)"/>` +
      `<path d="M-20 180C60 120 140 90 340 10V50C160 120 80 150 -20 210Z" fill="url(#${p}milky)"/>` +
      starfield(9, 80, 200) +
      `<g ${anim("sc-shoot", 280, 20, 0, 6)}><path d="M240 10L290 26" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/><circle cx="290" cy="26" r="1.8" fill="#fff"/></g>` +
      `<path d="M0 182C50 170 100 176 150 180C210 186 260 168 320 174V200H0Z" fill="#0a0d24"/>`,
  );

/* ── Korlu karanlık ───────────────────────────────────────────────────── */
const embers = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#0b0303"], [0.6, "#2a0904"], [1, "#5a1404"]])}${radU(`${p}lava`, [[0, "#ff8a00", 0.85], [0.4, "#ff3d00", 0.45], [1, "#ff3d00", 0]], 160, 230, 190)}${radU(`${p}smoke`, [[0, "#3a1a14", 0.6], [1, "#3a1a14", 0]], 80, 40, 120)}</defs>` +
      `<rect width="320" height="200" fill="url(#${p}sky)"/>` +
      `<rect width="320" height="200" fill="url(#${p}smoke)"/>` +
      `<g ${anim("pulse", 160, 200, 0, 2.4)}><rect width="320" height="200" fill="url(#${p}lava)"/></g>` +
      `<path d="M0 200V176C30 170 50 182 80 176C110 170 130 184 170 178C210 172 240 186 280 178C300 174 312 178 320 180V200Z" fill="#160604"/>` +
      `<path d="M30 182C50 178 70 186 96 180M180 184C210 178 236 188 266 182" stroke="#ff7a1f" stroke-width="1.4" fill="none" opacity=".8"/>` +
      rising(17, 22, "#ffd36b", "#ff6a00", 140),
  );

/* ── Buz / kutup ışıkları ─────────────────────────────────────────────── */
const ice = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#04101e"], [0.6, "#0c2a44"], [1, "#1a4a6a"]])}${lin(`${p}a1`, [[0, "#3dffb4", 0], [0.45, "#3dffb4", 0.7], [1, "#2de0ff", 0]])}${lin(`${p}a2`, [[0, "#b07cff", 0], [0.5, "#b07cff", 0.5], [1, "#2de0ff", 0]])}${lin(`${p}mt`, [[0, "#cfe8ff"], [0.3, "#6d8fb5"], [1, "#1c3350"]])}${lin(`${p}mt2`, [[0, "#9fc4e8"], [0.4, "#3f5f86"], [1, "#0f1f36"]])}</defs>` +
      `<rect width="320" height="200" fill="url(#${p}sky)"/>` +
      starfield(21, 40, 120, "#e6f6ff") +
      `<g ${anim("sc-drift", 160, 60, 0, 10)}><path d="M-20 90C40 30 90 80 150 40C210 0 260 60 340 20V60C260 100 210 40 150 80C90 120 40 70 -20 130Z" fill="url(#${p}a1)"/></g>` +
      `<g ${anim("sc-drift", 160, 60, 4, 13)}><path d="M-20 70C50 40 100 70 170 50C230 30 280 50 340 40V60C280 72 230 52 170 74C100 96 50 64 -20 92Z" fill="url(#${p}a2)"/></g>` +
      `<path d="M-10 200L60 120L90 142L140 92L190 146L230 116L280 150L330 120V200Z" fill="url(#${p}mt)"/>` +
      `<path d="M-10 200L40 160L90 182L150 150L200 184L260 160L330 180V200Z" fill="url(#${p}mt2)"/>` +
      Array.from({ length: 16 }, (_, i) => {
        const r = rng(60 + i);
        const x = r() * 320;
        const y = r() * 120;
        return `<g ${anim("sc-fall", x, y, r() * 8, 8 + r() * 4)}><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + r() * 1.4).toFixed(1)}" fill="#fff" opacity=".85"/></g>`;
      }).join(""),
  );

/* ── Bahar çayırı ─────────────────────────────────────────────────────── */
const meadow = (p: string) => {
  const r = rng(33);
  let flowers = "";
  for (let i = 0; i < 26; i++) {
    const x = r() * 320;
    const y = 160 + r() * 38;
    const c = ["#ff9cc4", "#fff", "#ffd54a", "#b9a6ff"][i % 4];
    flowers += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.6 + r() * 1.6).toFixed(1)}" fill="${c}"/>`;
  }
  let petals = "";
  for (let i = 0; i < 9; i++) {
    const x = r() * 320;
    const y = r() * 100;
    petals += `<g ${anim("sc-fall", x, y, r() * 8, 9 + r() * 4)}><path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(r() * 360).toFixed(0)})" d="M0 0C-2.6 -1.6 -3 -4.6 -1.2 -6C-.4 -5.2 .4 -5.2 1.2 -6C3 -4.6 2.6 -1.6 0 0Z" fill="#ffc1da"/></g>`;
  }
  return doc(
    `<defs>${lin(`${p}sky`, [[0, "#8fd0ff"], [0.6, "#c9ecff"], [1, "#fff1d6"]])}${radU(`${p}sun`, [[0, "#fffbe0", 1], [0.2, "#fff2a8", 0.7], [1, "#fff2a8", 0]], 260, 40, 110)}${lin(`${p}h1`, [[0, "#9fe07a"], [1, "#4f9a3a"]])}${lin(`${p}h2`, [[0, "#7fcf5a"], [1, "#2f7a2a"]])}${lin(`${p}cl`, [[0, "#ffffff"], [1, "#eef6ff"]])}</defs>` +
      `<rect width="320" height="200" fill="url(#${p}sky)"/>` +
      `<g ${anim("pulse", 260, 40, 0, 5)}><circle cx="260" cy="40" r="110" fill="url(#${p}sun)"/></g>` +
      cloud(p, 70, 40, 1.4, 0) +
      cloud(p, 180, 60, 1, 4) +
      `<path d="M0 150C60 120 120 128 180 140C240 152 280 130 320 128V200H0Z" fill="url(#${p}h1)"/>` +
      `<path d="M0 170C70 154 140 160 200 168C250 174 290 162 320 160V200H0Z" fill="url(#${p}h2)"/>` +
      flowers +
      petals,
  );
};

/* ── Gece ormanı (ateş böcekleri) ─────────────────────────────────────── */
const forest = (p: string) => {
  const r = rng(44);
  let trees = "";
  for (let i = 0; i < 12; i++) {
    const x = i * 30 + r() * 10;
    const h = 70 + r() * 50;
    trees += `<path d="M${x} ${180 - h}L${x + 18} 180H${x - 18}Z" fill="#0f2a26"/>`;
  }
  let flies = "";
  for (let i = 0; i < 16; i++) {
    const x = r() * 320;
    const y = 60 + r() * 130;
    flies += `<g ${anim("twinkle", x, y, r() * 3, 1.4 + r())}><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="url(#${p}ff)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4" fill="#fbffc8"/></g>`;
  }
  return doc(
    `<defs>${lin(`${p}sky`, [[0, "#06161a"], [0.6, "#0e2e30"], [1, "#184a40"]])}${rad(`${p}ff`, [[0, "#f6ff8a", 0.9], [1, "#c8ff4a", 0]])}${radU(`${p}moon`, [[0, "#e8fff6", 0.8], [1, "#9ff0d8", 0]], 70, 40, 60)}${lin(`${p}fog`, [[0, "#bff5e0", 0.32], [1, "#bff5e0", 0]])}</defs>` +
      `<rect width="320" height="200" fill="url(#${p}sky)"/>` +
      `<circle cx="70" cy="40" r="60" fill="url(#${p}moon)"/><circle cx="70" cy="40" r="14" fill="#f0fff9"/>` +
      starfield(51, 24, 80, "#dffff3") +
      trees +
      fog(p, 150, 24, 2) +
      `<path d="M0 200V178C40 170 80 176 120 180C170 184 220 172 270 176C300 178 312 176 320 176V200Z" fill="#081a16"/>` +
      flies,
  );
};

/* ── Al bayrak ────────────────────────────────────────────────────────── */
const turkiye = (p: string) =>
  doc(
    `<defs>${lin(`${p}sky`, [[0, "#ff2a36"], [0.5, "#e30a17"], [1, "#9a000c"]], 0, 0, 1, 1)}${lin(`${p}fold`, [[0, "#000", 0], [0.5, "#000", 0.25], [1, "#000", 0]], 0, 0, 1, 0)}${lin(`${p}sheen`, [[0, "#fff", 0], [0.5, "#fff", 0.28], [1, "#fff", 0]], 0, 0, 1, 0)}${radU(`${p}rays`, [[0, "#fff", 0.35], [1, "#fff", 0]], 230, 100, 160)}</defs>` +
      `<rect width="320" height="200" fill="url(#${p}sky)"/>` +
      `<g ${anim("sc-drift", 160, 100, 0, 9)}><path d="M20 0C40 60 10 140 30 200H70C50 140 80 60 60 0Z M130 0C150 60 120 140 140 200H190C170 140 200 60 180 0Z M250 0C270 60 240 140 260 200H300C280 140 310 60 290 0Z" fill="url(#${p}fold)"/><path d="M90 0C110 60 80 140 100 200H120C100 140 130 60 110 0Z" fill="url(#${p}sheen)"/></g>` +
      `<rect width="320" height="200" fill="url(#${p}rays)"/>` +
      `<g opacity=".22"><circle cx="210" cy="100" r="60" fill="#fff"/><circle cx="225" cy="100" r="48" fill="#e30a17"/><path d="${starPath(268, 100, 30, 12, 180)}" fill="#fff"/></g>` +
      [
        [40, 30],
        [90, 160],
        [290, 30],
        [300, 170],
        [150, 20],
      ]
        .map(([x, y], i) => `<g ${anim("twinkle", x, y, i * 0.6, 2)}><path d="${starPath(x, y, 4, 1.6, 180)}" fill="#fff"/></g>`)
        .join(""),
  );

export const SHOWCASE_BACKDROPS: Record<ShowcaseBackdropId, (p: string) => string> = {
  mezarlik: graveyard,
  pastel,
  gece: nightSky,
  ates: embers,
  buz: ice,
  bahar: meadow,
  orman: forest,
  turkiye,
};

/** Sahnenin baskın vurgu rengi (kart çerçevesi/ışıma için). */
export const SHOWCASE_ACCENT: Record<ShowcaseBackdropId, string> = {
  mezarlik: "#9b6bff",
  pastel: "#ff8fbf",
  gece: "#7c8cff",
  ates: "#ff6a1f",
  buz: "#5fd6ff",
  bahar: "#7fcf5a",
  orman: "#c8ff4a",
  turkiye: "#e30a17",
};

