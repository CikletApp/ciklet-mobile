import { Text, View } from "react-native";

import type { SearchProfileSlim } from "@/api/types";
import { Avatar, Pressable, emojify } from "@/components/ui";
import { displayNameOf, formatRelativeShort } from "@/lib/format";
import { formatMessagePreview } from "@/lib/message-preview";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Kaydedilenler ve Bahsetmeler listelerinin ortak satırı: nerede (kanal /
 * sohbet), kim, ne zaman ve mesajın kısa önizlemesi. Dokununca sohbet
 * açılır; basılı tutma eylemi çağırana kalır (ör. kaydı kaldır).
 */
export function MessagePreviewRow({
  id,
  author,
  where,
  content,
  hasFile,
  createdAt,
  onPress,
  onLongPress,
  trailing,
}: {
  id: string;
  author: SearchProfileSlim | null;
  where: string;
  content: string;
  hasFile?: boolean;
  createdAt: string;
  onPress: () => void;
  onLongPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const name = author ? displayNameOf(author) : "Bir kullanıcı";
  // Ek mesajında içerik dosyanın adresi olabilir; adres görünmez (lib/message-preview).
  const text = formatMessagePreview({ content }, { fallback: hasFile ? "📎 Ek" : "" });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={`${where}, ${name}: ${text}`}
      style={({ pressed }) => ({
        marginHorizontal: spacing.lg,
        padding: spacing.md,
        gap: spacing.sm,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.raised : colors.panel,
      })}
    >
      <Text style={{ ...typography.caption, ...fw(700), color: colors.muted }} numberOfLines={1}>
        {where}
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Avatar profileId={author?.id} imageUrl={author?.imageUrl} fallbackText={author?.username ?? "?"} size={36} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright, flexShrink: 1 }} numberOfLines={1}>
              {name}
            </Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>{formatRelativeShort(createdAt)}</Text>
          </View>
          <Text style={{ ...typography.body, color: colors.text }} numberOfLines={4}>
            {emojify(text, `prev-${id}`, 16)}
          </Text>
        </View>
        {trailing}
      </View>
    </Pressable>
  );
}
