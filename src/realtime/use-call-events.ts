import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import { handOffToCall, startRing, stopRing } from "@/features/call/ringer";
import { dismissCallNotifications } from "@/lib/notifications";
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
 *   aranan  ← `incoming_call` { caller, type, callId, expiresAt, directChannelId }
 *           → emit `call_accepted` | `call_denied` { callerId, callId }
 *           ← `call_cancelled` { caller, callId }      (vazgeçildi / 45 sn doldu)
 *           ← `call_handled_elsewhere` { callId, status }
 *           ← `pending_call_invites` [ … ]             (sync_call_state yanıtı)
 *
 * Davet 45 saniye sonra sunucuda kendiliğinden düşer ve `call_cancelled`
 * gelir — istemcide ayrıca zamanlayıcı tutmaya gerek yok.
 */

interface IncomingCallPayload {
  caller: CallPeer;
  type?: string;
  callId: string;
  expiresAt?: number;
  directChannelId?: string | null;
}

/** `pending_call_invites` öğesi — alan adları `incoming_call`'dan FARKLI. */
interface PendingInvitePayload {
  id: string;
  caller: CallPeer;
  callType?: string;
  status?: string;
  expiresAt?: number;
  directChannelId?: string | null;
}

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

      const ringFor = (payload: {
        callId: string;
        caller: CallPeer;
        kind: CallKind;
        expiresAt?: number;
        directId: string | null;
      }) => {
        void startRing("incoming");
        start({
          callId: payload.callId,
          direction: "incoming",
          status: "ringing",
          kind: payload.kind,
          peer: payload.caller,
          directId: payload.directId,
          expiresAt: payload.expiresAt,
        });
      };

      const onIncoming = (payload: IncomingCallPayload) => {
        if (!payload?.caller) return;
        ringFor({
          callId: payload.callId,
          caller: payload.caller,
          kind: (payload.type as CallKind) ?? "audio",
          expiresAt: payload.expiresAt,
          directId: payload.directChannelId ?? null,
        });
      };

      /**
       * Uygulama KAPALIYKEN gelen arama.
       *
       * Bildirime dokunup uygulamayı açan kullanıcı için soket olayı çoktan
       * kaçtı; süreç o sırada yaşamıyordu. Bağlantı kurulur kurulmaz
       * `sync_call_state` yayınlanıyor ve sunucu hâlâ çalan davetleri
       * buradan geri veriyor. Bu dinleyici olmadan bildirime dokunmak
       * kullanıcıyı boş bir ekrana bırakıyordu: telefon çalmış, uygulama
       * açılmış, ama ortada arama yok.
       */
      const onPendingInvites = (invites: PendingInvitePayload[] | undefined) => {
        if (!Array.isArray(invites) || invites.length === 0) return;
        // Aynı anda tek çağrı olabilir; hâlâ çalan İLK daveti al.
        const invite = invites.find((item) => item.status === "ringing" || !item.status);
        if (!invite?.caller) return;
        // Kullanıcı bu arada aramayı zaten görüyorsa yeniden başlatma.
        if (useCall.getState().session?.callId === invite.id) return;

        ringFor({
          callId: invite.id,
          caller: invite.caller,
          kind: (invite.callType as CallKind) ?? "audio",
          expiresAt: invite.expiresAt,
          directId: invite.directChannelId ?? null,
        });
      };

      const onAccepted = (payload: { callId?: string }) => {
        void handOffToCall();
        markConnected(payload?.callId);
      };

      const stopCall = () => {
        stopRing();
        void dismissCallNotifications();
        end();
        // Çağrı sistem mesajı (CALL_*) sohbete düşer; liste tazelensin.
        void queryClient.invalidateQueries({ queryKey: qk.directs });
      };

      socket.on(ServerEvent.INCOMING_CALL, onIncoming);
      socket.on(ServerEvent.PENDING_CALL_INVITES, onPendingInvites);
      socket.on(ServerEvent.CALL_ACCEPTED, onAccepted);
      socket.on(ServerEvent.CALL_DENIED, stopCall);
      socket.on(ServerEvent.CALL_CANCELLED, stopCall);
      socket.on(ServerEvent.CALL_REJECTED, stopCall);
      socket.on(ServerEvent.CALL_HANDLED_ELSEWHERE, stopCall);

      // Uygulama yeniden açıldığında bekleyen davet olabilir. Yeniden
      // bağlanmada da tekrarlanmalı: soket koptuğu sırada gelen arama
      // yalnızca bu yolla öğrenilir.
      const syncCallState = () => socket.emit(ClientEvent.SYNC_CALL_STATE);
      syncCallState();
      socket.on("connect", syncCallState);

      detach = () => {
        socket.off(ServerEvent.INCOMING_CALL, onIncoming);
        socket.off(ServerEvent.PENDING_CALL_INVITES, onPendingInvites);
        socket.off(ServerEvent.CALL_ACCEPTED, onAccepted);
        socket.off(ServerEvent.CALL_DENIED, stopCall);
        socket.off(ServerEvent.CALL_CANCELLED, stopCall);
        socket.off(ServerEvent.CALL_REJECTED, stopCall);
        socket.off(ServerEvent.CALL_HANDLED_ELSEWHERE, stopCall);
        socket.off("connect", syncCallState);
      };
    });

    return () => {
      cancelled = true;
      detach?.();
      stopRing();
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
      // Arayanın duyduğu bekleme tonu — karşı taraf açana kadar çalar.
      void startRing("outgoing");
    },
    [start]
  );

  /**
   * Gelen aramayı kabul et.
   *
   * `getSocket()` kullanılıyor, `peekSocket()` değil: bildirimden açılan
   * uygulamada soket henüz kurulmamış olabilir ve senkron bir `peek` o anda
   * `null` döner — kullanıcı "Kabul et"e basar, hiçbir şey olmaz, arayan
   * tarafta telefon çalmaya devam ederdi.
   */
  const acceptCall = useCallback(
    async (directId: string | null) => {
      const session = useCall.getState().session;
      if (!session) return;

      await handOffToCall();
      void dismissCallNotifications();

      const socket = await getSocket();
      socket?.emit(ClientEvent.CALL_ACCEPTED, {
        callerId: session.peer.id,
        callId: session.callId,
      });

      // Oda kimliği çözülemediyse mevcut değeri koru; ekran bu durumu
      // ayrıca ele alıyor (bağlanamayan çağrı için açık bir hata).
      useCall.setState({
        session: { ...session, directId: directId ?? session.directId },
      });
      markConnected();
    },
    [markConnected]
  );

  /** Gelen aramayı reddet. */
  const declineCall = useCallback(async () => {
    const session = useCall.getState().session;
    if (!session) return;
    stopRing();
    void dismissCallNotifications();
    const socket = await getSocket();
    socket?.emit(ClientEvent.CALL_DENIED, {
      callerId: session.peer.id,
      callId: session.callId,
    });
    end();
  }, [end]);

  /** Kendi aramanı iptal et veya bağlı çağrıyı kapat. */
  const hangUp = useCallback(() => {
    const session = useCall.getState().session;
    if (!session) return;
    stopRing();
    void dismissCallNotifications();
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
