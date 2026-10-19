import { useMemo } from "react";
import { ActivityIndicator, FlatList, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";

import { useChatMessages } from "@/api/hooks";
import { EmptyState, Icon, Pressable } from "@/components/ui";
import { openImageViewer } from "@/components/ui/image-viewer";
import { classifyAttachment, readAttachmentInfo } from "@/lib/attachments";
import { extraAttachments, isSensitive, isSpoilerName } from "@/lib/message-extras";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Medya kanalı galeri görünümü — kanaldaki görsel ve videoların ızgarası
 * (web: medya kanalında galeri). Veri sohbetin kendi önbelleğinden gelir
 * (aynı `useChatMessages` sayfaları); aşağı kaydırdıkça eski sayfalar
 * çekilir. Görsele dokununca görüntüleyici açılır; spoiler ve hassas
 * medya ızgarada örtülü durur.
 */
interface GalleryItem {
  key: string;
  url: string;
  kind: "image" | "video";
  hidden: boolean;
}

const COLUMNS = 3;

export function MediaGallery({ channelId }: { channelId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useChatMessages("channel", channelId);
  const { width } = useWindowDimensions();
  const size = Math.floor((width - spacing.xs * (COLUMNS + 1)) / COLUMNS);

  const items = useMemo(() => {
    const list: GalleryItem[] = [];
    for (const page of data?.pages ?? []) {
      for (const message of page.items) {
        if (message.deleted || !message.fileUrl) continue;
        const sensitive = isSensitive(message.metadata);
        const info = readAttachmentInfo(message.metadata);
        const all = [
          { url: message.fileUrl, name: info?.name, type: info?.type },
          ...extraAttachments(message.metadata, message.fileUrl),
        ];
        all.forEach((attachment, index) => {
          const kind = classifyAttachment(attachment.url, { name: attachment.name, type: attachment.type });
          if (kind !== "image" && kind !== "video" && kind !== "probe") return;
          list.push({
            key: `${message.id}:${index}`,
            url: attachment.url,
            kind: kind === "video" ? "video" : "image",
            hidden: sensitive || isSpoilerName(attachment.name),
          });
        });
      }
    }
    return list;
  }, [data]);

  if (isLoading) return <ActivityIndicator color={colors.muted} style={{ marginTop: spacing["2xl"] }} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="image"
        title="Henüz medya yok"
        description="Bu kanala görsel ya da video gönderildikçe burada toplanır."
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.key}
      numColumns={COLUMNS}
      style={{ backgroundColor: colors.chat }}
      contentContainerStyle={{ padding: spacing.xs / 2, paddingBottom: spacing["3xl"] }}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator color={colors.muted} style={{ margin: spacing.lg }} /> : null
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={item.kind === "image" ? () => openImageViewer(item.url) : undefined}
          noHitSlop
          accessibilityRole="imagebutton"
          accessibilityLabel={item.kind === "video" ? "Video" : "Görsel"}
          style={{ width: size, height: size, margin: spacing.xs / 2, backgroundColor: colors.panel, overflow: "hidden" }}
        >
          {item.kind === "image" ? (
            <Image
              source={{ uri: item.url }}
              contentFit="cover"
              blurRadius={item.hidden ? 40 : 0}
              style={{ flex: 1 }}
              recyclingKey={item.key}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Icon name="play" size={28} color={colors.bright} />
              <Text style={{ ...typography.caption, color: colors.muted }}>Video</Text>
            </View>
          )}
          {item.hidden ? (
            <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
              <Icon name="eye-off" size={22} color={colors.bright} />
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
}
