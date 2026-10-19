import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { MyServerPermissions, ServerSoundItem } from "../types";

/**
 * Ses kanalı özellikleri: soundboard sesleri, sahne eylemleri ve sunucu
 * tarafı ses moderasyonu (web `lib/stage`, `lib/voice/moderation`,
 * `lib/soundboard`).
 */

export function useServerSounds(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.serverSounds(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerSoundItem[]>(endpoints.serverSounds(serverId!)),
    staleTime: 5 * 60_000,
  });
}

export type StageAction = "speak" | "listen" | "raise" | "lower" | "promote" | "demote";

/**
 * speak/listen/raise/lower kendine; promote/demote `identity` (LiveKit
 * kimliği = kullanıcı adı) hedefine. raise/lower yanıtı `{ ok, hand }`.
 */
export function useStageAction(channelId: string) {
  return useMutation({
    mutationFn: ({ action, identity }: { action: StageAction; identity?: string }) =>
      api<{ ok: true; speaker?: boolean; hand?: boolean }>(endpoints.stage(channelId), {
        method: "POST",
        body: { action, ...(identity ? { identity } : {}) },
      }),
  });
}

/** Sahne moderatörü (web `isStageModerator`): sahip ya da Sustur / Taşı / Kanalları Yönet biti. */
export function isStageModerator(actor: MyServerPermissions | undefined): boolean {
  if (!actor) return false;
  return (
    actor.isOwner ||
    actor.keys.includes("MUTE_MEMBERS") ||
    actor.keys.includes("MOVE_MEMBERS") ||
    actor.keys.includes("MANAGE_CHANNELS")
  );
}

export type VoiceModerationAction = "mute" | "unmute" | "disconnect" | "move";

export function useVoiceModeration(channelId: string) {
  return useMutation({
    mutationFn: (input: { profileId: string; action: VoiceModerationAction; targetChannelId?: string }) =>
      api<{ ok: true }>(endpoints.voiceModerate(channelId), { method: "POST", body: input }),
  });
}
