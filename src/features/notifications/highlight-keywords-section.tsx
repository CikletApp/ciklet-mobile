import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  MAX_HIGHLIGHT_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  normalizeKeywords,
  useHighlightKeywords,
  useSaveHighlightKeywords,
} from "@/api/hooks/use-account-privacy";
import { Button, Icon, SectionHeader, showToast } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Bildirimler → Vurgu Kelimeleri (web `highlight-keywords-section.tsx`).
 * Ekle düğmesi ya da virgül/Enter ile eklenir; her değişiklik anında kaydedilir.
 */
export function HighlightKeywordsSection() {
  const t = useT();
  const { data: keywords } = useHighlightKeywords();
  const save = useSaveHighlightKeywords();
  const [draft, setDraft] = useState("");

  const persist = (next: string[]) =>
    save.mutate(normalizeKeywords(next), {
      onError: () => showToast(t("settingsMedia.notifications.keywords.saveFailed"), "error"),
    });

  const addDraft = (value: string = draft) => {
    const current = keywords ?? [];
    const candidate = normalizeKeywords([...current, ...value.split(",")]);
    if (candidate.length === current.length) {
      if (value.replace(/,/g, "").trim()) showToast(t("settingsMedia.notifications.keywords.invalid"));
      setDraft("");
      return;
    }
    setDraft("");
    persist(candidate);
  };

  const full = (keywords?.length ?? 0) >= MAX_HIGHLIGHT_KEYWORDS;

  return (
    <>
      <SectionHeader title={t("settingsMedia.notifications.keywords.title").toLocaleUpperCase()} />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>
          {t("settingsMedia.notifications.keywords.description", { max: MAX_HIGHLIGHT_KEYWORDS })}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <TextInput
            value={draft}
            // Virgül web'deki gibi kelimeyi hemen ekler.
            onChangeText={(text) => (text.includes(",") ? addDraft(text) : setDraft(text))}
            onSubmitEditing={() => addDraft()}
            submitBehavior="submit"
            returnKeyType="done"
            maxLength={MAX_KEYWORD_LENGTH + 10}
            editable={!full && !save.isPending && keywords !== undefined}
            placeholder={full ? t("settingsMedia.notifications.keywords.placeholderFull") : t("settingsMedia.notifications.keywords.placeholder")}
            placeholderTextColor={colors.muted}
            style={{
              ...typography.body,
              flex: 1,
              color: colors.text,
              backgroundColor: colors.panel,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
          />
          <Button
            label={t("settingsMedia.notifications.keywords.add")}
            icon="plus"
            onPress={() => addDraft()}
            disabled={full || save.isPending || !draft.trim()}
          />
        </View>
        {keywords === undefined ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("settingsMedia.notifications.loading")}</Text>
        ) : keywords.length === 0 ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("settingsMedia.notifications.keywords.empty")}</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {keywords.map((word) => (
              <Pressable
                key={word}
                onPress={() => persist(keywords.filter((k) => k !== word))}
                accessibilityRole="button"
                accessibilityLabel={`${t("settingsMedia.notifications.keywords.remove")}: ${word}`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                  borderRadius: radii.full,
                  backgroundColor: colors.brandSoft,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ ...typography.caption, color: colors.brand, fontWeight: "600" }}>{word}</Text>
                <Icon name="close" size={12} color={colors.brand} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </>
  );
}
