import { Stack, useLocalSearchParams } from "expo-router";

import { useChannel } from "@/api/hooks";
import { ChatView } from "@/features/chat/chat-view";

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
      <Stack.Screen options={{ title: channel ? `# ${channel.name}` : "" }} />
      <ChatView
        kind="channel"
        chatId={channelId}
        serverId={serverId}
        placeholder={`#${channel?.name ?? "kanal"} kanalına yaz`}
      />
    </>
  );
}
