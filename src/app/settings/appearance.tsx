import { ScrollView, Text, View } from "react-native";

import { Icon, Pressable, Screen } from "@/components/ui";
import { THEME_LABELS, useTheme } from "@/stores/theme";
import {
  colors,
  radii,
  spacing,
  themes,
  typography,
  type ThemeId,
} from "@/theme/tokens";

const THEME_ORDER: ThemeId[] = ["light", "mist", "night", "oled"];

export default function AppearanceScreen() {
  const selected = useTheme((s) => s.themeId);
  const setTheme = useTheme((s) => s.setTheme);

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      >
        <Text style={{ ...typography.body, color: colors.muted }}>
          Ciklet Web ile aynı dört tema. Seçimin bu cihazda saklanır.
        </Text>

        {THEME_ORDER.map((themeId) => {
          const palette = themes[themeId];
          const active = selected === themeId;
          return (
            <Pressable
              key={themeId}
              onPress={() => void setTheme(themeId)}
              noHitSlop
              haptic="light"
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={({ pressed }) => ({
                minHeight: 92,
                padding: spacing.md,
                borderRadius: radii.lg,
                borderWidth: active ? 2 : 1,
                borderColor: active ? colors.brand : colors.border,
                backgroundColor: pressed ? colors.raised : colors.panel,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              })}
            >
              <View
                style={{
                  width: 82,
                  height: 58,
                  padding: spacing.xs,
                  borderRadius: radii.md,
                  backgroundColor: palette.bentoShell,
                  flexDirection: "row",
                  gap: spacing.xs,
                }}
              >
                <View style={{ width: 18, borderRadius: radii.sm, backgroundColor: palette.bento }} />
                <View style={{ flex: 1, borderRadius: radii.sm, backgroundColor: palette.bento }}>
                  <View
                    style={{
                      width: 24,
                      height: 5,
                      margin: spacing.xs,
                      borderRadius: radii.full,
                      backgroundColor: palette.brand,
                    }}
                  />
                </View>
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
                  {THEME_LABELS[themeId]}
                </Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>
                  {themeDescription(themeId)}
                </Text>
              </View>

              {active ? (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.brand,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="check" size={17} color={colors.onBrand} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function themeDescription(themeId: ThemeId): string {
  if (themeId === "light") return "Açık yüzeyler ve yüksek gün ışığı okunabilirliği";
  if (themeId === "mist") return "Yumuşak gri, düşük kontrastlı koyu görünüm";
  if (themeId === "oled") return "Saf siyah, OLED ekranlar için pil dostu";
  return "Ciklet'in varsayılan koyu görünümü";
}
