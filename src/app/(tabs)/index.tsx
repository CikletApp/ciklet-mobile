import { useCallback } from "react";
import { FlatList, Text, View } from "react-native";
import { router } from "expo-router";

import { hasUnread, useConversationList, useMyServers, useUnreadCounts } from "@/api/hooks";
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
import { ActiveNow } from "@/features/home/active-now";
import { QuickLinks } from "@/features/home/quick-links";
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
  // Not sohbeti ("Notlarım") listeden ayrılır — kullanıcı kendini
  // sohbet listesinde görmemeli; web de böyle davranıyor.
  const { conversations, isLoading, refetch, isRefetching } = useConversationList();
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
        <ServerRail />

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

          {isLoading ? (
            <ListSkeleton />
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(d) => d.id}
              renderItem={renderDirect}
              refreshing={isRefetching}
              onRefresh={refetch}
              ListHeaderComponent={
                <View>
                  <QuickLinks />
                  <ActiveNow />
                  <Text
                    style={{
                      ...typography.overline,
                      color: colors.muted,
                      paddingHorizontal: spacing.lg,
                      paddingBottom: spacing.sm,
                    }}
                  >
                    DİREKT MESAJLAR
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
              ListEmptyComponent={
                <View style={{ paddingTop: spacing.xl }}>
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
                </View>
              }
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

/**
 * Sol taraftaki dikey sunucu rayı.
 *
 * Sunucu listesi `GET /api/members/mine`'dan gelir — `GET /api/servers`
 * diye bir uç YOK (bkz. api/hooks/use-servers.ts). İlk sürümde rayın boş
 * görünmesinin sebebi buydu.
 */
function ServerRail() {
  const { servers, isLoading } = useMyServers();
  const { data: unread } = useUnreadCounts();
  const me = useAuth((s) => s.profile);

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
      {/*
        Doğrudan mesajlar sekmesi kullanıcının kendi avatarını taşır.
        Presence noktası BİLEREK yok: web'de de bu düğme bir durum
        göstergesi değil, sekme göstergesi. Kendi durumun zaten alt
        çubuktaki profil sekmesinde.
      */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.lg,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.brand,
        }}
        accessibilityLabel="Doğrudan mesajlar"
        accessibilityRole="button"
      >
        <Avatar
          imageUrl={me?.imageUrl}
          fallbackText={me?.username}
          size={44}
          backgroundColor={colors.brand}
        />
      </View>

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
        data={servers}
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
            {unread?.serverUnreads?.[item.id] ? (
              <View style={{ position: "absolute", right: -4, top: -4 }}>
                <UnreadBadge count={unread.serverUnreads[item.id]} />
              </View>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          isLoading ? null : (
            <Text
              style={{
                ...typography.caption,
                color: colors.muted,
                textAlign: "center",
                paddingHorizontal: spacing.xs,
              }}
            >
              Sunucu yok
            </Text>
          )
        }
        ListFooterComponent={
          <Pressable
            onPress={() => router.push("/servers/new")}
            haptic="light"
            noHitSlop
            accessibilityRole="button"
            accessibilityLabel="Sunucu ekle"
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: radii.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.panel,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Icon name="plus" size={22} color={colors.brand} />
          </Pressable>
        }
      />
    </View>
  );
}
