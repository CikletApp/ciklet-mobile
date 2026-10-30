import { createContext, useContext } from "react";

import type { ChatKind } from "@/api/hooks";

/**
 * Açık sohbetin kapsamı — mesaj satırlarının derinindeki bileşenler (rol
 * pili, sunucu emojisi, bileşen butonları, alt başlık bağlantısı) sunucu ve
 * kanal kimliğini prop zinciri olmadan buradan okur. Bağlam menüsündeki
 * önizleme kopyası da aynı sağlayıcının altında çizilir.
 */
export interface ChatScope {
  kind: ChatKind;
  chatId: string;
  /** Yalnızca sunucu kanalında. */
  serverId?: string;
}

const ChatScopeContext = createContext<ChatScope | null>(null);

export const ChatScopeProvider = ChatScopeContext.Provider;

export function useChatScope(): ChatScope | null {
  return useContext(ChatScopeContext);
}

/**
 * Açılmış sohbetlerin kapsamı (sohbet kimliği → kapsam). Bot formu (modal)
 * kökte, sağlayıcının dışında çizilir; formdaki kullanıcı/rol/kanal
 * menüleri sunucu kimliğini buradan bulur.
 */
const known = new Map<string, ChatScope>();

export function rememberChatScope(scope: ChatScope) {
  known.set(scope.chatId, scope);
}

export function chatScopeFor(chatId: string): ChatScope | null {
  return known.get(chatId) ?? null;
}
