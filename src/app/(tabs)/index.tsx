import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { router } from "expo-router";

import { hasUnread, useConversationList, useOpenDirect, useSelfDirect } from "@/api/hooks";
import type { DirectSummary } from "@/api/types";
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  ListSkeleton,
  Pressable,
  Screen,
  UnreadBadge,
} from "@/components/ui";
import { ActiveNow } from "@/features/home/active-now";
import { ChannelPanel } from "@/features/home/channel-panel";
import { ServerRail } from "@/features/home/server-rail";
import { displayNameOf, formatRelativeShort } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Ana Sayfa — solda kalıcı sunucu rayı, sağda içerik.
 *
 * İçerik seçime göre değişir: sunucu seçili değilse doğrudan mesajlar,
 * seçiliyse o sunucunun kanal listesi. Sunucuya girmek AYRI BİR EKRANA
 * GİTMEZ — ray her zaman görünür kalır, böylece sunucular arasında geçmek
 * için geri gitmek gerekmez.
 */
export default function HomeScreen() {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  return (
    <Screen edges={["top", "left", "right"]}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <ServerRail
          selectedServerId={selectedServerId}
          onSelect={setSelectedServerId}
        />
        {selectedServerId ? (
          <ChannelPanel serverId={selectedServerId} />
        ) : (
          <DirectPanel />
        )}
      </View>
    </Screen>
  );
}

/** Doğrudan mesajlar bölümü. */
function DirectPanel() {
  // Not sohbeti ("Notlarım") listeden ayrılır — kullanıcı kendini sohbet
  // listesinde görmemeli; web de böyle davranıyor.
  const { conversations, isLoading, refetch, isRefetching } = useConversationList();
  const { data: selfDirect } = useSelfDirect();
  const openDirect = useOpenDirect();
  const myId = useAuth((s) => s.profile?.id);

  /** Not sohbeti henüz yoksa açılır (sunucu kendinle DM'e izin veriyor). */
  const openNotes = () => {
    if (selfDirect) {
      router.push(`/chat/direct/${selfDirect.id}`);
      return;
    }
    if (!myId) return;
    openDirect.mutate(myId, {
      onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`),
    });
  };

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
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        <Text style={{ ...typography.display, color: colors.bright, flex: 1 }}>
          Mesajlar
        </Text>
        <IconButton
          icon="bookmark"
          label="Notlarım"
          background="transparent"
          tint={colors.muted}
          onPress={openNotes}
          disabled={openDirect.isPending}
        />
        <IconButton
          icon="users"
          label="Arkadaşlar"
          background="transparent"
          tint={colors.muted}
          onPress={() => router.push("/friends")}
        />
        <IconButton
          icon="search"
          label="Ara"
          background="transparent"
          tint={colors.muted}
          onPress={() => router.push("/search")}
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
  );
}
