import { useMemo, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import {
  directDisplay,
  hasUnread,
  useConversationList,
  useOpenDirect,
  useRemoveDirect,
  useSelfDirect,
  type DirectDisplay,
} from "@/api/hooks";
import type { DirectSummary } from "@/api/types";
import {
  Avatar,
  Button,
  CikletLogo,
  EmptyState,
  Icon,
  IconButton,
  ListSkeleton,
  ModernRefreshIndicator,
  Pressable,
  Screen,
  SegmentedTabs,
  UnreadBadge,
  type TabItem,
} from "@/components/ui";
import { ActiveNow } from "@/features/home/active-now";
import { formatDirectPreview, formatRelativeShort } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { FLOATING_TAB_INSET } from "@/components/ui/tab-bar";

/**
 * Sohbetler — birebir ve grup mesajlarının tek evi.
 *
 * Sunucu rayı bu ekrandan KALKTI (bkz. `(tabs)/_layout.tsx`); kazanılan
 * 64px doğrudan satırlara gitti, böylece avatar 38→52 büyüdü ve önizleme
 * metni artık iki kelimede kırpılmıyor.
 */

/** Liste filtreleri — WhatsApp'taki gibi, listenin üstünde çip olarak. */
type Filter = "all" | "unread" | "groups";

const FILTERS: TabItem<Filter>[] = [
  { id: "all", label: "Tümü" },
  { id: "unread", label: "Okunmamış" },
  { id: "groups", label: "Gruplar" },
];

export default function ChatsScreen() {
  const { conversations, isLoading, refetch, isRefetching } = useConversationList();
  const { data: selfDirect } = useSelfDirect();
  const openDirect = useOpenDirect();
  const removeDirect = useRemoveDirect();
  const myId = useAuth((s) => s.profile?.id);
  const pinnedDirectIds = usePreferences((s) => s.pinnedDirectIds);
  const setPreference = usePreferences((s) => s.setPreference);
  const [filter, setFilter] = useState<Filter>("all");

  /**
   * Sıralama sunucudan gelir (son mesaj zamanına göre); istemci yalnızca
   * sabitlenmişleri öne çeker ve filtreyi uygular.
   */
  const visible = useMemo(() => {
    const pinned = new Set(pinnedDirectIds);
    const filtered = conversations.filter((direct) => {
      if (filter === "unread") return hasUnread(direct, myId);
      if (filter === "groups") return direct.isGroup === true;
      return true;
    });
    return [...filtered].sort(
      (a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id))
    );
  }, [conversations, pinnedDirectIds, filter, myId]);

  const unreadTotal = useMemo(
    () => conversations.filter((direct) => hasUnread(direct, myId)).length,
    [conversations, myId]
  );

  const filterItems = useMemo<TabItem<Filter>[]>(
    () =>
      FILTERS.map((item) =>
        item.id === "unread" && unreadTotal > 0
          ? { ...item, count: unreadTotal }
          : item
      ),
    [unreadTotal]
  );

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

  /**
   * Aynı uç birebir sohbette "listemden kaldır", grupta "gruptan ayrıl"
   * anlamına geliyor (`useRemoveDirect`). Onay metni bu yüzden ayrışır —
   * "Sohbeti sil" diyip kullanıcıyı gruptan çıkarmak dürüst olmaz.
   */
  const confirmRemove = (direct: DirectSummary, display: DirectDisplay) => {
    const [title, message, action] = display.isGroup
      ? [
          "Gruptan ayrıl",
          `"${display.title}" grubundan ayrılacaksın. Yeniden eklenmen için bir üyenin seni davet etmesi gerekir.`,
          "Ayrıl",
        ]
      : [
          "Sohbeti sil",
          `${display.title} ile sohbet yalnızca senin listenden kaldırılacak.`,
          "Sil",
        ];

    Alert.alert(title, message, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: action,
        style: "destructive",
        onPress: () =>
          removeDirect.mutate(direct.id, {
            onSuccess: () =>
              setPreference(
                "pinnedDirectIds",
                pinnedDirectIds.filter((id) => id !== direct.id)
              ),
          }),
      },
    ]);
  };

  return (
    <Screen edges={["top", "left", "right"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
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
          paddingBottom: spacing.xs,
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

      <SegmentedTabs
        items={filterItems}
        value={filter}
        onChange={setFilter}
        variant="pill"
      />

      {isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              myId={myId}
              pinned={pinnedDirectIds.includes(item.id)}
              onTogglePinned={() => togglePinned(item.id)}
              onRemove={(display) => confirmRemove(item, display)}
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
          /* Etkin arkadaşlar şeridi yalnızca filtresiz görünümde anlamlı;
             "Okunmamış" filtresindeyken listeyi aşağı itip filtrenin
             sonucunu gizliyordu. */
          ListHeaderComponent={filter === "all" ? <ActiveNow /> : null}
          contentContainerStyle={{
            paddingTop: spacing.xs,
            paddingBottom: FLOATING_TAB_INSET + spacing.lg,
          }}
          ListEmptyComponent={<EmptyChats filter={filter} />}
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
    </Screen>
  );
}

/** Boş durum filtreye göre değişir — yoksa "arkadaş ekle" yanlış tavsiye olur. */
function EmptyChats({ filter }: { filter: Filter }) {
  if (filter === "unread") {
    return (
      <View style={{ paddingTop: spacing.xl }}>
        <EmptyState
          icon="check"
          title="Hepsi okundu"
          description="Okunmamış mesajın yok."
        />
      </View>
    );
  }

  if (filter === "groups") {
    return (
      <View style={{ paddingTop: spacing.xl }}>
        <EmptyState
          icon="users"
          title="Henüz grubun yok"
          description="Arkadaşlarınla bir grup kurup birlikte konuşmaya başla."
          action={
            <Button
              label="Yeni Grup"
              icon="users"
              onPress={() => router.push("/directs/new-group")}
            />
          }
        />
      </View>
    );
  }

  return (
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
  );
}

function ConversationRow({
  item,
  myId,
  pinned,
  onTogglePinned,
  onRemove,
}: {
  item: DirectSummary;
  myId: string | undefined;
  pinned: boolean;
  onTogglePinned: () => void;
  onRemove: (display: DirectDisplay) => void;
}) {
  const swipeable = useRef<SwipeableMethods>(null);
  // Grup/birebir ayrımının TEK kaynağı; satır profil alanlarını okumaz.
  const display = directDisplay(item, myId);
  const unreadHere = hasUnread(item, myId);
  const isOfficial = !display.isGroup && isOfficialProfile(display.peer);

  /**
   * Grupta önizlemeye yazar adı eklenir: "dosyayı attım" satırının kimden
   * geldiği bilinmeden grup listesi okunamıyor. Birebirde gereksiz —
   * satırın başlığı zaten o kişi.
   */
  const authorName = display.isGroup
    ? display.members.find((m) => m.id === item.latestMessage?.profileId)
        ?.name?.trim() ||
      display.members.find((m) => m.id === item.latestMessage?.profileId)
        ?.username
    : undefined;

  const action = (label: string, tint: string, icon: "bookmark" | "close") => (
    <View
      style={{
        width: 84,
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        backgroundColor: tint,
      }}
    >
      <Icon
        name={icon}
        size={19}
        color={colors.onBrand}
        filled={icon === "bookmark"}
      />
      <Text
        style={{
          ...typography.caption,
          fontWeight: "700",
          color: colors.onBrand,
        }}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={1.8}
      overshootFriction={8}
      leftThreshold={52}
      rightThreshold={52}
      renderLeftActions={() =>
        action(pinned ? "Çöz" : "Sabitle", colors.brand, "bookmark")
      }
      renderRightActions={() =>
        action(display.isGroup ? "Ayrıl" : "Sil", colors.danger, "close")
      }
      onSwipeableOpen={(direction) => {
        if (direction === "right") onTogglePinned();
        else onRemove(display);
        requestAnimationFrame(() => swipeable.current?.close());
      }}
      containerStyle={{ borderRadius: radii.md, overflow: "hidden" }}
    >
      <Pressable
        onPress={() => router.push(`/chat/direct/${item.id}`)}
        haptic="light"
        noHitSlop
        accessibilityRole="button"
        accessibilityLabel={`${display.title}${display.isGroup ? " grubu" : " ile sohbet"}${unreadHere ? ", okunmamış mesaj var" : ""}`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          minHeight: 72,
          backgroundColor: pressed ? colors.raised : colors.bg,
        })}
      >
        <Avatar
          profileId={display.peer?.id}
          imageUrl={display.imageUrl}
          fallbackText={display.fallbackText}
          size={52}
          /* Grubun tek bir "çevrimiçi" durumu yok; nokta yalnızca kişilerde. */
          showPresence={!display.isGroup && !isOfficial}
          backgroundColor={colors.bg}
        />

        <View style={{ flex: 1, gap: 2 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            {pinned ? (
              <Icon name="bookmark" size={12} color={colors.brand} filled />
            ) : null}
            {display.isGroup ? (
              <Icon name="users" size={13} color={colors.muted} />
            ) : null}
            <Text
              style={{
                ...typography.bodyStrong,
                color: unreadHere ? colors.bright : colors.text,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {display.title}
            </Text>
            {isOfficial ? (
              <View
                style={{
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 4,
                  backgroundColor: colors.brand,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    lineHeight: 12,
                    fontWeight: "800",
                    color: colors.onBrand,
                  }}
                >
                  RESMÎ
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={{
              ...typography.caption,
              color: unreadHere ? colors.text : colors.muted,
            }}
            numberOfLines={1}
          >
            {formatDirectPreview(item.latestMessage, myId, authorName)}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
          {item.latestMessageAt ? (
            <Text
              style={{
                ...typography.caption,
                color: unreadHere ? colors.brand : colors.muted,
              }}
            >
              {formatRelativeShort(item.latestMessageAt)}
            </Text>
          ) : null}
          {unreadHere ? <UnreadBadge count={1} dot /> : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}
