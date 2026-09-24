import { useCallback, useEffect } from "react";

import { ClientEvent, ServerEvent } from "@/realtime/events";
import { onGatewayEvent, onGatewayOpen, sendGatewayEvent } from "@/realtime/gateway";
import { useVoice, type ActiveVoice, type VoiceParticipant } from "@/stores/voice";
import { useVoiceToken } from "./use-voice-token";

/**
 * Sesli kanal oturumu — LiveKit odası + Ciklet soket senkronizasyonu.
 *
 * İKİ AYRI SİSTEM birlikte çalışır ve ikisi de gereklidir:
 *  - LiveKit  : gerçek ses akışı (token `useVoiceToken` üzerinden; sunucu
 *               kanal üyeliğini orada doğrular).
 *  - Ağ geçidi: "kim bu kanalda" listesi. Ciklet katılımcı listesini
 *               LiveKit'ten değil ağ geçidinden yayınlar; bu yüzden
 *               `voice.join` göndermezsek diğer kullanıcılar bizi kanalda
 *               GÖRMEZ (ses gelse bile). Ağ geçidi yeniden başladığında
 *               üyelik düşer; her açılışta katılım tekrar gönderilir.
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

  // ── Ağ geçidi: kanala katıl / ayrıl + katılımcı listesi ─────────
  useEffect(() => {
    if (!session) return;
    const channelId = session.roomId;

    const join = () => {
      sendGatewayEvent({
        event_type: ClientEvent.VOICE_JOIN,
        channel_id: channelId,
        call_type: session.kind ?? "audio",
      });
      // Ağ geçidi katılımı odadakilere yayınlıyor ama katılana ilk listeyi
      // GÖNDERMİYOR; istenmezse ekranda kendini bile göremiyordun (web de
      // katıldıktan sonra voice.members istiyor).
      sendGatewayEvent({ event_type: ClientEvent.VOICE_MEMBERS, channel_id: channelId });
    };

    const releaseUpdate = onGatewayEvent(ServerEvent.VOICE_UPDATE, (frame) => {
      if (frame.channelId !== channelId) return;
      setParticipants((frame.participants as VoiceParticipant[] | undefined) ?? []);
    });
    const releaseOpen = onGatewayOpen(join);
    join();

    return () => {
      releaseUpdate();
      releaseOpen();
      sendGatewayEvent({ event_type: ClientEvent.VOICE_LEAVE, channel_id: channelId });
    };
  }, [session, setParticipants]);

  const leave = useCallback(() => {
    if (session) {
      sendGatewayEvent({ event_type: ClientEvent.VOICE_LEAVE, channel_id: session.roomId });
    }
    leaveStore();
  }, [session, leaveStore]);

  return {
    token,
    error,
    status: error ? ("error" as const) : token ? ("connected" as const) : ("connecting" as const),
    leave,
  };
}
