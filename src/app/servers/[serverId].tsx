import { useState } from "react";
import { SectionList, Share, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ChannelType,
  MemberRole,
  type Channel,
} from "@ciklet/embedded-activities-sdk/types";

import {
  useMyMembership,
  useServerChannels,
  useServerDetails,
  useServerMembers,
  useServerSummary,
  useUnreadCounts,
} from "@/api/hooks";
import {
  Avatar,
  Icon,
  IconButton,
  Pressable,
  UnreadBadge,
  type IconName,
} from "@/components/ui";
import { usePresenceStore } from "@/stores/presence";
import { EmptyState, ListSkeleton, Screen } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

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
  const { data: unread } = useUnreadCounts();
  const canManageChannels =
    membership?.role === MemberRole.ADMIN || membership?.role === MemberRole.MODERATOR;

  /** Katlanan kategoriler — uzun kanal listelerinde ses/görüntü bölümlerini
      kapatmak metin kanallarına ulaşmayı tek kaydırmaya indiriyor. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleSection = (type: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const sections = buildSections(channels ?? []);

  return (
    <Screen>
      <Stack.Screen
        options={{
          // Ad üst kartta büyük yazıyor; başlıkta tekrarı gereksiz.
          title: "",
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
          sections={sections.map((section) =>
            collapsed.has(section.type) ? { ...section, data: [] } : section
          )}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            server ? (
              <ServerHero
                serverId={serverId}
                name={server.name}
                imageUrl={server.imageUrl}
              />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
          renderSectionHeader={({ section }) => {
            const isCollapsed = collapsed.has(section.type);
            // Kategori sayısı kapalıyken görünür: katlanmış bir kategoride
            // okunmamış mesaj varsa kullanıcı bunu açmadan bilemezdi.
            const hidden = isCollapsed
              ? section.data.length ||
                (channels ?? []).filter((c) => c.type === section.type).length
              : 0;

            return (
              <Pressable
                onPress={() => toggleSection(section.type)}
                haptic="light"
                noHitSlop
                accessibilityRole="button"
                accessibilityState={{ expanded: !isCollapsed }}
                accessibilityLabel={`${section.title} kategorisi, ${isCollapsed ? "kapalı" : "açık"}`}
                style={{
                  minHeight: 42,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.lg,
                  paddingBottom: spacing.sm,
                }}
              >
                <Icon
                  name={isCollapsed ? "chevron-right" : "chevron-down"}
                  size={15}
                  color={colors.muted}
                />
                <Text style={{ ...typography.overline, color: colors.muted, flex: 1 }}>
                  {section.title}
                </Text>
                {hidden > 0 ? (
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    {hidden}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
          renderItem={({ item }) => (
            <ChannelRow
              serverId={serverId}
              channel={item}
              canManage={canManageChannels}
              unread={unread?.channelUnreads?.[item.id]?.count ?? 0}
            />
          )}
        />
      )}
    </Screen>
  );
}

/**
 * Sunucunun kimlik kartı — ikon, ad, üye ve çevrimiçi sayısı, en sık iki
 * eylem. Kanal listesine girildiğinde "neredeyim" sorusu başlıktaki küçük
 * yazıdan değil buradan okunur.
 */
function ServerHero({
  serverId,
  name,
  imageUrl,
}: {
  serverId: string;
  name: string;
  imageUrl: string | null;
}) {
  const { data: members } = useServerMembers(serverId);
  // Davet kodu özet listede yok; ayrıntı ucu önbellekte çoğu zaman hazır.
  const { data: details } = useServerDetails(serverId);
  const inviteCode = details?.inviteCode;
  const memberIds = (members ?? []).map((member) => member.profileId);
  const online = usePresenceStore((state) =>
    memberIds.filter((id) => {
      const status = state.entries[id]?.status;
      return status === "ONLINE" || status === "IDLE" || status === "DND";
    }).length
  );

  return (
    <View style={{ alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
      <View style={{ borderRadius: radii.xl, borderCurve: "continuous", overflow: "hidden" }}>
        <Avatar imageUrl={imageUrl} fallbackText={name} size={76} radius={0} backgroundColor={colors.bento} />
      </View>
      <Text style={{ ...typography.display, color: colors.bright, textAlign: "center" }} numberOfLines={2}>
        {name}
      </Text>
      {members ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>{members.length} üye</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.online }} />
            <Text style={{ ...typography.caption, color: colors.muted }}>{online} çevrimiçi</Text>
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
        {inviteCode ? (
          <HeroAction
            icon="user-plus"
            label="Davet et"
            onPress={() => void Share.share({ message: `https://ciklet.xyz/i/${inviteCode}` })}
          />
        ) : null}
        <HeroAction icon="settings" label="Ayarlar" onPress={() => router.push(`/servers/${serverId}/settings`)} />
      </View>
    </View>
  );
}

function HeroAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 40,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.full,
        backgroundColor: pressed ? colors.raised : colors.panel,
        borderWidth: 1,
        borderColor: colors.bentoBorder,
      })}
    >
      <Icon name={icon} size={17} color={colors.brand} />
      <Text style={{ ...typography.caption, fontSize: 14, ...fw(700), color: colors.bright }}>{label}</Text>
    </Pressable>
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
  canManage,
  unread,
}: {
  serverId: string;
  channel: Channel;
  canManage: boolean;
  unread: number;
}) {
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
        backgroundColor: pressed ? colors.raised : "transparent",
        opacity: enabled ? 1 : 0.5,
      })}
    >
      <Icon
        name={CHANNEL_ICON[channel.type] ?? "hash"}
        size={20}
        color={unread > 0 ? colors.bright : colors.muted}
      />
      <Text
        style={{
          ...typography.body,
          ...fw(unread > 0 ? 700 : 500),
          // Okunmuş kanal geri çekilir; okunmamış olan listeden öne çıkar.
          color: unread > 0 ? colors.bright : colors.muted,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {channel.name}
      </Text>
      {unread > 0 ? <UnreadBadge count={unread} tone="brand" /> : null}
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
