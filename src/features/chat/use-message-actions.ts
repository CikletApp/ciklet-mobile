import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ChatKind } from "@/api/hooks";
import { qk } from "@/api/query-keys";
import type { ReactionDelta } from "@/realtime/events";
import { applyReactionDelta, type MessageCache } from "./reaction-cache";

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

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) =>
      run(() =>
        api<ReactionDelta>(endpoints.reactions, {
          method: "POST",
          body:
            kind === "channel"
              ? { messageId, emoji }
              : { directMessageId: messageId, emoji },
        }).then((delta) => {
          queryClient.setQueryData<MessageCache>(qk.messages.chat(chatId), (old) => applyReactionDelta(old, delta));
        })
      ),
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

  return { edit, remove, toggleReaction, report, pending, error, clearError: () => setError(null) };
}
