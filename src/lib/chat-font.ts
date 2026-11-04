import type { ChatFontSize } from "@/stores/preferences";

/**
 * Sohbet yazı boyutu — web Görünüm → Yazı Boyutu (Küçük 14 / Orta 16 /
 * Büyük 18 px) oranlarıyla mobil mesaj metnine (15/22) uygulanır.
 */
export const CHAT_FONT_SCALE: Record<ChatFontSize, number> = { small: 14 / 16, medium: 1, large: 18 / 16 };

/** Mesaj metni: gövde yazısından bir tık ferah satır (15/22), seçilen boyuta ölçekli. */
export function chatMessageText(size: ChatFontSize): { fontSize: number; lineHeight: number } {
  const scale = CHAT_FONT_SCALE[size] ?? 1;
  return { fontSize: Math.round(15 * scale), lineHeight: Math.round(22 * scale) };
}
