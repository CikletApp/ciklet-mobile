import { memo } from "react";
import { Text, View } from "react-native";
import { MessageType } from "@ciklet/embedded-activities-sdk/types";

import { Avatar, Icon, type IconName } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Tek mesaj satırı.
 *
 * Kanal ve DM mesajları farklı şekle sahip: kanalda gönderen `member`
 * (sunucuya özel takma adıyla), DM'de doğrudan `profile`. Ayrım burada bir
 * kez yapılır, ekranlar bilmek zorunda kalmaz.
 *
 * `grouped` olduğunda avatar ve ad tekrarlanmaz; yerine hover'da görünen
 * saat için sabit genişlikte boşluk bırakılır — metin sütunu kaymaz.
 */

const AVATAR_SIZE = 40;
const GUTTER = AVATAR_SIZE + spacing.md;

export const MessageItem = memo(function MessageItem({
  message,
  grouped = false,
}: {
  message: ChatMessagePayload;
  grouped?: boolean;
}) {
  // Sistem mesajları (çağrı, aktivite daveti) farklı bir kart olarak çizilir.
  if (message.type !== MessageType.DEFAULT) {
    return <SystemMessage message={message} />;
  }

  const isChannel = isChannelMessage(message);
  const profile = isChannel ? message.member.profile : message.profile;
  const name = isChannel
    ? message.member.nickname?.trim() || profile.name?.trim() || profile.username
    : profile.name?.trim() || profile.username;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingTop: grouped ? 2 : spacing.sm,
        paddingBottom: 2,
      }}
      accessibilityLabel={`${name}: ${message.deleted ? "silinmiş mesaj" : message.content}`}
    >
      {grouped ? (
        <View style={{ width: AVATAR_SIZE }} />
      ) : (
        <Avatar
          profileId={profile.id}
          imageUrl={profile.imageUrl}
          fallbackText={profile.username}
          size={AVATAR_SIZE}
        />
      )}

      <View style={{ flex: 1, gap: 2 }}>
        {grouped ? null : (
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}
          >
            <Text
              style={{ ...typography.bodyStrong, color: colors.bright }}
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
                <Text
                  style={{ fontSize: 9, fontWeight: "700", color: colors.onBrand }}
                >
                  BOT
                </Text>
              </View>
            ) : null}
            <Text style={{ ...typography.caption, color: colors.muted }}>
              {formatTime(message.createdAt)}
            </Text>
          </View>
        )}

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

        {message.createdAt !== message.updatedAt && !message.deleted ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>
            düzenlendi
          </Text>
        ) : null}
      </View>
    </View>
  );
});

/**
 * Sistem mesajı kartı — çağrı kayıtları ve aktivite davetleri.
 * Metin `content` alanında gelir; `metadata` zenginleştirmeleri Faz 4'te
 * aktivite kartına dönüşecek.
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
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        marginLeft: GUTTER - AVATAR_SIZE,
      }}
    >
      <View
        style={{
          width: AVATAR_SIZE,
          alignItems: "center",
        }}
      >
        <Icon name={icon} size={18} color={tint} />
      </View>
      <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>
        {message.content}
      </Text>
      <Text style={{ ...typography.caption, color: colors.muted }}>
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
