import { useInfiniteQuery } from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import type { ChatMessagePayload } from "@/realtime/events";
import { readStoredPage, storedAt, storedMessages } from "@/features/chat/message-store";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";

/**
 * Sohbet geçmişi.
 *
 * Kanal ve DM aynı sözleşmeyi paylaşır (`{items, nextCursor}`) ve aynı cache
 * anahtarını kullanır (`chatId`), böylece canlı akış hook'u
 * (`useChatStream`) ikisini ayırt etmek zorunda kalmaz.
 *
 * Gönderim burada DEĞİL: iyimser akış `features/chat/use-composer.ts`
 * içinde outbox store'uyla birlikte yürür (bkz. o dosyadaki gerekçe).
 */

export type ChatKind = "channel" | "direct";

export function useChatMessages(kind: ChatKind, chatId: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.messages.chat(chatId ?? "yok"),
    enabled: Boolean(chatId),
    queryFn: async ({ pageParam }) => {
      // Eski sayfalar önce cihazdaki kesimden (ağsız, anında); kesim
      // bitince sunucudan. En yeni sayfa (imleçsiz) her zaman sunucudan.
      if (pageParam && chatId) {
        const local = await readStoredPage(chatId, pageParam);
        if (local) return local;
      }
      return api<MessagesPage<ChatMessagePayload>>(
        kind === "channel"
          ? endpoints.channelMessages(chatId!, pageParam)
          : endpoints.directMessages(chatId!, pageParam)
      );
    },
    initialPageParam: undefined as string | undefined,
    // Cihazdaki son mesajlar anında görünür; tazelik `useChatStream`'in
    // açılış eşitlemesinden gelir (features/chat/message-sync).
    initialData: () => (chatId ? storedMessages(chatId) : undefined),
    initialDataUpdatedAt: () => (chatId ? storedAt(chatId) : undefined),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Canlı akış cache'i zaten güncel tutuyor; odak değişiminde yeniden
    // çekmek kaydırma konumunu bozar.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}
