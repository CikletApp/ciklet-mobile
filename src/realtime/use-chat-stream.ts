import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ChatKind } from "@/api/hooks";
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
import { getConnectionState, onGatewayEvent, onGatewayOpen, subscribeToChat } from "./gateway";

/** Ağ geçidi kopukken en yeni sayfa bu aralıkla yoklanır (web: 1 sn; mobil veri için seyrek). */
const CATCH_UP_POLL_MS = 5_000;

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
 *
 * ── Telafi (catch-up) ──────────────────────────────────────────────────
 * Abonelik yalnızca bağlantı AÇIKKEN mesaj taşır. Bağlantı koptuğunda ya da
 * arka planda öldüğünde (bkz. gateway.ts "zombi" notu) arada gelen mesajlar
 * hiçbir yoldan ulaşmıyordu ve kullanıcı uygulamayı yeniden başlatana kadar
 * sohbet eski kalıyordu. Web bu boşluğu soket yokken yoklamayla kapatıyor
 * (`use-chat-query`); burada da aynı: bağlantı her (yeniden) kurulduğunda ve
 * kopukken belirli aralıkla en yeni sayfa çekilir, cache'te olmayanlar
 * listeye eklenir.
 */
export function useChatStream(kind: ChatKind, chatId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chatId) return;
    const key = qk.messages.chat(chatId);

    const prepend = (incoming: ChatMessagePayload[]) => {
      queryClient.setQueryData<MessageCache>(key, (old) => {
        if (!old?.pages?.length) {
          return { pages: [{ items: incoming, nextCursor: null }], pageParams: [undefined] };
        }
        // HTTP yanıtı ile yayın aynı mesajı iki kez getirebilir.
        const known = new Set(old.pages.flatMap((page) => page.items.map((item) => item.id)));
        const fresh = incoming.filter((item) => !known.has(item.id));
        if (fresh.length === 0) return old;
        const [newest, ...rest] = old.pages;
        return { ...old, pages: [{ ...newest, items: [...fresh, ...newest.items] }, ...rest] };
      });
    };

    const writeNew = (message: ChatMessagePayload) => {
      // Kendi gönderdiğimiz mesajın yayını geldi: bekleyen geçici satırı
      // düşür ki liste bir an aynı mesajı iki kez göstermesin.
      useOutbox.getState().resolveByContent(chatId, message.content);
      prepend([message]);

      // Açık DM'de gönderilen/alınan mesaj, ana listedeki önizleme ve
      // sıralamayı da güncellesin.
      if (!("member" in message)) {
        void queryClient.invalidateQueries({ queryKey: qk.directs });
        void queryClient.invalidateQueries({ queryKey: qk.inbox });
      }
    };

    let catchingUp = false;
    const catchUp = async () => {
      if (catchingUp) return;
      catchingUp = true;
      try {
        const page = await api<MessagesPage<ChatMessagePayload>>(
          kind === "channel" ? endpoints.channelMessages(chatId) : endpoints.directMessages(chatId)
        );
        const old = queryClient.getQueryData<MessageCache>(key);
        // İlk yükleme `useChatMessages`'ın işi; boş cache'e sayfa yazılmaz.
        if (!old?.pages?.length) return;
        const known = new Set(old.pages.flatMap((p) => p.items.map((item) => item.id)));
        const fresh = page.items.filter((item) => !known.has(item.id));
        if (fresh.length === 0) return;
        // Sayfanın TAMAMI yabancıysa boşluk bir sayfadan büyük olabilir:
        // parça parça eklemek ortada delik bırakır; geçmiş baştan çekilir.
        if (fresh.length === page.items.length) {
          await queryClient.invalidateQueries({ queryKey: key });
          return;
        }
        for (const item of fresh) useOutbox.getState().resolveByContent(chatId, item.content);
        prepend(fresh);
      } catch {
        // Ağ yok; bir sonraki yoklama ya da bağlantı açılışı yeniden dener.
      } finally {
        catchingUp = false;
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

    // Bağlantı (yeniden) kurulduğunda kaçırılanlar; kopukken düzenli yoklama.
    const releaseOpen = onGatewayOpen(() => void catchUp());
    const poll = setInterval(() => {
      if (getConnectionState() !== "connected") void catchUp();
    }, CATCH_UP_POLL_MS);
    if (getConnectionState() !== "connected") void catchUp();

    return () => {
      releaseChat();
      releaseUpdate();
      releaseReaction();
      releaseOpen();
      clearInterval(poll);
    };
  }, [chatId, kind, queryClient]);
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
