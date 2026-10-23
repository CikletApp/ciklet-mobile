import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ActivitySessionResponse, ActivitySummary } from "@/api/types";
import { showToast } from "@/components/ui";
import { API_BASE_URL } from "@/lib/config";
import { joinActivity } from "./launch";

/**
 * "Arkadaşları Davet Et" ve "Yardım Merkezi" — web lib/activity/invite-origin
 * ve lib/activity-help karşılığı.
 *
 * Güvenlik modeli sunucuda (web lib/activity/invite-origin): davet erişim
 * VERMEZ; kart yalnızca oturumun sohbetine zaten erişen kişilere gider,
 * aktivite tanımı onaylı uygulama kaydından gelir ve "Katıl" erişimi
 * /api/activities/session'da yeniden doğrular.
 */

/** Sunucunun yazdığı köken anahtarı; kullanıcı metadata'sında düşer. */
export const ACTIVITY_INVITE_ORIGIN_KEY = "activityInviteOrigin";

/** Uygulamanın kendi adresi yoksa: Ciklet'in uygulama yardım sayfası. */
export const CIKLET_ACTIVITY_HELP_PATH = "/docs/apps";

export interface ActivityInviteOrigin {
  chatId: string;
  kind: "channel" | "group" | "direct";
  serverId: string | null;
  label: string | null;
  inviterId: string;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const isId = (value: unknown): value is string => typeof value === "string" && ID_RE.test(value);

/** Kart metadata'sından köken; şekil bozuksa null (sıradan davet). */
export function readActivityInviteOrigin(metadata: unknown): ActivityInviteOrigin | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>)[ACTIVITY_INVITE_ORIGIN_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const kind = value.kind;
  if (kind !== "channel" && kind !== "group" && kind !== "direct") return null;
  if (!isId(value.chatId) || !isId(value.inviterId)) return null;
  const serverId = isId(value.serverId) ? value.serverId : null;
  if (kind === "channel" && !serverId) return null;
  return {
    chatId: value.chatId,
    kind,
    serverId,
    label: typeof value.label === "string" ? value.label.slice(0, 200) : null,
    inviterId: value.inviterId,
  };
}

/**
 * Köken sohbetteki oturuma katıl ve o sohbete git. Kartın içeriğine
 * güvenilmez: oturum ve aktivite tanımı sunucudan, erişim doğrulanarak gelir.
 */
export async function joinFromInvite(originChatId: string): Promise<void> {
  let session: ActivitySessionResponse;
  try {
    session = await api<ActivitySessionResponse>(endpoints.activitySession(originChatId));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) showToast("Bu etkinlik sona erdi.");
    else if (error instanceof ApiError && error.status === 403) showToast("Bu etkinliğin sohbetine erişimin yok.", "error");
    else showToast("Etkinliğe katılınamadı.", "error");
    return;
  }

  const { activity, chat } = session;
  const serverId = chat.type === "channel" ? chat.serverId : null;
  joinActivity(
    { id: activity.id, name: activity.name, url: activity.url, icon: activity.icon },
    { chatId: chat.id, serverId }
  );
  if (chat.type === "channel" && serverId) {
    router.push({ pathname: "/chat/channel/[channelId]", params: { channelId: chat.id, serverId } });
  } else {
    router.push({ pathname: "/chat/direct/[directId]", params: { directId: chat.id } });
  }
}

/** "Yardım Merkezi" adresi: katalogdaki helpUrl (göreli olabilir) ya da Ciklet yardımı. */
export function activityHelpUrl(activity: Pick<ActivitySummary, "helpUrl"> | null | undefined): string {
  const raw = activity?.helpUrl?.trim() || CIKLET_ACTIVITY_HELP_PATH;
  if (raw.startsWith("/") && !raw.startsWith("//")) return `${API_BASE_URL}${raw}`;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return url.toString();
  } catch {
    /* Ciklet yardımına düşülür */
  }
  return `${API_BASE_URL}${CIKLET_ACTIVITY_HELP_PATH}`;
}

export function openActivityHelp(activity: Pick<ActivitySummary, "helpUrl"> | null | undefined, toolbarColor?: string) {
  void WebBrowser.openBrowserAsync(activityHelpUrl(activity), { toolbarColor, showTitle: true }).catch(() => {});
}
