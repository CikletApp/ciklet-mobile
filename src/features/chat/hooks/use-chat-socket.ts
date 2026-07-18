import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  chatRoom,
  SocketEvents,
} from "@ciklet/embedded-activities-sdk/types";

import { getSocket } from "@/lib/socket";

/**
 * Bir sohbetin canlı akışına abone olur; odadan yayın geldikçe mesaj
 * cache'ini tazeler. (İlk sürüm invalidation ile; ileride web'deki gibi
 * cache'e doğrudan ekleme yapılabilir.)
 */
export function useChatSocket(chatId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await getSocket();
      if (!active) return;

      const room = chatRoom(chatId);
      const onMessage = () => {
        queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      };

      socket.emit(SocketEvents.CHAT_SUBSCRIBE, { chatId });
      socket.on(room, onMessage);
      cleanup = () => socket.off(room, onMessage);
    })();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [chatId, queryClient]);
}
