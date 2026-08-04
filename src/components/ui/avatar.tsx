import { memo, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import type { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { initialOf } from "@/lib/format";
import { usePresenceStatus } from "@/stores/presence";
import { colors, radii } from "@/theme/tokens";
import { PresenceDot } from "./icon";

/**
 * Avatar + presence rozeti.
 *
 * Görsel yoksa veya yüklenemezse **baş harf** çizilir. Bu yalnızca estetik
 * değil: ilk sürümde görsel başarısız olduğunda boş bir kutu kalıyordu ve
 * sunucu rayı koyu zeminde tamamen görünmez oluyordu — "sunucular yok" gibi
 * görünen sorunların bir kısmı aslında buydu.
 */

interface AvatarProps {
  /** Kimliği verilirse presence deposundan canlı durum okunur. */
  profileId?: string;
  imageUrl?: string | null;
  /** Baş harf yedeği için görünen ad. */
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

  const [failed, setFailed] = useState(false);

  const dotSize = Math.max(10, Math.round(size * 0.32));
  const borderRadius = shape === "circle" ? radii.full : Math.round(size * 0.3);
  const showFallback = !imageUrl || failed;

  return (
    <View style={{ width: size, height: size }}>
      {showFallback ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.raised,
          }}
          accessibilityLabel={fallbackText ? `${fallbackText} avatarı` : "Avatar"}
        >
          <Text
            style={{
              fontSize: Math.round(size * 0.4),
              fontWeight: "600",
              color: colors.text,
            }}
          >
            {fallbackText ? initialOf(fallbackText) : "?"}
          </Text>
        </View>
      ) : (
        <Image
          source={imageUrl}
          recyclingKey={profileId ?? imageUrl}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          style={{
            width: size,
            height: size,
            borderRadius,
            backgroundColor: colors.raised,
          }}
          accessibilityLabel={fallbackText ? `${fallbackText} avatarı` : "Avatar"}
        />
      )}

      {showPresence && profileId ? (
        <View style={{ position: "absolute", right: -1, bottom: -1 }}>
          <PresenceDot status={status} size={dotSize} ringColor={backgroundColor} />
        </View>
      ) : null}
    </View>
  );
});
