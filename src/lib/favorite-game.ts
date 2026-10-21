/**
 * Favori oyun — ciklet-web `src/lib/favorite-game.ts`'in istemci eşi.
 *
 * Kullanıcı koleksiyonundan TEK bir oyunu favori seçer; isteğe bağlı küçük
 * bir etiket eşlik eder ("Senden daha iyiyim"). Veritabanı etiket KİMLİĞİNİ
 * saklar; kimlikler ve metinler web'le AYNI olmalı (sunucu bilinmeyen
 * kimliği 400 ile reddeder).
 */

export const FAVORITE_GAME_TAGS = [
  { id: "better_than_you", label: "Senden daha iyiyim" },
  { id: "like_it_a_bit", label: "Biraz seviyorum" },
  { id: "just_started", label: "Yeni başladım" },
  { id: "master", label: "Ustayım" },
  { id: "cant_stop", label: "Bırakamıyorum" },
] as const;

export type FavoriteGameTag = (typeof FAVORITE_GAME_TAGS)[number]["id"];

/** Türkçe etiket metni; bilinmeyen / boş kimlik için null. */
export function favoriteGameTagLabel(tag: string | null | undefined): string | null {
  return FAVORITE_GAME_TAGS.find((t) => t.id === tag)?.label ?? null;
}

/** Yalnızca oyun kovası (PLAYING / COMPETING) favori olabilir; program ya da müzik olamaz. */
export function canBeFavoriteGame(type: string): boolean {
  return type === "PLAYING" || type === "COMPETING";
}

/**
 * Seçicide gösterilecek satırlar: profilde görünebilen oyunlar — gizli,
 * tanınmayan ve program satırları favori olsa da kartta görünmez (web
 * favorite-game-edit ile aynı süzgeç).
 */
export function favoriteCandidates<T extends { type: string; hidden: boolean; recognized?: boolean }>(rows: readonly T[]): T[] {
  return rows.filter((g) => canBeFavoriteGame(g.type) && !g.hidden && g.recognized !== false);
}
