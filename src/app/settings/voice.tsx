import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";

import { useMentolPlan } from "@/api/hooks/use-settings";
import { Icon, Screen, SectionHeader, SegmentedTabs } from "@/components/ui";
import { useMicTest } from "@/features/voice/mic-test";
import { INTL_LOCALES, useLocale, useT } from "@/lib/i18n";
import {
  BOOST_STREAM_QUALITIES,
  PLAN_MAX_STREAM_QUALITY,
  STREAM_QUALITY_HINT_KEYS,
  STREAM_QUALITY_OPTIONS,
  clampStreamQuality,
  qualityAllowed,
} from "@/lib/stream-quality";
import type { NoiseSuppressionMode } from "@/lib/noise-suppression";
import { usePreferences, type InputMode } from "@/stores/preferences";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const LEVELS = [50, 100, 150, 200] as const;

export default function VoiceSettingsScreen() {
  const inputMode = usePreferences((state) => state.inputMode);
  const noiseSuppressionMode = usePreferences((state) => state.noiseSuppressionMode);
  const inputVolume = usePreferences((state) => state.inputVolume);
  const outputVolume = usePreferences((state) => state.outputVolume);
  const echoCancellation = usePreferences((state) => state.echoCancellation);
  const autoGainControl = usePreferences((state) => state.autoGainControl);
  const streamQuality = usePreferences((state) => state.streamQuality);
  const setPreference = usePreferences((state) => state.setPreference);
  const t = useT();
  const intl = INTL_LOCALES[useLocale()];
  const { isTesting, volumeLevel, toggleTest } = useMicTest();
  // Web ile aynı: plan tavanı üstü kilitli; Takviye kaliteleri her planda seçilebilir.
  const planMax = PLAN_MAX_STREAM_QUALITY[useMentolPlan().data?.plan ?? "FREE"];
  const shownQuality = BOOST_STREAM_QUALITIES.has(streamQuality) ? streamQuality : clampStreamQuality(streamQuality, planMax);

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

        {/* Web Ayarlar → Ses "Gürültü Azaltma" ile aynı kipler; Gelişmiş yalnızca web/masaüstü. */}
        <SectionHeader title={t("settings.voice.noise")} />
        <SegmentedTabs
          items={[
            { id: "off" as NoiseSuppressionMode, label: t("settings.voice.noiseOff") },
            { id: "standard" as NoiseSuppressionMode, label: t("settings.voice.noiseStandard") },
          ]}
          value={noiseSuppressionMode}
          onChange={(value) => setPreference("noiseSuppressionMode", value)}
        />
        <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          {t(noiseSuppressionMode === "off" ? "settings.voice.noiseOffHint" : "settings.voice.noiseStandardHint")}{" "}
          {t("settings.voice.noiseAdvancedNote")}
        </Text>

        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radii.lg, borderCurve: "continuous", backgroundColor: colors.panel, overflow: "hidden" }}>
          <SwitchRow
            title={t("settingsMedia.voice.noise.echoTitle")}
            description={t("settingsMedia.voice.noise.echoDescription")}
            value={echoCancellation}
            onChange={(value) => setPreference("echoCancellation", value)}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }} />
          <SwitchRow
            title={t("settingsMedia.voice.noise.gainTitle")}
            description={t("settingsMedia.voice.noise.gainDescription")}
            value={autoGainControl}
            onChange={(value) => setPreference("autoGainControl", value)}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }} />
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...typography.caption, color: colors.muted }}>{t("settingsMedia.voice.noise.micTest")}</Text>
              <Pressable
                onPress={toggleTest}
                accessibilityRole="button"
                accessibilityState={{ selected: isTesting }}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                  borderRadius: radii.full,
                  backgroundColor: isTesting ? colors.danger : colors.brand,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ ...typography.caption, fontWeight: "700", color: colors.onBrand }}>
                  {isTesting ? t("settingsMedia.voice.noise.stop") : t("settingsMedia.voice.noise.test")}
                </Text>
              </Pressable>
            </View>
            <MicLevelMeter level={volumeLevel} active={isTesting} />
          </View>
        </View>

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

        <SectionHeader title={t("settingsMedia.voice.streamQuality.title").toLocaleUpperCase(intl)} />
        <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          {t("settingsMedia.voice.streamQuality.description")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {STREAM_QUALITY_OPTIONS.map((option) => {
            const allowed = qualityAllowed(option.id, planMax) || BOOST_STREAM_QUALITIES.has(option.id);
            const selected = shownQuality === option.id;
            return (
              <Pressable
                key={option.id}
                disabled={!allowed}
                onPress={() => setPreference("streamQuality", option.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: !allowed }}
                style={({ pressed }) => ({
                  flexBasis: "47%",
                  flexGrow: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: selected ? colors.brand : colors.border,
                  backgroundColor: selected ? colors.brandSoft : pressed ? colors.raised : colors.panel,
                  opacity: allowed ? 1 : 0.6,
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.text }} numberOfLines={1}>
                    {option.id === "source" ? t("settingsMedia.voice.streamQuality.sourceLabel") : option.label}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                    {t(`settingsMedia.voice.streamQuality.hints.${STREAM_QUALITY_HINT_KEYS[option.id]}`)}
                  </Text>
                </View>
                {!allowed ? <Icon name="lock" size={16} color={colors.muted} /> : null}
              </Pressable>
            );
          })}
        </View>

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

function SwitchRow({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.text }}>{title}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" accessibilityLabel={title} />
    </View>
  );
}

/** Web `MicLevelMeter`: 0-1 seviye, test kapalıyken sönük. */
function MicLevelMeter({ level, active }: { level: number; active: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
  return (
    <View style={{ height: 8, borderRadius: radii.full, backgroundColor: colors.raised, overflow: "hidden", opacity: active ? 1 : 0.5 }}>
      <View style={{ width: `${pct}%`, height: "100%", borderRadius: radii.full, backgroundColor: pct > 85 ? colors.danger : colors.online }} />
    </View>
  );
}
