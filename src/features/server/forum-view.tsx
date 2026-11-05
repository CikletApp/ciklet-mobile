import { useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useLockThread, usePinForumPost } from "@/api/hooks";
import {
  useForumFeed,
  useForumPostTags,
  useToggleForumReaction,
  type ForumFeedPost,
} from "@/api/hooks/use-channel-admin";
import {
  ActionSheet,
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  EmojiText,
  ListSkeleton,
  Pressable,
  SegmentedTabs,
  showToast,
  type ActionSheetItem,
} from "@/components/ui";
import { formatChatListTime } from "@/lib/format";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { openThread } from "./thread-nav";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { MAX_APPLIED_TAGS, forumTagLabel, type ForumLayout, type ForumSort, type ForumTag } from "@/lib/forum";
import { useAuth } from "@/stores/auth";
import { userErrorMessage } from "@/lib/user-error";

/**
 * Forum kanalı — web forum sayfasının mobil karşılığı: sohbet yerine
 * gönderi kartları (başlık, özet, etiketler, yazar, son hareket), etiket
 * süzgeci, sıralama, arşiv sekmesi ve "Yeni gönderi". Her gönderi bir alt
 * başlıktır; dokununca o alt başlık sohbet olarak açılır. Foruma doğrudan
 * yazılamaz (sunucu da reddeder).
 *
 * Sabitli gönderi (forum başına bir) sunucu sıralamasıyla en üstte gelir
 * ve "Sabitlendi" rozeti taşır; kilitli gönderide "Kilitli" rozeti. "Alt
 * Başlıkları Yönet" izni olan karta uzun basınca sabitle / kilitle (web
 * kartlarındaki düğmelerin karşılığı).
 *
 * Sıralama ve görünüm forumun varsayılanıyla açılır (sunucu `sort`'u
 * uygular); varsayılan tepki kartta tek dokunuşla verilir; etiketleri
 * gönderinin sahibi ya da moderatör düzenler (web forum-view ile aynı).
 */
export function ForumView({ serverId, channelId }: { serverId: string; channelId: string }) {
  // null → forumun varsayılanı (sunucu uygular, yanıtta `sort` döner).
  const [sort, setSort] = useState<ForumSort | null>(null);
  const [layout, setLayout] = useState<ForumLayout | null>(null);
  const [tab, setTab] = useState<"open" | "archived">("open");
  const [tag, setTag] = useState<string | undefined>(undefined);
  const forum = useForumFeed(serverId, channelId, { sort, tag, archived: tab === "archived" });
  const pull = usePullRefresh(forum.refetch);
  const myId = useAuth((s) => s.profile?.id);
  // Yapılandırılmış etiketler (emoji, moderasyonlu); eski sunucu yalnızca ad döner.
  const tags: ForumTag[] =
    forum.data?.availableTags ?? (forum.data?.tags ?? []).map((name) => ({ id: name, name, emoji: null, moderated: false }));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const canModerate = forum.data?.canModerate === true;
  const effectiveSort: ForumSort = sort ?? forum.data?.sort ?? "activity";
  const effectiveLayout: ForumLayout = layout ?? forum.data?.settings?.defaultLayout ?? "list";
  const gallery = effectiveLayout === "gallery";
  const pin = usePinForumPost(serverId);
  const lock = useLockThread(serverId);
  const postTags = useForumPostTags(serverId, channelId);
  const reaction = useToggleForumReaction(serverId, channelId);
  const [menuPost, setMenuPost] = useState<ForumFeedPost | null>(null);
  const [tagPost, setTagPost] = useState<ForumFeedPost | null>(null);
  const canEditTags = (post: ForumFeedPost) =>
    tags.length > 0 && Boolean(forum.data?.availableTags) && (canModerate || (post.profile.id === myId && !post.archivedAt));

  const fail = (error: unknown) => showToast(userErrorMessage(error, "Gönderi güncellenemedi."), "error");
  const appliedOf = (post: ForumFeedPost): ForumTag[] =>
    post.appliedTagIds
      ? post.appliedTagIds.map((id) => tagById.get(id)).filter((t): t is ForumTag => Boolean(t))
      : post.appliedTags.map((name) => tags.find((t) => t.name === name) ?? { id: name, name, emoji: null, moderated: false });
  const menuItems: ActionSheetItem[] = menuPost
    ? [
        ...(canEditTags(menuPost)
          ? [{ key: "tags", label: "Etiketler", icon: "list" as const, onPress: () => setTagPost(menuPost) }]
          : []),
        ...(tab === "open"
          ? [
              menuPost.pinned
                ? {
                    key: "unpin",
                    label: "Sabitlemeyi kaldır",
                    icon: "pin-off" as const,
                    onPress: () => pin.mutate({ postId: menuPost.id, pinned: false }, { onError: fail }),
                  }
                : {
                    key: "pin",
                    label: "Sabitle",
                    detail: "Forumun en üstünde durur; öncekinin sabiti kalkar",
                    icon: "pin" as const,
                    onPress: () => pin.mutate({ postId: menuPost.id, pinned: true }, { onError: fail }),
                  },
            ]
          : []),
        menuPost.locked
          ? {
              key: "unlock",
              label: "Kilidi aç",
              icon: "unlock" as const,
              onPress: () => lock.mutate({ threadId: menuPost.id, locked: false }, { onError: fail }),
            }
          : {
              key: "lock",
              label: "Kilitle",
              detail: "Yalnızca alt başlıkları yönetebilenler yazabilir",
              icon: "lock" as const,
              onPress: () => lock.mutate({ threadId: menuPost.id, locked: true }, { onError: fail }),
            },
      ].filter((item) => canModerate || item.key === "tags")
    : [];

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
          label={effectiveSort === "activity" ? "Son hareket" : "Oluşturma tarihi"}
          selected={false}
          icon
          onPress={() => setSort(effectiveSort === "activity" ? "created" : "activity")}
        />
        <FilterChip
          label={gallery ? "Galeri" : "Liste"}
          selected={false}
          layout
          onPress={() => setLayout(gallery ? "list" : "gallery")}
        />
        <FilterChip label="Tümü" selected={!tag} onPress={() => setTag(undefined)} />
        {tags.map((item) => (
          <FilterChip
            key={item.id}
            label={forumTagLabel(item)}
            moderated={item.moderated}
            selected={tag === item.id}
            onPress={() => setTag(tag === item.id ? undefined : item.id)}
          />
        ))}
      </ScrollView>

      {forum.isLoading ? (
        <ListSkeleton rows={5} />
      ) : forum.error ? (
        <ErrorState
          message={userErrorMessage(forum.error, "Gönderiler yüklenemedi.")}
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
          key={gallery ? "gallery" : "list"}
          data={forum.data?.posts}
          keyExtractor={(post) => post.id}
          numColumns={gallery ? 2 : 1}
          columnWrapperStyle={gallery ? { gap: spacing.md } : undefined}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          renderItem={({ item }) => (
            <View style={gallery ? { flex: 1 / 2 } : undefined}>
              <PostCard
                post={item}
                gallery={gallery}
                applied={appliedOf(item)}
                onPress={() => openThread(serverId, channelId, item)}
                onLongPress={canModerate || canEditTags(item) ? () => setMenuPost(item) : undefined}
                onReact={
                  item.reaction
                    ? () =>
                        reaction.mutate(
                          { emoji: item.reaction!.emoji, messageId: item.reaction!.messageId },
                          { onError: (error) => showToast(userErrorMessage(error, "Tepki verilemedi"), "error") }
                        )
                    : undefined
                }
              />
            </View>
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

      <ActionSheet
        visible={menuPost !== null}
        onClose={() => setMenuPost(null)}
        header={
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
            {menuPost?.name ?? ""}
          </Text>
        }
        items={menuItems}
      />

      <ActionSheet
        visible={tagPost !== null}
        onClose={() => setTagPost(null)}
        header={
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
            Etiketler · {tagPost?.name ?? ""}
          </Text>
        }
        items={tags.slice(0, 10).map((item) => {
          const ids = tagPost?.appliedTagIds ?? [];
          const on = ids.includes(item.id);
          const lockedTag = item.moderated && !canModerate;
          return {
            key: item.id,
            label: forumTagLabel(item),
            detail: lockedTag ? "Bu etiketi yalnızca moderatörler değiştirebilir" : on ? "Ekli · kaldırmak için dokun" : undefined,
            icon: on ? ("check" as const) : ("plus" as const),
            iconColor: on ? colors.brand : undefined,
            onPress: () => {
              if (!tagPost || lockedTag || (!on && ids.length >= MAX_APPLIED_TAGS)) return;
              postTags.mutate(
                { postId: tagPost.id, tags: on ? ids.filter((x) => x !== item.id) : [...ids, item.id] },
                { onError: (error) => showToast(userErrorMessage(error, "Etiketler kaydedilemedi"), "error") }
              );
            },
          };
        })}
      />
    </View>
  );
}

function PostCard({
  post,
  gallery,
  applied,
  onPress,
  onLongPress,
  onReact,
}: {
  post: ForumFeedPost;
  gallery: boolean;
  applied: ForumTag[];
  onPress: () => void;
  onLongPress?: () => void;
  onReact?: () => void;
}) {
  const author = post.profile.name?.trim() || post.profile.username;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${post.name}, ${author}${post.pinned ? ", sabitlendi" : ""}${post.locked ? ", kilitli" : ""}`}
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
      {applied.length > 0 || post.pinned || post.locked ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {post.pinned ? <PostBadge icon="pin" label="Sabitlendi" tone={colors.brand} background={colors.brandSoft} /> : null}
          {post.locked ? <PostBadge icon="lock" label="Kilitli" tone={colors.danger} background={colors.raised} /> : null}
          {applied.map((tag) => (
            <View
              key={tag.id}
              style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full, backgroundColor: colors.brandSoft }}
            >
              <EmojiText style={{ ...typography.caption, fontSize: 11, ...fw(700), color: colors.brand }}>{forumTagLabel(tag)}</EmojiText>
              {tag.moderated ? <Icon name="shield" size={10} color={colors.brand} /> : null}
            </View>
          ))}
        </View>
      ) : null}
      <Text style={{ ...typography.title, ...fw(800), color: colors.bright }} numberOfLines={2}>
        {post.name}
      </Text>
      {post.topic ? (
        <Text style={{ ...typography.body, color: colors.muted }} numberOfLines={gallery ? 4 : 3}>
          {post.topic}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Avatar profileId={post.profile.id} imageUrl={post.profile.imageUrl} fallbackText={post.profile.username} size={20} />
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }} numberOfLines={1}>
          {author} · {formatChatListTime(new Date(post.lastActivityMs).toISOString())}
        </Text>
        {post.reaction && onReact ? (
          <Pressable
            onPress={onReact}
            haptic="light"
            noHitSlop
            accessibilityRole="button"
            accessibilityState={{ selected: post.reaction.me }}
            accessibilityLabel={`${post.reaction.emoji} tepkisi, ${post.reaction.count}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: post.reaction.me ? colors.brand : colors.bentoBorder,
              backgroundColor: post.reaction.me ? colors.brandSoft : "transparent",
            }}
          >
            <EmojiText style={{ fontSize: 14, lineHeight: 18 }}>{post.reaction.emoji}</EmojiText>
            {post.reaction.count > 0 ? (
              <Text style={{ ...typography.caption, ...fw(700), color: post.reaction.me ? colors.brand : colors.muted, fontVariant: ["tabular-nums"] }}>
                {post.reaction.count}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function PostBadge({ icon, label, tone, background }: { icon: "pin" | "lock"; label: string; tone: string; background: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radii.full,
        backgroundColor: background,
      }}
    >
      <Icon name={icon} size={11} color={tone} />
      <Text style={{ ...typography.caption, fontSize: 11, ...fw(700), color: tone }}>{label}</Text>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  icon,
  layout,
  moderated,
  onPress,
}: {
  label: string;
  selected: boolean;
  /** Sıralama çipi: döngüsel, seçili görünmez. */
  icon?: boolean;
  /** Görünüm çipi (liste / galeri): döngüsel. */
  layout?: boolean;
  /** Moderasyonlu etiket: kalkan simgesi. */
  moderated?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={icon ? `Sıralama: ${label}` : layout ? `Görünüm: ${label}` : `${label}${moderated ? ", moderasyonlu" : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.bentoBorder,
        backgroundColor: selected ? colors.brandSoft : pressed ? colors.raised : colors.panel,
      })}
    >
      <Text style={{ ...typography.caption, ...fw(selected ? 700 : 500), color: selected ? colors.brand : colors.text }}>
        {icon ? `↕ ${label}` : layout ? `▦ ${label}` : label}
      </Text>
      {moderated ? <Icon name="shield" size={11} color={selected ? colors.brand : colors.muted} /> : null}
    </Pressable>
  );
}
