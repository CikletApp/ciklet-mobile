import { router, useLocalSearchParams } from "expo-router";
import { FlatList, Text, TouchableOpacity } from "react-native";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { useServers } from "@/api/hooks";

const typeIcon: Record<string, string> = {
  [ChannelType.TEXT]: "#",
  [ChannelType.AUDIO]: "🔊",
  [ChannelType.VIDEO]: "🎥",
};

export default function ChannelListScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: servers } = useServers();
  const server = servers?.find((s) => s.id === serverId);

  return (
    <FlatList
      className="flex-1 bg-main-bg"
      data={server?.channels ?? []}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          className="flex-row items-center gap-2 px-4 py-3"
          onPress={() => router.push(`/servers/${serverId}/${item.id}`)}
        >
          <Text className="w-6 text-center text-text-muted">
            {typeIcon[item.type] ?? "#"}
          </Text>
          <Text className="text-base text-text-primary">{item.name}</Text>
        </TouchableOpacity>
      )}
    />
  );
}
