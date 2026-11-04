/*
 * Reanimated worklet'lerinde SharedValue `.value` yazımı zorunludur (v1
 * ekranıyla aynı gerekçe); React saflık kuralları worklet sınırını tanımıyor.
 */
/* eslint-disable react-hooks/immutability, react-hooks/refs */
/**
 * Sunucular — v2 (Discord yapısı, Ciklet mobil tasarımıyla).
 *
 * Ciklet mobilinde sunucular tam genişlikte satırlar (adlar görünür);
 * v2 bu düzeni KORUR, Discord'un şerit YAPISINI ve DAVRANIŞINI getirir:
 *  • Solda hap: okunmamışta nokta (8px). Sayaç rozeti sağda (v1 ile aynı).
 *  • Klasör: kapalıyken 2×2 mini sunucu simgesi + toplam okunmamış; açıkken
 *    klasör rengiyle klasör simgesi ve sunucular klasör rengi tonlu ortak
 *    bant içinde.
 *  • Basılı tutup sürükleme: diğer satırlar KAYMAZ; parmağın olduğu
 *    boşlukta tek yeşil çizgi, satırın ortasında "klasör oluştur" vurgusu,
 *    açık klasörün içine/dışına bırakma. Bırakılan karede yeni düzen
 *    (iyimser; rail-store).
 *  • Basılı tutup bırakmak (sürüklemeden) menüyü açar: okundu işaretle,
 *    Şuraya taşı, Klasör Ayarları, Klasörden Çıkar, Tüm Klasörleri Kapat.
 *  • Araç ipucu mobilde yok (web'de var) — yerine basılı tutma menüsü.
 *
 * v1 (`app/(tabs)/servers.tsx` içindeki ServersScreenV1) olduğu gibi duruyor;
 * seçim `rail-version.ts`.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, Text, TextInput, View, type View as RNView } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import {
  FOLDER_COLOR_RE,
  useFolders,
  useMyPendingApplications,
  useMyServers,
  useUnreadCounts,
} from "@/api/hooks";
import type { MembershipWithServer } from "@/api/types";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import {
  ActionSheet,
  Avatar,
  Button,
  EmptyState,
  HeaderButton,
  Icon,
  ListSkeleton,
  ModernRefreshIndicator,
  Pressable,
  Screen,
  TabHeader,
  UnreadBadge,
  type ActionSheetItem,
} from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { useFloatingTabInset } from "@/components/ui/tab-bar";
import { useTabBarScrollHandler } from "@/components/ui/tab-bar-collapse";
import { PendingApplicationRows } from "@/features/join-application/pending-applications";
import { useT } from "@/lib/i18n";
import {
  applyDrop,
  moveRootBy,
  removeFromFolder,
  type RailDropTarget,
  type RailLayout,
} from "@/lib/rail-layout";
import { onGatewayEvent } from "@/realtime/gateway";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { computeRailDrop, type RailSlot } from "./rail-drop";
import {
  RAIL_ORIGIN,
  bindRail,
  commitRail,
  newClientFolderId,
  railBusy,
  useRailV2,
  writeLayoutToCache,
  type RailFolderMeta,
} from "./rail-store";

const ROW = 72;
const CHILD_ROW = 60;
const MOVE_THRESHOLD = 8;

/** Önbellekteki üyelik + klasörlerden düzen (v1 `useRailItems` sıralama kuralı). */
function layoutFrom(memberships: MembershipWithServer[], folders: { id: string; order: number; members: { serverId: string }[] }[]): RailLayout {
  const known = new Set(memberships.map((m) => m.serverId));
  const roots: { order: number; seq: number; item: RailLayout[number] }[] = [];
  let seq = 0;
  if (folders.length > 0) {
    for (const f of folders) {
      roots.push({
        order: f.order,
        seq: seq++,
        item: { type: "folder", id: f.id, serverIds: f.members.map((m) => m.serverId).filter((id) => known.has(id)) },
      });
    }
  } else {
    // Uç yoksa (eski sunucu) klasörler üyelik alanlarından.
    const grouped = new Map<string, MembershipWithServer[]>();
    for (const m of memberships) {
      if (!m.folderId) continue;
      grouped.set(m.folderId, [...(grouped.get(m.folderId) ?? []), m]);
    }
    for (const [id, ms] of grouped) {
      ms.sort((a, b) => (a.orderInFolder ?? 0) - (b.orderInFolder ?? 0));
      roots.push({ order: ms[0]?.order ?? 0, seq: seq++, item: { type: "folder", id, serverIds: ms.map((m) => m.serverId) } });
    }
  }
  for (const m of memberships) {
    if (m.folderId) continue;
    roots.push({ order: m.order ?? 0, seq: seq++, item: { type: "server", id: m.serverId } });
  }
  roots.sort((a, b) => a.order - b.order || a.seq - b.seq);
  return roots.map((r) => r.item).filter((i) => i.type === "server" || i.serverIds.length > 0);
}

function withAlpha(color: string, alpha: number): string {
  const value = color.replace("#", "");
  if (value.length !== 6) return colors.raised;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface DragView {
  key: string | null;
  lineY: number | null;
  lineInFolder: boolean;
  highlightId: string | null;
}
const NO_DRAG: DragView = { key: null, lineY: null, lineInFolder: false, highlightId: null };

type Menu =
  | { kind: "server"; serverId: string; folderId: string | null }
  | { kind: "folder"; folderId: string }
  | { kind: "move"; key: string }
  | null;

export default function ServersScreenV2() {
  const t = useT();
  const queryClient = useQueryClient();
  const tabInset = useFloatingTabInset();
  const tabScroll = useTabBarScrollHandler();
  const { data: memberships, isLoading: loadingMemberships } = useMyServers();
  const { data: folders, isLoading: loadingFolders } = useFolders();
  const { data: unread } = useUnreadCounts();
  const { data: pendingApplications, refetch: refetchPending } = useMyPendingApplications();
  const override = useRailV2((s) => s.override);
  const open = useRailV2((s) => s.open);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [drag, setDrag] = useState<DragView>(NO_DRAG);
  const [menu, setMenu] = useState<Menu>(null);

  const byId = useMemo(() => new Map((memberships ?? []).map((m) => [m.serverId, m])), [memberships]);
  const meta = useMemo(() => new Map((folders ?? []).map((f) => [f.id, f])), [folders]);
  const base = useMemo(() => layoutFrom(memberships ?? [], folders ?? []), [memberships, folders]);
  const layout = override ?? base;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    bindRail(queryClient, () => showToast(t("serverRail.toast.saveFailed"), "error"));
  }, [queryClient, t]);

  // Başka cihazdaki değişiklik: kendi yankımız yok sayılır.
  useEffect(() => {
    const offLayout = onGatewayEvent("sidebar.updated", (frame) => {
      if (frame.origin === RAIL_ORIGIN || railBusy()) return;
      if (!Array.isArray(frame.items)) return;
      const unknown = writeLayoutToCache(queryClient, frame.items as RailLayout, frame.folders as RailFolderMeta[]);
      if (unknown.length > 0) void queryClient.invalidateQueries({ queryKey: qk.memberships });
    });
    const offFolder = onGatewayEvent("sidebar.folder_updated", () => {
      void queryClient.invalidateQueries({ queryKey: qk.folders });
    });
    return () => {
      offLayout();
      offFolder();
    };
  }, [queryClient]);

  const serverUnread = useCallback((id: string) => unread?.serverUnreads?.[id] ?? 0, [unread]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: qk.memberships }),
        queryClient.refetchQueries({ queryKey: qk.folders }),
        queryClient.refetchQueries({ queryKey: qk.unreadCounts }),
        refetchPending(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refetchPending]);

  // ── Sürükleme: yuvalar sürükleme başında ölçülür ──────────────────────
  const contentRef = useRef<RNView>(null);
  const rowRefs = useRef(new Map<string, { ref: RNView; slot: Omit<RailSlot, "top" | "bottom"> }>());
  const slotsRef = useRef<RailSlot[]>([]);
  const dragRef = useRef<{ key: string; startY: number; target: ReturnType<typeof computeRailDrop>["target"] } | null>(null);

  const register = useCallback((slotKey: string, ref: RNView | null, slot: Omit<RailSlot, "top" | "bottom">) => {
    if (ref) rowRefs.current.set(slotKey, { ref, slot });
    else rowRefs.current.delete(slotKey);
  }, []);

  const onDragStart = useCallback((key: string, slotKey: string, touchY: number) => {
    const content = contentRef.current;
    if (!content) return;
    const measured: RailSlot[] = [];
    let startTop = 0;
    for (const [k, { ref, slot }] of rowRefs.current) {
      ref.measureLayout(content, (_x, y, _w, h) => {
        measured.push({ ...slot, top: y, bottom: y + h });
        if (k === slotKey) startTop = y;
        measured.sort((a, b) => a.top - b.top);
      });
    }
    slotsRef.current = measured;
    dragRef.current = { key, startY: startTop + touchY, target: null };
    // measureLayout (Fabric) eşzamanlı döner; değilse ilk harekette dolar.
    queueMicrotask(() => {
      if (dragRef.current) dragRef.current.startY = startTop + touchY;
    });
    setDrag({ ...NO_DRAG, key });
  }, []);

  const onDragMove = useCallback((translationY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const view = computeRailDrop(slotsRef.current, d.key, d.startY + translationY);
    d.target = view.target;
    setDrag((prev) =>
      prev.lineY === view.lineY && prev.highlightId === view.highlightId && prev.lineInFolder === view.lineInFolder
        ? prev
        : { key: d.key, lineY: view.lineY, lineInFolder: view.lineInFolder, highlightId: view.highlightId },
    );
  }, []);

  const onDragEnd = useCallback((moved: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(NO_DRAG);
    if (!d) return;
    if (!moved) {
      // Basılı tutup bırakma = menü.
      if (d.key.startsWith("folder:")) setMenu({ kind: "folder", folderId: d.key.slice(7) });
      else {
        const folderId = layoutRef.current.find((i) => i.type === "folder" && i.serverIds.includes(d.key))?.id ?? null;
        setMenu({ kind: "server", serverId: d.key, folderId });
      }
      return;
    }
    if (!d.target) return;
    const target: RailDropTarget =
      d.target.kind === "combine" ? { kind: "combine", serverId: d.target.serverId, newFolderId: newClientFolderId() } : d.target;
    const current = layoutRef.current;
    commitRail(current, applyDrop(current, d.key, target));
  }, []);

  const dragApi = useMemo(() => ({ register, onDragStart, onDragMove, onDragEnd }), [register, onDragStart, onDragMove, onDragEnd]);

  // ── Menü eylemleri ─────────────────────────────────────────────────
  const markServersRead = async (serverIds: string[], path: string) => {
    queryClient.setQueryData(qk.unreadCounts, (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const c = current as { serverUnreads?: Record<string, number> };
      const next = { ...(c.serverUnreads ?? {}) };
      for (const id of serverIds) delete next[id];
      return { ...c, serverUnreads: next };
    });
    try {
      await api(path, { method: "POST" });
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
    }
  };

  const moveItems = (key: string): ActionSheetItem[] =>
    (["top", "up", "down", "bottom"] as const).map((where) => ({
      key: where,
      label: t(`serverRail.move.${where}`),
      icon: where === "top" || where === "up" ? "arrow-up-right" : "arrow-down-left",
      onPress: () => {
        const current = layoutRef.current;
        const folder = current.find((i) => i.type === "folder" && !key.startsWith("folder:") && i.serverIds.includes(key));
        if (folder && folder.type === "folder") {
          const from = folder.serverIds.indexOf(key);
          const index = where === "top" ? 0 : where === "bottom" ? folder.serverIds.length : where === "up" ? Math.max(0, from - 1) : from + 2;
          commitRail(current, applyDrop(current, key, { kind: "folder", folderId: folder.id, index }));
        } else {
          commitRail(current, moveRootBy(current, key, where));
        }
      },
    }));

  const folderName = (folderId: string, serverIds: string[]) => {
    const name = meta.get(folderId)?.name;
    if (name && name.trim()) return name;
    const names = serverIds.map((id) => byId.get(id)?.server.name).filter(Boolean);
    return names.length ? names.join(", ") : t("serverRail.folder.defaultName");
  };

  let sheetItems: (ActionSheetItem | "separator")[] = [];
  let sheetTitle = "";
  if (menu?.kind === "server") {
    const m = byId.get(menu.serverId);
    sheetTitle = m?.server.name ?? "";
    sheetItems = [
      ...(serverUnread(menu.serverId) > 0
        ? [{ key: "read", label: t("serverRail.server.markRead"), icon: "check" as const, onPress: () => void markServersRead([menu.serverId], endpoints.serverRead(menu.serverId)) }]
        : []),
      { key: "move", label: t("serverRail.folder.moveTo"), icon: "list", onPress: () => setMenu({ kind: "move", key: menu.serverId }) },
      ...(menu.folderId
        ? [{ key: "out", label: t("serverRail.server.removeFromFolder"), icon: "folder" as const, onPress: () => commitRail(layoutRef.current, removeFromFolder(layoutRef.current, menu.serverId)) }]
        : layout
            .filter((i) => i.type === "folder")
            .map((f) => ({
              key: `add-${f.id}`,
              label: t("serverRail.server.addToFolder", { name: folderName(f.id, f.type === "folder" ? f.serverIds : []) }),
              icon: "folder" as const,
              onPress: () =>
                commitRail(layoutRef.current, applyDrop(layoutRef.current, menu.serverId, { kind: "folder", folderId: f.id, index: Number.MAX_SAFE_INTEGER })),
            }))),
    ];
  } else if (menu?.kind === "folder") {
    const f = layout.find((i) => i.type === "folder" && i.id === menu.folderId);
    const ids = f && f.type === "folder" ? f.serverIds : [];
    sheetTitle = folderName(menu.folderId, ids);
    sheetItems = [
      ...(ids.some((id) => serverUnread(id) > 0)
        ? [{ key: "read", label: t("serverRail.folder.markRead"), icon: "check" as const, onPress: () => void markServersRead(ids, endpoints.folderRead(menu.folderId)) }]
        : []),
      { key: "move", label: t("serverRail.folder.moveTo"), icon: "list", onPress: () => setMenu({ kind: "move", key: `folder:${menu.folderId}` }) },
      "separator",
      { key: "settings", label: t("serverRail.folder.settings"), icon: "settings", onPress: () => router.push(`/folders/${menu.folderId}`) },
      { key: "close", label: t("serverRail.folder.closeAll"), icon: "folder", onPress: () => useRailV2.getState().closeAll() },
    ];
  } else if (menu?.kind === "move") {
    sheetTitle = t("serverRail.folder.moveTo");
    sheetItems = moveItems(menu.key);
  }

  const needle = query.trim().toLocaleLowerCase("tr");
  const matches = useMemo(
    () => (needle ? (memberships ?? []).filter((m) => m.server.name.toLocaleLowerCase("tr").includes(needle)) : []),
    [memberships, needle],
  );
  const total = memberships?.length ?? 0;
  const pendingCount = pendingApplications?.length ?? 0;
  const isLoading = loadingMemberships || loadingFolders;

  return (
    <Screen edges={["top", "left", "right"]}>
      <TabHeader
        title={t("serverRail.label")}
        left={<HeaderButton icon="compass" label={t("serverRail.discover")} onPress={() => router.push("/discover")} />}
        right={<HeaderButton icon="plus" label={t("serverRail.addServer")} accent onPress={() => router.push("/servers/new")} />}
      >
        {total > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
            <View
              style={{
                minHeight: 44,
                borderRadius: radii.full,
                backgroundColor: colors.panel,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
              }}
            >
              <Icon name="search" size={19} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Sunucularda ara"
                placeholderTextColor={colors.muted}
                selectionColor={colors.brand}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityRole="search"
                style={{ ...typography.body, flex: 1, color: colors.bright, paddingVertical: spacing.sm }}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Aramayı temizle">
                  <Icon name="close" size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            {needle ? null : (
              <Text style={{ ...typography.caption, color: colors.muted, paddingBottom: spacing.xs }}>
                {total} sunucu · sıralamak için basılı tutup sürükle
                {total >= 2 ? (
                  <Text onPress={() => router.push("/folders/new")} accessibilityRole="link" style={{ color: colors.brand }}>
                    {" · "}
                    {t("parityScreens.folders.newFolder")}
                  </Text>
                ) : null}
              </Text>
            )}
          </View>
        ) : null}
      </TabHeader>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : layout.length === 0 && pendingCount === 0 ? (
        <EmptyState
          icon="compass"
          title="Henüz sunucun yok"
          description="Bir sunucu kurabilir ya da davet bağlantısıyla var olan bir sunucuya katılabilirsin."
          action={<Button label="Sunucu Oluştur" icon="plus" onPress={() => router.push("/servers/new")} />}
        />
      ) : (
        <Animated.ScrollView
          onScroll={tabScroll}
          scrollEventThrottle={16}
          scrollEnabled={drag.key === null}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              colors={["transparent"]}
              tintColor="transparent"
              progressBackgroundColor="transparent"
            />
          }
          contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: tabInset + spacing.lg }}
        >
          <View ref={contentRef} collapsable={false}>
            {needle
              ? matches.map((m) => (
                  <ServerRowV2 key={m.serverId} membership={m} unread={serverUnread(m.serverId)} />
                ))
              : layout.map((item, rootIndex) =>
                  item.type === "server" ? (
                    byId.get(item.id) ? (
                      <DraggableRow
                        key={item.id}
                        dragKey={item.id}
                        slotKey={item.id}
                        slot={{ kind: "server", id: item.id, rootIndex }}
                        api={dragApi}
                        lifted={drag.key === item.id}
                      >
                        <ServerRowV2
                          membership={byId.get(item.id)!}
                          unread={serverUnread(item.id)}
                          highlight={drag.highlightId === item.id}
                        />
                      </DraggableRow>
                    ) : null
                  ) : (
                    <FolderV2
                      key={`folder:${item.id}`}
                      folderId={item.id}
                      rootIndex={rootIndex}
                      serverIds={item.serverIds}
                      byId={byId}
                      color={meta.get(item.id)?.color ?? null}
                      label={folderName(item.id, item.serverIds)}
                      open={Boolean(open[item.id])}
                      unreadOf={serverUnread}
                      drag={drag}
                      api={dragApi}
                    />
                  ),
                )}
            {drag.lineY !== null ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: drag.lineInFolder ? spacing.xl : spacing.sm,
                  right: drag.lineInFolder ? spacing.lg : spacing.sm,
                  top: drag.lineY - 1.5,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: colors.success,
                }}
              />
            ) : null}
          </View>
          {needle ? (
            matches.length === 0 ? (
              <Text style={{ ...typography.body, color: colors.muted, textAlign: "center", padding: spacing.xl }}>
                &quot;{query.trim()}&quot; ile eşleşen sunucu yok.
              </Text>
            ) : null
          ) : (
            <PendingApplicationRows />
          )}
        </Animated.ScrollView>
      )}

      <ActionSheet
        visible={menu !== null}
        onClose={() => setMenu(null)}
        header={
          sheetTitle ? (
            <Text style={{ ...typography.bodyStrong, color: colors.bright, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }} numberOfLines={1}>
              {sheetTitle}
            </Text>
          ) : undefined
        }
        items={sheetItems}
      />
      <ModernRefreshIndicator visible={refreshing} />
    </Screen>
  );
}

interface DragApi {
  register: (slotKey: string, ref: RNView | null, slot: Omit<RailSlot, "top" | "bottom">) => void;
  onDragStart: (key: string, slotKey: string, touchY: number) => void;
  onDragMove: (translationY: number) => void;
  onDragEnd: (moved: boolean) => void;
}

/**
 * Basılı tutunca (300 ms) etkinleşen sürükleme. Diğer satırlar kaymaz;
 * yalnızca tutulan satır parmağı izler. Hareket etmeden bırakmak menüdür.
 */
function DraggableRow({
  dragKey,
  slotKey,
  slot,
  api: dragApi,
  lifted,
  children,
}: {
  dragKey: string;
  slotKey: string;
  slot: Omit<RailSlot, "top" | "bottom">;
  api: DragApi;
  lifted: boolean;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(0);
  const active = useSharedValue(0);
  const ref = useRef<RNView>(null);
  const slotRef = useRef(slot);
  slotRef.current = slot;

  useEffect(() => {
    dragApi.register(slotKey, ref.current, slotRef.current);
    return () => dragApi.register(slotKey, null, slotRef.current);
  }, [dragApi, slotKey, slot.rootIndex, slot.childIndex, slot.open, slot.childCount, slot.folderId]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(300)
        .onStart((event) => {
          active.value = withTiming(1, { duration: 100 });
          runOnJS(dragApi.onDragStart)(dragKey, slotKey, event.y);
        })
        .onUpdate((event) => {
          offset.value = event.translationY;
          runOnJS(dragApi.onDragMove)(event.translationY);
        })
        .onEnd((event) => {
          const moved = Math.abs(event.translationY) > MOVE_THRESHOLD;
          // Bırakınca hemen yerine oturur (Discord: bırakma animasyonu yok).
          offset.value = 0;
          active.value = 0;
          runOnJS(dragApi.onDragEnd)(moved);
        })
        .onFinalize(() => {
          offset.value = 0;
          active.value = 0;
        }),
    [active, offset, dragApi, dragKey, slotKey],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }, { scale: 1 + active.value * 0.02 }],
    zIndex: active.value > 0 ? 10 : 0,
    opacity: 1 - active.value * 0.2,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref} collapsable={false} style={[style, lifted ? { backgroundColor: colors.raised, borderRadius: radii.lg } : null]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/** Sol kenardaki hap: okunmamışta 8px nokta (web ile aynı durum makinesi). */
function Pill({ unread }: { unread: boolean }) {
  if (!unread) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: "50%",
        marginTop: -4,
        width: 4,
        height: 8,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        backgroundColor: colors.bright,
      }}
    />
  );
}

const ServerRowV2 = memo(function ServerRowV2({
  membership,
  unread,
  compact,
  highlight,
}: {
  membership: MembershipWithServer;
  unread: number;
  compact?: boolean;
  highlight?: boolean;
}) {
  const t = useT();
  const myId = useAuth((s) => s.profile?.id);
  const owner = Boolean(membership.server.profileId && membership.server.profileId === myId);
  const size = compact ? 44 : 52;
  return (
    <Pressable
      onPress={() => router.push(`/servers/${membership.serverId}`)}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${membership.server.name}, ${t("serverRail.unread", { count: unread })}` : membership.server.name}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingLeft: spacing.lg,
        minHeight: compact ? CHILD_ROW : ROW,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <Pill unread={unread > 0} />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          overflow: "hidden",
          borderWidth: highlight ? 2 : owner ? 1.5 : 0,
          borderColor: highlight ? colors.success : owner ? withAlpha(colors.warning, 0.5) : "transparent",
          transform: [{ scale: highlight ? 1.08 : 1 }],
        }}
      >
        <Avatar
          imageUrl={membership.server.imageUrl}
          fallbackText={membership.server.name}
          size={highlight ? size - 4 : owner ? size - 3 : size}
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
          borderBottomWidth: compact ? 0 : 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...typography.title, fontSize: compact ? 15.5 : 16.5, color: colors.bright }} numberOfLines={1}>
            {membership.server.name}
          </Text>
          <Text
            style={{ ...typography.caption, ...(unread > 0 ? fw(600) : null), color: unread > 0 ? colors.brand : colors.muted }}
            numberOfLines={1}
          >
            {unread > 0 ? "Yeni mesajlar var" : owner ? "Sahibi sensin" : "Üyesin"}
          </Text>
        </View>
        {unread > 0 ? <UnreadBadge count={unread} tone="brand" /> : null}
      </View>
    </Pressable>
  );
});

function FolderV2({
  folderId,
  rootIndex,
  serverIds,
  byId,
  color,
  label,
  open,
  unreadOf,
  drag,
  api: dragApi,
}: {
  folderId: string;
  rootIndex: number;
  serverIds: string[];
  byId: Map<string, MembershipWithServer>;
  color: string | null;
  label: string;
  open: boolean;
  unreadOf: (id: string) => number;
  drag: DragView;
  api: DragApi;
}) {
  const t = useT();
  const raw = color?.trim() ?? "";
  const custom = FOLDER_COLOR_RE.test(raw);
  const tint = custom ? raw : colors.brand;
  const total = serverIds.reduce((sum, id) => sum + unreadOf(id), 0);
  const key = `folder:${folderId}`;
  const preview = serverIds.slice(0, 4);

  const header = (
    <Pressable
      onPress={() => useRailV2.getState().toggle(folderId)}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={t("serverRail.folder.aria", { name: label, count: serverIds.length })}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: ROW,
        paddingLeft: spacing.lg,
        paddingRight: spacing.lg,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <Pill unread={!open && total > 0} />
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: open ? "transparent" : custom ? withAlpha(tint, 0.25) : colors.panel,
          borderWidth: drag.highlightId === key ? 2 : 0,
          borderColor: colors.success,
          padding: open ? 0 : 5,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {open ? (
          <Icon name="folder" size={26} color={custom ? tint : colors.warning} filled />
        ) : (
          [0, 1, 2, 3].map((i) => {
            const m = preview[i] ? byId.get(preview[i]) : undefined;
            return (
              <View key={i} style={{ width: 19, height: 19, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.2)" }}>
                {m ? <Avatar imageUrl={m.server.imageUrl} fallbackText={m.server.name} size={19} radius={10} backgroundColor={colors.bento} /> : null}
              </View>
            );
          })
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.text }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{serverIds.length} sunucu</Text>
      </View>
      {!open && total > 0 ? <UnreadBadge count={total} tone="brand" /> : null}
      <Icon name={open ? "chevron-down" : "chevron-right"} size={18} color={colors.muted} />
    </Pressable>
  );

  return (
    <View
      style={
        open
          ? {
              marginHorizontal: spacing.sm,
              marginVertical: spacing.xs,
              borderRadius: radii.bento,
              borderCurve: "continuous",
              backgroundColor: custom ? withAlpha(tint, 0.12) : colors.panel,
              overflow: "hidden",
            }
          : undefined
      }
    >
      <DraggableRow
        dragKey={key}
        slotKey={key}
        slot={{ kind: "folder", id: folderId, rootIndex, open, childCount: serverIds.length }}
        api={dragApi}
        lifted={drag.key === key}
      >
        {header}
      </DraggableRow>
      {open ? (
        <Animated.View entering={FadeIn.duration(150)} style={{ paddingBottom: spacing.xs }}>
          {serverIds.map((id, childIndex) => {
            const m = byId.get(id);
            if (!m) return null;
            return (
              <DraggableRow
                key={id}
                dragKey={id}
                slotKey={`child:${id}`}
                slot={{ kind: "child", id, rootIndex, folderId, childIndex }}
                api={dragApi}
                lifted={drag.key === id}
              >
                <ServerRowV2 membership={m} unread={unreadOf(id)} compact highlight={drag.highlightId === id} />
              </DraggableRow>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}
