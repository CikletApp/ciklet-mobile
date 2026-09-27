import { useMemo } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import {
  useAcceptFriendRequest,
  useFriends,
  useInbox,
  useMyServers,
  useRemoveFriend,
  useUnreadCounts,
  type FriendEntry,
} from "@/api/hooks";
import {
  Avatar,
  EmptyState,
  HeaderButton,
  Icon,
  ModernRefreshIndicator,
  Pressable,
  Screen,
  SectionHeader,
  TabHeader,
  UnreadBadge,
} from "@/components/ui";
import { FLOATING_TAB_INSET } from "@/components/ui/tab-bar";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Bildirimler — "bana ne oldu?" sorusunun tek yeri.
 *
 * Üç bölüm, önem sırasıyla:
 *   1. Arkadaşlık istekleri — satırda kabul/ret; profile gitmeden yanıtlanır.
 *   2. Okunmamış sohbetler — `/api/inbox` (gruplar dahil, sayıya göre).
 *   3. Okunmamış sunucular — `/api/unread-counts` sunucu toplamları.
 * Hepsi ağ geçidi olaylarıyla (friend.request, message.notification,
 * channel.message) tazeleniyor; sekme açıkken de canlı.
 */
export default function NotificationsScreen() {
  const { incoming, isLoading: friendsLoading, refetch: refetchFriends, isRefetching } = useFriends();
  const inbox = useInbox();
  const unread = useUnreadCounts();
  const { servers } = useMyServers();
  const accept = useAcceptFriendRequest();
  const remove = useRemoveFriend();

  const unreadServers = useMemo(() => {
    const totals = unread.data?.serverUnreads ?? {};
    return servers
      .map((server) => ({ server, count: totals[server.id] ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [servers, unread.data]);

  const directs = (inbox.data ?? []).filter((item) => item.type === "direct" && item.count > 0);
  const nothing = incoming.length === 0 && directs.length === 0 && unreadServers.length === 0;
  const loading = friendsLoading || inbox.isLoading;

  const refresh = () => {
    void refetchFriends();
    void inbox.refetch();
    void unread.refetch();
  };

  return (
    <Screen edges={["top", "left", "right"]}>
      <TabHeader
        title="Bildirimler"
        left={<HeaderButton icon="users" label="Arkadaşlar" onPress={() => router.push("/friends")} />}
        right={<HeaderButton icon="user-plus" label="Arkadaş ekle" onPress={() => router.push("/friends/add")} />}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: FLOATING_TAB_INSET + spacing.lg, flexGrow: 1 }}
        // Uygulamanın tek yenileme dili: sistem çemberi gizli, yerine Ciklet
        // logolu rozet (Sohbetler ve Sunucular'la aynı).
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refresh}
            colors={["transparent"]}
            tintColor="transparent"
            progressBackgroundColor="transparent"
          />
        }
      >
        {nothing ? (
          <View style={{ flex: 1, paddingTop: spacing["3xl"] }}>
            <EmptyState
              icon="bell"
              title={loading ? "Yükleniyor…" : "Her şey yolunda"}
              description={loading ? undefined : "Yeni bir istek ya da okunmamış mesaj olduğunda burada görünecek."}
            />
          </View>
        ) : null}

        {incoming.length > 0 ? (
          <>
            <SectionHeader title={`ARKADAŞLIK İSTEKLERİ · ${incoming.length}`} />
            {incoming.map((entry) => (
              <RequestRow
                key={entry.id}
                entry={entry}
                busy={(accept.isPending && accept.variables === entry.id) || (remove.isPending && remove.variables === entry.id)}
                onAccept={() => accept.mutate(entry.id)}
                onDecline={() => remove.mutate(entry.id)}
              />
            ))}
          </>
        ) : null}

        {directs.length > 0 ? (
          <>
            <SectionHeader title="OKUNMAMIŞ SOHBETLER" />
            {directs.map((item) => (
              <UnreadRow
                key={item.id}
                leading={
                  item.imageUrl ? (
                    <Avatar imageUrl={item.imageUrl} fallbackText={item.name} size={44} />
                  ) : (
                    <IconBubble icon="users" />
                  )
                }
                title={item.name}
                subtitle={`${item.count} yeni mesaj`}
                count={item.count}
                onPress={() => router.push(`/chat/direct/${item.id}`)}
              />
            ))}
          </>
        ) : null}

        {unreadServers.length > 0 ? (
          <>
            <SectionHeader title="SUNUCULAR" />
            {unreadServers.map(({ server, count }) => (
              <UnreadRow
                key={server.id}
                leading={
                  <View style={{ borderRadius: radii.md, overflow: "hidden" }}>
                    <Avatar imageUrl={server.imageUrl} fallbackText={server.name} size={44} radius={0} backgroundColor={colors.bento} />
                  </View>
                }
                title={server.name}
                subtitle={`${count} yeni mesaj`}
                count={count}
                onPress={() => router.push(`/servers/${server.id}`)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
      <ModernRefreshIndicator visible={isRefetching} top={72} />
    </Screen>
  );
}

function IconBubble({ icon }: { icon: "users" }) {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft }}>
      <Icon name={icon} size={20} color={colors.brand} />
    </View>
  );
}

function RequestRow({
  entry,
  busy,
  onAccept,
  onDecline,
}: {
  entry: FriendEntry;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const name = entry.profile.name?.trim() || entry.profile.username;
  return (
    <Pressable
      onPress={() => router.push(`/profile/${entry.profile.id}`)}
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={`${name} arkadaşlık isteği gönderdi`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <Avatar profileId={entry.profile.id} imageUrl={entry.profile.imageUrl} fallbackText={entry.profile.username} size={48} showPresence />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
          @{entry.profile.username} · seni eklemek istiyor
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, opacity: busy ? 0.5 : 1 }} pointerEvents={busy ? "none" : "auto"}>
        <Pressable
          onPress={onDecline}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel="Reddet"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.raised : "transparent",
          })}
        >
          <Icon name="close" size={17} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={onAccept}
          haptic="success"
          accessibilityRole="button"
          accessibilityLabel="Kabul et"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.brand,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name="check" size={18} color={colors.onBrand} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function UnreadRow({
  leading,
  title,
  subtitle,
  count,
  onPress,
}: {
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{subtitle}</Text>
      </View>
      <UnreadBadge count={count} tone="brand" />
    </Pressable>
  );
}
