import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { usePresenceStore } from "@/stores/presence";
import { useAuth } from "@/stores/auth";
import { ClientEvent } from "./events";
import { connectSocket, disconnectSocket, peekSocket } from "./socket";
import { useMessageNotifications } from "./use-message-notifications";
import { useSocialEvents } from "./use-social-events";

/**
 * Gerçek zamanlı katmanı uygulama yaşam döngüsüne bağlar.
 *
 * Sorumluluk yalnızca YAŞAM DÖNGÜSÜ: bağlan / kes / ön plana dön.
 * Presence yayınlarının dinlenmesi `socket.ts` içinde, soket kurulurken
 * senkron olarak yapılır — bir React effect'inde yapıldığında sunucunun
 * bağlantı anında gönderdiği ilk `presence:batch` kaçırılıyordu.
 *
 * Görsel bir şey render etmez; kök düzende bir kez çağrılır.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const resetPresence = usePresenceStore((s) => s.reset);

  // Sohbet ekranından bağımsız sosyal olaylar (arkadaşlık, yeni DM).
  useSocialEvents();
  // Arka plandayken gelen DM'ler için yerel bildirim.
  useMessageNotifications();

  // ── Bağlantı ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "signedIn") {
      disconnectSocket();
      resetPresence();
      return;
    }
    void connectSocket();
  }, [status, resetPresence]);

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
        // iOS soketi bir süre sonra zaten öldürür; bunu presence olarak da
        // yansıtmazsak kullanıcı arkadaşlarına saatlerce çevrimiçi görünür.
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
