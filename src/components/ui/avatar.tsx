import { memo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import type { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { usePresenceStatus } from "@/stores/presence";
import { colors, radii } from "@/theme/tokens";
import { PresenceDot } from "./icon";

/**
 * Avatar + presence rozeti.
 *
 * `expo-image` kullanılır: disk/bellek önbelleği, `recyclingKey` ile liste
 * geri dönüşümünde eski görselin bir kare görünmesi sorunu yok, ve
 * `placeholder` ile yükleme sırasında düzen zıplamaz.
 */

interface AvatarProps {
  /** Kimliği verilirse presence deposundan canlı durum okunur. */
  profileId?: string;
  imageUrl?: string | null;
  /** Görsel yüklenemezse baş harf için. */
  fallbackText?: string | null;
  size?: number;
  /** Sunucu ikonları kare-yuvarlak, kişiler tam yuvarlak. */
  shape?: "circle" | "squircle";
  showPresence?: boolean;
  /** Presence dışarıdan verilirse depo okunmaz (üye listesi toplu render). */
  presence?: PresenceStatus;
  /** Rozetin oturduğu zemin rengi — halka bununla çizilir. */
  backgroundColor?: string;
}

export const Avatar = memo(function Avatar({
  profileId,
  imageUrl,
  fallbackText,
  size = 40,
  shape = "circle",
  showPresence = false,
  presence,
  backgroundColor = colors.bg,
}: AvatarProps) {
  // Hook koşulsuz çağrılmalı; kimlik yoksa depo OFFLINE döner.
  const livePresence = usePresenceStatus(profileId);
  const status = presence ?? livePresence;

  const dotSize = Math.max(10, Math.round(size * 0.32));
  const borderRadius = shape === "circle" ? radii.full : Math.round(size * 0.3);

  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={imageUrl ?? undefined}
        recyclingKey={profileId ?? imageUrl ?? undefined}
        contentFit="cover"
        transition={120}
        cachePolicy="memory-disk"
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: colors.raised,
        }}
        accessibilityLabel={fallbackText ? `${fallbackText} avatarı` : "Avatar"}
      />

      {showPresence && profileId ? (
        <View
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
          }}
        >
          <PresenceDot status={status} size={dotSize} ringColor={backgroundColor} />
        </View>
      ) : null}
    </View>
  );
});
