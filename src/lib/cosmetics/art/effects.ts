/**
 * Profil efekti çizimleri — kartın (ya da afişin) üstünde oynayan katman.
 * Saf veri + SVG metni: web `components/store/profile-effect` bunu HTML
 * katmanına çevirir (parçacıklar bileşimcide oynayan `transform`/`opacity`
 * animasyonlu kutular), mobil aynı veriyi kendi çizicisiyle kullanabilir.
 *
 * Bütçe: efekt başına ≤ ~30 hareketli öğe.
 */
import { OL, anim, bone, boneDefs, lin, rad, radU, rng, skull, sparklePath, starPath, svgDoc } from "./kit";
import { bat, spider } from "./figures";

export type SpriteArt = (p: string) => string;

/** Kartın kenarına/köşesine sabitlenen çizim. Konum/boyut CSS değerleri. */
export interface EffectPiece {
  art: SpriteArt;
  style: Record<string, string>;
  /** components/cosmetics/cosmetics.css → .ck-fx-<anim> */
  anim?: "fog" | "peek" | "descend" | "shoot" | "ribbon" | "sheen";
  delay?: number;
  duration?: number;
}

/** Yağan/yükselen parçacık sütunları. */
export interface EffectParticles {
  sprites: SpriteArt[];
  count: number;
  motion: "fall" | "rise";
  /** Parçacığın kendi salınımı. */
  sway: "tumble" | "waver";
  size: [number, number];
  duration: [number, number];
  seed: number;
}

/** Yerinde parlayan ışıltılar. */
export interface EffectGlints {
  sprites: SpriteArt[];
  count: number;
  size: [number, number];
  seed: number;
  /** Dikey yerleşim aralığı (yüzde). */
  band?: [number, number];
}

export interface EffectArt {
  /** Kartın üstüne hafif renk örtüsü (CSS background). */
  tint?: string;
  pieces?: EffectPiece[];
  particles?: EffectParticles;
  glints?: EffectGlints;
}

const sq = (body: string, vb = "0 0 20 20") => svgDoc(vb, body);

/* ── Sprite'lar ───────────────────────────────────────────────────────── */
const mapleLeaf =
  (a: string, b: string): SpriteArt =>
  (p) =>
    sq(
      `<defs>${lin(`${p}l`, [[0, a], [1, b]], 0, 0, 1, 1)}</defs>` +
        `<path d="M10 1L11.6 5.4L14.6 3.6L14 7.6L18.4 7L16.4 10L19 11.4L14.4 12.8L15 15.6L11 14.2L10.6 19H9.4L9 14.2L5 15.6L5.6 12.8L1 11.4L3.6 10L1.6 7L6 7.6L5.4 3.6L8.4 5.4Z" fill="url(#${p}l)" stroke="${OL}" stroke-width=".8" stroke-linejoin="round"/>` +
        `<path d="M10 18.6V6M10 12L6 9M10 12L14 9" stroke="${OL}" stroke-opacity=".45" stroke-width=".6" fill="none"/>`,
    );

const ovalLeaf: SpriteArt = (p) =>
  sq(
    `<defs>${lin(`${p}l`, [[0, "#ffd36b"], [1, "#e0861c"]], 0, 0, 1, 1)}</defs>` +
      `<path d="M3 17C2 10 7 3 17 2C17 11 11 17 3 17Z" fill="url(#${p}l)" stroke="${OL}" stroke-width=".8"/><path d="M3 17C7 12 11 8 15 4" stroke="${OL}" stroke-opacity=".45" stroke-width=".6" fill="none"/>`,
  );

const sakuraPetal: SpriteArt = (p) =>
  sq(
    `<defs>${lin(`${p}s`, [[0, "#ffffff"], [1, "#ff9cc4"]])}</defs>` +
      `<path d="M10 19C4 15 2 9 4 4C6 2 8.4 3 10 5C11.6 3 14 2 16 4C18 9 16 15 10 19Z" fill="url(#${p}s)" stroke="#d45a8a" stroke-width=".7"/><path d="M10 6V15" stroke="#ff8ab8" stroke-width=".6" opacity=".6"/>`,
  );

const sakuraFlower: SpriteArt = (p) =>
  sq(
    `<defs>${lin(`${p}s`, [[0, "#ffffff"], [1, "#ffa8cb"]])}</defs>` +
      [0, 72, 144, 216, 288]
        .map((a) => `<path d="M10 10C7 8.4 6.4 5 8.2 3.4C9 4.2 11 4.2 11.8 3.4C13.6 5 13 8.4 10 10Z" transform="rotate(${a} 10 10)" fill="url(#${p}s)" stroke="#d45a8a" stroke-width=".6"/>`)
        .join("") +
      `<circle cx="10" cy="10" r="1.6" fill="#ffd54a"/>`,
  );

const snowflakeSprite: SpriteArt = () => {
  let d = "";
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const ex = 10 + 8 * Math.cos(a);
    const ey = 10 + 8 * Math.sin(a);
    const bx = 10 + 5 * Math.cos(a);
    const by = 10 + 5 * Math.sin(a);
    d += `M10 10L${ex.toFixed(2)} ${ey.toFixed(2)}`;
    for (const s of [-1, 1]) {
      const b = a + s * 0.8;
      d += `M${bx.toFixed(2)} ${by.toFixed(2)}L${(bx + 2.6 * Math.cos(b)).toFixed(2)} ${(by + 2.6 * Math.sin(b)).toFixed(2)}`;
    }
  }
  return sq(`<path d="${d}" stroke="#9ec9ff" stroke-width="2.6" stroke-linecap="round" opacity=".35"/><path d="${d}" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`);
};

const snowDot: SpriteArt = (p) => sq(`<defs>${rad(`${p}d`, [[0, "#fff"], [0.6, "#fff", 0.9], [1, "#cfe6ff", 0]])}</defs><circle cx="10" cy="10" r="8" fill="url(#${p}d)"/>`);

const ember: SpriteArt = (p) =>
  sq(`<defs>${rad(`${p}e`, [[0, "#fffbe0"], [0.3, "#ffcf3a"], [0.6, "#ff6a00", 0.6], [1, "#ff3d00", 0]])}</defs><circle cx="10" cy="10" r="9" fill="url(#${p}e)"/>`);

const emberHot: SpriteArt = (p) =>
  sq(`<defs>${rad(`${p}e`, [[0, "#ffffff"], [0.25, "#ffe27a"], [0.55, "#ff9a1f", 0.55], [1, "#ff3d00", 0]])}</defs><circle cx="10" cy="10" r="9" fill="url(#${p}e)"/><path d="M10 4L11 9L10 16L9 9Z" fill="#fff6c8" opacity=".8"/>`);

const sparkle =
  (c: string, glow: string): SpriteArt =>
  (p) =>
    sq(`<defs>${rad(`${p}g`, [[0, glow, 0.8], [1, glow, 0]])}</defs><circle cx="10" cy="10" r="9" fill="url(#${p}g)"/><path d="${sparklePath(10, 10, 9, 0.14)}" fill="${c}"/><circle cx="10" cy="10" r="1.6" fill="#fff"/>`);

const star5 =
  (c: string): SpriteArt =>
  (p) =>
    sq(`<defs>${rad(`${p}g`, [[0, c, 0.7], [1, c, 0]])}</defs><circle cx="10" cy="10" r="9.5" fill="url(#${p}g)"/><path d="${starPath(10, 10, 6.4, 2.8)}" fill="#fffdf0" stroke="${c}" stroke-width=".8" stroke-linejoin="round"/>`);

const firefly: SpriteArt = (p) =>
  sq(`<defs>${rad(`${p}f`, [[0, "#fbffd0"], [0.25, "#e8ff6a", 0.9], [1, "#9dff4a", 0]])}</defs><circle cx="10" cy="10" r="9.5" fill="url(#${p}f)"/><circle cx="10" cy="10" r="2" fill="#fff"/>`);

const whiteStar: SpriteArt = () => sq(`<path d="${starPath(10, 10, 8, 3.2, 180)}" fill="#fff" opacity=".95"/>`);

/* ── Köşe/kenar parçaları ─────────────────────────────────────────────── */
function cobweb(flip = false, bottom = false): string {
  // Sol üst köşeye çizilir; `flip` sağ üst için yatay ayna.
  let d = "";
  const angles = [6, 22, 40, 58, 74, 88];
  const R = 96;
  for (const a of angles) {
    const r = (a * Math.PI) / 180;
    d += `M0 0L${(R * Math.cos(r)).toFixed(1)} ${(R * Math.sin(r)).toFixed(1)}`;
  }
  for (let k = 1; k <= 6; k++) {
    const rr = (R * k) / 6.6;
    angles.forEach((a, i) => {
      const r1 = ((i ? angles[i - 1] : a) * Math.PI) / 180;
      const r2 = (a * Math.PI) / 180;
      const mid = (r1 + r2) / 2;
      if (i === 0) d += `M${(rr * Math.cos(r2)).toFixed(1)} ${(rr * Math.sin(r2)).toFixed(1)}`;
      else d += `Q${(rr * 0.84 * Math.cos(mid)).toFixed(1)} ${(rr * 0.84 * Math.sin(mid)).toFixed(1)} ${(rr * Math.cos(r2)).toFixed(1)} ${(rr * Math.sin(r2)).toFixed(1)}`;
    });
  }
  const drops = [
    [30, 14],
    [18, 40],
    [52, 34],
    [40, 60],
  ]
    .map(([x, y], i) => `<g ${anim("twinkle", x, y, i * 0.6, 2.4)}><circle cx="${x}" cy="${y}" r="2" fill="#cfefff" stroke="#fff" stroke-width=".7"/></g>`)
    .join("");
  return svgDoc(
    "0 0 100 100",
    `<g ${flip ? 'transform="translate(100 0) scale(-1 1)"' : bottom ? 'transform="translate(0 100) scale(1 -1)"' : ""}><g ${anim("breathe", 0, 0, flip ? 1.5 : 0, 5)}><path d="${d}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2.4"/><path d="${d}" fill="none" stroke="#f6f2ff" stroke-opacity=".9" stroke-width="1"/></g>${drops}</g>`,
    'overflow="visible"',
  );
}

const spiderOnThread: SpriteArt = (p) =>
  svgDoc(
    "0 0 30 120",
    `<defs>${rad(`${p}spider`, [[0, "#6a4e8f"], [0.7, "#2b1d3d"], [1, "#160e22"]], 0.4, 0.35, 0.7)}</defs><path d="M15 -40V100" stroke="#f4f0ff" stroke-width=".8"/><g transform="translate(15 106) scale(1.1)">${spider(p)}</g>`,
    'overflow="visible"',
  );

const fogBand =
  (a: string, b: string): SpriteArt =>
  (p) =>
    svgDoc(
      "0 0 400 60",
      `<defs>${lin(`${p}f`, [[0, a, 0], [0.45, a, 0.75], [1, b, 0.9]])}</defs><path d="M0 60V34C20 22 44 26 60 32C80 14 112 16 126 30C146 18 176 20 190 34C214 16 252 18 262 32C286 20 314 22 330 34C350 22 380 24 400 30V60Z" fill="url(#${p}f)"/>`,
      'preserveAspectRatio="none"',
    );

function peekingSkeleton(p: string, wave: boolean): string {
  return svgDoc(
    "-14 -14 28 34",
    `<defs>${boneDefs(p)}</defs>` +
      bone(-6, 10, -10, wave ? -6 : 4, 1.8) +
      `<circle cx="-10" cy="${wave ? -6 : 4}" r="1.8" fill="#f6f0e4" stroke="${OL}" stroke-width="1"/>` +
      bone(6, 10, 10, 4, 1.8) +
      `<circle cx="10" cy="4" r="1.8" fill="#f6f0e4" stroke="${OL}" stroke-width="1"/>` +
      `<path d="M-5 8C-5 6 5 6 5 8V20H-5Z" fill="#f3ebdc" stroke="${OL}" stroke-width="1.2"/><path d="M-4 11H4M-4 14H4" stroke="${OL}" stroke-width=".8"/>` +
      skull(p, "#9dffcf"),
    'overflow="visible"',
  );
}

const tombstones: SpriteArt = (p) =>
  svgDoc(
    "0 0 400 40",
    `<defs>${lin(`${p}t`, [[0, "#4b4466"], [1, "#221d33"]])}</defs>` +
      `<path d="M30 40V22C30 14 46 14 46 22V40ZM330 40V18C330 9 350 9 350 18V40ZM360 40V28C360 23 370 23 370 28V40ZM70 40V30H74V26H78V30H82V40Z" fill="url(#${p}t)"/>` +
      `<path d="M38 22V32M35 25H41M340 18V30M336 22H344" stroke="#7d74a6" stroke-width="1.4"/>`,
    'preserveAspectRatio="xMidYMax slice"',
  );

const batSprite: SpriteArt = () => svgDoc("-13 -7 26 14", `<g ${anim("bob", 0, 0, 0, 1.6)}>${bat()}</g>`, 'overflow="visible"');

const sakuraBranch: SpriteArt = (p) =>
  svgDoc(
    "0 0 120 80",
    `<defs>${lin(`${p}b`, [[0, "#6d4a3e"], [1, "#3f2a22"]])}${lin(`${p}s`, [[0, "#ffffff"], [1, "#ff9cc4"]])}</defs>` +
      `<path d="M120 2C100 8 84 10 70 14C56 18 44 26 34 34M84 10C88 20 96 28 108 32M66 16C64 26 60 34 52 40" fill="none" stroke="${OL}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M120 2C100 8 84 10 70 14C56 18 44 26 34 34M84 10C88 20 96 28 108 32M66 16C64 26 60 34 52 40" fill="none" stroke="url(#${p}b)" stroke-width="2.4" stroke-linecap="round"/>` +
      [
        [36, 32, 1.2],
        [52, 40, 1],
        [60, 20, 1.1],
        [76, 12, 0.9],
        [96, 26, 1.2],
        [108, 32, 0.9],
        [100, 6, 1],
        [44, 26, 0.7],
      ]
        .map(
          ([x, y, s], i) =>
            `<g transform="translate(${x} ${y}) scale(${s})"><g ${anim("sway", 0, 0, i * 0.4, 3)}>${[0, 72, 144, 216, 288]
              .map((a) => `<path d="M0 0C-3 -1.6 -3.6 -5 -1.8 -6.6C-1 -5.8 1 -5.8 1.8 -6.6C3.6 -5 3 -1.6 0 0Z" transform="rotate(${a})" fill="url(#${p}s)" stroke="#d45a8a" stroke-width=".6"/>`)
              .join("")}<circle r="1.5" fill="#ffd54a"/></g></g>`,
        )
        .join(""),
    'overflow="visible"',
  );

const snowDrift: SpriteArt = (p) =>
  svgDoc(
    "0 0 400 40",
    `<defs>${lin(`${p}s`, [[0, "#ffffff"], [1, "#cfe2ff"]])}</defs><path d="M0 40V26C40 16 70 24 110 22C150 20 170 12 220 16C260 20 300 26 340 20C370 16 390 20 400 22V40Z" fill="url(#${p}s)" opacity=".92"/><path d="M0 26C40 16 70 24 110 22C150 20 170 12 220 16C260 20 300 26 340 20" fill="none" stroke="#fff" stroke-width="2"/>`,
    'preserveAspectRatio="none"',
  );

const shootingStar: SpriteArt = (p) =>
  svgDoc("0 0 80 30", `<defs>${lin(`${p}t`, [[0, "#fff", 0.95], [1, "#fff", 0]], 0, 0, 1, 0)}</defs><path d="M6 6L76 26" stroke="url(#${p}t)" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="6" r="2.4" fill="#fff"/><circle cx="6" cy="6" r="5" fill="#fff" opacity=".3"/>`, 'overflow="visible"');

const skeletonA: SpriteArt = (p) => peekingSkeleton(p, true);
const skeletonB: SpriteArt = (p) => peekingSkeleton(p, false);
const webTopLeft: SpriteArt = () => cobweb();
const webTopRight: SpriteArt = () => cobweb(true);
const webBottomLeft: SpriteArt = () => cobweb(false, true);

/* ── Atmosfer parçaları (kenar/köşe) ──────────────────────────────────── */
const autumnBranch: SpriteArt = (p) =>
  svgDoc(
    "0 0 140 90",
    `<defs>${lin(`${p}b`, [[0, "#7a4a2c"], [1, "#3e2414"]])}${lin(`${p}a`, [[0, "#ffd36b"], [1, "#e0661c"]], 0, 0, 1, 1)}${lin(`${p}r`, [[0, "#ff8a65"], [1, "#b8261a"]], 0, 0, 1, 1)}</defs>` +
      `<path d="M-4 6C20 10 38 14 56 22C72 30 84 40 94 52M30 12C34 24 34 34 30 44M60 24C70 18 82 16 96 18" fill="none" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M-4 6C20 10 38 14 56 22C72 30 84 40 94 52M30 12C34 24 34 34 30 44M60 24C70 18 82 16 96 18" fill="none" stroke="url(#${p}b)" stroke-width="3" stroke-linecap="round"/>` +
      (
        [
          [14, 10, 20, "a"],
          [28, 44, 160, "r"],
          [42, 18, 60, "r"],
          [56, 30, 120, "a"],
          [72, 22, -20, "a"],
          [96, 18, 10, "r"],
          [86, 44, 140, "a"],
          [96, 54, 100, "r"],
          [8, 22, 200, "r"],
        ] as const
      )
        .map(
          ([x, y, a, c], i) =>
            `<g transform="translate(${x} ${y}) rotate(${a})"><g ${anim("sway", 0, 0, i * 0.37, 2.6)}><path d="M0 0L2.4 -4.8L5 -3L5.6 -7.6L8.4 -4L11 -8L11.6 -3L15 -4L13.4 0L15 4L11.6 3L11 8L8.4 4L5.6 7.6L5 3L2.4 4.8Z" fill="url(#${p}${c})" stroke="${OL}" stroke-width=".9" stroke-linejoin="round"/><path d="M0 0H12" stroke="${OL}" stroke-opacity=".4" stroke-width=".7"/></g></g>`,
        )
        .join(""),
    'overflow="visible"',
  );

const icicles: SpriteArt = (p) => {
  const r = rng(41);
  let d = "M0 0H400V6";
  for (let x = 400; x > 0; ) {
    const w = 8 + r() * 14;
    const h = 8 + r() * (r() > 0.7 ? 34 : 16);
    d += `L${(x - w / 2).toFixed(1)} ${(6 + h).toFixed(1)}L${(x - w).toFixed(1)} 6`;
    x -= w;
  }
  return svgDoc(
    "0 0 400 50",
    `<defs>${lin(`${p}i`, [[0, "#ffffff"], [0.5, "#d6f3ff", 0.95], [1, "#8fd8ff", 0.7]])}</defs><path d="${d}Z" fill="url(#${p}i)" stroke="#7fbfe8" stroke-width=".8" stroke-linejoin="round"/><path d="M0 3H400" stroke="#fff" stroke-width="3"/>`,
    'preserveAspectRatio="xMidYMin slice"',
  );
};

const flameRow: SpriteArt = (p) => {
  const r = rng(13);
  let out = "";
  for (let i = 0; i < 14; i++) {
    const x = 6 + i * 29 + r() * 10;
    const h = 26 + r() * 34;
    const w = 9 + r() * 6;
    out += `<g transform="translate(${x.toFixed(1)} 72)"><g ${anim("flicker", 0, 0, r(), 0.6 + r() * 0.5)}><path d="M0 ${-h}C${w * 0.3} ${-h * 0.7} ${w} ${-h * 0.5} ${w * 0.9} ${-h * 0.15}C${w * 0.8} 4 ${-w * 0.8} 4 ${-w * 0.9} ${-h * 0.15}C${-w} ${-h * 0.45} ${-w * 0.2} ${-h * 0.6} 0 ${-h}Z" fill="url(#${p}f)"/><path d="M0 ${-h * 0.45}C${w * 0.5} ${-h * 0.28} ${w * 0.5} 2 0 2C${-w * 0.5} 2 ${-w * 0.5} ${-h * 0.28} 0 ${-h * 0.45}Z" fill="#fff3b0"/></g></g>`;
  }
  return svgDoc(
    "0 0 400 72",
    `<defs>${lin(`${p}f`, [[0, "#ff2d1a", 0.15], [0.35, "#ff4a10", 0.85], [0.75, "#ff9a1f"], [1, "#ffd23a"]])}${lin(`${p}g`, [[0, "#ff5a00", 0], [1, "#ff3d00", 0.7]])}</defs><rect width="400" height="72" fill="url(#${p}g)"/>${out}`,
    'preserveAspectRatio="xMidYMax slice"',
  );
};

const moonGlow: SpriteArt = (p) =>
  svgDoc(
    "0 0 80 80",
    `<defs>${rad(`${p}h`, [[0, "#fff6d8", 0.9], [0.35, "#ffe7a6", 0.35], [1, "#b48cff", 0]])}${rad(`${p}m`, [[0, "#fffdf2"], [1, "#f2dfaa"]], 0.4, 0.35, 0.7)}</defs><g ${anim("pulse", 40, 40, 0, 4)}><circle cx="40" cy="40" r="40" fill="url(#${p}h)"/></g><circle cx="40" cy="40" r="15" fill="url(#${p}m)"/><circle cx="35" cy="36" r="3" fill="#e8d39a" opacity=".7"/><circle cx="45" cy="45" r="2" fill="#e8d39a" opacity=".7"/>`,
  );

const bushes: SpriteArt = (p) =>
  svgDoc(
    "0 0 400 70",
    `<defs>${lin(`${p}b`, [[0, "#1f5a3a"], [1, "#0a1f14"]])}${lin(`${p}b2`, [[0, "#2f7a4a"], [1, "#0f2c1c"]])}</defs>` +
      `<path d="M0 70V44C14 30 30 34 38 44C46 26 70 24 80 40C92 30 110 32 116 46C128 36 146 38 150 50C166 34 190 34 196 50C210 38 232 40 236 52C252 36 276 34 286 48C298 36 318 36 326 48C340 34 362 32 372 44C384 36 396 38 400 42V70Z" fill="url(#${p}b2)"/>` +
      `<path d="M0 70V56C20 46 40 50 54 58C70 46 96 48 108 58C130 48 150 52 164 60C184 50 210 50 224 60C244 50 270 52 282 60C302 50 330 50 344 60C362 52 386 52 400 56V70Z" fill="url(#${p}b)"/>` +
      `<path d="M60 58Q62 44 70 36M64 50Q56 46 52 40M68 44Q76 42 80 36M300 58Q304 42 312 34M304 48Q296 44 292 38M308 42Q316 40 320 34" stroke="#3f9a5a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    'preserveAspectRatio="xMidYMax slice"',
  );

const sheen: SpriteArt = (p) =>
  svgDoc("0 0 100 100", `<defs>${lin(`${p}s`, [[0, "#fff", 0], [0.42, "#ffe9fb", 0], [0.5, "#ffffff", 0.32], [0.58, "#c9f3ff", 0], [1, "#fff", 0]], 0, 0, 1, 0.3)}</defs><rect width="100" height="100" fill="url(#${p}s)"/>`, 'preserveAspectRatio="none"');

const flagRibbon: SpriteArt = (p) =>
  svgDoc(
    "0 0 400 120",
    `<defs>${lin(`${p}r`, [[0, "#ff3b45"], [0.5, "#e30a17"], [1, "#a8000d"]])}${lin(`${p}sh`, [[0, "#fff", 0], [0.5, "#fff", 0.3], [1, "#fff", 0]], 0, 0, 1, 0)}</defs>` +
      `<path d="M0 0H400V82C340 104 280 64 210 86C140 108 70 72 0 94Z" fill="url(#${p}r)" opacity=".92"/>` +
      `<path d="M0 94C70 72 140 108 210 86C280 64 340 104 400 82" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>` +
      `<path d="M0 30C80 10 160 50 240 30C300 15 360 34 400 26V44C360 52 300 33 240 48C160 68 80 28 0 48Z" fill="url(#${p}sh)"/>` +
      `<g transform="translate(300 44)"><circle r="22" fill="#fff"/><circle cx="5.5" r="17.6" fill="#e30a17"/><path d="${starPath(28, 0, 11, 4.4, 180)}" fill="#fff"/></g>`,
    'preserveAspectRatio="xMaxYMin slice"',
  );

const nebula: SpriteArt = (p) =>
  svgDoc(
    "0 0 400 160",
    `<defs>${radU(`${p}a`, [[0, "#ff5ad1", 0.45], [1, "#ff5ad1", 0]], 300, 30, 140)}${radU(`${p}b`, [[0, "#5a8cff", 0.25], [1, "#5a8cff", 0]], 90, 30, 120)}${lin(`${p}c`, [[0, "#0a0620", 0.65], [1, "#0a0620", 0]])}</defs><rect width="400" height="160" fill="url(#${p}c)"/><g ${anim("pulse", 300, 30, 0, 5)}><rect width="400" height="160" fill="url(#${p}a)"/></g><rect width="400" height="160" fill="url(#${p}b)"/>`,
    'preserveAspectRatio="none"',
  );

const vignette = (rgb: string, a = 0.35) => `radial-gradient(90% 55% at 0% 0%, rgba(${rgb},${a}), transparent 70%), radial-gradient(90% 55% at 100% 0%, rgba(${rgb},${a * 0.8}), transparent 70%)`;

/* ── Efektler ─────────────────────────────────────────────────────────── */
const SKEL = { width: "17%", maxWidth: "74px", aspectRatio: "28 / 34" };

export const EFFECT_ART: Record<string, EffectArt> = {
  fx_leaves: {
    tint: vignette("255,140,40", 0.3),
    pieces: [{ art: autumnBranch, style: { left: "-3%", top: "-2%", width: "44%", maxWidth: "190px", aspectRatio: "140 / 90" } }],
    particles: {
      sprites: [mapleLeaf("#ffb347", "#e2531c"), mapleLeaf("#ffd36b", "#e0861c"), mapleLeaf("#ff8a65", "#b8261a"), ovalLeaf],
      count: 14,
      motion: "fall",
      sway: "tumble",
      size: [14, 24],
      duration: [5, 8],
      seed: 4,
    },
  },
  fx_turkiye: {
    pieces: [
      { art: flagRibbon, style: { left: "0", right: "0", top: "0", height: "34%" }, anim: "ribbon" },
      { art: sheen, style: { left: "0", top: "0", width: "100%", height: "34%" }, anim: "sheen" },
    ],
    glints: { sprites: [whiteStar], count: 10, size: [7, 12], seed: 8, band: [8, 96] },
  },
  fx_sakura: {
    tint: vignette("255,150,200", 0.3),
    pieces: [{ art: sakuraBranch, style: { right: "-2%", top: "-2%", width: "50%", maxWidth: "210px", aspectRatio: "120 / 80" } }],
    particles: { sprites: [sakuraPetal, sakuraPetal, sakuraFlower], count: 16, motion: "fall", sway: "tumble", size: [11, 18], duration: [5, 8], seed: 12 },
  },
  fx_fireflies: {
    tint: "linear-gradient(180deg, transparent 50%, rgba(20,60,40,.45))",
    pieces: [{ art: bushes, style: { left: "0", right: "0", bottom: "0", height: "24%" } }],
    glints: { sprites: [firefly], count: 16, size: [14, 24], seed: 3, band: [16, 92] },
  },
  fx_isilti: {
    tint: vignette("190,140,255", 0.25),
    pieces: [{ art: sheen, style: { left: "0", top: "0", width: "100%", height: "100%" }, anim: "sheen", duration: 6 }],
    glints: { sprites: [sparkle("#fff7c2", "#ffe066"), sparkle("#e6f6ff", "#7cd4ff"), sparkle("#ffe1f4", "#ff7ad9")], count: 16, size: [12, 22], seed: 21 },
    particles: { sprites: [sparkle("#ffffff", "#ffe066")], count: 8, motion: "rise", sway: "waver", size: [8, 12], duration: [5, 8], seed: 22 },
  },
  fx_korlar: {
    tint: "linear-gradient(180deg, transparent 45%, rgba(120,20,0,.35))",
    pieces: [{ art: flameRow, style: { left: "0", right: "0", bottom: "0", height: "22%" } }],
    particles: { sprites: [ember, emberHot, ember], count: 18, motion: "rise", sway: "waver", size: [8, 16], duration: [3.5, 6], seed: 9 },
  },
  fx_mezarlik: {
    tint: "radial-gradient(70% 45% at 85% 0%, rgba(150,120,255,.3), transparent 70%), linear-gradient(180deg, rgba(20,10,40,0) 45%, rgba(40,20,80,.5))",
    pieces: [
      { art: moonGlow, style: { right: "4%", top: "3%", width: "24%", maxWidth: "100px", aspectRatio: "1" } },
      { art: batSprite, style: { left: "18%", top: "9%", width: "11%", maxWidth: "44px", aspectRatio: "26 / 14" } },
      { art: batSprite, style: { right: "28%", top: "18%", width: "8%", maxWidth: "32px", aspectRatio: "26 / 14" } },
      { art: fogBand("#b9a6ff", "#8a70e0"), style: { left: "-10%", right: "-10%", bottom: "6%", height: "26%" }, anim: "fog" },
      { art: tombstones, style: { left: "0", right: "0", bottom: "0", height: "22%" } },
      { art: skeletonA, style: { left: "8%", bottom: "-1%", ...SKEL }, anim: "peek", delay: 0 },
      { art: skeletonB, style: { left: "44%", bottom: "-1%", ...SKEL, width: "14%" }, anim: "peek", delay: 2.2 },
      { art: skeletonA, style: { right: "6%", bottom: "-1%", ...SKEL }, anim: "peek", delay: 4.1 },
      { art: fogBand("#d8ceff", "#a48cf0"), style: { left: "-10%", right: "-10%", bottom: "-4%", height: "16%" }, anim: "fog", delay: 4, duration: 11 },
    ],
  },
  fx_orumcek: {
    tint: "radial-gradient(60% 45% at 0% 0%, rgba(10,5,20,.45), transparent 70%), radial-gradient(50% 40% at 100% 0%, rgba(10,5,20,.4), transparent 70%), radial-gradient(50% 35% at 0% 100%, rgba(10,5,20,.35), transparent 70%)",
    pieces: [
      { art: webTopLeft, style: { left: "0", top: "0", width: "42%", maxWidth: "170px", aspectRatio: "1" } },
      { art: webTopRight, style: { right: "0", top: "0", width: "32%", maxWidth: "130px", aspectRatio: "1" } },
      { art: webBottomLeft, style: { left: "0", bottom: "0", width: "26%", maxWidth: "110px", aspectRatio: "1" } },
      { art: spiderOnThread, style: { right: "30%", top: "0", width: "8%", maxWidth: "34px", aspectRatio: "30 / 120" }, anim: "descend" },
      { art: spiderOnThread, style: { left: "40%", top: "0", width: "5%", maxWidth: "22px", aspectRatio: "30 / 120" }, anim: "descend", delay: 2.5, duration: 6 },
    ],
  },
  fx_snow: {
    tint: "linear-gradient(180deg, rgba(200,230,255,.25), transparent 35%)",
    pieces: [
      { art: icicles, style: { left: "0", right: "0", top: "0", height: "12%" } },
      { art: snowDrift, style: { left: "0", right: "0", bottom: "0", height: "14%" } },
    ],
    particles: { sprites: [snowflakeSprite, snowDot, snowDot, snowflakeSprite], count: 22, motion: "fall", sway: "waver", size: [7, 16], duration: [6, 10], seed: 14 },
  },
  fx_yildiz_kaymasi: {
    pieces: [
      { art: nebula, style: { left: "0", right: "0", top: "0", height: "45%" } },
      { art: shootingStar, style: { right: "-4%", top: "6%", width: "34%", maxWidth: "150px", aspectRatio: "80 / 30" }, anim: "shoot" },
      { art: shootingStar, style: { right: "22%", top: "26%", width: "24%", maxWidth: "110px", aspectRatio: "80 / 30" }, anim: "shoot", delay: 2.2, duration: 5.5 },
    ],
    glints: { sprites: [star5("#ffd84a"), star5("#9fd8ff"), sparkle("#ffffff", "#c9b8ff")], count: 16, size: [10, 18], seed: 6 },
  },
};

/** Deterministik yerleşim (her açılışta aynı) — web/mobil ortak. */
export function effectLayout(seed: number, count: number, size: [number, number], duration: [number, number] = [3, 5], band: [number, number] = [6, 94]) {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    left: ((i + 0.15 + r() * 0.7) / count) * 100,
    top: band[0] + r() * (band[1] - band[0]),
    size: size[0] + r() * (size[1] - size[0]),
    duration: duration[0] + r() * (duration[1] - duration[0]),
    delay: r() * duration[1],
    swayDuration: 1.6 + r() * 1.6,
    sprite: i,
  }));
}
