import { Stack, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { useChatSocket } from "@/features/chat/hooks/use-chat-socket";

/**
 * DM ekranı — ilk iterasyonda iskelet. Kanal sohbetiyle aynı deseni izler;
 * /api/direct-messages sayfalaması ve gönderim ucu bir sonraki iterasyonda
 * features/chat üzerinden ortaklaştırılacak.
 */
export default function DirectChatScreen() {
  const { directId } = useLocalSearchParams<{ directId: string }>();
  useChatSocket(directId);

  return (
    <View className="flex-1 items-center justify-center bg-main-bg">
      <Stack.Screen options={{ title: "Direkt Mesaj" }} />
      <Text className="text-text-muted">DM görünümü yakında.</Text>
    </View>
  );
}
