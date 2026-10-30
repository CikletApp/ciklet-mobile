/**
 * Sunucu karşılama ekranı — web `lib/welcome-screen.ts` modülünün istemci
 * kopyası (sınırlar, tipler, gösterim kuralları). Doğrulama uçta
 * (`PUT /api/servers/:id/welcome-screen`).
 *
 * Pencere sunucuya YENİ katılan üyeye (katılımdan sonraki 15 dakika içinde,
 * ilk ziyarette bir kez) gösterilir — ekran etkinse ve içerik varsa.
 */

export const WELCOME_MAX_CHANNELS = 5;
export const WELCOME_DESCRIPTION_MAX = 140;
export const WELCOME_CHANNEL_DESCRIPTION_MAX = 50;
/** Tek bir emoji; bileşik emojiler (aile, bayrak, ten tonu) birkaç kod noktası tutar. */
export const WELCOME_EMOJI_MAX = 16;

/** Yeni üyeye pencerenin hâlâ gösterileceği süre (katılımdan itibaren). */
export const WELCOME_NEW_MEMBER_WINDOW_MS = 15 * 60 * 1000;

export interface WelcomeChannelEntry {
  channelId: string;
  description: string;
  emoji: string | null;
}

/** Kanal adıyla zenginleştirilmiş girdi — pencere bunu çizer. */
export interface WelcomeChannelView extends WelcomeChannelEntry {
  channelName: string;
}

export interface WelcomeScreenView {
  enabled: boolean;
  description: string | null;
  channels: WelcomeChannelView[];
}

/** Üye, karşılama penceresinin hâlâ gösterileceği kadar yeni mi katıldı? */
export function isWithinWelcomeWindow(joinedAt: string | Date, now: number = Date.now()): boolean {
  const time = new Date(joinedAt).getTime();
  return Number.isFinite(time) && now - time < WELCOME_NEW_MEMBER_WINDOW_MS;
}

/** Gösterilecek bir şey var mı? Boş bir pencere açmak kötü bir karşılama olurdu. */
export function hasWelcomeContent(screen: WelcomeScreenView | null | undefined): screen is WelcomeScreenView {
  return !!screen && screen.enabled && (!!screen.description || screen.channels.length > 0);
}
