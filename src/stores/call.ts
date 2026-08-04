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

export type CallStatus = "ringing" | "calling" | "connected";
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

  start: (session: CallSession) => void;
  markConnected: (callId?: string | null) => void;
  end: () => void;
  setMuted: (muted: boolean) => void;
  setSpeaker: (speaker: boolean) => void;
}

export const useCall = create<CallState>((set) => ({
  session: null,
  muted: false,
  speaker: true,

  start: (session) => set({ session, muted: false, speaker: true }),

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

  end: () => set({ session: null, muted: false, speaker: true }),

  setMuted: (muted) => set({ muted }),
  setSpeaker: (speaker) => set({ speaker }),
}));
