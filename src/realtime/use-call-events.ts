import { useCallback, useEffect } from "react";
import { Alert, Vibration } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { useAuth } from "@/stores/auth";
import { useCall, type CallKind, type CallPeer } from "@/stores/call";
import { usePresenceStore } from "@/stores/presence";
import { ServerEvent } from "./events";
import { onGatewayEvent, onGatewayOpen } from "./gateway";

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
 * ⚠️ Zil sesi varlığı yok; titreşim deseni kullanılıyor.
 */

/** Zil titreşimi: 1 sn beklet, 0.6 sn titret — döngüsel. */
const RING_PATTERN = [1000, 600, 1000, 600];

interface IncomingCallFrame {
  caller: CallPeer;
  type?: string;
  callId: string;
  expiresAt?: number;
  directChannelId?: string | null;
}

interface PendingInvite {
  id: string;
  caller: CallPeer;
  callType: string;
  expiresAt: number;
  directChannelId: string | null;
}

function ring(frame: IncomingCallFrame) {
  // "Rahatsız etmeyin" modundaki kullanıcıya arama gösterilmez (web ile aynı).
  if (usePresenceStore.getState().selfStatus === "DND") return;
  if (!frame?.caller || !frame.callId) return;
  // Aynı davet ikinci kez (bekleyenler + canlı yayın) çalmasın.
  if (useCall.getState().session?.callId === frame.callId) return;

  Vibration.vibrate(RING_PATTERN, true);
  useCall.getState().start({
    callId: frame.callId,
    direction: "incoming",
    status: "ringing",
    kind: frame.type === "video" ? "video" : "audio",
    peer: frame.caller,
    directId: frame.directChannelId ?? null,
    expiresAt: frame.expiresAt,
  });
}

export function useCallEvents() {
  const status = useAuth((s) => s.status);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== "signedIn") return;

    const stopCall = () => {
      Vibration.cancel();
      useCall.getState().end();
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

      onGatewayOpen(() => {
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
      }),
    ];

    return () => {
      releases.forEach((release) => release());
      Vibration.cancel();
    };
  }, [status, queryClient]);
}

/** Çağrı eylemleri — ekranlar bunları kullanır. */
export function useCallActions() {
  const start = useCall((s) => s.start);
  const markConnected = useCall((s) => s.markConnected);
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
          Alert.alert("Aranamıyor", reason);
        });
    },
    [start, end]
  );

  /** Gelen aramayı kabul et. */
  const acceptCall = useCallback(
    (directId: string) => {
      const session = useCall.getState().session;
      if (!session) return;
      Vibration.cancel();
      void api(endpoints.callAccept, {
        method: "POST",
        body: { callId: session.callId, callerId: session.peer.id },
      }).catch(() => {});
      useCall.setState({ session: { ...session, directId } });
      markConnected();
    },
    [markConnected]
  );

  /** Gelen aramayı reddet. */
  const declineCall = useCallback(() => {
    const session = useCall.getState().session;
    if (!session) return;
    Vibration.cancel();
    void api(endpoints.callDecline, {
      method: "POST",
      body: { callId: session.callId, callerId: session.peer.id },
    }).catch(() => {});
    end();
  }, [end]);

  /** Kendi aramanı iptal et veya bağlı çağrıyı kapat. */
  const hangUp = useCallback(() => {
    const session = useCall.getState().session;
    if (!session) return;
    Vibration.cancel();
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
