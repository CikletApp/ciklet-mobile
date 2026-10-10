import { Text, View } from "react-native";

import { Pressable, TypingDots } from "@/components/ui";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Sohbet başlığı: avatar, ad ve canlı alt satır ("çevrimiçi", "yazıyor…",
 * "Minecraft oynuyor", grup üyeleri). Dokununca profil ya da grup bilgisi
 * açılır — kullanıcı karşısındakini başlıktan tanır, sağ üstteki küçük
 * avatarı aramak zorunda kalmaz.
 */
export function ChatHeaderTitle({
  avatar,
  title,
  subtitle,
  subtitleTone = "muted",
  typing = false,
  onPress,
  accessibilityLabel,
}: {
  avatar: React.ReactNode;
  title: string;
  subtitle?: string | null;
  /** `live`: yazıyor / etkinlik — vurgu renginde. */
  subtitleTone?: "muted" | "live";
  /** Alt satır "yazıyor": önünde hareketli noktalar. */
  typing?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      noHitSlop
      accessibilityRole={onPress ? "button" : "header"}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm + 2,
        paddingVertical: 4,
        paddingRight: spacing.sm,
        opacity: pressed ? 0.7 : 1,
        maxWidth: 240,
      })}
    >
      {avatar}
      <View style={{ flexShrink: 1 }}>
        <Text style={{ ...typography.bodyStrong, fontSize: 16.5, color: colors.bright }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && typing ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <TypingDots size={4} gap={2.5} distance={2} color={colors.brand} />
            <Text
              style={{ ...typography.caption, fontSize: 12.5, lineHeight: 16, color: colors.brand, flexShrink: 1 }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>
        ) : subtitle ? (
          <Text
            style={{
              ...typography.caption,
              fontSize: 12.5,
              lineHeight: 16,
              color: subtitleTone === "live" ? colors.brand : colors.muted,
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
