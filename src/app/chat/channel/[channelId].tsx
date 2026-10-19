import { View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { useChannel, useServerSummary, useUnreadCounts } from "@/api/hooks";
import { Icon, IconButton } from "@/components/ui";
import { ChatView } from "@/features/chat/chat-view";
import { ChatHeaderTitle } from "@/features/chat/components/chat-header-title";
import { typingLabel, useTyping } from "@/realtime/use-typing";
import { colors, radii, spacing } from "@/theme/tokens";

/**
 * Kanal sohbeti. `serverId` sorgu parametresi olarak taşınır: mesaj
 * gönderim ucu (`/api/socket/messages`) hem kanal hem sunucu kimliği ister.
 */
export default function ChannelChatScreen() {
  const { channelId, serverId, name: threadName } = useLocalSearchParams<{
    channelId: string;
    serverId?: string;
    /** Alt başlık bağlantısından: alt başlıklar kanal listesinde yok, ad buradan gelir. */
    name?: string;
  }>();

  const channel = useChannel(serverId, channelId);
  const channelName = channel?.name ?? threadName;
  const { data: server } = useServerSummary(serverId);
  // "Yeni mesajlar" ayracı: kanalda imleç yerine okunmamış SAYISI var.
  const unreadCounts = useUnreadCounts();

  // Kanal ayarlarındaki açıklama (2026-09 web güncellemesi). SDK'nın Channel
  // tipi henüz taşımıyor; uç Prisma satırını olduğu gibi döndürdüğü için
  // alan yanıtta var.
  const topic = (channel as { topic?: string | null } | undefined)?.topic?.trim();
  // Yalnızca dinler; yazma bildirimi ChatView'daki örnekten gider.
  const { typers } = useTyping(channelId);
  const typing = typingLabel(typers, { ellipsis: false });

  return (
    <>
      <Stack.Screen
        options={{
          title: channelName ? `# ${channelName}` : "",
          headerStyle: { backgroundColor: colors.panel },
          headerTitleAlign: "left",
          headerTitle: () => (
            <ChatHeaderTitle
              avatar={
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: radii.md,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.brandSoft,
                  }}
                >
                  <Icon name="hash" size={19} color={colors.brand} />
                </View>
              }
              title={channelName ?? ""}
              subtitle={typing ?? (topic || server?.name)}
              subtitleTone={typing ? "live" : "muted"}
              typing={Boolean(typing)}
              onPress={serverId ? () => router.back() : undefined}
              accessibilityLabel={server ? `${server.name} kanal listesine dön` : undefined}
            />
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <IconButton
                icon="search"
                label="Sohbette ara"
                background="transparent"
                tint={colors.bright}
                onPress={() => router.push("/search")}
              />
              <IconButton
                icon="compass"
                label="Aktiviteler"
                background="transparent"
                tint={colors.bright}
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
        unreadSeed={unreadCounts.data ? { count: unreadCounts.data.channelUnreads?.[channelId]?.count ?? 0 } : undefined}
        placeholder={`#${channelName ?? "kanal"} kanalına yaz`}
        canStartThread={
          channel?.type === ChannelType.TEXT &&
          !(channel as { parentChannelId?: string | null }).parentChannelId &&
          !(channel as { forum?: boolean }).forum
        }
        lockedNotice={
          (channel as { forum?: boolean } | undefined)?.forum
            ? "Forum kanalı: gönderiler şimdilik web ve masaüstünde açılır."
            : undefined
        }
      />
    </>
  );
}
