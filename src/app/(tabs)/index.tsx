import { useCallback } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { DirectWithProfiles } from "@ciklet/embedded-activities-sdk/types";

import { displayName, useDirects, useServers } from "@/api/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Screen } from "@/components/ui/screen";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Ana Sayfa — solda sunucu rayı, sağda doğrudan mesajlar.
 *
 * Faz 1'de yerleşim ve veri akışı kurulur; kaydırma davranışı, okunmamış
 * rozetleri, son mesaj önizlemesi ve klasörler Faz 2'de gelir.
 */
export default function HomeScreen() {
  const { data: servers } = useServers();
  const { data: directs, isLoading, refetch, isRefetching } = useDirects();
  const myId = useAuth((s) => s.profile?.id);

  const renderDirect = useCallback(
    ({ item }: { item: DirectWithProfiles }) => {
      const peer = item.profileOne.id === myId ? item.profileTwo : item.profileOne;
      return (
        <Pressable
          onPress={() => router.push(`/chat/direct/${item.id}`)}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radii.md,
            },
            pressed && { backgroundColor: colors.panel },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${displayName(peer)} ile sohbet`}
        >
          <Avatar
            profileId={peer.id}
            imageUrl={peer.imageUrl}
            fallbackText={peer.username}
            size={44}
            showPresence
          />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
              {displayName(peer)}
            </Text>
            <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
              @{peer.username}
            </Text>
          </View>
        </Pressable>
      );
    },
    [myId]
  );

  return (
    <Screen edges={["top", "left", "right"]}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* ── Sunucu rayı ────────────────────────────────────────── */}
        <View
          style={{
            width: 72,
            backgroundColor: colors.deep,
            alignItems: "center",
            paddingVertical: spacing.md,
            gap: spacing.sm,
          }}
        >
          <RailButton
            active
            onPress={() => {}}
            accessibilityLabel="Doğrudan mesajlar"
          >
            <Icon name="message" size={22} color={colors.onBrand} />
          </RailButton>

          <View
            style={{
              width: 28,
              height: 2,
              borderRadius: 1,
              backgroundColor: colors.border,
              marginVertical: spacing.xs,
            }}
          />

          <FlatList
            data={servers ?? []}
            keyExtractor={(s) => s.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/servers/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name} sunucusu`}
              >
                <Avatar
                  imageUrl={item.imageUrl}
                  fallbackText={item.name}
                  size={48}
                  shape="squircle"
                  backgroundColor={colors.deep}
                />
              </Pressable>
            )}
            ListFooterComponent={
              <RailButton
                onPress={() => router.push("/friends/add")}
                accessibilityLabel="Sunucu ekle"
              >
                <Icon name="plus" size={22} color={colors.brand} />
              </RailButton>
            }
          />
        </View>

        {/* ── Doğrudan mesajlar ──────────────────────────────────── */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <Text style={{ ...typography.display, color: colors.bright, flex: 1 }}>
              Mesajlar
            </Text>
            <Pressable
              onPress={() => router.push("/search")}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Ara"
            >
              <Icon name="search" size={22} color={colors.muted} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/friends")}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Arkadaşlar"
            >
              <Icon name="users" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <FlatList
            data={directs ?? []}
            keyExtractor={(d) => d.id}
            renderItem={renderDirect}
            refreshing={isRefetching}
            onRefresh={refetch}
            contentContainerStyle={
              (directs?.length ?? 0) === 0 ? { flex: 1 } : { paddingBottom: spacing["3xl"] }
            }
            ListEmptyComponent={
              isLoading ? null : (
                <EmptyState
                  icon="message"
                  title="Henüz sohbet yok"
                  description="Bir arkadaş ekleyip ilk mesajını gönder."
                />
              )
            }
          />
        </View>
      </View>
    </Screen>
  );
}

/** Rayda dairesel eylem düğmesi. */
function RailButton({
  children,
  onPress,
  active,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: active ? radii.lg : radii.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.brand : colors.panel,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
