import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { queryClient } from "@/api/query-client";
import { qk } from "@/api/query-keys";
import type { ActivitySummary } from "@/api/types";
import type { MessageCache } from "@/features/chat/reaction-cache";
import type { ChatMessagePayload } from "@/realtime/events";
import { useActivitySession, type ActivityDescriptor } from "@/stores/activity";

/**
 * Aktivite başlatma / katılma — web `chat-page` `activity:start` akışı.
 *
 * Başlatma sohbete bir ACTIVITY_INVITE mesajı ("Etkinlik Daveti" kartı)
 * yazar: web istemcisi bunu mesaj gönderim ucuna (`/api/socket/messages`,
 * `/api/socket/direct-messages`) `messageType: "ACTIVITY_INVITE"` ile
 * POST'luyor. Kart yazıldıktan SONRA oturum açılır (WebView → ağ geçidi
 * `activity.create`); ağ geçidi "başladı" deyince sunucu sohbetteki son davet
 * kartını sayaca çevirir (`ad|TS:<başlangıç>`), aktivite bitince "sona erdi"
 * metnine döndürür (web lib/activity/lifecycle). Sıra önemli: kart oturumdan
 * sonra yazılırsa sunucu güncelleyecek kart bulamaz.
 *
 * Sohbette ZATEN süren bir oturum varsa yeni kart basılmaz, ona katılınır:
 * istemci odayı biliyorsa hızlı yoldan, bilmiyorsa sunucunun 409
 * `activity_already_active` yanıtından.
 */

export interface ActivityChatContext {
  chatId?: string | null;
  /** Kanal sohbetlerinde zorunlu (gönderim ucu sunucu kimliği ister). */
  serverId?: string | null;
}

/** Çift tetiklenme koruması (web: 3 sn pencere). */
let lastStart: { url: string; at: number } | null = null;

export function toDescriptor(activity: ActivitySummary | ActivityDescriptor): ActivityDescriptor {
  return {
    id: activity.id,
    name: activity.name,
    url: activity.url,
    icon: activity.icon,
    color: "color" in activity ? activity.color : undefined,
    description: activity.description,
  };
}

function chatTypeOf(context: ActivityChatContext): "channel" | "direct" | null {
  if (!context.chatId) return null;
  return context.serverId ? "channel" : "direct";
}

/** Gönderim yanıtındaki mesajı listeye hemen yaz (canlı yayın da düşürür). */
function writeCreated(chatId: string, message: ChatMessagePayload) {
  queryClient.setQueryData<MessageCache>(qk.messages.chat(chatId), (old) => {
    if (!old?.pages?.length) return old;
    if (old.pages.some((page) => page.items.some((item) => item.id === message.id))) return old;
    const [newest, ...rest] = old.pages;
    return { ...old, pages: [{ ...newest, items: [message, ...newest.items] }, ...rest] };
  });
}

/** Mevcut oturuma katıl — kart basılmaz (web `joinActivity`). */
export function joinActivity(activity: ActivityDescriptor, context: ActivityChatContext): void {
  const store = useActivitySession.getState();
  const current = store.session;
  if (current && current.chatId === (context.chatId || null) && current.activity.url === activity.url) {
    store.expand();
    return;
  }
  store.start({
    activity,
    chatId: context.chatId || null,
    chatType: chatTypeOf(context),
    serverId: context.serverId || null,
    isHost: false,
  });
}

/**
 * Aktiviteyi başlat: gerekiyorsa davet kartını yaz, sonra oturumu aç.
 * Kart yazılamazsa (izin, ağ) aktivite yine açılır — web ile aynı.
 */
export async function launchActivity(
  input: ActivitySummary | ActivityDescriptor,
  context: ActivityChatContext
): Promise<void> {
  const activity = toDescriptor(input);
  const chatId = context.chatId || null;
  const store = useActivitySession.getState();

  // Aynı sohbette aynı aktivitenin içindeysen yalnızca öne getir.
  const current = store.session;
  if (current && current.chatId === chatId && current.activity.url === activity.url) {
    store.expand();
    return;
  }

  if (lastStart && lastStart.url === activity.url && Date.now() - lastStart.at < 3_000) return;
  lastStart = { url: activity.url, at: Date.now() };

  if (chatId) {
    // Hızlı yol: odada aktif bir oturum biliniyorsa yeni kart basma, katıl.
    const existing = store.joinable[chatId];
    if (existing) {
      joinActivity(existing, context);
      return;
    }

    try {
      const created = await api<Partial<ChatMessagePayload> | undefined>(
        context.serverId
          ? endpoints.sendChannelMessage(chatId, context.serverId)
          : endpoints.sendDirectMessage(chatId),
        {
          method: "POST",
          body: {
            content: `${activity.name}|Katılmak için tıkla`,
            fileUrl: activity.url,
            messageType: "ACTIVITY_INVITE",
            metadata: {
              activityName: activity.name,
              activityDescription: activity.description,
              activityIcon: activity.icon,
              activityColor: activity.color,
              activityUrl: activity.url,
              activityId: activity.id,
            },
          },
        }
      );
      if (created && typeof created.id === "string" && typeof created.createdAt === "string") {
        writeCreated(chatId, created as ChatMessagePayload);
      }
    } catch (error) {
      // Sunucu otoriter çift kart engeli: bu sohbette zaten oturum var.
      if (error instanceof ApiError && error.status === 409 && error.message === "activity_already_active") {
        const body = error.body as { activity?: Partial<ActivityDescriptor> | null } | undefined;
        const running = body?.activity;
        if (running && typeof running.url === "string") {
          joinActivity(
            {
              id: running.id ?? running.url,
              name: running.name ?? activity.name,
              url: running.url,
              icon: running.icon ?? "gamepad",
              color: running.color,
            },
            context
          );
          return;
        }
      } else if (__DEV__) {
        console.warn("[aktivite] davet kartı yazılamadı", error);
      }
    }
  }

  useActivitySession.getState().start({
    activity,
    chatId,
    chatType: chatTypeOf(context),
    serverId: context.serverId || null,
    isHost: true,
  });
}

/** Katalog kimliğiyle başlat (sohbet çubuğu, aktivite listesi, derin bağlantı). */
export async function launchActivityById(activityId: string, context: ActivityChatContext): Promise<boolean> {
  const list = await queryClient
    .fetchQuery({
      queryKey: qk.activities,
      queryFn: async () => {
        const response = await api<ActivitySummary[] | { activities?: ActivitySummary[] }>(endpoints.activities);
        return Array.isArray(response) ? response : response?.activities ?? [];
      },
      staleTime: 5 * 60_000,
    })
    .catch(() => queryClient.getQueryData<ActivitySummary[]>(qk.activities) ?? []);
  const activity = Array.isArray(list) ? list.find((item) => item.id === activityId) : undefined;
  if (!activity) return false;
  await launchActivity(activity, context);
  return true;
}
