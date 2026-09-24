import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import { useAuth } from "@/stores/auth";
import { ServerEvent } from "./events";
import { onGatewayEvent } from "./gateway";

/**
 * Uygulama genelinde dinlenen sosyal olaylar (kök düzende bir kez).
 *
 * Hepsi kullanıcının KENDİ odasına ya da üyesi olduğu sunucu odalarına
 * geliyor; sohbet aboneliği gerekmez:
 *  - arkadaşlık isteği geldi / yanıtlandı → arkadaş listesi
 *  - DM bildirimi, okuma imleci, üyelik değişimi → sohbet listesi ve rozetler
 *  - kanal mesajı → sunucu okunmamış rozetleri
 *  - sunucudan çıkarıldın / sunucu silindi → sunucu listesi
 */
export function useSocialEvents() {
  const queryClient = useQueryClient();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (status !== "signedIn") return;

    const invalidate = (...keys: readonly (readonly unknown[])[]) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };

    const releases = [
      onGatewayEvent(ServerEvent.FRIEND_REQUEST, () => invalidate(qk.friends)),
      onGatewayEvent(ServerEvent.FRIEND_REQUEST_UPDATED, () => invalidate(qk.friends)),
      // Sohbet açık değilken gelen DM: liste sırası ve rozet sunucudan gelir,
      // istemcide yeniden hesaplamak yerine tazelemek doğrusu.
      onGatewayEvent(ServerEvent.MESSAGE_NOTIFICATION, () => invalidate(qk.directs, qk.unreadCounts)),
      // Grup kuruldu, eklendin, çıkarıldın — yeni mesaj olmadığı için
      // bildirim olayı bunu yakalamaz.
      onGatewayEvent(ServerEvent.DIRECTS_UPDATED, () => invalidate(qk.directs)),
      onGatewayEvent(ServerEvent.CHANNEL_MESSAGE, () => invalidate(qk.unreadCounts)),
      onGatewayEvent(ServerEvent.SERVERS_REMOVED, () => invalidate(qk.memberships, qk.unreadCounts)),
      onGatewayEvent(ServerEvent.SERVER_DELETED, () => invalidate(qk.memberships, qk.unreadCounts)),
    ];

    return () => releases.forEach((release) => release());
  }, [status, queryClient]);
}
