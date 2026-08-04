import { memo } from "react";
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Tek mesaj satırı.
 *
 * Kanal ve DM mesajları farklı şekle sahip: kanalda gönderen `member`
 * (sunucuya özel takma adıyla), DM'de doğrudan `profile`. Ayrım burada
 * bir kez yapılır, ekranlar bilmek zorunda kalmaz.
 *
 * Faz 2: ardışık mesaj gruplama, tarih ayracı, yanıt bağlamı, reaksiyonlar,
 * dosya önizlemesi ve sistem mesajı kartları (`CALL_*`, `ACTIVITY_INVITE`).
 */
export const MessageItem = memo(function MessageItem({
  message,
}: {
  message: ChatMessagePayload;
}) {
  const isChannel = isChannelMessage(message);
  const profile = isChannel ? message.member.profile : message.profile;
  const name = isChannel
    ? (message.member.nickname?.trim() || profile.name?.trim() || profile.username)
    : (profile.name?.trim() || profile.username);

  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
      }}
    >
      <Avatar
        profileId={profile.id}
        imageUrl={profile.imageUrl}
        fallbackText={profile.username}
        size={40}
      />

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {formatTime(message.createdAt)}
          </Text>
        </View>

        <Text
          style={{
            ...typography.body,
            color: message.deleted ? colors.muted : colors.text,
            fontStyle: message.deleted ? "italic" : "normal",
          }}
        >
          {message.deleted ? "Bu mesaj silindi." : message.content}
        </Text>
      </View>
    </View>
  );
});

function formatTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return sameDay
    ? date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
}
