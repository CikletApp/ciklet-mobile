import { useMemo, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { hasUnread, useConversationList, useOpenDirect, useSelfDirect } from "@/api/hooks";
import { qk } from "@/api/query-keys";
import type { DirectSummary } from "@/api/types";
import {
  Avatar,
  BentoCard,
  BentoShell,
  Button,
  CikletLogo,
  EmptyState,
  Icon,
  IconButton,
  ListSkeleton,
  ModernRefreshIndicator,
  Pressable,
  Screen,
  UnreadBadge,
} from "@/components/ui";
import { ActiveNow } from "@/features/home/active-now";
import { ChannelPanel } from "@/features/home/channel-panel";
import { ServerRail } from "@/features/home/server-rail";
import { displayNameOf, formatDirectPreview, formatRelativeShort } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
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
  const queryClient = useQueryClient();
  const pinnedDirectIds = usePreferences((s) => s.pinnedDirectIds);
  const setPreference = usePreferences((s) => s.setPreference);
  const sortedConversations = useMemo(() => {
    const pinned = new Set(pinnedDirectIds);
    return [...conversations].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
  }, [conversations, pinnedDirectIds]);

  const removeDirect = useMutation({
    mutationFn: (directId: string) => api(endpoints.direct(directId), { method: "DELETE" }),
    onSuccess: (_data, directId) => {
      queryClient.setQueryData<DirectSummary[]>(qk.directs, (current) => current?.filter((item) => item.id !== directId));
      setPreference("pinnedDirectIds", pinnedDirectIds.filter((id) => id !== directId));
    },
  });

  const togglePinned = (directId: string) => {
    const next = pinnedDirectIds.includes(directId)
      ? pinnedDirectIds.filter((id) => id !== directId)
      : [directId, ...pinnedDirectIds];
    setPreference("pinnedDirectIds", next);
  };

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
        <View style={{ flex: 1, justifyContent: "center" }}>
          <CikletLogo height={22} color={colors.bright} />
        </View>
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
          data={sortedConversations}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DirectRow
              item={item}
              myId={myId}
              pinned={pinnedDirectIds.includes(item.id)}
              onTogglePinned={() => togglePinned(item.id)}
              onDelete={() => {
                const peer = item.profileOne.id === myId ? item.profileTwo : item.profileOne;
                Alert.alert(
                  "Sohbeti sil",
                  `${displayNameOf(peer)} ile sohbet yalnızca senin listenden kaldırılacak.`,
                  [
                    { text: "Vazgeç", style: "cancel" },
                    { text: "Sil", style: "destructive", onPress: () => removeDirect.mutate(item.id) },
                  ]
                );
              }}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={["transparent"]}
              tintColor="transparent"
              progressBackgroundColor="transparent"
            />
          }
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

      <ModernRefreshIndicator visible={isRefetching} />

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

function DirectRow({
  item,
  myId,
  pinned,
  onTogglePinned,
  onDelete,
}: {
  item: DirectSummary;
  myId: string | undefined;
  pinned: boolean;
  onTogglePinned: () => void;
  onDelete: () => void;
}) {
  const swipeable = useRef<SwipeableMethods>(null);
  const peer = item.profileOne.id === myId ? item.profileTwo : item.profileOne;
  const unreadHere = hasUnread(item, myId);
  const isOfficial = isOfficialProfile(peer);

  const action = (label: string, tint: string, icon: "bookmark" | "close") => (
    <View style={{ width: 84, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: tint }}>
      <Icon name={icon} size={19} color={colors.onBrand} filled={icon === "bookmark"} />
      <Text style={{ ...typography.caption, fontWeight: "700", color: colors.onBrand }}>{label}</Text>
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={1.8}
      overshootFriction={8}
      leftThreshold={52}
      rightThreshold={52}
      renderLeftActions={() => action(pinned ? "Çöz" : "Sabitle", colors.brand, "bookmark")}
      renderRightActions={() => action("Sil", colors.danger, "close")}
      onSwipeableOpen={(direction) => {
        if (direction === "right") onTogglePinned();
        else onDelete();
        requestAnimationFrame(() => swipeable.current?.close());
      }}
      containerStyle={{ marginHorizontal: spacing.xs, borderRadius: radii.md, overflow: "hidden" }}
    >
      <Pressable
        onPress={() => router.push(`/chat/direct/${item.id}`)}
        haptic="light"
        noHitSlop
        accessibilityRole="button"
        accessibilityLabel={`${displayNameOf(peer)} ile sohbet${unreadHere ? ", okunmamış mesaj var" : ""}`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          minHeight: 50,
          backgroundColor: pressed ? colors.raised : colors.bento,
        })}
      >
        <Avatar profileId={peer.id} imageUrl={peer.imageUrl} fallbackText={peer.username} size={38} showPresence={!isOfficial} backgroundColor={colors.bento} />
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {pinned ? <Icon name="bookmark" size={12} color={colors.brand} filled /> : null}
            <Text style={{ ...typography.bodyStrong, color: unreadHere ? colors.bright : colors.text, flexShrink: 1 }} numberOfLines={1}>{displayNameOf(peer)}</Text>
            {isOfficial ? (
              <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.brand }}>
                <Text style={{ fontSize: 9, lineHeight: 12, fontWeight: "800", color: colors.onBrand }}>RESMÎ</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>{formatDirectPreview(item.latestMessage, myId)}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
          {item.latestMessageAt ? <Text style={{ ...typography.caption, color: colors.muted }}>{formatRelativeShort(item.latestMessageAt)}</Text> : null}
          {unreadHere ? <UnreadBadge count={1} dot /> : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}
