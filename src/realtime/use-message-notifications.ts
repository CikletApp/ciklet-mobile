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
      const target = routeForNotification(response?.notification.request.content.data);
      if (target) router.push(target as never);
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

/**
 * Bildirim verisinden açılacak mobil ekran.
 *
 * Sunucunun push'ları WEB adresi taşıyor (`/direct/<profil>`,
 * `/direct/group/<id>`); mobilde bu yollar yok ve dokunmak "sayfa
 * bulunamadı"ya düşüyordu. Her mesaj ve arama push'u `directId` de
 * taşıdığından önce o kullanılır. Arkadaşlık bildirimleri arkadaşlar
 * ekranına gider. Yerel bildirimler (`notifyMessage`) zaten mobil yol taşır.
 */
function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const directId = typeof data.directId === "string" ? data.directId : "";
  if (directId) return `/chat/direct/${encodeURIComponent(directId)}`;
  const type = typeof data.type === "string" ? data.type.toUpperCase() : "";
  // Arkadaşlık push'ları (ciklet-web-a5, ac34827): istek satırda kabul/ret
  // edilebildiği için Bildirimler sekmesine, kabul Arkadaşlar'a gider.
  if (type === "FRIEND_REQUEST") return "/notifications";
  if (type === "FRIEND_ACCEPTED") return "/friends";
  const url = typeof data.url === "string" ? data.url : "";
  const group = /^\/direct\/group\/([^/?#]+)/.exec(url);
  if (group) return `/chat/direct/${group[1]}`;
  // Bilinen mobil yollar olduğu gibi; web'e özgü diğerleri açılmaz.
  if (/^\/(chat|friends|notifications|servers|profile|settings)(\/|$)/.test(url)) return url;
  return null;
}
