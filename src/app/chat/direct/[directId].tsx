import { View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { useDirect, useDirectDisplay } from "@/api/hooks";
import { Avatar, Icon, IconButton, Pressable } from "@/components/ui";
import { ChatView } from "@/features/chat/chat-view";
import { DirectExpiryButton } from "@/features/chat/components/direct-expiry-button";
import { isOfficialProfile } from "@/lib/official";
import { useCallActions } from "@/realtime/use-call-events";
import { colors, radii, spacing } from "@/theme/tokens";

/**
 * Doğrudan mesaj sohbeti — birebir, grup ve "Notlarım".
 *
 * Üç durumun başlığı ve sağ üst eylemleri farklı, gövdesi (`ChatView`) aynı.
 * Ayrımı `useDirectDisplay` yapıyor; ekran profil alanlarını kendisi
 * yorumlamıyor — grup satırlarında o alanlar anlamsız (bkz. `DirectSummary`).
 */
export default function DirectChatScreen() {
  const { directId } = useLocalSearchParams<{ directId: string }>();
  const { data: direct } = useDirect(directId);
  const display = useDirectDisplay(direct);
  const { placeCall } = useCallActions();

  const isGroup = display?.isGroup ?? false;
  const isNotes = display?.isSelf ?? false;
  const peer = display?.peer;
  const isOfficial = isOfficialProfile(peer);

  /**
   * Arama birebir sohbete özgü: kendine aramak anlamsız, resmî hesap bir
   * sistem hesabı, grup araması için de sunucuda bir akış yok (LiveKit
   * odaları kanal/DM başına açılıyor).
   */
  const canCall = Boolean(peer) && !isGroup && !isNotes && !isOfficial;

  return (
    <>
      <Stack.Screen
        options={{
          title: display?.title ?? "",
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
              {/* Süreli mesaj ayarı birebir sohbetin özelliği. */}
              {!isGroup && !isNotes && !isOfficial ? (
                <DirectExpiryButton directId={directId} />
              ) : null}
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
              ) : isGroup ? (
                <Pressable
                  onPress={() => router.push(`/directs/${directId}/info`)}
                  accessibilityRole="button"
                  accessibilityLabel="Grup bilgisi"
                >
                  <Avatar
                    imageUrl={display?.imageUrl}
                    fallbackText={display?.fallbackText}
                    size={30}
                    radius={radii.sm}
                    backgroundColor={colors.bg}
                  />
                </Pressable>
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
            : isGroup
              ? `${display?.title} grubuna yaz`
              : peer
                ? `@${peer.username} kullanıcısına yaz`
                : "Mesaj yaz"
        }
      />
    </>
  );
}
