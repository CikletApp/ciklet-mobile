import { ScrollView, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";
import { Pressable } from "./pressable";

/**
 * Segment kontrolü.
 *
 * İki görünüm:
 *  - `underline` : ekran içi ana bölümler (Kullanıcı Profili ⇄ Sunucu Profilleri)
 *  - `pill`      : filtre çipleri (arama kategorileri)
 *
 * Üçten fazla seçenek varsa `pill` yatay kaydırılabilir olur; `underline`
 * sabittir çünkü kaydırılan alt çizgi hangi sekmede olduğunu gizler.
 */

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Sağda küçük sayı (ör. bekleyen istek adedi). */
  count?: number;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  variant = "underline",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: "underline" | "pill";
}) {
  if (variant === "pill") {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
        }}
      >
        {items.map((item) => {
          const active = item.id === value;
          return (
            <Pressable
              key={item.id}
              onPress={() => onChange(item.id)}
              haptic="light"
              noHitSlop
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: radii.full,
                backgroundColor: active ? colors.brand : colors.panel,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text
                style={{
                  ...typography.caption,
                  fontWeight: "600",
                  color: active ? colors.onBrand : colors.text,
                }}
              >
                {item.label}
              </Text>
              {item.count ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: active ? colors.onBrand : colors.muted,
                  }}
                >
                  {item.count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            haptic="light"
            noHitSlop
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
              paddingVertical: spacing.md,
              borderBottomWidth: 2,
              borderBottomColor: active ? colors.brand : "transparent",
            }}
          >
            <Text
              style={{
                ...typography.bodyStrong,
                color: active ? colors.bright : colors.muted,
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.count ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {item.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
