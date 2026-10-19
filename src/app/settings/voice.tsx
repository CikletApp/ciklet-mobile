import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";

import { Screen, SectionHeader, SegmentedTabs } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { usePreferences, type InputMode } from "@/stores/preferences";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const LEVELS = [50, 100, 150, 200] as const;

export default function VoiceSettingsScreen() {
  const inputMode = usePreferences((state) => state.inputMode);
  const inputVolume = usePreferences((state) => state.inputVolume);
  const outputVolume = usePreferences((state) => state.outputVolume);
  const setPreference = usePreferences((state) => state.setPreference);
  const t = useT();

  return (
    <Screen>
      <Stack.Screen options={{ title: t("settings.voice.title") }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <SectionHeader title={t("settings.voice.inputMode")} />
        <SegmentedTabs
          items={[
            { id: "vad" as InputMode, label: t("settings.voice.vad") },
            { id: "ptt" as InputMode, label: t("settings.voice.ptt") },
          ]}
          value={inputMode}
          onChange={(value) => setPreference("inputMode", value)}
        />
        {inputMode === "ptt" ? (
          <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
            {t("settings.voice.pttHint")}
          </Text>
        ) : null}

        <LevelPicker
          title={t("settings.voice.inputVolume")}
          value={inputVolume}
          onChange={(value) => setPreference("inputVolume", value)}
        />
        <LevelPicker
          title={t("settings.voice.outputVolume")}
          value={outputVolume}
          onChange={(value) => setPreference("outputVolume", value)}
        />

        <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.lg }}>
          {t("settings.voice.deviceNote")}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function LevelPicker({ title, value, onChange }: { title: string; value: number; onChange: (value: number) => void }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title={title} />
      <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
        {LEVELS.map((level) => {
          const selected = value === level;
          return (
            <Pressable
              key={level}
              onPress={() => onChange(level)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: "center",
                paddingVertical: spacing.md,
                borderRadius: radii.lg,
                borderCurve: "continuous",
                backgroundColor: selected ? colors.brand : pressed ? colors.raised : colors.panel,
              })}
            >
              <Text style={{ ...typography.bodyStrong, color: selected ? colors.onBrand : colors.text }}>
                %{level}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
