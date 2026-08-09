/*
 * Reanimated worklet'lerinde SharedValue `.value` yazımı zorunludur.
 * React'in genel saflık kuralları worklet sınırını tanımadığı için bu iki
 * kural burada yanlış pozitif üretir; normal React state'i kapsam dışıdır.
 */
/* eslint-disable react-hooks/immutability, react-hooks/refs */
import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
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
 * Sol dikey sunucu rayı — ciklet-web'deki `navigation/v2` ile aynı dil.
 *
 * Web'in tasarım kuralları birebir uygulanır
 * (`navigation-item.tsx`, `navigation-pill.tsx`, `navigation-folder.tsx`):
 *
 *  • Sunucu 48×48. Normalde tam yuvarlak (r=24), aktifken squircle (r=16).
 *    Geçiş 200 ms. **Ölçek/zıplama YOK** — yalnızca yarıçap değişir.
 *  • Sol kenarda beyaz hap: 0 (normal) / 8 (okunmamış) / 40 (aktif) px.
 *  • Klasör kapalıyken 48px squircle içinde 2×2 mini ızgara, zemini klasör
 *    rengi. Açıkken ızgara yerine klasör ikonu ve altında klasör renginin
 *    %15'i zeminli dikey kap; içindeki sunucular 40px (r=20 → aktif r=12,
 *    hap 0/8/32).
 *
 * Ek olarak mobilde: uzun basıp sürükleyerek sıralama
 * (`PATCH /api/sidebar/reorder`).
 */

/**
 * Rayın zamanlaması.
 *
 * İki tür hareket bilinçli olarak AYRIŞTIRILDI:
 *  • **Yer değiştirme** (sürükleme bırakışı, yeniden sıralama, klasör
 *    açılışı) → yay YOK, sabit süreli ease-out. Yay burada hedefi aşıp geri
 *    geliyor ve ikonlar "zıplıyormuş" gibi duruyordu.
 *  • **Seçim** (aktif ikonun hafifçe büyümesi) → yay VAR; sekme çubuğundaki
 *    davranışın aynısı, dokunuşa canlı bir karşılık veriyor.
 */
const RAIL_DURATION = 200;
const RAIL_EASING = {
  duration: RAIL_DURATION,
  easing: Easing.out(Easing.quad),
} as const;
const RAIL_LAYOUT = LinearTransition.duration(RAIL_DURATION).easing(
  Easing.out(Easing.quad)
);
/** Seçim yayı — sekme çubuğuyla aynı sönümleme. */
const SELECT_SPRING = { damping: 16 } as const;

const TILE = 46;
const FOLDER_TILE = 38;
/** Bir öğenin dikey adımı: ikon + aradaki boşluk. */
const STEP = TILE + 6;

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
    <View style={{ width: 64, alignItems: "center", paddingTop: 6 }}>
      {/* Doğrudan mesajlar — kullanıcının kendi avatarı. Sürüklenmez. */}
      <RailButton
        active={selectedServerId === null}
        onPress={() => onSelect(null)}
        accessibilityLabel="Doğrudan mesajlar"
        size={TILE}
      >
        <Avatar
          imageUrl={me?.imageUrl}
          fallbackText={me?.username}
          size={TILE}
          radius={0}
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
        scrollEnabled={draggingId === null}
        contentContainerStyle={{
          alignItems: "center",
          gap: 6,
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
          size={TILE}
        >
          <View
            style={{
              width: TILE,
              height: TILE,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.bentoBorder,
              backgroundColor: colors.raised,
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
 * Sürüklenen öğe hafifçe saydamlaşır — web'deki `isDragging` davranışı.
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
          offset.value = withTiming(0, RAIL_EASING);
          active.value = withTiming(0, { duration: 140 });
          shifted.current = 0;
          runOnJS(onDrop)();
        }),
    [active, offset, applyMove, onDragStart, onDrop]
  );

  const style = useAnimatedStyle(() => ({
    // Sürüklerken ÖLÇEK DEĞİŞMEZ; yalnızca konum ve saydamlık.
    transform: [{ translateY: offset.value }],
    zIndex: active.value > 0 ? 10 : 0,
    opacity: 1 - active.value * 0.5,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={style}
        layout={dragging ? undefined : RAIL_LAYOUT}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/** Klasör kapağı + (açıksa) altındaki renkli kapta sunucular. */
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
  // Webden gelen klasör rengini biçimine göre elemeden aynen kullan.
  // Önceki yalnız-hex kontrolü geçerli HSL/RGB renkleri varsayılana düşürüyordu.
  const tint = item.folder.color?.trim() || colors.brand;

  return (
    <View style={{ alignItems: "center", gap: spacing.xs }}>
      <RailButton
        active={holdsActive && !open}
        unread={open ? 0 : folderUnread}
        onPress={onToggle}
        accessibilityLabel={`${item.folder.name ?? "Klasör"}, ${item.members.length} sunucu, ${open ? "açık" : "kapalı"}`}
        size={TILE}
        /**
         * Klasör kapağı da sunucular gibi davranır: KAPALIYKEN yuvarlak,
         * AÇILINCA squircle. (Web'de de böyle — kapalı klasör dairesel,
         * açık klasör kare-yuvarlak.)
         */
        forceActiveShape={open}
      >
        <View
          style={{
            width: TILE,
            height: TILE,
            backgroundColor: tint,
            alignItems: "center",
            justifyContent: "center",
            padding: 4,
          }}
        >
          <Icon name="folder" size={23} color={colors.bright} />
        </View>
      </RailButton>

      {open ? (
        // Açık klasörün gövdesi: klasör renginin soluk hâliyle zeminli kap —
        // içindeki sunucuların klasöre ait olduğu görsel olarak bağlanır.
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          layout={RAIL_LAYOUT}
          style={{
            alignItems: "center",
            gap: spacing.xs,
            paddingVertical: spacing.xs,
            paddingHorizontal: 2,
            borderRadius: radii.md,
            backgroundColor: withAlpha(tint, 0.15),
          }}
        >
          {item.members.map((membership) => (
            <ServerTile
              key={membership.serverId}
              membership={membership}
              active={membership.serverId === selectedServerId}
              unread={unreadOf(membership.serverId)}
              onPress={() => onSelect(membership.serverId)}
              inFolder
            />
          ))}
        </Animated.View>
      ) : null}
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
  const size = inFolder ? FOLDER_TILE : TILE;
  const myId = useAuth.getState().profile?.id;
  const owner = Boolean(
    membership.server.profileId && membership.server.profileId === myId
  );

  return (
    <RailButton
      active={active}
      unread={unread}
      onPress={onPress}
      accessibilityLabel={`${membership.server.name} sunucusu`}
      size={size}
      inFolder={inFolder}
      owner={owner}
    >
      <Avatar
        imageUrl={membership.server.imageUrl}
        fallbackText={membership.server.name}
        size={size}
        radius={0}
        backgroundColor={colors.bento}
      />
    </RailButton>
  );
}

/**
 * Ortak dokunma kabı: yarıçap geçişi, seçim hapı ve okunmamış rozeti.
 *
 * `Pressable` yerine `Gesture.Tap`: üstteki sürükleme jesti bir
 * `GestureDetector` içinde yaşıyor ve React Native'in dokunma sistemiyle
 * karışınca uzun basma sırasında dokunuş da tetikleniyordu.
 */
function RailButton({
  children,
  onPress,
  active = false,
  unread = 0,
  size,
  inFolder,
  forceActiveShape,
  owner,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  unread?: number;
  size: number;
  inFolder?: boolean;
  /** Seçili olmasa da squircle çizilsin (açık klasör kapağı). */
  forceActiveShape?: boolean;
  /** Sunucunun sahibi kullanıcıysa altın çerçeve (web: ring-theme-yellow/50). */
  owner?: boolean;
  accessibilityLabel: string;
}) {
  const tap = useMemo(
    () => Gesture.Tap().maxDuration(400).onEnd(() => runOnJS(onPress)()),
    [onPress]
  );

  // Web: r = size/2 (yuvarlak) → aktifte squircle. 200 ms.
  const roundRadius = size / 2;
  const activeRadius = inFolder ? 12 : radii.bento;

  const squared = active || forceActiveShape;
  const shape = useAnimatedStyle(() => ({
    borderRadius: withTiming(squared ? activeRadius : roundRadius, RAIL_EASING),
    // Seçili ikon hafifçe büyür — sekme çubuğundaki yayın aynısı.
    transform: [{ scale: withSpring(active ? 1 : 0.94, SELECT_SPRING) }],
  }));

  // Hap: 0 / 8 (okunmamış) / 40 (aktif) — klasör içinde 0 / 8 / 32.
  const pillHeight = active ? (inFolder ? 32 : 40) : unread > 0 ? 8 : 0;
  const pill = useAnimatedStyle(() => ({
    height: withTiming(pillHeight, RAIL_EASING),
  }));

  return (
    <View style={{ justifyContent: "center", paddingVertical: 2 }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: inFolder ? -8 : -12,
            width: 4,
            borderTopRightRadius: 2,
            borderBottomRightRadius: 2,
            backgroundColor: colors.bright,
          },
          pill,
        ]}
      />
      <GestureDetector gesture={tap}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ selected: active }}
          style={[
            {
              width: size,
              height: size,
              overflow: "hidden",
              borderWidth: owner ? 1.5 : 0,
              borderColor: owner ? withAlpha(colors.warning, 0.5) : "transparent",
            },
            shape,
          ]}
        >
          {children}
        </Animated.View>
      </GestureDetector>

      {unread > 0 ? (
        <View style={{ position: "absolute", right: -4, bottom: -2 }}>
          <UnreadBadge count={unread} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Hex rengi verilen saydamlıkla `rgba`ya çevirir.
 * Klasör gövdesinin zemini web'de klasör renginin %15'i.
 */
function withAlpha(color: string, alpha: number): string {
  // hsl(h, s%, l%) → hsla(...)
  if (color.startsWith("hsl(")) {
    return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  }
  const value = color.replace("#", "");
  if (value.length !== 6) return colors.bento;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
