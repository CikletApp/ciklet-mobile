import { MessageType } from "@ciklet/embedded-activities-sdk/types";

import type { ChatMessagePayload } from "@/realtime/events";

/**
 * Mesaj iletme — saf yardımcılar (ciklet-web `lib/forward-message.ts`
 * karşılığı; kurallar birebir aynı tutulur).
 *
 * İletilen mesaj hedef sohbette YENİ bir mesaj olarak yazılır: içerik ve ek
 * adresi kopyalanır, `metadata.forwarded` ile işaretlenir. Kaynak sohbet ya
 * da yazar bilgisi TAŞINMAZ: alıcı, mesajı ileten kişinin adıyla görür ve
 * kaynağın kim olduğu onun tasarrufunda kalır (Discord ile aynı kural).
 *
 * Gönderim standart mesaj uçlarından geçer (`/api/socket/messages`,
 * `/api/socket/direct-messages`); yetki ve hız sınırı orada uygulanır.
 */

export interface ForwardPayload {
  content: string;
  fileUrl?: string;
  metadata: Record<string, unknown>;
}

/**
 * Hedef uca gönderilecek gövde.
 *
 * `content` boş olamaz (uç reddeder): yalnızca ek taşıyan mesajda içerik ek
 * adresidir — `isAttachmentUrlContent` bunu çizimde gizler. Ek bilgisi ve
 * bot embed'leri kopyalanır; bunlar olmadan iletilen dosya adsız görünür,
 * embed kartı kaybolurdu.
 */
export function buildForwardPayload(source: ChatMessagePayload): ForwardPayload {
  const fileUrl = source.fileUrl?.trim() || undefined;
  const content = source.content?.trim() || fileUrl || "";

  const metadata: Record<string, unknown> = { forwarded: true };
  const sourceMeta = (source.metadata ?? {}) as {
    attachment?: unknown;
    embeds?: unknown[];
  };
  if (sourceMeta.attachment) metadata.attachment = sourceMeta.attachment;
  if (Array.isArray(sourceMeta.embeds) && sourceMeta.embeds.length > 0) {
    metadata.embeds = sourceMeta.embeds;
  }

  return fileUrl ? { content, fileUrl, metadata } : { content, metadata };
}

/**
 * Yalnızca sıradan mesajlar iletilebilir: çağrı kayıtları ve etkinlik
 * davetleri hedef sohbette anlamsız; silinmiş satırların da kopyalanacak
 * kalıcı içeriği yok.
 */
export function canForwardMessage(message: ChatMessagePayload): boolean {
  if (message.deleted) return false;
  if (message.type !== MessageType.DEFAULT) return false;
  return Boolean(message.content?.trim() || message.fileUrl);
}

/** İletilmiş mesaj işareti — baloncukta "İletildi" etiketi bundan çizilir. */
export function isForwardedMessage(message: ChatMessagePayload): boolean {
  return (message.metadata as { forwarded?: unknown } | null)?.forwarded === true;
}

/**
 * Tek seferde iletilebilecek hedef sayısı.
 *
 * Gönderim hız sınırı 10 saniyede 8 mesaj (ciklet-web messageSend); her
 * hedef iletilen mesaj + isteğe bağlı not olarak iki mesaj üretebilir.
 * 4 hedef × 2 = 8: tavan aşılmaz, hiçbir hedef 429'a düşmez.
 */
export const MAX_FORWARD_TARGETS = 4;

/** Nota izin verilen üst uzunluk (web modalıyla aynı). */
export const FORWARD_NOTE_MAX = 500;
