import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import {
  canManageEvents,
  formatEventWhen,
  useDeleteServerEvent,
  useMyPermissions,
  useServerEvents,
  useSetServerEventStatus,
  useToggleEventInterest,
} from "@/api/hooks";
import type { ServerEventItem, ServerEventStatus } from "@/api/types";
import {
  ActionSheet,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ListSkeleton,
  Screen,
  Tag,
  showDialog,
  showToast,
  type ActionSheetItem,
} from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import { describeRecurrence } from "@/lib/event-recurrence";
import { useNow } from "@/lib/use-now";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu etkinlikleri — web sunucu menüsündeki "Etkinlikler" modalının
 * mobil karşılığı. Herkes listeyi görür ve "İlgileniyorum" der; moderatör+
 * oluşturur, elle başlatır / bitirir / iptal eder / siler. Ses kanalında
 * yapılan etkinliğe dokununca kanal açılır.
 */
export default function ServerEventsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const events = useServerEvents(serverId);
  const { data: actor } = useMyPermissions(serverId);
  const manager = canManageEvents(actor);
  const interest = useToggleEventInterest(serverId);
  const setStatus = useSetServerEventStatus(serverId);
  const remove = useDeleteServerEvent(serverId);
  const now = useNow(60_000);
  const [menuEvent, setMenuEvent] = useState<ServerEventItem | null>(null);

  const fail = (error: unknown, fallback: string) =>
    showToast(error instanceof ApiError ? error.message : fallback, "error");

  const changeStatus = (event: ServerEventItem, status: ServerEventStatus, done: string) =>
    setStatus.mutate(
      { eventId: event.id, status },
      { onSuccess: () => showToast(done), onError: (error) => fail(error, "Etkinlik güncellenemedi.") }
    );

  const menuItems: ActionSheetItem[] = [];
  if (menuEvent) {
    if (menuEvent.status === "SCHEDULED") {
      menuItems.push({
        key: "start",
        label: "Şimdi başlat",
        detail: "İlgilenenlere bildirim gider",
        icon: "play",
        onPress: () => changeStatus(menuEvent, "ACTIVE", "Etkinlik başladı."),
      });
    }
    menuItems.push(
      {
        key: "end",
        label: "Bitir",
        icon: "check",
        onPress: () => changeStatus(menuEvent, "COMPLETED", "Etkinlik bitti."),
      },
      {
        key: "cancel",
        label: "İptal et",
        icon: "close",
        onPress: () => changeStatus(menuEvent, "CANCELED", "Etkinlik iptal edildi."),
      },
      {
        key: "delete",
        label: "Sil",
        icon: "trash",
        destructive: true,
        onPress: () =>
          showDialog("Etkinlik silinsin mi?", `“${menuEvent.name}” kalıcı olarak silinecek.`, [
            { text: "Vazgeç", style: "cancel" },
            {
              text: "Sil",
              style: "destructive",
              onPress: () => remove.mutate(menuEvent.id, { onError: (error) => fail(error, "Etkinlik silinemedi.") }),
            },
          ]),
      }
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Etkinlikler",
          headerRight: manager
            ? () => (
                <IconButton
                  icon="plus"
                  label="Etkinlik oluştur"
                  background="transparent"
                  tint={colors.bright}
                  onPress={() => router.push(`/servers/${serverId}/events/new`)}
                />
              )
            : undefined,
        }}
      />
      {events.isLoading ? (
        <ListSkeleton rows={4} />
      ) : events.error ? (
        <ErrorState
          message={events.error instanceof ApiError ? events.error.message : "Etkinlikler yüklenemedi."}
          onRetry={() => void events.refetch()}
        />
      ) : (events.data ?? []).length === 0 ? (
        <EmptyState
          icon="clock"
          title="Yaklaşan etkinlik yok"
          description={manager ? "Sağ üstteki + ile bir etkinlik planla." : "Planlanan etkinlikler burada görünür."}
        />
      ) : (
        <FlatList
          data={events.data}
          keyExtractor={(event) => event.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              now={now}
              manager={manager}
              onInterest={() =>
                interest.mutate(
                  { eventId: item.id, interested: !item.interested },
                  { onError: (error) => fail(error, "İşlem tamamlanamadı.") }
                )
              }
              onMenu={() => setMenuEvent(item)}
              onOpenChannel={
                item.channelId ? () => router.push(`/voice/${item.channelId}?serverId=${serverId}`) : undefined
              }
            />
          )}
        />
      )}

      <ActionSheet
        visible={menuEvent !== null}
        onClose={() => setMenuEvent(null)}
        header={
          menuEvent ? (
            <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
              {menuEvent.name}
            </Text>
          ) : undefined
        }
        items={menuItems}
      />
    </Screen>
  );
}

function EventCard({
  event,
  now,
  manager,
  onInterest,
  onMenu,
  onOpenChannel,
}: {
  event: ServerEventItem;
  now: number;
  manager: boolean;
  onInterest: () => void;
  onMenu: () => void;
  onOpenChannel?: () => void;
}) {
  const active = event.status === "ACTIVE";
  const place = event.channelName ?? event.location;
  const repeats = describeRecurrence(event.recurrenceRule);

  return (
    <View
      style={{
        borderRadius: radii.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.bentoBorder,
        backgroundColor: colors.panel,
        overflow: "hidden",
      }}
    >
      {event.coverImageUrl ? (
        <Image source={{ uri: event.coverImageUrl }} style={{ width: "100%", aspectRatio: 16 / 9 }} contentFit="cover" />
      ) : null}
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {active ? (
          <Tag label="ŞİMDİ" tint={colors.onBrand} background={colors.brand} />
        ) : (
          <Text style={{ ...typography.caption, ...fw(700), color: colors.brand, flex: 1 }}>
            {formatDate(event.startsAt)} · {formatTime(event.startsAt)} ({formatEventWhen(event.startsAt, now)})
          </Text>
        )}
        {active ? <View style={{ flex: 1 }} /> : null}
        {manager ? (
          <IconButton icon="more" label="Etkinlik seçenekleri" background="transparent" tint={colors.muted} onPress={onMenu} />
        ) : null}
      </View>

      <Text style={{ ...typography.title, ...fw(800), color: colors.bright }}>{event.name}</Text>
      {event.description ? (
        <Text style={{ ...typography.body, color: colors.text }} numberOfLines={4}>
          {event.description}
        </Text>
      ) : null}

      {place ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Icon name={event.channelName ? "volume" : "link"} size={15} color={colors.muted} />
          <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }} numberOfLines={1}>
            {place}
          </Text>
        </View>
      ) : null}

      {repeats ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Icon name="rotate-ccw" size={15} color={colors.muted} />
          <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }} numberOfLines={1}>
            {repeats}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
        <Icon name="users" size={15} color={colors.muted} />
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>
          {event.interestedCount} kişi ilgileniyor
          {event.creator ? ` · ${event.creator.name?.trim() || event.creator.username}` : ""}
        </Text>
        {active && onOpenChannel ? <Button label="Katıl" icon="volume" onPress={onOpenChannel} /> : null}
        <Button
          label={event.interested ? "İlgileniyorsun" : "İlgileniyorum"}
          icon={event.interested ? "check" : "bell"}
          variant={event.interested ? "secondary" : "primary"}
          onPress={onInterest}
        />
      </View>
      </View>
    </View>
  );
}
