import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { DirectMessageWithProfile } from "@ciklet/embedded-activities-sdk/types";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { Avatar, EmptyState, ErrorState, Icon, Pressable, Screen } from "@/components/ui";
import { formatChatListTime } from "@/lib/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * DM sohbetinin İÇİNDE arama — web'deki süzgeçli arama panelinin mobil
 * karşılığı (`GET /api/direct-messages/search`).
 *
 * Uç en az bir ölçüt ister; mobil ilk sürümde metin araması sunar (yazar/
 * içerik süzgeçleri web'de). Sonuçlar en yeniden eskiye sayfalıdır; satıra
 * dokununca sohbet açılır.
 */

const MIN_QUERY = 2;

interface SearchPage {
  items: DirectMessageWithProfile[];
  total: number;
  nextCursor: string | null;
}

export default function DirectSearchScreen() {
  const { directId } = useLocalSearchParams<{ directId: string }>();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // Her tuşta istek atmamak için kısa bir bekleme.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);

  const enabled = Boolean(directId) && query.length >= MIN_QUERY;
  const search = useInfiniteQuery({
    queryKey: qk.directSearch(directId ?? "yok", query),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<SearchPage>(
        endpoints.directMessageSearch(directId!, { q: query, cursor: pageParam })
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const items = search.data?.pages.flatMap((page) => page.items) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;

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
                placeholder="Sohbette ara"
                placeholderTextColor={colors.muted}
                autoFocus
                autoCorrect={false}
                returnKeyType="search"
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  color: colors.bright,
                  ...typography.body,
                }}
                accessibilityLabel="Sohbette ara"
              />
            </View>
          ),
        }}
      />

      {!enabled ? (
        <EmptyState
          icon="search"
          title="Bu sohbette ara"
          description={`En az ${MIN_QUERY} karakter yaz.`}
        />
      ) : search.isLoading ? (
        <ActivityIndicator color={colors.muted} style={{ marginTop: spacing["2xl"] }} />
      ) : search.error ? (
        <ErrorState
          message={
            search.error instanceof ApiError ? search.error.message : "Arama yapılamadı."
          }
          onRetry={() => void search.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="search"
          title="Sonuç yok"
          description={`“${query}” bu sohbette geçmiyor.`}
        />
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
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/chat/direct/${directId}`)}
              accessibilityRole="button"
              accessibilityLabel="Sohbeti aç"
              style={({ pressed }) => ({
                flexDirection: "row",
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                backgroundColor: pressed ? colors.raised : "transparent",
              })}
            >
              <Avatar
                profileId={item.profile.id}
                imageUrl={item.profile.imageUrl}
                fallbackText={item.profile.username}
                size={36}
              />
              <View style={{ flex: 1, gap: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
                  <Text
                    style={{ ...typography.caption, ...fw(700), color: colors.bright }}
                    numberOfLines={1}
                  >
                    {item.profile.name?.trim() || item.profile.username}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {formatChatListTime(item.createdAt)}
                  </Text>
                </View>
                <Text style={{ ...typography.body, color: colors.text }} numberOfLines={2}>
                  {item.content?.trim() || "Dosya eki"}
                </Text>
              </View>
            </Pressable>
          )}
          onEndReached={() => {
            if (search.hasNextPage && !search.isFetchingNextPage) {
              void search.fetchNextPage();
            }
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
