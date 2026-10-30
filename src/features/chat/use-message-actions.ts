import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { addSidebarThread, type ChatKind } from "@/api/hooks";
import { qk } from "@/api/query-keys";
import type { ReactionDelta } from "@/realtime/events";
import { applyReactionDelta, type MessageCache } from "./reaction-cache";
import { showToast } from "@/components/ui/toast";
import { useAuth } from "@/stores/auth";
import { isBurstRow } from "./reaction-groups";
import {
  SUPER_REACTION_PLAN_TEXT,
  SUPER_REACTION_QUERY_KEY,
  SUPER_REACTION_QUOTA_TEXT,
  canSendSuperReaction,
  setSuperReactionQuota,
  type SuperReactionQuota,
} from "./super-reactions";

export type ReportReason = "SPAM" | "HARASSMENT" | "HATE_SPEECH" | "VIOLENCE" | "SELF_HARM" | "CSAM" | "ILLEGAL" | "IMPERSONATION" | "OTHER";

export function useMessageActions(
  kind: ChatKind,
  chatId: string,
  serverId?: string
) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (operation: () => Promise<unknown>) => {
    setPending(true);
    setError(null);
    try {
      await operation();
      return true;
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "İşlem tamamlanamadı.");
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const edit = useCallback(
    (messageId: string, content: string) =>
      run(() =>
        api(
          kind === "channel"
            ? endpoints.editChannelMessage(messageId, chatId, serverId ?? "")
            : endpoints.editDirectMessage(messageId, chatId),
          { method: "PATCH", body: { content } }
        )
      ),
    [chatId, kind, run, serverId]
  );

  const remove = useCallback(
    (messageId: string) =>
      run(() =>
        api(
          kind === "channel"
            ? endpoints.editChannelMessage(messageId, chatId, serverId ?? "")
            : endpoints.editDirectMessage(messageId, chatId),
          { method: "DELETE" }
        )
      ),
    [chatId, kind, run, serverId]
  );

  /**
   * Tepki ekle/kaldır. `burst`: süper tepki (normal tepkiden ayrı). Kendi
   * süper tepkisini kaldırmak hak istemez; eklemede hak yoksa istek gitmez,
   * Mentol tanıtımı gösterilir (web ile aynı).
   */
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string, options?: { burst?: boolean }) => {
      const burst = options?.burst === true;
      const myId = useAuth.getState().profile?.id;
      const ownsBurst =
        burst &&
        Boolean(myId) &&
        (queryClient.getQueryData<MessageCache>(qk.messages.chat(chatId))?.pages ?? []).some((page) =>
          page.items.some(
            (item) =>
              item.id === messageId &&
              (item.reactions ?? []).some((r) => isBurstRow(r) && r.emoji === emoji && r.profileId === myId)
          )
        );
      if (burst && !ownsBurst) {
        const quota =
          queryClient.getQueryData<SuperReactionQuota>(SUPER_REACTION_QUERY_KEY) ??
          (await queryClient
            .fetchQuery({
              queryKey: SUPER_REACTION_QUERY_KEY,
              queryFn: () => api<SuperReactionQuota>(endpoints.superReactions),
            })
            .catch(() => undefined));
        if (!canSendSuperReaction(quota)) {
          showToast(quota && quota.plan !== "FREE" ? SUPER_REACTION_QUOTA_TEXT : SUPER_REACTION_PLAN_TEXT);
          return false;
        }
      }
      return run(() =>
        api<ReactionDelta & { superReactions?: SuperReactionQuota }>(endpoints.reactions, {
          method: "POST",
          body: {
            ...(kind === "channel" ? { messageId } : { directMessageId: messageId }),
            emoji,
            ...(burst ? { burst: true } : {}),
          },
        })
          .then((delta) => {
            queryClient.setQueryData<MessageCache>(qk.messages.chat(chatId), (old) => applyReactionDelta(old, delta));
            if (delta.superReactions) setSuperReactionQuota(queryClient, delta.superReactions);
          })
          .catch((reason: unknown) => {
            // Hak bitti / plan yok: sayaç tazelenir, hata menüde de görünür.
            if (reason instanceof ApiError && (reason.code === "super_reaction_quota" || reason.code === "super_reaction_plan")) {
              void queryClient.invalidateQueries({ queryKey: SUPER_REACTION_QUERY_KEY });
              showToast(reason.message, "error");
            }
            throw reason;
          })
      );
    },
    [chatId, kind, queryClient, run]
  );

  const report = useCallback(
    (messageId: string, reportedUserId: string, reason: ReportReason, detail: string) =>
      run(() => api(endpoints.reports, {
        method: "POST",
        body: {
          targetType: kind === "channel" ? "MESSAGE" : "DIRECT_MESSAGE",
          targetId: messageId,
          reportedUserId,
          reason,
          detail: detail.trim() || null,
        },
      })),
    [kind, run]
  );

  /**
   * Mesajdan alt başlık (web create-thread-dialog). Başarılıysa yeni alt
   * başlığın kimliği; sunucu başlangıç mesajına `metadata.thread` yazar ve
   * güncellemeyi yayınlar, bağlantı akıştan gelir.
   */
  const createThread = useCallback(
    async (messageId: string, name: string, autoArchiveMinutes: number): Promise<string | null> => {
      let id: string | null = null;
      const ok = await run(async () => {
        const res = await api<{ id: string; name?: string }>(endpoints.channelThreads(chatId), {
          method: "POST",
          body: { name: name || undefined, messageId, autoArchiveMinutes },
        });
        id = res.id;
        // Kenar listesi ve "bu kanalın alt başlığı mı" denetimi tazelemeyi beklemesin.
        if (serverId) {
          addSidebarThread(queryClient, serverId, {
            id: res.id,
            name: res.name ?? name,
            parentChannelId: chatId,
            latestMessageId: null,
          });
        }
      });
      return ok ? id : null;
    },
    [chatId, queryClient, run, serverId]
  );

  return { edit, remove, toggleReaction, report, createThread, pending, error, clearError: () => setError(null) };
}
