import { useEffect, useState } from "react";
import { Animated, Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import {
  isTrackReference,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack,
  type TrackReference,
} from "@livekit/react-native";
import { ConnectionState, Track } from "livekit-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Icon, Pressable, type IconName } from "@/components/ui";
import {
  ScreenShareFullscreen,
  ScreenShareSelfCard,
  sharerName,
  useRemoteScreenShares,
} from "@/features/screen-share/screen-share-view";
import { useScreenShare } from "@/features/screen-share/use-screen-share";
import { CallControls } from "@/features/voice/call-controls";
import { displayNameOf } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { useCall } from "@/stores/call";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useCallTimer } from "./use-call-timer";
import { VoiceE2EEPill } from "./voice-e2ee";

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
 *
 * WhatsApp gibi: karşı tarafın görüntüsü akarken üst bilgi ve kontroller
 * {@link CHROME_HIDE_MS} sonra kaybolur, ekrana dokununca geri gelir. Sol
 * üstte küçült (uygulamada gezilir, köşede mini pencere kalır), sağ üstte
 * sohbete git.
 *
 * Ekran paylaşımı: karşı taraf ekranını paylaşınca ana görüntü onun
 * ekranı olur (kırpılmadan, `contain`), kameralar küçük pencerede;
 * uzun basınca tam ekran. Kendi paylaşımın çizilmez (yansıma döngüsü),
 * kontrollerin üstünde "paylaşıyorsun" kartı görünür.
 */

/** Dokunmadan bu kadar sonra kontroller gizlenir. */
const CHROME_HIDE_MS = 4_000;

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

export function VideoCallStage({
  onHangUp,
  onMinimize,
  onOpenChat,
}: {
  onHangUp: () => void;
  onMinimize: () => void;
  onOpenChat?: () => void;
}) {
  const session = useCall((s) => s.session);
  const me = useAuth((s) => s.profile);
  const insets = useSafeAreaInsets();
  const { isCameraEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const cameras = useTracks([Track.Source.Camera]).filter(isTrackReference);
  const elapsed = useCallTimer(session?.startedAt);
  const [swapped, setSwapped] = useState(false);
  const [controlsHeight, setControlsHeight] = useState(140);
  const facing = useCall((s) => s.cameraFacing);
  const reconnecting = useConnectionState() === ConnectionState.Reconnecting;
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Küçük pencere dört köşeden birine sürüklenir (WhatsApp gibi).
  const [pipCorner, setPipCorner] = useState<{ side: "left" | "right"; edge: "top" | "bottom" }>({
    side: "right",
    edge: "bottom",
  });
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pipDrag = Gesture.Pan()
    .minDistance(8)
    .onUpdate((event) => {
      dragX.set(event.translationX);
      dragY.set(event.translationY);
    })
    .onEnd((event) => {
      const side = event.absoluteX < screenW / 2 ? "left" : "right";
      const edge = event.absoluteY < screenH / 2 ? "top" : "bottom";
      runOnJS(setPipCorner)({ side, edge });
      dragX.set(0);
      dragY.set(0);
    });
  const pipDragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.get() }, { translateY: dragY.get() }],
  }));

  const remote = participants.find((p) => !p.isLocal);
  const localRef = cameras.find((t) => t.participant.isLocal);
  const remoteRef = cameras.find((t) => !t.participant.isLocal);
  const remoteShare = useRemoteScreenShares()[0];
  const screenShare = useScreenShare();
  const [shareFullscreen, setShareFullscreen] = useState(false);

  const localSide: Side = { isLocal: true, ref: localRef, on: isCameraEnabled && isLive(localRef) };
  const remoteSide: Side = { isLocal: false, ref: remoteRef, on: isLive(remoteRef) };

  // İki kamera da kapalı ve karşı taraf henüz gelmediyse PiP'in anlamı yok.
  const showPip = localSide.on || remoteSide.on || Boolean(remote);
  const isSwapped = swapped && showPip;
  const main = isSwapped ? localSide : remoteSide;
  // Karşı taraf ekran paylaşırken ana alan ekranın; küçük pencerede açıksa
  // onun kamerası, dokununca kendi kameran.
  const pip = remoteShare
    ? remoteSide.on && !swapped
      ? remoteSide
      : localSide
    : isSwapped
      ? remoteSide
      : localSide;

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

  // Kontrollerin görünürlüğü. Yalnızca karşı tarafın görüntüsü akarken
  // gizlenir: kamera kapalıyken ekranda saklanacak görüntü yok.
  const canHide = remoteSide.on || Boolean(remoteShare);
  const [chrome, setChrome] = useState(true);
  const chromeShown = chrome || !canHide || reconnecting;
  const [opacity] = useState(() => new Animated.Value(1));
  // Her dokunuş sayacı artırır; efekt sayacı yeniden kurar.
  const [pokes, setPokes] = useState(0);
  const poke = () => {
    setChrome(true);
    setPokes((n) => n + 1);
  };

  useEffect(() => {
    if (!canHide || !chrome) return;
    const timer = setTimeout(() => setChrome(false), CHROME_HIDE_MS);
    return () => clearTimeout(timer);
  }, [canHide, chrome, pokes]);

  useEffect(() => {
    Animated.timing(opacity, { toValue: chromeShown ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [chromeShown, opacity]);

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
      <View style={[StyleSheet.absoluteFill, { backgroundColor: remoteShare || main.on ? STAGE_BACKGROUND : TILE_BACKGROUND }]}>
        {remoteShare ? (
          <VideoTrack
            key={`main-screen-${remoteShare.publication.trackSid}`}
            trackRef={remoteShare}
            style={{ flex: 1 }}
            objectFit="contain"
            zOrder={0}
          />
        ) : main.on && main.ref ? (
          <VideoTrack
            key={`main-${main.ref.participant.identity}`}
            trackRef={main.ref}
            style={{ flex: 1 }}
            objectFit="cover"
            zOrder={0}
            mirror={main.isLocal && facing === "user"}
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

      {/* Görüntüye dokunmak kontrolleri açar/kapatır. */}
      <Pressable
        noHitSlop
        onPress={() => (chromeShown && canHide ? setChrome(false) : poke())}
        onLongPress={remoteShare ? () => setShareFullscreen(true) : undefined}
        accessibilityRole="button"
        accessibilityLabel={chromeShown ? "Kontrolleri gizle" : "Kontrolleri göster"}
        accessibilityHint={remoteShare ? `${sharerName(remoteShare)} ekranını tam ekran açmak için basılı tut` : undefined}
        style={StyleSheet.absoluteFill}
      />

      {/* Kendi görüntün / yer değiştirince karşı taraf */}
      {showPip ? (
        <GestureDetector gesture={pipDrag}>
        <Reanimated.View
          style={[
            pipDragStyle,
            {
              position: "absolute",
              [pipCorner.side]: spacing.lg,
              ...(pipCorner.edge === "bottom"
                ? { bottom: chromeShown ? controlsHeight + spacing.sm : insets.bottom + spacing.lg }
                : { top: insets.top + (chromeShown ? 64 : spacing.sm) }),
              width: PIP_WIDTH,
              height: PIP_HEIGHT,
            },
          ]}
        >
        <Pressable
          haptic="light"
          noHitSlop
          onPress={() => setSwapped((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel="Görüntüleri değiştir"
          accessibilityHint="Köşeye taşımak için sürükle"
          style={{
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
              mirror={pip.isLocal && facing === "user"}
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
        </Reanimated.View>
        </GestureDetector>
      ) : null}

      {/* Üst çubuk: küçült · karşı taraf + süre · sohbet */}
      <Animated.View
        pointerEvents={chromeShown ? "box-none" : "none"}
        style={{
          position: "absolute",
          top: insets.top + spacing.sm,
          left: spacing.md,
          right: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          opacity,
        }}
      >
        <TopButton icon="chevron-down" label="Görüşmeyi küçült" onPress={onMinimize} />
        <View pointerEvents="box-none" style={{ flex: 1, alignItems: "center", gap: 2 }}>
          <Text pointerEvents="none" numberOfLines={1} style={{ ...typography.title, color: OVERLAY_TEXT, ...TEXT_SHADOW }}>
            {peerName}
          </Text>
          <Text pointerEvents="none" style={{ ...typography.caption, color: reconnecting ? "#ffd166" : OVERLAY_TEXT, ...TEXT_SHADOW }}>
            {reconnecting ? "Yeniden bağlanılıyor…" : elapsed}
          </Text>
          {/* Uçtan uca şifreleme durumu + ses gizlilik kodu. */}
          <VoiceE2EEPill onDark />
        </View>
        {screenShare.canShare ? (
          <TopButton
            icon={screenShare.sharing ? "screen-share-off" : "screen-share"}
            label={screenShare.sharing ? "Ekran paylaşımını durdur" : "Ekranı paylaş"}
            active={screenShare.sharing}
            onPress={() => {
              poke();
              void screenShare.toggle();
            }}
          />
        ) : null}
        {onOpenChat ? (
          <TopButton icon="message" label="Mesajlara git" onPress={onOpenChat} />
        ) : (
          <View style={{ width: 40 }} />
        )}
      </Animated.View>

      {/* Kontroller görüntünün üstünde */}
      <Animated.View
        pointerEvents={chromeShown ? "box-none" : "none"}
        onLayout={(event) => setControlsHeight(Math.round(event.nativeEvent.layout.height))}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          experimental_backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.45))",
          opacity,
        }}
      >
        {screenShare.sharing ? (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
            <ScreenShareSelfCard variant="overlay" onStop={() => void screenShare.stop()} busy={screenShare.busy} />
          </View>
        ) : null}
        <CallControls onHangUp={onHangUp} showCamera variant="overlay" allowEarpiece={false} onInteract={poke} />
      </Animated.View>

      <ScreenShareFullscreen
        trackRef={shareFullscreen ? remoteShare : undefined}
        onClose={() => setShareFullscreen(false)}
      />
      {screenShare.picker}
    </View>
  );
}

function TopButton({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: radii.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.brand : pressed ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)",
      })}
    >
      <Icon name={icon} size={22} color={active ? colors.onBrand : OVERLAY_TEXT} />
    </Pressable>
  );
}
