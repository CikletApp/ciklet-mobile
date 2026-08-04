import { memo } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Avatar, Icon, Pressable } from "@/components/ui";
import type { OutboxMessage } from "@/stores/outbox";
import { useAuth } from "@/stores/auth";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Henüz sunucuya ulaşmamış mesaj satırı.
 *
 * Gerçek mesajlarla aynı hizada çizilir; tek farkı sağdaki durum
 * göstergesi. Başarısız satırda "Tekrar dene" ve "Sil" görünür — kullanıcı
 * yazdığı metni kaybetmez.
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
  const me = useAuth((s) => s.profile);
  const failed = message.status === "failed";

  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        opacity: failed ? 1 : 0.6,
      }}
    >
      <Avatar
        profileId={me?.id}
        imageUrl={me?.imageUrl}
        fallbackText={me?.username}
        size={40}
      />

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
            {me?.name?.trim() || me?.username || "Sen"}
          </Text>
          {failed ? (
            <Text style={{ ...typography.caption, color: colors.danger }}>
              {message.error ?? "Gönderilemedi"}
            </Text>
          ) : (
            <ActivityIndicator size="small" color={colors.muted} />
          )}
        </View>

        <Text style={{ ...typography.body, color: colors.text }}>
          {message.content}
        </Text>

        {failed ? (
          <View style={{ flexDirection: "row", gap: spacing.lg, paddingTop: spacing.xs }}>
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Mesajı yeniden gönder"
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
            >
              <Icon name="reply" size={14} color={colors.brand} />
              <Text style={{ ...typography.caption, color: colors.brand, fontWeight: "600" }}>
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
              <Text style={{ ...typography.caption, color: colors.muted, fontWeight: "600" }}>
                Sil
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
});
