import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import { ClientEvent, ServerEvent, type ReadStatePayload } from "./events";
import { getSocket, peekSocket } from "./socket";

/**
 * Okundu bilgisi.
 *
 * Sohbet açıkken görülen en yeni mesaj sunucuya `MESSAGE_ACK` ile bildirilir;
 * sunucu okuma imlecini ilerletir ve `READ_STATE_UPDATED` yayınlar. Bu ikisi
 * olmadan okunmamış rozetleri hiç sıfırlanmaz.
 *
 * Aynı mesaj için tekrar tekrar ack göndermemek adına son bildirilen kimlik
 * hatırlanır — kullanıcı listede yukarı aşağı kaydırdıkça ack yağmuru olmaz.
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

    const socket = peekSocket();
    if (!socket?.connected) return;

    lastAcked.current = latestMessageId;
    socket.emit(ClientEvent.MESSAGE_ACK, {
      [kind === "channel" ? "channelId" : "directId"]: chatId,
      messageId: latestMessageId,
    });
  }, [chatId, kind, latestMessageId]);

  // Sohbet değişince imleci sıfırla.
  useEffect(() => {
    lastAcked.current = null;
  }, [chatId]);

  // Sunucu okuma durumunu güncelleyince rozetleri tazele.
  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;

    void getSocket().then((socket) => {
      if (!socket || cancelled) return;

      const onUpdated = (_payload: ReadStatePayload) => {
        void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
        void queryClient.invalidateQueries({ queryKey: qk.directs });
      };

      socket.on(ServerEvent.READ_STATE_UPDATED, onUpdated);
      detach = () => socket.off(ServerEvent.READ_STATE_UPDATED, onUpdated);
    });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [queryClient]);
}
