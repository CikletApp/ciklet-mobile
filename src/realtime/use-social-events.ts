import { useEffect } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import type { ProfileAnnotationEntry } from "@/api/types";
import { showInAppNotice } from "@/components/in-app-notice";
import { playMessageTone } from "@/lib/sounds";
import { activeChatId } from "@/stores/active-chat";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
import { usePresenceStore } from "@/stores/presence";
import { ServerEvent } from "./events";
import { onGatewayEvent } from "./gateway";

/**
 * Uygulama genelinde dinlenen sosyal olaylar (kök düzende bir kez).
 *
 * Hepsi kullanıcının KENDİ odasına ya da üyesi olduğu sunucu odalarına
 * geliyor; sohbet aboneliği gerekmez:
 *  - arkadaşlık isteği geldi / yanıtlandı → arkadaş listesi
 *  - DM bildirimi, okuma imleci, üyelik değişimi → sohbet listesi ve rozetler
 *    (+ uygulama ön plandayken ve sohbet açık değilken üstte bildirim kartı)
 *  - kanalda etiketlenme → bildirim kartı
 *  - kanal mesajı → sunucu okunmamış rozetleri
 *  - profilin görsel alanları değişti → avatar/afiş çizen cache'ler
 *  - sunucudan çıkarıldın / sunucu silindi / kanal yerleşimi değişti → listeler
 */
export function useSocialEvents() {
  const queryClient = useQueryClient();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (status !== "signedIn") return;

    const invalidate = (...keys: readonly (readonly unknown[])[]) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };

    /** Uygulama içi kart gösterilsin mi — web `message.notification` kuralları. */
    const noticeAllowed = (chatId: string | null) => {
      if (AppState.currentState !== "active") return false; // arka planda sistem bildirimi var
      if (usePresenceStore.getState().selfStatus === "DND") return false;
      const prefs = usePreferences.getState();
      if (!prefs.notificationsEnabled || !prefs.messageNotifications) return false;
      // Sohbet zaten açıksa kullanıcı mesajı görüyor.
      if (chatId && activeChatId() === chatId) return false;
      return true;
    };

    const ignoring = (profileId: string) => {
      const list = queryClient.getQueryData<ProfileAnnotationEntry[]>(qk.annotations);
      return Array.isArray(list) && list.some((entry) => entry.targetId === profileId && entry.ignored);
    };

    const releases = [
      onGatewayEvent(ServerEvent.FRIEND_REQUEST, (frame) => {
        invalidate(qk.friends);
        const sender = frame.sender as { id?: string; username?: string; name?: string | null; imageUrl?: string | null } | undefined;
        if (!sender?.username || !noticeAllowed(null)) return;
        void playMessageTone();
        showInAppNotice({
          title: sender.name?.trim() || sender.username,
          body: "Sana arkadaşlık isteği gönderdi",
          imageUrl: sender.imageUrl,
          fallbackText: sender.username,
          onPress: () => router.push("/notifications"),
        });
      }),
      onGatewayEvent(ServerEvent.FRIEND_REQUEST_UPDATED, () => invalidate(qk.friends)),

      // Sohbet açık değilken gelen DM: liste sırası ve rozet sunucudan gelir,
      // istemcide yeniden hesaplamak yerine tazelemek doğrusu.
      onGatewayEvent(ServerEvent.MESSAGE_NOTIFICATION, (frame) => {
        invalidate(qk.directs, qk.unreadCounts, qk.inbox);

        const sender = frame.sender as { id?: string; username?: string; name?: string | null; imageUrl?: string | null } | undefined;
        const directId = typeof frame.directId === "string" ? frame.directId : null;
        const myId = useAuth.getState().profile?.id;
        if (!sender?.id || !sender.username || sender.id === myId) return;
        if (frame.isSpam === true || ignoring(sender.id)) return;
        if (!noticeAllowed(directId)) return;

        void playMessageTone();
        showInAppNotice({
          title: sender.name?.trim() || sender.username,
          body: typeof frame.message === "string" && frame.message.trim() ? frame.message : "Yeni mesaj",
          imageUrl: sender.imageUrl,
          fallbackText: sender.username,
          onPress: directId ? () => router.push(`/chat/direct/${directId}`) : undefined,
        });
      }),

      // Kanalda etiketlendin — kişisel odadan gelir, kanal açık olmasa da.
      onGatewayEvent(ServerEvent.MENTION, (frame) => {
        const channelId = typeof frame.channelId === "string" ? frame.channelId : null;
        const serverId = typeof frame.serverId === "string" ? frame.serverId : "";
        const senderName = typeof frame.senderName === "string" ? frame.senderName : "Biri";
        const channelName = typeof frame.channelName === "string" ? frame.channelName : null;
        const content = typeof frame.content === "string" ? frame.content : "";
        if (!channelId || !noticeAllowed(channelId)) return;

        void playMessageTone();
        showInAppNotice({
          title: senderName,
          body: `${channelName ? `#${channelName} kanalında` : "Bir kanalda"} seni etiketledi${content ? `: ${content}` : ""}`,
          imageUrl: typeof frame.senderImage === "string" ? frame.senderImage : null,
          fallbackText: senderName,
          onPress: () => router.push(`/chat/channel/${channelId}?serverId=${serverId}`),
        });
      }),

      // Grup kuruldu, eklendin, çıkarıldın — yeni mesaj olmadığı için
      // bildirim olayı bunu yakalamaz.
      onGatewayEvent(ServerEvent.DIRECTS_UPDATED, () => invalidate(qk.directs, qk.inbox)),
      onGatewayEvent(ServerEvent.CHANNEL_MESSAGE, () => invalidate(qk.unreadCounts)),
      onGatewayEvent(ServerEvent.SERVERS_REMOVED, () => invalidate(qk.memberships, qk.unreadCounts)),
      onGatewayEvent(ServerEvent.SERVER_DELETED, () => invalidate(qk.memberships, qk.unreadCounts)),

      // Kanal/kategori eklendi, silindi, taşındı: kanal listesi yeniden çekilir
      // (yük kanal verisi taşımıyor; özel kanallar kişiye göre süzülüyor).
      onGatewayEvent(ServerEvent.SERVER_CHANNELS_UPDATED, (frame) => {
        if (typeof frame.serverId !== "string") return;
        invalidate(qk.channels(frame.serverId), qk.server(frame.serverId));
      }),

      // Avatar/afiş/ad değişti — bir kez çekilen kaynaklar tazelenir (web:
      // realtime-provider `profile.updated`).
      onGatewayEvent(ServerEvent.PROFILE_UPDATED, (frame) => {
        const visual = frame.profile as { id?: unknown } | undefined;
        if (typeof visual?.id !== "string") return;
        invalidate(qk.directs, qk.friends, qk.profileCard(visual.id), ["members"]);
        if (visual.id === useAuth.getState().profile?.id) invalidate(qk.currentProfile);
      }),
    ];

    return () => releases.forEach((release) => release());
  }, [status, queryClient]);
}
