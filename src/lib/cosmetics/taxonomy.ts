/**
 * Kozmetik koleksiyonları ve temaları — mağaza filtreleri ve seçicilerde
 * gruplama için. Saf veri (istemci + sunucu + mobil ortak).
 */
export const COSMETIC_COLLECTIONS = [
  { id: "cadilar-bayrami", name: "Cadılar Bayramı" },
  { id: "sevimli-dostlar", name: "Sevimli Dostlar" },
  { id: "gece-gokyuzu", name: "Gece Gökyüzü" },
  { id: "ates-ve-buz", name: "Ateş ve Buz" },
  { id: "bahar-bahcesi", name: "Bahar Bahçesi" },
  { id: "turkiye", name: "Türkiye" },
] as const;

export type CosmeticCollectionId = (typeof COSMETIC_COLLECTIONS)[number]["id"];

export const COSMETIC_THEMES = [
  { id: "sevimli", name: "Sevimli" },
  { id: "korku", name: "Korku" },
  { id: "fantezi", name: "Fantezi" },
  { id: "doga", name: "Doğa" },
  { id: "bilim-kurgu", name: "Bilim Kurgu" },
  { id: "mevsimsel", name: "Mevsimsel" },
  { id: "turkiye", name: "Türkiye" },
] as const;

export type CosmeticThemeId = (typeof COSMETIC_THEMES)[number]["id"];

/** Koleksiyon/tema etiketleri — her kozmetik kaydında ortak. */
export interface CosmeticTags {
  collection: CosmeticCollectionId;
  themes: readonly CosmeticThemeId[];
}
