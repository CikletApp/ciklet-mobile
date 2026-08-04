import { memo } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Icon, Pressable } from "@/components/ui";
import type { OutboxMessage } from "@/stores/outbox";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Henüz sunucuya ulaşmamış mesaj.
 *
 * Gerçek mesajlarla aynı baloncuk dilini kullanır ve sağda durur (her zaman
 * bize ait), tek farkı soluk oluşu ve durum göstergesi. Başarısız satırda
 * "Tekrar dene" / "Sil" görünür — kullanıcı yazdığı metni kaybetmez.
 */
export const OutboxItem = memo(function OutboxItem({
  message,
  onRetry,
  onDiscard,
}: {
  message: OutboxMessage;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const failed = message.status === "failed";

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-end",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <View
        style={{
          maxWidth: "78%",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.lg,
          borderBottomRightRadius: radii.sm,
          backgroundColor: colors.bubbleOwn,
          borderWidth: failed ? 1 : 0,
          borderColor: colors.danger,
          opacity: failed ? 1 : 0.6,
          gap: spacing.xs,
        }}
      >
        <Text style={{ ...typography.body, color: colors.text }}>
          {message.content}
        </Text>

        {failed ? (
          <>
            <Text style={{ ...typography.caption, color: colors.danger }}>
              {message.error ?? "Gönderilemedi"}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.lg, paddingTop: 2 }}>
              <Pressable
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Mesajı yeniden gönder"
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
              >
                <Icon name="reply" size={14} color={colors.brand} />
                <Text
                  style={{ ...typography.caption, color: colors.brand, fontWeight: "600" }}
                >
                  Tekrar dene
                </Text>
              </Pressable>

              <Pressable
                onPress={onDiscard}
                haptic="warning"
                accessibilityRole="button"
                accessibilityLabel="Mesajı sil"
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
              >
                <Icon name="close" size={14} color={colors.muted} />
                <Text
                  style={{ ...typography.caption, color: colors.muted, fontWeight: "600" }}
                >
                  Sil
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={{ alignSelf: "flex-end" }}>
            <ActivityIndicator size="small" color={colors.muted} />
          </View>
        )}
      </View>
    </View>
  );
});
