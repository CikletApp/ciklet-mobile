import { useCallback, useEffect, useRef, useState } from "react";

import { ClientEvent, ServerEvent, type TypingPayload } from "./events";
import { onGatewayEvent, sendGatewayEvent } from "./gateway";

/**
 * "Yazıyor…" göstergesi.
 *
 * İki yönlü:
 *  - `typers`  : bu sohbette şu an yazanlar (ağ geçidinden gelen)
 *  - `notifyTyping()` : kendi yazma durumunu bildirir
 *
 * Ağ geçidi göstergeyi yalnızca SOHBETE ABONE bağlantılara yayıyor; abonelik
 * `useChatStream` tarafından tutulur, bu hook ayrıca abone olmaz.
 *
 * Giden bildirim kısılır: her tuş vuruşunda olay yollamak hareketli bir
 * kanalda bağlantıyı boğar. Bir kez "yazıyor" gönderilir, 3 sn sessizlikten
 * sonra "durdu". Gelen kayıtlar da kendiliğinden söner: karşı taraf
 * uygulamayı kapatırsa "durdu" hiç gelmez ve gösterge asılı kalırdı.
 */

const THROTTLE_MS = 3_000;
const STALE_MS = 7_000;

interface Typer {
  id: string;
  name: string;
  at: number;
}

export function useTyping(chatId: string | undefined) {
  const [typers, setTypers] = useState<Typer[]>([]);
  const lastSent = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Gelen ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;

    const release = onGatewayEvent(ServerEvent.TYPING, (frame) => {
      const payload = frame as unknown as TypingPayload;
      if (payload.chatId !== chatId || !payload.profile?.id) return;

      setTypers((current) => {
        const others = current.filter((t) => t.id !== payload.profile.id);
        if (!payload.isTyping) return others;
        return [
          ...others,
          {
            id: payload.profile.id,
            name: payload.profile.name?.trim() || payload.profile.username,
            at: Date.now(),
          },
        ];
      });
    });

    return () => {
      release();
      setTypers([]);
    };
  }, [chatId]);

  // Bayat kayıtları temizle — yalnızca gösterge görünürken çalışır.
  useEffect(() => {
    if (typers.length === 0) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - STALE_MS;
      setTypers((current) => {
        const fresh = current.filter((t) => t.at > cutoff);
        return fresh.length === current.length ? current : fresh;
      });
    }, 2_000);
    return () => clearInterval(timer);
  }, [typers.length]);

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

  // Ekrandan çıkarken "yazmayı bıraktım" bildir.
  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (chatId && lastSent.current > 0) {
        sendGatewayEvent({ event_type: ClientEvent.TYPING, chat_id: chatId, is_typing: false });
      }
    };
  }, [chatId]);

  return { typers, notifyTyping };
}

/** Gösterge metni — üçten fazla kişide isim saymak yerine sayı verilir. */
export function typingLabel(typers: { name: string }[]): string | null {
  if (typers.length === 0) return null;
  if (typers.length === 1) return `${typers[0].name} yazıyor…`;
  if (typers.length === 2) return `${typers[0].name} ve ${typers[1].name} yazıyor…`;
  if (typers.length === 3) {
    return `${typers[0].name}, ${typers[1].name} ve ${typers[2].name} yazıyor…`;
  }
  return "Birkaç kişi yazıyor…";
}
