import { router } from "expo-router";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";

import { useCurrentProfile, useDirects } from "@/api/hooks";

export default function DirectsScreen() {
  const { data: me } = useCurrentProfile();
  const { data: directs, isLoading, refetch } = useDirects();

  return (
    <FlatList
      className="flex-1 bg-main-bg"
      data={directs ?? []}
      keyExtractor={(d) => d.id}
      refreshing={isLoading}
      onRefresh={refetch}
      ListEmptyComponent={
        !isLoading ? (
          <Text className="mt-16 text-center text-text-muted">
            Henüz bir görüşme yok.
          </Text>
        ) : null
      }
      renderItem={({ item }) => {
        const other =
          item.profileOne.id === me?.id ? item.profileTwo : item.profileOne;
        return (
          <TouchableOpacity
            className="flex-row items-center gap-3 border-b border-surface px-4 py-3"
            onPress={() => router.push(`/directs/${item.id}`)}
          >
            <Image
              source={{ uri: other.imageUrl ?? undefined }}
              className="h-12 w-12 rounded-full bg-surface"
            />
            <View className="flex-1">
              <Text className="text-base font-semibold text-text-primary">
                {other.name ?? other.username}
              </Text>
              <Text className="text-xs text-text-muted">@{other.username}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}
