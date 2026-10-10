import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import {
  isTrackReference,
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack,
  type TrackReference,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Icon, Pressable } from "@/components/ui";
import { CallControls } from "@/features/voice/call-controls";
import { displayNameOf } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { useCall } from "@/stores/call";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useCallTimer } from "./use-call-timer";

/**
 * Bire bir görüntülü arama sahnesi: karşı taraf tam ekran, kendi
 * görüntün sağ altta küçük pencerede (PiP). PiP'e dokununca görüntüler
 * yer değiştirir, tekrar dokununca geri döner.
 *
 * Görüntünün üstündeki her şey sabit beyaz/siyah: tema renkleri açık
 * temada video üstünde okunmuyor.
 *
 * ⚠️ Android: video SurfaceView'dir; `zOrder` yüzey pencereye bağlanmadan
 * önce uygulanmalı. Bu yüzden VideoTrack anahtarları rolü ("main-"/"pip-")
 * içerir — yer değiştirince ikisi de doğru zOrder ile yeniden kurulur.
 * zOrder 2 (setZOrderOnTop) kontrollerin bile üstüne çizer; kullanılmaz.
 */

const PIP_WIDTH = 104;
const PIP_HEIGHT = 148;
const STAGE_BACKGROUND = "#000000";
const TILE_BACKGROUND = "#1b1b1f";
const OVERLAY_TEXT = "#ffffff";
const TEXT_SHADOW = {
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

interface Side {
  isLocal: boolean;
  ref: TrackReference | undefined;
  on: boolean;
}

/** Yayın var ve kamera susturulmamış mı — susturulmuş iz siyah kare bırakır. */
function isLive(ref: TrackReference | undefined): ref is TrackReference {
  return !!ref && !ref.publication.isMuted && !!ref.publication.track;
}

export function VideoCallStage({ onHangUp }: { onHangUp: () => void }) {
  const session = useCall((s) => s.session);
  const me = useAuth((s) => s.profile);
  const insets = useSafeAreaInsets();
  const { isCameraEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const cameras = useTracks([Track.Source.Camera]).filter(isTrackReference);
  const elapsed = useCallTimer(session?.startedAt);
  const [swapped, setSwapped] = useState(false);
  const [controlsHeight, setControlsHeight] = useState(140);

  const remote = participants.find((p) => !p.isLocal);
  const localRef = cameras.find((t) => t.participant.isLocal);
  const remoteRef = cameras.find((t) => !t.participant.isLocal);

  const localSide: Side = { isLocal: true, ref: localRef, on: isCameraEnabled && isLive(localRef) };
  const remoteSide: Side = { isLocal: false, ref: remoteRef, on: isLive(remoteRef) };

  // İki kamera da kapalı ve karşı taraf henüz gelmediyse PiP'in anlamı yok.
  const showPip = localSide.on || remoteSide.on || Boolean(remote);
  const isSwapped = swapped && showPip;
  const main = isSwapped ? localSide : remoteSide;
  const pip = isSwapped ? remoteSide : localSide;

  const peerName = session ? displayNameOf(session.peer) : "";

  const identityOf = (side: Side) =>
    side.isLocal
      ? {
          imageUrl: me?.imageUrl ?? null,
          username: me?.username ?? "",
          name: me ? displayNameOf(me) : "",
          speaking: Boolean(participants.find((p) => p.isLocal)?.isSpeaking),
        }
      : {
          imageUrl: session?.peer.imageUrl ?? null,
          username: session?.peer.username ?? "",
          name: peerName,
          speaking: Boolean(remote?.isSpeaking),
        };

  const mainIdentity = identityOf(main);
  const pipIdentity = identityOf(pip);

  const mainStatus = main.isLocal
    ? "Kameran kapalı"
    : remote
      ? "Kamera kapalı"
      : "Bağlanılıyor…";

  return (
    <View style={{ flex: 1, backgroundColor: STAGE_BACKGROUND }}>
      {/* Ana görüntü */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: main.on ? STAGE_BACKGROUND : TILE_BACKGROUND }]}>
        {main.on && main.ref ? (
          <VideoTrack
            key={`main-${main.ref.participant.identity}`}
            trackRef={main.ref}
            style={{ flex: 1 }}
            objectFit="cover"
            zOrder={0}
            mirror={main.isLocal}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.md,
              paddingBottom: controlsHeight / 2,
            }}
          >
            <View
              style={{
                padding: 4,
                borderRadius: radii.full,
                borderWidth: 3,
                borderColor: mainIdentity.speaking ? colors.success : "transparent",
              }}
            >
              <Avatar
                imageUrl={mainIdentity.imageUrl}
                fallbackText={mainIdentity.username}
                size={112}
                backgroundColor={TILE_BACKGROUND}
              />
            </View>
            <Text style={{ ...typography.display, color: OVERLAY_TEXT }}>{mainIdentity.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              {remote || main.isLocal ? (
                <Icon name="video-off" size={16} color="rgba(255,255,255,0.7)" />
              ) : null}
              <Text style={{ ...typography.caption, color: "rgba(255,255,255,0.7)" }}>{mainStatus}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Kendi görüntün / yer değiştirince karşı taraf */}
      {showPip ? (
        <Pressable
          haptic="light"
          noHitSlop
          onPress={() => setSwapped((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel="Görüntüleri değiştir"
          style={{
            position: "absolute",
            right: spacing.lg,
            bottom: controlsHeight + spacing.sm,
            width: PIP_WIDTH,
            height: PIP_HEIGHT,
            // Android'de SurfaceView köşe kırpmasını yok sayar; büyük yarıçap
            // videonun köşelerini çerçevenin dışına taşırır.
            borderRadius: Platform.OS === "ios" ? radii.lg : radii.sm,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: TILE_BACKGROUND,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.25)",
          }}
        >
          {pip.on && pip.ref ? (
            <VideoTrack
              key={`pip-${pip.ref.participant.identity}`}
              trackRef={pip.ref}
              style={{ flex: 1 }}
              objectFit="cover"
              zOrder={1}
              mirror={pip.isLocal}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
              <Avatar
                imageUrl={pipIdentity.imageUrl}
                fallbackText={pipIdentity.username}
                size={48}
                backgroundColor={TILE_BACKGROUND}
              />
              <Icon name="video-off" size={16} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </Pressable>
      ) : null}

      {/* Üst bilgi: karşı taraf + süre */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: insets.top + spacing.sm,
          left: spacing.lg,
          right: spacing.lg,
          alignItems: "center",
        }}
      >
        <Text numberOfLines={1} style={{ ...typography.title, color: OVERLAY_TEXT, ...TEXT_SHADOW }}>
          {peerName}
        </Text>
        <Text style={{ ...typography.caption, color: OVERLAY_TEXT, ...TEXT_SHADOW }}>{elapsed}</Text>
      </View>

      {/* Kontroller görüntünün üstünde */}
      <View
        onLayout={(event) => setControlsHeight(Math.round(event.nativeEvent.layout.height))}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          experimental_backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.45))",
        }}
      >
        <CallControls onHangUp={onHangUp} showCamera variant="overlay" allowEarpiece={false} />
      </View>
    </View>
  );
}
