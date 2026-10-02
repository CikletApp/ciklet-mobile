import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState, Platform, Vibration } from "react-native";

import { showInAppNotice } from "@/components/in-app-notice";
import { dismissIncomingCallNotification } from "@/features/call/incoming-call";
import { ANDROID_CHANNEL, MESSAGE_CATEGORY } from "@/lib/notifications";
import { playMessageTone, stopRingtone } from "@/lib/sounds";
import { getConnectionState } from "@/realtime/gateway";
import { handleNotificationResponse } from "@/realtime/notification-response";
import { ring } from "@/realtime/use-call-events";
import { activeChatId } from "@/stores/active-chat";
import { useCall } from "@/stores/call";
import { usePreferences } from "@/stores/preferences";
import { brand } from "@/theme/tokens";

/**
 * Arka plan bildirim görevi (Android).
 *
 * NEDEN: Android'de başlık/gövde taşıyan push'u Firebase SDK kendisi çizer
 * ve expo-notifications'ın kategori eylemleri (Yanıtla/Okundu) ona
 * EKLENEMEZ; tam ekran gelen arama da mümkün değildir. Sunucu bu yüzden
 * Android cihazlara VERİ-ONLY push atar (ciklet-web lib/push.ts); veri-only
 * push uygulama ön planda, arka planda ve KAPALIYKEN bu görevi çalıştırır,
 * bildirimi uygulama çizer:
 *  - mesaj  → kategorili yerel bildirim (satır içi Yanıtla + Okundu),
 *  - arama  → yerel modül: tam ekran zil + Cevapla/Reddet (features/call),
 *  - arama bitti → zil bildirimini düşür,
 *  - etiketlenme / diğer → düz bildirim, dokununca ilgili ekran.
 * Bildirim eylemleri de uygulama arka plandayken/kapalıyken aynı göreve
 * düşer (`actionIdentifier` taşıyan yük) ve notification-response işler.
 *
 * `defineTask` MODÜL KAPSAMINDA olmalı: süreç ölüyken Expo yalnızca JS
 * paketini yükleyip görevi çağırır, React ağacı kurulmaz ve expo-router rota
 * dosyalarını (_layout dahil) hiç yüklemez. Bu dosya bu yüzden paket GİRİŞ
 * dosyasında (index.js) içe aktarılır.
 */

export const BACKGROUND_NOTIFICATION_TASK = "ciklet-background-notification";

/** Sunucu push'unun `data` alanı (hepsi string). Bkz. ciklet-web lib/push.ts. */
export interface PushData {
  type: string;
  title?: string;
  body?: string;
  directId?: string;
  messageId?: string;
  senderName?: string;
  channelId?: string;
  serverId?: string;
  url?: string;
  callId?: string;
  callerId?: string;
  callerName?: string;
  callerAvatar?: string;
  callType?: string;
  expiresAt?: string;
  declineUrl?: string;
  reason?: string;
}

/**
 * FCM veri yükünü çözer. Expo Push, bizim `data`'mızı FCM'in `body`
 * anahtarına JSON dizesi olarak koyar; expo-notifications bunu `dataString`
 * olarak da verir. Ön plan dinleyicisinde ise `content.data` zaten nesnedir.
 */
export function parsePushData(raw: unknown): PushData | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  for (const candidate of [record.dataString, record.body]) {
    if (typeof candidate === "string" && candidate.trimStart().startsWith("{")) {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        const normalized = normalize(parsed);
        if (normalized) return normalized;
      } catch {
        /* JSON değil; düz alanlara bak */
      }
    }
  }
  return normalize(record);
}

function normalize(value: unknown): PushData | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.type !== "string" || !record.type) return null;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string") out[key] = entry;
    else if (typeof entry === "number" || typeof entry === "boolean") out[key] = String(entry);
  }
  return out as unknown as PushData;
}

/** Push'un tekrarını (görev + ön plan dinleyicisi) ayıklamak için anahtar. */
export function pushSeenKey(data: PushData | null): string | null {
  if (!data) return null;
  const type = data.type.toLowerCase();
  if (type === "call" && data.callId) return `call:${data.callId}`;
  if (type === "message" && data.directId) {
    return `message:${data.directId}:${data.messageId ?? data.body ?? ""}`;
  }
  return null;
}

const seen = new Map<string, number>();
const SEEN_TTL_MS = 5 * 60_000;

/** İlk görüşte `true`; aynı anahtar 5 dk içinde yeniden gelirse `false`. */
export function rememberSeen(key: string | null): boolean {
  if (!key) return true;
  const now = Date.now();
  for (const [k, at] of seen) if (now - at > SEEN_TTL_MS) seen.delete(k);
  if (seen.has(key)) return false;
  seen.set(key, now);
  return true;
}

async function loadPreferences() {
  const state = usePreferences.getState();
  if (!state.hydrated) await state.hydrate();
  return usePreferences.getState();
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  BACKGROUND_NOTIFICATION_TASK,
  async ({ data, error }) => {
    if (error || !data) return;
    try {
      if ("actionIdentifier" in data) {
        await handleNotificationResponse(data);
        return;
      }
      const payload = parsePushData(data.data);
      if (payload) await handleDataPush(payload);
    } catch (err) {
      console.warn("[bildirim] arka plan görevi:", err instanceof Error ? err.message : err);
    }
  }
);

/** Oturum açılıp izin alındıktan sonra bir kez (yeniden kayıt zararsız). */
export async function registerBackgroundNotificationTask(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (err) {
    console.warn("[bildirim] arka plan görevi kaydedilemedi:", err instanceof Error ? err.message : err);
  }
}

export async function handleDataPush(data: PushData): Promise<void> {
  const type = data.type.toLowerCase();
  const active = AppState.currentState === "active";

  if (type === "call.ended" || type === "call_ended") {
    dismissIncomingCallNotification(data.callId);
    const session = useCall.getState().session;
    if (session && data.callId && session.callId === data.callId && session.status === "ringing") {
      Vibration.cancel();
      stopRingtone();
      useCall.getState().end();
    }
    return;
  }

  if (!rememberSeen(pushSeenKey(data))) return;
  const prefs = await loadPreferences();
  if (!prefs.notificationsEnabled) return;

  if (type === "call") {
    if (!prefs.callNotifications || !data.callId) return;
    ring({
      callId: data.callId,
      caller: {
        id: data.callerId ?? "",
        username: data.callerName ?? "",
        name: data.callerName ?? null,
        imageUrl: data.callerAvatar ?? null,
      },
      type: data.callType,
      expiresAt: data.expiresAt ? Number(data.expiresAt) || undefined : undefined,
      directChannelId: data.directId || null,
      declineUrl: data.declineUrl ?? null,
    });
    return;
  }

  if (type === "message") {
    if (!prefs.messageNotifications || !data.directId) return;
    if (active) {
      // Bağlıyken ağ geçidi olayı kartı gösteriyor; sohbet açıksa hiç gerekmez.
      if (getConnectionState() === "connected" || activeChatId() === data.directId) return;
      const directId = data.directId;
      if (prefs.notificationSounds) void playMessageTone();
      showInAppNotice({
        title: data.title ?? "Yeni mesaj",
        body: data.body ?? "",
        icon: "message",
        onPress: () => router.push(`/chat/direct/${directId}`),
      });
      return;
    }
    await Notifications.scheduleNotificationAsync({
      // Sohbet başına tek bildirim: yeni mesaj öncekini günceller (WhatsApp).
      identifier: `message:${data.directId}`,
      content: {
        title: data.title ?? "Yeni mesaj",
        body: data.body ?? "",
        data: { ...data, type: "message" },
        categoryIdentifier: MESSAGE_CATEGORY,
        sound: prefs.notificationSounds ? "default" : undefined,
        color: brand.primary,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 180, 100, 180],
      },
      trigger: { channelId: ANDROID_CHANNEL },
    });
    return;
  }

  // Etiketlenme, arkadaşlık ve diğerleri: düz bildirim, dokununca ilgili ekran.
  if (active) return;
  if (!data.title && !data.body) return;
  await Notifications.scheduleNotificationAsync({
    identifier: data.messageId ? `${type}:${data.messageId}` : undefined,
    content: {
      title: data.title ?? "Ciklet",
      body: data.body ?? "",
      data: { ...data },
      sound: prefs.notificationSounds ? "default" : undefined,
      color: brand.primary,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: { channelId: ANDROID_CHANNEL },
  });
}
