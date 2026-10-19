import { FlatList, RefreshControl, View } from "react-native";
import { router, Stack } from "expo-router";

import { useMentions } from "@/api/hooks";
import { EmptyState, ListSkeleton, Screen } from "@/components/ui";
import { MessagePreviewRow } from "@/features/social/message-preview-row";
import { colors, spacing } from "@/theme/tokens";

/**
 * Bahsetmeler (web `/mentions`) — son 7 günde senden bahsedilen kanal
 * mesajları (`@ad`, `@herkes`, `@burada`, taşıdığın roller). Yalnızca
 * görebildiğin kanallar; susturduğun sunucu/kanal listeye girmez.
 */
export default function MentionsScreen() {
  const mentions = useMentions();

  return (
    <Screen>
      <Stack.Screen options={{ title: "Bahsetmeler" }} />
      {mentions.isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={mentions.data ?? []}
          keyExtractor={(entry) => entry.messageId}
          contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={mentions.isRefetching} onRefresh={() => void mentions.refetch()} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={{ flex: 1, paddingTop: spacing["3xl"] }}>
              <EmptyState icon="bell" title="Bahsetme yok" description="Son 7 günde senden bahseden bir mesaj olmadı." />
            </View>
          }
          renderItem={({ item }) => (
            <MessagePreviewRow
              id={item.messageId}
              author={item.author}
              where={`#${item.channelName} · ${item.serverName}`}
              content={item.content}
              createdAt={item.createdAt}
              onPress={() => router.push(`/chat/channel/${item.channelId}?serverId=${item.serverId}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}
