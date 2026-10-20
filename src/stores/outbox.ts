import { create } from "zustand";

import type { ChatKind } from "@/api/hooks";
import { kvGet, kvSet } from "@/lib/local-db";
import type { OutboxStatus } from "./outbox-logic";

/**
 * Giden mesaj kutusu — KALICI gönderim kuyruğu (WhatsApp'ın saat simgesi).
 *
 * Neden react-query cache'ine yazılmıyor: cache her `refetch`'te sunucudan
 * gelen veriyle değiştirilir ve enjekte edilen geçici satırlar sessizce
 * kaybolur. (ciklet-web aynı sorunu yaşayıp `use-ephemeral-messages`
 * store'una taşımış — mobil de aynı deseni izler.)
 *
 * Kuyruk her değişimde yerel veritabanına yazılır (`kv.outbox`) ve açılışta
 * EŞZAMANLI okunur: çevrimdışıyken yazılıp uygulama kapatılan mesaj, bir
 * sonraki açılışta yine saatle durur ve bağlantı gelince gider. Gönderen
 * motor `features/chat/outbox-sender.ts`.
 *
 * Yaşam döngüsü:
 *   queued ──► sending ──► (yanıt / yayın) ──► kayıt silinir
 *     ▲           │
 *     └─ ağ/5xx ──┤ (üstel bekleme)
 *                 └─ kalıcı hata ──► failed ──► kullanıcı tekrar dener / siler
 */

/** Sunucuya giden gövdenin içerik dışı kısmı — yeniden denemede aynen gider. */
export interface OutboxPayload {
  fileUrl?: string;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  /** Web `messageType` — anket için "POLL"; yoksa DEFAULT. */
  messageType?: string;
}

/**
 * Henüz yüklenmemiş yerel dosya (sesli mesaj, çevrimdışı seçilen dosya).
 * Dosya kuyruk klasörüne kopyalanır (bkz. outbox-sender `stageOutboxFile`);
 * gönderimden önce yüklenir, sonra mesajın eki olur.
 */
export interface OutboxUpload {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

export interface OutboxMessage {
  /** İstemci tarafı geçici kimlik (aynı zamanda istemci nonce'u) — sunucudaki id ile karışmasın diye önekli. */
  id: string;
  chatId: string;
  kind: ChatKind;
  /** Kanal mesajı uç adresinde gerekiyor. */
  serverId?: string;
  /** Sunucuya giden içerik; yayınla eşleştirme buna göre yapılır. */
  content: string;
  /**
   * Satırda gösterilecek metin. Yalnızca dosya gönderilince içerik dosyanın
   * adresi oluyor (web'le aynı); kullanıcıya adres değil dosya adı görünür.
   */
  label?: string;
  payload: OutboxPayload;
  /** Doluysa önce bu dosya yüklenir. */
  upload?: OutboxUpload;
  createdAt: string;
  status: OutboxStatus;
  /** Sunucu hatası sayacı (ağ hataları sayılmaz). */
  attempts: number;
  nextAttemptAt?: number;
  /**
   * Önceki deneme yanıt gelmeden koptu: istek sunucuya ulaşmış olabilir.
   * Yeniden göndermeden önce en yeni sayfada aynı mesaj aranır (çift
   * gönderim olmasın — HTTP ucu istemci nonce'u kabul etmiyor).
   */
  uncertain?: boolean;
  /** Başarısızlık sebebi — satırda gösterilir. */
  error?: string;
}

interface OutboxState {
  /** chatId → gönderim sırası (eskiden yeniye). */
  byChat: Record<string, OutboxMessage[]>;
  /** Yükleme ilerlemesi (0–100) — kalıcı değil. */
  progress: Record<string, number>;

  enqueue: (input: {
    chatId: string;
    kind: ChatKind;
    serverId?: string;
    content: string;
    payload?: OutboxPayload;
    label?: string;
    upload?: OutboxUpload;
  }) => string;
  update: (id: string, patch: Partial<OutboxMessage>) => void;
  setProgress: (id: string, value: number | null) => void;
  /** Kullanıcı "Tekrar dene"ye bastı: sayaç sıfırlanır, hemen sıraya girer. */
  requeue: (id: string) => void;
  remove: (id: string) => void;
  /**
   * Sunucudan kendi mesajımızın yayını geldiğinde eşleşen bekleyen kaydı
   * siler. Sunucu istemci nonce'unu geri yansıtmadığı için eşleştirme
   * içeriğe göre yapılır — aynı içerikli iki mesaj arka arkaya
   * gönderildiğinde yalnızca EN ESKİ bekleyen kayıt düşer, ikincisi
   * kendi yayınını beklemeye devam eder.
   */
  resolveByContent: (chatId: string, content: string) => OutboxMessage | null;
  clearChat: (chatId: string) => void;
  /** Çıkış: kuyruk tamamen boşalır. */
  reset: () => void;
}

const STORAGE_KEY = "outbox";

let counter = 0;

/** Diskteki kuyruk; yarıda kalan gönderimler "belirsiz" olarak sıraya döner. */
function loadPersisted(): Record<string, OutboxMessage[]> {
  const stored = kvGet<Record<string, OutboxMessage[]>>(STORAGE_KEY)?.value;
  if (!stored || typeof stored !== "object") return {};
  const byChat: Record<string, OutboxMessage[]> = {};
  for (const [chatId, list] of Object.entries(stored)) {
    if (!Array.isArray(list)) continue;
    const valid = list
      .filter((m) => m && typeof m.id === "string" && typeof m.content === "string")
      .map((m) =>
        m.status === "sending"
          ? { ...m, status: "queued" as const, uncertain: true, nextAttemptAt: 0 }
          : { ...m, attempts: m.attempts ?? 0, kind: m.kind ?? "direct" }
      );
    if (valid.length > 0) byChat[chatId] = valid;
  }
  return byChat;
}

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

function without(byChat: Record<string, OutboxMessage[]>, id: string) {
  const next: Record<string, OutboxMessage[]> = {};
  for (const [chatId, list] of Object.entries(byChat)) {
    const rest = list.filter((m) => m.id !== id);
    if (rest.length > 0) next[chatId] = rest;
  }
  return next;
}

export const useOutbox = create<OutboxState>((set, get) => ({
  byChat: loadPersisted(),
  progress: {},

  enqueue: ({ chatId, kind, serverId, content, payload = {}, label, upload }) => {
    counter += 1;
    const id = `outbox-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
    const message: OutboxMessage = {
      id,
      chatId,
      kind,
      serverId,
      content,
      label,
      payload,
      upload,
      createdAt: new Date().toISOString(),
      status: "queued",
      attempts: 0,
      nextAttemptAt: 0,
    };
    set((state) => ({
      byChat: { ...state.byChat, [chatId]: [...(state.byChat[chatId] ?? []), message] },
    }));
    return id;
  },

  update: (id, patch) => set((state) => ({ byChat: mapMessage(state.byChat, id, (m) => ({ ...m, ...patch })) })),

  setProgress: (id, value) =>
    set((state) => {
      const progress = { ...state.progress };
      if (value === null) delete progress[id];
      else progress[id] = value;
      return { progress };
    }),

  requeue: (id) =>
    set((state) => ({
      byChat: mapMessage(state.byChat, id, (m) => ({
        ...m,
        status: "queued",
        attempts: 0,
        nextAttemptAt: 0,
        error: undefined,
      })),
    })),

  remove: (id) =>
    set((state) => {
      const progress = { ...state.progress };
      delete progress[id];
      return { byChat: without(state.byChat, id), progress };
    }),

  resolveByContent: (chatId, content) => {
    const list = get().byChat[chatId];
    if (!list?.length) return null;
    // Uçuştaki ya da yanıtı kopmuş (sunucuya ulaşmış olabilecek) kayıt düşer;
    // hiç gönderilmemiş sıradaki kayıt aynı içerikli başka bir mesajla karışmasın.
    const match = list.find((m) => m.content === content && (m.status === "sending" || m.uncertain));
    if (!match) return null;
    get().remove(match.id);
    return match;
  },

  clearChat: (chatId) =>
    set((state) => {
      const byChat = { ...state.byChat };
      delete byChat[chatId];
      return { byChat };
    }),

  reset: () => set({ byChat: {}, progress: {} }),
}));

// Kuyruk her değiştiğinde diske (ilerleme hariç). Küçük bir JSON; anında yazılır
// ki uygulama hemen öldürülse de son yazılan mesaj kaybolmasın.
useOutbox.subscribe((state, prev) => {
  if (state.byChat === prev.byChat) return;
  void kvSet(STORAGE_KEY, state.byChat);
});

/** Bütün bekleyenler (sohbet fark etmeksizin). */
export function allOutbox(): OutboxMessage[] {
  return Object.values(useOutbox.getState().byChat).flat();
}

const EMPTY: OutboxMessage[] = [];

/** Bir sohbetin bekleyen mesajları. Referans kararlıdır — boşta yeniden render etmez. */
export function useChatOutbox(chatId: string | undefined): OutboxMessage[] {
  return useOutbox((state) => (chatId ? (state.byChat[chatId] ?? EMPTY) : EMPTY));
}
