import { create } from "zustand";

import type { ChatMessagePayload } from "@/realtime/events";

/**
 * Geçici (ephemeral) bot yanıtları — ciklet-web `hooks/use-ephemeral-messages`
 * karşılığı.
 *
 * Bot bir etkileşime `flags: 64` ile yanıt verirse sunucu mesajı kanal
 * geçmişine YAZMAZ; yalnızca etkileşimi başlatan kullanıcının odasına
 * `message.ephemeral` olayı düşer (silinince `message.ephemeral_delete`).
 * Mesaj yalnızca bu bellek deposunda yaşar: uygulama yeniden açılınca
 * kaybolur (Discord gibi). Sohbet listesi bunları en yeni uca ekler;
 * altında "Yalnızca sen görebilirsin · Bu mesajları kapat" yazar.
 */

interface EphemeralState {
  /** chatId → o sohbetteki geçici mesajlar (eskiden yeniye). */
  byChat: Record<string, ChatMessagePayload[]>;
}

export const useEphemeralMessages = create<EphemeralState>(() => ({ byChat: {} }));

/** Sunucunun işaretlediği geçici mesaj (`metadata.ephemeral`). */
export function isEphemeralMessage(message: { metadata?: unknown }): boolean {
  const meta = message.metadata;
  return Boolean(meta && typeof meta === "object" && (meta as { ephemeral?: unknown }).ephemeral === true);
}

/** Yeni geçici mesaj ya da aynı kimlikteki mesajın güncel hâli. */
export function upsertEphemeralMessage(chatId: string, raw: unknown) {
  if (!raw || typeof raw !== "object" || typeof (raw as { id?: unknown }).id !== "string") return;
  const message = raw as ChatMessagePayload;
  // Sunucu işaretler; yine de liste dışı yollar (menü, okundu) ayırt edebilsin.
  const marked = {
    ...message,
    metadata: { ...(message.metadata ?? {}), ephemeral: true },
  } as ChatMessagePayload;
  useEphemeralMessages.setState((state) => {
    const list = state.byChat[chatId] ?? [];
    const index = list.findIndex((m) => m.id === marked.id);
    const next = index >= 0 ? list.map((m, i) => (i === index ? marked : m)) : [...list, marked];
    return { byChat: { ...state.byChat, [chatId]: next } };
  });
}

export function removeEphemeralMessage(chatId: string, messageId: string) {
  useEphemeralMessages.setState((state) => {
    const list = state.byChat[chatId];
    if (!list?.some((m) => m.id === messageId)) return state;
    return { byChat: { ...state.byChat, [chatId]: list.filter((m) => m.id !== messageId) } };
  });
}

/** Çıkışta: bir sonraki hesap öncekinin geçici mesajlarını görmesin. */
export function resetEphemeralMessages() {
  useEphemeralMessages.setState({ byChat: {} });
}

const EMPTY: ChatMessagePayload[] = [];

/** Sohbetin geçici mesajları (eskiden yeniye). */
export function useChatEphemerals(chatId: string): ChatMessagePayload[] {
  return useEphemeralMessages((state) => state.byChat[chatId] ?? EMPTY);
}
