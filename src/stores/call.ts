import { create } from "zustand";

/**
 * Çağrı durumu (DM sesli/görüntülü arama).
 *
 * Aynı anda TEK çağrı olabilir. Sunucu da böyle davranıyor: yeni bir davet
 * geldiğinde öncekiler `call_handled_elsewhere` ile kapanır.
 *
 * Yaşam döngüsü:
 *   outgoing: "calling" ──► (call_accepted) ──► "connected"
 *                       └─► (call_denied / call_cancelled / 45sn) ──► null
 *   incoming: "ringing"  ──► (kabul) ──► "connected"
 *                       └─► (reddet / call_cancelled) ──► null
 */

export interface CallPeer {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
}

/** "busy": karşı taraf reddetti — arayan birkaç saniye "Meşgul" görür ve meşgul sesi duyar. */
export type CallStatus = "ringing" | "calling" | "connected" | "busy";
export type CallKind = "audio" | "video";

export interface CallSession {
  /** Sunucunun ürettiği davet kimliği. Giden çağrıda kabul gelene dek yok. */
  callId: string | null;
  direction: "incoming" | "outgoing";
  status: CallStatus;
  kind: CallKind;
  peer: CallPeer;
  /** LiveKit oda adı = DM kimliği. Sunucu `/api/livekit`'te taraflığı doğrular. */
  directId: string | null;
  /** Gelen davetin sunucu tarafındaki son geçerlilik anı (epoch ms). */
  expiresAt?: number;
  startedAt?: number;
}

interface CallState {
  session: CallSession | null;
  /** Mikrofon kapalı mı (bağlı çağrıda). */
  muted: boolean;
  /** Hoparlör açık mı. */
  speaker: boolean;
  /**
   * Bağlı çağrı küçültüldü mü (WhatsApp gibi): tam ekran kapanır, uygulamada
   * gezilir, köşede sürüklenebilir mini pencere kalır. LiveKit odası açık.
   */
  minimized: boolean;
  /** Kendi kameranın yönü — önde ayna görüntü, arkada değil. */
  cameraFacing: "user" | "environment";

  start: (session: CallSession) => void;
  markConnected: (callId?: string | null) => void;
  end: () => void;
  setMuted: (muted: boolean) => void;
  setSpeaker: (speaker: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  markBusy: () => void;
  setCameraFacing: (facing: "user" | "environment") => void;
}

export const useCall = create<CallState>((set) => ({
  session: null,
  muted: false,
  speaker: true,
  minimized: false,
  cameraFacing: "user",

  start: (session) => set({ session, muted: false, speaker: true, minimized: false, cameraFacing: "user" }),

  markConnected: (callId) =>
    set((state) =>
      state.session
        ? {
            session: {
              ...state.session,
              callId: callId ?? state.session.callId,
              status: "connected",
              startedAt: Date.now(),
            },
          }
        : state
    ),

  end: () => set({ session: null, muted: false, speaker: true, minimized: false, cameraFacing: "user" }),

  setMuted: (muted) => set({ muted }),
  setSpeaker: (speaker) => set({ speaker }),
  setMinimized: (minimized) => set({ minimized }),
  markBusy: () => set((state) => (state.session ? { session: { ...state.session, status: "busy" } } : state)),
  setCameraFacing: (cameraFacing) => set({ cameraFacing }),
}));
