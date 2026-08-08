import { useEffect } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

import {
  clearBadge,
  registerPushToken,
  setupNotifications,
} from "@/lib/notifications";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";

/**
 * Push token kaydı, bildirime dokunma ve rozet yaşam döngüsü.
 * Mesajın kendisini sunucu yollar; soketten ayrı bir yerel bildirim
 * üretmek arka planda iki aynı bildirim oluştururdu.
 */
export function useMessageNotifications() {
  const status = useAuth((s) => s.status);
  const notificationsEnabled = usePreferences((s) => s.notificationsEnabled);

  // İzin + kanal kurulumu, oturum açıldığında bir kez.
  useEffect(() => {
    if (status !== "signedIn" || !notificationsEnabled) return;
    let cancelled = false;
    void setupNotifications().then((ok) => {
      if (cancelled) return;
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
    const openResponse = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        router.push(url as never);
      }
    };

    // Soğuk başlatmada dinleyici kurulmadan önce dokunulmuş olabilir.
    void Notifications.getLastNotificationResponseAsync().then(openResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener(
      openResponse
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

}
