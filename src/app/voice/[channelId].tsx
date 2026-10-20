import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import {
  isTrackReference,
  LiveKitRoom,
  useLocalParticipant,
  useLocalParticipantPermissions,
  useParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/react-native";
import { useKeepAwake } from "expo-keep-awake";
import { Track } from "livekit-client";

import { isStageModerator, useChannel, useMyPermissions, useServerSummary } from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  IconButton,
  Pressable,
  Screen,
  ScreenLoader,
} from "@/components/ui";
import { CallControls } from "@/features/voice/call-controls";
import { PushToTalkButton } from "@/features/voice/push-to-talk";
import { SoundboardSheet, useSoundboard } from "@/features/voice/soundboard";
import { StagePanel } from "@/features/voice/stage-panel";
import {
  isServerMuted,
  useVoiceModeratedEvents,
  useVoiceModerationMenu,
} from "@/features/voice/voice-moderation";
import { useVoiceSession } from "@/features/voice/use-voice-session";
import { LIVEKIT_URL, type VoiceModerationState } from "@/lib/livekit";
import { usePreferences } from "@/stores/preferences";
import { useVoice, type ActiveVoice } from "@/stores/voice";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useOngoingCallService } from "@/features/call/use-ongoing-call-service";

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
  // Sahne kanalı (ciklet-web lib/stage): herkes dinleyici katılır, yayın izni yok;
  // mikrofon otomatik açılmaz, konuşmacı yapılınca elle açılır.
  const extras = channel as ChannelExtras | undefined;
  const isStage = extras?.stage === true;
  // Bas-konuş (Ayarlar → Ses ve Video): mikrofon kapalı başlar, ekrandaki
  // düğme basılı tutulunca açılır. Sahnede konuşma izni sahne panelinde.
  const pushToTalk = usePreferences((s) => s.inputMode) === "ptt" && !isStage;

  // Ekran açıkken cihaz uyumasın — uyku, mikrofon yayınını kesebilir.
  useKeepAwake();

  const [joinedAt] = useState(() => Date.now());
  /**
   * LiveKit (medya) bağlantısı kurulamadı. Katılımcı listesi ağ geçidinden
   * geldiği için ekran "dolu" görünebilir ama ses akmıyordur; kullanıcı
   * bunu bilmeli. Anahtar yeniden deneme için odayı baştan kurar.
   */
  const [mediaError, setMediaError] = useState(false);
  const [attempt, setAttempt] = useState(0);

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

  const { token, status, error, leave, moderation: joinModeration } = useVoiceSession(session);

  const onLeave = useCallback(() => {
    leave();
    router.back();
  }, [leave]);

  // Başka uygulamaya geçince ses kesilmesin (Android ön plan hizmeti).
  useOngoingCallService({
    title: channel?.name ?? "Ses kanalı",
    video: isVideo,
    callId: channelId ?? "voice",
    onHangUp: onLeave,
  });

  // Taşınırken önce eski oturum kapanır: ekran LiveKit odasını söker
  // (bağlantı kopar), sonra yeni kanalın ekranına geçilir.
  const [movingTo, setMovingTo] = useState<Href | null>(null);
  const onMove = useCallback(
    (targetChannelId: string, targetServerId: string) => {
      leave();
      setMovingTo({ pathname: "/voice/[channelId]", params: { channelId: targetChannelId, serverId: targetServerId } });
    },
    [leave]
  );
  useEffect(() => {
    if (movingTo) router.replace(movingTo);
  }, [movingTo]);

  // Moderatörün sana uyguladığı ses moderasyonu (kes / taşı / sustur).
  useVoiceModeratedEvents(channelId, onLeave, onMove);

  if (movingTo) {
    return (
      <>
        <Stack.Screen options={{ title: channel?.name ?? "" }} />
        <ScreenLoader label="Başka kanala taşınıyorsun…" />
      </>
    );
  }

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
      key={attempt}
      serverUrl={LIVEKIT_URL}
      token={token}
      connect
      // Sunucuda susturulmuş üye mikrofonla katılmaz (web media-room).
      audio={!isStage && !pushToTalk && !joinModeration.muted}
      video={isVideo}
      options={{ adaptiveStream: true, dynacast: true }}
      onConnected={() => setMediaError(false)}
      onError={() => setMediaError(true)}
      // Kurulamayan medya bağlantısı hata olarak değil "koptu" olarak
      // bildiriliyor. Kullanıcının kendi ayrılışında ekran zaten kapanıyor.
      onDisconnected={() => setMediaError(true)}
    >
      <Stack.Screen options={{ title: channel?.name ?? "" }} />
      <VoiceRoomBody
        title={channel?.name ?? "Ses kanalı"}
        subtitle={isStage ? `${server?.name ?? "Sunucu"} · Sahne` : (extras?.voiceStatus?.trim() || server?.name)}
        onLeave={onLeave}
        isVideo={isVideo}
        serverId={serverId}
        channelId={channelId}
        isStage={isStage}
        stageTopic={extras?.voiceStatus}
        pushToTalk={pushToTalk}
        joinModeration={joinModeration}
        mediaError={mediaError}
        onRetry={() => {
          setMediaError(false);
          setAttempt((value) => value + 1);
        }}
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
  serverId,
  channelId,
  isStage,
  stageTopic,
  pushToTalk,
  joinModeration,
  mediaError,
  onRetry,
}: {
  title: string;
  subtitle?: string;
  onLeave: () => void;
  isVideo: boolean;
  serverId: string | undefined;
  channelId: string;
  isStage: boolean;
  stageTopic: string | null | undefined;
  pushToTalk: boolean;
  joinModeration: VoiceModerationState;
  mediaError: boolean;
  onRetry: () => void;
}) {
  const participants = useVoice((s) => s.participants);
  const livekitParticipants = useParticipants();
  const { data: actor } = useMyPermissions(serverId);
  const moderation = useVoiceModerationMenu({ serverId, channelId, stage: isStage });
  const soundboard = useSoundboard(serverId);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  // Sahne dinleyicisinin yayın izni yok; mikrofon düğmesi konuşmacıya çıkar.
  const permissions = useLocalParticipantPermissions();
  const canPublish = permissions?.canPublish === true;
  // Kendi sunucu susturman / sağırlaştırman: izinler gelene kadar token
  // yanıtındaki katılım durumu, sonra canlı LiveKit izinleri.
  const { localParticipant } = useLocalParticipant();
  const selfMuted = permissions ? isServerMuted(localParticipant) : joinModeration.muted;
  const selfDeafened = permissions ? permissions.canSubscribe === false : joinModeration.deafened;
  // Sağırlaştırma kalkınca uzak parçalara yeniden abone olunur: otomatik
  // abonelik izin değişiminde kendiliğinden geri gelmeyebilir (web ile aynı).
  const room = useRoomContext();
  const wasDeafened = useRef(selfDeafened);
  useEffect(() => {
    if (wasDeafened.current && !selfDeafened) {
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          try {
            publication.setSubscribed(true);
          } catch {
            // Parça bu arada kalktıysa yok sayılır.
          }
        });
      });
    }
    wasDeafened.current = selfDeafened;
  }, [room, selfDeafened]);
  const livekitByIdentity = useMemo(
    () => new Map(livekitParticipants.map((participant) => [participant.identity, participant])),
    [livekitParticipants]
  );
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

        {isStage ? (
          <StagePanel channelId={channelId} topic={stageTopic} moderator={isStageModerator(actor)} />
        ) : null}

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
            participants.map((participant) => {
              const serverMuted = isServerMuted(livekitByIdentity.get(participant.username));
              const moderatable = serverId ? moderation.canModerate(participant) : false;
              return (
              <Pressable
                key={participant.id}
                onLongPress={moderatable ? () => moderation.open(participant, serverMuted) : undefined}
                disabled={!moderatable}
                noHitSlop
                accessibilityRole={moderatable ? "button" : "text"}
                accessibilityLabel={`${participant.name?.trim() || participant.username}${serverMuted ? ", sunucuda susturuldu" : ""}`}
                accessibilityHint={moderatable ? "Moderasyon için basılı tut" : undefined}
                style={{ alignItems: "center", gap: spacing.sm, width: 96 }}
              >
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
                  {serverMuted ? (
                    <View
                      style={{
                        position: "absolute",
                        right: 0,
                        bottom: 0,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.dangerSolid,
                      }}
                    >
                      <Icon name="mic-off" size={13} color="#ffffff" />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={{ ...typography.caption, color: colors.text }}
                  numberOfLines={1}
                >
                  {participant.name?.trim() || participant.username}
                </Text>
              </Pressable>
              );
            })
          )}
            </View>
          )}
        </View>

        {mediaError ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colors.panel,
              borderWidth: 1,
              borderColor: colors.danger,
            }}
          >
            <Icon name="mic-off" size={20} color={colors.danger} />
            <Text style={{ ...typography.caption, color: colors.text, flex: 1 }}>
              Ses sunucusuna bağlanılamadı. Kanaldakileri görüyorsun ama ses akmıyor.
            </Text>
            <Button label="Tekrar dene" variant="secondary" onPress={onRetry} />
          </View>
        ) : null}

        {pushToTalk || (!isStage && serverId) ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>{pushToTalk ? <PushToTalkButton disabled={selfMuted} /> : null}</View>
            {!isStage && serverId ? (
              <IconButton
                icon="sparkles"
                label="Soundboard"
                size={48}
                background={colors.raised}
                tint={colors.bright}
                onPress={() => setSoundboardOpen(true)}
              />
            ) : null}
          </View>
        ) : null}

        <View style={{ paddingBottom: spacing.lg }}>
          <CallControls
            onHangUp={onLeave}
            hangUpLabel="Kanaldan ayrıl"
            showCamera={isVideo}
            allowEarpiece={!isVideo}
            showMic={!pushToTalk && (!isStage || canPublish)}
            serverMuted={selfMuted}
            serverDeafened={selfDeafened}
          />
        </View>
      </View>

      {moderation.sheets}
      <SoundboardSheet
        serverId={serverId}
        visible={soundboardOpen}
        onClose={() => setSoundboardOpen(false)}
        onPlay={(sound) => void soundboard.play(sound)}
      />
    </Screen>
  );
}
