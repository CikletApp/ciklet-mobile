import { FlatList, RefreshControl, View } from "react-native";
import { router, Stack } from "expo-router";

import { useBookmarks, useToggleBookmark } from "@/api/hooks";
import type { BookmarkEntry } from "@/api/types";
import { EmptyState, IconButton, ListSkeleton, Screen, showToast } from "@/components/ui";
import { MessagePreviewRow } from "@/features/social/message-preview-row";
import { colors, spacing } from "@/theme/tokens";
import { usePullRefresh } from "@/lib/use-pull-refresh";

/**
 * Kaydedilenler (web `/saved`) — mesaj eylemlerinde "Kaydet" ile işaretlenen
 * mesajlar, en yeni kayıt önce. Erişim listede sunucuda yeniden
 * doğrulanır: sunucudan ayrılan ya da kanalı artık göremeyen kullanıcı
 * eski kaydı üzerinden mesajı okuyamaz.
 */
export default function SavedScreen() {
  const bookmarks = useBookmarks();
  const pull = usePullRefresh(bookmarks.refetch);
  const toggle = useToggleBookmark();

  const open = (entry: BookmarkEntry) => {
    if (entry.scope === "direct") {
      router.push(`/chat/direct/${entry.chatId}`);
      return;
    }
    // Kayıt sunucu kimliğini ayrı taşımıyor; web adresinden okunur.
    const serverId = /^\/servers\/([^/]+)\//.exec(entry.url)?.[1];
    router.push(serverId ? `/chat/channel/${entry.chatId}?serverId=${serverId}` : `/chat/channel/${entry.chatId}`);
  };

  const remove = (entry: BookmarkEntry) =>
    toggle.mutate(
      { target: { messageId: entry.messageId, scope: entry.scope, chatId: entry.chatId }, saved: true },
      { onSuccess: () => showToast("Kayıt kaldırıldı."), onError: () => showToast("Kayıt kaldırılamadı.", "error") }
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: "Kaydedilenler" }} />
      {bookmarks.isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={bookmarks.data ?? []}
          keyExtractor={(entry) => entry.messageId}
          contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={{ flex: 1, paddingTop: spacing["3xl"] }}>
              <EmptyState
                icon="bookmark"
                title="Kaydedilen mesaj yok"
                description="Bir mesajı basılı tutup Kaydet'i seçtiğinde burada görünür."
              />
            </View>
          }
          renderItem={({ item }) => (
            <MessagePreviewRow
              id={item.messageId}
              author={item.author}
              where={item.scope === "channel" ? `#${item.channelName ?? "kanal"} · ${item.serverName ?? ""}` : "Doğrudan mesaj"}
              content={item.content}
              hasFile={Boolean(item.fileUrl)}
              createdAt={item.createdAt}
              onPress={() => open(item)}
              trailing={<IconButton icon="trash" label="Kaydı kaldır" tint={colors.muted} onPress={() => remove(item)} />}
            />
          )}
        />
      )}
    </Screen>
  );
}
