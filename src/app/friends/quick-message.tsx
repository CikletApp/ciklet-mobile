import { FlatList, Text, View } from "react-native";
import { router } from "expo-router";

import { useFriends, useOpenDirect } from "@/api/hooks";
import { Avatar, EmptyState, ListSkeleton, Pressable } from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export default function QuickMessageScreen() {
  const { accepted, isLoading } = useFriends();
  const openDirect = useOpenDirect();

  return (
    <View style={{ flex: 1, backgroundColor: colors.panel }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>
          Yalnızca arkadaşların gösterilir. Birine dokununca sohbet doğrudan açılır.
        </Text>
      </View>
      {isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={accepted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xl }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                openDirect.mutate(item.profile.id, {
                  onSuccess: (direct) => router.replace(`/chat/direct/${direct.id}`),
                })
              }
              disabled={openDirect.isPending}
              haptic="light"
              noHitSlop
              accessibilityRole="button"
              accessibilityLabel={`${displayNameOf(item.profile)} ile sohbet aç`}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 60,
                paddingHorizontal: spacing.md,
                borderRadius: radii.lg,
                backgroundColor: pressed ? colors.raised : colors.panel,
                opacity: openDirect.isPending ? 0.65 : 1,
              })}
            >
              <Avatar
                profileId={item.profile.id}
                imageUrl={item.profile.imageUrl}
                fallbackText={item.profile.username}
                size={42}
                showPresence
              />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                  {displayNameOf(item.profile)}
                </Text>
                <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                  @{item.profile.username}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title="Mesaj gönderecek arkadaş yok"
              description="Önce bir arkadaş ekleyip isteğinin kabul edilmesini bekle."
            />
          }
        />
      )}
    </View>
  );
}
