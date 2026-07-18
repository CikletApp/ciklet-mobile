import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useMessages, useSendMessage, useServers } from "@/api/hooks";
import { MessageItem } from "@/features/chat/components/message-item";
import { useChatSocket } from "@/features/chat/hooks/use-chat-socket";
import { colors } from "@/theme/colors";

export default function ChannelChatScreen() {
  const { serverId, channelId } = useLocalSearchParams<{
    serverId: string;
    channelId: string;
  }>();

  const { data: servers } = useServers();
  const channel = servers
    ?.find((s) => s.id === serverId)
    ?.channels.find((c) => c.id === channelId);

  const { data, isLoading, fetchNextPage, hasNextPage } = useMessages(channelId);
  const sendMessage = useSendMessage(channelId, serverId);
  useChatSocket(channelId);

  const [draft, setDraft] = useState("");
  const messages = data?.pages.flatMap((p) => p.items) ?? [];

  const onSend = () => {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    sendMessage.mutate(content);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-main-bg"
    >
      <Stack.Screen options={{ title: `# ${channel?.name ?? ""}` }} />

      {isLoading ? (
        <ActivityIndicator className="flex-1" color={colors.brand} />
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageItem message={item} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
        />
      )}

      <View className="flex-row items-center gap-2 border-t border-surface bg-surface px-3 py-2">
        <TextInput
          className="flex-1 rounded-full bg-surface-2 px-4 py-2 text-text-primary"
          placeholder={`#${channel?.name ?? "kanal"} kanalına mesaj yaz`}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={onSend}
          multiline
        />
        <TouchableOpacity
          className="rounded-full bg-brand px-4 py-2"
          onPress={onSend}
        >
          <Text className="font-semibold text-main-bg">Gönder</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
