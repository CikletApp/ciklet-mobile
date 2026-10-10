import { Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Avatar, TypingDots } from "@/components/ui";
import { typingLabel } from "@/realtime/use-typing";
import type { Typer } from "@/stores/typing";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { AVATAR_SIZE } from "./message-item";

/** Birden çok kişi yazarken üst üste binen küçük avatarlar. */
const STACK_SIZE = 22;

/**
 * Listenin en altındaki "yazıyor" balonu — gelen mesaj balonu biçiminde,
 * içinde sırayla zıplayan üç nokta. Birebir sohbette yalnızca noktalar
 * (kim olduğu başlıkta yazıyor); grupta ve kanalda avatar ve ad da var.
 *
 * Giriş/çıkış yalnızca opaklık: hücre ters listenin çevirme dönüşümlerinin
 * içinde, yönlü animasyonlar ters oynayabilir.
 */
export function TypingBubble({ typers, group }: { typers: Typer[]; group: boolean }) {
  const label = typingLabel(typers, { ellipsis: false });
  const shown = typers.slice(0, 3);

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      accessibilityLiveRegion="polite"
      accessibilityLabel={typingLabel(typers) ?? "yazıyor"}
      style={{
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "flex-end",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: 2,
      }}
    >
      {group ? (
        <View style={{ width: AVATAR_SIZE, alignItems: "flex-start" }}>
          {shown.length === 1 ? (
            <Avatar
              profileId={shown[0].id}
              imageUrl={shown[0].imageUrl}
              fallbackText={shown[0].username}
              size={AVATAR_SIZE}
            />
          ) : (
            <View style={{ flexDirection: "row" }}>
              {shown.map((typer, index) => (
                <View
                  key={typer.id}
                  style={{
                    // Yığın avatar sütununa sığsın (2–3 kişi).
                    marginLeft: index === 0 ? 0 : (AVATAR_SIZE - STACK_SIZE) / (shown.length - 1) - STACK_SIZE,
                    borderRadius: radii.full,
                    borderWidth: 2,
                    borderColor: colors.chat,
                  }}
                >
                  <Avatar
                    profileId={typer.id}
                    imageUrl={typer.imageUrl}
                    fallbackText={typer.username}
                    size={STACK_SIZE - 4}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      <View
        style={{
          minHeight: 36,
          justifyContent: "center",
          gap: 4,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          borderRadius: radii.lg,
          borderBottomLeftRadius: radii.sm,
          borderCurve: "continuous",
          backgroundColor: colors.bubbleOther,
        }}
      >
        {group && label ? (
          <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
        <TypingDots color={colors.muted} />
      </View>
    </Animated.View>
  );
}
