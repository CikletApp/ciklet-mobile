import { useCallback, useEffect, useRef } from "react";

import { useTypers } from "@/stores/typing";
import { ClientEvent } from "./events";
import { sendGatewayEvent } from "./gateway";

/**
 * "Yazıyor…" göstergesi.
 *
 * İki yönlü:
 *  - `typers`  : bu sohbette şu an yazanlar (ortak depo, bkz. stores/typing)
 *  - `notifyTyping()` / `stopTyping()` : kendi yazma durumunu bildirir
 *
 * Ağ geçidi göstergeyi yalnızca SOHBETE ABONE bağlantılara yayıyor; abonelik
 * `useChatStream` tarafından tutulur, bu hook ayrıca abone olmaz. Gelen
 * kareleri `realtime/provider.tsx` tek dinleyiciyle depoya yazar.
 *
 * Giden bildirim kısılır: her tuş vuruşunda olay yollamak hareketli bir
 * kanalda bağlantıyı boğar. Bir kez "yazıyor" gönderilir, 3 sn sessizlikten
 * sonra "durdu". Mesaj gönderilince "durdu" hemen gider (web'le aynı).
 */

const THROTTLE_MS = 3_000;

export function useTyping(chatId: string | undefined) {
  const typers = useTypers(chatId);
  const lastSent = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Giden ──────────────────────────────────────────────────────────
  const notifyTyping = useCallback(() => {
    if (!chatId) return;

    const now = Date.now();
    if (now - lastSent.current > THROTTLE_MS) {
      if (sendGatewayEvent({ event_type: ClientEvent.TYPING, chat_id: chatId, is_typing: true })) {
        lastSent.current = now;
      }
    }

    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      lastSent.current = 0;
      sendGatewayEvent({ event_type: ClientEvent.TYPING, chat_id: chatId, is_typing: false });
    }, THROTTLE_MS);
  }, [chatId]);

  /** Gönderildi ya da taslak boşaldı: karşı tarafta göstergeyi hemen söndür. */
  const stopTyping = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    if (!chatId || lastSent.current === 0) return;
    lastSent.current = 0;
    sendGatewayEvent({ event_type: ClientEvent.TYPING, chat_id: chatId, is_typing: false });
  }, [chatId]);

  // Ekrandan çıkarken "yazmayı bıraktım" bildir.
  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (chatId && lastSent.current > 0) {
        sendGatewayEvent({ event_type: ClientEvent.TYPING, chat_id: chatId, is_typing: false });
      }
    };
  }, [chatId]);

  return { typers, notifyTyping, stopTyping };
}

/**
 * Gösterge metni — üçten fazla kişide isim saymak yerine sayı verilir.
 * Yanında hareketli noktalar varsa `ellipsis: false` (üç nokta iki kez olmasın).
 */
export function typingLabel(
  typers: { name: string }[],
  { ellipsis = true }: { ellipsis?: boolean } = {}
): string | null {
  if (typers.length === 0) return null;
  const tail = ellipsis ? "…" : "";
  if (typers.length === 1) return `${typers[0].name} yazıyor${tail}`;
  if (typers.length === 2) return `${typers[0].name} ve ${typers[1].name} yazıyor${tail}`;
  if (typers.length === 3) {
    return `${typers[0].name}, ${typers[1].name} ve ${typers[2].name} yazıyor${tail}`;
  }
  return `Birkaç kişi yazıyor${tail}`;
}
