import type { ChatMessagePayload } from "@/realtime/events";

/**
 * Süreli (kaybolan) DM mesajları istemcide.
 *
 * Sunucu süresi geçmiş mesajı hiç göndermiyor; ama önbellekte ve cihazdaki
 * kopyada (message-store) duran mesaj silinme anı gelince düşmeli, yoksa
 * "24 saat sonra silinir" sözü telefonda bozulur. Silinme anı geçmiş
 * yanıtında ve canlı zarfta `expiresAt` olarak gelir (SDK tipinde henüz
 * yok, bu yüzden güvenli okunuyor).
 */

export function expiryOf(message: ChatMessagePayload): number | null {
  const raw = (message as { expiresAt?: unknown }).expiresAt;
  if (typeof raw !== "string" || !raw) return null;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? at : null;
}

export function isExpired(message: ChatMessagePayload, now: number): boolean {
  const at = expiryOf(message);
  return at !== null && at <= now;
}

/** Düşecek mesaj yoksa AYNI diziyi döner (memo dostu). */
export function dropExpired<T extends ChatMessagePayload>(messages: T[], now: number): T[] {
  if (!messages.some((message) => isExpired(message, now))) return messages;
  return messages.filter((message) => !isExpired(message, now));
}

/** `now`dan sonraki en yakın silinme anı; süreli mesaj yoksa null. */
export function nextExpiry(messages: readonly ChatMessagePayload[], now: number): number | null {
  let next: number | null = null;
  for (const message of messages) {
    const at = expiryOf(message);
    if (at !== null && at > now && (next === null || at < next)) next = at;
  }
  return next;
}
