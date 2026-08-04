import { memo } from "react";
import { Text, View } from "react-native";
import { MessageType } from "@ciklet/embedded-activities-sdk/types";

import { Avatar, Icon, type IconName } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Tek mesaj satırı — baloncuk düzeni.
 *
 * Gönderdiğin mesajlar sağda ve marka tonlu, gelenler solda avatarıyla.
 * Bu ayrım okumayı hızlandırır: kimin yazdığını anlamak için ada bakmak
 * gerekmez.
 *
 * Kanal ve DM mesajları farklı şekle sahip: kanalda gönderen `member`
 * (sunucuya özel takma adıyla), DM'de doğrudan `profile`. Ayrım burada bir
 * kez yapılır, ekranlar bilmek zorunda kalmaz.
 */

const AVATAR_SIZE = 32;
const MAX_BUBBLE_WIDTH = "78%";

export const MessageItem = memo(function MessageItem({
  message,
  grouped = false,
}: {
  message: ChatMessagePayload;
  grouped?: boolean;
}) {
  const myId = useAuth((s) => s.profile?.id);

  // Sistem mesajları (çağrı, aktivite daveti) tarafsızdır — ortada çizilir.
  if (message.type !== MessageType.DEFAULT) {
    return <SystemMessage message={message} />;
  }

  const isChannel = isChannelMessage(message);
  const profile = isChannel ? message.member.profile : message.profile;
  const name = isChannel
    ? message.member.nickname?.trim() || profile.name?.trim() || profile.username
    : profile.name?.trim() || profile.username;

  const isMine = profile.id === myId;
  const showHeader = !grouped && !isMine;

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: isMine ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingTop: grouped ? 2 : spacing.sm,
        paddingBottom: 2,
      }}
      accessibilityLabel={`${isMine ? "Sen" : name}: ${
        message.deleted ? "silinmiş mesaj" : message.content
      }`}
    >
      {/* Gelen mesajlarda avatar; gruplananlarda sütun hizası korunur. */}
      {!isMine ? (
        grouped ? (
          <View style={{ width: AVATAR_SIZE }} />
        ) : (
          <Avatar
            profileId={profile.id}
            imageUrl={profile.imageUrl}
            fallbackText={profile.username}
            size={AVATAR_SIZE}
          />
        )
      ) : null}

      <View
        style={{
          maxWidth: MAX_BUBBLE_WIDTH,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.lg,
          // Baloncuğun "kuyruk" tarafı köşesi küçültülür; grup içindeki
          // ardışık mesajlarda düz kalır ki blok tek parça görünsün.
          borderBottomRightRadius: isMine && !grouped ? radii.sm : radii.lg,
          borderBottomLeftRadius: !isMine && !grouped ? radii.sm : radii.lg,
          backgroundColor: isMine ? colors.bubbleOwn : colors.bubbleOther,
          gap: 2,
        }}
      >
        {showHeader ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text
              style={{ ...typography.caption, fontWeight: "700", color: colors.brand }}
              numberOfLines={1}
            >
              {name}
            </Text>
            {profile.isBot ? (
              <View
                style={{
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 4,
                  backgroundColor: colors.brand,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: "700", color: colors.onBrand }}>
                  BOT
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text
          style={{
            ...typography.body,
            color: message.deleted ? colors.muted : colors.text,
            fontStyle: message.deleted ? "italic" : "normal",
          }}
          selectable={!message.deleted}
        >
          {message.deleted ? "Bu mesaj silindi." : message.content}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-end",
            gap: spacing.xs,
          }}
        >
          {message.createdAt !== message.updatedAt && !message.deleted ? (
            <Text style={{ fontSize: 10, color: colors.muted }}>düzenlendi</Text>
          ) : null}
          <Text style={{ fontSize: 10, lineHeight: 14, color: colors.muted }}>
            {formatTime(message.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
});

/**
 * Sistem mesajı — çağrı kayıtları ve aktivite davetleri.
 * Kimseye ait olmadığı için ortada, baloncuksuz çizilir.
 */
function SystemMessage({ message }: { message: ChatMessagePayload }) {
  const { icon, tint } = SYSTEM_STYLE[message.type] ?? {
    icon: "message" as IconName,
    tint: colors.muted,
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
      }}
    >
      <Icon name={icon} size={14} color={tint} />
      <Text style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }}>
        {message.content}
      </Text>
      <Text style={{ fontSize: 10, color: colors.muted }}>
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
}

const SYSTEM_STYLE: Partial<Record<string, { icon: IconName; tint: string }>> = {
  [MessageType.CALL_STARTED]: { icon: "phone", tint: colors.success },
  [MessageType.CALL_ENDED]: { icon: "phone", tint: colors.muted },
  [MessageType.CALL_MISSED]: { icon: "phone", tint: colors.danger },
  [MessageType.ACTIVITY_INVITE]: { icon: "compass", tint: colors.brand },
  [MessageType.ACTIVITY_REPLY]: { icon: "compass", tint: colors.muted },
};
