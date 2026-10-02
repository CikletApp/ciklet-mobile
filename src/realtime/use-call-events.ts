import { useCallback, useEffect } from "react";
import { AppState, Vibration } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import {
  acceptIncomingCall,
  consumePendingCallAction,
  declineIncomingCall,
  dismissIncomingCallNotification,
  nativeIncomingCalls,
  presentIncomingCallNotification,
} from "@/features/call/incoming-call";
import { useAuth } from "@/stores/auth";
import { useCall, type CallKind, type CallPeer } from "@/stores/call";
import { usePresenceStore } from "@/stores/presence";
import { ServerEvent } from "./events";
import { onGatewayEvent, onGatewayOpen } from "./gateway";
import { showDialog } from "@/components/ui";
import { startRingtone, stopRingtone } from "@/lib/sounds";

/**
 * DM aramaları — ADR-0012 sonrası.
 *
 * EYLEMLER HTTP (bir veri yazması: davet kaydı, DM'deki arama kartı),
 * SONUÇLAR ağ geçidinden gelir (ciklet-web `lib/calls/service.ts`):
 *
 *   arayan  → POST /api/calls { receiverId, type } → { callId, expiresAt }
 *           ← `call.accepted` { profile, callId } | `call.denied` { profile, callId }
 *           → POST /api/calls/cancel { callId }
 *   aranan  ← `call.incoming` { caller, type, callId, expiresAt, directChannelId }
 *           → POST /api/calls/accept | /decline { callId, callerId }
 *           ← `call.cancelled` { caller, callId }  (vazgeçildi / 45 sn doldu)
 *           ← `call.handled_elsewhere` { callId }  (başka cihazda yanıtlandı)
 *
 * Bekleyen davetler ağ geçidinde değil Redis'te tutuluyor ve bağlantı
 * kurulunca kendiliğinden GELMİYOR: her açılışta `/api/calls/pending`
 * sorulur, yoksa kopukken gelen arama hiç görünmezdi.
 *
 * Zil: ön planda titreşim deseni + döngülü zil sesi (lib/sounds,
 * assets/sounds/ringtone.wav). Arka planda/kapalıyken Android'de sistem
 * bildirimi (tam ekran + Cevapla/Reddet, zil kanaldan) — bkz.
 * features/call/incoming-call.ts; ekrana dönünce JS zili devralır.
 */

/** Zil titreşimi: 1 sn beklet, 0.6 sn titret — döngüsel. */
const RING_PATTERN = [1000, 600, 1000, 600];

export interface IncomingCallFrame {
  caller: CallPeer;
  type?: string;
  callId: string;
  expiresAt?: number;
  directChannelId?: string | null;
  /** Yalnızca push'tan gelir: süreç ölüyken "Reddet" için tek kullanımlık adres. */
  declineUrl?: string | null;
}

interface PendingInvite {
  id: string;
  caller: CallPeer;
  callType: string;
  expiresAt: number;
  directChannelId: string | null;
}

/**
 * Bekleyen davetleri sorar ve varsa çaldırır. Bağlantı her açıldığında
 * (kopukken gelen arama), bir ARAMA PUSH'U geldiğinde (soket zombi ya da
 * kopuk olabilir; push her durumda ulaşır) ve bildirimden açılışta çağrılır.
 */
export function pollPendingInvites(): void {
  void api<{ invites?: PendingInvite[] }>(endpoints.callsPending)
    .then(({ invites }) => {
      const invite = invites?.[0];
      if (!invite) return;
      ring({
        caller: invite.caller,
        type: invite.callType,
        callId: invite.id,
        expiresAt: invite.expiresAt,
        directChannelId: invite.directChannelId,
      });
    })
    .catch(() => {});
}

function startLocalRing() {
  Vibration.vibrate(RING_PATTERN, true);
  void startRingtone();
}

/**
 * Çaldır. Ön planda uygulama içi zil; arka planda/kapalıyken (arka plan
 * bildirim görevinden de çağrılır) sistem bildirimi. Bildirimden "Cevapla"
 * ile gelindiyse davet yüklenir yüklenmez kabul edilir.
 */
export function ring(frame: IncomingCallFrame) {
  // "Rahatsız etmeyin" modundaki kullanıcıya arama gösterilmez (web ile aynı).
  if (usePresenceStore.getState().selfStatus === "DND") return;
  if (!frame?.caller || !frame.callId) return;
  // Aynı davet ikinci kez (bekleyenler + canlı yayın + push) çalmasın.
  if (useCall.getState().session?.callId === frame.callId) return;

  const video = frame.type === "video";
  useCall.getState().start({
    callId: frame.callId,
    direction: "incoming",
    status: "ringing",
    kind: video ? "video" : "audio",
    peer: frame.caller,
    directId: frame.directChannelId ?? null,
    expiresAt: frame.expiresAt,
  });

  const pendingAction = consumePendingCallAction(frame.callId);
  if (pendingAction === "accept" && frame.directChannelId) {
    acceptIncomingCall(frame.directChannelId);
    return;
  }

  if (AppState.currentState === "active" || !nativeIncomingCalls) {
    startLocalRing();
    return;
  }
  void presentIncomingCallNotification({
    callId: frame.callId,
    caller: frame.caller,
    video,
    directId: frame.directChannelId ?? null,
    expiresAt: frame.expiresAt ?? null,
    declineUrl: frame.declineUrl ?? null,
  }).then((shown) => {
    if (!shown && useCall.getState().session?.callId === frame.callId) startLocalRing();
  });
}

/** Çalan ya da bağlı çağrıyı yerelde kapat (sunucuya istek atmaz). */
export function stopCallLocally(): void {
  const session = useCall.getState().session;
  Vibration.cancel();
  stopRingtone();
  dismissIncomingCallNotification(session?.callId);
  useCall.getState().end();
}

export function useCallEvents() {
  const status = useAuth((s) => s.status);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== "signedIn") return;

    const stopCall = () => {
      stopCallLocally();
      // Arama kartı (CALL_*) sohbete düşer; liste tazelensin.
      void queryClient.invalidateQueries({ queryKey: qk.directs });
    };

    const releases = [
      onGatewayEvent(ServerEvent.CALL_INCOMING, (frame) => ring(frame as unknown as IncomingCallFrame)),

      onGatewayEvent(ServerEvent.CALL_ACCEPTED, (frame) => {
        const session = useCall.getState().session;
        if (session?.direction !== "outgoing") return;
        if (session.callId && frame.callId && session.callId !== frame.callId) return;
        Vibration.cancel();
        useCall.getState().markConnected(frame.callId as string | undefined);
      }),

      onGatewayEvent(ServerEvent.CALL_DENIED, (frame) => {
        const session = useCall.getState().session;
        if (session?.callId && frame.callId && session.callId !== frame.callId) return;
        stopCall();
      }),

      onGatewayEvent(ServerEvent.CALL_CANCELLED, (frame) => {
        const session = useCall.getState().session;
        if (session?.callId && frame.callId && session.callId !== frame.callId) return;
        stopCall();
      }),

      // Odalarda "gönderen hariç" yok: kendi kabulümüz/reddimiz de bu
      // cihaza "başka yerde yanıtlandı" olarak döner. Yalnızca hâlâ ÇALAN
      // bir davet kapatılır; bağlanmış görüşmeye dokunulmaz.
      onGatewayEvent(ServerEvent.CALL_HANDLED_ELSEWHERE, (frame) => {
        const session = useCall.getState().session;
        if (!session || session.callId !== frame.callId || session.status !== "ringing") return;
        stopCall();
      }),

      onGatewayOpen(pollPendingInvites),
    ];

    // Arka planda sistem bildirimi çalarken ekrana dönüldü: bildirimi düşür,
    // zili uygulama devralsın (CallOverlay zaten görünür).
    const appState = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const session = useCall.getState().session;
      if (session?.direction === "incoming" && session.status === "ringing") {
        dismissIncomingCallNotification(session.callId);
        startLocalRing();
      }
    });

    // Bildirimdeki "Reddet" (süreç yaşıyorsa yerel modül olay gönderir).
    const nativeActions = nativeIncomingCalls?.addListener("onCallAction", ({ action, callId }) => {
      if (action !== "decline") return;
      const session = useCall.getState().session;
      if (session?.callId === callId && session.status === "ringing") {
        declineIncomingCall();
        void queryClient.invalidateQueries({ queryKey: qk.directs });
      } else {
        dismissIncomingCallNotification(callId);
      }
    });

    return () => {
      releases.forEach((release) => release());
      appState.remove();
      nativeActions?.remove();
      Vibration.cancel();
      stopRingtone();
    };
  }, [status, queryClient]);
}

/** Çağrı eylemleri — ekranlar bunları kullanır. */
export function useCallActions() {
  const start = useCall((s) => s.start);
  const end = useCall((s) => s.end);

  /** Bir kişiyi ara. `directId` LiveKit oda adı olarak kullanılır. */
  const placeCall = useCallback(
    (peer: CallPeer, directId: string, kind: CallKind = "audio") => {
      start({ callId: null, direction: "outgoing", status: "calling", kind, peer, directId });

      void api<{ callId: string; expiresAt: number }>(endpoints.calls, {
        method: "POST",
        body: { receiverId: peer.id, type: kind },
      })
        .then(({ callId, expiresAt }) => {
          const session = useCall.getState().session;
          // Bu arada kapatıldıysa sunucudaki daveti de düşür.
          if (!session || session.peer.id !== peer.id) {
            void api(endpoints.callCancel, { method: "POST", body: { callId } }).catch(() => {});
            return;
          }
          useCall.setState({ session: { ...session, callId, expiresAt } });
        })
        .catch((error) => {
          end();
          const reason =
            error instanceof ApiError && error.status === 403
              ? `${peer.name?.trim() || peer.username} şu an arama kabul etmiyor.`
              : "Arama başlatılamadı. Bağlantını kontrol edip tekrar dene.";
          showDialog("Aranamıyor", reason);
        });
    },
    [start, end]
  );

  /** Gelen aramayı kabul et. */
  const acceptCall = useCallback((directId: string) => {
    acceptIncomingCall(directId);
  }, []);

  /** Gelen aramayı reddet. */
  const declineCall = useCallback(() => {
    declineIncomingCall();
  }, []);

  /** Kendi aramanı iptal et veya bağlı çağrıyı kapat. */
  const hangUp = useCallback(() => {
    const session = useCall.getState().session;
    if (!session) return;
    Vibration.cancel();
    stopRingtone();
    dismissIncomingCallNotification(session.callId);
    if (session.direction === "outgoing" && session.status !== "connected") {
      void api(endpoints.callCancel, {
        method: "POST",
        body: { callId: session.callId ?? undefined, receiverId: session.peer.id },
      }).catch(() => {});
    }
    end();
  }, [end]);

  return { placeCall, acceptCall, declineCall, hangUp };
}
