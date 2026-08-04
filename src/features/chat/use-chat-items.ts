import { useMemo } from "react";
import { MessageType } from "@ciklet/embedded-activities-sdk/types";

import { isSameDay, shouldGroupMessages } from "@/lib/format";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";

/**
 * Mesaj sayfalarını render'a hazır düz bir listeye çevirir.
 *
 * Liste `inverted` çizilir: dizi YENİDEN ESKİYE sıralıdır ve index 0 ekranın
 * ALTINDA durur. Dolayısıyla `items[i + 1]` görsel olarak `items[i]`'nin
 * ÜSTÜNDEKİ (daha eski) mesajdır — gruplama ve tarih ayracı kararları bu
 * komşuya bakılarak verilir.
 *
 * Tarih ayracı, dizide o güne ait SON mesajdan sonra eklenir; ters çizim
 * sayesinde o günün ilk mesajının üstünde görünür.
 */

export type ChatItem =
  | {
      kind: "message";
      key: string;
      message: ChatMessagePayload;
      /** Üstündeki mesajla aynı gruba ait — avatar ve ad tekrarlanmaz. */
      grouped: boolean;
    }
  | { kind: "day"; key: string; iso: string };

export function authorIdOf(message: ChatMessagePayload): string {
  return isChannelMessage(message)
    ? message.member.profile.id
    : message.profile.id;
}

/**
 * Sistem mesajı mı (çağrı kaydı, aktivite daveti).
 *
 * Bunlar ayrı bir kart olarak çizilir ve GRUPLAMAYI BÖLER: sistem mesajı
 * teknik olarak bir üyeye ait olduğu için, hemen ardından gelen normal
 * mesaj aynı yazara sahip sayılıp başlığını (avatar + ad) kaybediyordu —
 * cihaz testinde "Cevapsız arama gerçekleşti"nin altındaki mesaj sahipsiz
 * görünüyordu.
 */
function isSystemMessage(message: ChatMessagePayload): boolean {
  return message.type !== MessageType.DEFAULT;
}

export function useChatItems(
  messages: ChatMessagePayload[],
  /** Geçmişin sonuna ulaşıldıysa en eski mesajın da tarih ayracı olur. */
  reachedStart: boolean
): ChatItem[] {
  return useMemo(() => {
    const items: ChatItem[] = [];

    for (let i = 0; i < messages.length; i += 1) {
      const message = messages[i];
      const older = messages[i + 1];

      const dayChanged = older
        ? !isSameDay(new Date(message.createdAt), new Date(older.createdAt))
        : reachedStart;

      items.push({
        kind: "message",
        key: message.id,
        message,
        grouped:
          !dayChanged &&
          Boolean(older) &&
          !isSystemMessage(message) &&
          !isSystemMessage(older!) &&
          shouldGroupMessages(
            older ? authorIdOf(older) : undefined,
            older?.createdAt,
            authorIdOf(message),
            message.createdAt
          ),
      });

      if (dayChanged) {
        items.push({
          kind: "day",
          key: `day-${message.id}`,
          iso: message.createdAt,
        });
      }
    }

    return items;
  }, [messages, reachedStart]);
}
