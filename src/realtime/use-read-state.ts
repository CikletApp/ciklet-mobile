import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { ServerEvent } from "./events";
import { onGatewayEvent } from "./gateway";

/**
 * Okundu bilgisi.
 *
 * Sohbet açıkken görülen en yeni mesaj `/api/read-state/ack` ile bildirilir
 * (ADR-0012 öncesi Socket.IO `MESSAGE_ACK` olayıydı). Sunucu imleci
 * ilerletip `read_state.updated` yayınlar; rozetler oradan tazelenir.
 *
 * Aynı mesaj için tekrar ack gönderilmez — kullanıcı listede kaydırdıkça
 * istek yağmuru olmaz.
 */
export function useReadState(
  chatId: string | undefined,
  kind: "channel" | "direct",
  /** Listedeki en yeni mesajın kimliği (outbox kayıtları hariç). */
  latestMessageId: string | undefined
) {
  const queryClient = useQueryClient();
  const lastAcked = useRef<string | null>(null);

  // Okundu bildir.
  useEffect(() => {
    if (!chatId || !latestMessageId) return;
    if (lastAcked.current === latestMessageId) return;
    lastAcked.current = latestMessageId;

    void api(endpoints.readStateAck, {
      method: "POST",
      body: {
        [kind === "channel" ? "channelId" : "directId"]: chatId,
        messageId: latestMessageId,
      },
    }).catch(() => {
      // Başarısız ack bir sonraki mesajda tekrar denenir.
      if (lastAcked.current === latestMessageId) lastAcked.current = null;
    });
  }, [chatId, kind, latestMessageId]);

  // Sohbet değişince imleci sıfırla.
  useEffect(() => {
    lastAcked.current = null;
  }, [chatId]);

  // Sunucu okuma durumunu güncelleyince rozetleri tazele.
  useEffect(() => {
    return onGatewayEvent(ServerEvent.READ_STATE_UPDATED, () => {
      void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
      void queryClient.invalidateQueries({ queryKey: qk.directs });
      void queryClient.invalidateQueries({ queryKey: qk.inbox });
    });
  }, [queryClient]);
}
