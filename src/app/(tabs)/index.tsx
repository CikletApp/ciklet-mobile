import { useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import {
  directDisplay,
  hasUnread,
  useConversationList,
  useDirectUnreadCounts,
  useNicknames,
  useOpenDirect,
  useRemoveDirect,
  useSelfDirect,
  type DirectDisplay,
} from "@/api/hooks";
import type { DirectSummary } from "@/api/types";
import {
  Avatar,
  Button,
  GroupAvatar,
  DropdownMenu,
  emojify,
  EmptyState,
  HeaderButton,
  Icon,
  ListSkeleton,
  ModernRefreshIndicator,
  Pressable,
  Screen,
  SegmentedTabs,
  TabHeader,
  UnreadBadge,
  type TabItem,
  showDialog,
} from "@/components/ui";
import { ActiveNow } from "@/features/home/active-now";
import { formatChatListTime, formatDirectPreview } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { FLOATING_TAB_INSET } from "@/components/ui/tab-bar";
import { fw } from "@/theme/fonts";

/**
 * Sohbetler — birebir ve grup mesajlarının tek evi.
 *
 * Sunucu rayı bu ekrandan KALKTI (bkz. `(tabs)/_layout.tsx`); kazanılan
 * 64px doğrudan satırlara gitti, böylece avatar 38→52 büyüdü ve önizleme
 * metni artık iki kelimede kırpılmıyor.
 */

/** Liste filtreleri — listenin üstünde çip olarak. */
type Filter = "all" | "unread" | "pinned" | "groups";

const FILTERS: TabItem<Filter>[] = [
  { id: "all", label: "Tümü" },
  { id: "unread", label: "Okunmamış" },
  { id: "pinned", label: "Sabitlenenler" },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { counts: unreadCounts } = useDirectUnreadCounts();
  // Arkadaş takma adları liste başlıklarında gerçek adın önüne geçer.
  const nicknames = useNicknames();

  /**
   * Sıralama sunucudan gelir (son mesaj zamanına göre); istemci yalnızca
   * sabitlenmişleri öne çeker ve filtreyi uygular.
   */
  const visible = useMemo(() => {
    const pinned = new Set(pinnedDirectIds);
    const filtered = conversations.filter((direct) => {
      if (filter === "unread") return hasUnread(direct, myId);
      if (filter === "pinned") return pinned.has(direct.id);
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

    showDialog(title, message, [
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
      <TabHeader
        title="Sohbetler"
        left={<HeaderButton icon="more" label="Diğer seçenekler" onPress={() => setMenuOpen(true)} />}
        right={
          <>
            <HeaderButton icon="user-plus" label="Arkadaş ekle" onPress={() => router.push("/friends/add")} />
            <HeaderButton icon="plus" label="Yeni sohbet" accent onPress={() => router.push("/friends/quick-message")} />
          </>
        }
      >
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Pressable
            onPress={() => router.push("/search")}
            noHitSlop
            accessibilityRole="search"
            accessibilityLabel="Mesajlarda ve kişilerde ara"
            style={({ pressed }) => ({
              minHeight: 44,
              borderRadius: radii.full,
              backgroundColor: pressed ? colors.raised : colors.panel,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
            })}
          >
            <Icon name="search" size={19} color={colors.muted} />
            <Text style={{ ...typography.body, color: colors.muted, flex: 1 }}>Sohbetlerde ve kişilerde ara</Text>
          </Pressable>
        </View>
      </TabHeader>

      <SegmentedTabs
        items={filterItems}
        value={filter}
        onChange={setFilter}
        variant="pill"
      />

      <DropdownMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: "Notlarım", icon: "bookmark", onPress: openNotes },
          { label: "Yeni grup", icon: "users", onPress: () => router.push("/directs/new-group") },
          { label: "Arkadaşlar", icon: "user", onPress: () => router.push("/friends") },
          { label: "Ayarlar", icon: "settings", onPress: () => router.push("/settings") },
        ]}
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
              nicknames={nicknames}
              unreadCount={unreadCounts[item.id] ?? 0}
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

  if (filter === "pinned") {
    return (
      <View style={{ paddingTop: spacing.xl }}>
        <EmptyState
          icon="bookmark"
          title="Sabitlenmiş sohbet yok"
          description="Bir sohbeti sağa kaydırarak listenin en üstüne sabitleyebilirsin."
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

/** Satır ölçüleri — ayraç avatarın sağından başlar, metin sütunuyla hizalı. */
const ROW_AVATAR = 56;
const ROW_GAP = spacing.md;

function ConversationRow({
  item,
  myId,
  nicknames,
  unreadCount,
  pinned,
  onTogglePinned,
  onRemove,
}: {
  item: DirectSummary;
  myId: string | undefined;
  /** Arkadaş takma adları (profil kimliği → ad). */
  nicknames: Record<string, string>;
  /** `/api/inbox` sayısı; yoksa okunmamış bilgisi imleçten türetilir. */
  unreadCount: number;
  pinned: boolean;
  onTogglePinned: () => void;
  onRemove: (display: DirectDisplay) => void;
}) {
  const swipeable = useRef<SwipeableMethods>(null);
  // Grup/birebir ayrımının TEK kaynağı; satır profil alanlarını okumaz.
  const display = directDisplay(item, myId, nicknames);
  const unreadHere = unreadCount > 0 || hasUnread(item, myId);
  const isOfficial = !display.isGroup && isOfficialProfile(display.peer);

  /**
   * Grupta önizlemeye yazar adı eklenir: "dosyayı attım" satırının kimden
   * geldiği bilinmeden grup listesi okunamıyor. Birebirde gereksiz —
   * satırın başlığı zaten o kişi.
   */
  const author = display.isGroup
    ? display.members.find((m) => m.id === item.latestMessage?.profileId)
    : undefined;
  const authorName = author?.name?.trim() || author?.username;

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
      <Icon name={icon} size={19} color={colors.onBrand} filled={icon === "bookmark"} />
      <Text style={{ ...typography.caption, ...fw(700), color: colors.onBrand }}>{label}</Text>
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
      renderRightActions={() => action(display.isGroup ? "Ayrıl" : "Sil", colors.danger, "close")}
      onSwipeableOpen={(direction) => {
        if (direction === "right") onTogglePinned();
        else onRemove(display);
        requestAnimationFrame(() => swipeable.current?.close());
      }}
    >
      <Pressable
        onPress={() => router.push(`/chat/direct/${item.id}`)}
        onLongPress={() => onTogglePinned()}
        haptic="light"
        noHitSlop
        accessibilityRole="button"
        accessibilityLabel={`${display.title}${display.isGroup ? " grubu" : " ile sohbet"}${unreadHere ? ", okunmamış mesaj var" : ""}`}
        accessibilityHint="Sabitlemek için basılı tut"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: ROW_GAP,
          paddingLeft: spacing.lg,
          minHeight: 84,
          backgroundColor: pressed ? colors.raised : colors.bg,
        })}
      >
        {display.isGroup ? (
          // Grup: web'deki gibi üyelerin avatarlarından örülü ikon (grubun
          // görseli varsa o) — satırın kimlerle olduğu ilk bakışta okunur.
          <GroupAvatar
            members={display.members}
            excludeId={myId}
            imageUrl={display.imageUrl}
            name={display.title}
            size={ROW_AVATAR}
            backgroundColor={colors.bg}
          />
        ) : (
          <Avatar
            profileId={display.peer?.id}
            imageUrl={display.imageUrl}
            fallbackText={display.fallbackText}
            size={ROW_AVATAR}
            /* Grubun tek bir "çevrimiçi" durumu yok; nokta yalnızca kişilerde. */
            showPresence={!display.isGroup && !isOfficial}
            backgroundColor={colors.bg}
          />
        )}

        <View
          style={{
            flex: 1,
            alignSelf: "stretch",
            justifyContent: "center",
            gap: 3,
            paddingVertical: spacing.md,
            paddingRight: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={{ ...typography.title, fontSize: 16.5, color: colors.bright, flexShrink: 1 }}
                numberOfLines={1}
              >
                {display.title}
              </Text>
              {isOfficial ? (
                <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.brand }}>
                  <Text style={{ fontSize: 9, lineHeight: 12, ...fw(800), color: colors.onBrand }}>RESMÎ</Text>
                </View>
              ) : null}
            </View>
            {item.latestMessageAt ? (
              <Text
                style={{
                  ...typography.caption,
                  ...fw(unreadHere ? 700 : 400),
                  color: unreadHere ? colors.brand : colors.muted,
                }}
              >
                {formatChatListTime(item.latestMessageAt)}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
            <Text
              style={{ ...typography.body, fontSize: 14.5, lineHeight: 20, color: colors.muted, flex: 1 }}
              numberOfLines={2}
            >
              {emojify(formatDirectPreview(item.latestMessage, myId, authorName), `p-${item.id}`, 17)}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 1 }}>
              {pinned ? <Icon name="bookmark" size={15} color={colors.muted} filled /> : null}
              {unreadCount > 0 ? (
                <UnreadBadge count={unreadCount} tone="brand" />
              ) : unreadHere ? (
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} />
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}
