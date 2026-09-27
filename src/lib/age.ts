/**
 * Kayıt yaş sınırı — ciklet-web `src/lib/age.ts`'in birebir karşılığı.
 *
 * Kural sunucuda da (/api/register) uygulanıyor; burada yalnızca formun
 * kullanıcıyı gönderimden ÖNCE uyarması için var. Sınır değişirse iki taraf
 * birlikte güncellenmeli, yoksa form geçirir ve sunucu reddeder.
 */

/** Ciklet'e kaydolmak için doldurulmuş olması gereken yaş. */
export const MIN_SIGNUP_AGE = 18;

/** Doldurulmuş yaş (yıl). Doğum günü bu yıl henüz gelmediyse bir eksiltir. */
export function completedAge(birth: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** Kayıt için yeterince büyük mü. */
export function isOldEnoughToSignUp(birth: Date, now: Date = new Date()): boolean {
  return completedAge(birth, now) >= MIN_SIGNUP_AGE;
}

/**
 * Kayıt olabilecek birinin doğabileceği EN GEÇ yıl — yıl listesinin üst
 * sınırı. Kaba bir eleme: bu yılın ilerleyen aylarında doğmuş biri henüz
 * 18'ini doldurmamış olabilir; kesin kararı `isOldEnoughToSignUp` verir.
 */
export function latestEligibleBirthYear(now: Date = new Date()): number {
  return now.getFullYear() - MIN_SIGNUP_AGE;
}
