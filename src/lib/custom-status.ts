/**
 * Özel durum (emoji + kısa metin + isteğe bağlı bitiş) — ciklet-web
 * `lib/custom-status.ts` kurallarının mobil kopyası.
 *
 * Presence durumundan (çevrimiçi/boşta) ayrıdır ve profil alanlarında
 * taşınır: `customStatusText/Emoji/Until`. Süresi dolanı OKUYAN taraf eler;
 * temizleme işi yok. DM eşlerine değişiklik `profile.updated` ile yayılır.
 */

export const CUSTOM_STATUS_MAX = 128;
export const CUSTOM_STATUS_EMOJI_MAX = 16;

/** `seconds: -1` → bugün gece yarısına kadar, `null` → temizleyene kadar. */
export const CUSTOM_STATUS_DURATIONS: { id: string; label: string; seconds: number | null }[] = [
  { id: "30m", label: "30 dakika", seconds: 30 * 60 },
  { id: "1h", label: "1 saat", seconds: 60 * 60 },
  { id: "4h", label: "4 saat", seconds: 4 * 60 * 60 },
  { id: "today", label: "Bugün", seconds: -1 },
  { id: "never", label: "Temizleyene kadar", seconds: null },
];

export interface CustomStatusFields {
  customStatusText?: string | null;
  customStatusEmoji?: string | null;
  customStatusUntil?: string | null;
}

export interface CustomStatus {
  text: string | null;
  emoji: string | null;
  until: Date | null;
}

/** Süresi dolmamış ve boş olmayan durum; yoksa `null`. */
export function activeCustomStatus(
  profile: CustomStatusFields | null | undefined,
  now: number = Date.now()
): CustomStatus | null {
  if (!profile) return null;
  const text = profile.customStatusText?.trim() || null;
  const emoji = profile.customStatusEmoji?.trim() || null;
  if (!text && !emoji) return null;
  const until = profile.customStatusUntil ? new Date(profile.customStatusUntil) : null;
  const valid = until && !Number.isNaN(until.getTime()) ? until : null;
  if (valid && valid.getTime() <= now) return null;
  return { text, emoji, until: valid };
}

export function customStatusUntilFrom(seconds: number | null, now: Date = new Date()): Date | null {
  if (seconds === null) return null;
  if (seconds === -1) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  return new Date(now.getTime() + seconds * 1000);
}

export function formatCustomStatus(status: CustomStatus): string {
  return [status.emoji, status.text].filter(Boolean).join(" ");
}

/**
 * SDK'nın `PublicProfile` tipi özel durum alanlarını henüz bilmiyor; arkadaş
 * listesi ve kart ucu ise bunları taşıyor (`PROFILE_PUBLIC_SELECT`). Tip
 * genişletmeyi çağrı yerlerine dağıtmamak için tek okuma yolu.
 */
export function customStatusOf(profile: unknown): CustomStatus | null {
  if (!profile || typeof profile !== "object") return null;
  return activeCustomStatus(profile as CustomStatusFields);
}
