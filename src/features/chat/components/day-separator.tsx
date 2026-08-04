import { memo } from "react";
import { Text, View } from "react-native";

import { formatDaySeparator } from "@/lib/format";
import { colors, spacing } from "@/theme/tokens";

/** Sohbette gün değişimini işaretleyen çizgi + etiket. */
export const DaySeparator = memo(function DaySeparator({ iso }: { iso: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      }}
      accessibilityRole="header"
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text
        style={{
          fontSize: 11,
          lineHeight: 14,
          fontWeight: "700",
          letterSpacing: 0.4,
          color: colors.muted,
        }}
      >
        {formatDaySeparator(iso).toLocaleUpperCase("tr")}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
});
