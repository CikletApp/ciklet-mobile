/**
 * ciklet-web lib/friend-anniversary.ts kopyası (web–mobil eşitliği).
 *
 * Arkadaşlık yıl dönümü — Discord'un "Arkadaşlık Yıl Dönümleri" bölümünün
 * karşılığı.
 *
 * Tamamen hesaplanan bir durum: zamanlanmış iş, bildirim ya da saklanan bir
 * "kutlandı" kaydı YOK. Arkadaşlığın başladığı günün ayı ve günü geldiğinde
 * arkadaş listesinin "Tümü" sekmesinde ve DM'in üstünde kendiliğinden
 * beliriyor, pencere dolunca kendiliğinden kayboluyor.
 *
 * Gün sınırları GÖRENİN yerel saatine göre çiziliyor (istemcide
 * hesaplanıyor): İstanbul'da gece yarısı dönen gün, UTC'de hâlâ dünün
 * akşamı. Sunucuda hesaplansaydı yıl dönümü üç saat geç başlayıp üç saat
 * geç biterdi.
 */

/**
 * Yıl dönümü, gününden itibaren kaç takvim günü gösterilir (gün dâhil).
 *
 * Discord pencerenin uzunluğunu belgelemiyor. Tek gün, o gün uygulamayı hiç
 * açmayan kullanıcıya kutlamayı kaçırtırdı; bir hafta hem kaçırmayı önlüyor
 * hem de bölümün listede kalıcı bir yük gibi durmasını engelliyor.
 */
export const ANNIVERSARY_WINDOW_DAYS = 7;

type DateInput = Date | string | number;

export interface FriendAnniversary {
  /** Dolan yıl sayısı (en az 1). */
  years: number;
  /** Yıl dönümünden bu yana geçen takvim günü; 0 = bugün. */
  daysAgo: number;
}

/**
 * Arkadaşlığın başladığı an.
 *
 * `acceptedAt` yoksa `createdAt`: bu alan eklenmeden önce kabul edilen
 * satırlar migration'da doldurulduğu için boş kalan yalnızca doğrudan
 * ACCEPTED yazılan (tohum/test) satırlar; onlarda iki an zaten aynı.
 */
export function friendshipStartedAt(friendship: {
  acceptedAt?: DateInput | null;
  createdAt: DateInput;
}): Date {
  return new Date(friendship.acceptedAt ?? friendship.createdAt);
}

/** Takvim gününün mutlak sıra numarası — yaz saati kayması farkı bozmaz. */
function dayNumber(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month, day) / 86_400_000);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Şu an bir yıl dönümü penceresinin içinde miyiz?
 *
 * 29 Şubat'ta başlayan arkadaşlık artık yıllarda 28 Şubat'ta kutlanır:
 * 1 Mart'a kaydırmak onu başka bir aya taşırdı.
 */
export function friendAnniversary(
  since: DateInput,
  now: DateInput = new Date(),
  windowDays: number = ANNIVERSARY_WINDOW_DAYS,
): FriendAnniversary | null {
  const start = new Date(since);
  const today = new Date(now);
  if (Number.isNaN(start.getTime()) || Number.isNaN(today.getTime())) return null;

  const todayNumber = dayNumber(today.getFullYear(), today.getMonth(), today.getDate());
  const month = start.getMonth();

  // Pencere yılbaşını aşabilir (yıl dönümü 29 Aralık, bugün 2 Ocak): bu
  // yılın tarihi henüz gelmediyse geçen yılınkine bakılır.
  for (const year of [today.getFullYear(), today.getFullYear() - 1]) {
    const years = year - start.getFullYear();
    if (years < 1) continue;

    const day = Math.min(start.getDate(), daysInMonth(year, month));
    const daysAgo = todayNumber - dayNumber(year, month, day);
    if (daysAgo >= 0 && daysAgo < windowDays) return { years, daysAgo };
  }

  return null;
}

/** "3 yıllık arkadaşlık" */
export function anniversaryLabel(years: number): string {
  return `${years} yıllık arkadaşlık`;
}
