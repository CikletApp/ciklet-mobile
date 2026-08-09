import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { hasUnread, useConversationList, useOpenDirect, useSelfDirect } from "@/api/hooks";
import type { DirectSummary } from "@/api/types";
import {
  Avatar,
  BentoCard,
  BentoShell,
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
import { ChannelPanel } from "@/features/home/channel-panel";
import { ServerRail } from "@/features/home/server-rail";
import { displayNameOf, formatRelativeShort } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { FLOATING_TAB_INSET } from "@/components/ui/tab-bar";

/**
 * Ana Sayfa — bento düzeni: solda kalıcı sunucu rayı kartı, sağda içerik
 * kartı, aralarında boşluk.
 *
 * İçerik seçime göre değişir: sunucu seçili değilse doğrudan mesajlar,
 * seçiliyse o sunucunun kanal listesi. Sunucuya girmek AYRI EKRANA GİTMEZ —
 * ray her zaman görünür kalır. Panel geçişi çapraz solmayla yumuşatılır.
 */
export default function HomeScreen() {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  return (
    <Screen edges={["top", "left", "right"]} style={{ backgroundColor: colors.deep }}>
      <BentoShell>
        <BentoCard style={{ flex: 0, width: 64 }} flush>
          <ServerRail
            selectedServerId={selectedServerId}
            onSelect={setSelectedServerId}
          />
        </BentoCard>

        <BentoCard flush>
          {/*
            Panel değişimi anlık yerine çapraz solmayla: rayda sunucu
            değiştirmek sık bir eylem ve sert geçiş her seferinde göz
            yoruyor. `key` ile eski panel çıkış animasyonunu tamamlar.
          */}
          <Animated.View
            key={selectedServerId ?? "directs"}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={{ flex: 1 }}
          >
            {selectedServerId ? (
              <ChannelPanel serverId={selectedServerId} />
            ) : (
              <DirectPanel />
            )}
          </Animated.View>
        </BentoCard>
      </BentoShell>
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
            marginHorizontal: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.md,
            borderRadius: radii.md,
            backgroundColor: pressed ? colors.raised : "transparent",
          })}
        >
          <Avatar
            profileId={peer.id}
            imageUrl={peer.imageUrl}
            fallbackText={peer.username}
            size={44}
            showPresence
            backgroundColor={colors.bento}
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
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
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
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
        }}
      >
        <Pressable
          onPress={() => router.push("/search")}
          noHitSlop
          accessibilityRole="search"
          accessibilityLabel="Mesajlarda ve kişilerde ara"
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 46,
            borderRadius: radii.full,
            backgroundColor: pressed ? colors.raised : colors.panel,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.md,
          })}
        >
          <Icon name="search" size={20} color={colors.muted} />
          <Text style={{ ...typography.body, color: colors.muted, flex: 1 }}>
            Ara
          </Text>
        </Pressable>
        <IconButton
          icon="user-plus"
          label="Arkadaş ekle"
          size={46}
          background={colors.panel}
          tint={colors.text}
          onPress={() => router.push("/friends/add")}
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
                  paddingHorizontal: spacing.md,
                  paddingBottom: spacing.sm,
                }}
              >
                DİREKT MESAJLAR
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: FLOATING_TAB_INSET + spacing.lg }}
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

      <View
        style={{
          position: "absolute",
          right: spacing.lg,
          bottom: FLOATING_TAB_INSET + spacing.md,
        }}
      >
        <IconButton
          icon="pencil"
          label="Yeni mesaj"
          size={52}
          background={colors.brand}
          tint={colors.onBrand}
          onPress={() => router.push("/friends/quick-message")}
          haptic="medium"
        />
      </View>
    </View>
  );
}
