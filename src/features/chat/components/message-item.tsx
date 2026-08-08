import { memo } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { MessageType } from "@ciklet/embedded-activities-sdk/types";

import { Avatar, Icon, type IconName } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
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
  onLongPress,
  onReactionPress,
}: {
  message: ChatMessagePayload;
  grouped?: boolean;
  onLongPress?: (message: ChatMessagePayload) => void;
  onReactionPress?: (message: ChatMessagePayload, emoji: string) => void;
}) {
  const myId = useAuth((s) => s.profile?.id);
  const density = usePreferences((state) => state.chatDensity);
  const bigEmoji = usePreferences((state) => state.bigEmoji);
  const compact = density === "compact";
  const largeEmoji = bigEmoji && !compact && isEmojiOnly(message.content);

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
    <Pressable
      onLongPress={() => onLongPress?.(message)}
      delayLongPress={280}
      style={{
        flexDirection: "row",
        justifyContent: isMine ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingTop: compact ? 1 : grouped ? 2 : spacing.sm,
        paddingBottom: compact ? 1 : 2,
      }}
      accessibilityRole="button"
      accessibilityHint="Mesaj eylemlerini açmak için basılı tut"
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

        {message.replyTo && !message.replyTo.deleted ? (
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: colors.brand,
              paddingLeft: spacing.sm,
              marginBottom: spacing.xs,
            }}
          >
            <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>
              {message.replyTo.content}
            </Text>
          </View>
        ) : null}

        <Text
          style={{
            ...typography.body,
            ...(largeEmoji ? { fontSize: 28, lineHeight: 34 } : null),
            color: message.deleted ? colors.muted : colors.text,
            fontStyle: message.deleted ? "italic" : "normal",
          }}
          selectable={!message.deleted}
        >
          {message.deleted ? "Bu mesaj silindi." : message.content}
        </Text>

        {message.fileUrl && !message.deleted ? (
          <Attachment url={message.fileUrl} />
        ) : null}

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

        {message.reactions?.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {groupReactions(message.reactions).map(({ emoji, count }) => (
              <Pressable
                key={emoji}
                onPress={() => onReactionPress?.(message, emoji)}
                accessibilityRole="button"
                accessibilityLabel={`${emoji} tepkisi, ${count}`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                  borderRadius: radii.full,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.raised : colors.panel,
                })}
              >
                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>{count}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

function isEmojiOnly(content: string) {
  const compact = content.replace(/\s/g, "");
  if (!compact) return false;
  const emojis = compact.match(/\p{Extended_Pictographic}/gu) ?? [];
  return emojis.length >= 1 && emojis.length <= 8 && compact.replace(/\p{Extended_Pictographic}|\uFE0F/gu, "") === "";
}

function Attachment({ url }: { url: string }) {
  const isImage = /\.(avif|gif|jpe?g|png|webp)(?:\?|$)/i.test(url);

  if (isImage) {
    return (
      <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="imagebutton">
        <Image
          source={{ uri: url }}
          contentFit="cover"
          transition={150}
          style={{
            width: 220,
            maxWidth: "100%",
            aspectRatio: 4 / 3,
            borderRadius: radii.md,
            backgroundColor: colors.deep,
          }}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel="Dosyayı aç"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.raised : colors.deep,
      })}
    >
      <Icon name="attachment" size={18} color={colors.brand} />
      <Text style={{ ...typography.caption, color: colors.text, flex: 1 }} numberOfLines={1}>
        Dosyayı aç
      </Text>
      <Icon name="chevron-right" size={14} color={colors.muted} />
    </Pressable>
  );
}

function groupReactions(reactions: NonNullable<ChatMessagePayload["reactions"]>) {
  const counts = new Map<string, number>();
  for (const reaction of reactions) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  }
  return [...counts].map(([emoji, count]) => ({ emoji, count }));
}

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
