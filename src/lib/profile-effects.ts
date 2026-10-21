import { resolveCosmeticId } from "./cosmetics/aliases";
import type { CosmeticTags } from "./cosmetics/taxonomy";

/**
 * Profil efektleri ve isim plakaları kataloğu — ciklet-web
 * `src/lib/store-catalog.ts` `PROFILE_EFFECTS` / `NAMEPLATES` ile BİREBİR
 * (kimlik, ad, kademe, koleksiyon). Web'e yeni ürün eklenince buraya da
 * eklenmeli; sunucu `profileEffectId` / `nameplateId` olarak bu kimlikleri
 * döner. Kaldırılan eski kimlikler (fx_confetti, np_dusk…)
 * lib/cosmetics/aliases ile en yakın yeni ürüne çözülür.
 *
 * Çizim (web ile ortak SVG, lib/cosmetics/art):
 *  - efekt  → features/profile/profile-effect.tsx (EFFECT_ART + effectLayout);
 *  - plaka  → features/profile/nameplate.tsx (NAMEPLATE_ART sahnesi + renk).
 *
 * Saf modül (RN içe aktarmaz) — scripts/verify-cosmetics.mjs doğrular.
 */

/** Efekt kademesi: kim takabilir (sunucu PATCH'te denetler). */
export type ProfileEffectTier = "free" | "mentol" | "store";

export interface ProfileEffect extends CosmeticTags {
  id: string;
  name: string;
  tier: ProfileEffectTier;
}

export const PROFILE_EFFECTS: readonly ProfileEffect[] = [
  // Ücretsiz.
  { id: "fx_leaves", name: "Sonbahar Yaprakları", tier: "free", collection: "bahar-bahcesi", themes: ["doga", "mevsimsel"] },
  { id: "fx_turkiye", name: "Al Bayrak", tier: "free", collection: "turkiye", themes: ["turkiye"] },
  // Mentol (Plus+).
  { id: "fx_sakura", name: "Sakura Yağmuru", tier: "mentol", collection: "bahar-bahcesi", themes: ["doga", "mevsimsel"] },
  { id: "fx_fireflies", name: "Ateş Böcekleri", tier: "mentol", collection: "bahar-bahcesi", themes: ["doga", "fantezi"] },
  { id: "fx_isilti", name: "Yıldız Işıltısı", tier: "mentol", collection: "gece-gokyuzu", themes: ["fantezi"] },
  { id: "fx_korlar", name: "Yükselen Korlar", tier: "mentol", collection: "ates-ve-buz", themes: ["fantezi"] },
  // Mağaza.
  { id: "fx_mezarlik", name: "Sisli Mezarlık", tier: "store", collection: "cadilar-bayrami", themes: ["korku", "sevimli", "mevsimsel"] },
  { id: "fx_orumcek", name: "Örümcek Ağları", tier: "store", collection: "cadilar-bayrami", themes: ["korku", "mevsimsel"] },
  { id: "fx_snow", name: "Kar Yağışı", tier: "store", collection: "ates-ve-buz", themes: ["doga", "mevsimsel"] },
  { id: "fx_yildiz_kaymasi", name: "Yıldız Kayması", tier: "store", collection: "gece-gokyuzu", themes: ["fantezi", "bilim-kurgu"] },
];

export function findProfileEffect(id: string | null | undefined): ProfileEffect | null {
  if (!id) return null;
  const resolved = resolveCosmeticId(id);
  return PROFILE_EFFECTS.find((effect) => effect.id === resolved) ?? null;
}

/**
 * Efekti takabilir mi? Bilinmeyen kimlik `unknown`; mağaza efekti sahiplik,
 * Mentol efekti Plus+ ister (asıl denetim sunucuda).
 */
export function profileEffectAccess(
  id: string,
  viewer: { mentol: boolean; owned: boolean }
): "ok" | "unknown" | "mentol_required" | "not_owned" {
  const effect = findProfileEffect(id);
  if (!effect) return "unknown";
  if (effect.tier === "mentol" && !viewer.mentol) return "mentol_required";
  if (effect.tier === "store" && !viewer.owned) return "not_owned";
  return "ok";
}

// ── İsim plakaları ──────────────────────────────────────────────────

/**
 * İsim plakası: satırın arka planı (sağdan sola saydamlaşan renk; web
 * `background: linear-gradient(90deg, rgba(rgb,0) 0%, rgba(rgb,a·.45) 45%,
 * rgba(rgb,a) 100%)`) + sağa yaslı çizimli sahne (NAMEPLATE_ART, kimlikle
 * eşleşir). Web CSS metni yerine renk ve opaklık saklanır; gradyan
 * `nameplateStops` ile kurulur.
 */
export interface Nameplate extends CosmeticTags {
  id: string;
  /** Mağaza adı (web STORE_ITEMS). */
  name: string;
  rgb: readonly [number, number, number];
  alpha: number;
}

export const NAMEPLATES: readonly Nameplate[] = [
  { id: "np_iskelet_dansi", name: "İskelet Dansı", rgb: [88, 52, 140], alpha: 0.34, collection: "cadilar-bayrami", themes: ["korku", "sevimli", "mevsimsel"] },
  { id: "np_perili_orman", name: "Perili Orman", rgb: [31, 53, 96], alpha: 0.34, collection: "cadilar-bayrami", themes: ["korku", "doga"] },
  { id: "np_uyuyan_kedi", name: "Uyuyan Kedi", rgb: [200, 160, 255], alpha: 0.3, collection: "sevimli-dostlar", themes: ["sevimli"] },
  { id: "np_kizilgerdan", name: "Kızılgerdan", rgb: [120, 190, 255], alpha: 0.3, collection: "bahar-bahcesi", themes: ["doga", "sevimli", "mevsimsel"] },
  { id: "np_mantar_bahcesi", name: "Mantar Bahçesi", rgb: [31, 110, 80], alpha: 0.34, collection: "bahar-bahcesi", themes: ["doga", "fantezi"] },
  { id: "np_kuzey_isiklari", name: "Kuzey Işıkları", rgb: [20, 70, 110], alpha: 0.34, collection: "gece-gokyuzu", themes: ["doga", "fantezi"] },
  { id: "np_kor", name: "Kor Kıvılcımları", rgb: [150, 40, 10], alpha: 0.34, collection: "ates-ve-buz", themes: ["fantezi"] },
  { id: "np_sakura", name: "Sakura Rüzgârı", rgb: [255, 150, 195], alpha: 0.32, collection: "bahar-bahcesi", themes: ["doga", "mevsimsel"] },
  { id: "np_al_bayrak", name: "Al Bayrak", rgb: [227, 10, 23], alpha: 0.4, collection: "turkiye", themes: ["turkiye"] },
  { id: "np_yildiz_yolu", name: "Yıldız Yolu", rgb: [70, 40, 160], alpha: 0.34, collection: "gece-gokyuzu", themes: ["bilim-kurgu", "fantezi"] },
];

export function findNameplate(id: string | null | undefined): Nameplate | null {
  if (!id) return null;
  const resolved = resolveCosmeticId(id);
  return NAMEPLATES.find((n) => n.id === resolved) ?? null;
}

/** Plaka arka planının gradyan durakları (soldan sağa; web ile aynı oranlar). */
export function nameplateStops(plate: Nameplate): { offset: number; color: string; opacity: number }[] {
  const color = `rgb(${plate.rgb.join(",")})`;
  return [
    { offset: 0, color, opacity: 0 },
    { offset: 0.45, color, opacity: Math.round(plate.alpha * 0.45 * 1000) / 1000 },
    { offset: 1, color, opacity: plate.alpha },
  ];
}
