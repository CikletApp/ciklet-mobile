/*
 * Reanimated worklet'lerinde SharedValue `.value` yazımı zorunludur.
 * React'in genel saflık kuralları worklet sınırını tanımadığı için bu iki
 * kural burada yanlış pozitif üretir; normal React state'i kapsam dışıdır.
 */
/* eslint-disable react-hooks/immutability, react-hooks/refs */
import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
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
  withTiming,
} from "react-native-reanimated";

import {
  useRailItems,
  useReorderRail,
  useUnreadCounts,
  type RailItem,
} from "@/api/hooks";
import type { MembershipWithServer } from "@/api/types";
import {
  Avatar,
  Button,
  EmptyState,
  HeaderButton,
  Icon,
  ListSkeleton,
  Pressable,
  Screen,
  TabHeader,
  UnreadBadge,
} from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { FLOATING_TAB_INSET } from "@/components/ui/tab-bar";

/**
 * Sunucular — sunucuların kendi evi.
 *
 * Önceden bu liste Ana Sayfa'nın solunda 64px'lik dikey bir raydı: sunucular
 * yalnızca avatarla temsil ediliyordu, adları hiç görünmüyordu ve bir
 * sunucuya bakmak mesaj listesini ekrandan kaldırıyordu. Tam genişlikte
 * satır düzeni her sunucunun ADINI, klasörünü ve okunmamış sayısını aynı
 * anda gösteriyor.
 *
 * Rayın kaybolmasıyla giden tek yetenek sıralamaydı; uzun basıp sürükleme
 * jesti buraya taşındı ve aynı `PATCH /api/sidebar/reorder` ucunu kullanıyor.
 */

/** Yer değiştirme hareketi: yay YOK, sabit süreli ease-out (rayla aynı). */
const REORDER_DURATION = 200;
const REORDER_EASING = {
  duration: REORDER_DURATION,
  easing: Easing.out(Easing.quad),
} as const;
const REORDER_LAYOUT = LinearTransition.duration(REORDER_DURATION).easing(
  Easing.out(Easing.quad)
);

/** Bir satırın dikey adımı — sürüklemenin kaç sıra kaydığını bundan hesaplarız. */
const ROW_STEP = 72;

export default function ServersScreen() {
  const { items, isLoading } = useRailItems();
  const { data: unread } = useUnreadCounts();
  const reorder = useReorderRail();

  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<RailItem[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const ordered = draft ?? items;

  const serverUnread = useCallback(
    (serverId: string) => unread?.serverUnreads?.[serverId] ?? 0,
    [unread]
  );

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

  const commitOrder = useCallback(() => {
    const next = draft ?? items;
    setDraft(null);
    setDraggingId(null);
    reorder.mutate(
      next.map((item) => ({
        type: item.kind === "folder" ? ("folder" as const) : ("server" as const),
        id: item.id,
      }))
    );
  }, [draft, items, reorder]);

  const totalServers = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.kind === "folder" ? item.members.length : 1),
        0
      ),
    [items]
  );

  return (
    <Screen edges={["top", "left", "right"]}>
      <TabHeader
        title="Sunucular"
        left={<HeaderButton icon="compass" label="Aktiviteler" onPress={() => router.push("/activities")} />}
        right={<HeaderButton icon="plus" label="Sunucu ekle" accent onPress={() => router.push("/servers/new")} />}
      >
        {totalServers > 0 ? (
          <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            {totalServers} sunucu · sıralamak için basılı tutup sürükle
          </Text>
        ) : null}
      </TabHeader>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : ordered.length === 0 ? (
        <EmptyState
          icon="compass"
          title="Henüz sunucun yok"
          description="Bir sunucu kurabilir ya da davet bağlantısıyla var olan bir sunucuya katılabilirsin."
          action={
            <Button
              label="Sunucu Oluştur"
              icon="plus"
              onPress={() => router.push("/servers/new")}
            />
          }
        />
      ) : (
        <ScrollView
          scrollEnabled={draggingId === null}
          contentContainerStyle={{
            paddingTop: spacing.xs,
            paddingBottom: FLOATING_TAB_INSET + spacing.lg,
          }}
        >
          {ordered.map((item, index) => (
            <DraggableRow
              key={item.id}
              index={index}
              itemCount={ordered.length}
              dragging={draggingId === item.id}
              onDragStart={() => setDraggingId(item.id)}
              onMove={moveItem}
              onDrop={commitOrder}
            >
              {item.kind === "folder" ? (
                <FolderSection
                  item={item}
                  open={openFolders.has(item.id)}
                  onToggle={() => toggleFolder(item.id)}
                  unreadOf={serverUnread}
                />
              ) : (
                <ServerRow
                  membership={item.membership}
                  unread={serverUnread(item.membership.serverId)}
                />
              )}
            </DraggableRow>
          ))}

        </ScrollView>
      )}
    </Screen>
  );
}

/**
 * Uzun basıldığında sürüklenebilir hâle gelen satır.
 *
 * Eşik bilinçli: tek dokunuş sunucuyu AÇMAK için kullanılıyor, hemen
 * sürükleme başlatmak hem açmayı hem listeyi kaydırmayı bozardı.
 */
function DraggableRow({
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
          const steps = Math.round(event.translationY / ROW_STEP);
          if (steps !== shifted.current) {
            const delta = steps - shifted.current;
            shifted.current = steps;
            runOnJS(applyMove)(delta);
          }
        })
        .onEnd(() => {
          offset.value = withTiming(0, REORDER_EASING);
          active.value = withTiming(0, { duration: 140 });
          shifted.current = 0;
          runOnJS(onDrop)();
        }),
    [active, offset, applyMove, onDragStart, onDrop]
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    zIndex: active.value > 0 ? 10 : 0,
    opacity: 1 - active.value * 0.35,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style} layout={dragging ? undefined : REORDER_LAYOUT}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/** Katlanabilir klasör bölümü — kapağı, altında sunucuları. */
function FolderSection({
  item,
  open,
  onToggle,
  unreadOf,
}: {
  item: Extract<RailItem, { kind: "folder" }>;
  open: boolean;
  onToggle: () => void;
  unreadOf: (serverId: string) => number;
}) {
  const folderUnread = item.members.reduce(
    (sum, m) => sum + unreadOf(m.serverId),
    0
  );
  // Webden gelen klasör rengini biçimine göre elemeden aynen kullan.
  const tint = item.folder.color?.trim() || colors.brand;

  return (
    <View>
      <Pressable
        onPress={onToggle}
        haptic="light"
        noHitSlop
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${item.folder.name ?? "Klasör"}, ${item.members.length} sunucu, ${open ? "açık" : "kapalı"}`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          minHeight: 56,
          paddingHorizontal: spacing.md,
          borderRadius: radii.lg,
          backgroundColor: pressed ? colors.raised : "transparent",
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.md,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(tint, 0.18),
          }}
        >
          <Icon name="folder" size={22} color={tint} filled />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{ ...typography.bodyStrong, color: colors.text }}
            numberOfLines={1}
          >
            {item.folder.name ?? "Klasör"}
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {item.members.length} sunucu
          </Text>
        </View>

        {!open && folderUnread > 0 ? <UnreadBadge count={folderUnread} /> : null}
        <Icon
          name={open ? "chevron-down" : "chevron-right"}
          size={18}
          color={colors.muted}
        />
      </Pressable>

      {open ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          layout={REORDER_LAYOUT}
          style={{
            marginLeft: spacing.xl,
            paddingLeft: spacing.sm,
            borderLeftWidth: 2,
            borderLeftColor: withAlpha(tint, 0.35),
          }}
        >
          {item.members.map((membership) => (
            <ServerRow
              key={membership.serverId}
              membership={membership}
              unread={unreadOf(membership.serverId)}
              compact
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function ServerRow({
  membership,
  unread,
  compact,
}: {
  membership: MembershipWithServer;
  unread: number;
  compact?: boolean;
}) {
  const myId = useAuth((s) => s.profile?.id);
  const owner = Boolean(
    membership.server.profileId && membership.server.profileId === myId
  );
  const size = compact ? 44 : 52;

  return (
    <Pressable
      onPress={() => router.push(`/servers/${membership.serverId}`)}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={`${membership.server.name} sunucusu${unread > 0 ? `, ${unread} okunmamış` : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingLeft: spacing.lg,
        minHeight: compact ? 60 : 72,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      {/* Sabit kutu: sahip çerçevesi ikonu büyütüp metni kaydırmasın. */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          overflow: "hidden",
          borderWidth: owner ? 1.5 : 0,
          borderColor: owner ? withAlpha(colors.warning, 0.5) : "transparent",
        }}
      >
        <Avatar
          imageUrl={membership.server.imageUrl}
          fallbackText={membership.server.name}
          size={owner ? size - 3 : size}
          radius={0}
          backgroundColor={colors.bento}
        />
      </View>

      <View
        style={{
          flex: 1,
          alignSelf: "stretch",
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingRight: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...typography.title, fontSize: 16.5, color: colors.bright }} numberOfLines={1}>
            {membership.server.name}
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {owner ? "Sahibi sensin" : unread > 0 ? "Yeni mesajlar var" : "Üyesin"}
          </Text>
        </View>
        {unread > 0 ? <UnreadBadge count={unread} tone="brand" /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Rengi verilen saydamlıkla `rgba`ya çevirir — klasör renginin soluk hâli
 * hem kapak zemininde hem sol çizgide kullanılıyor.
 */
function withAlpha(color: string, alpha: number): string {
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
