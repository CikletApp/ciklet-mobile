import { FlatList, RefreshControl, Text, View } from "react-native";
import { router, Stack } from "expo-router";

import { ApiError } from "@/api/client";
import { useMessageRequests, useRespondMessageRequest } from "@/api/hooks";
import type { MessageRequestEntry } from "@/api/types";
import {
  Avatar,
  EmptyState,
  IconButton,
  ListSkeleton,
  Pressable,
  Screen,
  showDialog,
  showToast,
} from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { usePullRefresh } from "@/lib/use-pull-refresh";

/**
 * Mesaj İstekleri (web `/requests`) — arkadaş listende olmayanlardan gelen
 * DM'ler (Gizlilik → spam filtresi kuralına göre). Kabul edene kadar
 * bildirim gelmez.
 *  - Kabul  → sohbet gelen kutusuna normal DM olarak döner ve açılır.
 *  - Yok say → listeden düşer; karşı taraf yazabilir ama bildirim gelmez.
 *  - Engelle → mevcut engelleme ucu + istek yok sayılır.
 */
export default function MessageRequestsScreen() {
  const requests = useMessageRequests();
  const pull = usePullRefresh(requests.refetch);
  const respond = useRespondMessageRequest();

  const act = (entry: MessageRequestEntry, action: "accept" | "ignore" | "block") =>
    respond.mutate(
      { entry, action },
      {
        onSuccess: () => {
          showToast(action === "accept" ? "İstek kabul edildi." : action === "ignore" ? "İstek yok sayıldı." : "Kullanıcı engellendi.");
          if (action === "accept") router.replace(`/chat/direct/${entry.directId}`);
        },
        onError: (error) => showToast(error instanceof ApiError ? error.message : "İşlem başarısız.", "error"),
      }
    );

  const confirmBlock = (entry: MessageRequestEntry) =>
    showDialog("Engelle", `${displayNameOf(entry.other)} engellenecek ve isteği kaldırılacak.`, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Engelle", style: "destructive", onPress: () => act(entry, "block") },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Mesaj İstekleri" }} />
      {requests.isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={requests.data ?? []}
          keyExtractor={(entry) => entry.directId}
          contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.brand} />}
          ListHeaderComponent={
            <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs }}>
              Arkadaş listende olmayan kişilerden gelen mesajlar. Kabul edene kadar bildirim almazsın; kuralı Gizlilik ayarlarından değiştirebilirsin.
            </Text>
          }
          ListEmptyComponent={
            <View style={{ flex: 1, paddingTop: spacing["2xl"] }}>
              <EmptyState icon="message" title="Bekleyen istek yok" description="Tanımadığın biri yazdığında burada görünür." />
            </View>
          }
          renderItem={({ item }) => {
            const busy = respond.isPending && respond.variables?.entry.directId === item.directId;
            return (
              <View
                style={{
                  marginHorizontal: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: colors.panel,
                  opacity: busy ? 0.5 : 1,
                }}
                pointerEvents={busy ? "none" : "auto"}
              >
                <Pressable
                  onPress={() => router.push(`/chat/direct/${item.directId}`)}
                  noHitSlop
                  accessibilityRole="button"
                  accessibilityLabel={`${displayNameOf(item.other)}, ${item.count} okunmamış mesaj. Sohbeti aç`}
                  style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.md }}
                >
                  <Avatar profileId={item.other.id} imageUrl={item.other.imageUrl} fallbackText={item.other.username} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                      {displayNameOf(item.other)}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                      @{item.other.username} · {item.count} okunmamış
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => act(item, "accept")}
                  haptic="success"
                  accessibilityRole="button"
                  accessibilityLabel="Kabul et"
                  style={({ pressed }) => ({
                    minHeight: 36,
                    justifyContent: "center",
                    paddingHorizontal: spacing.md,
                    borderRadius: radii.full,
                    backgroundColor: colors.brand,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ ...typography.caption, ...fw(700), color: colors.onBrand }}>Kabul</Text>
                </Pressable>
                <IconButton icon="close" label="Yok say" tint={colors.muted} onPress={() => act(item, "ignore")} />
                <IconButton icon="flag" label="Engelle" tint={colors.danger} onPress={() => confirmBlock(item)} haptic="warning" />
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
