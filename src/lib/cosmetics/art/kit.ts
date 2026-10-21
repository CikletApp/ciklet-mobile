/**
 * Kozmetik çizim takımı — avatar süsü, isim plakası ve profil efekti
 * çizimlerinin ortak yardımcıları. SAF modül: React ya da DOM içe aktarmaz,
 * yalnızca SVG METNİ üretir. Böylece aynı çizim web'de (satır içi SVG),
 * mobilde (react-native-svg `SvgXml`) ve geliştirme galerisinde kullanılır.
 *
 * Kimlik öneki (`p`): bir sayfada aynı çizimden onlarca örnek olabilir
 * (üye listesi). Gradyan/klip kimlikleri çakışmasın diye her çizim `p`
 * önekiyle yazılır; web `useId`'den, mobil kendi sayacından verir.
 *
 * Hareket: yalnızca CSS `transform`/`opacity` animasyonu, sınıf adlarıyla
 * (`ck-a ck-<ad>`; components/cosmetics/cosmetics.css). Çizim durağan hâlde
 * de eksiksiz görünür — hareket azaltmada, mobilde ve listelerde (yalnızca
 * fare üstündeyken oynar) böyle çizilir.
 */

/** Ana kontur rengi (koyu mürdüm) — her çizimde aynı çizgi dili. */
export const OL = "#2a1c33";

export type Stop = readonly [offset: number, color: string, opacity?: number];

function stops(list: readonly Stop[]): string {
  return list
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? "" : ` stop-opacity="${a}"`}/>`)
    .join("");
}

/** Doğrusal gradyan (nesne kutusu birimleri; varsayılan yukarıdan aşağı). */
export function lin(id: string, list: readonly Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1): string {
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
}

/** Radyal gradyan (nesne kutusu birimleri). */
export function rad(id: string, list: readonly Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy): string {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops(list)}</radialGradient>`;
}

/** Kullanıcı birimli radyal gradyan (ışıma halesi gibi kutudan bağımsız). */
export function radU(id: string, list: readonly Stop[], cx: number, cy: number, r: number): string {
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;
}

/** Kök `<svg>`. `body` içinde `<defs>` olabilir. */
export function svgDoc(viewBox: string, body: string, attrs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${attrs}>${body}</svg>`;
}

const n = (v: number) => Math.round(v * 100) / 100;

/** Dört köşeli ışıltı (içbükey yıldız). */
export function sparklePath(cx: number, cy: number, r: number, k = 0.18): string {
  const i = r * k;
  return `M${n(cx)} ${n(cy - r)}Q${n(cx + i)} ${n(cy - i)} ${n(cx + r)} ${n(cy)}Q${n(cx + i)} ${n(cy + i)} ${n(cx)} ${n(cy + r)}Q${n(cx - i)} ${n(cy + i)} ${n(cx - r)} ${n(cy)}Q${n(cx - i)} ${n(cy - i)} ${n(cx)} ${n(cy - r)}Z`;
}

/** Beş köşeli yıldız. */
export function starPath(cx: number, cy: number, R: number, r = R * 0.45, rot = -90): string {
  let d = "";
  for (let k = 0; k < 10; k++) {
    const rr = k % 2 === 0 ? R : r;
    const a = ((rot + k * 36) * Math.PI) / 180;
    d += `${k === 0 ? "M" : "L"}${n(cx + rr * Math.cos(a))} ${n(cy + rr * Math.sin(a))}`;
  }
  return d + "Z";
}

/**
 * Animasyon öznitelikleri: `class` + dönüş merkezi (viewBox birimi) +
 * gecikme/süre. Gecikme negatif verilir: durağan karede de öğeler farklı
 * evrelerde durur, hepsi aynı anda başlamaz.
 */
export function anim(name: string, ox: number, oy: number, delay = 0, dur?: number): string {
  const style = [`transform-origin:${n(ox)}px ${n(oy)}px`];
  if (delay) style.push(`animation-delay:${n(-Math.abs(delay))}s`);
  if (dur) style.push(`animation-duration:${n(dur)}s`);
  return `class="ck-a ck-${name}" style="${style.join(";")}"`;
}

/** Kutupsal → kartezyen (derece; 0 = sağ, 90 = aşağı). */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [n(cx + r * Math.cos(a)), n(cy + r * Math.sin(a))];
}

/** Kemik uzvu: koyu kontur + kemik dolgusu, uçlarında eklem topuzu. */
export function bone(x1: number, y1: number, x2: number, y2: number, w = 2, fill = "#f6f0e4"): string {
  return (
    `<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" stroke="${OL}" stroke-width="${n(w + 1.6)}" stroke-linecap="round"/>` +
    `<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" stroke="${fill}" stroke-width="${n(w)}" stroke-linecap="round"/>`
  );
}

/** Kemik uzvu, kıvrık (dirsek/diz) — iki parça. */
export function limb(pts: readonly (readonly [number, number])[], w = 2, fill = "#f6f0e4"): string {
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join("");
  return (
    `<path d="${d}" fill="none" stroke="${OL}" stroke-width="${n(w + 1.6)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/**
 * Cüce iskelet kafatası (yerel koordinat: merkez 0,0; yarıçap ~9).
 * Büyük göz çukurları + içlerinde parlayan ışık noktası (sevimli, ürkütücü
 * değil), küçük burun, dişli çene. `glow`: göz ışığı rengi.
 */
export function skull(p: string, glow = "#9dffcf", opts: { tilt?: number; hat?: string } = {}): string {
  const t = opts.tilt ?? 0;
  return (
    `<g transform="rotate(${t})">` +
    // Çene + kafa tek siluet.
    `<path d="M-8.6 -1.2C-8.6 -7 -4.6 -9.6 0 -9.6C4.6 -9.6 8.6 -7 8.6 -1.2C8.6 2 7.2 3.6 5.4 4.4L5 7.6C5 8.5 4.3 9 3.4 9H-3.4C-4.3 9 -5 8.5 -5 7.6L-5.4 4.4C-7.2 3.6 -8.6 2 -8.6 -1.2Z" fill="url(#${p}bone)" stroke="${OL}" stroke-width="1.5" stroke-linejoin="round"/>` +
    // Alın parlaklığı.
    `<path d="M-5.6 -5.2C-4.2 -7.4 -1.6 -8.2 1 -8" stroke="#fff" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".85"/>` +
    // Göz çukurları.
    `<ellipse cx="-3.4" cy="-0.6" rx="2.5" ry="2.8" fill="${OL}"/>` +
    `<ellipse cx="3.4" cy="-0.6" rx="2.5" ry="2.8" fill="${OL}"/>` +
    // Göz ışıkları ara ara kırpışır (her kafatası farklı evrede).
    `<g ${anim("blink", 0, -0.2, (Math.abs(t) * 0.37) % 4, 4.2)}><circle cx="-3" cy="-0.2" r="1" fill="${glow}"/><circle cx="3.8" cy="-0.2" r="1" fill="${glow}"/></g>` +
    // Burun.
    `<path d="M0 2.3L-1 3.9H1Z" fill="${OL}"/>` +
    // Dişler.
    `<path d="M-3.2 6.3H3.2M-1.6 5.3V7.4M0 5.3V7.4M1.6 5.3V7.4" stroke="${OL}" stroke-width=".8" stroke-linecap="round"/>` +
    (opts.hat ?? "") +
    `</g>`
  );
}

/** Kemik dolgusu gradyanı (kafatası/uzuvlar `url(#<p>bone)`). */
export function boneDefs(p: string): string {
  return lin(`${p}bone`, [[0, "#fffdf6"], [0.6, "#f1e8d8"], [1, "#d2c3ae"]]);
}

/**
 * Cüce iskelet gövdesi (kafatası hariç): kaburga kafesi + omurga + leğen.
 * Yerel koordinat: boyun (0,9) — kafatasının hemen altı.
 */
export function ribcage(): string {
  return (
    `<path d="M0 9V21" stroke="${OL}" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M0 9V21" stroke="#efe6d6" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M-4.6 12.2C-4.6 10.8 -2.6 10.2 0 10.2C2.6 10.2 4.6 10.8 4.6 12.2C4.6 15.4 3 17.4 0 17.6C-3 17.4 -4.6 15.4 -4.6 12.2Z" fill="#f3ebdc" stroke="${OL}" stroke-width="1.3"/>` +
    `<path d="M-3.6 13H3.6M-3 15.2H3" stroke="${OL}" stroke-width=".9" stroke-linecap="round"/>` +
    `<path d="M-3.4 20.2C-3.4 18.8 -1.8 18.4 0 18.4C1.8 18.4 3.4 18.8 3.4 20.2C3.4 21.8 1.8 22.6 0 22.6C-1.8 22.6 -3.4 21.8 -3.4 20.2Z" fill="#efe6d6" stroke="${OL}" stroke-width="1.2"/>`
  );
}

/** Yumuşak gölge lekesi (filtre yok: listelerde onlarca örnek ucuz kalsın). */
export function blob(cx: number, cy: number, rx: number, ry: number, color = "#000", opacity = 0.22): string {
  return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${color}" opacity="${opacity}"/>`;
}

/** Deterministik sözde rastgele (çizim her açılışta aynı). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Daire çevresinde dalgalı yol (sarmaşık, sis halkası): yarıçap
 * `r + amp·sin(freq·θ + phase)`, `from`→`to` derece arası.
 */
export function wavyArc(cx: number, cy: number, r: number, amp: number, freq: number, phase = 0, from = 0, to = 360, steps = 96): string {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const deg = from + ((to - from) * i) / steps;
    const rr = r + amp * Math.sin(((freq * deg + phase) * Math.PI) / 180);
    const [x, y] = polar(cx, cy, rr, deg);
    d += `${i ? "L" : "M"}${x} ${y}`;
  }
  return d;
}

/**
 * Daire kenarını saran bulut/sis bandı: iç kenar `rIn` yayı, dış kenar
 * `bumps` adet yuvarlak kabarcık (yay komutlarıyla, tek parça siluet).
 */
export function cloudBand(cx: number, cy: number, rIn: number, rOut: number, from: number, to: number, bumps: number): string {
  const step = (to - from) / bumps;
  const [sx, sy] = polar(cx, cy, rIn, from);
  let d = `M${sx} ${sy}`;
  const [ox, oy] = polar(cx, cy, rOut - 2, from);
  d += `L${ox} ${oy}`;
  for (let i = 0; i < bumps; i++) {
    const a2 = from + step * (i + 1);
    const rr = rOut + (i % 2 ? 1.6 : -0.8) - (i === bumps - 1 ? 2 : 0);
    const [x2, y2] = polar(cx, cy, rr, a2);
    const chord = (2 * Math.PI * rOut * Math.abs(step)) / 360;
    d += `A${n(chord * 0.62)} ${n(chord * 0.62)} 0 0 ${to > from ? 1 : 0} ${x2} ${y2}`;
  }
  const [ex, ey] = polar(cx, cy, rIn, to);
  d += `L${ex} ${ey}`;
  d += `A${rIn} ${rIn} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to > from ? 0 : 1} ${sx} ${sy}Z`;
  return d;
}
