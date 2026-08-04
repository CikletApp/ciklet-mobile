import { Stack, router } from "expo-router";
import { Pressable, Text } from "react-native";

import { EmptyState, Screen } from "@/components/ui/screen";
import { colors, typography } from "@/theme/tokens";

/**
 * Bilinmeyen rota. Derin bağlantı (`ciklet://…`) yanlış/eski bir adres
 * taşıdığında kullanıcı boş ekranda kalmasın.
 */
export default function NotFoundScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Sayfa bulunamadı" }} />
      <EmptyState
        icon="compass"
        title="Böyle bir sayfa yok"
        description="Bağlantı geçersiz olabilir veya içerik kaldırılmış olabilir."
        action={
          <Pressable
            onPress={() => router.replace("/")}
            accessibilityRole="button"
          >
            <Text style={{ ...typography.bodyStrong, color: colors.brand }}>
              Ana sayfaya dön
            </Text>
          </Pressable>
        }
      />
    </Screen>
  );
}
