import { useCallback } from "react";
import { router } from "expo-router";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useDirect, useDirectDisplay } from "@/api/hooks";
import { showToast } from "@/components/ui/toast";
import { useAuth } from "@/stores/auth";
import { useChatScope } from "./chat-scope";

/**
 * "Mesaj Bağlantısını Kopyala" — web `message-context-menu` ile aynı adres:
 * sohbetin web adresi + `?m=<id>`. Web'de açılınca da, uygulamada açılınca
 * da (bkz. `openMessageLink`) mesaja kaydırılır.
 *
 *   kanal:  https://ciklet.xyz/servers/<sunucu>/channels/<kanal>?m=<id>
 *   birebir: https://ciklet.xyz/direct/<karşı taraf profil>?m=<id>
 *   grup:   https://ciklet.xyz/direct/group/<sohbet>?m=<id>
 */
export const WEB_ORIGIN = "https://ciklet.xyz";

export function messageLink(
  scope: { kind: "channel" | "direct"; chatId: string; serverId?: string },
  messageId: string,
  direct?: { isGroup: boolean; peerId?: string }
): string | null {
  const m = `?m=${encodeURIComponent(messageId)}`;
  if (scope.kind === "channel") {
    return scope.serverId ? `${WEB_ORIGIN}/servers/${scope.serverId}/channels/${scope.chatId}${m}` : null;
  }
  if (direct?.isGroup) return `${WEB_ORIGIN}/direct/group/${scope.chatId}${m}`;
  return direct?.peerId ? `${WEB_ORIGIN}/direct/${direct.peerId}${m}` : null;
}

/** Açık sohbetin mesaj bağlantısı üreticisi (bağlam menüsü için). */
export function useMessageLink(): (messageId: string) => string | null {
  const scope = useChatScope();
  const { data: direct } = useDirect(scope?.kind === "direct" ? scope.chatId : undefined);
  const display = useDirectDisplay(direct);
  const myId = useAuth((s) => s.profile?.id);
  return useCallback(
    (messageId: string) => {
      if (!scope) return null;
      return messageLink(scope, messageId, {
        isGroup: display?.isGroup ?? false,
        // Notlarım: karşı taraf kendin (web `/direct/<kendi id>`).
        peerId: display?.isSelf ? myId : display?.peer?.id,
      });
    },
    [scope, display, myId]
  );
}

export type MessageLinkTarget =
  | { kind: "channel"; serverId: string; channelId: string; messageId?: string }
  | { kind: "group"; directId: string; messageId?: string }
  | { kind: "direct"; profileId: string; messageId?: string };

/** Ciklet sohbet adresini çözer; sohbet adresi değilse null. */
export function parseMessageLink(url: string): MessageLinkTarget | null {
  const match = /^https?:\/\/[^/?#]+(\/[^?#]*)?(\?[^#]*)?/i.exec(url.trim());
  if (!match) return null;
  const path = (match[1] ?? "/").replace(/\/+$/, "");
  const messageId = /[?&]m=([^&]+)/.exec(match[2] ?? "")?.[1];
  const m = messageId ? decodeURIComponent(messageId) : undefined;
  const id = "([A-Za-z0-9_-]+)";
  let parts = new RegExp(`^/servers/${id}/channels/${id}$`).exec(path);
  if (parts) return { kind: "channel", serverId: parts[1], channelId: parts[2], messageId: m };
  parts = new RegExp(`^/direct/group/${id}$`).exec(path);
  if (parts) return { kind: "group", directId: parts[1], messageId: m };
  parts = new RegExp(`^/direct/${id}$`).exec(path);
  if (parts) return { kind: "direct", profileId: parts[1], messageId: m };
  return null;
}

/** Sohbet adresini uygulamada açar; sohbet adresi değilse false. */
export function openMessageLink(url: string): boolean {
  const target = parseMessageLink(url);
  if (!target) return false;
  const m = target.messageId ? { m: target.messageId } : {};
  if (target.kind === "channel") {
    router.push({
      pathname: "/chat/channel/[channelId]",
      params: { channelId: target.channelId, serverId: target.serverId, ...m },
    });
  } else if (target.kind === "group") {
    router.push({ pathname: "/chat/direct/[directId]", params: { directId: target.directId, ...m } });
  } else {
    void api<{ id: string }>(endpoints.directInit, { method: "POST", body: { friendId: target.profileId } })
      .then((direct) =>
        router.push({ pathname: "/chat/direct/[directId]", params: { directId: direct.id, ...m } })
      )
      .catch(() => showToast("Sohbet açılamadı", "error"));
  }
  return true;
}
