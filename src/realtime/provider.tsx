import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { usePresenceStore } from "@/stores/presence";
import { useAuth } from "@/stores/auth";
import {
  ClientEvent,
  ServerEvent,
  type PresenceBatchPayload,
  type PresenceSelfPayload,
  type PresenceUpdatePayload,
  type RichPresencePayload,
} from "./events";
import { connectSocket, disconnectSocket, peekSocket } from "./socket";
import { useSocialEvents } from "./use-social-events";

/**
 * Gerçek zamanlı katmanı uygulama yaşam döngüsüne bağlar.
 *
 * Sorumluluklar:
 *  1. Oturum açıldığında bağlan, kapandığında kes.
 *  2. Uygulama arka plana alındığında sunucuya "boşta" bildir; iOS zaten
 *     soketi bir süre sonra öldürür, bunu presence olarak da yansıtmak
 *     gerekir yoksa kullanıcı arkadaşlarına saatlerce "çevrimiçi" görünür.
 *  3. Presence yayınlarını depoya yazmak.
 *
 * Görsel bir şey render etmez; kök düzende bir kez çağrılır.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const applyBatch = usePresenceStore((s) => s.applyBatch);
  const setStatus = usePresenceStore((s) => s.setStatus);
  const setActivity = usePresenceStore((s) => s.setActivity);
  const setSelfStatus = usePresenceStore((s) => s.setSelfStatus);
  const resetPresence = usePresenceStore((s) => s.reset);

  // Sohbet ekranından bağımsız sosyal olaylar (arkadaşlık, yeni DM).
  useSocialEvents();

  // ── Bağlantı + presence dinleyicileri ─────────────────────────────
  useEffect(() => {
    if (status !== "signedIn") {
      disconnectSocket();
      resetPresence();
      return;
    }

    let cancelled = false;
    let detach: (() => void) | undefined;

    void connectSocket().then((socket) => {
      if (!socket || cancelled) return;

      const onBatch = ({ statuses, activities }: PresenceBatchPayload) =>
        applyBatch(statuses ?? {}, activities ?? {});
      const onUpdate = ({ userId, status: next }: PresenceUpdatePayload) =>
        setStatus(userId, next);
      const onSelf = ({ status: next }: PresenceSelfPayload) => setSelfStatus(next);
      const onRich = ({ userId, activity }: RichPresencePayload) =>
        setActivity(userId, activity);

      socket.on(ServerEvent.PRESENCE_BATCH, onBatch);
      socket.on(ServerEvent.PRESENCE_UPDATE, onUpdate);
      socket.on(ServerEvent.PRESENCE_SELF, onSelf);
      socket.on(ServerEvent.RICH_PRESENCE_UPDATE, onRich);

      detach = () => {
        socket.off(ServerEvent.PRESENCE_BATCH, onBatch);
        socket.off(ServerEvent.PRESENCE_UPDATE, onUpdate);
        socket.off(ServerEvent.PRESENCE_SELF, onSelf);
        socket.off(ServerEvent.RICH_PRESENCE_UPDATE, onRich);
      };
    });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [status, applyBatch, setStatus, setActivity, setSelfStatus, resetPresence]);

  // ── Ön plan / arka plan ───────────────────────────────────────────
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (status !== "signedIn") return;

    const subscription = AppState.addEventListener("change", (next) => {
      const wasActive = appState.current === "active";
      const isActive = next === "active";
      appState.current = next;

      const socket = peekSocket();

      if (isActive && !wasActive) {
        // Uygulama günlerce arka planda kalmış olabilir; token'ın süresi
        // dolmadan tazele. Soket el sıkışması eski token'ı kullanırsa
        // sunucu bağlantıyı reddeder.
        void useAuth.getState().ensureFreshSession();

        // Geri dönüşte: bağlantı koptuysa kur, ayaktaysa boşta bayrağını kaldır.
        if (socket?.connected) {
          socket.emit(ClientEvent.PRESENCE_IDLE, { isIdle: false });
          socket.emit(ClientEvent.PRESENCE_SYNC);
        } else {
          void connectSocket();
        }
      } else if (!isActive && wasActive) {
        socket?.emit(ClientEvent.PRESENCE_IDLE, { isIdle: true });
      }
    });

    return () => subscription.remove();
  }, [status]);

  return <>{children}</>;
}

/** Kullanıcının elle seçtiği durumu sunucuya bildirir. */
export function setSelfPresence(status: PresenceStatus) {
  peekSocket()?.emit(ClientEvent.PRESENCE_SET_STATUS, { status });
}
