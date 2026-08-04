import { View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { useChannel } from "@/api/hooks";
import { IconButton } from "@/components/ui";
import { ChatView } from "@/features/chat/chat-view";
import { colors, spacing } from "@/theme/tokens";

/**
 * Kanal sohbeti. `serverId` sorgu parametresi olarak taşınır: mesaj
 * gönderim ucu (`/api/socket/messages`) hem kanal hem sunucu kimliği ister.
 */
export default function ChannelChatScreen() {
  const { channelId, serverId } = useLocalSearchParams<{
    channelId: string;
    serverId?: string;
  }>();

  const channel = useChannel(serverId, channelId);

  return (
    <>
      <Stack.Screen
        options={{
          title: channel ? `# ${channel.name}` : "",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <IconButton
                icon="search"
                label="Sohbette ara"
                background="transparent"
                tint={colors.muted}
                onPress={() => router.push("/search")}
              />
              <IconButton
                icon="compass"
                label="Aktiviteler"
                background="transparent"
                tint={colors.muted}
                onPress={() =>
                  router.push(
                    `/activities?chatId=${channelId}&serverId=${serverId ?? ""}`
                  )
                }
              />
            </View>
          ),
        }}
      />
      <ChatView
        kind="channel"
        chatId={channelId}
        serverId={serverId}
        placeholder={`#${channel?.name ?? "kanal"} kanalına yaz`}
      />
    </>
  );
}
