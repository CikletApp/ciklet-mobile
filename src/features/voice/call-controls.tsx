import { useCallback, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useLocalParticipant } from "@livekit/react-native";

import { Icon, Pressable, type HapticKind, type IconName } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { showSystemRoutePicker, useAudioRoute, type AudioRoute } from "./audio-route";

const DEFAULT_HANG_UP_LABEL = "Görüşmeyi bitir";

/**
 * Ortak çağrı kontrolleri — DM araması ve sesli kanal aynı çubuğu kullanır.
 *
 * **Sessize alma neden bozuktu:** durum kendi Zustand deposumda tutuluyordu
 * ve LiveKit'in gerçek mikrofon durumuyla ayrışabiliyordu; düğme "kapalı"
 * görünürken mikrofon açık kalıyordu. Artık TEK DOĞRULUK KAYNAĞI LiveKit'in
 * kendi `isMicrophoneEnabled` değeri — düğme onu okur, onu değiştirir.
 *
 * **Ses çıkışı:** düğme her zaman görünür. Kulaklık yokken ahize ↔ hoparlör
 * arasında geçer; Android'de kulaklık/Bluetooth bağlıyken çıkış listesi
 * açar. iOS'ta uzun basış sistem seçicisini (AirPods/AirPlay) açar.
 *
 * `variant="overlay"`: görüntünün üstünde tema renkleri okunmaz; boştaki
 * düğmeler yarı saydam beyaz zemin ve beyaz ikon/etiket kullanır.
 */
export function CallControls({
  onHangUp,
  hangUpLabel = DEFAULT_HANG_UP_LABEL,
  showCamera = false,
  variant = "default",
  allowEarpiece = true,
}: {
  onHangUp: () => void;
  hangUpLabel?: string;
  showCamera?: boolean;
  variant?: "default" | "overlay";
  /**
   * Görüntülü görüşmede ahize yok (WhatsApp gibi): ses hoparlörden ya da
   * bağlıysa kulaklık/Bluetooth'tan gelir. Harici cihaz yoksa ses düğmesi
   * gösterilmez — seçilecek başka çıkış yok.
   */
  allowEarpiece?: boolean;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const audio = useAudioRoute();
  const [busy, setBusy] = useState(false);
  const [routeMenuOpen, setRouteMenuOpen] = useState(false);

  const choices = allowEarpiece ? audio.choices : audio.choices.filter((id) => id !== "earpiece");
  // Kulaklık çıkarılınca liste kapanır; yeniden takılınca kendiliğinden
  // açılmasın diye durum da sıfırlanır.
  const hasChoices = allowEarpiece ? choices.length > 0 : choices.length > 1;
  const showRoute = allowEarpiece || hasChoices;
  if (routeMenuOpen && !hasChoices) setRouteMenuOpen(false);

  const toggleMic = useCallback(async () => {
    if (!localParticipant || busy) return;
    setBusy(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } finally {
      setBusy(false);
    }
  }, [localParticipant, isMicrophoneEnabled, busy]);

  const toggleCamera = useCallback(async () => {
    if (!localParticipant || busy) return;
    setBusy(true);
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } finally {
      setBusy(false);
    }
  }, [localParticipant, isCameraEnabled, busy]);

  const overlay = variant === "overlay";
  const idleBackground = overlay ? "rgba(255,255,255,0.18)" : colors.raised;
  const idleTint = overlay ? "#ffffff" : colors.bright;
  const captionColor = overlay ? "#ffffff" : colors.muted;

  const route = !allowEarpiece && audio.route === "earpiece" ? "speaker" : audio.route;
  // Hoparlör "açık" durumda vurgulanır; ahize ve kulaklıklar boştaki görünümde.
  const routeActive = route === "speaker";

  const onRoutePress = () => {
    if (hasChoices) {
      setRouteMenuOpen((open) => !open);
      return;
    }
    setRouteMenuOpen(false);
    audio.toggle();
  };

  const routeLabel = hasChoices
    ? "Ses çıkışını seç"
    : route === "speaker"
      ? "Ahizeye al"
      : "Hoparlöre al";

  return (
    <View>
      {routeMenuOpen && hasChoices ? (
        <RouteMenu
          current={route}
          choices={choices}
          onSelect={(next) => {
            setRouteMenuOpen(false);
            void audio.select(next);
          }}
        />
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: spacing.xl,
        }}
      >
        <ControlButton
          icon={isMicrophoneEnabled ? "mic" : "mic-off"}
          label={isMicrophoneEnabled ? "Mikrofonu kapat" : "Mikrofonu aç"}
          caption={isMicrophoneEnabled ? "Mikrofon" : "Sessiz"}
          captionColor={captionColor}
          onPress={toggleMic}
          background={isMicrophoneEnabled ? idleBackground : colors.dangerSolid}
          tint={isMicrophoneEnabled ? idleTint : "#ffffff"}
        />

        {showCamera ? (
          <ControlButton
            icon={isCameraEnabled ? "video" : "video-off"}
            label={isCameraEnabled ? "Kamerayı kapat" : "Kamerayı aç"}
            caption="Kamera"
            captionColor={captionColor}
            onPress={toggleCamera}
            background={isCameraEnabled ? colors.brand : idleBackground}
            tint={isCameraEnabled ? colors.onBrand : idleTint}
          />
        ) : null}

        {showRoute ? (
          <ControlButton
            icon={ROUTE_ICON[route]}
            label={routeLabel}
            caption={ROUTE_LABEL[route]}
            captionColor={captionColor}
            onPress={onRoutePress}
            onLongPress={Platform.OS === "ios" ? showSystemRoutePicker : undefined}
            hint={Platform.OS === "ios" ? "Diğer cihazlar için basılı tut" : undefined}
            background={routeActive ? colors.brand : idleBackground}
            tint={routeActive ? colors.onBrand : idleTint}
          />
        ) : null}

        <ControlButton
          icon="phone-off"
          label={hangUpLabel}
          caption={hangUpLabel === DEFAULT_HANG_UP_LABEL ? "Bitir" : hangUpLabel}
          captionColor={captionColor}
          onPress={onHangUp}
          background={colors.dangerSolid}
          tint="#ffffff"
          haptic="warning"
        />
      </View>
    </View>
  );
}

const ROUTE_ICON: Record<AudioRoute, IconName> = {
  speaker: "volume",
  earpiece: "ear",
  bluetooth: "bluetooth",
  headset: "headphones",
};

const ROUTE_LABEL: Record<AudioRoute, string> = {
  speaker: "Hoparlör",
  earpiece: "Ahize",
  bluetooth: "Bluetooth",
  headset: "Kulaklık",
};

/** Yuvarlak kontrol + altında kısa etiket. */
function ControlButton({
  icon,
  label,
  caption,
  captionColor,
  background,
  tint,
  onPress,
  onLongPress,
  haptic = "light",
  hint,
}: {
  icon: IconName;
  label: string;
  caption: string;
  captionColor: string;
  background: string;
  tint: string;
  onPress: () => void;
  onLongPress?: () => void;
  haptic?: HapticKind;
  hint?: string;
}) {
  return (
    <View style={{ alignItems: "center", gap: spacing.xs, minWidth: 56 }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        haptic={haptic}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        style={({ pressed }) => ({
          width: 56,
          height: 56,
          borderRadius: radii.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: background,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon name={icon} size={28} color={tint} />
      </Pressable>
      <Text
        numberOfLines={1}
        style={{
          ...typography.caption,
          color: captionColor,
          textShadowColor: captionColor === "#ffffff" ? "rgba(0,0,0,0.6)" : undefined,
          textShadowRadius: captionColor === "#ffffff" ? 3 : undefined,
        }}
      >
        {caption}
      </Text>
    </View>
  );
}

/** Kulaklık bağlıyken açılan çıkış listesi — kontrol satırının üstünde. */
function RouteMenu({
  current,
  choices,
  onSelect,
}: {
  current: AudioRoute;
  choices: AudioRoute[];
  onSelect: (route: AudioRoute) => void;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "100%",
        alignItems: "center",
        paddingBottom: spacing.md,
      }}
    >
      <View
        accessibilityRole="menu"
        style={{
          minWidth: 200,
          padding: 6,
          gap: 2,
          borderRadius: radii.xl,
          borderCurve: "continuous",
          backgroundColor: colors.panel,
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          boxShadow: `0 12px 32px ${colors.shadow}`,
        }}
      >
        {choices.map((id) => (
          <Pressable
            key={id}
            noHitSlop
            haptic="light"
            accessibilityRole="menuitem"
            accessibilityState={{ selected: id === current }}
            onPress={() => onSelect(id)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              minHeight: 46,
              paddingHorizontal: spacing.md,
              borderRadius: radii.md + 2,
              borderCurve: "continuous",
              backgroundColor: pressed ? colors.raised : "transparent",
            })}
          >
            <Icon name={ROUTE_ICON[id]} size={19} color={colors.muted} />
            <Text style={{ ...typography.body, color: colors.bright, flex: 1 }}>
              {ROUTE_LABEL[id]}
            </Text>
            {id === current ? <Icon name="check" size={18} color={colors.brand} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
