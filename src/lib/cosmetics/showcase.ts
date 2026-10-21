/**
 * Vitrin: her kozmetik için atmosferik arka plan sahnesi (lib/cosmetics/art/
 * showcase). Mağaza kartı ürünü dinlenirken bile sinematik gösterebilsin:
 * arka plan + üstünde süslü avatar / plaka / efekt.
 *
 * ciklet-web `lib/cosmetics/showcase.ts` ile aynı eşleme; yalnızca katalog
 * içe aktarımları mobilin dosyalarına çevrildi (plaka/efekt
 * lib/profile-effects'te).
 */
import { findDecoration } from "../avatar-decorations";
import { findNameplate, findProfileEffect } from "../profile-effects";
import { resolveCosmeticId } from "./aliases";
import { SHOWCASE_ACCENT, SHOWCASE_BACKDROPS, type ShowcaseBackdropId } from "./art/showcase";
import type { CosmeticCollectionId } from "./taxonomy";

export type CosmeticKind = "decoration" | "nameplate" | "effect";

const BY_COLLECTION: Record<CosmeticCollectionId, ShowcaseBackdropId> = {
  "cadilar-bayrami": "mezarlik",
  "sevimli-dostlar": "pastel",
  "gece-gokyuzu": "gece",
  "ates-ve-buz": "ates",
  "bahar-bahcesi": "bahar",
  turkiye: "turkiye",
};

const BY_ITEM: Readonly<Record<string, ShowcaseBackdropId>> = {
  kurt: "buz",
  buz_taci: "buz",
  fx_snow: "buz",
  np_kuzey_isiklari: "buz",
  kara_ay: "mezarlik",
  mantar: "orman",
  np_mantar_bahcesi: "orman",
  fx_fireflies: "orman",
  np_perili_orman: "orman",
  np_uyuyan_kedi: "pastel",
  tilki: "bahar",
  ayi: "bahar",
};

export interface CosmeticShowcase {
  /** Kozmetiğin güncel kimliği ve türü. */
  id: string;
  kind: CosmeticKind;
  backdropId: ShowcaseBackdropId;
  /** Arka plan sahnesi (tam `<svg>` metni; `p` kimlik öneki). */
  backdrop: (p: string) => string;
  /** Sahnenin vurgu rengi (çerçeve/ışıma). */
  accent: string;
}

/** Bir avatar süsü, isim plakası ya da profil efekti için vitrin; bilinmiyorsa null. */
export function getCosmeticShowcase(id: string | null | undefined): CosmeticShowcase | null {
  if (!id) return null;
  const resolved = resolveCosmeticId(id);
  const deco = findDecoration(resolved);
  const plate = deco ? null : findNameplate(resolved);
  const effect = deco || plate ? null : findProfileEffect(resolved);
  const found = deco ?? plate ?? effect;
  if (!found) return null;
  const kind: CosmeticKind = deco ? "decoration" : plate ? "nameplate" : "effect";
  const backdropId = BY_ITEM[resolved] ?? BY_COLLECTION[found.collection];
  return { id: resolved, kind, backdropId, backdrop: SHOWCASE_BACKDROPS[backdropId], accent: SHOWCASE_ACCENT[backdropId] };
}
