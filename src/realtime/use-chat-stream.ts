import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import { useOutbox } from "@/stores/outbox";
import { applyReactionDelta, type MessageCache } from "@/features/chat/reaction-cache";
import { applyPinUpdate } from "@/features/chat/pins";
import {
  ServerEvent,
  messageFromEnvelope,
  type ChatMessagePayload,
  type ReactionDelta,
} from "./events";
import { onGatewayEvent, subscribeToChat } from "./gateway";

/**
 * Bir sohbetin canlı akışına abone olur ve gelen mesajları react-query
 * cache'ine DOĞRUDAN yazar.
 *
 * Neden invalidate değil: her mesajda geçmiş yeniden çekilirse hareketli bir
 * kanalda saniyede birden fazla istek çıkar, liste zıplar ve kaydırma konumu
 * kaybolur. Web istemcisi de aynı nedenle cache'e yazar.
 *
 * Üç kapı var (web: `hooks/use-chat-socket.ts`):
 *   - yeni mesaj  → sohbet aboneliği (`chat.subscribe`), zarf olarak
 *   - düzenleme   → `message.update` oda olayı, TAM mesaj olarak (sabitleme
 *                   ve kaldırma da bu olay; `pinnedAt` alanıyla)
 *   - tepki       → `message.reaction` oda olayı, delta olarak
 * Son ikisi de aynı odadan geliyor ama olay türüyle dağıtılıyor; bu yüzden
 * `chatId` süzgeci şart.
 */
export function useChatStream(chatId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chatId) return;
    const key = qk.messages.chat(chatId);

    const writeNew = (message: ChatMessagePayload) => {
      // Kendi gönderdiğimiz mesajın yayını geldi: bekleyen geçici satırı
      // düşür ki liste bir an aynı mesajı iki kez göstermesin.
      useOutbox.getState().resolveByContent(chatId, message.content);

      queryClient.setQueryData<MessageCache>(key, (old) => {
        if (!old?.pages?.length) {
          return { pages: [{ items: [message], nextCursor: null }], pageParams: [undefined] };
        }
        // HTTP yanıtı ile yayın aynı mesajı iki kez getirebilir.
        const exists = old.pages.some((page) => page.items.some((item) => item.id === message.id));
        if (exists) return old;
        const [newest, ...rest] = old.pages;
        return { ...old, pages: [{ ...newest, items: [message, ...newest.items] }, ...rest] };
      });

      // Açık DM'de gönderilen/alınan mesaj, ana listedeki önizleme ve
      // sıralamayı da güncellesin.
      if (!("member" in message)) {
        void queryClient.invalidateQueries({ queryKey: qk.directs });
        void queryClient.invalidateQueries({ queryKey: qk.inbox });
      }
    };

    const releaseChat = subscribeToChat(chatId, (event) => {
      // Oda yalnızca `message.create` taşıyor; ileride başka tür eklenirse
      // sessizce mesaj sanılmasın.
      if (event.eventType !== "message.create") return;
      writeNew(messageFromEnvelope(event));
    });

    const releaseUpdate = onGatewayEvent(ServerEvent.MESSAGE_UPDATE, (frame) => {
      if (frame.chatId !== chatId) return;
      const incoming = frame.message as ChatMessagePayload | undefined;
      if (!incoming?.id) return;
      queryClient.setQueryData<MessageCache>(key, (old) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === incoming.id ? mergeMessage(item, incoming) : item
            ),
          })),
        };
      });
      // Sabitleme/kaldırma da bu olayla geliyor (ayrı olay yok): sabit
      // çubuğu listesi `pinnedAt`'e göre güncellenir.
      applyPinUpdate(queryClient, chatId, incoming);
      if (!("member" in incoming)) {
        void queryClient.invalidateQueries({ queryKey: qk.directs });
      }
    });

    const releaseReaction = onGatewayEvent(ServerEvent.MESSAGE_REACTION, (frame) => {
      if (frame.chatId !== chatId) return;
      const delta = frame.delta as ReactionDelta | undefined;
      if (!delta?.messageId || !delta.reaction?.id) return;
      if (delta.action !== "add" && delta.action !== "remove") return;
      queryClient.setQueryData<MessageCache>(key, (old) => applyReactionDelta(old, delta));
    });

    return () => {
      releaseChat();
      releaseUpdate();
      releaseReaction();
    };
  }, [chatId, queryClient]);
}

/**
 * Güncelleme yayını her alanı taşımayabilir (ör. yalnızca içerik). Eksik
 * alanlar eldeki kopyadan korunur; aksi hâlde düzenlenen mesajın tepkileri
 * ya da alıntısı bir anlığına kaybolurdu (web: `mergeIncomingMessage`).
 */
function mergeMessage(current: ChatMessagePayload, incoming: ChatMessagePayload): ChatMessagePayload {
  const merged = { ...current, ...incoming } as ChatMessagePayload & Record<string, unknown>;
  const prev = current as unknown as Record<string, unknown>;
  const next = incoming as unknown as Record<string, unknown>;
  if (next.reactions === undefined) merged.reactions = prev.reactions as never;
  if (next.replyTo === undefined) merged.replyTo = prev.replyTo as never;
  if (next.metadata === undefined) merged.metadata = prev.metadata as never;
  if ("member" in current && "member" in incoming && incoming.member) {
    (merged as Record<string, unknown>).member = { ...current.member, ...incoming.member };
  }
  return merged;
}
