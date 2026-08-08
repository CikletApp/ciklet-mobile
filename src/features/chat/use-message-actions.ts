import { useCallback, useState } from "react";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ChatKind } from "@/api/hooks";

export function useMessageActions(
  kind: ChatKind,
  chatId: string,
  serverId?: string
) {
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
        api(endpoints.reactions, {
          method: "POST",
          body:
            kind === "channel"
              ? { messageId, emoji }
              : { directMessageId: messageId, emoji },
        })
      ),
    [kind, run]
  );

  return { edit, remove, toggleReaction, pending, error, clearError: () => setError(null) };
}
