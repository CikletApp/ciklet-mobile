import { useCallback, useEffect } from "react";
import { useRoomContext } from "@livekit/react-native";
import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client";

import { showToast } from "@/components/ui";
import { moveOffEarpiece } from "@/features/voice/audio-route";
import { ensureCameraPermission } from "@/features/voice/use-voice-token";
import { useCall } from "@/stores/call";

/**
 * Sesliden görüntülüye geçiş (WhatsApp'taki kamera düğmesi).
 *
 * İki taraf zaten aynı LiveKit odasında; istek bir LiveKit VERİ MESAJI
 * (güvenilir kanal, ayrı konu). Sunucuya ya da ağ geçidine yeni bir olay
 * gerekmiyor ve mesaj yalnızca o görüşmenin katılımcısına gider.
 *
 *   A: request ──► B: "X görüntülüye geçmek istiyor" [Reddet] [Kabul et]
 *   B: accept  ──► ikisi de kamerayı açar, sahne görüntülüye döner
 *   B: decline ──► A'da "İstek reddedildi"
 *   A: cancel  ──► B'deki istek kapanır (A vazgeçti ya da süre doldu)
 *
 * İki taraf aynı anda isterse (A'nın isteği beklerken B'nin isteği gelir)
 * kabul sayılır: ikisi de zaten görüntülü istiyor.
 *
 * Token ve ses oturumu görüşmenin İLK türüyle kalır (bkz. call-overlay
 * ConnectedCall) — yoksa tür değişimi odayı yeniden kurar, görüşme kopardı.
 */

const TOPIC = "ciklet.call-upgrade";
/** Karşı taraf bu kadar yanıt vermezse istek düşer (eski sürüm yanıt veremez). */
const REQUEST_TIMEOUT_MS = 30_000;

type UpgradeAction = "request" | "accept" | "decline" | "cancel";
const ACTIONS: readonly UpgradeAction[] = ["request", "accept", "decline", "cancel"];

/** Mesaj yalnızca ASCII — TextEncoder'a gerek yok. */
function encode(action: UpgradeAction): Uint8Array<ArrayBuffer> {
  const text = JSON.stringify({ a: action });
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0x7f;
  return bytes;
}

function decode(payload: Uint8Array): UpgradeAction | null {
  if (payload.length > 64) return null;
  try {
    const parsed = JSON.parse(String.fromCharCode(...payload)) as { a?: unknown };
    return ACTIONS.find((action) => action === parsed.a) ?? null;
  } catch {
    return null;
  }
}

async function send(room: Room, action: UpgradeAction): Promise<void> {
  await room.localParticipant.publishData(encode(action), { reliable: true, topic: TOPIC });
}

/**
 * Kamerayı açar ve sahneyi görüntülüye çevirir. Kamera açılamasa da sahne
 * döner: karşı taraf görüntülüde, bizim karemiz avatar olarak kalır.
 */
async function goVideo(room: Room): Promise<void> {
  const { cameraFacing, switchToVideo } = useCall.getState();
  try {
    await room.localParticipant.setCameraEnabled(true, { facingMode: cameraFacing });
  } catch {
    showToast("Kamera açılamadı.");
  }
  moveOffEarpiece();
  switchToVideo();
}

/** Bağlı sesli görüşmede istek gönder / yanıtla. Oda bağlamı içinde çağrılır. */
export function useVideoUpgradeActions() {
  const room = useRoomContext();

  const request = useCallback(async () => {
    const { session, videoUpgrade, setVideoUpgrade } = useCall.getState();
    if (!session || session.kind !== "audio" || videoUpgrade) return;
    // İzin isteği göndermeden önce: kabul geldiğinde sürpriz bir izin
    // penceresi açılmasın, reddedilmişse karşı tarafı boşuna rahatsız etmeyelim.
    if (!(await ensureCameraPermission())) {
      showToast("Görüntülü görüşme için kamera izni gerekiyor.");
      return;
    }
    setVideoUpgrade("outgoing");
    try {
      await send(room, "request");
    } catch {
      setVideoUpgrade(null);
      showToast("İstek gönderilemedi.");
    }
  }, [room]);

  const cancel = useCallback(() => {
    const { videoUpgrade, setVideoUpgrade } = useCall.getState();
    if (videoUpgrade !== "outgoing") return;
    setVideoUpgrade(null);
    void send(room, "cancel").catch(() => undefined);
  }, [room]);

  const accept = useCallback(async () => {
    const { videoUpgrade, setVideoUpgrade } = useCall.getState();
    if (videoUpgrade !== "incoming") return;
    if (!(await ensureCameraPermission())) {
      setVideoUpgrade(null);
      showToast("Görüntülü görüşme için kamera izni gerekiyor.");
      void send(room, "decline").catch(() => undefined);
      return;
    }
    try {
      await send(room, "accept");
    } catch {
      setVideoUpgrade(null);
      showToast("Yanıt gönderilemedi.");
      return;
    }
    await goVideo(room);
  }, [room]);

  const decline = useCallback(() => {
    const { videoUpgrade, setVideoUpgrade } = useCall.getState();
    if (videoUpgrade !== "incoming") return;
    setVideoUpgrade(null);
    void send(room, "decline").catch(() => undefined);
  }, [room]);

  return { request, cancel, accept, decline };
}

/**
 * Gelen istek ve yanıtları dinler. Görüşme küçültülmüşken de takılı olmalı
 * (sahne modalı o sırada sökülür) — ConnectedCall'da odanın doğrudan çocuğu.
 */
export function useVideoUpgradeListener(): void {
  const room = useRoomContext();
  const pending = useCall((s) => s.videoUpgrade);

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== TOPIC || !participant) return;
      const action = decode(payload);
      const state = useCall.getState();
      if (!action || !state.session) return;

      switch (action) {
        case "request":
          if (state.session.kind !== "audio") {
            // Zaten görüntülüdeyiz (yarış) — karşı taraf beklemesin.
            void send(room, "accept").catch(() => undefined);
            return;
          }
          if (state.videoUpgrade === "outgoing") {
            // Aynı anda istendi: ikisi de görüntülü istiyor.
            void send(room, "accept").catch(() => undefined);
            void goVideo(room);
            return;
          }
          state.setVideoUpgrade("incoming");
          // Küçültülmüşse isteği görebilsin.
          if (state.minimized) state.setMinimized(false);
          return;
        case "accept":
          if (state.videoUpgrade === "outgoing") void goVideo(room);
          return;
        case "decline":
          if (state.videoUpgrade === "outgoing") {
            state.setVideoUpgrade(null);
            showToast("Görüntülü görüşme isteği reddedildi.");
          }
          return;
        case "cancel":
          if (state.videoUpgrade === "incoming") state.setVideoUpgrade(null);
          return;
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  // Yanıt gelmeyen istek düşer (karşı tarafta bu özellik yoksa hiç gelmez).
  useEffect(() => {
    if (pending !== "outgoing") return;
    const timer = setTimeout(() => {
      if (useCall.getState().videoUpgrade !== "outgoing") return;
      useCall.getState().setVideoUpgrade(null);
      showToast("Görüntülü görüşme isteğine yanıt gelmedi.");
      void send(room, "cancel").catch(() => undefined);
    }, REQUEST_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending, room]);
}
