import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import { useAuth } from "@/stores/auth";
import { ServerEvent, type FriendRequestPayload } from "./events";
import { getSocket } from "./socket";

/**
 * Uygulama genelinde dinlenen sosyal olaylar.
 *
 * Sohbet ekranından bağımsız çalışır (kök düzende bir kez kurulur):
 *  - `friend_request` / `friend_request_updated` → arkadaş listesini tazeler
 *  - `new_message` → sohbet AÇIK DEĞİLKEN gelen DM'ler; liste ve okunmamış
 *    sayaçları güncellenir
 *
 * Bu olaylar olmadan kullanıcı, uygulamayı kapatıp açmadan yeni bir
 * arkadaşlık isteğini ya da yeni bir DM'yi göremez.
 */
export function useSocialEvents() {
  const queryClient = useQueryClient();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (status !== "signedIn") return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    void getSocket().then((socket) => {
      if (!socket || cancelled) return;

      const refreshFriends = (_payload?: FriendRequestPayload) => {
        void queryClient.invalidateQueries({ queryKey: qk.friends });
      };

      const onNewMessage = () => {
        // Sohbet listesi sırası ve okunmamış rozetleri sunucudan gelir;
        // istemcide yeniden hesaplamak yerine tazelemek doğrusu.
        void queryClient.invalidateQueries({ queryKey: qk.directs });
        void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
      };

      socket.on(ServerEvent.FRIEND_REQUEST, refreshFriends);
      socket.on(ServerEvent.FRIEND_REQUEST_UPDATED, refreshFriends);
      socket.on(ServerEvent.NEW_MESSAGE, onNewMessage);

      detach = () => {
        socket.off(ServerEvent.FRIEND_REQUEST, refreshFriends);
        socket.off(ServerEvent.FRIEND_REQUEST_UPDATED, refreshFriends);
        socket.off(ServerEvent.NEW_MESSAGE, onNewMessage);
      };
    });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [status, queryClient]);
}
