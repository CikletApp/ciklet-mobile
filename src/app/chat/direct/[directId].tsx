import { Pressable } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { displayName, useDirect, useDirectPeer } from "@/api/hooks";
import { Avatar } from "@/components/ui/avatar";
import { ChatView } from "@/features/chat/chat-view";
import { colors } from "@/theme/tokens";

/** Doğrudan mesaj sohbeti (1:1). */
export default function DirectChatScreen() {
  const { directId } = useLocalSearchParams<{ directId: string }>();
  const { data: direct } = useDirect(directId);
  const peer = useDirectPeer(direct);

  return (
    <>
      <Stack.Screen
        options={{
          title: peer ? displayName(peer) : "",
          headerRight: () =>
            peer ? (
              <Pressable
                onPress={() => router.push(`/profile/${peer.id}`)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Profili görüntüle"
              >
                <Avatar
                  profileId={peer.id}
                  imageUrl={peer.imageUrl}
                  fallbackText={peer.username}
                  size={30}
                  showPresence
                  backgroundColor={colors.bg}
                />
              </Pressable>
            ) : null,
        }}
      />
      <ChatView
        kind="direct"
        chatId={directId}
        placeholder={peer ? `@${peer.username} kullanıcısına yaz` : "Mesaj yaz"}
      />
    </>
  );
}
