import { useMemo, useState } from "react";
import { SectionList, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { ChannelType, type Channel } from "@ciklet/embedded-activities-sdk/types";

import {
  DEFAULT_SIDEBAR_PREFERENCES,
  useServerChannels,
  useSidebarPreferences,
  useUpdateSidebarPreferences,
} from "@/api/hooks";
import { EmptyState, Icon, ListSkeleton, Pressable, Screen, TextField, showToast, type IconName } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kanallara Göz At (Discord "Browse Channels"; web
 * components/server/v2/browse-channels-dialog): görebildiğin kanallar, her
 * satırda Takip Et / Takip Ediliyor. Takip etmediğin kanal yalnızca senin
 * listenden kalkar; erişimin ve bildirimlerin değişmez. Tercih sunucuda
 * kalıcı, web ile eşit. Gruplar mobil kanal listesiyle aynı (türe göre).
 */
const GROUPS: { title: string; type: string }[] = [
  { title: "Metin Kanalları", type: ChannelType.TEXT },
  { title: "Ses Kanalları", type: ChannelType.AUDIO },
  { title: "Görüntü Kanalları", type: ChannelType.VIDEO },
];

function iconOf(channel: Channel): IconName {
  if (channel.type === ChannelType.AUDIO) return "volume";
  if (channel.type === ChannelType.VIDEO) return "video";
  return "hash";
}

export default function BrowseChannelsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: channels, isLoading } = useServerChannels(serverId);
  const { data: prefsData } = useSidebarPreferences(serverId);
  const update = useUpdateSidebarPreferences(serverId);
  const prefs = prefsData ?? DEFAULT_SIDEBAR_PREFERENCES;
  const hidden = useMemo(() => new Set(prefs.hiddenChannelIds), [prefs.hiddenChannelIds]);
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    return GROUPS.map((group) => ({
      ...group,
      key: group.type,
      data: (channels ?? []).filter(
        (channel) => channel.type === group.type && (!needle || channel.name.toLocaleLowerCase("tr").includes(needle))
      ),
    })).filter((section) => section.data.length > 0);
  }, [channels, query]);

  const all = channels ?? [];
  const followingCount = all.filter((channel) => !hidden.has(channel.id)).length;

  const setFollowed = (channelIds: string[], followed: boolean) => {
    if (channelIds.length === 0) return;
    update.mutate({ follow: { channelIds, followed } }, { onError: () => showToast("Tercih kaydedilemedi.", "error") });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Kanallara Göz At" }} />
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(channel) => channel.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Kenar çubuğunda görmek istediğin kanalları seç. Takip etmediğin kanallar yalnızca senin için gizlenir; erişimin değişmez.
              </Text>
              <TextField icon="search" placeholder="Kanal ara" value={query} onChangeText={setQuery} autoCorrect={false} />
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {followingCount} kanal takip ediliyor · {all.length}
              </Text>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="hash" title="Eşleşen kanal yok." />}
          renderSectionHeader={({ section }) => {
            const ids = section.data.map((channel) => channel.id);
            const allFollowed = ids.every((id) => !hidden.has(id));
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.lg,
                  paddingBottom: spacing.sm,
                }}
              >
                <Text style={{ ...typography.overline, color: colors.muted, flex: 1 }}>
                  {section.title.toLocaleUpperCase("tr")}
                </Text>
                <Pressable onPress={() => setFollowed(ids, !allFollowed)} accessibilityRole="button" hitSlop={8}>
                  <Text style={{ ...typography.caption, ...fw(600), color: colors.brand }}>
                    {allFollowed ? "Tümünü Bırak" : "Tümünü Takip Et"}
                  </Text>
                </Pressable>
              </View>
            );
          }}
          renderItem={({ item }) => {
            const followed = !hidden.has(item.id);
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}
              >
                <Icon name={iconOf(item)} size={18} color={colors.muted} />
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Pressable
                  onPress={() => setFollowed([item.id], !followed)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: followed }}
                  accessibilityLabel={`${item.name}: ${followed ? "Takip Ediliyor" : "Takip Et"}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    height: 32,
                    paddingHorizontal: spacing.md,
                    borderRadius: radii.md,
                    backgroundColor: followed ? colors.brand : colors.raised,
                  }}
                >
                  {followed ? <Icon name="check" size={14} color={colors.onBrand} /> : null}
                  <Text style={{ ...typography.caption, ...fw(600), color: followed ? colors.onBrand : colors.text }}>
                    {followed ? "Takip Ediliyor" : "Takip Et"}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
