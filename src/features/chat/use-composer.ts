import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ChatKind } from "@/api/hooks";
import { qk } from "@/api/query-keys";
import type { ChatMessagePayload } from "@/realtime/events";
import { useOutbox, type OutboxMessage, type OutboxPayload } from "@/stores/outbox";
import type { MessageCache } from "./reaction-cache";

/**
 * Mesaj gönderimi — iyimser.
 *
 * Akış:
 *  1. Mesaj outbox'a "sending" olarak yazılır ve LİSTEDE HEMEN görünür.
 *  2. HTTP isteği gider (uç, Socket.IO sunucusunun HTTP tarafıdır: kaydeder
 *     ve odaya yayınlar).
 *  3. Yanıt gelir gelmez sunucunun döndürdüğü mesaj cache'e yazılır ve
 *     geçici satır düşürülür — aynı anda olduğu için kare kaybı yok. Yayın
 *     daha sonra gelirse kimliğe göre elenir (`use-chat-stream`).
 *     Eskiden yalnızca yayın bekleniyordu: soket kopuk ya da zombiyken
 *     gönderilen mesaj "gönderiliyor"da takılı kalıyor, karşı taraf görse
 *     de gönderen görmüyordu.
 *  4. İstek başarısızsa kayıt "failed" olur; kullanıcı yeniden dener.
 */
/** Gönderilen ek — yükleme sonucundan ya da GIF seçiciden. */
export interface ComposerAttachment {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

/** Mesajla birlikte giden ek alanlar — sesli mesaj, anket, çıkartma. */
export interface ComposerExtras {
  /** `metadata`'ya eklenir (ör. `{ voice }`, `{ poll }`, `{ sticker: { id } }`). */
  metadata?: Record<string, unknown>;
  /** Web `messageType` (ör. "POLL"); verilmezse DEFAULT. */
  messageType?: string;
  /** Satırda gösterilecek yer tutucu metin (ör. "📊 Anket"). */
  label?: string;
}

export function useComposer(
  kind: ChatKind,
  chatId: string | undefined,
  serverId?: string
) {
  const enqueue = useOutbox((s) => s.enqueue);
  const markFailed = useOutbox((s) => s.markFailed);
  const markSending = useOutbox((s) => s.markSending);
  const remove = useOutbox((s) => s.remove);
  const queryClient = useQueryClient();

  const deliver = useCallback(
    async (outboxId: string, content: string, payload: OutboxPayload) => {
      if (!chatId) return;
      try {
        const created = await api<Partial<ChatMessagePayload> | undefined>(
          kind === "channel"
            ? endpoints.sendChannelMessage(chatId, serverId ?? "")
            : endpoints.sendDirectMessage(chatId),
          { method: "POST", body: { content, ...payload } }
        );
        // Yanıt sunum katmanından geçmiş tam mesaj (geçmiş satırlarıyla aynı
        // şekil). Kimliği varsa listeye hemen yazılır; yoksa yayın bekler.
        if (created && typeof created.id === "string" && typeof created.createdAt === "string") {
          const message = created as ChatMessagePayload;
          queryClient.setQueryData<MessageCache>(qk.messages.chat(chatId), (old) => {
            if (!old?.pages?.length) return old;
            if (old.pages.some((page) => page.items.some((item) => item.id === message.id))) return old;
            const [newest, ...rest] = old.pages;
            return { ...old, pages: [{ ...newest, items: [message, ...newest.items] }, ...rest] };
          });
          remove(outboxId);
        }
      } catch (err) {
        markFailed(
          outboxId,
          err instanceof ApiError ? err.message : "Gönderilemedi"
        );
      }
    },
    [chatId, kind, serverId, markFailed, remove, queryClient]
  );

  /**
   * `attachments`: tek ek ya da liste (en çok 10). Şema bozulmadan ilk dosya
   * `fileUrl`, birden çoksa tam liste `metadata.attachments` (web
   * lib/multi-attachments; sunucu süzer).
   */
  const send = useCallback(
    (
      raw: string,
      attachments?: ComposerAttachment | ComposerAttachment[],
      replyToId?: string,
      extras?: ComposerExtras
    ) => {
      const text = raw.trim();
      const files = (Array.isArray(attachments) ? attachments : attachments ? [attachments] : []).slice(0, 10);
      const first = files[0];
      if ((!text && !first && !extras?.metadata) || !chatId) return;
      // Web'le aynı gövde (chat-input-area): içerik boşsa dosyanın adresi
      // gider — iki istemci de ek adresini metin olarak göstermiyor. Dosya
      // adı içeriğe yazılsaydı web'de görselin altında başlık gibi dururdu.
      const content = text || first?.url || "";
      const info = (file: ComposerAttachment) => ({
        name: file.name,
        ...(file.mimeType ? { type: file.mimeType } : {}),
        ...(file.size !== undefined ? { size: file.size } : {}),
      });
      const metadata: Record<string, unknown> = {
        // UploadThing adresi ne ad ne tür taşıyor; önizleme (görsel, video,
        // dosya kartı) web'de de mobilde de bu bilgiye bakıyor.
        ...(first ? { attachment: info(first) } : {}),
        ...(files.length > 1 ? { attachments: files.map((file) => ({ url: file.url, ...info(file) })) } : {}),
        ...extras?.metadata,
      };
      const payload: OutboxPayload = {
        ...(first ? { fileUrl: first.url } : {}),
        ...(replyToId ? { replyToId } : {}),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        ...(extras?.messageType ? { messageType: extras.messageType } : {}),
      };
      const label =
        extras?.label ??
        (text ? undefined : files.length > 1 ? `📎 ${files.length} dosya` : `📎 ${first?.name ?? "Dosya"}`);
      const outboxId = enqueue(chatId, content, payload, label);
      void deliver(outboxId, content, payload);
    },
    [chatId, enqueue, deliver]
  );

  const retry = useCallback(
    (message: OutboxMessage) => {
      markSending(message.id);
      // Ek, yanıt ve meta veri de yeniden gider; eskiden yalnızca içerik
      // gidiyordu ve başarısız dosya mesajı dosyasız yeniden gönderiliyordu.
      void deliver(message.id, message.content, message.payload);
    },
    [markSending, deliver]
  );

  return { send, retry, discard: remove };
}
