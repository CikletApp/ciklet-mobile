import { useCallback } from "react";
import { FlatList, Text, View } from "react-native";
import { router } from "expo-router";
import type { ServerWithChannels } from "@ciklet/embedded-activities-sdk/types";

import { hasUnread, useDirects, useServers, useUnreadCounts } from "@/api/hooks";
import type { DirectSummary } from "@/api/types";
import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  IconButton,
  ListSkeleton,
  Pressable,
  Screen,
  UnreadBadge,
} from "@/components/ui";
import { displayNameOf, formatRelativeShort } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Ana Sayfa — solda sunucu rayı, sağda doğrudan mesajlar.
 *
 * Ray ve liste tek ekranda: mobilde sunucuyu ayrı bir sekmeye taşımak,
 * kullanıcıyı sohbetler ile sunucular arasında sürekli sekme değiştirmeye
 * zorlar. Ray dar tutulur (72pt), böylece liste okunur genişlikte kalır.
 */
export default function HomeScreen() {
  const { data: servers, isLoading: serversLoading } = useServers();
  const { data: unread } = useUnreadCounts();
  const { data: directs, isLoading, refetch, isRefetching } = useDirects();
  const myId = useAuth((s) => s.profile?.id);

  const renderDirect = useCallback(
    ({ item }: { item: DirectSummary }) => {
      const peer = item.profileOne.id === myId ? item.profileTwo : item.profileOne;
      const unreadHere = hasUnread(item, myId);

      return (
        <Pressable
          onPress={() => router.push(`/chat/direct/${item.id}`)}
          haptic="light"
          noHitSlop
          accessibilityRole="button"
          accessibilityLabel={`${displayNameOf(peer)} ile sohbet${unreadHere ? ", okunmamış mesaj var" : ""}`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginHorizontal: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderRadius: radii.md,
            backgroundColor: pressed ? colors.panel : "transparent",
          })}
        >
          <Avatar
            profileId={peer.id}
            imageUrl={peer.imageUrl}
            fallbackText={peer.username}
            size={44}
            showPresence
          />

          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                ...typography.bodyStrong,
                color: unreadHere ? colors.bright : colors.text,
              }}
              numberOfLines={1}
            >
              {displayNameOf(peer)}
            </Text>
            <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
              @{peer.username}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
            {item.latestMessageAt ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {formatRelativeShort(item.latestMessageAt)}
              </Text>
            ) : null}
            {unreadHere ? <UnreadBadge count={1} dot /> : null}
          </View>
        </Pressable>
      );
    },
    [myId]
  );

  return (
    <Screen edges={["top", "left", "right"]}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <ServerRail servers={servers} unread={unread?.serverUnreads} />

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <Text style={{ ...typography.display, color: colors.bright, flex: 1 }}>
              Mesajlar
            </Text>
            <IconButton
              icon="search"
              label="Ara"
              background="transparent"
              tint={colors.muted}
              onPress={() => router.push("/search")}
            />
            <IconButton
              icon="users"
              label="Arkadaşlar"
              background="transparent"
              tint={colors.muted}
              onPress={() => router.push("/friends")}
            />
          </View>

          {isLoading || serversLoading ? (
            <ListSkeleton />
          ) : (
            <FlatList
              data={directs ?? []}
              keyExtractor={(d) => d.id}
              renderItem={renderDirect}
              refreshing={isRefetching}
              onRefresh={refetch}
              contentContainerStyle={
                (directs?.length ?? 0) === 0
                  ? { flex: 1 }
                  : { paddingBottom: spacing["3xl"] }
              }
              ListEmptyComponent={
                <EmptyState
                  icon="message"
                  title="Henüz sohbet yok"
                  description="Bir arkadaş ekleyip ilk mesajını gönder."
                  action={
                    <Button
                      label="Arkadaş Ekle"
                      icon="user-plus"
                      onPress={() => router.push("/friends/add")}
                    />
                  }
                />
              }
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

/** Sol taraftaki dikey sunucu rayı. */
function ServerRail({
  servers,
  unread,
}: {
  servers: ServerWithChannels[] | undefined;
  unread: Record<string, number> | undefined;
}) {
  return (
    <View
      style={{
        width: 72,
        backgroundColor: colors.deep,
        alignItems: "center",
        paddingTop: spacing.md,
        gap: spacing.sm,
      }}
    >
      <RailTile active accessibilityLabel="Doğrudan mesajlar">
        <Icon name="message" size={22} color={colors.onBrand} />
      </RailTile>

      <View
        style={{
          width: 28,
          height: 2,
          borderRadius: 1,
          backgroundColor: colors.border,
          marginVertical: spacing.xs,
        }}
      />

      <FlatList
        data={servers ?? []}
        keyExtractor={(s) => s.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/servers/${item.id}`)}
            haptic="light"
            noHitSlop
            accessibilityRole="button"
            accessibilityLabel={`${item.name} sunucusu`}
          >
            <Avatar
              imageUrl={item.imageUrl}
              fallbackText={item.name}
              size={48}
              shape="squircle"
              backgroundColor={colors.deep}
            />
            {unread?.[item.id] ? (
              <View style={{ position: "absolute", right: -4, top: -4 }}>
                <UnreadBadge count={unread[item.id]} />
              </View>
            ) : null}
          </Pressable>
        )}
        ListFooterComponent={
          <RailTile
            onPress={() => router.push("/servers/new")}
            accessibilityLabel="Sunucu ekle"
          >
            <Icon name="plus" size={22} color={colors.brand} />
          </RailTile>
        }
      />
    </View>
  );
}

function RailTile({
  children,
  onPress,
  active,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  active?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic={onPress ? "light" : undefined}
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: active ? radii.lg : radii.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.brand : colors.panel,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
