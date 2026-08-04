import { SectionList, Text, View } from "react-native";
import { router } from "expo-router";
import {
  ChannelType,
  type Channel,
} from "@ciklet/embedded-activities-sdk/types";

import { useServerChannels, useServerSummary, useUnreadCounts } from "@/api/hooks";
import {
  EmptyState,
  Icon,
  IconButton,
  ListSkeleton,
  Pressable,
  UnreadBadge,
  type IconName,
} from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Seçili sunucunun kanal listesi — rayın YANINDA açılır.
 *
 * Ayrı bir ekrana gitmek yerine ana sayfanın sağ bölümünü doldurur; böylece
 * ray görünür kalır ve sunucular arasında tek dokunuşla geçilir.
 */
export function ChannelPanel({ serverId }: { serverId: string }) {
  const { data: server } = useServerSummary(serverId);
  const { data: channels, isLoading } = useServerChannels(serverId);
  const { data: unread } = useUnreadCounts();

  const sections = buildSections(channels ?? []);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        <Text
          style={{ ...typography.display, color: colors.bright, flex: 1 }}
          numberOfLines={1}
        >
          {server?.name ?? ""}
        </Text>
        <IconButton
          icon="search"
          label="Ara"
          background="transparent"
          tint={colors.muted}
          onPress={() => router.push("/search")}
        />
        <IconButton
          icon="user-plus"
          label="Davet et"
          background="transparent"
          tint={colors.muted}
          onPress={() => router.push("/servers/new")}
        />
      </View>

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
                paddingBottom: spacing.xs,
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <ChannelRow
              serverId={serverId}
              channel={item}
              unread={unread?.channelUnreads?.[item.id]?.count ?? 0}
            />
          )}
        />
      )}
    </View>
  );
}

const CHANNEL_ICON: Record<string, IconName> = {
  [ChannelType.TEXT]: "hash",
  [ChannelType.AUDIO]: "volume",
  [ChannelType.VIDEO]: "video",
};

function ChannelRow({
  serverId,
  channel,
  unread,
}: {
  serverId: string;
  channel: Channel;
  unread: number;
}) {
  const isText = channel.type === ChannelType.TEXT;
  const isAudio = channel.type === ChannelType.AUDIO;
  // Görüntülü kanal mobilde henüz yok; ses altyapısı paylaşılıyor ama
  // video yayın/izleme yüzeyi ayrı bir iş.
  const enabled = isText || isAudio;

  return (
    <Pressable
      onPress={() => {
        if (isText) router.push(`/chat/channel/${channel.id}?serverId=${serverId}`);
        else if (isAudio) router.push(`/voice/${channel.id}?serverId=${serverId}`);
      }}
      disabled={!enabled}
      haptic={enabled ? "light" : undefined}
      noHitSlop
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
      <Icon name={CHANNEL_ICON[channel.type] ?? "hash"} size={20} color={colors.muted} />
      <Text
        style={{
          ...typography.body,
          color: unread > 0 ? colors.bright : colors.text,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {channel.name}
      </Text>
      {unread > 0 ? <UnreadBadge count={unread} /> : null}
      {!enabled ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>Yakında</Text>
      ) : null}
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
