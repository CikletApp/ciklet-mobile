import { Pressable, SectionList, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ChannelType,
  MemberRole,
  type Channel,
} from "@ciklet/embedded-activities-sdk/types";

import { useMyMembership, useServerChannels, useServerSummary } from "@/api/hooks";
import { Icon, IconButton, type IconName } from "@/components/ui";
import { EmptyState, ListSkeleton, Screen } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucunun kanal listesi.
 *
 * Kanallar `GET /api/channels?serverId=` ucundan gelir; sunucu listesi
 * ucu (members/mine) kanal taşımaz.
 */
export default function ServerChannelsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: server } = useServerSummary(serverId);
  const { data: channels, isLoading } = useServerChannels(serverId);
  const { data: membership } = useMyMembership(serverId);
  const canManageChannels =
    membership?.role === MemberRole.ADMIN || membership?.role === MemberRole.MODERATOR;

  const sections = buildSections(channels ?? []);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: server?.name ?? "",
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              {canManageChannels ? (
                <IconButton
                  icon="plus"
                  label="Kanal oluştur"
                  background="transparent"
                  tint={colors.muted}
                  onPress={() => router.push(`/servers/${serverId}/channels/new`)}
                />
              ) : null}
              <IconButton
                icon="settings"
                label="Sunucu ayarları"
                background="transparent"
                tint={colors.muted}
                onPress={() => router.push(`/servers/${serverId}/settings`)}
              />
            </View>
          ),
        }}
      />

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="hash"
          title="Kanal yok"
          description="Bu sunucuda henüz kanal açılmamış."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                ...typography.overline,
                color: colors.muted,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.sm,
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <ChannelRow
              serverId={serverId}
              channel={item}
              canManage={canManageChannels}
            />
          )}
        />
      )}
    </Screen>
  );
}

const CHANNEL_ICON: Record<string, IconName> = {
  [ChannelType.TEXT]: "hash",
  [ChannelType.AUDIO]: "volume",
  [ChannelType.VIDEO]: "video",
};

function ChannelRow({ serverId, channel, canManage }: { serverId: string; channel: Channel; canManage: boolean }) {
  const isText = channel.type === ChannelType.TEXT;
  const isAudio = channel.type === ChannelType.AUDIO;
  const isVideo = channel.type === ChannelType.VIDEO;
  const enabled = isText || isAudio || isVideo;

  return (
    <Pressable
      onPress={() => {
        if (isText) {
          router.push(`/chat/channel/${channel.id}?serverId=${serverId}`);
        } else if (isAudio) {
          router.push(`/voice/${channel.id}?serverId=${serverId}`);
        } else if (isVideo) {
          router.push(`/voice/${channel.id}?serverId=${serverId}&video=1`);
        }
      }}
      onLongPress={
        canManage
          ? () => router.push(`/servers/${serverId}/channels/${channel.id}`)
          : undefined
      }
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={`${channel.name} kanalı`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginHorizontal: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.panel : "transparent",
        opacity: enabled ? 1 : 0.5,
      })}
    >
      <Icon
        name={CHANNEL_ICON[channel.type] ?? "hash"}
        size={20}
        color={colors.muted}
      />
      <Text style={{ ...typography.body, color: colors.text, flex: 1 }} numberOfLines={1}>
        {channel.name}
      </Text>
    </Pressable>
  );
}

function buildSections(channels: Channel[]) {
  const groups: { title: string; type: string; data: Channel[] }[] = [
    { title: "METİN KANALLARI", type: ChannelType.TEXT, data: [] },
    { title: "SES KANALLARI", type: ChannelType.AUDIO, data: [] },
    { title: "GÖRÜNTÜ KANALLARI", type: ChannelType.VIDEO, data: [] },
  ];

  for (const channel of channels) {
    groups.find((g) => g.type === channel.type)?.data.push(channel);
  }

  return groups.filter((g) => g.data.length > 0);
}
