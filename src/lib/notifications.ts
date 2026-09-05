import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import {
  parsePushData,
  PUSH_CHANNEL_CALLS,
  PUSH_CHANNEL_MESSAGES,
  type PushData,
} from "@ciklet/embedded-activities-sdk/types";

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

/**
 * Arama bildirimindeki eylem düğmeleri.
 *
 * Sunucu, arama push'una `categoryId: "ciklet.call"` koyuyor (ciklet-web
 * lib/push.ts). Bu kategori kaydedilmezse bildirim düz bir satır olarak
 * görünür ve kullanıcı aramayı yanıtlamak için önce uygulamayı açmak
 * zorunda kalır — telefonun kendi arama ekranından beklenen davranış bu
 * değil.
 */
export const CALL_CATEGORY_ID = "ciklet.call";
/**
 * Arama bildiriminin sesi. Ad, Android kaynak adı kurallarına uyacak
 * biçimde seçildi (küçük harf, tire yok) — eklenti dosyayı `res/raw`
 * altına bu adla kopyalıyor ve geçersiz bir ad derlemeyi kırar.
 */
export const CALL_RINGTONE_FILE = "ciklet_call_ring.wav";
export const CALL_ACTION_ACCEPT = "ciklet.call.accept";
export const CALL_ACTION_DECLINE = "ciklet.call.decline";

/**
 * İzin ister, Android kanallarını ve arama kategorisini kurar.
 * İzin reddedilirse sessizce `false` döner — bildirim, uygulamanın
 * çalışması için zorunlu değil.
 */
export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_MESSAGES, {
      name: "Mesajlar",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: colors.brand,
    });
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_CALLS, {
      name: "Aramalar",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: colors.brand,
      // Uygulama kapalıyken çalan ses. Dosya `expo-notifications`
      // eklentisinin `sounds` dizisiyle pakete giriyor (bkz. app.json) ve
      // sunucu arama push'unda aynı adı gönderiyor. Dosya bulunamazsa her
      // iki platform da varsayılan bildirim sesine düşer — yani en kötü
      // ihtimalde eski davranış.
      sound: CALL_RINGTONE_FILE,
      // Zil sesi kanalı: Android bu ipucuyla bildirimi MEDYA değil ZİL
      // ses akışına yönlendirir, sessiz modda ve "rahatsız etmeyin"
      // ayarlarında telefon uygulamalarıyla aynı davranır. Varsayılan
      // (bildirim) akışında arama uyarısı bir mesaj bildirimi kadar
      // sessiz kalıyordu.
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      // Kilit ekranında arayanın adı görünmeli; aramayı görmeden
      // yanıtlamak mümkün değil.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }

  await Notifications.setNotificationCategoryAsync(CALL_CATEGORY_ID, [
    {
      identifier: CALL_ACTION_ACCEPT,
      buttonTitle: "Kabul et",
      // Kabul etmek uygulamayı öne getirmek ZORUNDA: LiveKit odasına
      // bağlanmak ve mikrofonu açmak arka planda yapılamaz.
      options: { opensAppToForeground: true },
    },
    {
      identifier: CALL_ACTION_DECLINE,
      buttonTitle: "Reddet",
      options: { isDestructive: true, opensAppToForeground: true },
    },
  ]).catch(() => {
    /* Kategori kaydı başarısızsa bildirim düz haliyle yine gösterilir. */
  });

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  // Kullanıcı daha önce kalıcı olarak reddettiyse tekrar sormak sistem
  // tarafından yok sayılır; boşuna çağırma.
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Bildirim yükünden açılacak mobil rotayı üretir.
 *
 * Sunucudan gelen `url` doğrudan yönlendiriciye VERİLMEZ: yük ağdan gelir ve
 * eski bir sunucu sürümü web'in rota şemasını göndermiş olabilir
 * (`/direct/<profileId>` gibi — mobilde böyle bir rota yok ve dokunan
 * kullanıcı boş ekrana düşer). Rota, güvendiğimiz alanlardan burada
 * kuruluyor; `url` yalnızca tanıdığımız bir yol olduğunda kullanılıyor.
 */
export function routeForPush(data: PushData): string | null {
  switch (data.type) {
    case "message":
      return `/chat/direct/${data.directId}`;
    case "call":
      // Arama bildirimine dokunmak sohbeti açar; davet hâlâ çalıyorsa
      // çağrı katmanı zaten üstte belirir (bkz. use-call-events,
      // `pending_call_invites`). Cevapsız kalmışsa kullanıcı doğru yerde
      // olur: konuşmanın kendisinde.
      return data.directId ? `/chat/direct/${data.directId}` : null;
    case "friend":
      return "/friends";
  }
}

/** Bir bildirim yanıtından güvenli rota + yük çıkarır. */
export function readNotificationResponse(
  response: Notifications.NotificationResponse | null
): { data: PushData; route: string | null; actionIdentifier: string } | null {
  if (!response) return null;
  const data = parsePushData(response.notification.request.content.data);
  if (!data) return null;
  return {
    data,
    route: routeForPush(data),
    actionIdentifier: response.actionIdentifier,
  };
}

/**
 * Ekranda duran arama bildirimlerini kaldırır.
 *
 * Çağrı bittiğinde (kabul, ret, iptal, zaman aşımı) bildirim kendiliğinden
 * kapanmaz. Bunu yapmazsak kullanıcı, bitmiş bir aramanın bildirimine saatler
 * sonra dokunup çalmayan bir "gelen arama" ekranı görüyor.
 */
export async function dismissCallNotifications(): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((item) => item.request.content.data?.type === "call")
        .map((item) => Notifications.dismissNotificationAsync(item.request.identifier))
    );
  } catch {
    /* Bildirimleri listeleyememek çağrı akışını durdurmamalı. */
  }
}

export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0).catch(() => {});
}

/**
 * Expo push token'ını alıp sunucuya kaydeder.
 *
 * Uygulama TAMAMEN KAPALIYKEN gelen arama/mesaj bildirimi yalnızca bu
 * kayıtla mümkün; soket süreçle birlikte ölüyor.
 */
export async function registerPushToken(): Promise<void> {
  try {
    const token = await getPushToken();
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
    const token = await getPushToken();
    if (!token) return;
    await api(endpoints.pushRegister, { method: "DELETE", body: { token } });
  } catch {
    /* Çıkış, ağ kesintisinde de tamamlanabilmeli. */
  }
}

async function getPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data || null;
}
