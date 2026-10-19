import { useEffect, useState } from "react";
import { Text } from "react-native";
import type { Participant } from "livekit-client";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import {
  hasServerPermission,
  useMyPermissions,
  useServerChannels,
  useServerSummary,
  useVoiceModeration,
  type VoiceModerationAction,
} from "@/api/hooks";
import { ActionSheet, showToast, type ActionSheetItem } from "@/components/ui";
import { ServerEvent } from "@/realtime/events";
import { onGatewayEvent } from "@/realtime/gateway";
import { useAuth } from "@/stores/auth";
import type { VoiceParticipant } from "@/stores/voice";
import { colors, typography } from "@/theme/tokens";

/**
 * Sunucu tarafı ses moderasyonu (web: kenar çubuğunda katılımcı sağ tık
 * menüsü, `/api/channels/[id]/voice/moderate`): sunucuda sustur / kaldır,
 * bağlantıyı kes, başka ses kanalına taşı. Menü yalnızca Sustur / Taşı
 * bitleri olana açılır; hiyerarşiyi uç denetler ve hata metni gösterilir.
 */

/** LiveKit `TrackSource.MICROPHONE` (protokol enum değeri). */
const MICROPHONE_SOURCE = 2;

/**
 * Sunucu mikrofon yayınını kapatmış mı: `canPublishSources` dolu ve mikrofonu
 * içermiyor (web `lib/voice/moderation` susturmayı böyle yazar).
 * `canPublish: false` tek başına susturma DEĞİL — sahne dinleyicisinin
 * normal hâli; ona bakılsaydı sahnedeki herkes "susturuldu" görünürdü.
 */
export function isServerMuted(participant: Participant | undefined): boolean {
  const permission = participant?.permissions;
  if (!permission) return false;
  const sources = permission.canPublishSources ?? [];
  return sources.length > 0 && !sources.includes(MICROPHONE_SOURCE as never);
}

export function useVoiceModerationMenu({
  serverId,
  channelId,
  stage,
}: {
  serverId: string | undefined;
  channelId: string;
  /** Sahnede susturma sahne eylemleriyle yapılır; burada yalnızca kes / taşı. */
  stage: boolean;
}) {
  const { data: actor } = useMyPermissions(serverId);
  const { data: server } = useServerSummary(serverId);
  const { data: channels } = useServerChannels(serverId);
  const myId = useAuth((s) => s.profile?.id);
  const moderate = useVoiceModeration(channelId);
  const [target, setTarget] = useState<{ participant: VoiceParticipant; muted: boolean } | null>(null);
  const [moveTarget, setMoveTarget] = useState<VoiceParticipant | null>(null);

  const canMute = !stage && hasServerPermission(actor, "MUTE_MEMBERS");
  const canMove = hasServerPermission(actor, "MOVE_MEMBERS");

  /** Bu katılımcı için menü açılabilir mi (kendin ve sahip hariç). */
  const canModerate = (participant: VoiceParticipant) =>
    (canMute || canMove) && participant.id !== myId && participant.id !== server?.profileId;

  const run = (participant: VoiceParticipant, action: VoiceModerationAction, targetChannelId?: string) => {
    const name = participant.name?.trim() || participant.username;
    moderate.mutate(
      { profileId: participant.id, action, targetChannelId },
      {
        onSuccess: () =>
          showToast(
            action === "mute"
              ? `${name} sunucuda susturuldu.`
              : action === "unmute"
                ? `${name} için susturma kaldırıldı.`
                : action === "disconnect"
                  ? `${name} kanaldan çıkarıldı.`
                  : `${name} taşındı.`
          ),
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : "Ses moderasyonu yapılamadı.", "error"),
      }
    );
  };

  const items: ActionSheetItem[] = [];
  if (target) {
    const { participant, muted } = target;
    if (canMute) {
      items.push(
        muted
          ? { key: "unmute", label: "Susturmayı kaldır", icon: "mic", onPress: () => run(participant, "unmute") }
          : {
              key: "mute",
              label: "Sunucuda sustur",
              detail: "Mikrofonu sunucu tarafında kapanır",
              icon: "mic-off",
              onPress: () => run(participant, "mute"),
            }
      );
    }
    if (canMove) {
      items.push(
        { key: "move", label: "Başka kanala taşı", icon: "forward", onPress: () => setMoveTarget(participant) },
        {
          key: "disconnect",
          label: "Bağlantıyı kes",
          icon: "phone-off",
          destructive: true,
          onPress: () => run(participant, "disconnect"),
        }
      );
    }
  }

  const moveItems: ActionSheetItem[] = moveTarget
    ? (channels ?? [])
        .filter((channel) => channel.type !== ChannelType.TEXT && channel.id !== channelId)
        .map((channel) => ({
          key: channel.id,
          label: channel.name,
          icon: channel.type === ChannelType.VIDEO ? "video" : "volume",
          onPress: () => run(moveTarget, "move", channel.id),
        }))
    : [];

  const sheets = (
    <>
      <ActionSheet
        visible={target !== null}
        onClose={() => setTarget(null)}
        header={
          target ? (
            <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
              {target.participant.name?.trim() || target.participant.username}
            </Text>
          ) : undefined
        }
        items={items}
      />
      <ActionSheet
        visible={moveTarget !== null}
        onClose={() => setMoveTarget(null)}
        header={
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Hangi kanala taşınsın?</Text>
        }
        items={moveItems}
      />
    </>
  );

  return {
    canModerate,
    open: (participant: VoiceParticipant, muted: boolean) => setTarget({ participant, muted }),
    sheets,
  };
}

/**
 * Sana uygulanan ses moderasyonu (`voice.moderated`, kullanıcı odası):
 * bilgi verilir; kesmede ekran kapanır, taşımada `onMove` çağrılır — ekran
 * eski LiveKit oturumunu kapatıp yeni kanala öyle geçer (aksi hâlde geçiş
 * anında iki oda birden bağlı kalıyordu).
 */
export function useVoiceModeratedEvents(
  channelId: string,
  onLeave: () => void,
  onMove: (targetChannelId: string, serverId: string) => void
) {
  useEffect(
    () =>
      onGatewayEvent(ServerEvent.VOICE_MODERATED, (frame) => {
        if (frame.channelId !== channelId) return;
        const serverId = typeof frame.serverId === "string" ? frame.serverId : "";
        switch (frame.action) {
          case "mute":
            showToast("Bir moderatör seni sunucuda susturdu.");
            break;
          case "unmute":
            showToast("Sunucu susturman kaldırıldı.");
            break;
          case "disconnect":
            showToast("Bir moderatör seni ses kanalından çıkardı.");
            onLeave();
            break;
          case "move":
            if (typeof frame.targetChannelId === "string") {
              showToast("Bir moderatör seni başka bir kanala taşıdı.");
              onMove(frame.targetChannelId, serverId);
            }
            break;
        }
      }),
    [channelId, onLeave, onMove]
  );
}
