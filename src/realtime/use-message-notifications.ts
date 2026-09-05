import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

import {
  CALL_ACTION_ACCEPT,
  CALL_ACTION_DECLINE,
  clearBadge,
  readNotificationResponse,
  registerPushToken,
  setupNotifications,
} from "@/lib/notifications";
import { useCallActions } from "@/realtime/use-call-events";
import { useAuth } from "@/stores/auth";
import { useCall } from "@/stores/call";
import { usePreferences } from "@/stores/preferences";

/**
 * Push token kaydı, bildirime dokunma ve rozet yaşam döngüsü.
 *
 * Mesajın kendisini sunucu yollar; soketten ayrı bir yerel bildirim üretmek
 * arka planda iki aynı bildirim oluştururdu.
 */
export function useMessageNotifications() {
  const status = useAuth((s) => s.status);
  const notificationsEnabled = usePreferences((s) => s.notificationsEnabled);
  const { acceptCall, declineCall } = useCallActions();

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

  /**
   * Tercihler değiştiğinde sunucudaki cihaz kaydı da güncellenmeli.
   *
   * Sunucu gönderimden ÖNCE bu bayrakları süzüyor. İstemcinin gelen
   * bildirimi bastırması yetmez: uygulama kapalıyken bastıracak kod
   * çalışmıyor, bildirim yine de düşüyordu. "Arama bildirimlerini kapat"
   * dedikten sonra telefonun çalması tam olarak buydu.
   */
  const messageNotifications = usePreferences((s) => s.messageNotifications);
  const callNotifications = usePreferences((s) => s.callNotifications);
  const friendNotifications = usePreferences((s) => s.friendNotifications);
  const notificationSounds = usePreferences((s) => s.notificationSounds);
  const firstPreferenceSync = useRef(true);

  useEffect(() => {
    if (status !== "signedIn" || !notificationsEnabled) return;
    // İlk çalıştırma yukarıdaki kurulum akışıyla çakışırdı; yalnızca
    // sonraki değişikliklerde yeniden kaydet.
    if (firstPreferenceSync.current) {
      firstPreferenceSync.current = false;
      return;
    }
    void registerPushToken();
  }, [
    status,
    notificationsEnabled,
    messageNotifications,
    callNotifications,
    friendNotifications,
    notificationSounds,
  ]);

  // Bildirime dokunulunca ilgili yere git; arama düğmelerini de burada işle.
  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse | null) => {
      const parsed = readNotificationResponse(response);
      if (!parsed) return;

      if (parsed.data.type === "call") {
        /*
          Bildirimdeki "Kabul et" / "Reddet" düğmeleri.

          Davet nesnesi henüz elde olmayabilir: uygulama kapalıydı, soket
          yeni kuruluyor ve `pending_call_invites` daha gelmedi. Bu yüzden
          niyet KAYDEDİLİYOR; çağrı oturumu gelir gelmez uygulanıyor
          (bkz. `usePendingCallIntent` aşağıda). Aksi halde düğmeye basmak
          hiçbir şey yapmaz ve karşı taraf çalmaya devam ederdi.
        */
        if (parsed.actionIdentifier === CALL_ACTION_ACCEPT) {
          useCall.getState().setPendingIntent("accept");
        } else if (parsed.actionIdentifier === CALL_ACTION_DECLINE) {
          useCall.getState().setPendingIntent("decline");
        }
      }

      if (parsed.route) router.push(parsed.route as never);
    };

    // Soğuk başlatmada dinleyici kurulmadan önce dokunulmuş olabilir.
    void Notifications.getLastNotificationResponseAsync().then(handle);
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, []);

  usePendingCallIntent(acceptCall, declineCall);

  // Ön plana dönünce rozeti temizle.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void clearBadge();
    });
    return () => subscription.remove();
  }, []);
}

/**
 * Bildirimden gelen "kabul et / reddet" niyetini, çağrı oturumu geldiğinde
 * uygular.
 *
 * Bildirime dokunmakla soketin bağlanıp daveti getirmesi arasında bir
 * boşluk var (soğuk başlatmada saniyeler). Niyeti orada tutup burada
 * tüketmek, o boşlukta basılan düğmenin kaybolmasını önler.
 */
function usePendingCallIntent(
  acceptCall: (directId: string | null) => Promise<void>,
  declineCall: () => Promise<void>
) {
  const session = useCall((s) => s.session);
  const pendingIntent = useCall((s) => s.pendingIntent);
  const clearPendingIntent = useCall((s) => s.clearPendingIntent);

  useEffect(() => {
    if (!pendingIntent || !session || session.status !== "ringing") return;
    clearPendingIntent();
    if (pendingIntent === "accept") {
      void acceptCall(session.directId);
    } else {
      void declineCall();
    }
  }, [pendingIntent, session, clearPendingIntent, acceptCall, declineCall]);
}
