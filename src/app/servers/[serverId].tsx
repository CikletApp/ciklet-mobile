import { useEffect, useRef, useState } from "react";
import { SectionList, Share, Text, View } from "react-native";
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
  useServerTiers,
  useSidebarThreads,
  useUnreadCounts,
  DEFAULT_SIDEBAR_PREFERENCES,
  isChannelShownInSidebar,
  useSidebarPreferences,
  useUpdateSidebarPreferences,
  useServerGuide,
  useWelcomeScreen,
} from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import {
  ActionSheet,
  Avatar,
  Icon,
  IconButton,
  Pressable,
  UnreadBadge,
  showToast,
  type ActionSheetItem,
  type IconName,
} from "@/components/ui";
import { openNotificationSettings } from "@/features/notifications/notification-sheet";
import { openThread } from "@/features/server/thread-nav";
import { GuideEntryRow } from "@/features/server/guide-view";
import { ServerJoinGate, WelcomeScreenModal } from "@/features/server/join-flow";
import { hasWelcomeContent, isWithinWelcomeWindow } from "@/lib/welcome-screen";
import { useVoiceOccupancy } from "@/features/voice/use-voice-occupancy";
import { CHANNEL_FULL_MESSAGE, formatUserLimit, isVoiceChannelFull } from "@/lib/voice-settings";
import { useAuth } from "@/stores/auth";
import { effectiveChannelNotification, findSetting, isMutedAt } from "@/lib/notification-settings";
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

  // Kullanıcı sınırlı ses kanalı varsa doluluk ağ geçidinden izlenir
  // ("3/5" rozeti, "Kanal dolu"). "Üyeleri Taşı" izni olan ve sunucunun
  // AFK kanalı muaf — token ucuyla aynı kural (web kenar çubuğu da aynı).
  const hasLimitedVoice = (channels ?? []).some((c) => ((c as Channel & ChannelExtras).userLimit ?? 0) > 0);
  const occupancy = useVoiceOccupancy(serverId, hasLimitedVoice);
  const { data: details } = useServerDetails(serverId);
  const myId = useAuth((s) => s.profile?.id);
  const canBypassLimit = hasServerPermission(permissions, "MOVE_MEMBERS");
  const voiceSlot = (channel: Channel) => {
    const limit = (channel as Channel & ChannelExtras).userLimit ?? 0;
    if (channel.type === ChannelType.TEXT || limit <= 0) return { label: null, full: false };
    const ids = occupancy.members[channel.id] ?? [];
    const exempt = canBypassLimit || details?.afkChannelId === channel.id || (myId ? ids.includes(myId) : false);
    return { label: formatUserLimit(ids.length, limit), full: !exempt && isVoiceChannelFull(ids.length, limit) };
  };

  // Açık alt başlıklar üst kanalın altında (web kenar çubuğu; forum hariç).
  const threadsByParent = useSidebarThreads(serverId);
  const { data: notificationSettings } = useNotificationSettings();
  const now = useNow(60_000);

  // Kişisel görünürlük (web kenar çubuğu ile aynı): "Kanallara Göz At"ta
  // takipten çıkarılan kanallar ve — açıksa — kanal düzeyinde susturulmuş
  // kanallar listede çizilmez. Erişim değişmez; yalnızca bu kişinin listesi.
  const { data: sidebarPrefs } = useSidebarPreferences(serverId);
  const updateSidebar = useUpdateSidebarPreferences(serverId);
  const prefs = sidebarPrefs ?? DEFAULT_SIDEBAR_PREFERENCES;
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const shownChannels = (() => {
    if (prefs.hiddenChannelIds.length === 0 && !prefs.hideMutedChannels) return channels ?? [];
    const hiddenSet = new Set(prefs.hiddenChannelIds);
    return (channels ?? []).filter((channel) =>
      isChannelShownInSidebar({
        channelId: channel.id,
        prefs,
        hiddenSet,
        muted: isMutedAt(findSetting(notificationSettings, { channelId: channel.id })?.mutedUntil, now),
      })
    );
  })();
  const sections = buildSections(shownChannels);

  // Sunucu Rehberi (web kenar çubuğu girişi + sunucu kökünün ilk
  // yönlendirmesi): rehber açık ve üye onu hiç açmamışsa bir kez rehbere.
  const { data: guideData } = useServerGuide(serverId);
  const guide = guideData?.guide ?? null;
  const guideOpened = useRef<string | null>(null);
  const openingGuide = guideData?.shouldOpen === true;
  useEffect(() => {
    if (!openingGuide || guideOpened.current === serverId) return;
    guideOpened.current = serverId;
    router.push(`/servers/${serverId}/guide`);
  }, [openingGuide, serverId]);

  // Karşılama ekranı: yalnızca yeni katılan üyeye (katılımdan sonraki 15 dk)
  // sorgulanır; rehber açıksa üye zaten rehbere düştüğü için ikinci bir
  // "hoş geldin" açılmaz (web sunucu düzeniyle aynı kural).
  const isNewMember =
    Boolean(membership) &&
    (membership as { isGhost?: boolean } | undefined)?.isGhost !== true &&
    isWithinWelcomeWindow(membership?.createdAt ?? "");
  const { data: welcomeScreen } = useWelcomeScreen(serverId, isNewMember);
  const welcomeToShow =
    isNewMember && guideData !== undefined && guide === null && hasWelcomeContent(welcomeScreen) ? welcomeScreen : null;
  const serverMenuItems: ActionSheetItem[] = [
    {
      key: "browse",
      label: "Kanallara Göz At",
      icon: "list",
      onPress: () => router.push(`/servers/${serverId}/browse-channels`),
    },
    {
      key: "hide-muted",
      label: "Sessize Alınan Kanalları Gizle",
      detail: prefs.hideMutedChannels ? "Açık" : "Kapalı",
      icon: prefs.hideMutedChannels ? "eye-off" : "eye",
      onPress: () =>
        updateSidebar.mutate(
          { hideMutedChannels: !prefs.hideMutedChannels },
          {
            onSuccess: (saved) =>
              showToast(
                saved.hideMutedChannels
                  ? "Sessize alınan kanallar artık gizleniyor."
                  : "Sessize alınan kanallar artık görünüyor."
              ),
            onError: () => showToast("Tercih kaydedilemedi.", "error"),
          }
        ),
    },
    {
      key: "notifications",
      label: "Bildirimler",
      icon: "bell-off",
      onPress: () =>
        openNotificationSettings({ target: { serverId }, kind: "server", title: server?.name ?? "Sunucu" }),
    },
  ];
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
              <IconButton
                icon="more"
                label="Sunucu menüsü"
                background="transparent"
                tint={colors.muted}
                onPress={() => setServerMenuOpen(true)}
              />
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
              <>
                <ServerHero
                  serverId={serverId}
                  name={server.name}
                  imageUrl={server.imageUrl}
                />
                {guide ? (
                  <GuideEntryRow
                    taskIds={guide.tasks.map((task) => task.id)}
                    completed={guide.completed}
                    onPress={() => router.push(`/servers/${serverId}/guide`)}
                  />
                ) : null}
              </>
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
                slot={voiceSlot(item)}
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

      {/* Katılım soruları (kural perdesi kanal ekranında). Rehbere
          yönlendirilirken perde rehber sayfasında açılır. */}
      {!openingGuide ? <ServerJoinGate serverId={serverId} channels={channels} onboardingOnly /> : null}
      {welcomeToShow && server ? (
        <WelcomeScreenModal
          serverId={serverId}
          serverName={server.name}
          serverImageUrl={server.imageUrl || null}
          screen={welcomeToShow}
          channels={channels}
        />
      ) : null}

      <ActionSheet
        visible={serverMenuOpen}
        onClose={() => setServerMenuOpen(false)}
        header={
          server ? (
            <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
              {server.name}
            </Text>
          ) : undefined
        }
        items={serverMenuItems}
      />

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
  const { data: summary } = useServerSummary(serverId);
  // Üye listesi ucu yalnızca ilk sayfayı (50) döndürüyor: sayı sunucu
  // özetinden gelir. Özet sayı taşımıyorsa ve liste tamsa listeden sayılır;
  // kesilmiş listede ne toplam ne çevrimiçi sayısı gösterilir (yanlış olurdu).
  const listComplete = Boolean(members && members.length < MEMBER_PAGE_SIZE);
  const memberCount = summary?.memberCount ?? details?.memberCount ?? (listComplete ? members?.length : undefined);
  const inviteCode = details?.inviteCode;
  // Abonelik kademesi olan (ya da yöneticisi olduğun) sunucuda kısayol.
  const { data: tiers } = useServerTiers(serverId);
  const showSubscriptions = Boolean(tiers && (tiers.tiers.length > 0 || tiers.manager));
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
      {memberCount !== undefined ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>{memberCount} üye</Text>
          {listComplete ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.online }} />
              <Text style={{ ...typography.caption, color: colors.muted }}>{online} çevrimiçi</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xs }}>
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
        {showSubscriptions ? (
          <HeroAction icon="sparkles" label="Abonelikler" onPress={() => router.push(`/servers/${serverId}/subscriptions`)} />
        ) : null}
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

/** Üye listesi ucunun varsayılan sayfa boyu (web DEFAULT_SERVER_MEMBER_PAGE_SIZE). */
const MEMBER_PAGE_SIZE = 50;

const CHANNEL_ICON: Record<string, IconName> = {
  [ChannelType.TEXT]: "hash",
  [ChannelType.AUDIO]: "volume",
  [ChannelType.VIDEO]: "video",
};

function ChannelRow({
  serverId,
  channel,
  slot,
  muted,
  onLongPress,
  unread,
}: {
  serverId: string;
  channel: Channel;
  /** Kullanıcı sınırlı ses kanalı: "3/5" rozeti ve dolu mu (katılım denenmez). */
  slot: { label: string | null; full: boolean };
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
        if (!isText && slot.full) {
          showToast(CHANNEL_FULL_MESSAGE);
          return;
        }
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
      accessibilityLabel={`${channel.name} kanalı${muted ? ", susturuldu" : ""}${voiceStatus ? `, ${voiceStatus}` : ""}${slot.label ? `, kullanıcı sınırı ${slot.label}` : ""}`}
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
      {/* Kullanıcı sınırlı ses kanalı: web kenar çubuğundaki "3/5" hapı. */}
      {slot.label ? (
        <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.sm, backgroundColor: colors.raised }}>
          <Text style={{ ...typography.caption, ...fw(600), color: colors.muted, fontVariant: ["tabular-nums"] }}>{slot.label}</Text>
        </View>
      ) : null}
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
