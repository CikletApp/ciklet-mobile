import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { showToast } from "@/components/ui";
import { MARK_READ_ACTION, REPLY_ACTION } from "@/lib/notifications";
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
  const data = (request.content.data ?? {}) as Record<string, unknown>;
  const action = response.actionIdentifier;

  if (action !== REPLY_ACTION && action !== MARK_READ_ACTION) {
    // Arka plan görevinde (süreç ölü) yönlendirme anlamsız; uygulama açılınca
    // aynı yanıt `getLastNotificationResponseAsync` ile tekrar gelir.
    if (AppState.currentState !== "active") return;
    const target = routeForNotification(data);
    if (target) router.push(target as never);
    return;
  }

  const key = `${request.identifier}:${action}:${response.userText ?? ""}`;
  const last = await AsyncStorage.getItem(HANDLED_RESPONSE_KEY).catch(() => null);
  if (last === key) return;
  await AsyncStorage.setItem(HANDLED_RESPONSE_KEY, key).catch(() => {});

  const directId = typeof data.directId === "string" ? data.directId : "";
  if (!directId) return;

  if (action === REPLY_ACTION) {
    const text = response.userText?.trim();
    if (!text) return;
    try {
      await api(endpoints.sendDirectMessage(directId), { method: "POST", body: { content: text } });
      await Notifications.dismissNotificationAsync(request.identifier).catch(() => {});
      if (AppState.currentState === "active") showToast("Yanıt gönderildi");
    } catch {
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
    await Notifications.dismissNotificationAsync(request.identifier).catch(() => {});
  } catch {
    /* Ağ yok; bildirim sistemde kalır, kullanıcı uygulamadan okur. */
  }
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
