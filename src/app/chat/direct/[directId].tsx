import { View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { useDirect, useDirectPeer } from "@/api/hooks";
import { Avatar, IconButton, Pressable } from "@/components/ui";
import { ChatView } from "@/features/chat/chat-view";
import { displayNameOf } from "@/lib/format";
import { colors, spacing } from "@/theme/tokens";

/** Doğrudan mesaj sohbeti (1:1). */
export default function DirectChatScreen() {
  const { directId } = useLocalSearchParams<{ directId: string }>();
  const { data: direct } = useDirect(directId);
  const peer = useDirectPeer(direct);

  return (
    <>
      <Stack.Screen
        options={{
          title: peer ? displayNameOf(peer) : "",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <IconButton
                icon="search"
                label="Sohbette ara"
                background="transparent"
                tint={colors.muted}
                onPress={() => router.push("/search")}
              />
              {peer ? (
                <Pressable
                  onPress={() => router.push(`/profile/${peer.id}`)}
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
              ) : null}
            </View>
          ),
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
