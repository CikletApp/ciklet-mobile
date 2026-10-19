import { View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { useChannel, useMyMembership, useServerSummary, useUnreadCounts } from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import { Icon, IconButton } from "@/components/ui";
import { ChatView } from "@/features/chat/chat-view";
import { ChatHeaderTitle } from "@/features/chat/components/chat-header-title";
import {
  NsfwCurtain,
  RulesCurtain,
  useNsfwAcknowledged,
  useTimeoutNotice,
} from "@/features/server/channel-gates";
import { typingLabel, useTyping } from "@/realtime/use-typing";
import { colors, radii, spacing } from "@/theme/tokens";

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
  const { data: server } = useServerSummary(serverId);
  // "Yeni mesajlar" ayracı: kanalda imleç yerine okunmamış SAYISI var.
  const unreadCounts = useUnreadCounts();

  // Kanal ayarlarındaki açıklama (2026-09 web güncellemesi). SDK'nın Channel
  // tipi henüz taşımıyor; uç Prisma satırını olduğu gibi döndürdüğü için
  // alan yanıtta var.
  const extras = channel as ChannelExtras | undefined;
  const topic = extras?.topic?.trim();
  // Kapılar: yaş sınırı perdesi, kural kabulü, kendi zaman aşımın.
  const nsfw = useNsfwAcknowledged(channelId, extras?.nsfw === true);
  const { data: membership } = useMyMembership(serverId);
  const timeoutNotice = useTimeoutNotice(
    (membership as { timedOutUntil?: string | null } | undefined)?.timedOutUntil
  );
  // Yalnızca dinler; yazma bildirimi ChatView'daki örnekten gider.
  const { typers } = useTyping(channelId);
  const typing = typingLabel(typers, { ellipsis: false });

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: channel ? `# ${channel.name}` : "",
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
              title={channel?.name ?? ""}
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
                label="Sunucuda ara"
                background="transparent"
                tint={colors.bright}
                onPress={() =>
                  serverId
                    ? router.push(`/servers/${serverId}/search?channel=${channelId}`)
                    : router.push("/search")
                }
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
        placeholder={`#${channel?.name ?? "kanal"} kanalına yaz`}
        lockedNotice={
          extras?.forum
            ? "Forum kanalı: gönderiler şimdilik web ve masaüstünde açılır."
            : timeoutNotice
        }
      />
      {serverId ? <RulesCurtain serverId={serverId} /> : null}
      {!nsfw.acknowledged ? (
        <NsfwCurtain channelName={channel?.name ?? "kanal"} onAccept={nsfw.acknowledge} onBack={() => router.back()} />
      ) : null}
    </View>
  );
}
