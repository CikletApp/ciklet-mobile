import { View, Text } from "react-native";

import { useFriends } from "@/api/hooks";
import { EmptyState, Screen } from "@/components/ui/screen";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Bildirimler.
 *
 * Faz 1: yalnızca bekleyen arkadaşlık istekleri sayısı gösterilir — bu veri
 * zaten mevcut uçtan geliyor. Bahsedilmeler (mention), çağrı geçmişi ve
 * etkinlik bildirimleri Faz 3'te `GET /api/inbox` ve soket olaylarıyla
 * eklenecek.
 */
export default function NotificationsScreen() {
  const { incoming, isLoading } = useFriends();

  return (
    <Screen edges={["top", "left", "right"]}>
      <Text
        style={{
          ...typography.display,
          color: colors.bright,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        Bildirimler
      </Text>

      {incoming.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Burada henüz bir şey yok"
          description={
            isLoading
              ? "Yükleniyor…"
              : "Yeni bir bildirim geldiğinde burada görünecek."
          }
        />
      ) : (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.overline, color: colors.muted }}>
            ARKADAŞLIK İSTEKLERİ
          </Text>
          <Text style={{ ...typography.body, color: colors.text }}>
            {incoming.length} yeni istek bekliyor.
          </Text>
        </View>
      )}
    </Screen>
  );
}
