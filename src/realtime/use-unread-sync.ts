import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import {
  applyReadState,
  incrementChannel,
  incrementDirect,
  isHiddenChannel,
  patchUnread,
} from "@/features/unread/unread-cache";
import { activeChatId } from "@/stores/active-chat";
import { useAuth } from "@/stores/auth";
import { ServerEvent } from "./events";
import { onGatewayEvent, onGatewayOpen } from "./gateway";

/** Kaçan olaylara karşı güvenlik ağı — yalnızca uygulama öndeyken (web: 60 sn). */
const RECONCILE_MS = 60_000;

/**
 * Okunmamış rozetlerini canlı tutar (web: `navigation-server-list` +
 * `use-unread-store`). Kök düzende bir kez bağlanır.
 *
 *  - `channel.message`      → kanal ve sunucu sayacı +1
 *  - `message.notification` → DM sayacı +1
 *  - `read_state.updated`   → sohbetin sayacı silinir (başka cihazda
 *                              okunduysa da); "okunmadı işaretle" ise
 *                              (`reconcile`) sayılar yeniden çekilir
 *
 * Kendi mesajın ve ekranda açık sohbetin mesajı sayılmaz. Mobilde soket
 * arka planda ölüyor ve o arada gelen mesajlar hiç olay üretmiyor; bu
 * yüzden bağlantı her açıldığında, uygulama öne geldiğinde ve dakikada bir
 * sayılar sunucudan tazelenir.
 */
export function useUnreadSync() {
  const queryClient = useQueryClient();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (status !== "signedIn") return;

    const myId = () => useAuth.getState().profile?.id;
    /** Sohbet ekranda açık ve uygulama önde: kullanıcı mesajı görüyor. */
    const isOpen = (chatId: string) =>
      AppState.currentState === "active" && activeChatId() === chatId;

    const reconcile = () => {
      void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
      void queryClient.invalidateQueries({ queryKey: qk.directs });
    };

    const releases = [
      onGatewayEvent(ServerEvent.CHANNEL_MESSAGE, (frame) => {
        const { serverId, channelId, senderId } = frame;
        if (typeof serverId !== "string" || typeof channelId !== "string") return;
        if (senderId === myId() || isOpen(channelId)) return;
        if (isHiddenChannel(queryClient, serverId, channelId)) return;
        patchUnread(queryClient, (data) => incrementChannel(data, serverId, channelId));
      }),

      onGatewayEvent(ServerEvent.MESSAGE_NOTIFICATION, (frame) => {
        const directId = frame.directId;
        const sender = frame.sender as { id?: string } | undefined;
        if (typeof directId !== "string" || !sender?.id || sender.id === myId()) return;
        // Yoksaydığın kişiden gelen DM rozet üretmez (sunucu `ignored` işaretler).
        if (frame.ignored === true) return;
        if (isOpen(directId)) return;
        patchUnread(queryClient, (data) => incrementDirect(data, directId));
      }),

      onGatewayEvent(ServerEvent.READ_STATE_UPDATED, (frame) => {
        const readState = frame.readState as
          | { channelId?: string | null; directId?: string | null; messageId?: string | null; reconcile?: boolean }
          | undefined;
        if (!readState) return;
        applyReadState(queryClient, readState);
        // Bildirimler sekmesindeki gelen kutusu hâlâ `/api/inbox`'tan okuyor.
        void queryClient.invalidateQueries({ queryKey: qk.inbox });
        if (readState.reconcile === true) reconcile();
      }),

      // Kopukken gelen mesajlar hiçbir olay üretmedi.
      onGatewayOpen(reconcile),
    ];

    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") reconcile();
    });
    // Periyodik ağda yalnızca sayılar; sohbet listesi olaylarla tazeleniyor.
    const timer = setInterval(() => {
      if (AppState.currentState === "active") {
        void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
      }
    }, RECONCILE_MS);

    return () => {
      releases.forEach((release) => release());
      appState.remove();
      clearInterval(timer);
    };
  }, [status, queryClient]);
}
