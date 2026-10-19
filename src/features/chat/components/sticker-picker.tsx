import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Image } from "expo-image";

import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useServerStickers, type ServerStickerLite } from "../server-assets";
import type { CollapsingChrome } from "./collapsing-chrome";

/**
 * Sunucu çıkartmaları — ciklet-web ifade seçicisindeki "Çıkartma" sekmesi.
 * Dokununca hemen gönderilir; sunucu kimliği doğrular ve metadata'yı
 * kanonik değerle ezer (`metadata.sticker = { id }` yeterli).
 */

const COLUMNS = 4;

export function StickerPicker({
  serverId,
  onSticker,
  bottomInset,
  chrome,
}: {
  serverId: string;
  onSticker: (sticker: ServerStickerLite) => void;
  bottomInset: number;
  chrome: CollapsingChrome;
}) {
  const stickers = useServerStickers(serverId);

  if (stickers.isLoading) return <ActivityIndicator color={colors.brand} style={{ flex: 1 }} />;

  return (
    <Animated.FlatList
      data={stickers.data ?? []}
      key="sticker-grid"
      numColumns={COLUMNS}
      keyExtractor={(item) => item.id}
      onScroll={chrome.scrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={{ padding: spacing.sm, paddingBottom: bottomInset }}
      ListEmptyComponent={
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", padding: spacing.xl }}>
          Bu sunucuda henüz çıkartma yok.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={{ width: `${100 / COLUMNS}%`, aspectRatio: 1, padding: spacing.xs }}>
          <Pressable
            onPress={() => onSticker(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name} çıkartmasını gönder`}
            style={({ pressed }) => ({
              flex: 1,
              padding: spacing.xs,
              borderRadius: radii.md,
              backgroundColor: pressed ? colors.raised : "transparent",
            })}
          >
            <Image source={{ uri: item.imageUrl }} contentFit="contain" style={{ flex: 1 }} accessibilityLabel={item.name} />
          </Pressable>
        </View>
      )}
    />
  );
}
