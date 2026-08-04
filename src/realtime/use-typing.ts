import { useCallback, useEffect, useRef, useState } from "react";

import { ClientEvent, ServerEvent, type TypingPayload } from "./events";
import { getSocket, peekSocket } from "./socket";

/**
 * "Yazıyor…" göstergesi.
 *
 * İki yönlü:
 *  - `typers`  : bu sohbette şu an yazanlar (sunucudan gelen)
 *  - `notifyTyping()` : kendi yazma durumunu bildirir
 *
 * Giden bildirim kısılır (throttle): her tuş vuruşunda olay yollamak
 * hareketli bir kanalda soketi boğar. Bir kez "yazıyor" gönderilir, 3 sn
 * sessizlikten sonra "durdu" gönderilir.
 *
 * Gelen kayıtlar da kendi kendine sönümlenir: karşı taraf uygulamayı
 * kapatırsa "durdu" olayı hiç gelmez ve gösterge sonsuza dek asılı kalırdı.
 */

const THROTTLE_MS = 3_000;
const STALE_MS = 7_000;

interface Typer {
  id: string;
  name: string;
  at: number;
}

export function useTyping(chatId: string | undefined, kind: "channel" | "direct") {
  const [typers, setTypers] = useState<Typer[]>([]);
  const lastSent = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Gelen ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    void getSocket().then((socket) => {
      if (!socket || cancelled) return;

      const onTyping = (payload: TypingPayload) => {
        if (payload.id !== chatId || !payload.profile) return;

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
      };

      socket.on(ServerEvent.TYPING, onTyping);
      detach = () => socket.off(ServerEvent.TYPING, onTyping);
    });

    return () => {
      cancelled = true;
      detach?.();
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
    const socket = peekSocket();
    if (!socket?.connected) return;

    const now = Date.now();
    if (now - lastSent.current > THROTTLE_MS) {
      lastSent.current = now;
      socket.emit(ClientEvent.TYPING, { type: kind, id: chatId, isTyping: true });
    }

    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      lastSent.current = 0;
      peekSocket()?.emit(ClientEvent.TYPING, {
        type: kind,
        id: chatId,
        isTyping: false,
      });
    }, THROTTLE_MS);
  }, [chatId, kind]);

  // Ekrandan çıkarken "yazmayı bıraktım" bildir.
  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (chatId && lastSent.current > 0) {
        peekSocket()?.emit(ClientEvent.TYPING, {
          type: kind,
          id: chatId,
          isTyping: false,
        });
      }
    };
  }, [chatId, kind]);

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
