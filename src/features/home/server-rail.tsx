import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useRailItems, useReorderRail, useUnreadCounts, type RailItem } from "@/api/hooks";
import type { MembershipWithServer } from "@/api/types";
import { Avatar, Icon, UnreadBadge } from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing } from "@/theme/tokens";

/**
 * Sol dikey sunucu rayı.
 *
 * Üç davranış:
 *  1. **Seçim ekran değiştirmez** — ray hep görünür, içerik yanında açılır.
 *  2. **Şekil seçimi taşır** — pasif yuvarlak, aktif kare-yuvarlak.
 *  3. **Uzun basıp sürükleyerek sıralanır** — bırakıldığında yeni sıra
 *     `PATCH /api/sidebar/reorder` ile kaydedilir.
 *
 * Klasörler `GET /api/folders`'tan gelir (ad + renk); açılıp kapanışı
 * Reanimated'ın layout animasyonlarıyla yumuşatılır.
 */

const TILE = 48;
/** Bir öğenin dikey adımı: ikon + aradaki boşluk. */
const STEP = TILE + spacing.sm;

export function ServerRail({
  selectedServerId,
  onSelect,
}: {
  selectedServerId: string | null;
  onSelect: (serverId: string | null) => void;
}) {
  const { items } = useRailItems();
  const { data: unread } = useUnreadCounts();
  const reorder = useReorderRail();
  const me = useAuth((s) => s.profile);

  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  /** Sürükleme sırasında geçici sıra; bırakılınca sunucuya yazılır. */
  const [draft, setDraft] = useState<RailItem[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const ordered = draft ?? items;

  const toggleFolder = useCallback(
    (folderId: string) =>
      setOpenFolders((current) => {
        const next = new Set(current);
        if (next.has(folderId)) next.delete(folderId);
        else next.add(folderId);
        return next;
      }),
    []
  );

  const serverUnread = useCallback(
    (serverId: string) => unread?.serverUnreads?.[serverId] ?? 0,
    [unread]
  );

  /** Sürükleme bittiğinde kök sıralamayı kalıcılaştırır. */
  const commitOrder = useCallback(
    (next: RailItem[]) => {
      setDraft(null);
      setDraggingId(null);
      reorder.mutate(
        next.map((item) => ({
          type: item.kind === "folder" ? ("folder" as const) : ("server" as const),
          id: item.id,
        }))
      );
    },
    [reorder]
  );

  const moveItem = useCallback(
    (from: number, to: number) => {
      setDraft((current) => {
        const base = current ?? items;
        if (to < 0 || to >= base.length || from === to) return base;
        const next = [...base];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    },
    [items]
  );

  return (
    <View style={{ width: 72, alignItems: "center", paddingTop: spacing.sm }}>
      {/* Doğrudan mesajlar — kullanıcının kendi avatarı. Sürüklenmez. */}
      <RailButton
        active={selectedServerId === null}
        onPress={() => onSelect(null)}
        accessibilityLabel="Doğrudan mesajlar"
      >
        <Avatar
          imageUrl={me?.imageUrl}
          fallbackText={me?.username}
          size={TILE}
          shape={selectedServerId === null ? "squircle" : "circle"}
          backgroundColor={colors.bento}
        />
      </RailButton>

      <View
        style={{
          width: 28,
          height: 2,
          borderRadius: 1,
          backgroundColor: colors.bentoBorder,
          marginVertical: spacing.sm,
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        // Sürükleme sırasında liste kaymamalı.
        scrollEnabled={draggingId === null}
        contentContainerStyle={{
          alignItems: "center",
          gap: spacing.sm,
          paddingBottom: spacing.lg,
        }}
      >
        {ordered.map((item, index) => (
          <DraggableRailItem
            key={item.id}
            index={index}
            itemCount={ordered.length}
            dragging={draggingId === item.id}
            onDragStart={() => setDraggingId(item.id)}
            onMove={moveItem}
            onDrop={() => commitOrder(draft ?? items)}
          >
            {item.kind === "folder" ? (
              <FolderGroup
                item={item}
                open={openFolders.has(item.id)}
                onToggle={() => toggleFolder(item.id)}
                selectedServerId={selectedServerId}
                onSelect={onSelect}
                unreadOf={serverUnread}
              />
            ) : (
              <ServerTile
                membership={item.membership}
                active={item.membership.serverId === selectedServerId}
                unread={serverUnread(item.membership.serverId)}
                onPress={() => onSelect(item.membership.serverId)}
              />
            )}
          </DraggableRailItem>
        ))}

        <RailButton
          onPress={() => router.push("/servers/new")}
          accessibilityLabel="Sunucu ekle"
        >
          <View
            style={{
              width: TILE,
              height: TILE,
              borderRadius: radii.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.bento,
              borderWidth: 1,
              borderColor: colors.bentoBorder,
            }}
          >
            <Icon name="plus" size={22} color={colors.brand} />
          </View>
        </RailButton>
      </ScrollView>
    </View>
  );
}

/**
 * Uzun basıldığında sürüklenebilir hâle gelen sarmalayıcı.
 *
 * Uzun basma eşiği bilinçli: rayda tek dokunuş sunucu değiştirmek için
 * kullanılıyor, hemen sürükleme başlatmak kaydırmayı da bozardı.
 */
function DraggableRailItem({
  children,
  index,
  itemCount,
  dragging,
  onDragStart,
  onMove,
  onDrop,
}: {
  children: React.ReactNode;
  index: number;
  itemCount: number;
  dragging: boolean;
  onDragStart: () => void;
  onMove: (from: number, to: number) => void;
  onDrop: () => void;
}) {
  const offset = useSharedValue(0);
  const active = useSharedValue(0);
  /** Sürükleme sırasında kaç adım kaydığımız — tekrar tetiklemeyi önler. */
  const shifted = useRef(0);

  const applyMove = useCallback(
    (steps: number) => {
      const target = index + steps;
      if (target < 0 || target >= itemCount) return;
      onMove(index, target);
    },
    [index, itemCount, onMove]
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(220)
        .onStart(() => {
          active.value = withTiming(1, { duration: 120 });
          runOnJS(onDragStart)();
        })
        .onUpdate((event) => {
          offset.value = event.translationY;
          const steps = Math.round(event.translationY / STEP);
          if (steps !== shifted.current) {
            const delta = steps - shifted.current;
            shifted.current = steps;
            runOnJS(applyMove)(delta);
          }
        })
        .onEnd(() => {
          offset.value = withSpring(0, { damping: 18 });
          active.value = withTiming(0, { duration: 140 });
          runOnJS(onDrop)();
        }),
    [active, offset, applyMove, onDragStart, onDrop]
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: offset.value },
      { scale: 1 + active.value * 0.12 },
    ],
    zIndex: active.value > 0 ? 10 : 0,
    opacity: 1 - active.value * 0.15,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={style}
        // Sürüklenen öğe dışındakiler yer değiştirirken yumuşak kaysın.
        layout={dragging ? undefined : LinearTransition.springify().damping(20)}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/** Klasör kapağı + (açıksa) içindeki sunucular. */
function FolderGroup({
  item,
  open,
  onToggle,
  selectedServerId,
  onSelect,
  unreadOf,
}: {
  item: Extract<RailItem, { kind: "folder" }>;
  open: boolean;
  onToggle: () => void;
  selectedServerId: string | null;
  onSelect: (serverId: string) => void;
  unreadOf: (serverId: string) => number;
}) {
  const holdsActive = item.members.some((m) => m.serverId === selectedServerId);
  const folderUnread = item.members.reduce(
    (sum, m) => sum + unreadOf(m.serverId),
    0
  );
  // Klasör rengi sunucudan gelir; gelmezse bento yüzeyine düşülür.
  const tint = item.folder.color?.startsWith("#") ? item.folder.color : colors.bento;

  return (
    <View style={{ alignItems: "center", gap: spacing.sm }}>
      <RailButton
        active={holdsActive && !open}
        onPress={onToggle}
        accessibilityLabel={`${item.folder.name ?? "Klasör"}, ${item.members.length} sunucu, ${open ? "açık" : "kapalı"}`}
        badge={open ? 0 : folderUnread}
      >
        <FolderCover members={item.members} open={open} tint={tint} />
      </RailButton>

      {open
        ? item.members.map((membership) => (
            <Animated.View
              key={membership.serverId}
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              layout={LinearTransition.springify().damping(20)}
            >
              <ServerTile
                membership={membership}
                active={membership.serverId === selectedServerId}
                unread={unreadOf(membership.serverId)}
                onPress={() => onSelect(membership.serverId)}
                inFolder
              />
            </Animated.View>
          ))
        : null}
    </View>
  );
}

/** Kapalı klasör: içindeki ilk dört sunucunun 2×2 ızgarası. */
function FolderCover({
  members,
  open,
  tint,
}: {
  members: MembershipWithServer[];
  open: boolean;
  tint: string;
}) {
  return (
    <View
      style={{
        width: TILE,
        height: TILE,
        borderRadius: radii.md,
        backgroundColor: tint,
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        alignItems: "center",
        justifyContent: "center",
        padding: open ? 0 : 4,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      {open ? (
        <Icon name="chevron-down" size={20} color={colors.brand} />
      ) : (
        members.slice(0, 4).map((membership) => (
          <Avatar
            key={membership.serverId}
            imageUrl={membership.server.imageUrl}
            fallbackText={membership.server.name}
            size={18}
            shape="circle"
            backgroundColor={tint}
          />
        ))
      )}
    </View>
  );
}

function ServerTile({
  membership,
  active,
  unread,
  onPress,
  inFolder,
}: {
  membership: MembershipWithServer;
  active: boolean;
  unread: number;
  onPress: () => void;
  inFolder?: boolean;
}) {
  return (
    <RailButton
      active={active}
      onPress={onPress}
      accessibilityLabel={`${membership.server.name} sunucusu`}
      badge={unread}
      indent={inFolder}
    >
      <Avatar
        imageUrl={membership.server.imageUrl}
        fallbackText={membership.server.name}
        size={inFolder ? TILE - 8 : TILE}
        shape={active ? "squircle" : "circle"}
        backgroundColor={colors.bento}
      />
    </RailButton>
  );
}

/**
 * Ortak dokunma kabı.
 *
 * `Pressable` yerine `Gesture.Tap` kullanılır: üstteki sürükleme jesti bir
 * `GestureDetector` içinde yaşıyor ve React Native'in dokunma sistemiyle
 * karışınca uzun basma sırasında dokunuş da tetikleniyordu.
 */
function RailButton({
  children,
  onPress,
  active,
  badge = 0,
  indent,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  badge?: number;
  indent?: boolean;
  accessibilityLabel: string;
}) {
  const pressed = useSharedValue(0);

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(400)
        .onBegin(() => {
          pressed.value = withTiming(1, { duration: 80 });
        })
        .onFinalize(() => {
          pressed.value = withTiming(0, { duration: 120 });
        })
        .onEnd(() => {
          runOnJS(onPress)();
        }),
    [onPress, pressed]
  );

  const style = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * 0.25,
    transform: [{ scale: 1 - pressed.value * 0.06 }],
  }));

  const indicator = useAnimatedStyle(() => ({
    height: withSpring(active ? 28 : 0, { damping: 16 }),
  }));

  return (
    <View style={{ justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: -12,
            width: 4,
            borderRadius: 2,
            backgroundColor: colors.bright,
          },
          indicator,
        ]}
      />
      <GestureDetector gesture={tap}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ selected: active }}
          style={[{ marginLeft: indent ? spacing.sm : 0 }, style]}
        >
          {children}
          {badge > 0 ? (
            <View style={{ position: "absolute", right: -4, top: -4 }}>
              <UnreadBadge count={badge} />
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Ray genişliği — bento kabuğu hizalaması için dışa açık. */
export const RAIL_WIDTH = 72;

/** Boş ray metni (klasör/sunucu yokken). */
export function RailEmptyHint() {
  return (
    <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center" }}>
      Sunucu yok
    </Text>
  );
}
