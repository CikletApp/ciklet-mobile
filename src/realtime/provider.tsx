import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import type { RichPresence } from "@/api/types";
import { usePresenceStore } from "@/stores/presence";
import { useAuth } from "@/stores/auth";
import { ClientEvent, ServerEvent } from "./events";
import {
  onGatewayEvent,
  sendGatewayEvent,
  startGateway,
  stopGateway,
  wakeGateway,
} from "./gateway";
import { useCallEvents } from "./use-call-events";
import { useMessageNotifications } from "./use-message-notifications";
import { useSocialEvents } from "./use-social-events";

/**
 * Presence dinleyicileri MODÜL YÜKLENİRKEN bağlanır.
 *
 * Ağ geçidi `presence.batch` ve `presence.self`'i bağlantı kurulur kurulmaz
 * gönderiyor. Dinleyici bir effect'te, bağlantıdan SONRA kaydolsaydı bu ilk
 * kareler kaçar ve arkadaşlar kalıcı olarak çevrimdışı görünürdü. Dinleyiciler
 * bağlantı nesnesinde tutulduğu için yeniden bağlanmada da kaybolmuyor.
 */
const presence = () => usePresenceStore.getState();

onGatewayEvent(ServerEvent.PRESENCE_BATCH, (frame) => {
  if (!Array.isArray(frame.statuses)) return;
  const statuses = (frame.statuses as { userId?: unknown; status?: unknown }[])
    .filter((entry) => typeof entry?.userId === "string" && typeof entry?.status === "string")
    .map((entry) => ({ userId: entry.userId as string, status: entry.status as PresenceStatus }));
  presence().applyBatch(statuses, {});
});

onGatewayEvent(ServerEvent.PRESENCE_UPDATE, (frame) => {
  if (typeof frame.userId !== "string" || typeof frame.status !== "string") return;
  presence().setStatus(frame.userId, frame.status as PresenceStatus);
});

// Kendi durumun bütün cihazlarına gider (telefon ↔ masaüstü eşzamanı).
// `status` etkin (özet) durum, `manual` elle seçilen; eski ağ geçidi
// `manual` göndermez.
onGatewayEvent(ServerEvent.PRESENCE_SELF, (frame) => {
  if (typeof frame.status !== "string") return;
  const manual = typeof frame.manual === "string" ? (frame.manual as PresenceStatus) : undefined;
  presence().setSelfStatus(frame.status as PresenceStatus, manual);
});

onGatewayEvent(ServerEvent.RICH_PRESENCE_UPDATE, (frame) => {
  if (typeof frame.userId !== "string") return;
  presence().setActivity(frame.userId, (frame.activity ?? null) as RichPresence | null);
});

/**
 * Gerçek zamanlı katmanı uygulama yaşam döngüsüne bağlar: oturum açıkken
 * bağlan, kapanınca kes, ön plan/arka plan geçişlerinde presence bildir.
 * Görsel bir şey render etmez; kök düzende bir kez kullanılır.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const resetPresence = usePresenceStore((s) => s.reset);

  // Sohbet ekranından bağımsız sosyal olaylar (arkadaşlık, yeni DM, üyelik).
  useSocialEvents();
  // Push token, bildirime dokunma, rozet.
  useMessageNotifications();
  // Gelen/giden çağrılar — ekrandan bağımsız, kök düzeyde dinlenir.
  useCallEvents();

  // ── Bağlantı ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "signedIn") {
      stopGateway();
      resetPresence();
      return;
    }
    startGateway();
  }, [status, resetPresence]);

  // ── Ön plan / arka plan ───────────────────────────────────────────
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (status !== "signedIn") return;

    const subscription = AppState.addEventListener("change", (next) => {
      const wasActive = appState.current === "active";
      const isActive = next === "active";
      appState.current = next;

      if (isActive && !wasActive) {
        // Uygulama günlerce arka planda kalmış olabilir; token'ı tazele,
        // sonra bağlantı koptuysa hemen kur (geri çekilmeyi bekleme).
        void useAuth.getState().ensureFreshSession().finally(wakeGateway);
        sendGatewayEvent({ event_type: ClientEvent.PRESENCE_IDLE, is_idle: false });
        sendGatewayEvent({ event_type: ClientEvent.PRESENCE_SYNC });
      } else if (!isActive && wasActive) {
        // Android/iOS arka plandaki soketi bir süre sonra öldürür; bunu
        // presence'a yansıtmazsak kullanıcı saatlerce çevrimiçi görünür.
        sendGatewayEvent({ event_type: ClientEvent.PRESENCE_IDLE, is_idle: true });
      }
    });

    return () => subscription.remove();
  }, [status]);

  return <>{children}</>;
}

/**
 * Kullanıcının elle seçtiği durumu bildirir. Yanıt `presence.self` olarak
 * gelir; iyimser olarak da hemen uygulanır ki seçim anında görünsün.
 */
export function setSelfPresence(status: PresenceStatus) {
  usePresenceStore.getState().setSelfStatus(status);
  sendGatewayEvent({ event_type: ClientEvent.PRESENCE_SET_STATUS, status });
}
