import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { colors } from "@/theme/tokens";

/**
 * Bildirimler.
 *
 * ⚠️ KAPSAM: Bu modül YEREL bildirimleri kurar — uygulama açıkken/arka
 * plandayken soketten gelen olaylar için. GERÇEK PUSH (uygulama kapalıyken)
 * için ciklet-web'de iki şey gerekiyor ve İKİSİ DE YOK:
 *   1. Cihaz push token'ını kaydeden bir uç (ör. POST /api/push/register)
 *   2. Mesaj/çağrı olaylarında Expo Push API'sine gönderim yapan sunucu işi
 * Bu uçlar eklendiğinde `registerPushToken()` doldurulacak; şu hâliyle
 * token alınır ama gönderilecek bir yer olmadığı için saklanmaz.
 * Bkz. docs/ROADMAP.md.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const ANDROID_CHANNEL = "ciklet-messages";

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
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: options.title,
      body: options.body,
      data: { url: options.url },
      sound: true,
    },
    // null = hemen göster.
    trigger: null,
  });
}

export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0).catch(() => {});
}

/**
 * Push token kaydı — backend ucu eklenene kadar devre dışı.
 *
 * Uygulanacak hâli:
 *   const token = await Notifications.getExpoPushTokenAsync({ projectId });
 *   await api("/api/push/register", { method: "POST", body: { token, platform } });
 */
export async function registerPushToken(): Promise<void> {
  if (__DEV__) {
    console.info(
      "[bildirim] Push kaydı atlandı: ciklet-web'de token kayıt ucu yok."
    );
  }
}
