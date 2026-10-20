import { useState } from "react";
import { Modal, Platform, StatusBar, Text, View, type ViewStyle } from "react-native";
import { isTrackReference, useTracks, VideoTrack, type TrackReference } from "@livekit/react-native";
import { Track } from "livekit-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Icon, IconButton, Pressable } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Ekran paylaşımını izleme tarafı.
 *
 * Paylaşım BÜYÜK karo olarak gösterilir (`objectFit="contain"`: ekranın
 * kenarı kırpılmasın, yazı okunur kalsın); uzun basınca ya da köşedeki
 * düğmeyle tam ekran açılır. Kendi paylaşımın çizilmez — yansıma döngüsü
 * yerine {@link ScreenShareSelfCard} gösterilir.
 *
 * Sistem sesi paylaşılırsa (web'den `ScreenShareAudio`) LiveKit onu diğer
 * sesler gibi kendiliğinden çalar; burada ayrıca bir şey gerekmez.
 */

const SCREEN_BACKGROUND = "#000000";

/** Başkalarının yayındaki ekran paylaşımları (kendi paylaşımın hariç). */
export function useRemoteScreenShares(): TrackReference[] {
  return useTracks([Track.Source.ScreenShare]).filter(
    (ref): ref is TrackReference =>
      isTrackReference(ref) && !ref.participant.isLocal && !ref.publication.isMuted && !!ref.publication.track
  );
}

export function sharerName(ref: TrackReference) {
  return ref.participant.name?.trim() || ref.participant.identity;
}

function keyOf(ref: TrackReference) {
  return `${ref.participant.identity}-${ref.publication.trackSid}`;
}

/** Tek paylaşım karosu; uzun basış tam ekran açar. */
export function ScreenShareTile({
  trackRef,
  onExpand,
  style,
  zOrder,
}: {
  trackRef: TrackReference;
  onExpand: () => void;
  style?: ViewStyle;
  /** Android SurfaceView katmanı — başka bir görüntünün üstündeyse 1. */
  zOrder?: number;
}) {
  const name = sharerName(trackRef);
  return (
    <Pressable
      noHitSlop
      haptic="light"
      onLongPress={onExpand}
      accessibilityRole="button"
      accessibilityLabel={`${name} ekranını paylaşıyor`}
      accessibilityHint="Tam ekran için basılı tut"
      style={{
        overflow: "hidden",
        borderRadius: Platform.OS === "ios" ? radii.xl : radii.sm,
        borderCurve: "continuous",
        backgroundColor: SCREEN_BACKGROUND,
        ...style,
      }}
    >
      <VideoTrack
        key={`tile-${keyOf(trackRef)}`}
        trackRef={trackRef}
        style={{ flex: 1 }}
        objectFit="contain"
        zOrder={zOrder}
      />
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: spacing.sm,
          right: spacing.sm,
          bottom: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            flexShrink: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: radii.full,
          }}
        >
          <Icon name="screen-share" size={14} color="#ffffff" />
          <Text numberOfLines={1} style={{ ...typography.caption, color: "#ffffff", flexShrink: 1 }}>
            {name}
          </Text>
        </View>
        <IconButton
          icon="maximize"
          label="Tam ekran"
          size={32}
          background="rgba(0,0,0,0.6)"
          tint="#ffffff"
          onPress={onExpand}
        />
      </View>
    </Pressable>
  );
}

/**
 * Tam ekran izleme. Uygulama dikey kilitli; iOS'ta modal yatay yönü de
 * kabul eder (cihaz çevrilince geniş ekran tam sığar).
 */
export function ScreenShareFullscreen({
  trackRef,
  onClose,
}: {
  trackRef: TrackReference | undefined;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={!!trackRef}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: SCREEN_BACKGROUND }}>
        {trackRef ? (
          <VideoTrack
            key={`full-${keyOf(trackRef)}`}
            trackRef={trackRef}
            style={{ flex: 1 }}
            objectFit="contain"
          />
        ) : null}
        <View
          style={{
            position: "absolute",
            top: insets.top + spacing.sm,
            left: spacing.md,
            right: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <IconButton
            icon="close"
            label="Tam ekrandan çık"
            size={40}
            background="rgba(0,0,0,0.5)"
            tint="#ffffff"
            onPress={onClose}
          />
          {trackRef ? (
            <Text
              numberOfLines={1}
              style={{
                ...typography.bodyStrong,
                color: "#ffffff",
                flexShrink: 1,
                textShadowColor: "rgba(0,0,0,0.6)",
                textShadowRadius: 4,
              }}
            >
              {sharerName(trackRef)} · ekran
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** Paylaşan kendi ekranını görmez; onun yerine bu kart. */
export function ScreenShareSelfCard({
  onStop,
  busy,
  variant = "default",
}: {
  onStop: () => void;
  busy?: boolean;
  variant?: "default" | "overlay";
}) {
  const overlay = variant === "overlay";
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        backgroundColor: overlay ? "rgba(0,0,0,0.55)" : colors.panel,
        borderWidth: overlay ? 0 : 1,
        borderColor: colors.brand,
      }}
    >
      <Icon name="screen-share" size={20} color={overlay ? "#ffffff" : colors.brand} />
      <Text style={{ ...typography.caption, color: overlay ? "#ffffff" : colors.text, flex: 1 }}>
        Ekranını paylaşıyorsun. Başkaları ekranındakileri görüyor.
      </Text>
      <Button label="Durdur" variant="secondary" onPress={onStop} disabled={busy} />
    </View>
  );
}

/**
 * Sesli kanal sahnesi: bir paylaşım büyük karoda, birden çoksa altta
 * paylaşanlar arasında geçiş çipleri. Paylaşım yoksa hiçbir şey çizmez.
 */
export function ScreenShareStage({ shares, style }: { shares: TrackReference[]; style?: ViewStyle }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [fullscreenKey, setFullscreenKey] = useState<string | null>(null);

  if (shares.length === 0) return null;
  const selected = shares.find((ref) => keyOf(ref) === selectedKey) ?? shares[0];
  // Paylaşım bitince tam ekran kendiliğinden kapanır.
  const fullscreen = shares.find((ref) => keyOf(ref) === fullscreenKey);

  return (
    <View style={{ gap: spacing.sm, ...style }}>
      <ScreenShareTile
        trackRef={selected}
        onExpand={() => setFullscreenKey(keyOf(selected))}
        style={{ flex: 1 }}
      />
      {shares.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {shares.map((ref) => {
            const active = keyOf(ref) === keyOf(selected);
            return (
              <Pressable
                key={keyOf(ref)}
                haptic="light"
                onPress={() => setSelectedKey(keyOf(ref))}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${sharerName(ref)} ekranını göster`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                  borderRadius: radii.full,
                  backgroundColor: active ? colors.brand : colors.raised,
                }}
              >
                <Icon name="screen-share" size={14} color={active ? colors.onBrand : colors.muted} />
                <Text style={{ ...typography.caption, color: active ? colors.onBrand : colors.text }}>
                  {sharerName(ref)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <ScreenShareFullscreen trackRef={fullscreen} onClose={() => setFullscreenKey(null)} />
    </View>
  );
}
