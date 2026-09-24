import { useState } from "react";
import { View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { useDirect, useDirectDisplay } from "@/api/hooks";
import { Avatar, DropdownMenu, Icon, IconButton, type MenuItem } from "@/components/ui";
import { ChatView } from "@/features/chat/chat-view";
import { ChatHeaderTitle } from "@/features/chat/components/chat-header-title";
import { DirectExpirySheet } from "@/features/chat/components/direct-expiry-button";
import { formatActivity, formatPresenceStatus } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { useCallActions } from "@/realtime/use-call-events";
import { typingLabel, useTyping } from "@/realtime/use-typing";
import { usePresence } from "@/stores/presence";
import { colors, radii, spacing } from "@/theme/tokens";

/**
 * Doğrudan mesaj sohbeti — birebir, grup ve "Notlarım".
 *
 * Üç durumun başlığı ve sağ üst eylemleri farklı, gövdesi (`ChatView`) aynı.
 * Ayrımı `useDirectDisplay` yapıyor; ekran profil alanlarını kendisi
 * yorumlamıyor — grup satırlarında o alanlar anlamsız (bkz. `DirectSummary`).
 *
 * Başlık: solda avatar + ad + canlı alt satır, sağda arama düğmeleri ve
 * seyrek kullanılan eylemlerin menüsü (sohbette ara, süreli mesajlar).
 */
export default function DirectChatScreen() {
  const { directId } = useLocalSearchParams<{ directId: string }>();
  const { data: direct } = useDirect(directId);
  const display = useDirectDisplay(direct);
  const { placeCall } = useCallActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);

  const isGroup = display?.isGroup ?? false;
  const isNotes = display?.isSelf ?? false;
  const peer = display?.peer;
  const isOfficial = isOfficialProfile(peer);
  const presence = usePresence(!isGroup && !isNotes ? peer?.id : undefined);
  // Yalnızca dinler; yazma bildirimi ChatView'daki örnekten gider.
  const { typers } = useTyping(directId);

  /**
   * Arama birebir sohbete özgü: kendine aramak anlamsız, resmî hesap bir
   * sistem hesabı, grup araması için de sunucuda bir akış yok (LiveKit
   * odaları kanal/DM başına açılıyor).
   */
  const canCall = Boolean(peer) && !isGroup && !isNotes && !isOfficial;
  const canExpire = !isGroup && !isNotes && !isOfficial;

  const typing = typers.length > 0 ? (isGroup ? typingLabel(typers) : "yazıyor…") : null;
  const activity = formatActivity(presence.activity);
  const subtitle = isNotes
    ? "Kendine notlar"
    : typing
      ? typing
      : isGroup
        ? display?.members
            .map((member) => member.name?.trim() || member.username)
            .join(", ")
        : isOfficial
          ? "Resmî hesap"
          : activity ?? formatPresenceStatus(presence.status);

  const openDetails = () => {
    if (isGroup) router.push(`/directs/${directId}/info`);
    else if (peer && !isNotes) router.push(`/profile/${peer.id}`);
  };

  const menu: MenuItem[] = [
    { label: "Sohbette ara", icon: "search", onPress: () => router.push("/search") },
    ...(canExpire ? [{ label: "Süreli mesajlar", icon: "timer" as const, onPress: () => setExpiryOpen(true) }] : []),
    ...(isGroup
      ? [{ label: "Grup bilgisi", icon: "users" as const, onPress: openDetails }]
      : peer && !isNotes
        ? [{ label: "Profili görüntüle", icon: "user" as const, onPress: openDetails }]
        : []),
  ];

  const avatar = isNotes ? (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.brandSoft,
      }}
    >
      <Icon name="bookmark" size={18} color={colors.brand} />
    </View>
  ) : isGroup && !display?.imageUrl ? (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.brandSoft,
      }}
    >
      <Icon name="users" size={19} color={colors.brand} />
    </View>
  ) : (
    <Avatar
      profileId={isGroup ? undefined : peer?.id}
      imageUrl={display?.imageUrl}
      fallbackText={display?.fallbackText}
      size={38}
      radius={isGroup ? radii.md : undefined}
      showPresence={!isGroup && !isOfficial}
      backgroundColor={colors.panel}
    />
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: display?.title ?? "",
          headerStyle: { backgroundColor: colors.panel },
          headerTitleAlign: "left",
          headerTitle: () => (
            <ChatHeaderTitle
              avatar={avatar}
              title={display?.title ?? ""}
              subtitle={subtitle}
              subtitleTone={typing || activity ? "live" : "muted"}
              onPress={isNotes ? undefined : openDetails}
              accessibilityLabel={isGroup ? "Grup bilgisi" : "Profili görüntüle"}
            />
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              {canCall && peer ? (
                <>
                  <IconButton
                    icon="video"
                    label="Görüntülü ara"
                    background="transparent"
                    tint={colors.bright}
                    haptic="medium"
                    onPress={() => placeCall(peer, directId, "video")}
                  />
                  <IconButton
                    icon="phone"
                    label="Sesli ara"
                    background="transparent"
                    tint={colors.bright}
                    haptic="medium"
                    onPress={() => placeCall(peer, directId, "audio")}
                  />
                </>
              ) : null}
              <IconButton
                icon="more"
                label="Diğer seçenekler"
                background="transparent"
                tint={colors.bright}
                onPress={() => setMenuOpen(true)}
              />
            </View>
          ),
        }}
      />
      <DropdownMenu visible={menuOpen} onClose={() => setMenuOpen(false)} items={menu} side="right" />
      {canExpire ? (
        <DirectExpirySheet directId={directId} visible={expiryOpen} onClose={() => setExpiryOpen(false)} />
      ) : null}
      <ChatView
        kind="direct"
        chatId={directId}
        readOnlyOfficial={isOfficial}
        oneToOne={!isGroup}
        placeholder={
          isNotes ? "Kendine bir not yaz" : isGroup ? `${display?.title ?? "Gruba"} grubuna yaz` : "Mesaj yaz"
        }
      />
    </>
  );
}
