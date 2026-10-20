import { useCallback } from "react";

import type { ChatKind } from "@/api/hooks";
import type { PickedAsset } from "@/lib/uploads";
import { useOutbox, type OutboxMessage } from "@/stores/outbox";
import {
  buildMessageBody,
  discardOutbox,
  kickOutbox,
  retryOutbox,
  stageOutboxFile,
  type SendAttachment,
  type SendExtras,
} from "./outbox-sender";

/**
 * Mesaj gönderimi — iyimser ve ÇEVRİMDIŞI dayanıklı (WhatsApp).
 *
 * Akış:
 *  1. Mesaj kalıcı kuyruğa (stores/outbox) "queued" olarak yazılır ve
 *     listede HEMEN saat simgesiyle görünür — ağ olsun olmasın.
 *  2. Gönderim motoru (features/chat/outbox-sender) kuyruğu sırayla boşaltır:
 *     bağlantı yoksa bekler, gelince gönderir; uygulama kapanıp açılsa da
 *     kayıt kaybolmaz.
 *  3. Yanıt gelir gelmez sunucunun döndürdüğü mesaj cache'e yazılır ve
 *     geçici satır düşer. Yayın daha önce gelirse içerikten eşleşir.
 *  4. Kalıcı hata (izin, doğrulama) "Gönderilemedi — tekrar dene" olur.
 */

/** Gönderilen ek — yükleme sonucundan ya da GIF seçiciden. */
export type ComposerAttachment = SendAttachment;

/** Mesajla birlikte giden ek alanlar — sesli mesaj, anket, çıkartma. */
export type ComposerExtras = SendExtras;

export function useComposer(kind: ChatKind, chatId: string | undefined, serverId?: string) {
  const enqueue = useOutbox((s) => s.enqueue);

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
      if ((!text && !files[0] && !extras?.metadata) || !chatId) return;
      const { content, payload, label } = buildMessageBody(text, files, replyToId, extras);
      enqueue({ chatId, kind, serverId, content, payload, label });
      kickOutbox();
    },
    [chatId, kind, serverId, enqueue]
  );

  /**
   * Henüz yüklenmemiş yerel dosyayla gönderim (sesli mesaj, çevrimdışı
   * seçilen dosya): dosya kuyruk klasörüne kopyalanır, motor önce yükler
   * sonra gönderir. Kopyalanamazsa hata fırlatır.
   */
  const sendLocalFile = useCallback(
    async (asset: PickedAsset, replyToId?: string, extras?: ComposerExtras) => {
      if (!chatId) return;
      const upload = await stageOutboxFile(asset);
      const { payload } = buildMessageBody("", [], replyToId, extras);
      enqueue({
        chatId,
        kind,
        serverId,
        content: "",
        payload,
        label: extras?.label ?? `📎 ${asset.name || "Dosya"}`,
        upload,
      });
      kickOutbox();
    },
    [chatId, kind, serverId, enqueue]
  );

  const retry = useCallback((message: OutboxMessage) => retryOutbox(message.id), []);

  return { send, sendLocalFile, retry, discard: discardOutbox };
}
