import { useState } from "react";
import { ScrollView, SectionList, Share, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ChannelType,
  MemberRole,
  type Channel,
} from "@ciklet/embedded-activities-sdk/types";

import {
  hasServerPermission,
  useMyMembership,
  useMyPermissions,
  useNotificationSettings,
  useServerChannels,
  useServerDetails,
  useServerMembers,
  useServerSummary,
  useSidebarThreads,
  useUnreadCounts,
} from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import {
  ActionSheet,
  Avatar,
  Icon,
  IconButton,
  Pressable,
  UnreadBadge,
  type ActionSheetItem,
  type IconName,
} from "@/components/ui";
import { openNotificationSettings } from "@/features/notifications/notification-sheet";
import { openThread } from "@/features/server/thread-nav";
import { effectiveChannelNotification, findSetting } from "@/lib/notification-settings";
import { useNow } from "@/lib/use-now";
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
  // Rol izin sistemi: "Kanalları Yönet" biti; izinler gelene dek eski katman kuralı.
  const { data: permissions } = useMyPermissions(serverId);
  const canManageChannels = permissions
    ? hasServerPermission(permissions, "MANAGE_CHANNELS")
    : membership?.role === MemberRole.ADMIN || membership?.role === MemberRole.MODERATOR;

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
  // Açık alt başlıklar üst kanalın altında (web kenar çubuğu; forum hariç).
  const threadsByParent = useSidebarThreads(serverId, channels);
  const { data: notificationSettings } = useNotificationSettings();
  const now = useNow(60_000);
  /** Basılı tutulan kanal — eylem sayfası (bildirimler, düzenle). */
  const [menuChannel, setMenuChannel] = useState<Channel | null>(null);
  const channelMuted = (channelId: string) =>
    effectiveChannelNotification(
      findSetting(notificationSettings, { channelId }),
      findSetting(notificationSettings, { serverId }),
      now
    ).muted;

  const menuItems: ActionSheetItem[] = menuChannel
    ? [
        {
          key: "notifications",
          label: "Bildirimler",
          icon: "bell-off",
          onPress: () =>
            openNotificationSettings({
              target: { channelId: menuChannel.id, serverId },
              kind: "channel",
              title: `#${menuChannel.name}`,
            }),
        },
        ...(canManageChannels
          ? [
              {
                key: "edit",
                label: "Kanalı düzenle",
                icon: "pencil" as const,
                onPress: () => router.push(`/servers/${serverId}/channels/${menuChannel.id}`),
              },
            ]
          : []),
      ]
    : [];

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
            // Kapalı kategorideki kanalların okunmamış toplamı.
            const hiddenUnread = isCollapsed
              ? (channels ?? [])
                  .filter((c) => c.type === section.type)
                  .reduce((sum, c) => sum + (unread?.channelUnreads?.[c.id]?.count ?? 0), 0)
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
                {hiddenUnread > 0 ? (
                  <UnreadBadge count={hiddenUnread} tone="brand" />
                ) : hidden > 0 ? (
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    {hidden}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
          renderItem={({ item }) => (
            <>
              <ChannelRow
                serverId={serverId}
                channel={item}
                muted={channelMuted(item.id)}
                onLongPress={() => setMenuChannel(item)}
                unread={unread?.channelUnreads?.[item.id]?.count ?? 0}
              />
              {threadsByParent.get(item.id)?.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  name={thread.name}
                  unread={unread?.channelUnreads?.[thread.id]?.count ?? 0}
                  onPress={() => openThread(serverId, item.id, thread)}
                />
              ))}
            </>
          )}
        />
      )}

      <ActionSheet
        visible={menuChannel !== null}
        onClose={() => setMenuChannel(null)}
        header={
          menuChannel ? (
            <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
              {menuChannel.type === ChannelType.TEXT ? "#" : ""}
              {menuChannel.name}
            </Text>
          ) : undefined
        }
        items={menuItems}
      />
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
      {/* Eylemler yatay kayar: dar ekranda da hepsi tek satırda. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, alignSelf: "stretch", marginTop: spacing.xs }}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xs, flexGrow: 1, justifyContent: "center" }}
      >
        {inviteCode ? (
          <HeroAction
            icon="user-plus"
            label="Davet et"
            onPress={() => void Share.share({ message: `https://ciklet.xyz/i/${inviteCode}` })}
          />
        ) : null}
        <HeroAction
          icon="bell"
          label="Bildirimler"
          onPress={() => openNotificationSettings({ target: { serverId }, kind: "server", title: name })}
        />
        <HeroAction icon="clock" label="Etkinlikler" onPress={() => router.push(`/servers/${serverId}/events`)} />
        <HeroAction icon="users" label="Üyeler" onPress={() => router.push(`/servers/${serverId}/members`)} />
        <HeroAction icon="settings" label="Ayarlar" onPress={() => router.push(`/servers/${serverId}/settings`)} />
      </ScrollView>
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
  muted,
  onLongPress,
  unread,
}: {
  serverId: string;
  channel: Channel;
  /** Kanal ya da sunucu susturulmuş: satır geri çekilir, rozet sayılmaz. */
  muted: boolean;
  onLongPress: () => void;
  unread: number;
}) {
  const isText = channel.type === ChannelType.TEXT;
  const isAudio = channel.type === ChannelType.AUDIO;
  const isVideo = channel.type === ChannelType.VIDEO;
  const enabled = isText || isAudio || isVideo;
  const extras = channel as Channel & ChannelExtras;
  const icon: IconName = extras.forum
    ? "list"
    : extras.stage
      ? "mic"
      : extras.mediaOnly
        ? "image"
        : (CHANNEL_ICON[channel.type] ?? "hash");
  // Ses kanalı durumu (web: kenar çubuğunda adın altında).
  const voiceStatus = !isText ? extras.voiceStatus?.trim() : undefined;
  const lit = unread > 0 && !muted;

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
      onLongPress={onLongPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={`${channel.name} kanalı${muted ? ", susturuldu" : ""}${voiceStatus ? `, ${voiceStatus}` : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginHorizontal: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.raised : "transparent",
        opacity: enabled ? (muted ? 0.6 : 1) : 0.5,
      })}
    >
      <Icon name={icon} size={20} color={lit ? colors.bright : colors.muted} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{
            ...typography.body,
            ...fw(lit ? 700 : 500),
            // Okunmuş kanal geri çekilir; okunmamış olan listeden öne çıkar.
            color: lit ? colors.bright : colors.muted,
          }}
          numberOfLines={1}
        >
          {channel.name}
        </Text>
        {voiceStatus ? (
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {voiceStatus}
          </Text>
        ) : null}
      </View>
      {muted ? <Icon name="bell-off" size={15} color={colors.muted} /> : null}
      {lit ? <UnreadBadge count={unread} tone="brand" /> : null}
    </Pressable>
  );
}

/** Üst kanalın altında girintili alt başlık satırı. */
function ThreadRow({ name, unread, onPress }: { name: string; unread: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} alt başlığı`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginLeft: spacing.sm + spacing.md + 9,
        marginRight: spacing.sm,
        paddingLeft: spacing.md,
        paddingRight: spacing.md,
        paddingVertical: spacing.sm,
        borderLeftWidth: 2,
        borderLeftColor: colors.border,
        borderTopRightRadius: radii.md,
        borderBottomRightRadius: radii.md,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <Text
        style={{ ...typography.caption, fontSize: 14, ...fw(unread > 0 ? 700 : 500), color: unread > 0 ? colors.bright : colors.muted, flex: 1 }}
        numberOfLines={1}
      >
        {name}
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
