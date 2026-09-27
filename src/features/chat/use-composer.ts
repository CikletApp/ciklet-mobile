import { useCallback } from "react";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ChatKind } from "@/api/hooks";
import { useOutbox, type OutboxMessage, type OutboxPayload } from "@/stores/outbox";

/**
 * Mesaj gönderimi — iyimser.
 *
 * Akış:
 *  1. Mesaj outbox'a "sending" olarak yazılır ve LİSTEDE HEMEN görünür.
 *  2. HTTP isteği gider (uç, Socket.IO sunucusunun HTTP tarafıdır: kaydeder
 *     ve odaya yayınlar).
 *  3. Yayın geri geldiğinde `use-chat-stream` outbox'taki eşleşen kaydı
 *     düşürür — geçici satır yerini gerçek mesaja bırakır.
 *  4. İstek başarısızsa kayıt "failed" olur; kullanıcı yeniden dener.
 *
 * Not: başarı yanıtında kaydı SİLMİYORUZ. Yayın her zaman yanıttan sonra
 * gelmez; silseydik mesaj bir kare kaybolur, sonra yeniden belirirdi.
 */
/** Gönderilen ek — yükleme sonucundan ya da GIF seçiciden. */
export interface ComposerAttachment {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
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

  const deliver = useCallback(
    async (outboxId: string, content: string, payload: OutboxPayload) => {
      if (!chatId) return;
      try {
        await api(
          kind === "channel"
            ? endpoints.sendChannelMessage(chatId, serverId ?? "")
            : endpoints.sendDirectMessage(chatId),
          { method: "POST", body: { content, ...payload } }
        );
      } catch (err) {
        markFailed(
          outboxId,
          err instanceof ApiError ? err.message : "Gönderilemedi"
        );
      }
    },
    [chatId, kind, serverId, markFailed]
  );

  const send = useCallback(
    (raw: string, attachment?: ComposerAttachment, replyToId?: string) => {
      const text = raw.trim();
      if ((!text && !attachment) || !chatId) return;
      // Web'le aynı gövde (chat-input-area): içerik boşsa dosyanın adresi
      // gider — iki istemci de ek adresini metin olarak göstermiyor. Dosya
      // adı içeriğe yazılsaydı web'de görselin altında başlık gibi dururdu.
      const content = text || attachment?.url || "";
      const payload: OutboxPayload = {
        ...(attachment ? { fileUrl: attachment.url } : {}),
        ...(replyToId ? { replyToId } : {}),
        // UploadThing adresi ne ad ne tür taşıyor; önizleme (görsel, video,
        // dosya kartı) web'de de mobilde de bu bilgiye bakıyor.
        ...(attachment
          ? {
              metadata: {
                attachment: {
                  name: attachment.name,
                  ...(attachment.mimeType ? { type: attachment.mimeType } : {}),
                  ...(attachment.size !== undefined ? { size: attachment.size } : {}),
                },
              },
            }
          : {}),
      };
      const outboxId = enqueue(chatId, content, payload, text ? undefined : `📎 ${attachment?.name ?? "Dosya"}`);
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
