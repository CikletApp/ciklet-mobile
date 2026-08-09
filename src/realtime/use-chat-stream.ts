import { useEffect } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import { qk } from "@/api/query-keys";
import { useOutbox } from "@/stores/outbox";
import {
  chatMessagesEvent,
  chatReactionEvent,
  chatUpdateEvent,
  type ChatMessagePayload,
  type ReactionDelta,
} from "./events";
import { getSocket, subscribeToChat } from "./socket";

type MessageCache = InfiniteData<MessagesPage<ChatMessagePayload>>;

/**
 * Bir sohbetin canlı akışına abone olur ve gelen mesajları react-query
 * cache'ine DOĞRUDAN yazar.
 *
 * Neden invalidate değil: her mesajda `/api/messages` yeniden çekilirse
 * hareketli bir kanalda saniyede birden fazla istek çıkar, liste zıplar ve
 * kaydırma konumu kaybolur. Web istemcisi de aynı nedenle cache'e yazar.
 *
 * Abonelik `socket.ts` içindeki kümede tutulur; yeniden bağlanmada
 * otomatik olarak geri kurulur.
 */
export function useChatStream(chatId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chatId) return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    void getSocket().then((socket) => {
      if (!socket || cancelled) return;

      subscribeToChat(chatId);

      const key = qk.messages.chat(chatId);

      const handleAdd = (message: ChatMessagePayload) => {
        // Kendi gönderdiğimiz mesajın yayını geldi: bekleyen geçici satırı
        // düşür ki liste bir an aynı mesajı iki kez göstermesin.
        useOutbox.getState().resolveByContent(chatId, message.content);

        queryClient.setQueryData<MessageCache>(key, (old) => {
          if (!old?.pages?.length) {
            return {
              pages: [{ items: [message], nextCursor: null }],
              pageParams: [undefined],
            };
          }
          // Aynı mesaj iki kez gelebilir (iyimser ekleme + yayın).
          const exists = old.pages.some((page) =>
            page.items.some((item) => item.id === message.id)
          );
          if (exists) return old;

          const [newest, ...rest] = old.pages;
          return {
            ...old,
            pages: [{ ...newest, items: [message, ...newest.items] }, ...rest],
          };
        });

        // Açık DM'de gönderilen/alınan mesaj, ana listedeki önizleme ve
        // sıralamayı da güncellesin. Yenileme sohbet cache'ini etkilemez.
        if (!("member" in message)) {
          void queryClient.invalidateQueries({ queryKey: qk.directs });
        }
      };

      const handleUpdate = (message: ChatMessagePayload) => {
        queryClient.setQueryData<MessageCache>(key, (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === message.id ? message : item
              ),
            })),
          };
        });
        if (!("member" in message)) {
          void queryClient.invalidateQueries({ queryKey: qk.directs });
        }
      };

      const handleReaction = (delta: ReactionDelta) => {
        queryClient.setQueryData<MessageCache>(key, (old) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => {
                if (item.id !== delta.messageId) return item;
                const reactions = item.reactions ?? [];
                const reaction = {
                  ...delta.reaction,
                  messageId:
                    delta.reaction.messageId ?? ("member" in item ? delta.messageId : null),
                  directMessageId:
                    delta.reaction.directMessageId ?? ("member" in item ? null : delta.messageId),
                  createdAt: delta.reaction.createdAt ?? new Date().toISOString(),
                };
                return {
                  ...item,
                  reactions:
                    delta.action === "add"
                      ? reactions.some((entry) => entry.id === delta.reaction.id)
                        ? reactions
                        : [...reactions, reaction]
                      : reactions.filter((reaction) => reaction.id !== delta.reaction.id),
                };
              }),
            })),
          };
        });
      };

      const addEvent = chatMessagesEvent(chatId);
      const updateEvent = chatUpdateEvent(chatId);
      const reactionEvent = chatReactionEvent(chatId);

      socket.on(addEvent, handleAdd);
      socket.on(updateEvent, handleUpdate);
      socket.on(reactionEvent, handleReaction);

      detach = () => {
        // Handler referansıyla off: aynı olayı dinleyen diğer bileşenlerin
        // (ör. okunmamış sayacı) dinleyicileri silinmemeli.
        socket.off(addEvent, handleAdd);
        socket.off(updateEvent, handleUpdate);
        socket.off(reactionEvent, handleReaction);
      };
    });

    return () => {
      cancelled = true;
      detach?.();
      // Bilinçli olarak `chat:unsubscribe` GÖNDERİLMEZ — DM listesi aynı
      // odayı "son mesaj" güncellemesi için dinlemeye devam eder.
    };
  }, [chatId, queryClient]);
}
