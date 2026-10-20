import { useCallback, useEffect } from "react";
import { AppState, Vibration } from "react-native";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import type { DirectSummary } from "@/api/types";
import {
  callKit,
  currentVoipToken,
  isCurrentCallKitCall,
  reportIncomingToCallKit,
  setCallKitEndReason,
} from "@/features/call/callkit";
import {
  acceptIncomingCall,
  consumePendingCallAction,
  declineIncomingCall,
  dismissIncomingCallNotification,
  nativeIncomingCalls,
  presentIncomingCallNotification,
  setPendingCallAction,
} from "@/features/call/incoming-call";
import { resolveMediaUrl } from "@/lib/config";
import { registerPushToken } from "@/lib/notifications";
import type { CallKitActionEvent, NativeIncomingCall, StartCallRequest } from "../../modules/ciklet-calls";
import { useAuth } from "@/stores/auth";
import { useCall, type CallKind, type CallPeer } from "@/stores/call";
import { usePresenceStore } from "@/stores/presence";
import { ServerEvent } from "./events";
import { onGatewayEvent, onGatewayOpen } from "./gateway";
import { showDialog } from "@/components/ui";
import { playBusyTone, startRingtone, stopRingtone } from "@/lib/sounds";

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
 *
 * iOS'ta (CallKit, features/call/callkit.ts) zili HER DURUMDA sistem çalar
 * ve gelen aramanın TEK arayüzü sistemin arama arayüzüdür (WhatsApp gibi):
 * önde üst şerit, kilitliyken/arka planda tam ekran. Uygulama içi zil ekranı
 * (CallOverlay) ve zil sesi/titreşim çizilmez/çalınmaz — ikisi üst üste
 * binerdi (`ringsInSystemUi`). Yalnızca sistem çağrıyı almazsa (Rahatsız
 * Etmeyin vb.) ya da kabulde oda adı çözülemezse uygulama içi zile dönülür.
 * Bunun bedeli: "mesajla reddet" iOS'ta sistem arayüzünde yok.
 * Kapalı uygulamaya arama VoIP push'la gelir; yerel taraf çağrıyı JS'ten
 * önce bildirir, JS açılınca `takePendingEvents` ile durumu devralır.
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
    ringsInSystemUi: callKit !== null,
  });

  const pendingAction = consumePendingCallAction(frame.callId);
  if (pendingAction === "accept" && frame.directChannelId) {
    acceptIncomingCall(frame.directChannelId);
    return;
  }

  if (callKit) {
    // Sistem çalar (ön planda üst şerit, kilitliyken tam ekran). VoIP
    // push'la zaten bildirildiyse yerel taraf ikinciyi yok sayar.
    reportIncomingToCallKit({
      callId: frame.callId,
      callerId: frame.caller.id,
      callerName: frame.caller.name?.trim() || frame.caller.username,
      callerAvatar: resolveMediaUrl(frame.caller.imageUrl) ?? "",
      callType: video ? "video" : "audio",
      directId: frame.directChannelId ?? "",
      declineUrl: frame.declineUrl ?? "",
      expiresAt: frame.expiresAt,
    });
    return;
  }

  if (AppState.currentState === "active" || !nativeIncomingCalls) {
    // Tam ekran bildirimden açılışta uygulama önce öne gelir, davet sonra
    // yüklenir; sistem bildirimi (ve onun zili) burada düşürülür ki çift
    // zil çalmasın ve bildirim panelde kalmasın.
    dismissIncomingCallNotification(frame.callId);
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
/**
 * Giden aramanın çalma süresi — sunucunun daveti kapattığı süreyle aynı
 * (ciklet-web lib/calls/store CALL_RING_MS, web istemcisi de 45 sn).
 * Sunucu süre dolunca YALNIZCA arananı bilgilendiriyor; mobilde arayan
 * için sayaç yoktu ve ekran sonsuza dek "Aranıyor…"da kalıyordu.
 */
const OUTGOING_RING_MS = 45_000;
/** "Cevap yok" ekranının kalma süresi. */
const NO_ANSWER_HOLD_MS = 2_500;

let outgoingTimer: ReturnType<typeof setTimeout> | null = null;

useCall.subscribe((state, prev) => {
  const isCalling = state.session?.direction === "outgoing" && state.session.status === "calling";
  const wasCalling = prev.session?.direction === "outgoing" && prev.session.status === "calling";
  if (isCalling && !wasCalling) {
    if (outgoingTimer) clearTimeout(outgoingTimer);
    outgoingTimer = setTimeout(expireOutgoingCall, OUTGOING_RING_MS);
  } else if (!isCalling && outgoingTimer) {
    clearTimeout(outgoingTimer);
    outgoingTimer = null;
  }
});

function expireOutgoingCall() {
  outgoingTimer = null;
  const session = useCall.getState().session;
  if (session?.direction !== "outgoing" || session.status !== "calling") return;
  useCall.getState().markNoAnswer();
  // Daveti hemen kapat: karşı tarafın zili de susar, kart "cevapsız" olur
  // (süpürmeyi beklemeden). Hata önemsiz; sunucu süreyle yine kapatır.
  if (session.callId) {
    void api(endpoints.callCancel, { method: "POST", body: { callId: session.callId } }).catch(() => {});
  }
  const callId = session.callId;
  setTimeout(() => {
    const current = useCall.getState().session;
    if (current?.status === "noAnswer" && current.callId === callId) {
      setCallKitEndReason("unanswered");
      stopCallLocally();
    }
  }, NO_ANSWER_HOLD_MS);
}

/** Reddedilen giden aramada "Meşgul" ekranının kalma süresi (meşgul sesi 3 sn). */
const BUSY_HOLD_MS = 3_000;

export function stopCallLocally(): void {
  const session = useCall.getState().session;
  Vibration.cancel();
  stopRingtone();
  dismissIncomingCallNotification(session?.callId);
  useCall.getState().end();
}

/** Kendi aramanı iptal et veya bağlı çağrıyı kapat (kanca dışından da: CallKit "Bitir"). */
export function hangUpCall(): void {
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
  useCall.getState().end();
}

// ── iOS CallKit eylemleri ────────────────────────────────────────────────

function directIdFor(queryClient: QueryClient, peerId: string): string | null {
  const directs = queryClient.getQueryData<DirectSummary[]>(qk.directs);
  return directs?.find((d) => d.profileOne.id === peerId || d.profileTwo.id === peerId)?.id ?? null;
}

function frameFromNative(info: NativeIncomingCall): IncomingCallFrame {
  return {
    callId: info.callId,
    caller: {
      id: info.callerId ?? "",
      username: info.callerName ?? "",
      name: info.callerName ?? null,
      imageUrl: info.callerAvatar || null,
    },
    type: info.callType,
    expiresAt: typeof info.expiresAt === "number" ? info.expiresAt : undefined,
    directChannelId: info.directId || null,
    declineUrl: info.declineUrl || null,
  };
}

/** VoIP push'la gelen (JS'ten önce sisteme bildirilmiş) arama → uygulama durumu. */
function ringFromNative(info: NativeIncomingCall): void {
  if (!info?.callId) return;
  ring(frameFromNative(info));
  // Çalınmadı (Rahatsız Etmeyin, tercih): sistem ekranı da kapansın.
  if (useCall.getState().session?.callId !== info.callId) {
    void callKit?.endCall(info.callId, "unanswered").catch(() => {});
  }
}

/** iOS: sistem arayüzü çalamıyor/yetmiyor — uygulama içi zil ekranını aç. */
function fallBackToInAppRinging(callId: string): void {
  const session = useCall.getState().session;
  if (session?.callId !== callId || session.status !== "ringing" || !session.ringsInSystemUi) return;
  useCall.setState({ session: { ...session, ringsInSystemUi: false } });
}

function handleCallKitAction(event: CallKitActionEvent, queryClient: QueryClient): void {
  const session = useCall.getState().session;
  const ringingHere =
    session?.direction === "incoming" && session.status === "ringing" && session.callId === event.callId;

  switch (event.action) {
    case "accept": {
      if (ringingHere && session) {
        const directId = session.directId ?? (event.directId || null) ?? directIdFor(queryClient, session.peer.id);
        if (directId) {
          acceptIncomingCall(directId);
          return;
        }
      }
      if (ringingHere) {
        // Oda adı yok: uygulama içi zil ekranı açılır, kullanıcı oradan kabul eder.
        fallBackToInAppRinging(event.callId);
        return;
      }
      // Davet henüz yüklenmedi (soğuk açılış): `ring` bekleyen kabulü tüketir —
      // push yükü oda adını taşıyorsa hemen, taşımıyorsa bekleyen davetlerden.
      setPendingCallAction(event.callId, "accept");
      if (event.callerId && event.directId) ring(frameFromNative(event));
      else pollPendingInvites();
      return;
    }
    case "decline": {
      if (ringingHere) {
        if (event.handled) stopCallLocally();
        else declineIncomingCall();
      } else if (!event.handled) {
        void api(endpoints.callDecline, { method: "POST", body: { callId: event.callId, voipToken: currentVoipToken() ?? undefined } }).catch(() => {});
      }
      void queryClient.invalidateQueries({ queryKey: qk.directs });
      return;
    }
    case "hangup":
      if (isCurrentCallKitCall(event.callId)) hangUpCall();
      return;
    case "ended":
      if (ringingHere) {
        stopCallLocally();
        void queryClient.invalidateQueries({ queryKey: qk.directs });
      }
      return;
    case "rejected":
      // Sistem çağrıyı almadı (ör. Rahatsız Etmeyin): uygulama içi zil ekranı,
      // önde zil sesi.
      if (!ringingHere) return;
      fallBackToInAppRinging(event.callId);
      if (AppState.currentState === "active") startLocalRing();
      return;
    default:
      // mute/unmute: LiveKit odasındaki CallKitMuteSync işler.
      return;
  }
}

/**
 * iOS: Telefon uygulamasının Son Aramalar listesinden Ciklet satırına
 * dokunuldu — o kişiyle DM bulunur/açılır (`/api/directs/init` var olanı
 * döndürür) ve aynı türde aranır. Süren bir çağrı varsa yok sayılır.
 */
function callBackFromRecents(request: StartCallRequest): void {
  const peerId = request?.peerId;
  if (!peerId || useCall.getState().session) return;
  void api<DirectSummary>(endpoints.directInit, { method: "POST", body: { friendId: peerId } })
    .then((direct) => {
      if (!direct?.id || useCall.getState().session) return;
      const profile = direct.profileOne.id === peerId ? direct.profileOne : direct.profileTwo;
      if (profile.id !== peerId) return;
      placeCallTo(
        { id: profile.id, username: profile.username, name: profile.name, imageUrl: profile.imageUrl },
        direct.id,
        request.video ? "video" : "audio"
      );
    })
    .catch(() => showDialog("Aranamıyor", "Arama başlatılamadı. Bağlantını kontrol edip tekrar dene."));
}

/** iOS: CallKit/PushKit olaylarını dinle; JS yokken birikenleri devral. */
function attachCallKit(queryClient: QueryClient): () => void {
  const kit = callKit;
  if (!kit) return () => {};
  let alive = true;
  const subscriptions = [
    kit.addListener("onIncomingCall", ringFromNative),
    kit.addListener("onCallAction", (event) => handleCallKitAction(event, queryClient)),
    // Token ilk kez geldi ya da yenilendi: cihaz kaydı güncellensin.
    kit.addListener("onVoipToken", () => void registerPushToken()),
    kit.addListener("onStartCallRequest", callBackFromRecents),
  ];
  void kit
    .takePendingEvents()
    .then((events) => {
      if (!alive) return;
      for (const event of events) {
        if (event.name === "onIncomingCall") ringFromNative(event.body);
        else if (event.name === "onCallAction") handleCallKitAction(event.body, queryClient);
        else if (event.name === "onVoipToken") void registerPushToken();
        else if (event.name === "onStartCallRequest") callBackFromRecents(event.body);
      }
    })
    .catch(() => {});
  return () => {
    alive = false;
    subscriptions.forEach((subscription) => subscription.remove());
    void kit.stopListening().catch(() => {});
  };
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
        // Arayan: telefon gibi "Meşgul" + meşgul sesi, sonra kapanır.
        if (session?.direction === "outgoing" && session.status === "calling") {
          useCall.getState().markBusy();
          void playBusyTone();
          const busyCallId = session.callId;
          setTimeout(() => {
            const current = useCall.getState().session;
            if (current?.status === "busy" && current.callId === busyCallId) {
              setCallKitEndReason("remote");
              stopCall();
            }
          }, BUSY_HOLD_MS);
          return;
        }
        setCallKitEndReason("remote");
        stopCall();
      }),

      onGatewayEvent(ServerEvent.CALL_CANCELLED, (frame) => {
        const session = useCall.getState().session;
        if (session?.callId && frame.callId && session.callId !== frame.callId) return;
        setCallKitEndReason("remote");
        stopCall();
      }),

      // Odalarda "gönderen hariç" yok: kendi kabulümüz/reddimiz de bu
      // cihaza "başka yerde yanıtlandı" olarak döner. Yalnızca hâlâ ÇALAN
      // bir davet kapatılır; bağlanmış görüşmeye dokunulmaz.
      onGatewayEvent(ServerEvent.CALL_HANDLED_ELSEWHERE, (frame) => {
        const session = useCall.getState().session;
        if (!session || session.callId !== frame.callId || session.status !== "ringing") return;
        setCallKitEndReason(frame.status === "denied" ? "declined-elsewhere" : "elsewhere");
        stopCall();
      }),

      onGatewayOpen(pollPendingInvites),
    ];

    // Arka planda sistem bildirimi çalarken ekrana dönüldü: bildirimi düşür,
    // zili uygulama devralsın (CallOverlay zaten görünür).
    const appState = AppState.addEventListener("change", (next) => {
      // iOS: zili CallKit çalıyor; uygulama içi zil üstüne binmesin.
      if (next !== "active" || callKit) return;
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

    const releaseCallKit = attachCallKit(queryClient);

    return () => {
      releases.forEach((release) => release());
      appState.remove();
      nativeActions?.remove();
      releaseCallKit();
      Vibration.cancel();
      stopRingtone();
    };
  }, [status, queryClient]);
}

/** Çağrı eylemleri — ekranlar bunları kullanır. */
/** Bir kişiyi ara (kanca dışından da: Son Aramalar'dan geri arama). `directId` LiveKit oda adıdır. */
export function placeCallTo(peer: CallPeer, directId: string, kind: CallKind = "audio"): void {
  useCall.getState().start({ callId: null, direction: "outgoing", status: "calling", kind, peer, directId });

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
      setCallKitEndReason("failed");
      useCall.getState().end();
      const reason =
        error instanceof ApiError && error.status === 403
          ? `${peer.name?.trim() || peer.username} şu an arama kabul etmiyor.`
          : "Arama başlatılamadı. Bağlantını kontrol edip tekrar dene.";
      showDialog("Aranamıyor", reason);
    });
}

export function useCallActions() {
  /** Bir kişiyi ara. `directId` LiveKit oda adı olarak kullanılır. */
  const placeCall = useCallback((peer: CallPeer, directId: string, kind: CallKind = "audio") => {
    placeCallTo(peer, directId, kind);
  }, []);

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
    hangUpCall();
  }, []);

  return { placeCall, acceptCall, declineCall, hangUp };
}
