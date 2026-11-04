import { useEffect, useMemo, useState } from "react";
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
import { formatMessagePreview } from "@/lib/message-preview";
import { useDirect, useDirectDisplay } from "@/api/hooks";
import { useAuth } from "@/stores/auth";
import {
  EMPTY_FILTERS,
  SearchFilterBar,
  SearchFiltersSheet,
  activeFilterCount,
  filtersKey,
  withFilters,
  type SearchFilters,
  type SearchOrder,
  type SearchParticipant,
} from "@/features/search/search-filters";

/**
 * DM sohbetinin İÇİNDE arama — web'deki süzgeçli arama panelinin mobil
 * karşılığı (`GET /api/direct-messages/search`).
 *
 * Uç en az bir ölçüt ister: metin ya da süzgeç (Tarafından, Şunu içeren,
 * Bahsedilmeler, Tarih — web ile aynı). Sıralama En yeni / En eski; satıra
 * dokununca sohbet o mesaja kaydırılarak açılır.
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
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [order, setOrder] = useState<SearchOrder>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: direct } = useDirect(directId);
  const display = useDirectDisplay(direct);
  const me = useAuth((s) => s.profile);
  // Seçilebilecek kişiler: sohbetin üyeleri (birebirde karşı taraf + sen).
  const participants = useMemo<SearchParticipant[]>(() => {
    const people = display?.isGroup ? display.members : display?.peer ? [display.peer] : [];
    const rows: SearchParticipant[] = people.map((p) => ({
      id: p.id,
      username: p.username,
      name: p.name ?? null,
      imageUrl: p.imageUrl ?? null,
    }));
    if (me && !rows.some((p) => p.id === me.id)) {
      rows.push({ id: me.id, username: me.username, name: me.name ?? null, imageUrl: me.imageUrl ?? null });
    }
    return rows;
  }, [display, me]);

  // Her tuşta istek atmamak için kısa bir bekleme.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);

  const filterCount = activeFilterCount(filters);
  const enabled = Boolean(directId) && (query.length >= MIN_QUERY || filterCount > 0);
  const search = useInfiniteQuery({
    queryKey: [...qk.directSearch(directId ?? "yok", query), filtersKey(filters, order)],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<SearchPage>(
        withFilters(
          endpoints.directMessageSearch(directId!, { q: query.length >= MIN_QUERY ? query : undefined, cursor: pageParam }),
          filters,
          order
        )
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

      <SearchFilterBar
        filters={filters}
        order={order}
        onOpenFilters={() => setFiltersOpen(true)}
        onOrderChange={setOrder}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />
      <SearchFiltersSheet
        visible={filtersOpen}
        value={filters}
        source={{ kind: "fixed", participants }}
        onClose={() => setFiltersOpen(false)}
        onApply={setFilters}
      />

      {!enabled ? (
        <EmptyState
          icon="search"
          title="Bu sohbette ara"
          description={`En az ${MIN_QUERY} karakter yaz ya da bir filtre seç.`}
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
          description={query ? `“${query}” bu sohbette geçmiyor.` : "Bu ölçütlere uyan mesaj yok."}
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
              onPress={() => router.push(`/chat/direct/${directId}?m=${item.id}`)}
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
                  {formatMessagePreview(item, { fallback: "Dosya eki" })}
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
