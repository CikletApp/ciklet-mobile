/**
 * Tarih ve metin biçimlendirme.
 *
 * Tümü Türkçe yerel ayarına göre. `Intl` çağrıları pahalıdır ve mesaj
 * listesinde satır başına çalışır — bu yüzden biçimlendiriciler modül
 * düzeyinde bir kez kurulur, her çağrıda yeniden yaratılmaz.
 */

import { attachmentPreviewLabel, readAttachmentInfo } from "./attachments";

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
 * Sohbet listesindeki zaman: bugün saat ("15:00"), dün "Dün", son bir hafta
 * gün adı ("Salı"), daha eskisi tarih ("24.09.2026"). Mesajlaşma
 * uygulamalarındaki alışkanlıkla aynı; "25d" gibi kısaltmalar Türkçede
 * dakika mı gün mü belli değildi.
 */
export function formatChatListTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(date, now)) return timeFormat.format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Dün";
  if (now.getTime() - date.getTime() < 6 * DAY) {
    const day = weekdayFormat.format(date);
    return day.charAt(0).toLocaleUpperCase("tr-TR") + day.slice(1);
  }
  return shortDateFormat.format(date);
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

/**
 * Zengin durumun geçen süresi — "2:27:29" veya "14:05".
 * Bir saatin altında saat bileşeni gösterilmez.
 */
export function formatElapsed(startedAt: number): string {
  const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** Görünen ad: gerçek ad varsa o, yoksa kullanıcı adı. */
export function displayNameOf(profile: {
  name?: string | null;
  username: string;
}): string {
  return profile.name?.trim() || profile.username;
}

/**
 * Sohbet listesi satırı için tek satırlık son mesaj özeti.
 *
 * `authorName` YALNIZCA grup sohbetlerinde verilir. Birebir sohbette yazarı
 * yazmak gereksiz (zaten satırın başlığı o kişi), grupta ise şart: "dosyayı
 * attım" önizlemesinin kimden geldiği bilinmeden satır okunmuyor.
 * Kendi mesajın her iki durumda da "Sen:" önekini alır.
 */
export function formatDirectPreview(
  message: {
    content: string;
    fileUrl: string | null;
    /** Varsa `metadata.attachment` türü belirler (web'le aynı). */
    metadata?: unknown;
    profileId: string;
    type: string;
    deleted: boolean;
  } | null | undefined,
  myId: string | undefined,
  authorName?: string
): string {
  if (!message) return "Henüz mesaj yok";
  if (message.deleted) return "Mesaj silindi";

  const content = message.content.trim();
  let preview: string;

  switch (message.type) {
    case "CALL_STARTED":
      preview = content || "Arama başladı";
      break;
    case "CALL_MISSED":
      preview = content || "Cevapsız arama";
      break;
    case "CALL_ENDED":
      preview = content || "Arama sona erdi";
      break;
    case "ACTIVITY_INVITE":
      preview = content || "Aktivite daveti";
      break;
    case "MESSAGE_PINNED":
      // Sistem satırı; öznesi sabitleyen kişi (içerik "bir mesajı sabitledi.").
      if (message.profileId === myId) return "Bir mesajı sabitledin";
      return authorName ? `${authorName} bir mesajı sabitledi` : "Bir mesaj sabitlendi";
    default:
      preview = content || (message.fileUrl ? "Bir dosya gönderdi" : "Yeni mesaj");
      // Ek gönderilince içerik çoğu zaman dosyanın kendi adresi oluyor;
      // listede uzun bir CDN bağlantısı yerine ne olduğu yazılır.
      if (message.fileUrl && (!content || content === message.fileUrl.trim() || /^https?:\/\/\S+$/.test(content))) {
        preview = attachmentPreviewLabel(message.fileUrl, readAttachmentInfo(message.metadata));
      }
  }

  const isUserMessage = message.type === "DEFAULT" || message.type === "ACTIVITY_REPLY";
  if (!isUserMessage) return preview;
  if (message.profileId === myId) return `Sen: ${preview}`;
  // Sistem mesajlarına ("Arama sona erdi") yazar öneki takılmaz; onların
  // öznesi zaten metnin içinde.
  return authorName ? `${authorName}: ${preview}` : preview;
}

/** Türkçe'ye uygun baş harf — "istanbul" → "İ". */
export function initialOf(text: string): string {
  return text.charAt(0).toLocaleUpperCase("tr");
}

/**
 * Görsel yoksa gösterilen baş harfler — en fazla iki kelimeden.
 * Web'deki `navigation-item.tsx` ile aynı kural ("Hafta Sonu" → "HS").
 */
export function initialsOf(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase("tr"))
    .join("");
}

/** Uzun metni kırpar; kesme noktasına üç nokta ekler. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Zengin durumun cümlesi — "Minecraft oynuyor", "Spotify dinliyor". */
export function formatActivity(activity: { name: string; type?: string } | null | undefined): string | null {
  if (!activity?.name) return null;
  const verb =
    activity.type === "LISTENING" ? "dinliyor"
      : activity.type === "WATCHING" ? "izliyor"
        : activity.type === "PLAYING" ? "oynuyor"
          : activity.type === "STREAMING" ? "yayında"
            : "kullanıyor";
  return `${activity.name} ${verb}`;
}

/** Durumun kısa, küçük harfli karşılığı — sohbet başlığının alt satırı. */
export function formatPresenceStatus(status: string | undefined): string {
  switch (status) {
    case "ONLINE":
      return "çevrimiçi";
    case "IDLE":
      return "boşta";
    case "DND":
      return "rahatsız etmeyin";
    default:
      return "çevrimdışı";
  }
}
