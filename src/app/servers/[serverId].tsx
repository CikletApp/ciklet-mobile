import { Pressable, SectionList, Text } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ChannelType,
  type Channel,
} from "@ciklet/embedded-activities-sdk/types";

import { useServer } from "@/api/hooks";
import { Icon, type IconName } from "@/components/ui/icon";
import { EmptyState, Screen } from "@/components/ui/screen";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucunun kanal listesi.
 *
 * Kanal tipine göre üç bölüme ayrılır. Kategori/klasör yapısı henüz şemada
 * yok; Faz 2'de eklenirse bölümlendirme oradan beslenecek.
 */
export default function ServerChannelsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: server, isLoading } = useServer(serverId);

  const sections = buildSections(server?.channels ?? []);

  return (
    <Screen>
      <Stack.Screen options={{ title: server?.name ?? "" }} />

      {sections.length === 0 ? (
        <EmptyState
          icon="hash"
          title={isLoading ? "Yükleniyor…" : "Kanal yok"}
          description={isLoading ? undefined : "Bu sunucuda henüz kanal açılmamış."}
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
            <ChannelRow serverId={serverId} channel={item} />
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

function ChannelRow({ serverId, channel }: { serverId: string; channel: Channel }) {
  const isText = channel.type === ChannelType.TEXT;

  return (
    <Pressable
      onPress={() => {
        // Ses/görüntü kanallarına katılım Faz 4 (LiveKit); şimdilik yalnızca
        // metin kanalları sohbet ekranına götürür.
        if (isText) {
          router.push(`/chat/channel/${channel.id}?serverId=${serverId}`);
        }
      }}
      disabled={!isText}
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
        opacity: isText ? 1 : 0.5,
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
      {!isText ? (
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
