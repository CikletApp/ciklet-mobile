/**
 * Tarih ve metin biçimlendirme.
 *
 * Tümü Türkçe yerel ayarına göre. `Intl` çağrıları pahalıdır ve mesaj
 * listesinde satır başına çalışır — bu yüzden biçimlendiriciler modül
 * düzeyinde bir kez kurulur, her çağrıda yeniden yaratılmaz.
 */

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const weekdayFormat = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long",
});

const shortDateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** İki tarih aynı takvim gününde mi. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

/** Mesaj saati — "14:32". */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Uzun tarih — "12 Mayıs 2018" (profil "üye olma" satırı). */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/**
 * Sohbet tarih ayracı.
 * Bugün → "Bugün", dün → "Dün", son hafta → gün adı, öncesi → tam tarih.
 */
export function formatDaySeparator(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  if (isSameDay(date, now)) return "Bugün";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Dün";

  if (now.getTime() - date.getTime() < 7 * DAY) return weekdayFormat.format(date);

  return dateFormat.format(date);
}

/**
 * Liste önizlemesi için kısa göreli zaman — "şimdi", "16d", "3s", "2g",
 * sonrası tarih. Sohbet listesinde satır başına yer çok dar.
 */
export function formatRelativeShort(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;

  if (diff < MINUTE) return "şimdi";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}d`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}s`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}g`;
  return shortDateFormat.format(new Date(then));
}

/**
 * İki mesaj aynı gruba mı ait — aynı gönderen ve 5 dakikadan yakın.
 * Gruplanan mesajlarda avatar/ad tekrarlanmaz, liste okunur kalır.
 */
export const GROUPING_WINDOW_MS = 5 * MINUTE;

export function shouldGroupMessages(
  previousAuthorId: string | undefined,
  previousCreatedAt: string | undefined,
  authorId: string,
  createdAt: string
): boolean {
  if (!previousAuthorId || !previousCreatedAt) return false;
  if (previousAuthorId !== authorId) return false;
  const gap = new Date(createdAt).getTime() - new Date(previousCreatedAt).getTime();
  return Math.abs(gap) < GROUPING_WINDOW_MS;
}

/** Görünen ad: gerçek ad varsa o, yoksa kullanıcı adı. */
export function displayNameOf(profile: {
  name?: string | null;
  username: string;
}): string {
  return profile.name?.trim() || profile.username;
}

/** Türkçe'ye uygun baş harf — "ırmak" → "I" değil "I", "istanbul" → "İ". */
export function initialOf(text: string): string {
  return text.charAt(0).toLocaleUpperCase("tr");
}

/** Uzun metni kırpar; kesme noktasına üç nokta ekler. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
