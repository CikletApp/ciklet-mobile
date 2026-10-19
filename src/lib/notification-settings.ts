/**
 * Bildirim ayarları — sunucu, kanal ve DM başına "ne zaman rahatsız et".
 *
 * ciklet-web `lib/notification-settings.ts` ile birebir aynı saf mantık;
 * sunucu okunmamış sayımında ve push yolunda aynı kararı verdiği için
 * mobil yalnızca uygulama içi ses/kart kararında ve arayüzde kullanır.
 *
 * Seviye ve susturma AYRI eksenlerdir (Discord'daki gibi):
 * - `level`: ALL (her mesaj), MENTIONS (yalnızca bahsetmeler), NOTHING.
 *   Kanalda `null` = sunucudan miras; sunucuda `null` = ALL.
 * - `mutedUntil`: doluysa o ana kadar hiçbir bildirim ve okunmamış rozeti
 *   yok; `MUTE_FOREVER` süresiz.
 */

export type NotificationLevel = "ALL" | "MENTIONS" | "NOTHING";

/** Süresiz susturma: uzak bir tarih yerine açık işaret. */
export const MUTE_FOREVER = -1;

/** ciklet-web: `GET/PUT /api/notification-settings` kaydı. */
export interface NotificationSettingRecord {
  serverId: string | null;
  channelId: string | null;
  directId: string | null;
  /** null = miras (kanal) / varsayılan (sunucu). */
  level: NotificationLevel | null;
  /** Unix ms; MUTE_FOREVER süresiz; null = susturulmamış. */
  mutedUntil: number | null;
  suppressEveryone: boolean;
  /** Görüntü adı (sunucu / #kanal / kişi); yalnızca liste yanıtında dolu. */
  label?: string;
}

/** Ayarın hedefi — üçünden tam biri (kanal için sunucu da verilebilir). */
export interface NotificationTarget {
  serverId?: string;
  channelId?: string;
  directId?: string;
}

export const MUTE_DURATIONS: { id: string; label: string; ms: number }[] = [
  { id: "15m", label: "15 dakika", ms: 15 * 60 * 1000 },
  { id: "1h", label: "1 saat", ms: 60 * 60 * 1000 },
  { id: "8h", label: "8 saat", ms: 8 * 60 * 60 * 1000 },
  { id: "24h", label: "24 saat", ms: 24 * 60 * 60 * 1000 },
  { id: "forever", label: "Açana kadar", ms: MUTE_FOREVER },
];

export const LEVEL_LABELS: Record<NotificationLevel, string> = {
  ALL: "Tüm mesajlar",
  MENTIONS: "Yalnızca bahsetmeler",
  NOTHING: "Hiçbiri",
};

export function isMutedAt(mutedUntil: number | null | undefined, now: number): boolean {
  if (mutedUntil == null) return false;
  if (mutedUntil === MUTE_FOREVER) return true;
  return mutedUntil > now;
}

/** Süre seçiminden bitiş anı. */
export function muteUntilFrom(durationMs: number, now: number): number {
  return durationMs === MUTE_FOREVER ? MUTE_FOREVER : now + durationMs;
}

export interface EffectiveNotification {
  muted: boolean;
  level: NotificationLevel;
  /** Normal mesaj ses/kart üretir mi. */
  notifyMessages: boolean;
  /** Bahsetme ses/kart üretir mi. */
  notifyMentions: boolean;
}

/** Kanal için etkin karar: kanal YA DA sunucu susturulmuşsa sessiz; seviye kanaldan, yoksa sunucudan. */
export function effectiveChannelNotification(
  channel: NotificationSettingRecord | null | undefined,
  server: NotificationSettingRecord | null | undefined,
  now: number
): EffectiveNotification {
  const muted = isMutedAt(channel?.mutedUntil, now) || isMutedAt(server?.mutedUntil, now);
  const level: NotificationLevel = channel?.level ?? server?.level ?? "ALL";
  return {
    muted,
    level,
    notifyMessages: !muted && level === "ALL",
    notifyMentions: !muted && level !== "NOTHING",
  };
}

/** DM için etkin karar: yalnızca susturma var. */
export function effectiveDirectNotification(
  direct: NotificationSettingRecord | null | undefined,
  now: number
): EffectiveNotification {
  const muted = isMutedAt(direct?.mutedUntil, now);
  return { muted, level: "ALL", notifyMessages: !muted, notifyMentions: !muted };
}

/** Kayıt hâlâ bir şey söylüyor mu; süresi dolmuş susturma ve boş seviye silinebilir. */
export function isSettingMeaningful(record: NotificationSettingRecord, now: number): boolean {
  return isMutedAt(record.mutedUntil, now) || record.level != null || record.suppressEveryone;
}

/** Susturma kalan süresinin kısa etiketi. */
export function muteRemainingLabel(mutedUntil: number | null | undefined, now: number): string | null {
  if (!isMutedAt(mutedUntil, now)) return null;
  if (mutedUntil === MUTE_FOREVER) return "Açana kadar susturuldu";
  const remaining = (mutedUntil as number) - now;
  const minutes = Math.ceil(remaining / 60000);
  if (minutes < 60) return `${minutes} dk daha susturuldu`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `${hours} sa daha susturuldu`;
  return `${Math.ceil(hours / 24)} gün daha susturuldu`;
}

export function settingKey(record: NotificationTarget | NotificationSettingRecord): string {
  if (record.channelId) return `channel:${record.channelId}`;
  if (record.directId) return `direct:${record.directId}`;
  if (record.serverId) return `server:${record.serverId}`;
  return "";
}

/** Kayıt listesinden hedefin kaydı. */
export function findSetting(
  records: readonly NotificationSettingRecord[] | undefined,
  target: NotificationTarget
): NotificationSettingRecord | undefined {
  const key = settingKey(target);
  if (!key || !records) return undefined;
  return records.find((record) => settingKey(record) === key);
}
