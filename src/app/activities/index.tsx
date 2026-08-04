import { FlatList, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { useActivities } from "@/api/hooks";
import {
  Avatar,
  EmptyState,
  ListSkeleton,
  ListRow,
  Screen,
  Tag,
} from "@/components/ui";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Aktivite seçici.
 *
 * Aktiviteler üçüncü taraf uygulamalardır ve Ciklet KODLARINI BARINDIRMAZ;
 * her biri kendi sunucusunda çalışır ve gömülü bir görünümde yüklenir.
 * Liste yalnızca root incelemesinden geçmiş (`reviewStatus: APPROVED`)
 * uygulamaları içerir — bu filtre sunucu tarafındadır.
 */
export default function ActivitiesScreen() {
  const { chatId, serverId } = useLocalSearchParams<{
    chatId?: string;
    serverId?: string;
  }>();
  const { data: activities, isLoading } = useActivities();

  return (
    <Screen>
      <Stack.Screen options={{ title: "Aktiviteler" }} />

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : (activities?.length ?? 0) === 0 ? (
        <EmptyState
          icon="compass"
          title="Aktivite yok"
          description="Şu anda kullanılabilir bir aktivite bulunmuyor."
        />
      ) : (
        <FlatList
          data={activities ?? []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <Text
              style={{
                ...typography.caption,
                color: colors.muted,
                padding: spacing.lg,
              }}
            >
              Aktiviteler üçüncü taraf uygulamalardır ve kendi sunucularında
              çalışır. Bir aktiviteye girdiğinde adın ve avatarın uygulamayla
              paylaşılır.
            </Text>
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={item.description}
              leading={
                <Avatar
                  imageUrl={item.icon}
                  fallbackText={item.name}
                  size={44}
                  shape="squircle"
                />
              }
              trailing={
                item.isVerified ? (
                  <Tag label="DOĞRULANMIŞ" tint={colors.onBrand} background={colors.brand} />
                ) : undefined
              }
              onPress={() =>
                router.push(
                  `/activities/${item.id}?chatId=${chatId ?? ""}&serverId=${serverId ?? ""}`
                )
              }
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 76 }} />
          )}
        />
      )}
    </Screen>
  );
}
