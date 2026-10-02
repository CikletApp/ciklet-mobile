import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { showToast } from "@/components/ui";
import { ANDROID_CHANNEL, MARK_READ_ACTION, MESSAGE_CATEGORY, REPLY_ACTION } from "@/lib/notifications";
import { brand } from "@/theme/tokens";
import type { ChatMessagePayload } from "./events";

/**
 * Bildirim yanıtları — hem çalışan uygulamadan (use-message-notifications)
 * hem de arka plan görevinden (lib/notification-task) çağrılır; Android'de
 * uygulama kapalıyken verilen "Yanıtla"/"Okundu" ikincisinden gelir.
 */

const HANDLED_RESPONSE_KEY = "ciklet.notifications.lastHandledResponse";

/**
 * Bildirim yanıtı: varsayılan dokunuş sohbete gider; "Yanıtla" metni
 * sohbete gönderir, "Okundu" imleci ilerletir; ikisi de bildirimi düşürür.
 *
 * Aynı yanıt iki kez işlenmesin: dinleyici, arka plan görevi ve soğuk
 * başlatmadaki `getLastNotificationResponseAsync` AYNI yanıtı verebilir ve
 * uygulama her açılışta son yanıtı yeniden görür — eylemli yanıtların
 * anahtarı kalıcı saklanır.
 */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse | null
): Promise<void> {
  if (!response) return;
  const request = response.notification.request;
  const data = notificationData(request.content);
  const action = response.actionIdentifier;
  if (__DEV__) {
    console.log("[bildirim] yanıt yükü:", JSON.stringify(response).slice(0, 700));
  }

  if (action !== REPLY_ACTION && action !== MARK_READ_ACTION) {
    // Arka plan görevinde (süreç ölü) yönlendirme anlamsız; uygulama açılınca
    // aynı yanıt `getLastNotificationResponseAsync` ile tekrar gelir.
    if (AppState.currentState !== "active") return;
    const target = routeForNotification(data);
    if (target) router.push(target as never);
    return;
  }

  if (__DEV__) console.log("[bildirim] eylem:", action, request.identifier, response.userText ? "metin var" : "metin yok");
  const key = `${request.identifier}:${action}:${response.userText ?? ""}`;
  const last = await AsyncStorage.getItem(HANDLED_RESPONSE_KEY).catch(() => null);
  if (last === key) return;
  await AsyncStorage.setItem(HANDLED_RESPONSE_KEY, key).catch(() => {});

  // Arka plan görevine gelen yanıtta içerik verisi eksik olabiliyor; mesaj
  // bildirimlerinin kimliği `message:<directId>` biçiminde, oradan türetilir.
  const directId =
    typeof data.directId === "string" && data.directId
      ? data.directId
      : request.identifier.startsWith("message:")
        ? request.identifier.slice("message:".length)
        : "";
  if (!directId) return;

  if (action === REPLY_ACTION) {
    const text = response.userText?.trim();
    if (!text) return;
    try {
      await api(endpoints.sendDirectMessage(directId), { method: "POST", body: { content: text } });
      // Android 15: doğrudan yanıt bekleyen bildirim, uygulama GÜNCELLEYENE
      // kadar sistem tarafından tutulur (LIFETIME_EXTENDED_BY_DIRECT_REPLY);
      // yalnızca cancel çağrısı ertelenir ve dönen simge dönmeye devam eder.
      // WhatsApp gibi: bildirim yanıtla güncellenir, sohbet akışı sürer.
      if (Platform.OS === "android") {
        await repostMessageNotification(request, data, `Sen: ${text}`);
      } else {
        await Notifications.dismissNotificationAsync(request.identifier).catch(() => {});
      }
      if (AppState.currentState === "active") showToast("Yanıt gönderildi");
    } catch (err) {
      // Arka planda toast yok; logcat tek iz (uygulama kapalıyken headless).
      console.warn("[bildirim] yanıt gönderilemedi:", err instanceof Error ? err.message : err);
      if (AppState.currentState === "active") {
        showToast("Yanıt gönderilemedi; uygulamadan tekrar dene.", "error");
      }
    }
    return;
  }

  // Okundu: imleç en yeni mesaja çekilir (ack mesaj kimliği ister).
  try {
    const page = await api<MessagesPage<ChatMessagePayload>>(endpoints.directMessages(directId));
    const newest = page.items[0];
    if (newest) {
      await api(endpoints.readStateAck, { method: "POST", body: { directId, messageId: newest.id } });
    }
    // Yanıt akışı bildirimi zaten güncellediği için (yukarı) burada düşürmek
    // yeter; önce yeniden yayınlayıp sonra iptal etmek yarışıyor ve bildirim
    // eylemsiz hâliyle geri geliyordu.
    await Notifications.dismissNotificationAsync(request.identifier).catch(() => {});
  } catch (err) {
    // Ağ yok ya da oturum yok; bildirim sistemde kalır, kullanıcı uygulamadan okur.
    console.warn("[bildirim] okundu işaretlenemedi:", err instanceof Error ? err.message : err);
  }
}

/** Aynı kimlikle sessizce yeniden yayınla (eylemler korunur). */
async function repostMessageNotification(
  request: Notifications.NotificationRequest,
  data: Record<string, unknown>,
  body: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: request.identifier,
    content: {
      title: request.content.title ?? "Ciklet",
      body,
      data,
      categoryIdentifier: MESSAGE_CATEGORY,
      sound: false,
      color: brand.primary,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: { channelId: ANDROID_CHANNEL },
  }).catch(() => {});
}

/**
 * Bildirim verisi — çalışan uygulamada nesne; arka plan görevine (süreç ölü)
 * gelen yanıtta JSON dizesi (`dataString`) olarak da gelebilir. İkisini de çöz.
 */
function notificationData(content: Notifications.NotificationContent): Record<string, unknown> {
  const raw = content.data as unknown;
  const parse = (text: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(text) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  if (typeof raw === "string") return parse(raw) ?? {};
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (typeof record.dataString === "string") return { ...record, ...(parse(record.dataString) ?? {}) };
    if (typeof record.body === "string" && record.body.trimStart().startsWith("{")) {
      return { ...record, ...(parse(record.body) ?? {}) };
    }
    return record;
  }
  return {};
}

/**
 * Bildirim verisinden açılacak mobil ekran.
 *
 * Sunucunun push'ları WEB adresi taşıyor (`/direct/<profil>`,
 * `/direct/group/<id>`); mobilde bu yollar yok ve dokunmak "sayfa
 * bulunamadı"ya düşüyordu. Her mesaj ve arama push'u `directId` de
 * taşıdığından önce o kullanılır. Arkadaşlık bildirimleri arkadaşlar
 * ekranına gider. Yerel bildirimler zaten mobil yol taşır.
 */
export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const type = typeof data.type === "string" ? data.type.toUpperCase() : "";
  const directId = typeof data.directId === "string" ? data.directId : "";
  if (directId) return `/chat/direct/${encodeURIComponent(directId)}`;
  // Kanalda etiketlenme push'u (sözleşme: type "mention" + channelId + serverId)
  // doğrudan kanala gider.
  const channelId = typeof data.channelId === "string" ? data.channelId : "";
  if (type === "MENTION" && channelId) {
    const serverId = typeof data.serverId === "string" ? data.serverId : "";
    return `/chat/channel/${encodeURIComponent(channelId)}?serverId=${encodeURIComponent(serverId)}`;
  }
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
