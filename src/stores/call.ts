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

/**
 * Bildirim üzerinden verilen ama henüz uygulanamayan karar.
 *
 * Uygulama kapalıyken bildirimdeki "Kabul et"e basıldığında ortada bir çağrı
 * OTURUMU yok: süreç yeni ayaklanıyor, soket bağlanıyor ve davet
 * `pending_call_invites` ile birkaç saniye sonra geliyor. Karar burada
 * bekletilip oturum gelir gelmez uygulanıyor; aksi halde düğmeye basmak
 * hiçbir şey yapmaz, arayan tarafta telefon çalmaya devam ederdi.
 */
export type PendingCallIntent = "accept" | "decline";

interface CallState {
  session: CallSession | null;
  /** Mikrofon kapalı mı (bağlı çağrıda). */
  muted: boolean;
  /** Hoparlör açık mı. */
  speaker: boolean;
  pendingIntent: PendingCallIntent | null;

  start: (session: CallSession) => void;
  markConnected: (callId?: string | null) => void;
  end: () => void;
  setMuted: (muted: boolean) => void;
  setSpeaker: (speaker: boolean) => void;
  setPendingIntent: (intent: PendingCallIntent) => void;
  clearPendingIntent: () => void;
}

export const useCall = create<CallState>((set) => ({
  session: null,
  muted: false,
  speaker: true,
  pendingIntent: null,

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

  // Bekleyen niyet de temizlenir: bitmiş bir çağrının kararı, bir sonraki
  // aramaya sızıp onu kendiliğinden açmamalı.
  end: () => set({ session: null, muted: false, speaker: true, pendingIntent: null }),

  setMuted: (muted) => set({ muted }),
  setSpeaker: (speaker) => set({ speaker }),
  setPendingIntent: (pendingIntent) => set({ pendingIntent }),
  clearPendingIntent: () => set({ pendingIntent: null }),
}));
