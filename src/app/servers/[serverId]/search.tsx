import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { MessageWithMember } from "@ciklet/embedded-activities-sdk/types";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { Avatar, EmptyState, ErrorState, Icon, Pressable, Screen, SegmentedTabs } from "@/components/ui";
import { formatChatListTime } from "@/lib/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Sunucu içi mesaj arama — web kanal başlığındaki arama kutusunun mobil
 * karşılığı (`GET /api/servers/[id]/messages/search`). DM aramasıyla aynı
 * düzen; sunucu yalnızca görülebilen ve geçmişi okunabilen kanalları tarar.
 *
 * `channel` parametresiyle gelinirse "Bu kanal" / "Tüm sunucu" seçilebilir.
 * Sonuçta kanal adı yazar; dokununca o kanal açılır.
 */

const MIN_QUERY = 2;

/** Sunucu, sonucun geldiği kanalı ekler (sunum katmanı taşımıyor); bilinmiyorsa null. */
type SearchItem = Omit<MessageWithMember, "channelId"> & { channelId: string | null };

interface SearchPage {
  items: SearchItem[];
  total: number;
  nextCursor: string | null;
  channels: Record<string, string>;
}

export default function ServerSearchScreen() {
  const { serverId, channel } = useLocalSearchParams<{ serverId: string; channel?: string }>();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"channel" | "server">(channel ? "channel" : "server");

  // Her tuşta istek atmamak için kısa bir bekleme.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);

  const onlyChannel = scope === "channel" ? channel : undefined;
  const enabled = Boolean(serverId) && query.length >= MIN_QUERY;
  const search = useInfiniteQuery({
    queryKey: qk.serverSearch(serverId ?? "yok", `${onlyChannel ?? "*"}:${query}`),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<SearchPage>(endpoints.serverMessageSearch(serverId!, { q: query, cursor: pageParam, channel: onlyChannel })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const items = search.data?.pages.flatMap((page) => page.items) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;
  const channelNames = Object.assign({}, ...(search.data?.pages.map((page) => page.channels) ?? [])) as Record<string, string>;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radii.full,
                backgroundColor: colors.panel,
                minWidth: 220,
              }}
            >
              <Icon name="search" size={16} color={colors.muted} />
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Sunucuda ara"
                placeholderTextColor={colors.muted}
                autoFocus
                autoCorrect={false}
                returnKeyType="search"
                style={{ flex: 1, paddingVertical: spacing.sm, color: colors.bright, ...typography.body }}
                accessibilityLabel="Sunucuda ara"
              />
            </View>
          ),
        }}
      />

      {channel ? (
        <SegmentedTabs
          variant="pill"
          items={[
            { id: "channel" as const, label: "Bu kanal" },
            { id: "server" as const, label: "Tüm sunucu" },
          ]}
          value={scope}
          onChange={setScope}
        />
      ) : null}

      {!enabled ? (
        <EmptyState icon="search" title="Sunucuda ara" description={`En az ${MIN_QUERY} karakter yaz.`} />
      ) : search.isLoading ? (
        <ActivityIndicator color={colors.muted} style={{ marginTop: spacing["2xl"] }} />
      ) : search.error ? (
        <ErrorState
          message={search.error instanceof ApiError ? search.error.message : "Arama yapılamadı."}
          onRetry={() => void search.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState icon="search" title="Sonuç yok" description={`“${query}” bu sunucuda geçmiyor.`} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(message) => message.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text
              style={{
                ...typography.overline,
                color: colors.muted,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md,
                paddingBottom: spacing.xs,
              }}
            >
              {total} SONUÇ
            </Text>
          }
          renderItem={({ item }) => {
            const profile = item.member?.profile;
            const channelName = item.channelId ? channelNames[item.channelId] : undefined;
            return (
              <Pressable
                onPress={() =>
                  item.channelId ? router.push(`/chat/channel/${item.channelId}?serverId=${serverId}`) : undefined
                }
                accessibilityRole="button"
                accessibilityLabel={channelName ? `#${channelName} kanalını aç` : "Kanalı aç"}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  backgroundColor: pressed ? colors.raised : "transparent",
                })}
              >
                <Avatar
                  profileId={profile?.id}
                  imageUrl={profile?.imageUrl}
                  fallbackText={profile?.username}
                  size={36}
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
                    <Text style={{ ...typography.caption, ...fw(700), color: colors.bright, flexShrink: 1 }} numberOfLines={1}>
                      {item.member?.nickname?.trim() || profile?.name?.trim() || profile?.username || "Bilinmeyen"}
                    </Text>
                    {channelName ? (
                      <Text style={{ ...typography.caption, color: colors.brand }} numberOfLines={1}>
                        #{channelName}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 11, color: colors.muted }}>{formatChatListTime(item.createdAt)}</Text>
                  </View>
                  <Text style={{ ...typography.body, color: colors.text }} numberOfLines={2}>
                    {item.content?.trim() || "Dosya eki"}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          onEndReached={() => {
            if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            search.isFetchingNextPage ? (
              <ActivityIndicator color={colors.muted} style={{ marginVertical: spacing.lg }} />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        />
      )}
    </Screen>
  );
}
