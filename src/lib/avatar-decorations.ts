import { resolveCosmeticId } from "./cosmetics/aliases";
import type { CosmeticTags } from "./cosmetics/taxonomy";

/**
 * Avatar süsleri — ciklet-web `lib/avatar-decorations.ts` setinin mobil
 * karşılığı. Kimlikler, adlar ve kademeler web ile BİREBİR aynı olmalı:
 * süs `Profile.avatarDecorationId`'de saklanıyor ve iki istemci aynı kimliği
 * aynı çizimle gösteriyor.
 *
 * Çizim özgün SVG (lib/cosmetics/art — web ile ortak, değiştirilmeden
 * kopyalandı): avatarın 4/3'ü boyutunda, bir kısmı avatarın ARKASINDA
 * (kulak tabanı, kuyruk), bir kısmı ÖNÜNDE (pati, fiyonk, figürler). Mobilde
 * `react-native-svg` `SvgXml` ile çizilir (components/ui/avatar-decoration).
 *
 * Kademeler: `mentol: true` → Mentol Plus+ ister; `store: true` → mağazadan
 * alınır (sahiplik sunucuda, `PATCH /api/current-profile` reddeder); ikisi de
 * değilse ücretsiz. Kaldırılan eski kimlikler (`mint`, `galaxy`…)
 * lib/cosmetics/aliases ile en yakın yeni süse çözülür.
 *
 * Saf modül (RN içe aktarmaz, göreli içe aktarım) — scripts/verify-cosmetics.mjs.
 */
export interface AvatarDecoration extends CosmeticTags {
  id: string;
  name: string;
  mentol: boolean;
  /** Mağazadan satın alınır; sahiplik StoreEntitlement'ta. */
  store?: boolean;
}

export const AVATAR_DECORATIONS: readonly AvatarDecoration[] = [
  // Ücretsiz.
  { id: "turkiye", name: "Ay Yıldız", mentol: false, collection: "turkiye", themes: ["turkiye"] },
  { id: "ayi", name: "Ayıcık", mentol: false, collection: "sevimli-dostlar", themes: ["sevimli", "doga"] },
  { id: "hilal", name: "Hilal ve Yıldızlar", mentol: false, collection: "gece-gokyuzu", themes: ["fantezi"] },
  // Mentol (Plus+).
  { id: "kedi", name: "Kedi Kulakları", mentol: true, collection: "sevimli-dostlar", themes: ["sevimli"] },
  { id: "tavsan", name: "Tavşan Kulakları", mentol: true, collection: "sevimli-dostlar", themes: ["sevimli", "mevsimsel"] },
  { id: "hayalet", name: "Hayalet Dostlar", mentol: true, collection: "cadilar-bayrami", themes: ["korku", "sevimli", "mevsimsel"] },
  { id: "kabak", name: "Kabak Feneri", mentol: true, collection: "cadilar-bayrami", themes: ["korku", "mevsimsel"] },
  { id: "alev", name: "Alev Halkası", mentol: true, collection: "ates-ve-buz", themes: ["fantezi"] },
  { id: "buz_taci", name: "Buz Kristali Tacı", mentol: true, collection: "ates-ve-buz", themes: ["fantezi", "mevsimsel"] },
  { id: "cicek", name: "Çiçek Çelengi", mentol: true, collection: "bahar-bahcesi", themes: ["doga", "mevsimsel"] },
  // Mağaza.
  { id: "iskelet_tirmanan", name: "Tırmanan İskeletler", mentol: false, store: true, collection: "cadilar-bayrami", themes: ["korku", "sevimli", "mevsimsel"] },
  { id: "iskelet_fener", name: "Fenerli İskelet", mentol: false, store: true, collection: "cadilar-bayrami", themes: ["korku", "fantezi", "mevsimsel"] },
  { id: "kafatasi_uclusu", name: "Kafatası Üçlüsü", mentol: false, store: true, collection: "cadilar-bayrami", themes: ["korku", "fantezi"] },
  { id: "orumcek_agi", name: "Örümcek Ağı", mentol: false, store: true, collection: "cadilar-bayrami", themes: ["korku", "mevsimsel"] },
  { id: "kara_ay", name: "Kara Ay", mentol: false, store: true, collection: "gece-gokyuzu", themes: ["korku", "fantezi"] },
  { id: "tilki", name: "Tilki", mentol: false, store: true, collection: "sevimli-dostlar", themes: ["sevimli", "doga"] },
  { id: "kurt", name: "Buz Kurdu", mentol: false, store: true, collection: "sevimli-dostlar", themes: ["fantezi", "doga"] },
  { id: "galaksi", name: "Galaksi Yörüngesi", mentol: false, store: true, collection: "gece-gokyuzu", themes: ["bilim-kurgu", "fantezi"] },
  { id: "mantar", name: "Mantar Halkası", mentol: false, store: true, collection: "bahar-bahcesi", themes: ["doga", "fantezi"] },
];

/** Süs (eski kimlikler takma ad tablosuyla yeni süse çözülür). */
export function findDecoration(id: string | null | undefined): AvatarDecoration | null {
  if (!id) return null;
  const resolved = resolveCosmeticId(id);
  return AVATAR_DECORATIONS.find((d) => d.id === resolved) ?? null;
}
