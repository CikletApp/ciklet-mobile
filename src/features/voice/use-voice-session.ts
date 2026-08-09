import { useCallback, useEffect } from "react";

import { ClientEvent, ServerEvent } from "@/realtime/events";
import { getSocket, peekSocket } from "@/realtime/socket";
import { useVoice, type ActiveVoice, type VoiceParticipant } from "@/stores/voice";
import { useVoiceToken } from "./use-voice-token";

/**
 * Sesli kanal oturumu — LiveKit odası + Ciklet soket senkronizasyonu.
 *
 * İKİ AYRI SİSTEM birlikte çalışır ve ikisi de gereklidir:
 *  - LiveKit  : gerçek ses akışı (token `useVoiceToken` üzerinden; sunucu
 *               kanal üyeliğini orada doğrular).
 *  - Socket.IO: "kim bu kanalda" listesi. Ciklet katılımcı listesini
 *               LiveKit'ten değil kendi soketinden yayınlar; bu yüzden
 *               `join_voice_channel` göndermezsek diğer kullanıcılar bizi
 *               kanalda GÖRMEZ (ses gelse bile).
 */
export function useVoiceSession(session: ActiveVoice | null) {
  const joinStore = useVoice((s) => s.join);
  const leaveStore = useVoice((s) => s.leave);
  const setParticipants = useVoice((s) => s.setParticipants);

  const { token, error } = useVoiceToken(session?.roomId, session?.kind === "video");

  // Token alınınca oturumu depoya yaz (alt çubuk bunu gösterir).
  useEffect(() => {
    if (session && token) joinStore(session);
  }, [session, token, joinStore]);

  // ── Soket: kanala katıl / ayrıl + katılımcı listesi ───────────────
  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    void getSocket().then((socket) => {
      if (!socket || cancelled) return;

      const onUpdate = (payload: {
        channelId: string;
        participants: VoiceParticipant[];
      }) => {
        if (payload.channelId !== session.roomId) return;
        setParticipants(payload.participants ?? []);
      };

      socket.on(ServerEvent.VOICE_CHANNEL_UPDATE, onUpdate);
      socket.emit(ClientEvent.JOIN_VOICE_CHANNEL, {
        channelId: session.roomId,
        callType: session.kind ?? "audio",
      });

      detach = () => socket.off(ServerEvent.VOICE_CHANNEL_UPDATE, onUpdate);
    });

    return () => {
      cancelled = true;
      detach?.();
      peekSocket()?.emit(ClientEvent.LEAVE_VOICE_CHANNEL, {
        channelId: session.roomId,
      });
    };
  }, [session, setParticipants]);

  const leave = useCallback(() => {
    peekSocket()?.emit(ClientEvent.LEAVE_VOICE_CHANNEL, {
      channelId: session?.roomId,
    });
    leaveStore();
  }, [session, leaveStore]);

  return {
    token,
    error,
    status: error ? ("error" as const) : token ? ("connected" as const) : ("connecting" as const),
    leave,
  };
}
