import { router } from "expo-router";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";

import { useServers } from "@/api/hooks";

export default function ServersScreen() {
  const { data: servers, isLoading, refetch } = useServers();

  return (
    <FlatList
      className="flex-1 bg-main-bg"
      data={servers ?? []}
      keyExtractor={(s) => s.id}
      refreshing={isLoading}
      onRefresh={refetch}
      ListEmptyComponent={
        !isLoading ? (
          <Text className="mt-16 text-center text-text-muted">
            Henüz bir sunucuya katılmadın.
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          className="flex-row items-center gap-3 border-b border-surface px-4 py-3"
          onPress={() => router.push(`/servers/${item.id}`)}
        >
          <Image
            source={{ uri: item.imageUrl }}
            className="h-12 w-12 rounded-2xl bg-surface"
          />
          <View className="flex-1">
            <Text className="text-base font-semibold text-text-primary">
              {item.name}
            </Text>
            <Text className="text-xs text-text-muted">
              {item.members?.length ?? 0} üye
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
