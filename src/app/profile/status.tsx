import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";

import { ApiError } from "@/api/client";
import { useCurrentProfile, useUpdateProfile } from "@/api/hooks";
import { Button, Pressable, Screen, ScreenLoader, SectionHeader, showToast } from "@/components/ui";
import {
  CUSTOM_STATUS_DURATIONS,
  CUSTOM_STATUS_EMOJI_MAX,
  CUSTOM_STATUS_MAX,
  activeCustomStatus,
  customStatusUntilFrom,
} from "@/lib/custom-status";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Özel durum — emoji + metin + süre (web `CustomStatusDialog`).
 *
 * `PATCH /api/current-profile` ile kaydedilir; "Temizle" üç alanı da
 * `null` yapar. Durum adının altında herkese görünür, DM eşlerine
 * `profile.updated` ile yayılır ve süre dolunca okuyan taraf eler.
 */
export default function CustomStatusScreen() {
  const { data: profile, isLoading } = useCurrentProfile();
  if (isLoading || !profile) return <ScreenLoader />;
  // Form taslağı sunucu değeriyle bir kez kurulur (anahtar: profil kimliği).
  return <CustomStatusForm key={profile.id} initial={activeCustomStatus(profile)} />;
}

function CustomStatusForm({ initial }: { initial: ReturnType<typeof activeCustomStatus> }) {
  const update = useUpdateProfile();
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [durationId, setDurationId] = useState("never");
  const canSave = Boolean(text.trim() || emoji.trim());

  const submit = (clear: boolean) => {
    const duration =
      CUSTOM_STATUS_DURATIONS.find((d) => d.id === durationId) ??
      CUSTOM_STATUS_DURATIONS[CUSTOM_STATUS_DURATIONS.length - 1];
    const until = clear ? null : customStatusUntilFrom(duration.seconds);
    update.mutate(
      {
        customStatusText: clear ? null : text.trim() || null,
        customStatusEmoji: clear ? null : emoji.trim() || null,
        customStatusUntil: until ? until.toISOString() : null,
      },
      {
        onSuccess: () => {
          showToast(clear ? "Özel durum temizlendi." : "Özel durum ayarlandı.");
          router.back();
        },
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : "Özel durum kaydedilemedi.", "error"),
      }
    );
  };

  const fieldStyle = {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.bright,
    ...typography.body,
  } as const;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Özel Durum" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={{ ...typography.caption, color: colors.muted }}>
          Adının altında herkese görünür; süre dolunca kendiliğinden kalkar.
        </Text>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ width: 72, gap: spacing.xs }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>EMOJİ</Text>
            <TextInput
              value={emoji}
              onChangeText={(value) => setEmoji(Array.from(value).slice(0, CUSTOM_STATUS_EMOJI_MAX).join(""))}
              placeholder="😄"
              placeholderTextColor={colors.muted}
              style={{ ...fieldStyle, textAlign: "center", fontSize: 22 }}
              accessibilityLabel="Durum emojisi"
            />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>DURUM</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              maxLength={CUSTOM_STATUS_MAX}
              placeholder="Ne yapıyorsun?"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              onSubmitEditing={() => canSave && !update.isPending && submit(false)}
              style={fieldStyle}
              accessibilityLabel="Durum metni"
            />
            <Text style={{ ...typography.caption, color: colors.muted, textAlign: "right" }}>
              {text.length}/{CUSTOM_STATUS_MAX}
            </Text>
          </View>
        </View>

        <View style={{ marginHorizontal: -spacing.lg }}>
          <SectionHeader title="NE ZAMAN KALKSIN?" />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {CUSTOM_STATUS_DURATIONS.map((duration) => {
            const active = duration.id === durationId;
            return (
              <Pressable
                key={duration.id}
                onPress={() => setDurationId(duration.id)}
                haptic="light"
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  minHeight: 36,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  borderRadius: radii.full,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: active ? colors.brandSoft : "transparent",
                }}
              >
                <Text style={{ ...typography.caption, fontSize: 14, ...fw(active ? 700 : 600), color: active ? colors.brand : colors.text }}>
                  {duration.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button label="Kaydet" onPress={() => submit(false)} disabled={!canSave} loading={update.isPending} fullWidth />
          <Button
            label="Temizle"
            variant="ghost"
            onPress={() => submit(true)}
            disabled={!initial || update.isPending}
            fullWidth
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
