import { useCallback } from "react";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ChatKind } from "@/api/hooks";
import { useOutbox } from "@/stores/outbox";

/**
 * Mesaj gönderimi — iyimser.
 *
 * Akış:
 *  1. Mesaj outbox'a "sending" olarak yazılır ve LİSTEDE HEMEN görünür.
 *  2. HTTP isteği gider (uç, Socket.IO sunucusunun HTTP tarafıdır: kaydeder
 *     ve odaya yayınlar).
 *  3. Yayın geri geldiğinde `use-chat-stream` outbox'taki eşleşen kaydı
 *     düşürür — geçici satır yerini gerçek mesaja bırakır.
 *  4. İstek başarısızsa kayıt "failed" olur; kullanıcı yeniden dener.
 *
 * Not: başarı yanıtında kaydı SİLMİYORUZ. Yayın her zaman yanıttan sonra
 * gelmez; silseydik mesaj bir kare kaybolur, sonra yeniden belirirdi.
 */
export function useComposer(
  kind: ChatKind,
  chatId: string | undefined,
  serverId?: string
) {
  const enqueue = useOutbox((s) => s.enqueue);
  const markFailed = useOutbox((s) => s.markFailed);
  const markSending = useOutbox((s) => s.markSending);
  const remove = useOutbox((s) => s.remove);

  const deliver = useCallback(
    async (outboxId: string, content: string) => {
      if (!chatId) return;
      try {
        await api(
          kind === "channel"
            ? endpoints.sendChannelMessage(chatId, serverId ?? "")
            : endpoints.sendDirectMessage(chatId),
          { method: "POST", body: { content } }
        );
      } catch (err) {
        markFailed(
          outboxId,
          err instanceof ApiError ? err.message : "Gönderilemedi"
        );
      }
    },
    [chatId, kind, serverId, markFailed]
  );

  const send = useCallback(
    (raw: string) => {
      const content = raw.trim();
      if (!content || !chatId) return;
      const outboxId = enqueue(chatId, content);
      void deliver(outboxId, content);
    },
    [chatId, enqueue, deliver]
  );

  const retry = useCallback(
    (outboxId: string, content: string) => {
      markSending(outboxId);
      void deliver(outboxId, content);
    },
    [markSending, deliver]
  );

  return { send, retry, discard: remove };
}
