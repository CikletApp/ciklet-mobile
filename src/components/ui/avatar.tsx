import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import type { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { initialsOf } from "@/lib/format";
import { API_BASE_URL } from "@/lib/config";
import { usePresenceStatus } from "@/stores/presence";
import { colors, radii } from "@/theme/tokens";
import { PresenceDot } from "./icon";
import { fw } from "@/theme/fonts";

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
  /**
   * Presence noktasının çapını doğrudan verir.
   * Küçük avatarlarda oransal boyut okunamayacak kadar ufak kalıyor.
   */
  presenceSize?: number;
  /**
   * Köşe yarıçapını doğrudan verir ve `shape`i ezer.
   * Yarıçapı ANİMASYONLA değiştiren kaplar (sunucu rayı) 0 verip
   * kırpmayı kendi sarmalayıcısında yapar.
   */
  radius?: number;
}

export function Avatar({
  profileId,
  imageUrl,
  fallbackText,
  size = 40,
  shape = "circle",
  showPresence = false,
  presence,
  backgroundColor = colors.bg,
  radius,
  presenceSize,
}: AvatarProps) {
  // Hook koşulsuz çağrılmalı; kimlik yoksa depo OFFLINE döner.
  const livePresence = usePresenceStatus(profileId);
  const status = presence ?? livePresence;

  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  // Web kayıt akışı varsayılan avatarı göreli `/api/avatar/<username>`
  // adresiyle saklıyor. Native Image göreli URL'i çözemez; API origin'ine
  // bağlarız. Eski, imageUrl'siz profiller için de aynı deterministik uç
  // kullanılır ki web ve mobilde aynı kullanıcı aynı yüzü taşısın.
  const resolvedImageUrl = useMemo(
    () => resolveAvatarUrl(imageUrl, profileId ? fallbackText : null),
    [fallbackText, imageUrl, profileId]
  );

  const dotSize = presenceSize ?? Math.max(10, Math.round(size * 0.32));
  const borderRadius =
    radius ?? (shape === "circle" ? radii.full : Math.round(size * 0.3));
  const showFallback = !resolvedImageUrl || failedUrl === resolvedImageUrl;

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
              fontSize: Math.round(size * 0.34),
              ...fw(600),
              color: colors.text,
            }}
          >
            {fallbackText ? initialsOf(fallbackText) : "?"}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: resolvedImageUrl }}
          recyclingKey={profileId ?? resolvedImageUrl}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          onError={() => setFailedUrl(resolvedImageUrl)}
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
}

function resolveAvatarUrl(
  imageUrl: string | null | undefined,
  generatedSeed: string | null | undefined
): string | null {
  const raw = imageUrl?.trim();
  if (raw) {
    if (/^(https?:|data:image\/)/i.test(raw)) return raw;
    try {
      return new URL(raw, API_BASE_URL).toString();
    } catch {
      return null;
    }
  }

  if (!generatedSeed) return null;
  try {
    return new URL(`/api/avatar/${encodeURIComponent(generatedSeed)}`, API_BASE_URL).toString();
  } catch {
    return null;
  }
}
