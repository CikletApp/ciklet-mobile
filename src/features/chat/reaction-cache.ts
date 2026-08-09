import type { InfiniteData } from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import type { ChatMessagePayload, ReactionDelta } from "@/realtime/events";

export type MessageCache = InfiniteData<MessagesPage<ChatMessagePayload>>;

/** HTTP yanıtı ve socket yayını için idempotent tepki cache güncellemesi. */
export function applyReactionDelta(old: MessageCache | undefined, delta: ReactionDelta) {
  if (!old?.pages?.length) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => {
        if (item.id !== delta.messageId) return item;
        const reactions = item.reactions ?? [];
        const reaction = {
          ...delta.reaction,
          messageId: delta.reaction.messageId ?? ("member" in item ? delta.messageId : null),
          directMessageId: delta.reaction.directMessageId ?? ("member" in item ? null : delta.messageId),
          createdAt: delta.reaction.createdAt ?? new Date().toISOString(),
        };
        return {
          ...item,
          reactions:
            delta.action === "add"
              ? reactions.some((entry) => entry.id === delta.reaction.id)
                ? reactions
                : [...reactions, reaction]
              : reactions.filter((entry) => entry.id !== delta.reaction.id),
        };
      }),
    })),
  };
}
