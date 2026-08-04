import { create } from "zustand";

/**
 * Giden mesaj kutusu — iyimser gönderim.
 *
 * Neden react-query cache'ine yazılmıyor: cache her `refetch`'te sunucudan
 * gelen veriyle değiştirilir ve enjekte edilen geçici satırlar sessizce
 * kaybolur. (ciklet-web aynı sorunu yaşayıp `use-ephemeral-messages`
 * store'una taşımış — mobil de aynı deseni izler.)
 *
 * Yaşam döngüsü:
 *   sending ──► (soket yayını geldi) ──► kayıt silinir
 *          └──► (hata) ──► failed ──► kullanıcı yeniden dener veya siler
 */

export interface OutboxMessage {
  /** İstemci tarafı geçici kimlik — sunucudaki id ile karışmasın diye önekli. */
  id: string;
  chatId: string;
  content: string;
  createdAt: string;
  status: "sending" | "failed";
  /** Başarısızlık sebebi — satırda gösterilir. */
  error?: string;
}

interface OutboxState {
  /** chatId → gönderim sırası (eskiden yeniye). */
  byChat: Record<string, OutboxMessage[]>;

  enqueue: (chatId: string, content: string) => string;
  markFailed: (id: string, error: string) => void;
  markSending: (id: string) => void;
  remove: (id: string) => void;
  /**
   * Sunucudan kendi mesajımızın yayını geldiğinde eşleşen bekleyen kaydı
   * siler. Sunucu istemci nonce'unu geri yansıtmadığı için eşleştirme
   * içeriğe göre yapılır — aynı içerikli iki mesaj arka arkaya
   * gönderildiğinde yalnızca EN ESKİ bekleyen kayıt düşer, ikincisi
   * kendi yayınını beklemeye devam eder.
   */
  resolveByContent: (chatId: string, content: string) => void;
  clearChat: (chatId: string) => void;
}

let counter = 0;

export const useOutbox = create<OutboxState>((set) => ({
  byChat: {},

  enqueue: (chatId, content) => {
    counter += 1;
    const id = `outbox-${Date.now()}-${counter}`;
    const message: OutboxMessage = {
      id,
      chatId,
      content,
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    set((state) => ({
      byChat: { ...state.byChat, [chatId]: [...(state.byChat[chatId] ?? []), message] },
    }));
    return id;
  },

  markFailed: (id, error) =>
    set((state) => ({ byChat: mapMessage(state.byChat, id, (m) => ({ ...m, status: "failed", error })) })),

  markSending: (id) =>
    set((state) => ({
      byChat: mapMessage(state.byChat, id, (m) => ({ ...m, status: "sending", error: undefined })),
    })),

  remove: (id) =>
    set((state) => {
      const byChat: Record<string, OutboxMessage[]> = {};
      for (const [chatId, list] of Object.entries(state.byChat)) {
        const next = list.filter((m) => m.id !== id);
        if (next.length > 0) byChat[chatId] = next;
      }
      return { byChat };
    }),

  resolveByContent: (chatId, content) =>
    set((state) => {
      const list = state.byChat[chatId];
      if (!list?.length) return state;

      const index = list.findIndex(
        (m) => m.status === "sending" && m.content === content
      );
      if (index === -1) return state;

      const next = [...list.slice(0, index), ...list.slice(index + 1)];
      const byChat = { ...state.byChat };
      if (next.length > 0) byChat[chatId] = next;
      else delete byChat[chatId];
      return { byChat };
    }),

  clearChat: (chatId) =>
    set((state) => {
      const byChat = { ...state.byChat };
      delete byChat[chatId];
      return { byChat };
    }),
}));

function mapMessage(
  byChat: Record<string, OutboxMessage[]>,
  id: string,
  update: (message: OutboxMessage) => OutboxMessage
): Record<string, OutboxMessage[]> {
  const next: Record<string, OutboxMessage[]> = {};
  for (const [chatId, list] of Object.entries(byChat)) {
    next[chatId] = list.map((m) => (m.id === id ? update(m) : m));
  }
  return next;
}

const EMPTY: OutboxMessage[] = [];

/** Bir sohbetin bekleyen mesajları. Referans kararlıdır — boşta yeniden render etmez. */
export function useChatOutbox(chatId: string | undefined): OutboxMessage[] {
  return useOutbox((state) => (chatId ? (state.byChat[chatId] ?? EMPTY) : EMPTY));
}
