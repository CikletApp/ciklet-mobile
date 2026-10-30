import { useEffect, useState } from "react";

import { ClientEvent, ServerEvent } from "@/realtime/events";
import { onGatewayEvent, onGatewayOpen, sendGatewayEvent } from "@/realtime/gateway";

/**
 * Sunucunun ses kanallarında kaç kişi var — kullanıcı sınırlı kanalın "3/5"
 * rozeti ve "Kanal dolu" ön denetimi için (web: kenar çubuğu, aktif ses
 * deposu). Kaynak ağ geçidi: açılışta ve her yeniden bağlanmada
 * `voice.active_channels`, sonrası sunucu odasına düşen `voice.update`
 * yayınları.
 *
 * Yalnızca `enabled` iken (sunucuda sınırlı kanal varken) sorulur: liste
 * isteği ağ geçidinde bağlantı başına seyreltilmiş, boşuna harcanmasın.
 */
export interface VoiceOccupancy {
  /** Kanal → katılımcı profil kimlikleri. */
  members: Record<string, string[]>;
}

type ChannelFrame = { channelId?: unknown; participants?: unknown; info?: unknown };

function participantIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((participant) => (participant && typeof participant === "object" ? (participant as { id?: unknown }).id : null))
    .filter((id): id is string => typeof id === "string");
}

function serverOf(info: unknown): string | null {
  const serverId = info && typeof info === "object" ? (info as { serverId?: unknown }).serverId : null;
  return typeof serverId === "string" ? serverId : null;
}

export function useVoiceOccupancy(serverId: string | undefined, enabled: boolean): VoiceOccupancy {
  const [state, setState] = useState<{ serverId: string | undefined; members: Record<string, string[]> }>({
    serverId,
    members: {},
  });

  useEffect(() => {
    if (!serverId || !enabled) return;
    const ask = () => sendGatewayEvent({ event_type: ClientEvent.VOICE_ACTIVE_CHANNELS });

    const releaseActive = onGatewayEvent(ServerEvent.VOICE_ACTIVE_CHANNELS, (frame) => {
      const channels = Array.isArray(frame.channels) ? (frame.channels as ChannelFrame[]) : [];
      const members: Record<string, string[]> = {};
      for (const channel of channels) {
        if (typeof channel.channelId !== "string" || serverOf(channel.info) !== serverId) continue;
        members[channel.channelId] = participantIds(channel.participants);
      }
      setState({ serverId, members });
    });
    const releaseUpdate = onGatewayEvent(ServerEvent.VOICE_UPDATE, (frame) => {
      const channelId = frame.channelId;
      if (typeof channelId !== "string" || serverOf(frame.info) !== serverId) return;
      const ids = participantIds(frame.participants);
      setState((current) => ({
        serverId,
        members: { ...(current.serverId === serverId ? current.members : {}), [channelId]: ids },
      }));
    });
    const releaseOpen = onGatewayOpen(ask);
    ask();

    return () => {
      releaseActive();
      releaseUpdate();
      releaseOpen();
    };
  }, [serverId, enabled]);

  return { members: state.serverId === serverId ? state.members : {} };
}
