import { Text, View } from "react-native";

import type { DirectDisplay } from "@/api/hooks";
import { Avatar, EmojiText, GroupAvatar, Icon } from "@/components/ui";
import { OFFICIAL_INTRO } from "@/lib/official";
import { fw } from "@/theme/fonts";
import { colors, spacing, typography } from "@/theme/tokens";

/** Web `chat-welcome.tsx` ile aynı cümleler. */
const VARIANTS = [
  (name: string) => `${name} ile arandaki yeni hikayenin ilk sayfası burası.`,
  (name: string) => `${name} ile olan sessizliği bozmaya ne dersin?`,
  (name: string) => `${name} ile harika bir sohbetin başlangıcındasın.`,
];

/** Cümle sohbet başına sabit, sohbetten sohbete farklı (web'le aynı karma). */
function pickVariant(key: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % count;
}

const AVATAR_SIZE = 80;

/**
 * Boş DM'nin karşılaması: büyük avatar, ad ve kısa cümle (web
 * `ChatWelcome`). Birebir, grup, Notlarım ve resmî hesap için ayrı metin.
 * Sohbet bilgisi henüz yoksa nötr bir daire çizilir — "?" değil.
 */
export function ChatWelcome({
  display,
  myId,
  isOfficial,
}: {
  display: DirectDisplay | undefined;
  myId?: string;
  isOfficial: boolean;
}) {
  const name = display?.title ?? "";
  const description = !display
    ? null
    : isOfficial
      ? OFFICIAL_INTRO
      : display.isGroup
        ? `${display.members.length} üyeli grup sohbetinin başlangıcındasın.`
        : display.isSelf
          ? "Burası senin özel alanın. Linkleri, notları veya dosyaları kendin için saklayabilirsin."
          : VARIANTS[pickVariant(`new:direct:${name}`, VARIANTS.length)](name);

  const avatar = !display ? (
    <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: colors.raised }} />
  ) : display.isSelf ? (
    <View
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.brandSoft,
      }}
    >
      <Icon name="bookmark" size={36} color={colors.brand} />
    </View>
  ) : display.isGroup ? (
    <GroupAvatar
      members={display.members}
      excludeId={myId}
      imageUrl={display.imageUrl}
      name={name}
      size={AVATAR_SIZE}
      backgroundColor={colors.panel}
    />
  ) : (
    <Avatar
      profileId={display.peer?.id}
      imageUrl={display.imageUrl}
      fallbackText={display.fallbackText}
      size={AVATAR_SIZE}
      backgroundColor={colors.panel}
    />
  );

  return (
    <View
      style={{ alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }}
      accessibilityRole="header"
    >
      {avatar}
      {display ? (
        <EmojiText
          style={{ ...typography.display, ...fw(700), color: colors.bright, textAlign: "center" }}
          numberOfLines={2}
        >
          {display.isSelf ? "Notlarına hoşgeldin!" : name}
        </EmojiText>
      ) : null}
      {description ? (
        <Text style={{ ...typography.body, color: colors.muted, textAlign: "center" }}>{description}</Text>
      ) : null}
    </View>
  );
}
