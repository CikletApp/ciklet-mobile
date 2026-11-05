import { Pressable, Text, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";

import { useT } from "@/lib/i18n";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Kök hata sınırı (expo-router `ErrorBoundary` dışa aktarımı, app/_layout).
 *
 * Bu olmadan beklenmeyen bir çizim hatası expo-router'ın varsayılan
 * ekranına düşer ve o ekran ham hata metnini (JS iletisi, dosya adı) ve
 * geliştirme bilgisini gösterir. Burada yalnızca sabit, çevrilmiş metin
 * çıkar; hata ayrıntısı yalnızca geliştirme konsoluna yazılır.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = useT();
  if (__DEV__) console.warn("[hata sınırı]", error);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing["3xl"],
        gap: spacing.md,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ ...typography.title, color: colors.bright, textAlign: "center" }}>
        {t("common.errorTitle")}
      </Text>
      <Text style={{ ...typography.body, color: colors.muted, textAlign: "center" }}>
        {t("common.errorBody")}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => void retry()} hitSlop={12}>
        <Text style={{ ...typography.bodyStrong, color: colors.brand }}>{t("common.retry")}</Text>
      </Pressable>
    </View>
  );
}
