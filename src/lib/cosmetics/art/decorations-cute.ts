/**
 * Sevimli Dostlar avatar süsleri: kedi, tavşan, tilki, buz kurdu, ayıcık.
 * Kulak tabanları avatarın ARKASINDA (back) kalır — taç gibi değil, kafadan
 * çıkıyormuş gibi görünsün; pati/fiyonk/kuyruk önde (front).
 */
import { OL, anim, blob, lin, polar, rad, radU, sparklePath, svgDoc } from "./kit";
import { DECO_VIEWBOX, type DecorationArt } from "./types";

const doc = (body: string) => svgDoc(DECO_VIEWBOX, body, 'overflow="visible"');

interface EarStyle {
  w: number;
  h: number;
  /** Ucun yana kayması (yerel x). */
  lean?: number;
  /** Kulak sivriliği: 0 = yuvarlak, 1 = sivri. */
  sharp?: number;
  fur: string;
  inner: string;
  tip?: string;
  fluff?: string;
}

/** Kulak (yerel: taban merkezi 0,0; uç -y yönünde). */
function earShape(w: number, h: number, lean: number, sharp: number): string {
  const tx = lean;
  const c = 1 - sharp;
  return `M${-w} 6C${-w} ${-h * 0.35} ${-w * (0.5 + c * 0.4) + tx * 0.4} ${-h * (0.82 + c * 0.1)} ${tx - c * 3} ${-h}C${tx + c * 3} ${-h - c * 1.5} ${w * (0.5 + c * 0.4) + tx * 0.4} ${-h * (0.8 + c * 0.1)} ${w} ${-h * 0.3}C${w * 1.05} ${-h * 0.1} ${w} 3 ${w} 6Z`;
}

function ear(p: string, s: EarStyle, x: number, y: number, rot: number, twitchDelay: number, side: 1 | -1): string {
  const lean = (s.lean ?? 0) * side;
  const sharp = s.sharp ?? 0.8;
  const outer = earShape(s.w, s.h, lean, sharp);
  const inner = earShape(s.w * 0.56, s.h * 0.7, lean * 0.8, sharp);
  const tip = s.tip
    ? `<clipPath id="${p}tc${side}"><path d="${outer}"/></clipPath><g clip-path="url(#${p}tc${side})"><ellipse cx="${lean}" cy="${-s.h}" rx="${s.w * 0.9}" ry="${s.h * 0.34}" fill="${s.tip}"/></g>`
    : "";
  const fluff = s.fluff
    ? `<path d="M${-s.w * 0.3} 2C${-s.w * 0.36} ${-s.h * 0.2} ${-s.w * 0.1} ${-s.h * 0.36} ${lean * 0.3} ${-s.h * 0.42}M${s.w * 0.1} 2C${s.w * 0.2} ${-s.h * 0.16} ${s.w * 0.3} ${-s.h * 0.26} ${s.w * 0.36 + lean * 0.2} ${-s.h * 0.32}M${-s.w * 0.05} 2C${-s.w * 0.1} ${-s.h * 0.1} ${0} ${-s.h * 0.2} ${lean * 0.2 + 1} ${-s.h * 0.3}" fill="none" stroke="${s.fluff}" stroke-width="1.6" stroke-linecap="round"/>`
    : "";
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot})"><g ${anim("twitch", 0, 4, twitchDelay, 4.6)}>` +
    `<path d="${outer}" fill="${s.fur}" stroke="${OL}" stroke-width="1.7" stroke-linejoin="round"/>` +
    tip +
    `<path d="${inner}" transform="translate(0 -1)" fill="${s.inner}"/>` +
    fluff +
    `<path d="M${-s.w * 0.72} ${-s.h * 0.2}C${-s.w * 0.62} ${-s.h * 0.55} ${-s.w * 0.3 + lean * 0.3} ${-s.h * 0.82} ${lean * 0.6} ${-s.h * 0.9}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round"/>` +
    `</g></g>`
  );
}

/** İki kulak, avatarın tepesinde simetrik (açı: merkezden derece). */
function earPair(p: string, s: EarStyle, spread = 38, r = 42): string {
  const [lx, ly] = polar(64, 64, r, -90 - spread);
  const [rx, ry] = polar(64, 64, r, -90 + spread);
  return ear(p, s, lx, ly, -spread, 0, -1) + ear(p, s, rx, ry, spread, 1.3, 1);
}

/**
 * Pati (yerel: kenar üstünde; parmaklar +y, avatarın içine bakar).
 */
function paw(fill: string, x: number, y: number, rot: number, toe = OL): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot})">` +
    blob(0.6, 2.4, 8, 5, "#000", 0.18) +
    `<path d="M-7.6 -1.4C-7.6 -6 -4 -7.4 0 -7.4C4 -7.4 7.6 -6 7.6 -1.4C7.6 2 7 4.6 5.4 5.6C4.2 6.4 3 6 2.6 5.2C2 6.6 -2 6.6 -2.6 5.2C-3 6 -4.2 6.4 -5.4 5.6C-7 4.6 -7.6 2 -7.6 -1.4Z" fill="${fill}" stroke="${OL}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M-2.6 5.2V2.4M2.6 5.2V2.4" stroke="${toe}" stroke-opacity=".55" stroke-width="1.1" stroke-linecap="round"/>` +
    `<path d="M-4.8 -4.4C-3 -5.8 0 -6 2 -5.6" stroke="#fff" stroke-opacity=".55" stroke-width="1.3" stroke-linecap="round" fill="none"/>` +
    `</g>`
  );
}

/** Fiyonk (merkez düğüm 0,0; genişlik ~2.2w). */
function bow(p: string, w = 10, dots = true): string {
  const k = w / 10;
  const loops = `M0 0C-3 -6 -9 -9 -11 -6C-12.6 -3.6 -11.6 2.4 -9.4 4.6C-6.6 6.8 -2.6 3.6 0 0ZM0 0C3 -6 9 -9 11 -6C12.6 -3.6 11.6 2.4 9.4 4.6C6.6 6.8 2.6 3.6 0 0Z`;
  const tails = `M-1.4 1.6C-3 5 -5 9 -7.4 11.4L-4 11.6L-3.2 14C-1.4 10.6 -0.4 6 0.2 2ZM1.4 1.6C3 5 5 9 7.4 11.4L4 11.6L3.2 14C1.4 10.6 0.4 6 -0.2 2Z`;
  return (
    `<g transform="scale(${k})">` +
    `<path d="${tails}" fill="url(#${p}bow2)" stroke="${OL}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="${loops}" fill="url(#${p}bow)" stroke="${OL}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M-2 -1.6C-4.4 -3.8 -7.4 -5.6 -9 -4.6M2 -1.6C4.4 -3.8 7.4 -5.6 9 -4.6" stroke="${OL}" stroke-opacity=".35" stroke-width="1" fill="none" stroke-linecap="round"/>` +
    (dots ? `<circle cx="-7.6" cy="-1.6" r="1.1" fill="#fff" opacity=".85"/><circle cx="6.8" cy="0.6" r="1.1" fill="#fff" opacity=".85"/><circle cx="-5" cy="2.6" r=".8" fill="#fff" opacity=".85"/><circle cx="8.6" cy="-3.4" r=".8" fill="#fff" opacity=".85"/>` : "") +
    `<ellipse cx="0" cy="0" rx="3" ry="3.4" fill="url(#${p}bow2)" stroke="${OL}" stroke-width="1.3"/>` +
    `<path d="M-9.4 -5C-8.4 -6.4 -6.6 -6.4 -5.4 -5.6" stroke="#fff" stroke-opacity=".7" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `</g>`
  );
}

const bowDefs = (p: string, a: string, b: string, c: string) =>
  lin(`${p}bow`, [[0, a], [0.6, b], [1, c]]) + lin(`${p}bow2`, [[0, b], [1, c]]);

/** Altın çan (merkez 0,0). */
function bell(p: string): string {
  return (
    `<circle cx="0" cy="0" r="5.4" fill="url(#${p}bell)" stroke="${OL}" stroke-width="1.4"/>` +
    `<path d="M-5 0.4H5" stroke="${OL}" stroke-opacity=".5" stroke-width="1"/>` +
    `<circle cx="0" cy="2.6" r="1.2" fill="${OL}"/><path d="M0 2.6V5" stroke="${OL}" stroke-width="1"/>` +
    `<ellipse cx="-2" cy="-2.4" rx="1.6" ry="1.1" fill="#fff" opacity=".85"/>`
  );
}

/* ── Kedi Kulakları ───────────────────────────────────────────────────── */
const cat: DecorationArt = {
  back: (p) =>
    doc(
      `<defs>${lin(`${p}fur`, [[0, "#e9e4fb"], [0.6, "#bdb3e6"], [1, "#9488c7"]])}${lin(`${p}in`, [[0, "#ffc2da"], [1, "#ff8fb8"]])}</defs>` +
        earPair(p, { w: 14, h: 30, lean: 2, sharp: 0.75, fur: `url(#${p}fur)`, inner: `url(#${p}in)`, fluff: "#fff" }, 40, 41),
    ),
  front: (p) => {
    const collar = (() => {
      let d = "";
      for (let i = 0; i <= 24; i++) {
        const [x, y] = polar(64, 64, 47.5, 58 + (64 * i) / 24);
        d += `${i ? "L" : "M"}${x} ${y}`;
      }
      return d;
    })();
    const [bx, by] = polar(64, 64, 50, 90);
    const [kx, ky] = polar(64, 64, 45, -50);
    const [p1x, p1y] = polar(64, 64, 49, 142);
    const [p2x, p2y] = polar(64, 64, 49, 26);
    return doc(
      `<defs>${lin(`${p}fur`, [[0, "#f3f0ff"], [0.6, "#c9c0ee"], [1, "#9a8fcc"]])}${bowDefs(p, "#ffb3d1", "#ff6fa8", "#e0457f")}${rad(`${p}bell`, [[0, "#fff4c2"], [0.55, "#ffcc33"], [1, "#c98a00"]], 0.35, 0.3, 0.7)}${lin(`${p}col`, [[0, "#ff7bae"], [1, "#d93f78"]])}</defs>` +
        `<path d="${collar}" fill="none" stroke="${OL}" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="${collar}" fill="none" stroke="url(#${p}col)" stroke-width="4.6" stroke-linecap="round"/>` +
        `<path d="${collar}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1" stroke-dasharray="2 3" stroke-linecap="round"/>` +
        `<g transform="translate(${bx} ${by})"><g ${anim("swing", 0, -5, 0, 1.8)}><path d="M0 -6V-3" stroke="${OL}" stroke-width="1.4"/><g transform="translate(0 1.4)">${bell(p)}</g></g></g>` +
        `<g transform="translate(${kx} ${ky}) rotate(38)"><g ${anim("bob", 0, 0, 0.5, 2.6)}>${bow(p, 9.4)}</g></g>` +
        paw(`url(#${p}fur)`, p1x, p1y, 142 + 90) +
        paw(`url(#${p}fur)`, p2x, p2y, 26 + 90),
    );
  },
};

/* ── Tavşan Kulakları ─────────────────────────────────────────────────── */
const bunny: DecorationArt = {
  back: (p) => {
    const [lx, ly] = polar(64, 64, 40, -116);
    const [rx, ry] = polar(64, 64, 40, -64);
    // Sağ kulak yarıdan bükülüp aşağı sarkar.
    const flop = `M-7 6C-8 -6 -7.4 -16 -4 -22C0 -28 10 -30 17 -24C21 -20.4 21 -14 18.6 -10.4C17.4 -8.6 15 -9.2 14.4 -11C13 -15 9 -17 5.6 -15C3.4 -13.6 4.2 -6 6.6 6Z`;
    const flopIn = `M-3.4 4C-4 -6 -3.4 -13 -1 -18C2 -23 9.6 -24.6 14.6 -20.6C16.4 -19 16.8 -16 15.6 -14.4C13.4 -17.8 8.6 -19.6 4.4 -17.4C1.6 -15.8 1.6 -6 2.6 4Z`;
    return doc(
      `<defs>${lin(`${p}fur`, [[0, "#ffffff"], [0.7, "#f1ecf7"], [1, "#d6cde4"]])}${lin(`${p}in`, [[0, "#ffd0e2"], [1, "#ff9cc2"]])}</defs>` +
        ear(p, { w: 8.6, h: 38, lean: -5, sharp: 0.25, fur: `url(#${p}fur)`, inner: `url(#${p}in)` }, lx, ly, -30, 0, -1) +
        `<g transform="translate(${rx} ${ry}) rotate(20)"><g ${anim("twitch", 0, 4, 1.6, 5.2)}>` +
        `<path d="${flop}" fill="url(#${p}fur)" stroke="${OL}" stroke-width="1.7" stroke-linejoin="round"/>` +
        `<path d="${flopIn}" fill="url(#${p}in)"/>` +
        `<path d="M-5 -2C-5.4 -10 -3.6 -18 0 -22" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>` +
        `</g></g>`,
    );
  },
  front: (p) => {
    const flower = (x: number, y: number, s: number, c: string) =>
      `<g transform="translate(${x} ${y}) scale(${s})">` +
      [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-3.6" rx="2.6" ry="3.4" transform="rotate(${a})" fill="${c}" stroke="${OL}" stroke-width=".9"/>`).join("") +
      `<circle r="2" fill="#ffd54a" stroke="${OL}" stroke-width=".9"/></g>`;
    return doc(
      `<defs>${bowDefs(p, "#ffc4dc", "#ff7fb2", "#e2508a")}</defs>` +
        `<g transform="translate(46 20) rotate(-18)"><g ${anim("bob", 0, 0, 0.3, 2.8)}>${bow(p, 13)}</g></g>` +
        flower(26, 34, 1.1, "#fff") +
        flower(18, 46, 0.8, "#ffd0e4") +
        `<g ${anim("twinkle", 104, 18, 0.2)}><path d="${sparklePath(104, 18, 4)}" fill="#ffe1ef"/></g>` +
        `<g ${anim("twinkle", 116, 40, 1.1)}><path d="${sparklePath(116, 40, 3)}" fill="#fff"/></g>`,
    );
  },
};

/* ── Gür kuyruk (tilki/kurt) ──────────────────────────────────────────── */
/**
 * Avatarın altına kıvrılan gür kuyruk: merkez çizgisi daire üstünde
 * `from`→`to` derece; genişlik kökte ince, ortada dolgun, uçta yuvarlak.
 * `t0`..1 aralığını çizer (uç rengi için kuyruğun son kısmı ayrıca çizilir).
 */
function tailPath(from: number, to: number, rc: number, wMax: number, t0 = 0, tufts = 9): string {
  const N = 40;
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = t0 + ((1 - t0) * i) / N;
    const deg = from + (to - from) * t;
    const swell = Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.75));
    const hw = wMax * (0.38 + 0.62 * swell) * (t > 0.8 ? Math.sqrt(Math.max(0, (1 - t) / 0.2)) : 1);
    const fur = 1 + 0.22 * Math.pow(Math.abs(Math.sin(t * Math.PI * tufts)), 0.6);
    // Kök avatarın arkasında başlar (r < 48 → görünmez), sonra dışa açılır.
    const r = rc - Math.max(0, 0.3 - t) * 40 + (t > 0.5 ? (t - 0.5) * 16 : 0);
    const [ox, oy] = polar(64, 64, r + hw * fur, deg);
    const [ix, iy] = polar(64, 64, r - hw * 0.8, deg);
    outer.push(`${ox} ${oy}`);
    inner.push(`${ix} ${iy}`);
  }
  // Uç: dış ve iç kenarı yuvarlak bir uçla birleştir.
  return `M${outer.join("L")}L${inner.reverse().join("L")}Z`;
}

function tail(p: string, from: number, to: number, body: string, tipFill: string, base: [number, number], extra = ""): string {
  const full = tailPath(from, to, 55, 10.5);
  const tip = tailPath(from, to, 55, 10.5, 0.72);
  const [s1x, s1y] = polar(64, 64, 55, from + (to - from) * 0.35);
  const [s2x, s2y] = polar(64, 64, 57, from + (to - from) * 0.55);
  return (
    `<g ${anim("wag", base[0], base[1], 0, 2.8)}>` +
    `<path d="${full}" fill="${body}" stroke="${OL}" stroke-width="1.7" stroke-linejoin="round"/>` +
    `<path d="${tip}" fill="${tipFill}" stroke="${OL}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M${s1x} ${s1y}Q${(s1x + s2x) / 2 - 2} ${(s1y + s2y) / 2 + 3} ${s2x} ${s2y}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round"/>` +
    extra +
    `</g>`
  );
}

/* ── Tilki ────────────────────────────────────────────────────────────── */
const fox: DecorationArt = {
  // Kuyruk avatarın ARKASINDAN çıkıp altına kıvrılır.
  back: (p) =>
    doc(
      `<defs>${lin(`${p}fur`, [[0, "#ffb15c"], [0.6, "#ff7a1f"], [1, "#d9520c"]])}${lin(`${p}in`, [[0, "#fff6ea"], [1, "#ffd9b0"]])}${lin(`${p}tail`, [[0, "#ffb15c"], [0.5, "#ff7a1f"], [1, "#c84a0a"]], 0, 0, 1, 1)}${lin(`${p}tip`, [[0, "#ffffff"], [1, "#f0e4d6"]])}</defs>` +
        tail(p, 70, 196, `url(#${p}tail)`, `url(#${p}tip)`, [96, 106]) +
        earPair(p, { w: 14, h: 33, lean: 3, sharp: 0.92, fur: `url(#${p}fur)`, inner: `url(#${p}in)`, tip: "#3a2418", fluff: "#fff" }, 38, 42),
    ),
  front: () =>
    doc(
      `<g ${anim("twinkle", 112, 20, 0.6)}><path d="${sparklePath(112, 20, 3.4)}" fill="#ffe2b8"/></g>`,
    ),
};

/* ── Buz Kurdu ────────────────────────────────────────────────────────── */
function crystal(x: number, y: number, s: number, rot: number, fill: string): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 -7L2.4 -1.6L0 5L-2.4 -1.6Z" fill="${fill}" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/><path d="M0 -7L0 5" stroke="#fff" stroke-opacity=".7" stroke-width=".7"/></g>`;
}

function shards(p: string): string {
  const ice = `url(#${p}ice)`;
  return (
    crystal(...polar(64, 64, 70, 120), 1.2, 210, ice) +
    crystal(...polar(64, 64, 72, 152), 1, 242, ice) +
    crystal(...polar(64, 64, 72, 182), 1.1, 272, ice)
  );
}

const wolf: DecorationArt = {
  back: (p) =>
    doc(
      `<defs>${lin(`${p}tail`, [[0, "#f4f8ff"], [0.5, "#a9bfdc"], [1, "#6f84a8"]], 0, 0, 1, 1)}${lin(`${p}tip`, [[0, "#ffffff"], [1, "#bfeaff"]])}${lin(`${p}ice`, [[0, "#ffffff"], [0.5, "#aee9ff"], [1, "#5fbfee"]])}${lin(`${p}fur`, [[0, "#e6eef9"], [0.55, "#9fb1cc"], [1, "#6a7c9c"]])}${lin(`${p}in`, [[0, "#f6fbff"], [1, "#c7dcf2"]])}${radU(`${p}chill`, [[0.62, "#9fe6ff", 0], [0.78, "#9fe6ff", 0.35], [1, "#9fe6ff", 0]], 64, 64, 62)}</defs>` +
        `<g ${anim("pulse", 64, 64, 0, 3)}><circle cx="64" cy="64" r="62" fill="url(#${p}chill)"/></g>` +
        tail(p, 70, 198, `url(#${p}tail)`, `url(#${p}tip)`, [96, 106], shards(p)) +
        earPair(p, { w: 13, h: 36, lean: 4, sharp: 1, fur: `url(#${p}fur)`, inner: `url(#${p}in)`, tip: "#e8f7ff", fluff: "#fff" }, 36, 42),
    ),
  front: (p) => {
    return doc(
      `<defs>${lin(`${p}ice`, [[0, "#ffffff"], [0.5, "#aee9ff"], [1, "#5fbfee"]])}</defs>` +
        crystal(...polar(64, 64, 50, -132), 1.3, -42, `url(#${p}ice)`) +
        crystal(...polar(64, 64, 50, -48), 1.3, 42, `url(#${p}ice)`) +
        `<g ${anim("twinkle", 18, 20, 0.2)}><path d="${sparklePath(18, 20, 4.4)}" fill="#dff6ff"/></g>` +
        `<g ${anim("twinkle", 112, 22, 1)}><path d="${sparklePath(112, 22, 3.6)}" fill="#fff"/></g>` +
        `<g ${anim("twinkle", 120, 64, 1.6)}><path d="${sparklePath(120, 64, 2.8)}" fill="#bfeaff"/></g>`,
    );
  },
};

/* ── Ayıcık ───────────────────────────────────────────────────────────── */
function roundEar(p: string, x: number, y: number, delay: number): string {
  return (
    `<g transform="translate(${x} ${y})"><g ${anim("twitch", 0, 6, delay, 5)}>` +
    `<circle r="13" fill="url(#${p}fur)" stroke="${OL}" stroke-width="1.7"/>` +
    `<circle r="7.6" cy="1" fill="url(#${p}in)"/>` +
    `<path d="M-9 -5C-7 -9 -3 -11 1 -11" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `</g></g>`
  );
}

function bee(): string {
  return (
    `<g ${anim("flutter", 0, -3, 0, 0.18)}><ellipse cx="-2.4" cy="-4.4" rx="3" ry="4" transform="rotate(-24 -2.4 -4.4)" fill="#e8f6ff" fill-opacity=".9" stroke="${OL}" stroke-width=".9"/><ellipse cx="2.4" cy="-4.4" rx="3" ry="4" transform="rotate(24 2.4 -4.4)" fill="#e8f6ff" fill-opacity=".9" stroke="${OL}" stroke-width=".9"/></g>` +
    `<ellipse cx="0" cy="0" rx="5.4" ry="4.2" fill="#ffd23f" stroke="${OL}" stroke-width="1.1"/>` +
    `<path d="M-1.6 -3.8V3.8M1.8 -3.6V3.6" stroke="${OL}" stroke-width="1.5"/>` +
    `<circle cx="-3.4" cy="-0.8" r=".8" fill="${OL}"/><path d="M5.4 0L7 0" stroke="${OL}" stroke-width="1"/>`
  );
}

const bear: DecorationArt = {
  back: (p) => {
    const [lx, ly] = polar(64, 64, 50, -130);
    const [rx, ry] = polar(64, 64, 50, -50);
    return doc(
      `<defs>${lin(`${p}fur`, [[0, "#c58a5c"], [0.6, "#9a6238"], [1, "#6e4022"]])}${lin(`${p}in`, [[0, "#f6d2ae"], [1, "#e0a97a"]])}</defs>` +
        roundEar(p, lx, ly, 0) +
        roundEar(p, rx, ry, 1.5),
    );
  },
  front: (p) => {
    const [p1x, p1y] = polar(64, 64, 49, 146);
    const [p2x, p2y] = polar(64, 64, 49, 26);
    return doc(
      `<defs>${lin(`${p}fur`, [[0, "#c58a5c"], [0.6, "#9a6238"], [1, "#6e4022"]])}${lin(`${p}honey`, [[0, "#ffe08a"], [1, "#f0a011"]])}${lin(`${p}pot`, [[0, "#d98c4a"], [1, "#9a5420"]])}</defs>` +
        paw(`url(#${p}fur)`, p1x, p1y, 236, "#3a2418") +
        paw(`url(#${p}fur)`, p2x, p2y, 116, "#3a2418") +
        // Bal kavanozu (sol üst) — ağzından bal damlıyor.
        `<g transform="translate(16 30) rotate(-12)">` +
        blob(0, 9, 8, 2, "#000", 0.2) +
        `<path d="M-6.6 -4.6C-8.4 -1 -8.4 5 -5.6 8.4H5.6C8.4 5 8.4 -1 6.6 -4.6Z" fill="url(#${p}pot)" stroke="${OL}" stroke-width="1.4" stroke-linejoin="round"/>` +
        `<path d="M-7.6 -7.4H7.6V-4.2H-7.6Z" fill="#e8b46a" stroke="${OL}" stroke-width="1.3" stroke-linejoin="round"/>` +
        `<path d="M-6.6 -4.2C-6.6 -1 -4.6 -1 -4.6 1.6C-4.6 3 -2.6 3 -2.6 1.4V-1.6C-2.6 0 -0.6 0 -0.6 -2V-4.2Z" fill="url(#${p}honey)" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/>` +
        `<path d="M-5 2.6V6.6" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" stroke-linecap="round"/>` +
        `<text x="1.8" y="5.4" font-size="5" font-family="sans-serif" font-weight="700" fill="#fff3d6" text-anchor="middle">BAL</text>` +
        `</g>` +
        `<g transform="translate(108 18)"><g ${anim("float", 0, 0, 0.3, 2.2)}>${bee()}</g></g>` +
        `<path d="M98 26C100 30 96 32 92 30" fill="none" stroke="${OL}" stroke-opacity=".5" stroke-width="1" stroke-dasharray="1.5 2"/>`,
    );
  },
};

export const CUTE_DECORATIONS: Record<string, DecorationArt> = {
  kedi: cat,
  tavsan: bunny,
  tilki: fox,
  kurt: wolf,
  ayi: bear,
};
