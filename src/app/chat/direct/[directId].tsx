import { View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { isSelfDirect, useDirect, useDirectPeer } from "@/api/hooks";
import { Avatar, Icon, IconButton, Pressable } from "@/components/ui";
import { ChatView } from "@/features/chat/chat-view";
import { DirectExpiryButton } from "@/features/chat/components/direct-expiry-button";
import { displayNameOf } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { useCallActions } from "@/realtime/use-call-events";
import { colors, radii, spacing } from "@/theme/tokens";

/**
 * Doğrudan mesaj sohbeti (1:1).
 *
 * Kendinle açılmış sohbet "Notlarım"dır — web'de de böyle adlandırılıyor
 * (chat-header.tsx). Karşı taraf sen olduğun için başlıkta kullanıcı adı
 * yerine bu etiket ve bir yer imi ikonu gösterilir.
 */
export default function DirectChatScreen() {
  const { directId } = useLocalSearchParams<{ directId: string }>();
  const { data: direct } = useDirect(directId);
  const peer = useDirectPeer(direct);

  const isNotes = direct ? isSelfDirect(direct) : false;
  const isOfficial = isOfficialProfile(peer);
  const { placeCall } = useCallActions();

  // Kendine arama anlamsız; not sohbetinde arama düğmeleri gizlenir.
  const canCall = Boolean(peer) && !isNotes && !isOfficial;

  return (
    <>
      <Stack.Screen
        options={{
          title: isNotes ? "Notlarım" : peer ? displayNameOf(peer) : "",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              {canCall && peer ? (
                <>
                  <IconButton
                    icon="phone"
                    label="Sesli ara"
                    background="transparent"
                    tint={colors.muted}
                    haptic="medium"
                    onPress={() => placeCall(peer, directId, "audio")}
                  />
                  <IconButton
                    icon="video"
                    label="Görüntülü ara"
                    background="transparent"
                    tint={colors.muted}
                    haptic="medium"
                    onPress={() => placeCall(peer, directId, "video")}
                  />
                </>
              ) : null}
              {!isNotes && !isOfficial ? <DirectExpiryButton directId={directId} /> : null}
              <IconButton
                icon="search"
                label="Sohbette ara"
                background="transparent"
                tint={colors.muted}
                onPress={() => router.push("/search")}
              />
              {isNotes ? (
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: radii.full,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.panel,
                  }}
                >
                  <Icon name="bookmark" size={16} color={colors.brand} />
                </View>
              ) : peer ? (
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
                    showPresence={!isOfficial}
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
        readOnlyOfficial={isOfficial}
        placeholder={
          isNotes
            ? "Kendine bir not yaz"
            : peer
              ? `@${peer.username} kullanıcısına yaz`
              : "Mesaj yaz"
        }
      />
    </>
  );
}
