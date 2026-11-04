import { ActivityIndicator, Pressable, Text, View, type ColorValue } from "react-native";

import { Icon } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n";
import { languageName } from "@/lib/translation/core";
import { useMessageTranslation, type MessageTranslationEntry } from "@/lib/translation/native";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Çevrilmiş mesajın altındaki satır: "<dil> dilinden çevrildi · Orijinali
 * göster · ×". Web: components/chat/v2/message-translation.tsx (aynı metinler).
 */
export function MessageTranslationFooter({
  messageId,
  entry,
  color,
}: {
  messageId: string;
  entry: MessageTranslationEntry;
  color: ColorValue;
}) {
  const t = useT();
  const locale = useLocale();
  const style = { ...typography.caption, fontSize: 11, color };
  if (entry.status === "loading") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 }}>
        <ActivityIndicator size="small" color={color} />
        <Text style={style}>{t("translation.footer.translating")}</Text>
      </View>
    );
  }
  const { toggleOriginal, dismiss } = useMessageTranslation.getState();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs, marginTop: 2 }}>
      <Icon name="languages" size={12} color={color} />
      <Text style={style}>{t("translation.footer.translatedFrom", { language: languageName(entry.source, locale) })}</Text>
      <Text style={style}>·</Text>
      <Pressable onPress={() => toggleOriginal(messageId)} accessibilityRole="button" hitSlop={6}>
        <Text style={{ ...style, color: colors.brand, fontWeight: "600" }}>
          {entry.showOriginal ? t("translation.footer.showTranslation") : t("translation.footer.showOriginal")}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => dismiss(messageId)}
        accessibilityRole="button"
        accessibilityLabel={t("translation.footer.dismiss")}
        hitSlop={8}
      >
        <Icon name="close" size={12} color={color} />
      </Pressable>
    </View>
  );
}
