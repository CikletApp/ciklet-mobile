import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import type { ChatMessagePayload } from "@/realtime/events";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";

/**
 * Sohbet geçmişi.
 *
 * Kanal ve DM aynı sözleşmeyi paylaşır (`{items, nextCursor}`) ve aynı
 * cache anahtarını kullanır (`chatId`), böylece canlı akış hook'u
 * (`useChatStream`) ikisini ayırt etmek zorunda kalmaz.
 */

export type ChatKind = "channel" | "direct";

export function useChatMessages(kind: ChatKind, chatId: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.messages.chat(chatId ?? "yok"),
    enabled: Boolean(chatId),
    queryFn: ({ pageParam }) =>
      api<MessagesPage<ChatMessagePayload>>(
        kind === "channel"
          ? endpoints.channelMessages(chatId!, pageParam)
          : endpoints.directMessages(chatId!, pageParam)
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Canlı akış cache'i zaten güncel tutuyor; odak değişiminde yeniden
    // çekmek kaydırma konumunu bozar.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export interface SendMessageInput {
  content: string;
  fileUrl?: string;
}

/**
 * Mesaj gönderimi.
 *
 * Uç, Socket.IO sunucusunun HTTP tarafıdır: kaydı yapar ve odaya yayınlar.
 * Yayın geri geldiğinde `useChatStream` mesajı cache'e yazar — bu yüzden
 * burada iyimser ekleme YAPILMAZ (Faz 3'te kuyruk ve iyimser satır gelecek;
 * ikisi birlikte tasarlanmalı yoksa çift satır görünür).
 */
export function useSendMessage(
  kind: ChatKind,
  chatId: string | undefined,
  serverId?: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ content, fileUrl }: SendMessageInput) => {
      if (!chatId) throw new Error("Sohbet kimliği yok");
      const path =
        kind === "channel"
          ? endpoints.sendChannelMessage(chatId, serverId ?? "")
          : endpoints.sendDirectMessage(chatId);
      return api(path, { method: "POST", body: { content, fileUrl } });
    },
    onError: () => {
      // Yayın gelmediyse cache'i sunucuyla hizala.
      if (chatId) {
        void queryClient.invalidateQueries({ queryKey: qk.messages.chat(chatId) });
      }
    },
  });
}
