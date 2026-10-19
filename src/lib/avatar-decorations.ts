/**
 * Avatar süsleri — ciklet-web `lib/avatar-decorations.ts` setinin mobil
 * karşılığı. Kimlikler, adlar ve kilit kuralları web ile BİREBİR aynı
 * olmalı: süs `Profile.avatarDecorationId`'de saklanıyor ve iki istemci aynı
 * kimliği aynı halka olarak çiziyor.
 *
 * Web halkayı CSS gradyanıyla çiziyor (konik/doğrusal/radyal). React
 * Native'de CSS gradyanı yok; halka `react-native-svg` ile çizilen bir
 * çember kontur ve renk duraklarıyla kurulur. Konik gradyan SVG'de
 * olmadığından aynı renkler doğrusal gradyana yayılır — dönen süslerde
 * dönüş zaten farkı kapatıyor.
 *
 * `mentol: true` → Mentol Plus+ ister; `store: true` → mağazadan alınır
 * (sahiplik sunucuda, `PATCH /api/current-profile` reddeder).
 */
export interface AvatarDecoration {
  id: string;
  name: string;
  mentol: boolean;
  store?: boolean;
  /** Gradyan renkleri, sırayla. */
  colors: string[];
  /** Radyal süs (Çiklet Balonu) merkezden dışa boyanır. */
  radial?: boolean;
  /** Köşeye oturan küçük rozet (emoji). */
  badge?: string;
  /** Hafif dönüş (hareket azaltma açıkken durur). */
  spin?: boolean;
}

export const AVATAR_DECORATIONS: readonly AvatarDecoration[] = [
  { id: "mint", name: "Mentol Halesi", mentol: false, colors: ["#12b98a", "#7ef0c4", "#12b98a"] },
  { id: "sunset", name: "Gün Batımı", mentol: false, colors: ["#ff7a59", "#ffb347", "#ff5e8a"] },
  { id: "ocean", name: "Okyanus", mentol: false, colors: ["#2d9cdb", "#56ccf2", "#1b4fd8"] },
  { id: "ember", name: "Kor", mentol: true, colors: ["#ff3d00", "#ffb300", "#ff3d00"], badge: "🔥", spin: true },
  { id: "aurora", name: "Kuzey Işığı", mentol: true, colors: ["#7c4dff", "#18ffff", "#69f0ae", "#7c4dff"], spin: true },
  { id: "royal", name: "Taç", mentol: true, colors: ["#ffd700", "#fff1a8", "#c9a400"], badge: "👑" },
  { id: "neon", name: "Neon", mentol: true, colors: ["#ff00e5", "#00e5ff", "#ff00e5"], spin: true },
  { id: "bloom", name: "Çiçek", mentol: true, colors: ["#ff9ad5", "#ffd1e8", "#ff5fb0"], badge: "🌸" },
  // Mağaza süsleri.
  { id: "galaxy", name: "Galaksi", mentol: false, store: true, colors: ["#311b92", "#7c4dff", "#18ffff", "#311b92"], badge: "🪐", spin: true },
  { id: "sakura", name: "Sakura", mentol: false, store: true, colors: ["#ffc1e3", "#ff80ab", "#fce4ec"], badge: "🌸" },
  { id: "pixel", name: "Piksel", mentol: false, store: true, colors: ["#ff1744", "#ffea00", "#00e676", "#2979ff"], badge: "👾" },
  { id: "bubble", name: "Çiklet Balonu", mentol: false, store: true, colors: ["#ffd6ec", "#ff6fb5", "#e0408f"], radial: true, badge: "🫧" },
];

export function findDecoration(id: string | null | undefined): AvatarDecoration | null {
  if (!id) return null;
  return AVATAR_DECORATIONS.find((d) => d.id === id) ?? null;
}
