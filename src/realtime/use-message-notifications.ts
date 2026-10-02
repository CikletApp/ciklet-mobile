import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";

import {
  clearBadge,
  registerPushToken,
  setupNotifications,
} from "@/lib/notifications";
import {
  handleDataPush,
  parsePushData,
  pushSeenKey,
  registerBackgroundNotificationTask,
  rememberSeen,
} from "@/lib/notification-task";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
import { handleNotificationResponse } from "./notification-response";

/**
 * Push token kaydı, bildirime dokunma ve rozet yaşam döngüsü.
 *
 * Android'de sunucu veri-only push atar; bildirimi lib/notification-task
 * çizer (uygulama kapalıyken de). iOS'ta sunucu başlık/gövdeli push atar,
 * sistem gösterir. Ön planda ikisi de buradaki dinleyiciye düşer.
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
      // kapalıyken bildirim almanın tek yolu bu — ve arka plan görevini kur.
      if (ok) {
        void registerPushToken();
        void registerBackgroundNotificationTask();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [notificationsEnabled, status]);

  // Bildirime dokunulunca ilgili sohbete git; "Yanıtla"/"Okundu" eylemleri
  // uygulamayı açmadan işlenir.
  useEffect(() => {
    const openResponse = (response: Notifications.NotificationResponse | null) => {
      void handleNotificationResponse(response);
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

  /**
   * Uygulama ÖN PLANDAYKEN gelen push: sistem bildirimi bastırılıyor
   * (handler), olay ağ geçidinden zaten geliyor. Ama soket kopuksa ya da
   * zombiyse push tek haberci — karar handleDataPush'ta (arama → bekleyen
   * davetler ve zil; mesaj → bağlantı yoksa uygulama içi kart). Aynı push
   * arka plan görevine de düşmüş olabilir; rememberSeen ikinciyi eler.
   */
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      if (AppState.currentState !== "active") return;
      const content = notification.request.content;
      const data = parsePushData(content.data) ?? parsePushData({ ...(content.data ?? {}), type: "message" });
      if (!data) return;
      if (!data.title && content.title) data.title = content.title;
      if (!data.body && content.body) data.body = content.body;
      if (!rememberSeen(pushSeenKey(data))) return;
      void handleDataPush(data);
    });
    return () => subscription.remove();
  }, []);
}
