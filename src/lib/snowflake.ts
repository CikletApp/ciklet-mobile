/**
 * Snowflake kimlik karşılaştırması.
 *
 * ── Neden ayrı bir dosya ─────────────────────────────────────────────────
 * ciklet-web v7'de mesaj kimlikleri snowflake oldu ve okundu imleci de
 * (ADR-0002) bir snowflake olarak dönüyor. "Bu sohbette okunmamış var mı"
 * sorusu artık iki tarih değil, İKİ KİMLİK karşılaştırması.
 *
 * ── Neden `Number` YASAK ─────────────────────────────────────────────────
 * Snowflake `offsetMs << 22` biçiminde kuruluyor; yani epoch'tan ~25 gün
 * sonra 2^53'ü aşıyor ve bugün çoktan aşmış durumda. `Number(id)` çağrısı
 * kimliği SESSİZCE yuvarlar: karşılaştırma yanlış çıkar, kullanıcı okunmuş
 * sohbeti okunmamış (ya da tersi) görür. ciklet-web bu tuzağı v7 durum
 * raporunda "sessiz veri bozulması" başlığı altında iki kez yaşadı
 * (MongoDB `promoteLongs`, Drizzle `bigint({ mode: "number" })`).
 *
 * ── Neden `BigInt` değil de string ───────────────────────────────────────
 * `BigInt` doğru sonucu verir ama motor desteğine bağlıdır. Snowflake'ler
 * ondalık, işaretsiz ve baştaki sıfırı olmayan tam sayılar olduğu için
 * EŞİT UZUNLUĞA dolgulandıklarında sözlüksel sıra sayısal sırayla birebir
 * aynıdır. Bağımlılıksız, motordan bağımsız ve ölçülebilir biçimde doğru.
 */

/** Yalnızca rakam — beklenmeyen bir biçim sessizce "karşılaştırılamaz" olmalı. */
const DIGITS = /^\d+$/;

/**
 * İki snowflake'i karşılaştırır.
 *
 * `a > b` ise pozitif, `a < b` ise negatif, eşitse 0 döner —
 * `Array.prototype.sort` sözleşmesiyle aynı.
 *
 * Taraflardan biri geçersizse (boş, `null`, rakam dışı karakter) **0**
 * döner: "bilmiyorum" cevabı, uydurma bir sıralamadan iyidir. Çağıran
 * eksik imleci kendi bağlamında yorumlar.
 */
export function compareSnowflake(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  if (!a || !b || !DIGITS.test(a) || !DIGITS.test(b)) return 0;
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `a`, `b`'den kesin olarak sonra mı üretilmiş. */
export function isAfterSnowflake(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return compareSnowflake(a, b) > 0;
}
