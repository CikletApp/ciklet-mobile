import { useCallback } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ChatKind } from "@/api/hooks";
import { qk } from "@/api/query-keys";
import type { PinFields } from "@/api/types";
import { showToast } from "@/components/ui";
import { attachmentPreviewLabel, classifyAttachment, readAttachmentInfo, type AttachmentKind } from "@/lib/attachments";
import type { ChatMessagePayload } from "@/realtime/events";
import type { MessageCache } from "./reaction-cache";

/**
 * Sabitlenen mesajlar — ciklet-web sözleşmesi v1 (ciklet-web-37,
 * 2026-09-27). Ayrı gerçek zamanlı olay YOK: sabitleme ve kaldırma mevcut
 * `message.update`'i yayınlıyor. Kural web'le aynı: güncellemede `pinnedAt`
 * doluysa listeye ekle/güncelle, boşsa çıkar. Böylece sabit bir mesajın
 * düzenlenmesi önizlemeyi, silinmesi listeyi de doğru tutar (sunucu silinen
 * mesajın sabitini kendisi kaldırıyor).
 */

export type PinnedMessage = ChatMessagePayload & PinFields;

interface PinsResponse {
  items: PinnedMessage[];
}

/**
 * Sohbet başına sunucu sınırı; 409 yanıtı kendi değerini de taşıyor. Ayrıca
 * kullanıcı başına 60 sn'de 10 sabitle/kaldır (429 RATE_LIMITED).
 */
const PIN_LIMIT = 50;

export function pinnedAtOf(message: ChatMessagePayload): string | null {
  return (message as PinnedMessage).pinnedAt ?? null;
}

/**
 * Sunucunun 422 `NOT_PINNABLE` döndüğü satırlar: arama kayıtları, süre
 * değişikliği ve "bir mesajı sabitledi" sistem satırı. Silinmiş mesaj da.
 * Menüde "Sabitle" bunlarda hiç gösterilmez.
 */
export function canBePinned(message: ChatMessagePayload): boolean {
  if (message.deleted) return false;
  const type: string = message.type ?? "DEFAULT";
  return !type.startsWith("CALL_") && type !== "EXPIRY_CHANGED" && type !== "MESSAGE_PINNED";
}

/**
 * Süreli DM'de süresi dolan mesajın sabiti de gider ama bunun için olay
 * yayınlanmıyor; istemci gizler. (Modül düzeyinde: render içinde doğrudan
 * `Date.now` React Compiler kuralına takılıyor.)
 */
function isExpired(message: PinnedMessage): boolean {
  const expiresAt = (message as { expiresAt?: string | null }).expiresAt;
  return typeof expiresAt === "string" && Date.parse(expiresAt) <= Date.now();
}

function visiblePins(data: PinsResponse): PinnedMessage[] {
  return data.items.filter((item) => !item.deleted && !isExpired(item));
}

function byPinnedAtDesc(a: PinnedMessage, b: PinnedMessage): number {
  return (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? "");
}

/**
 * Sohbetin sabitleri, en son sabitlenen başta. Uç yayında değilken (eski
 * sunucu) 404 döner: yeniden denenmez, liste boş kalır ve çubuk görünmez.
 */
export function usePins(kind: ChatKind, chatId: string | undefined) {
  return useQuery({
    queryKey: qk.pins(chatId ?? ""),
    enabled: Boolean(chatId),
    queryFn: () =>
      api<PinsResponse>(kind === "channel" ? endpoints.channelPins(chatId ?? "") : endpoints.directPins(chatId ?? "")),
    select: visiblePins,
    staleTime: 60_000,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
  });
}

/**
 * Güncel mesajı sabit listesine yansıtır — hem `message.update` yayınından
 * hem sabitle/kaldır yanıtından çağrılır. Liste henüz çekilmediyse dokunmaz;
 * çubuk açılınca zaten taze çekilecek.
 */
export function applyPinUpdate(queryClient: QueryClient, chatId: string, message: ChatMessagePayload) {
  const incoming = message as PinnedMessage;

  queryClient.setQueryData<PinsResponse>(qk.pins(chatId), (old) => {
    if (!old) return old;
    const existing = old.items.find((item) => item.id === incoming.id);
    // Alan hiç yoksa (savunma; bugün her yayıncı dolu ya da null gönderiyor)
    // sabit durumu bilinmiyor: listede varsa yalnızca içerik tazelenir,
    // listeden ÇIKARILMAZ (web'le aynı kural). Silinmiş mesaj zaten
    // `visiblePins` ile gizleniyor.
    if (incoming.pinnedAt === undefined) {
      if (!existing) return old;
      return { ...old, items: old.items.map((item) => (item.id === incoming.id ? ({ ...item, ...incoming, pinnedAt: item.pinnedAt } as PinnedMessage) : item)) };
    }
    const rest = old.items.filter((item) => item.id !== incoming.id);
    if (!incoming.pinnedAt) {
      return existing ? { ...old, items: rest } : old;
    }
    const next = { ...existing, ...incoming } as PinnedMessage;
    return { ...old, items: [...rest, next].sort(byPinnedAtDesc) };
  });
}

/** Yanıttaki güncel mesajı sohbet geçmişine de yazar (tepki/alıntı korunur). */
function writeToHistory(queryClient: QueryClient, chatId: string, message: PinnedMessage) {
  queryClient.setQueryData<MessageCache>(qk.messages.chat(chatId), (old) => {
    if (!old?.pages?.length) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => {
          if (item.id !== message.id) return item;
          const merged = { ...item, ...message } as ChatMessagePayload & Record<string, unknown>;
          const prev = item as unknown as Record<string, unknown>;
          const next = message as unknown as Record<string, unknown>;
          if (next.reactions === undefined) merged.reactions = prev.reactions as never;
          if (next.replyTo === undefined) merged.replyTo = prev.replyTo as never;
          if (next.metadata === undefined) merged.metadata = prev.metadata as never;
          return merged;
        }),
      })),
    };
  });
}

function pinErrorMessage(error: unknown, pin: boolean): string {
  if (error instanceof ApiError) {
    const body = (error.body ?? {}) as { error?: string; limit?: number };
    if (error.status === 403) return "Bu sohbette mesaj sabitleme yetkin yok.";
    if (error.status === 409 || body.error === "PIN_LIMIT") {
      return `En fazla ${body.limit ?? PIN_LIMIT} mesaj sabitlenebilir. Önce birini kaldır.`;
    }
    if (error.status === 422 || body.error === "NOT_PINNABLE") return "Bu mesaj sabitlenemez.";
    if (error.status === 429) return "Çok hızlı sabitleme yapıyorsun, biraz bekle.";
    if (error.status === 404) return "Mesaj bulunamadı.";
  }
  return pin ? "Mesaj sabitlenemedi." : "Sabitleme kaldırılamadı.";
}

/**
 * Sabitle / kaldır. Başarıda ayrıca bildirim yok: sabitlemede çubuk ve
 * "bir mesajı sabitledi" satırı, kaldırmada çubuğun değişmesi yeterli geri
 * bildirim. Hata her zaman şeritle söylenir.
 */
export function usePinAction(kind: ChatKind, chatId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    async (messageId: string, pin: boolean): Promise<boolean> => {
      try {
        const updated = await api<PinnedMessage>(
          kind === "channel" ? endpoints.pinChannelMessage(messageId, chatId) : endpoints.pinDirectMessage(messageId, chatId),
          { method: pin ? "POST" : "DELETE" }
        );
        if (updated?.id && updated.pinnedAt !== undefined) {
          applyPinUpdate(queryClient, chatId, updated);
          writeToHistory(queryClient, chatId, updated);
        } else {
          void queryClient.invalidateQueries({ queryKey: qk.pins(chatId) });
        }
        return true;
      } catch (error) {
        showToast(pinErrorMessage(error, pin), "error");
        return false;
      }
    },
    [chatId, kind, queryClient]
  );
}

/** Mesajın eki: adres + tür; yoksa null. */
export function pinAttachment(message: ChatMessagePayload): { url: string; kind: AttachmentKind } | null {
  const url = message.fileUrl?.trim();
  if (!url) return null;
  return { url, kind: classifyAttachment(url, readAttachmentInfo(message.metadata)) };
}

/** Çubuk ve liste için tek satırlık önizleme metni. */
export function pinPreview(message: ChatMessagePayload): string {
  const content = message.content.trim();
  const url = message.fileUrl?.trim();
  if (url && (!content || content === url || /^https?:\/\/\S+$/.test(content))) {
    return attachmentPreviewLabel(url, readAttachmentInfo(message.metadata));
  }
  if (message.type === "ACTIVITY_INVITE") return content || "Aktivite daveti";
  return content.replace(/\s+/g, " ") || "Mesaj";
}

/** Mesajın yazarı — kanalda üye profili, DM'de doğrudan profil. */
export function pinAuthor(message: ChatMessagePayload): { id: string; name: string; imageUrl: string | null } {
  const profile = "member" in message ? message.member?.profile : message.profile;
  return {
    id: profile?.id ?? "",
    name: ("member" in message ? message.member?.nickname : null) || profile?.name || profile?.username || "Bilinmeyen",
    imageUrl: profile?.imageUrl ?? null,
  };
}
