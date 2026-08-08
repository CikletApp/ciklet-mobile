import { useCallback, useEffect } from "react";
import { Vibration } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import { useAuth } from "@/stores/auth";
import { useCall, type CallKind, type CallPeer } from "@/stores/call";
import { ClientEvent, ServerEvent } from "./events";
import { getSocket, peekSocket } from "./socket";

/**
 * DM arama akışının soket tarafı.
 *
 * Sunucu sözleşmesi (ciklet-web pages/api/socket/io.ts):
 *   arayan  → emit `incoming_call` { receiverId, type }
 *           ← `call_accepted` { profile, callId } | `call_denied` { profile, callId }
 *           ← `call_rejected` { receiverId, reason }   (DM izni yok)
 *           → emit `call_cancelled` { receiverId, callId }
 *   aranan  ← `incoming_call` { caller, type, callId, expiresAt }
 *           → emit `call_accepted` | `call_denied` { callerId, callId }
 *           ← `call_cancelled` { caller, callId }      (vazgeçildi / 45 sn doldu)
 *           ← `call_handled_elsewhere` { callId, status }
 *
 * Davet 45 saniye sonra sunucuda kendiliğinden düşer ve `call_cancelled`
 * gelir — istemcide ayrıca zamanlayıcı tutmaya gerek yok.
 *
 * ⚠️ Zil sesi için ses varlığı YOK; titreşim deseni kullanılıyor. Uygun bir
 * zil sesi eklenirse `expo-audio` ile burada çalınmalı.
 */

/** Zil titreşimi: 1 sn beklet, 0.6 sn titret — döngüsel. */
const RING_PATTERN = [1000, 600, 1000, 600];

export function useCallEvents() {
  const status = useAuth((s) => s.status);
  const queryClient = useQueryClient();

  const start = useCall((s) => s.start);
  const markConnected = useCall((s) => s.markConnected);
  const end = useCall((s) => s.end);

  useEffect(() => {
    if (status !== "signedIn") return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    void getSocket().then((socket) => {
      if (!socket || cancelled) return;

      const onIncoming = (payload: {
        caller: CallPeer;
        type?: string;
        callId: string;
        expiresAt?: number;
        directChannelId?: string;
      }) => {
        if (!payload?.caller) return;
        Vibration.vibrate(RING_PATTERN, true);
        start({
          callId: payload.callId,
          direction: "incoming",
          status: "ringing",
          kind: (payload.type as CallKind) ?? "audio",
          peer: payload.caller,
          directId: payload.directChannelId ?? null,
          expiresAt: payload.expiresAt,
        });
      };

      const onAccepted = (payload: { callId?: string }) => {
        Vibration.cancel();
        markConnected(payload?.callId);
      };

      const stopCall = () => {
        Vibration.cancel();
        end();
        // Çağrı sistem mesajı (CALL_*) sohbete düşer; liste tazelensin.
        void queryClient.invalidateQueries({ queryKey: qk.directs });
      };

      socket.on(ServerEvent.INCOMING_CALL, onIncoming);
      socket.on(ServerEvent.CALL_ACCEPTED, onAccepted);
      socket.on(ServerEvent.CALL_DENIED, stopCall);
      socket.on(ServerEvent.CALL_CANCELLED, stopCall);
      socket.on(ServerEvent.CALL_REJECTED, stopCall);
      socket.on(ServerEvent.CALL_HANDLED_ELSEWHERE, stopCall);

      // Uygulama yeniden açıldığında bekleyen davet olabilir.
      socket.emit(ClientEvent.SYNC_CALL_STATE);

      detach = () => {
        socket.off(ServerEvent.INCOMING_CALL, onIncoming);
        socket.off(ServerEvent.CALL_ACCEPTED, onAccepted);
        socket.off(ServerEvent.CALL_DENIED, stopCall);
        socket.off(ServerEvent.CALL_CANCELLED, stopCall);
        socket.off(ServerEvent.CALL_REJECTED, stopCall);
        socket.off(ServerEvent.CALL_HANDLED_ELSEWHERE, stopCall);
      };
    });

    return () => {
      cancelled = true;
      detach?.();
      Vibration.cancel();
    };
  }, [status, start, markConnected, end, queryClient]);
}

/** Çağrı eylemleri — ekranlar bunları kullanır. */
export function useCallActions() {
  const start = useCall((s) => s.start);
  const markConnected = useCall((s) => s.markConnected);
  const end = useCall((s) => s.end);

  /** Bir kişiyi ara. `directId` LiveKit oda adı olarak kullanılır. */
  const placeCall = useCallback(
    (peer: CallPeer, directId: string, kind: CallKind = "audio") => {
      peekSocket()?.emit(ClientEvent.INCOMING_CALL, {
        receiverId: peer.id,
        type: kind,
      });
      start({
        callId: null,
        direction: "outgoing",
        status: "calling",
        kind,
        peer,
        directId,
      });
    },
    [start]
  );

  /** Gelen aramayı kabul et. */
  const acceptCall = useCallback(
    (directId: string) => {
      const session = useCall.getState().session;
      if (!session) return;
      Vibration.cancel();
      peekSocket()?.emit(ClientEvent.CALL_ACCEPTED, {
        callerId: session.peer.id,
        callId: session.callId,
      });
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
    peekSocket()?.emit(ClientEvent.CALL_DENIED, {
      callerId: session.peer.id,
      callId: session.callId,
    });
    end();
  }, [end]);

  /** Kendi aramanı iptal et veya bağlı çağrıyı kapat. */
  const hangUp = useCallback(() => {
    const session = useCall.getState().session;
    if (!session) return;
    Vibration.cancel();
    if (session.direction === "outgoing" && session.status !== "connected") {
      peekSocket()?.emit(ClientEvent.CALL_CANCELLED, {
        receiverId: session.peer.id,
        callId: session.callId,
      });
    }
    end();
  }, [end]);

  return { placeCall, acceptCall, declineCall, hangUp };
}
