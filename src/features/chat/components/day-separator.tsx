import { Text, View } from "react-native";

import { formatDaySeparator } from "@/lib/format";
import { colors, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Sohbette gün değişimini işaretleyen ayraç.
 *
 * Sol tarafta kısa, sağ tarafta ekranın sonuna kadar uzayan bir çizgi:
 *
 *     ─── 12 Temmuz 2026 ────────────────────────────
 *
 * Tarih büyük harfe çevrilmez — Türkçe ay adları normal yazımda okunur.
 */
export function DaySeparator({ iso }: { iso: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
      }}
      accessibilityRole="header"
    >
      <View style={{ width: 24, height: 1, backgroundColor: colors.border }} />
      <Text
        style={{
          ...typography.caption,
          ...fw(600),
          color: colors.muted,
        }}
      >
        {formatDaySeparator(iso)}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
