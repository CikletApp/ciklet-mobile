import { useMemo } from "react";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  isTrackReference,
  useParticipants,
  useTracks,
  VideoTrack,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Icon, Pressable } from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { useCall } from "@/stores/call";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useCallTimer } from "./use-call-timer";

/**
 * Küçültülmüş çağrı — uygulamanın üstünde sürüklenebilir mini pencere
 * (WhatsApp'taki gibi). Görüntülü aramada karşı tarafın görüntüsü, sesli
 * aramada isim + süre kapsülü. Dokununca tam ekran görüşmeye dönülür;
 * bırakınca en yakın yan kenara yapışır.
 *
 * LiveKit odasının İÇİNDE çizilir (call-overlay `ConnectedCall`): oda
 * küçültmede de açık kalır, bu bileşen yalnızca görünümdür.
 */

const VIDEO_WIDTH = 112;
const VIDEO_HEIGHT = 160;
const PILL_WIDTH = 196;
const PILL_HEIGHT = 56;
const EDGE = spacing.md;

export function MiniCall({
  kind,
  onRestore,
  onHangUp,
}: {
  kind: "audio" | "video";
  onRestore: () => void;
  onHangUp: () => void;
}) {
  const session = useCall((s) => s.session);
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const participants = useParticipants();
  const cameras = useTracks([Track.Source.Camera]).filter(isTrackReference);
  const elapsed = useCallTimer(session?.startedAt);

  const w = kind === "video" ? VIDEO_WIDTH : PILL_WIDTH;
  const h = kind === "video" ? VIDEO_HEIGHT : PILL_HEIGHT;
  const minY = insets.top + spacing.sm;
  const maxY = screenH - insets.bottom - h - 96;
  const rightX = screenW - w - EDGE;

  // Başlangıç: sağ üst, sohbet başlığının altında — yazma kutusunu örtmesin.
  const x = useSharedValue(rightX);
  const y = useSharedValue(insets.top + 72);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Küçük kaydırmalar dokunma sayılsın (içteki düğmeler çalışsın).
        .minDistance(6)
        .onStart(() => {
          startX.set(x.get());
          startY.set(y.get());
        })
        .onUpdate((event) => {
          x.set(startX.get() + event.translationX);
          y.set(startY.get() + event.translationY);
        })
        .onEnd(() => {
          const snapX = x.get() + w / 2 < screenW / 2 ? EDGE : rightX;
          x.set(withSpring(snapX, { damping: 18, stiffness: 180 }));
          y.set(withSpring(Math.min(maxY, Math.max(minY, y.get())), {
            damping: 18,
            stiffness: 180,
          }));
        }),
    [x, y, startX, startY, w, screenW, rightX, maxY, minY],
  );
  const placed = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));

  if (!session) return null;
  const peerName = displayNameOf(session.peer);
  const remote = participants.find((p) => !p.isLocal);
  const remoteRef = cameras.find((t) => !t.participant.isLocal);
  const remoteLive =
    !!remoteRef &&
    !remoteRef.publication.isMuted &&
    !!remoteRef.publication.track;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          placed,
          {
            position: "absolute",
            left: 0,
            top: 0,
            width: w,
            height: h,
            zIndex: 1000,
            elevation: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            borderRadius:
              kind === "video"
                ? Platform.OS === "ios"
                  ? radii.lg
                  : radii.sm
                : radii.full,
          },
        ]}
      >
        {kind === "video" ? (
          <Pressable
            noHitSlop
            haptic="light"
            onPress={onRestore}
            accessibilityRole="button"
            accessibilityLabel={`${peerName} ile görüntülü görüşmeye dön`}
            style={{
              flex: 1,
              overflow: "hidden",
              borderRadius: Platform.OS === "ios" ? radii.lg : radii.sm,
              borderCurve: "continuous",
              backgroundColor: "#1b1b1f",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
            }}
          >
            {remoteLive && remoteRef ? (
              <VideoTrack
                key={`mini-${remoteRef.participant.identity}`}
                trackRef={remoteRef}
                style={{ flex: 1 }}
                objectFit="cover"
                zOrder={1}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                <Avatar
                  imageUrl={session.peer.imageUrl}
                  fallbackText={session.peer.username}
                  size={52}
                  backgroundColor="#1b1b1f"
                />
                <Text style={{ ...typography.caption, color: "#ffffff" }}>
                  {remote ? elapsed : "Bağlanılıyor…"}
                </Text>
              </View>
            )}
          </Pressable>
        ) : (
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingLeft: 6,
              paddingRight: 6,
              borderRadius: radii.full,
              backgroundColor: colors.success,
            }}
          >
            <Pressable
              noHitSlop
              haptic="light"
              onPress={onRestore}
              accessibilityRole="button"
              accessibilityLabel={`${peerName} ile görüşmeye dön`}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Avatar
                imageUrl={session.peer.imageUrl}
                fallbackText={session.peer.username}
                size={42}
                backgroundColor={colors.success}
              />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ ...typography.bodyStrong, color: "#ffffff" }}
                >
                  {peerName}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: 15,
                    color: "rgba(255,255,255,0.85)",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {elapsed}
                </Text>
              </View>
            </Pressable>
            <Pressable
              haptic="warning"
              onPress={onHangUp}
              accessibilityRole="button"
              accessibilityLabel="Görüşmeyi bitir"
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: radii.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? "#b3261e" : colors.dangerSolid,
              })}
            >
              <Icon name="phone-off" size={20} color="#ffffff" />
            </Pressable>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}
