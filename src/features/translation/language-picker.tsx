import { useState } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, Pressable } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n";
import { languageName, resolveTargetLanguage, TRANSLATION_LANGUAGES, TRANSLATION_TARGET_AUTO } from "@/lib/translation/core";
import { nativeTranslationSupported } from "@/lib/translation/native";
import { usePreferences } from "@/stores/preferences";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export interface LanguageOption {
  value: string;
  label: string;
}

/** Alttan açılan, kaydırılabilir dil listesi (ActionSheet uzun listeyi taşımıyor). */
export function LanguageSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: LanguageOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          borderRadius: radii.md,
          backgroundColor: colors.panel,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ ...typography.body, color: colors.bright, flex: 1 }} numberOfLines={1}>
          {current}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <RNPressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setOpen(false)} />
        <View
          style={{
            maxHeight: "70%",
            backgroundColor: colors.deep,
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            paddingBottom: insets.bottom + spacing.sm,
          }}
        >
          <Text style={{ ...typography.overline, color: colors.muted, padding: spacing.md }}>{label}</Text>
          <ScrollView>
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  setOpen(false);
                  onChange(option.value);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: option.value === value }}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md }}
              >
                <Text style={{ ...typography.body, color: colors.bright, flex: 1 }}>{option.label}</Text>
                {option.value === value ? <Icon name="check" size={18} color={colors.brand} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/**
 * Ayarlar → Görünüm → Dil altında "Hedef çeviri dili" (web
 * TranslationTargetPicker ile aynı metinler). Cihazda saklanır.
 */
export function TranslationTargetSetting() {
  const t = useT();
  const locale = useLocale();
  const target = usePreferences((s) => s.translationTarget);
  const setPreference = usePreferences((s) => s.setPreference);
  const uiLanguage = resolveTargetLanguage(TRANSLATION_TARGET_AUTO, locale);
  const options: LanguageOption[] = [
    { value: TRANSLATION_TARGET_AUTO, label: t("translation.settings.auto", { language: languageName(uiLanguage, locale) }) },
    ...TRANSLATION_LANGUAGES.map((code) => ({ value: code, label: languageName(code, locale) })),
  ];
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>{t("translation.settings.title")}</Text>
      <LanguageSelect
        label={t("translation.settings.title")}
        value={target}
        options={options}
        onChange={(value) => setPreference("translationTarget", value)}
      />
      <Text style={{ ...typography.caption, color: colors.muted }}>{t("translation.settings.description")}</Text>
      {!nativeTranslationSupported() ? (
        <Text style={{ ...typography.caption, color: colors.danger }}>{t("translation.settings.unsupportedDevice")}</Text>
      ) : null}
    </View>
  );
}

/** Basit açma/kapama satırı (altyazı paneli). */
export function ToggleRow({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.body, color: colors.bright }}>{label}</Text>
        {description ? <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text> : null}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}
