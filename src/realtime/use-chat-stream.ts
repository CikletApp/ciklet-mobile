import { useEffect } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import { qk } from "@/api/query-keys";
import { useOutbox } from "@/stores/outbox";
import {
  chatMessagesEvent,
  chatUpdateEvent,
  type ChatMessagePayload,
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
      };

      const addEvent = chatMessagesEvent(chatId);
      const updateEvent = chatUpdateEvent(chatId);

      socket.on(addEvent, handleAdd);
      socket.on(updateEvent, handleUpdate);

      detach = () => {
        // Handler referansıyla off: aynı olayı dinleyen diğer bileşenlerin
        // (ör. okunmamış sayacı) dinleyicileri silinmemeli.
        socket.off(addEvent, handleAdd);
        socket.off(updateEvent, handleUpdate);
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
