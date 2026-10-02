import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { usePreferences } from "@/stores/preferences";

import { brand } from "@/theme/tokens";

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

export const ANDROID_CHANNEL = "ciklet-messages";
/**
 * Arama kanalı v2: zil sesi + "zil" türünde ses özniteliği (sessiz profilde
 * de çalar). Android bir kanalın sesini OLUŞTURULDUKTAN SONRA değiştirmeye
 * izin vermiyor; eski "ciklet-calls" sessiz kurulmuştu ve telefon çalmıyordu.
 * Bu yüzden yeni kimlik. Sunucu push'u bu kanala göndermeli
 * (ciklet-web lib/push.ts channelId); eski kanal geçiş süresince korunur.
 */
export const ANDROID_CALL_CHANNEL = "ciklet-calls-v2";
const LEGACY_CALL_CHANNEL = "ciklet-calls";

/**
 * Mesaj bildirimi kategorisi — bildirimin üstünden "Yanıtla" (satır içi
 * metin) ve "Okundu" eylemleri (WhatsApp/Telegram). Sunucu push'u
 * `categoryId: "message"` taşımalı (ciklet-web lib/push.ts); taşımıyorsa
 * bildirim eylemsiz görünür, başka bir şey bozulmaz. Eylemler uygulamayı
 * öne getirmez; yanıt arka planda gönderilir (bkz. use-message-notifications).
 */
export const MESSAGE_CATEGORY = "message";
export const REPLY_ACTION = "reply";
export const MARK_READ_ACTION = "mark-read";

function getExpoProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * İzin ister ve Android bildirim kanalını kurar.
 * İzin reddedilirse sessizce `false` döner — bildirim, uygulamanın
 * çalışması için zorunlu değil.
 */
export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === "android") {
    /**
     * ⚠️ `lightColor` ANDROID'E GİDİYOR, React Native'e değil.
     *
     * Yerel taraf değeri `Color.parseColor` ile ayrıştırıyor ve o yalnızca
     * `#RRGGBB` / `#AARRGGBB` kabul ediyor. Tema paletindeki `colors.brand`
     * ise `hsl(74, 100%, 40%)` biçiminde bir DİZE — React Native'in kendi
     * stil motoru bunu anlıyor ama Android anlamıyor ve çağrı
     * `IllegalArgumentException: Unknown color` ile reddediliyordu.
     *
     * Sonuç, açılışta yakalanmayan bir promise reddi ve ekranın altını
     * kaplayan kırmızı hata şeridiydi. Marka sabiti (`brand.primary`)
     * zaten hex olduğu için doğru kaynak odur; tema paletinden okunan HSL
     * dizesi buraya hiç uygun değil.
     */
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: "Mesajlar",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: brand.primary,
    });
    await Notifications.setNotificationChannelAsync(LEGACY_CALL_CHANNEL, {
      name: "Aramalar (eski)",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: brand.primary,
    });
    await Notifications.setNotificationChannelAsync(ANDROID_CALL_CHANNEL, {
      name: "Aramalar",
      importance: Notifications.AndroidImportance.MAX,
      // assets/sounds/ringtone.wav — expo-notifications eklentisi res/raw'a kopyalar.
      sound: "ringtone.wav",
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      vibrationPattern: [0, 600, 400, 600, 400, 600, 400, 600],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: brand.primary,
    });
  }

  await Notifications.setNotificationCategoryAsync(MESSAGE_CATEGORY, [
    {
      identifier: REPLY_ACTION,
      buttonTitle: "Yanıtla",
      textInput: { submitButtonTitle: "Gönder", placeholder: "Mesaj yaz" },
      options: { opensAppToForeground: false },
    },
    {
      identifier: MARK_READ_ACTION,
      buttonTitle: "Okundu",
      options: { opensAppToForeground: false },
    },
  ]).then(
    (category) => {
      if (__DEV__) console.log("[bildirim] kategori kuruldu:", category.identifier, category.actions.map((a) => a.identifier));
    },
    (err: unknown) => {
      // Kategori kurulamazsa bildirimler eylemsiz gelir; uygulama etkilenmez.
      console.warn("[bildirim] kategori kurulamadı:", err instanceof Error ? err.message : err);
    }
  );

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
    const projectId = getExpoProjectId();
    if (!projectId) {
      console.warn("[bildirim] Expo project ID bulunamadı; push token kaydedilemedi");
      return;
    }

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
    // Bildirim kaydı uygulamanın ana akışını engellemez — ama SESSİZ de
    // kalmamalı: Firebase yapılandırması (google-services.json) eksikken
    // Android'de token hiç alınamıyordu ve bu hata yalnızca geliştirme
    // modunda görünüyordu; üretimde bildirimler iz bırakmadan gelmiyordu.
    // Release'te de logcat'e düşer (ReactNativeJS etiketi).
    console.warn("[bildirim] push kaydı yapılamadı:", err instanceof Error ? err.message : err);
  }
}

/** Çıkışta token'ı sunucudan düşür — sonraki kullanıcı bildirim almasın. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const projectId = getExpoProjectId();
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
