/**
 * Kaldırılan kozmetik kimlikleri → yerlerine gelen yeni kimlikler.
 *
 * Eski sade setin (gradyan halka + emoji rozet, düz gradyan plakalar, emoji
 * efektler) yerine çizimli set geldi. Kimse sahip olduğu ya da taktığı
 * ürünü kaybetmesin diye eski kimlik, en yakın YENİ kimliğe çözülür:
 *
 *  - `find*` işlevleri (süs/plaka/efekt/mağaza ürünü) kimliği önce buradan
 *    geçirir: profilde hâlâ `galaxy` yazan kullanıcı `galaksi`yi görür;
 *  - mağaza sahipliği (StoreEntitlement.itemId) de aynı tabloyla okunur
 *    (lib/store): eski `galaxy` satırı `galaksi`nin sahipliği sayılır.
 *
 * Kademe korunur: ücretsiz → ücretsiz, Mentol → Mentol, mağaza → mağaza
 * (eski mağaza ürününü satın alan, yeni mağaza ürününe sahip olur).
 * Bu tablo saf veri; kayıt göçü gerekmez.
 */
export const COSMETIC_ALIASES: Readonly<Record<string, string>> = {
  // Avatar süsleri.
  mint: "ayi",
  sunset: "ayi",
  ocean: "hilal",
  ember: "alev",
  aurora: "buz_taci",
  royal: "tavsan",
  neon: "hayalet",
  bloom: "cicek",
  galaxy: "galaksi",
  sakura: "mantar",
  pixel: "kafatasi_uclusu",
  bubble: "tilki",
  // İsim plakaları.
  np_dusk: "np_sakura",
  np_matrix: "np_mantar_bahcesi",
  np_galaxy: "np_yildiz_yolu",
  np_gold: "np_kor",
  np_ice: "np_kuzey_isiklari",
  np_aurora: "np_kuzey_isiklari",
  np_neon: "np_iskelet_dansi",
  np_stardust: "np_yildiz_yolu",
  // Profil efektleri.
  fx_bubbles: "fx_leaves",
  fx_mint: "fx_fireflies",
  fx_sparkle: "fx_isilti",
  fx_confetti: "fx_yildiz_kaymasi",
  fx_hearts: "fx_yildiz_kaymasi",
  fx_stars: "fx_yildiz_kaymasi",
};

/** Kimliğin güncel karşılığı (takma ad yoksa kendisi). */
export function resolveCosmeticId(id: string): string {
  return COSMETIC_ALIASES[id] ?? id;
}

/**
 * Bir güncel kimliğe çözülen TÜM kimlikler (kendisi + eski takma adları) —
 * sahiplik sorgusu bunlardan herhangi birini arar.
 */
export function cosmeticIdVariants(id: string): string[] {
  const target = resolveCosmeticId(id);
  const out = [target];
  for (const [oldId, newId] of Object.entries(COSMETIC_ALIASES)) {
    if (newId === target) out.push(oldId);
  }
  return out;
}
