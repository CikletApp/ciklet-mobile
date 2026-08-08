import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { usePreferences } from "@/stores/preferences";

import { colors } from "@/theme/tokens";

/**
 * Bildirimler.
 *
 * Sunucu tarafı Expo Push Service'e mesaj ve arama olaylarını yollar.
 * Ön planda ikinci bir uyarı oluşmasın diye sistem bildirimi bastırılır;
 * arka planda ve kapalıyken işletim sistemi bildirimi gösterir.
 */

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const preferences = usePreferences.getState();
    const kind = notification.request.content.data?.type;
    const enabled =
      preferences.notificationsEnabled &&
      (kind === "call"
        ? preferences.callNotifications
        : kind === "friend"
          ? preferences.friendNotifications
          : preferences.messageNotifications);
    const visible = enabled && AppState.currentState !== "active";
    return {
      shouldPlaySound: visible && preferences.notificationSounds,
      shouldSetBadge: visible,
      shouldShowBanner: visible,
      shouldShowList: visible,
    };
  },
});

const ANDROID_CHANNEL = "ciklet-messages";
const ANDROID_CALL_CHANNEL = "ciklet-calls";

/**
 * İzin ister ve Android bildirim kanalını kurar.
 * İzin reddedilirse sessizce `false` döner — bildirim, uygulamanın
 * çalışması için zorunlu değil.
 */
export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: "Mesajlar",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: colors.brand,
    });
    await Notifications.setNotificationChannelAsync(ANDROID_CALL_CHANNEL, {
      name: "Aramalar",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: colors.brand,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  // Kullanıcı daha önce kalıcı olarak reddettiyse tekrar sormak sistem
  // tarafından yok sayılır; boşuna çağırma.
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Yerel bildirim — uygulama arka plandayken gelen DM için.
 * `data.url` derin bağlantıdır; kullanıcı dokununca ilgili sohbet açılır.
 */
export async function notifyMessage(options: {
  title: string;
  body: string;
  url: string;
  sound?: boolean;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: options.title,
      body: options.body,
      data: { url: options.url },
      sound: options.sound === false ? undefined : true,
    },
    // null = hemen göster.
    trigger: null,
  });
}

export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0).catch(() => {});
}

/**
 * Expo push token'ını alıp sunucuya kaydeder.
 *
 * Uygulama TAMAMEN KAPALIYKEN gelen arama/mesaj bildirimi yalnızca bu
 * kayıtla mümkün; soket süreçle birlikte ölüyor.
 *
 */
export async function registerPushToken(): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (!token) return;

    const preferences = usePreferences.getState();
    await api(endpoints.pushRegister, {
      method: "POST",
      body: {
        token,
        platform: Platform.OS,
        messagesEnabled: preferences.messageNotifications,
        callsEnabled: preferences.callNotifications,
        friendRequestsEnabled: preferences.friendNotifications,
        soundEnabled: preferences.notificationSounds,
      },
    });
  } catch (err) {
    // Bildirim kaydı uygulamanın ana akışını engellemez.
    if (__DEV__) console.info("[bildirim] push kaydı yapılamadı:", err);
  }
}

/** Çıkışta token'ı sunucudan düşür — sonraki kullanıcı bildirim almasın. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (!token) return;
    await api(endpoints.pushRegister, { method: "DELETE", body: { token } });
  } catch {
    /* Çıkış, ağ kesintisinde de tamamlanabilmeli. */
  }
}
