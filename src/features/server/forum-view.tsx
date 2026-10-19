import { useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { ApiError } from "@/api/client";
import { useForumPosts } from "@/api/hooks";
import type { ForumPost } from "@/api/types";
import { Avatar, Button, EmptyState, ErrorState, ListSkeleton, Pressable, SegmentedTabs } from "@/components/ui";
import { formatChatListTime } from "@/lib/format";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { openThread } from "./thread-nav";

/**
 * Forum kanalı — web forum sayfasının mobil karşılığı: sohbet yerine
 * gönderi kartları (başlık, özet, etiketler, yazar, son hareket), etiket
 * süzgeci, sıralama, arşiv sekmesi ve "Yeni gönderi". Her gönderi bir alt
 * başlıktır; dokununca o alt başlık sohbet olarak açılır. Foruma doğrudan
 * yazılamaz (sunucu da reddeder).
 */
export function ForumView({ serverId, channelId }: { serverId: string; channelId: string }) {
  const [sort, setSort] = useState<"activity" | "created">("activity");
  const [tab, setTab] = useState<"open" | "archived">("open");
  const [tag, setTag] = useState<string | undefined>(undefined);
  const forum = useForumPosts(serverId, channelId, { sort, tag, archived: tab === "archived" });
  const tags = forum.data?.tags ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.chat }}>
      <SegmentedTabs
        items={[
          { id: "open" as const, label: "Gönderiler" },
          { id: "archived" as const, label: "Arşiv" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
      >
        <FilterChip
          label={sort === "activity" ? "Son hareket" : "Oluşturma"}
          selected={false}
          icon
          onPress={() => setSort((value) => (value === "activity" ? "created" : "activity"))}
        />
        <FilterChip label="Tümü" selected={!tag} onPress={() => setTag(undefined)} />
        {tags.map((name) => (
          <FilterChip key={name} label={name} selected={tag === name} onPress={() => setTag(tag === name ? undefined : name)} />
        ))}
      </ScrollView>

      {forum.isLoading ? (
        <ListSkeleton rows={5} />
      ) : forum.error ? (
        <ErrorState
          message={forum.error instanceof ApiError ? forum.error.message : "Gönderiler yüklenemedi."}
          onRetry={() => void forum.refetch()}
        />
      ) : (forum.data?.posts ?? []).length === 0 ? (
        <EmptyState
          icon="list"
          title={tab === "archived" ? "Arşivde gönderi yok" : "Henüz gönderi yok"}
          description={forum.data?.canPost && tab === "open" ? "İlk gönderiyi sen aç." : undefined}
        />
      ) : (
        <FlatList
          data={forum.data?.posts}
          keyExtractor={(post) => post.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
          refreshing={forum.isRefetching}
          onRefresh={() => void forum.refetch()}
          renderItem={({ item }) => (
            <PostCard post={item} onPress={() => openThread(serverId, channelId, item)} />
          )}
        />
      )}

      {forum.data?.canPost ? (
        <View style={{ position: "absolute", right: spacing.lg, bottom: spacing.xl }}>
          <Button
            label="Yeni gönderi"
            icon="plus"
            onPress={() => router.push(`/servers/${serverId}/forum-post?channelId=${channelId}`)}
          />
        </View>
      ) : null}
    </View>
  );
}

function PostCard({ post, onPress }: { post: ForumPost; onPress: () => void }) {
  const author = post.profile.name?.trim() || post.profile.username;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${post.name}, ${author}`}
      style={({ pressed }) => ({
        padding: spacing.lg,
        gap: spacing.sm,
        borderRadius: radii.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: pressed ? colors.raised : colors.panel,
      })}
    >
      {post.appliedTags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {post.appliedTags.map((tag) => (
            <View key={tag} style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full, backgroundColor: colors.brandSoft }}>
              <Text style={{ ...typography.caption, fontSize: 11, ...fw(700), color: colors.brand }}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={{ ...typography.title, ...fw(800), color: colors.bright }} numberOfLines={2}>
        {post.name}
      </Text>
      {post.topic ? (
        <Text style={{ ...typography.body, color: colors.muted }} numberOfLines={3}>
          {post.topic}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Avatar profileId={post.profile.id} imageUrl={post.profile.imageUrl} fallbackText={post.profile.username} size={20} />
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }} numberOfLines={1}>
          {author} · {formatChatListTime(new Date(post.lastActivityMs).toISOString())}
        </Text>
      </View>
    </Pressable>
  );
}

function FilterChip({
  label,
  selected,
  icon,
  onPress,
}: {
  label: string;
  selected: boolean;
  /** Sıralama çipi: döngüsel, seçili görünmez. */
  icon?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={icon ? `Sıralama: ${label}` : label}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.bentoBorder,
        backgroundColor: selected ? colors.brandSoft : pressed ? colors.raised : colors.panel,
      })}
    >
      <Text style={{ ...typography.caption, ...fw(selected ? 700 : 500), color: selected ? colors.brand : colors.text }}>
        {icon ? `↕ ${label}` : label}
      </Text>
    </Pressable>
  );
}
