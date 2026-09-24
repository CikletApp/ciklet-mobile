import { useEffect, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";

import { colors, radii, spacing } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Okunmamış rozeti.
 *
 * 99'dan sonra "99+" gösterir — dört haneli bir sayı satır düzenini bozar
 * ve zaten hiçbir kullanıcıya "137 okunmamış" ile "99+" arasındaki fark
 * bir şey ifade etmez.
 */
export function UnreadBadge({
  count,
  /** Sayı yerine sade bir nokta (sessize alınmış kanallar). */
  dot = false,
  /**
   * `brand`: sohbet listesi ve sekme çubuğu — tema vurgusu, okunacak bir şey
   * var. `danger`: dikkat isteyen sayaçlar (bahsedilme, sunucu rayı).
   */
  tone = "danger",
}: {
  count: number;
  dot?: boolean;
  tone?: "brand" | "danger";
}) {
  if (count <= 0) return null;

  if (dot) {
    return (
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: radii.full,
          backgroundColor: colors.bright,
        }}
        accessibilityLabel="Okunmamış mesaj var"
      />
    );
  }

  const label = count > 99 ? "99+" : String(count);

  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        borderRadius: radii.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "brand" ? colors.brand : colors.danger,
      }}
      accessibilityLabel={`${count} okunmamış mesaj`}
    >
      <Text
        style={{
          fontSize: 11,
          lineHeight: 14,
          ...fw(700),
          color: tone === "brand" ? colors.onBrand : colors.bright,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Renkli etiket — "Yakında", "Doğrulanmış" gibi durum işaretleri. */
export function Tag({
  label,
  tint = colors.muted,
  background = colors.raised,
}: {
  label: string;
  tint?: string;
  background?: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radii.sm,
        backgroundColor: background,
      }}
    >
      <Text style={{ fontSize: 11, lineHeight: 15, ...fw(600), color: tint }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Yükleniyor iskeleti.
 *
 * Nabız animasyonu `useNativeDriver` ile UI iş parçacığında çalışır;
 * JS iş parçacığı liste render'ıyla meşgulken bile takılmaz.
 */
export function Skeleton({
  width,
  height = 14,
  radius = radii.sm,
}: {
  width: number | `${number}%`;
  height?: number;
  radius?: number;
}) {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: colors.raised,
        opacity,
      }}
    />
  );
}

/** Liste yükleniyor durumu — birkaç iskelet satırı. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
        >
          <Skeleton width={44} height={44} radius={radii.full} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton width="55%" />
            <Skeleton width="35%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}
