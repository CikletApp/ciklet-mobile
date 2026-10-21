/**
 * Cadılar Bayramı avatar süsleri: cüce iskeletler, hayaletler, balkabağı,
 * örümcek ağı, kara ay. Çizim kuralları için bkz. types.ts / kit.ts.
 */
import { OL, anim, blob, boneDefs, cloudBand, lin, polar, rad, radU, skull, sparklePath, svgDoc, wavyArc } from "./kit";
import { bat, candle, ghost, pumpkin, skeleton, spider, witchHat } from "./figures";
import { DECO_VIEWBOX, type DecorationArt } from "./types";

const doc = (body: string) => svgDoc(DECO_VIEWBOX, body, 'overflow="visible"');

const soulDefs = (p: string) => rad(`${p}soul`, [[0, "#eafff6"], [0.35, "#7dffc8"], [1, "#2bd9a0", 0]]);

/** Ruh alevi (yeşil ışık topu) — ışıltı animasyonlu. */
function soul(p: string, x: number, y: number, r: number, delay: number): string {
  return `<g ${anim("twinkle", x, y, delay)}><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${p}soul)"/></g>`;
}

/* ── Tırmanan İskeletler ─────────────────────────────────────────────── */
/** Avatarı saran dikenli mor sarmaşık (iki iplik). */
function thornVine(p: string, from = 0, to = 360, r = 51.5): string {
  const a = wavyArc(64, 64, r, 2.2, 7, 0, from, to);
  const b = wavyArc(64, 64, r, 2.2, 7, 180, from, to);
  let thorns = "";
  for (let deg = from + 8; deg < to; deg += 23) {
    const [x1, y1] = polar(64, 64, r + 2.4, deg - 2.5);
    const [x2, y2] = polar(64, 64, r + 6.4, deg + 1);
    const [x3, y3] = polar(64, 64, r + 2.4, deg + 2.5);
    thorns += `M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}`;
  }
  return (
    `<path d="${thorns}" fill="#4b2f66" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="${a}M${b.slice(1)}" fill="none" stroke="${OL}" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="${a}" fill="none" stroke="url(#${p}vine)" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="${b}" fill="none" stroke="url(#${p}vine)" stroke-width="2.6" stroke-linecap="round"/>`
  );
}

const vineDefs = (p: string) => lin(`${p}vine`, [[0, "#8a5fb5"], [0.5, "#4e3170"], [1, "#2e1d45"]], 0, 0, 1, 1);

const climbers: DecorationArt = {
  back: (p) => {
    const [x, y] = polar(64, 64, 49, 145);
    return doc(
      `<defs>${boneDefs(p)}${vineDefs(p)}</defs>` +
        thornVine(p) +
        // Sol altta kenarın ARKASINDAN bakan üçüncü iskelet: kafatası
        // avatarın arkasında, parmakları önde (front katmanında).
        `<g transform="translate(${x} ${y}) rotate(235)"><g ${anim("peek", 0, 0, 1.2, 5.5)}>` +
        `<g transform="translate(0 -7) scale(1.15)">${skull(p, "#9dffcf", { tilt: 8 })}</g></g></g>`,
    );
  },
  front: (p) => {
    const [ax, ay] = polar(64, 64, 45, -116);
    const [cx, cy] = polar(64, 64, 49, 145);
    // A: sol üstte sarmaşığa oturmuş, el sallıyor; bacakları avatarın içine sarkıyor.
    const sitter = skeleton(p, {
      armL: [[-4.2, 11.5], [-8.4, 15], [-8.6, 19.6]],
      armR: [[4.2, 11.5], [8.6, 7.4], [10.6, 2.2]],
      armRAttrs: anim("wave", 4.2, 11.5, 0, 1.6),
      legL: [[-2.2, 21.5], [-4.8, 26.6], [-2.6, 31]],
      legR: [[2.2, 21.5], [4.4, 27.4], [6.2, 31.6]],
      tilt: -8,
    });
    // B: sağda sarmaşığa iki eliyle tutunmuş sarkıyor (sallanır).
    const hanger = skeleton(p, {
      armL: [[-4.2, 11.5], [-6.4, 5], [-4.6, -2.6]],
      armR: [[4.2, 11.5], [6.6, 4.6], [5, -2.4]],
      legL: [[-2.2, 21.5], [-3.6, 27], [-2.4, 32.4]],
      legR: [[2.2, 21.5], [4.8, 26.4], [6.8, 30.6]],
      tilt: 10,
      glow: "#ffd36b",
    });
    return doc(
      `<defs>${boneDefs(p)}${soulDefs(p)}${vineDefs(p)}</defs>` +
        // Sarmaşığın avatarın ÖNÜNDEN geçen parçaları (derinlik).
        `<path d="${wavyArc(64, 64, 49.5, 2.6, 7, 180, 196, 232)}" fill="none" stroke="${OL}" stroke-width="4.6" stroke-linecap="round"/>` +
        `<path d="${wavyArc(64, 64, 49.5, 2.6, 7, 180, 196, 232)}" fill="none" stroke="url(#${p}vine)" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="${wavyArc(64, 64, 49.5, 2.6, 7, 0, 18, 44)}" fill="none" stroke="${OL}" stroke-width="4.6" stroke-linecap="round"/>` +
        `<path d="${wavyArc(64, 64, 49.5, 2.6, 7, 0, 18, 44)}" fill="none" stroke="url(#${p}vine)" stroke-width="2.6" stroke-linecap="round"/>` +
        `<g transform="translate(${ax} ${ay}) rotate(-26) scale(1.2) translate(0 -21)">${sitter}</g>` +
        `<g transform="translate(110 43) scale(1.2)"><g ${anim("swing", 0, -2.5, 0.4, 3.4)}>${hanger}</g></g>` +
        // Üçüncünün parmakları kenarı kavrıyor.
        `<g transform="translate(${cx} ${cy}) rotate(235)">${fingers(-6)}${fingers(6)}</g>` +
        soul(p, 12, 40, 4.4, 0) +
        soul(p, 98, 8, 3.4, 0.9) +
        soul(p, 122, 92, 3, 1.7) +
        soul(p, 54, 124, 2.6, 0.4),
    );
  },
};

/** Kenarı kavrayan üç parmak (yerel: kenar çizgisi y=0; uçlar içeri, +y). */
function fingers(x: number): string {
  return [-2, 0, 2]
    .map(
      (dx) =>
        `<path d="M${x + dx} -1.6V3.2" stroke="${OL}" stroke-width="3.2" stroke-linecap="round"/><path d="M${x + dx} -1.6V3.2" stroke="#f6f0e4" stroke-width="1.7" stroke-linecap="round"/>`,
    )
    .join("");
}

/* ── Fenerli İskelet ─────────────────────────────────────────────────── */
const lanternKeeper: DecorationArt = {
  back: (p) =>
    doc(
      `<defs>${radU(`${p}halo`, [[0, "#ffd68a", 0.75], [0.45, "#ffb347", 0.28], [1, "#ff8a00", 0]], 44, 22, 30)}</defs>` +
        `<g ${anim("pulse", 44, 22, 0, 2.4)}><circle cx="44" cy="22" r="30" fill="url(#${p}halo)"/></g>`,
    ),
  front: (p) => {
    const [sx, sy] = polar(64, 64, 47, -46);
    const pose = skeleton(p, {
      // Sağ kol direği tutuyor (direk kol grubunun içinde değil; sabit).
      armL: [[-4.2, 11.5], [-7.6, 15.4], [-6, 19.6]],
      armR: [[4.2, 11.5], [-1, 9.4], [-6.4, 7.6]],
      legL: [[-2.2, 21.5], [-6, 25], [-6.6, 30.4]],
      legR: [[2.2, 21.5], [-1.4, 26.4], [-0.8, 31.6]],
      tilt: -14,
      hat: witchHat(),
      glow: "#ffcf6b",
    });
    // Direk: elden sola yukarı kıvrılır, ucunda fener sallanır.
    const pole = `<path d="M90 26C82 10 66 3 46 6" fill="none" stroke="${OL}" stroke-width="3.6" stroke-linecap="round"/><path d="M90 26C82 10 66 3 46 6" fill="none" stroke="#8a5a3b" stroke-width="2" stroke-linecap="round"/>`;
    const lantern =
      `<g ${anim("swing", 46, 6, 0, 2.8)}>` +
      `<path d="M46 6V11" stroke="${OL}" stroke-width="1.2"/>` +
      `<path d="M40.6 13.4H51.4L50 11.4H42Z" fill="#3b2c4a" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>` +
      `<path d="M41.4 13.4H50.6L51.6 28.6H40.4Z" fill="url(#${p}glass)" stroke="${OL}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M46 13.4V28.6M43.6 13.4L43 28.6M48.4 13.4L49 28.6" stroke="${OL}" stroke-opacity=".55" stroke-width=".8"/>` +
      `<g ${anim("flicker", 46, 25, 0, 0.9)}><path d="M46 18C47.6 20.6 48.2 22.4 47.6 24C47 25.6 45 25.6 44.4 24C43.8 22.4 44.4 20.6 46 18Z" fill="#fff6c8"/></g>` +
      `<path d="M39.4 28.6H52.6L51.4 31.2H40.6Z" fill="#3b2c4a" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>` +
      `<path d="M42.4 15V26" stroke="#fff" stroke-opacity=".7" stroke-width="1" stroke-linecap="round"/>` +
      `</g>`;
    // Alt yarıyı saran mor mezarlık sisi (iki katman, sürüklenir) + mezar taşı.
    const mist =
      `<g ${anim("drift", 30, 100, 0, 7)}>` +
      `<path d="${cloudBand(64, 64, 44, 58, 96, 214, 7)}" fill="url(#${p}mist)" opacity=".62"/>` +
      `<path d="${cloudBand(64, 64, 45, 53, 104, 200, 6)}" fill="#e4dbff" opacity=".35"/>` +
      `</g>`;
    const [tx, ty] = polar(64, 64, 55, 128);
    const tomb =
      `<g transform="translate(${tx} ${ty}) rotate(-8)">` +
      blob(0, 1, 9, 2.2, "#000", 0.25) +
      `<path d="M-6.4 1V-9C-6.4 -14 6.4 -14 6.4 -9V1Z" fill="url(#${p}stone)" stroke="${OL}" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M0 -10.4V-3.6M-2.4 -8H2.4" stroke="${OL}" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/>` +
      `<path d="M-4.8 -9C-4.6 -11.4 -2.8 -12.4 -1 -12.4" stroke="#fff" stroke-opacity=".5" stroke-width="1" fill="none" stroke-linecap="round"/>` +
      `<path d="M-8 1.2C-6 -1.6 -5 -1 -4 0.6C-3 -2 -1.4 -1.6 0 0.8C1.4 -1.4 3 -2 4 0.6C5 -1 6.4 -1.4 8 1.2Z" fill="#4f7a3a" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/>` +
      `</g>`;
    return doc(
      `<defs>${boneDefs(p)}${lin(`${p}glass`, [[0, "#fff1b8"], [0.5, "#ffc95c"], [1, "#ff9b3a"]])}${lin(`${p}mist`, [[0, "#c6b6ff", 0.95], [1, "#6a4fc8", 0.55]], 0, 0, 1, 1)}${lin(`${p}stone`, [[0, "#a9a3c2"], [1, "#5d5878"]])}</defs>` +
        mist +
        tomb +
        pole +
        lantern +
        blob(sx - 2, sy + 12, 7, 2.6, "#000", 0.18) +
        `<g transform="translate(${sx} ${sy}) rotate(44) translate(0 -20.5)">${pose}</g>` +
        `<g transform="translate(14 56)"><g ${anim("bob", 0, 0, 0.3, 2.2)}>${bat()}</g></g>` +
        `<g transform="translate(26 40) scale(.7)"><g ${anim("bob", 0, 0, 1.2, 2.6)}>${bat()}</g></g>`,
    );
  },
};

/* ── Kafatası Üçlüsü ─────────────────────────────────────────────────── */
function imp(p: string, horn: string): string {
  return (
    // Kanatlar (kafatasının arkasında).
    `<path d="M-6 -1C-11 -6 -16 -6 -19 -2.6C-16.6 -2.6 -15.6 -1.2 -16 0.4C-13.8 -0.8 -12 0 -11.6 1.6C-10 0.6 -8 1 -6.6 2.6ZM6 -1C11 -6 16 -6 19 -2.6C16.6 -2.6 15.6 -1.2 16 0.4C13.8 -0.8 12 0 11.6 1.6C10 0.6 8 1 6.6 2.6Z" fill="url(#${p}wing)" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>` +
    // Boynuzlar.
    `<path d="M-6.4 -6.6C-8.6 -9.6 -8.4 -12.6 -7 -14.6C-6.4 -12 -4.6 -10.4 -3 -9.2ZM6.4 -6.6C8.6 -9.6 8.4 -12.6 7 -14.6C6.4 -12 4.6 -10.4 3 -9.2Z" fill="${horn}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<path d="M-8.6 -1.2C-8.6 -7 -4.6 -9.6 0 -9.6C4.6 -9.6 8.6 -7 8.6 -1.2C8.6 2 7.2 3.6 5.4 4.4L5 7.6C5 8.5 4.3 9 3.4 9H-3.4C-4.3 9 -5 8.5 -5 7.6L-5.4 4.4C-7.2 3.6 -8.6 2 -8.6 -1.2Z" fill="url(#${p}bone)" stroke="${OL}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M-5.6 -5.2C-4.2 -7.4 -1.6 -8.2 1 -8" stroke="#fff" stroke-width="1.3" stroke-linecap="round" fill="none"/>` +
    `<path d="M-6 -2.6L-1.2 -0.4L-2.4 2.2C-4.6 2.4 -6.2 1 -6 -2.6ZM6 -2.6L1.2 -0.4L2.4 2.2C4.6 2.4 6.2 1 6 -2.6Z" fill="${OL}"/>` +
    `<g ${anim("blink", 0, 0.4, 0, 3.6)}><circle cx="-3" cy="0.4" r="1.1" fill="#ff5a7a"/><circle cx="3" cy="0.4" r="1.1" fill="#ff5a7a"/></g>` +
    `<path d="M0 2.6L-1 4.2H1Z" fill="${OL}"/>` +
    `<path d="M-3.2 6.3H3.2M-1.6 5.3V7.4M0 5.3V7.4M1.6 5.3V7.4" stroke="${OL}" stroke-width=".8" stroke-linecap="round"/>`
  );
}

const skullTrio: DecorationArt = {
  back: (p) =>
    doc(
      `<defs>${lin(`${p}orbit`, [[0, "#c58cff", 0.9], [0.5, "#ff5a9a", 0.2], [1, "#7c5cff", 0.9]], 0, 0, 1, 1)}</defs>` +
        `<g ${anim("spin", 64, 64, 0, 18)}><circle cx="64" cy="64" r="56" fill="none" stroke="url(#${p}orbit)" stroke-width="2.4" stroke-dasharray="10 6 2 6"/></g>`,
    ),
  front: (p) => {
    const spots: [number, number, string, number][] = [
      [-138, 1.32, "#ff4d6d", 0],
      [-36, 1.14, "#b06bff", 0.8],
      [152, 1.02, "#ff9a3c", 1.6],
    ];
    return doc(
      `<defs>${boneDefs(p)}${lin(`${p}wing`, [[0, "#6b3fa0"], [1, "#2e1b4a"]])}${soulDefs(p)}</defs>` +
        spots
          .map(([deg, s, horn, d]) => {
            const [x, y] = polar(64, 64, 53, deg);
            return `<g transform="translate(${x} ${y}) scale(${s})"><g ${anim("bob", 0, 0, d, 2.4)}>${blob(0, 12, 6, 1.8, "#000", 0.2)}${imp(p, horn)}</g></g>`;
          })
          .join("") +
        soul(p, 100, 112, 2.4, 0.5) +
        soul(p, 8, 76, 2, 1.3) +
        `<g ${anim("twinkle", 92, 12, 1)}><path d="${sparklePath(92, 12, 4)}" fill="#ffd1f0"/></g>`,
    );
  },
};

/* ── Hayalet Dostlar ─────────────────────────────────────────────────── */
const ghostDefs = (p: string) => lin(`${p}ghost`, [[0, "#ffffff"], [0.65, "#eeeaff"], [1, "#c9bff5"]]);

const ghosts: DecorationArt = {
  // Avatarın çevresinde dönen hayalet sisi halkası.
  back: (p) =>
    doc(
      `<defs>${lin(`${p}wisp`, [[0, "#b9a6ff", 0], [0.5, "#efe9ff", 0.95], [1, "#b9a6ff", 0]], 0, 0, 1, 1)}</defs>` +
        `<g ${anim("spin", 64, 64, 0, 26)}>` +
        `<path d="${wavyArc(64, 64, 53, 2.4, 5, 0, -80, 150)}" fill="none" stroke="url(#${p}wisp)" stroke-width="6" stroke-linecap="round" opacity=".45"/>` +
        `<path d="${wavyArc(64, 64, 53, 2.4, 5, 0, -80, 150)}" fill="none" stroke="url(#${p}wisp)" stroke-width="1.6" stroke-linecap="round"/>` +
        `<path d="${wavyArc(64, 64, 55, 2, 4, 90, 110, 300)}" fill="none" stroke="url(#${p}wisp)" stroke-width="5" stroke-linecap="round" opacity=".4"/>` +
        `<path d="${wavyArc(64, 64, 55, 2, 4, 90, 110, 300)}" fill="none" stroke="url(#${p}wisp)" stroke-width="1.4" stroke-linecap="round"/>` +
        `</g>`,
    ),
  front: (p) =>
    doc(
      `<defs>${ghostDefs(p)}</defs>` +
        `<g transform="translate(102 26) rotate(16) scale(1.4)"><g ${anim("float", 0, 0, 0.6, 3.8)}>${blob(0, 17, 7, 1.8, "#3a2a66", 0.16)}${ghost(p, "smile")}</g></g>` +
        `<g transform="translate(17 44) rotate(-14) scale(1.12)"><g ${anim("float", 0, 0, 0, 3.4)}>${ghost(p, "o")}</g></g>` +
        `<g transform="translate(30 110) rotate(10) scale(.82)"><g ${anim("float", 0, 0, 1.4, 3)}>${ghost(p, "smile")}</g></g>` +
        `<g ${anim("twinkle", 116, 76, 0.4)}><path d="${sparklePath(116, 76, 4.2)}" fill="#e6dcff"/></g>` +
        `<g ${anim("twinkle", 6, 76, 1.4)}><path d="${sparklePath(6, 76, 3.2)}" fill="#fff"/></g>` +
        `<g ${anim("twinkle", 60, 5, 0.9)}><path d="${sparklePath(60, 5, 3.4)}" fill="#e6dcff"/></g>`,
    ),
};

/* ── Balkabağı Feneri ────────────────────────────────────────────────── */
const pumpkinPatch: DecorationArt = {
  front: (p) => {
    const defs =
      lin(`${p}pumpkin`, [[0, "#ffb347"], [0.55, "#ff7f1f"], [1, "#d1550b"]]) +
      lin(`${p}pglow`, [[0, "#fff4b0"], [1, "#ffb627"]]) +
      lin(`${p}wax`, [[0, "#fff8ec"], [1, "#e8d4b8"]], 0, 0, 1, 0) +
      lin(`${p}flame`, [[0, "#ff6a00"], [0.6, "#ffb000"], [1, "#ffe9a0"]]) +
      lin(`${p}leaf`, [[0, "#8fbf4a"], [1, "#4f7a24"]]) +
      radU(`${p}warm`, [[0, "#ffb347", 0.55], [1, "#ff7f1f", 0]], 34, 104, 26);
    const vine =
      `<path d="M22 100C10 88 6 70 12 54C16 44 22 38 28 34" fill="none" stroke="${OL}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="M22 100C10 88 6 70 12 54C16 44 22 38 28 34" fill="none" stroke="#5f8a2c" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M28 34C32 31 35 33 34 36C33 39 29 38 30 35" fill="none" stroke="#5f8a2c" stroke-width="1.3" stroke-linecap="round"/>` +
      leaf(p, 9, 70, -120) +
      leaf(p, 15, 48, -60) +
      leaf(p, 13, 88, 200);
    return doc(
      `<defs>${defs}</defs>` +
        `<g ${anim("pulse", 34, 104, 0, 1.6)}><circle cx="34" cy="104" r="26" fill="url(#${p}warm)"/></g>` +
        vine +
        `<g transform="translate(62 118)">${candle(p, 9, anim("flicker", 0, -9, 0.2, 0.8))}</g>` +
        `<g transform="translate(70 120)">${candle(p, 6, anim("flicker", 0, -6, 0.6, 0.7))}</g>` +
        `<g transform="translate(16 92) rotate(-16)">${pumpkin(p, 9, "spooky", anim("flicker", 0, 0, 0.5, 1.4))}</g>` +
        `<g transform="translate(38 108) rotate(6)">${blob(0, 10, 16, 3, "#000", 0.25)}${pumpkin(p, 14, "happy", anim("flicker", 0, 0, 0, 1.2))}</g>` +
        `<g transform="translate(104 14)"><g ${anim("bob", 0, 0, 0.4, 2.2)}>${bat()}</g></g>` +
        `<g transform="translate(118 34) scale(.72)"><g ${anim("bob", 0, 0, 1.1, 2.6)}>${bat()}</g></g>`,
    );
  },
};

function leaf(p: string, x: number, y: number, rot: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0C3 -5 9 -6 12 -3C14 -1 13 3 11 5C9 3 7 4 6 6C4 4 2 4 0 0Z" fill="url(#${p}leaf)" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><path d="M1 0C4 0 8 0 11 1" stroke="#2f4a14" stroke-opacity=".5" stroke-width=".7" fill="none"/></g>`;
}

/* ── Örümcek Ağı ─────────────────────────────────────────────────────── */
function web(cx: number, cy: number, r: number, from: number, to: number, spokes: number, rings: number): string {
  let d = "";
  const angles: number[] = [];
  for (let i = 0; i < spokes; i++) angles.push(from + ((to - from) * i) / (spokes - 1));
  for (const a of angles) {
    const [x, y] = polar(cx, cy, r, a);
    d += `M${cx} ${cy}L${x} ${y}`;
  }
  for (let k = 1; k <= rings; k++) {
    const rr = (r * k) / (rings + 0.4);
    angles.forEach((a, i) => {
      if (i === 0) return;
      const [x1, y1] = polar(cx, cy, rr, angles[i - 1]);
      const [x2, y2] = polar(cx, cy, rr, a);
      const [qx, qy] = polar(cx, cy, rr * 0.86, (angles[i - 1] + a) / 2);
      d += `${i === 1 ? `M${x1} ${y1}` : ""}Q${qx} ${qy} ${x2} ${y2}`;
    });
  }
  return d;
}

const spiderWeb: DecorationArt = {
  front: (p) => {
    const big = web(6, 6, 60, 8, 82, 6, 5);
    const small = web(2, 126, 28, -82, -8, 4, 3);
    const drops: [number, number, number][] = [
      [30, 22, 0],
      [16, 44, 0.8],
      [44, 40, 1.6],
      [14, 112, 1.1],
    ];
    return doc(
      `<defs>${rad(`${p}spider`, [[0, "#6a4e8f"], [0.7, "#2b1d3d"], [1, "#160e22"]], 0.4, 0.35, 0.7)}</defs>` +
        `<g ${anim("breathe", 4, 4, 0, 5)}>` +
        `<path d="${big}" fill="none" stroke="${OL}" stroke-opacity=".35" stroke-width="2.2" stroke-linecap="round"/>` +
        `<path d="${big}" fill="none" stroke="#f4f0ff" stroke-opacity=".92" stroke-width="1" stroke-linecap="round"/>` +
        `</g>` +
        `<path d="${small}" fill="none" stroke="${OL}" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="${small}" fill="none" stroke="#f4f0ff" stroke-opacity=".9" stroke-width=".9" stroke-linecap="round"/>` +
        drops
          .map(
            ([x, y, d]) =>
              `<g ${anim("twinkle", x, y, d, 2.6)}><circle cx="${x}" cy="${y}" r="1.6" fill="#bfe8ff" stroke="#fff" stroke-width=".6"/><circle cx="${x - 0.5}" cy="${y - 0.5}" r=".5" fill="#fff"/></g>`,
          )
          .join("") +
        // İpe asılı örümcek (iniş-çıkış).
        `<g ${anim("dangle", 106, 0, 0, 4.2)}>` +
        `<path d="M106 -8V28" stroke="#f4f0ff" stroke-width=".9"/>` +
        `<g transform="translate(106 34)">${spider(p)}</g>` +
        `</g>`,
    );
  },
};

/* ── Kara Ay ─────────────────────────────────────────────────────────── */
const darkMoon: DecorationArt = {
  back: (p) =>
    doc(
      `<defs>${radU(`${p}aura`, [[0.6, "#8b3dff", 0], [0.82, "#8b3dff", 0.45], [1, "#8b3dff", 0]], 60, 64, 66)}</defs>` +
        `<g ${anim("pulse", 64, 64, 0, 3.2)}><circle cx="60" cy="64" r="66" fill="url(#${p}aura)"/></g>`,
    ),
  front: (p) => {
    const cracks =
      "M14 40L22 46L19 54L27 60M9 74L18 77L16 86M30 22L33 30L41 31M22 100L30 99L33 108L42 109";
    return doc(
      `<defs>` +
        lin(`${p}moon`, [[0, "#4a3d66"], [0.5, "#241c36"], [1, "#100b1a"]], 0, 0, 1, 1) +
        `<mask id="${p}cut"><rect x="-20" y="-20" width="170" height="170" fill="#fff"/><circle cx="71" cy="62" r="54" fill="#000"/></mask>` +
        lin(`${p}smoke`, [[0, "#c9b8ff", 0.7], [1, "#5b3fa8", 0]]) +
        `</defs>` +
        `<g mask="url(#${p}cut)">` +
        `<circle cx="60" cy="64" r="60" fill="url(#${p}moon)" stroke="${OL}" stroke-width="1.6"/>` +
        `<circle cx="14" cy="64" r="5" fill="#120c1e" opacity=".7"/><circle cx="24" cy="30" r="3.4" fill="#120c1e" opacity=".7"/><circle cx="22" cy="104" r="4" fill="#120c1e" opacity=".7"/>` +
        `<path d="M6 50C4 62 5 80 12 94" stroke="#8d7bb5" stroke-opacity=".5" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
        `<g ${anim("pulse", 20, 64, 0.5, 2.2)}>` +
        `<path d="${cracks}" fill="none" stroke="#b26bff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/>` +
        `<path d="${cracks}" fill="none" stroke="#f0d9ff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` +
        `</g>` +
        `</g>` +
        // Uçlardan yükselen duman.
        `<g ${anim("drift", 70, 6, 0, 6)}><path d="M60 8C64 0 74 -2 78 4C84 0 92 4 90 10C84 14 70 14 60 8Z" fill="url(#${p}smoke)"/></g>` +
        `<g ${anim("drift", 70, 120, 2, 7)}><path d="M58 120C64 114 74 114 78 118C84 116 90 120 88 124C80 128 64 128 58 120Z" fill="url(#${p}smoke)"/></g>` +
        `<g transform="translate(108 22)"><g ${anim("bob", 0, 0, 0.2, 2.3)}>${bat("#1d1429", "#3a2752")}</g></g>` +
        `<g transform="translate(120 44) scale(.7)"><g ${anim("bob", 0, 0, 1, 2.7)}>${bat("#1d1429", "#3a2752")}</g></g>` +
        `<g ${anim("twinkle", 116, 82, 0.6)}><path d="${sparklePath(116, 82, 3.2)}" fill="#e2c8ff"/></g>`,
    );
  },
};

export const SPOOKY_DECORATIONS: Record<string, DecorationArt> = {
  iskelet_tirmanan: climbers,
  iskelet_fener: lanternKeeper,
  kafatasi_uclusu: skullTrio,
  hayalet: ghosts,
  kabak: pumpkinPatch,
  orumcek_agi: spiderWeb,
  kara_ay: darkMoon,
};
