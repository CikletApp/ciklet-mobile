import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  isTrackReference,
  LiveKitRoom,
  useParticipants,
  useTracks,
  VideoTrack,
} from "@livekit/react-native";
import { useKeepAwake } from "expo-keep-awake";
import { Track } from "livekit-client";

import { useChannel, useServerSummary } from "@/api/hooks";
import {
  Avatar,
  Button,
  EmptyState,
  Screen,
  ScreenLoader,
} from "@/components/ui";
import { CallControls } from "@/features/voice/call-controls";
import { useVoiceSession } from "@/features/voice/use-voice-session";
import { LIVEKIT_URL } from "@/lib/livekit";
import { useVoice, type ActiveVoice } from "@/stores/voice";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sesli kanal ekranı.
 *
 * Katılımcı listesinin kaynağı Ciklet soketidir (LiveKit değil): Ciklet
 * kendi kanal üyeliğini yönetiyor ve doğrudan LiveKit'e bağlanan botları da
 * o listeye katıyor. LiveKit yalnızca kimin KONUŞTUĞUNU söyler.
 */
export default function VoiceChannelScreen() {
  const { channelId, serverId, video } = useLocalSearchParams<{
    channelId: string;
    serverId?: string;
    video?: string;
  }>();
  const isVideo = video === "1";

  const { data: server } = useServerSummary(serverId);
  const channel = useChannel(serverId, channelId);

  // Ekran açıkken cihaz uyumasın — uyku, mikrofon yayınını kesebilir.
  useKeepAwake();

  const [joinedAt] = useState(() => Date.now());

  const session = useMemo<ActiveVoice | null>(
    () =>
      channelId
        ? {
            roomId: channelId,
            channelName: channel?.name ?? "Ses kanalı",
            serverName: server?.name,
            serverId,
            joinedAt,
            kind: isVideo ? "video" : "audio",
          }
        : null,
    [channelId, channel?.name, server?.name, serverId, joinedAt, isVideo]
  );

  const { token, status, error, leave } = useVoiceSession(session);

  const onLeave = () => {
    leave();
    router.back();
  };

  if (status === "error") {
    return (
      <Screen>
        <Stack.Screen options={{ title: channel?.name ?? "" }} />
        <EmptyState
          icon="volume"
          title="Kanala bağlanılamadı"
          description={error ?? undefined}
          action={<Button label="Geri dön" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  if (!token) {
    return (
      <>
        <Stack.Screen options={{ title: channel?.name ?? "" }} />
        <ScreenLoader label="Sese bağlanılıyor…" />
      </>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect
      audio
      video={isVideo}
      options={{ adaptiveStream: true, dynacast: true }}
    >
      <Stack.Screen options={{ title: channel?.name ?? "" }} />
      <VoiceRoomBody
        title={channel?.name ?? "Ses kanalı"}
        subtitle={server?.name}
        onLeave={onLeave}
        isVideo={isVideo}
      />
    </LiveKitRoom>
  );
}

/**
 * Oda içeriği. `LiveKitRoom` sağlayıcısının İÇİNDE olmak zorunda — LiveKit
 * hook'ları oda bağlamını orada bulur.
 */
function VoiceRoomBody({
  title,
  subtitle,
  onLeave,
  isVideo,
}: {
  title: string;
  subtitle?: string;
  onLeave: () => void;
  isVideo: boolean;
}) {
  const participants = useVoice((s) => s.participants);
  const livekitParticipants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]).filter(isTrackReference);

  // Konuşan kimlikleri LiveKit'ten gelir; kimlik olarak `identity`
  // kullanılıyor ve Ciklet token'ı bunu kullanıcı adına ayarlıyor.
  const speaking = useMemo(
    () =>
      new Set(
        livekitParticipants.filter((p) => p.isSpeaking).map((p) => p.identity)
      ),
    [livekitParticipants]
  );

  return (
    <Screen>
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.xl }}>
        <View style={{ alignItems: "center", gap: spacing.xs }}>
          <Text style={{ ...typography.display, color: colors.bright }}>{title}</Text>
          {subtitle ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>{subtitle}</Text>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          {isVideo && cameraTracks.length > 0 ? (
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
                justifyContent: "center",
                alignContent: "center",
              }}
            >
              {cameraTracks.map((trackRef) => (
                <View
                  key={`${trackRef.participant.identity}-${trackRef.source}`}
                  style={{
                    width: cameraTracks.length === 1 ? "100%" : "48%",
                    aspectRatio: cameraTracks.length === 1 ? 3 / 4 : 1,
                    maxHeight: "100%",
                    overflow: "hidden",
                    borderRadius: radii.xl,
                    backgroundColor: colors.panel,
                    borderWidth: trackRef.participant.isSpeaking ? 2 : 0,
                    borderColor: colors.success,
                  }}
                >
                  <VideoTrack
                    trackRef={trackRef}
                    style={{ flex: 1 }}
                    objectFit="cover"
                    mirror={trackRef.participant.isLocal}
                  />
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.bright,
                      position: "absolute",
                      left: spacing.sm,
                      bottom: spacing.sm,
                      backgroundColor: colors.scrim,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 3,
                      borderRadius: radii.full,
                    }}
                  >
                    {trackRef.participant.name || trackRef.participant.identity}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.lg,
                justifyContent: "center",
                alignContent: "flex-start",
              }}
            >
          {participants.length === 0 ? (
            <Text style={{ ...typography.body, color: colors.muted }}>
              {isVideo ? "Kameranı açarak görüntülü sohbete başla." : "Kanalda başka kimse yok."}
            </Text>
          ) : (
            participants.map((participant) => (
              <View key={participant.id} style={{ alignItems: "center", gap: spacing.sm, width: 96 }}>
                <View
                  style={{
                    padding: 3,
                    borderRadius: radii.full,
                    borderWidth: 2,
                    borderColor: speaking.has(participant.username)
                      ? colors.success
                      : "transparent",
                  }}
                >
                  <Avatar
                    profileId={participant.id}
                    imageUrl={participant.imageUrl}
                    fallbackText={participant.username}
                    size={64}
                  />
                </View>
                <Text
                  style={{ ...typography.caption, color: colors.text }}
                  numberOfLines={1}
                >
                  {participant.name?.trim() || participant.username}
                </Text>
              </View>
            ))
          )}
            </View>
          )}
        </View>

        <View style={{ paddingBottom: spacing.lg }}>
          <CallControls
            onHangUp={onLeave}
            hangUpLabel="Kanaldan ayrıl"
            showCamera={isVideo}
          />
        </View>
      </View>
    </Screen>
  );
}
