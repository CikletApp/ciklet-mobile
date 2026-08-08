import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

import {
  clearBadge,
  notifyMessage,
  registerPushToken,
  setupNotifications,
} from "@/lib/notifications";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
import { ServerEvent } from "./events";
import { getSocket } from "./socket";

/**
 * Gelen DM'ler için yerel bildirim.
 *
 * Yalnızca uygulama ARKA PLANDAYKEN bildirim gösterilir; ön plandayken
 * kullanıcı zaten listeyi görüyor ve bildirim yalnızca rahatsız eder.
 *
 * Not: uygulama tamamen kapalıyken soket de kapalıdır — o durum gerçek
 * push gerektirir (bkz. lib/notifications.ts'teki kapsam notu).
 */
interface NewMessagePayload {
  message?: { content?: string; directId?: string; id?: string };
  sender?: { username?: string; name?: string | null };
  isSpam?: boolean;
}

export function useMessageNotifications() {
  const status = useAuth((s) => s.status);
  const notificationsEnabled = usePreferences((s) => s.notificationsEnabled);
  const messageNotifications = usePreferences((s) => s.messageNotifications);
  const notificationSounds = usePreferences((s) => s.notificationSounds);
  const granted = useRef(false);

  // İzin + kanal kurulumu, oturum açıldığında bir kez.
  useEffect(() => {
    if (status !== "signedIn" || !notificationsEnabled) return;
    let cancelled = false;
    void setupNotifications().then((ok) => {
      if (cancelled) return;
      granted.current = ok;
      // İzin varsa push token'ını sunucuya bildir — uygulama tamamen
      // kapalıyken bildirim almanın tek yolu bu.
      if (ok) void registerPushToken();
    });
    return () => {
      cancelled = true;
    };
  }, [notificationsEnabled, status]);

  // Bildirime dokunulunca ilgili sohbete git.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url;
        if (typeof url === "string" && url.startsWith("/")) {
          router.push(url as never);
        }
      }
    );
    return () => subscription.remove();
  }, []);

  // Ön plana dönünce rozeti temizle.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void clearBadge();
    });
    return () => subscription.remove();
  }, []);

  // Soketten gelen yeni DM.
  useEffect(() => {
    if (status !== "signedIn") return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    void getSocket().then((socket) => {
      if (!socket || cancelled) return;

      const onNewMessage = (payload: NewMessagePayload) => {
        if (!granted.current || !notificationsEnabled || !messageNotifications) return;
        // Spam filtresinden geçen mesajlar bildirime dönüşmemeli.
        if (payload.isSpam) return;
        if (AppState.currentState === "active") return;

        const directId = payload.message?.directId;
        if (!directId) return;

        void notifyMessage({
          title: payload.sender?.name?.trim() || payload.sender?.username || "Yeni mesaj",
          body: payload.message?.content?.slice(0, 140) ?? "Sana bir mesaj gönderdi.",
          url: `/chat/direct/${directId}`,
          sound: notificationSounds,
        });
      };

      socket.on(ServerEvent.NEW_MESSAGE, onNewMessage);
      detach = () => socket.off(ServerEvent.NEW_MESSAGE, onNewMessage);
    });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [messageNotifications, notificationSounds, notificationsEnabled, status]);
}
