import { useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { router, Stack } from "expo-router";

import { useCallHistory } from "@/api/hooks";
import type { CallHistoryItem } from "@/api/types";
import {
  Avatar,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ListSkeleton,
  Pressable,
  Screen,
  SegmentedTabs,
  showToast,
  type IconName,
  type TabItem,
} from "@/components/ui";
import { displayNameOf, formatChatListTime } from "@/lib/format";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useCallActions } from "@/realtime/use-call-events";
import { useCall } from "@/stores/call";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Aramalar (WhatsApp "Aramalar") — birebir görüşmelerin geçmişi.
 *
 * Sohbetler'in "Diğer seçenekler" menüsünden açılır: dört sekmeli alt çubuk
 * (ölçülü bir karar, bkz. (tabs)/_layout) beşinciyi kaldırmıyor ve aramalar
 * zaten sohbetlerin bir yüzü.
 *
 * Satıra dokununca sohbet açılır; sağdaki simge aynı türde (sesli /
 * görüntülü) yeniden arar. Sınıflandırma sunucuda (ciklet-web
 * lib/calls/history.ts) — burada yalnızca çizilir.
 */

type Filter = "all" | "missed";

const FILTERS: TabItem<Filter>[] = [
  { id: "all", label: "Tümü" },
  { id: "missed", label: "Cevapsız" },
];

/** Görüşme kapandıktan sonra listenin tazelenme gecikmesi — süre sunucuda oda boşalınca yazılıyor. */
const REFRESH_AFTER_CALL_MS = 2_500;

export default function CallsScreen() {
  const history = useCallHistory();
  const pull = usePullRefresh(history.refetch);
  const { placeCall } = useCallActions();
  const [filter, setFilter] = useState<Filter>("all");

  // Görüşme bitince (bu ekran açıkken) yeni satır listeye düşsün.
  const inCall = useCall((s) => s.session !== null);
  const wasInCall = useRef(inCall);
  const { refetch } = history;
  useEffect(() => {
    const ended = wasInCall.current && !inCall;
    wasInCall.current = inCall;
    if (!ended) return;
    const timer = setTimeout(() => void refetch(), REFRESH_AFTER_CALL_MS);
    return () => clearTimeout(timer);
  }, [inCall, refetch]);

  const items = (history.data?.pages ?? []).flatMap((page) => page.items);
  const visible = filter === "missed" ? items.filter((item) => item.category === "missed") : items;

  const callBack = (item: CallHistoryItem) => {
    if (useCall.getState().session) {
      showToast("Zaten bir görüşmedesin.");
      return;
    }
    if (!item.directId) {
      // Sohbeti olmayan biriyle (eski kayıt) — profil üzerinden aranır.
      router.push(`/profile/${item.peer.id}`);
      return;
    }
    placeCall(item.peer, item.directId, item.kind);
  };

  const open = (item: CallHistoryItem) => {
    if (item.directId) router.push(`/chat/direct/${item.directId}`);
    else router.push(`/profile/${item.peer.id}`);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Aramalar" }} />
      <View style={{ paddingTop: spacing.sm }}>
        <SegmentedTabs items={FILTERS} value={filter} onChange={setFilter} variant="pill" />
      </View>
      {history.isLoading ? (
        <ListSkeleton />
      ) : history.isError && items.length === 0 ? (
        <ErrorState message="Arama geçmişi yüklenemedi." onRetry={() => void history.refetch()} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.xs, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.brand} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
          }}
          ListEmptyComponent={
            <View style={{ flex: 1, paddingTop: spacing["3xl"] }}>
              <EmptyState
                icon="phone"
                title={filter === "missed" ? "Cevapsız arama yok" : "Henüz arama yok"}
                description="Bir sohbetin üstündeki telefon ya da kamera simgesiyle arayabilirsin."
              />
            </View>
          }
          renderItem={({ item }) => (
            <CallRow item={item} onPress={() => open(item)} onCallBack={() => callBack(item)} />
          )}
        />
      )}
    </Screen>
  );
}

const CATEGORY: Record<CallHistoryItem["category"], { label: string; icon: IconName }> = {
  incoming: { label: "Gelen", icon: "arrow-down-left" },
  outgoing: { label: "Giden", icon: "arrow-up-right" },
  missed: { label: "Cevapsız", icon: "arrow-down-left" },
  declined: { label: "Reddedildi", icon: "arrow-down-left" },
};

function CallRow({
  item,
  onPress,
  onCallBack,
}: {
  item: CallHistoryItem;
  onPress: () => void;
  onCallBack: () => void;
}) {
  const name = displayNameOf(item.peer);
  const category = CATEGORY[item.category];
  const alert = item.category === "missed" || item.category === "declined";
  const arrowColor = alert ? colors.danger : item.answered ? colors.success : colors.muted;

  const details = [
    item.category === "outgoing" && !item.answered ? "Cevaplanmadı" : category.label,
    item.kind === "video" ? "Görüntülü" : "Sesli",
    item.durationSecs !== null ? formatCallLength(item.durationSecs) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${details}, ${formatChatListTime(item.startedAt)}`}
      style={({ pressed }) => ({
        marginHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <Avatar profileId={item.peer.id} imageUrl={item.peer.imageUrl} fallbackText={item.peer.username} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ ...typography.bodyStrong, color: alert ? colors.danger : colors.bright }}>
          {name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Icon name={category.icon} size={14} color={arrowColor} />
          <Text numberOfLines={1} style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }}>
            {details}
          </Text>
        </View>
      </View>
      <Text style={{ ...typography.caption, color: colors.muted }}>{formatChatListTime(item.startedAt)}</Text>
      <IconButton
        icon={item.kind === "video" ? "video" : "phone"}
        label={item.kind === "video" ? `${name} kişisini görüntülü ara` : `${name} kişisini sesli ara`}
        onPress={onCallBack}
        background="transparent"
        tint={colors.brand}
        haptic="medium"
      />
    </Pressable>
  );
}

/** "45 sn", "3 dk 12 sn", "1 sa 5 dk" — satırda yer dar. */
function formatCallLength(secs: number): string {
  if (secs < 60) return `${secs} sn`;
  if (secs < 3600) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s ? `${m} dk ${s} sn` : `${m} dk`;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}
