import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import {
  BULK_BAN_MAX,
  canActOnMember,
  hasServerPermission,
  isTimedOut,
  timeoutRemainingLabel,
  topRolePosition,
  TIMEOUT_DURATIONS,
  useBanMember,
  useBulkBan,
  useKickMember,
  useMyPermissions,
  useServerChannels,
  useServerMemberPages,
  useServerSummary,
  useTimeoutMember,
} from "@/api/hooks";
import type { ChannelExtras, ServerMemberListItem } from "@/api/types";
import {
  ActionSheet,
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  ListSkeleton,
  Pressable,
  Screen,
  StyledName,
  Tag,
  showDialog,
  showToast,
  type ActionSheetItem,
} from "@/components/ui";
import { useUserAppSheetItems } from "@/features/chat/user-apps";
import { NameplateBackground } from "@/features/profile/nameplate";
import { BanSheet, PruneSheet } from "@/features/server/moderation-sheets";
import { RoleIconBadge, roleIconFromRoles } from "@/features/server/role-icon-badge";
import { ServerTagPill } from "@/features/server-tag/server-tag-pill";
import { isMobileActivity } from "@/features/presence/media-activity";
import { streamWatchUrl } from "@/lib/activity-broadcast";
import { customStatusOf, formatCustomStatus } from "@/lib/custom-status";
import { formatActivity } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { useAuth } from "@/stores/auth";
import { usePresence } from "@/stores/presence";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu üyeleri — web üye sağ tık menüsünün mobil karşılığı.
 *
 * Satıra dokununca eylem sayfası açılır. Moderasyon eylemleri (zaman aşımı
 * ver / kaldır, sunucudan at) `/my-permissions` bitleri ve rol hiyerarşisine
 * göre gösterilir (web `canActOn`); uçlar yine kendi denetimini yapar.
 *
 * Yasaklama yetkisi olan "Seç" ile çoklu seçime geçer ve seçilenleri tek
 * istekte yasaklar (web üyeler sekmesindeki seçim); "Atma" yetkisi olan
 * rolsüz, uzun süredir görülmeyen üyeleri "Üyeleri Temizle" ile çıkarır.
 */
export default function ServerMembersScreen() {
  // `channelId`: bir kanaldan açıldıysa "Uygulamalar" (USER komutları) orada çalışır.
  const { serverId, channelId } = useLocalSearchParams<{ serverId: string; channelId?: string }>();
  const { data: server } = useServerSummary(serverId);
  const { data: serverChannels } = useServerChannels(channelId ? undefined : serverId);
  const { data: actor } = useMyPermissions(serverId);
  const myId = useAuth((s) => s.profile?.id);
  const now = useNow(30_000);
  const insets = useSafeAreaInsets();

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const pages = useServerMemberPages(serverId, query);
  const members = useMemo(() => pages.data?.pages.flatMap((page) => page.items) ?? [], [pages.data]);

  const timeout = useTimeoutMember(serverId);
  const kick = useKickMember(serverId);
  const ban = useBanMember(serverId);
  const bulkBan = useBulkBan(serverId);
  const [selected, setSelected] = useState<ServerMemberListItem | null>(null);
  const [timeoutTarget, setTimeoutTarget] = useState<ServerMemberListItem | null>(null);
  /** Yasak sayfası: tek üye ya da seçim ("bulk"). */
  const [banTarget, setBanTarget] = useState<ServerMemberListItem | "bulk" | null>(null);
  const [pruneOpen, setPruneOpen] = useState(false);
  // Çoklu seçim (toplu yasak): üye kimliği → kullanıcı (profil) kimliği.
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Map<string, string>>(() => new Map());
  const canBanAny = hasServerPermission(actor, "BAN_MEMBERS");
  const canPrune = hasServerPermission(actor, "KICK_MEMBERS");

  const ownerId = server?.profileId;
  const nameOf = (member: ServerMemberListItem) =>
    member.nickname?.trim() || member.profile.name?.trim() || member.profile.username;

  const permissionsFor = (member: ServerMemberListItem) => {
    const self = member.profileId === myId;
    const target = { isOwner: member.profileId === ownerId, role: member.role, topPosition: topRolePosition(member) };
    return {
      timeout: !self && !member.profile.isBot && canActOnMember(actor, target, "MODERATE_MEMBERS"),
      kick: !self && canActOnMember(actor, target, "KICK_MEMBERS"),
      ban: !self && canActOnMember(actor, target, "BAN_MEMBERS"),
    };
  };

  const exitSelect = () => {
    setSelectMode(false);
    setPicked(new Map());
  };

  const togglePick = (member: ServerMemberListItem) => {
    if (!permissionsFor(member).ban) return;
    if (!picked.has(member.id) && picked.size >= BULK_BAN_MAX) {
      showToast(`En fazla ${BULK_BAN_MAX} üye seçilebilir.`, "error");
      return;
    }
    setPicked((current) => {
      const next = new Map(current);
      if (next.has(member.id)) next.delete(member.id);
      else next.set(member.id, member.profileId);
      return next;
    });
  };

  const fail = (error: unknown, fallback: string) =>
    showToast(error instanceof ApiError ? error.message : fallback, "error");

  // Kanal bağlamı yoksa sunucunun sistem kanalı, o da yoksa ilk metin kanalı
  // (web'de üye listesi hep açık kanalın yanında; mobilde bu ekran sunucu düzeyinde).
  const appChannelId = useMemo(() => {
    if (channelId) return channelId;
    const list = (serverChannels ?? []) as (NonNullable<typeof serverChannels>[number] & ChannelExtras)[];
    const text = list.filter((c) => c.type === "TEXT" && !c.parentChannelId && !c.forum);
    const systemId = (server as { systemChannelId?: string | null } | undefined)?.systemChannelId;
    return text.find((c) => c.id === systemId)?.id ?? text[0]?.id;
  }, [channelId, serverChannels, server]);
  const appItems = useUserAppSheetItems(appChannelId, selected?.profileId);

  const menuItems: (ActionSheetItem | "separator" | { heading: string })[] = [];
  if (selected) {
    const can = permissionsFor(selected);
    const name = nameOf(selected);
    menuItems.push({
      key: "profile",
      label: "Profili gör",
      icon: "user",
      onPress: () => router.push(`/profile/${selected.profileId}`),
    });
    if (appItems.length > 0) menuItems.push("separator", ...appItems);
    if (can.timeout || can.kick || can.ban) menuItems.push("separator");
    if (can.timeout) {
      if (isTimedOut(selected.timedOutUntil, now)) {
        menuItems.push({
          key: "untimeout",
          label: "Zaman aşımını kaldır",
          detail: timeoutRemainingLabel(selected.timedOutUntil!, now),
          icon: "clock",
          onPress: () =>
            timeout.mutate(
              { memberId: selected.id, seconds: null },
              {
                onSuccess: () => showToast(`${name} için zaman aşımı kaldırıldı.`),
                onError: (error) => fail(error, "Zaman aşımı kaldırılamadı."),
              }
            ),
        });
      } else {
        menuItems.push({
          key: "timeout",
          label: "Zaman aşımı ver",
          detail: "Süre boyunca mesaj gönderemez, okumaya devam eder",
          icon: "clock",
          onPress: () => setTimeoutTarget(selected),
        });
      }
    }
    if (can.kick) {
      menuItems.push({
        key: "kick",
        label: "Sunucudan at",
        icon: "logout",
        destructive: true,
        onPress: () =>
          showDialog(`${name} atılsın mı?`, "Davetle yeniden katılabilir.", [
            { text: "Vazgeç", style: "cancel" },
            {
              text: "At",
              style: "destructive",
              onPress: () =>
                kick.mutate(selected.id, {
                  onSuccess: () => showToast(`${name} sunucudan atıldı.`),
                  onError: (error) => fail(error, "Üye atılamadı."),
                }),
            },
          ]),
      });
    }
    if (can.ban) {
      menuItems.push({
        key: "ban",
        label: "Yasakla",
        icon: "shield",
        destructive: true,
        onPress: () => setBanTarget(selected),
      });
    }
  }

  const durationItems: ActionSheetItem[] = timeoutTarget
    ? TIMEOUT_DURATIONS.map((duration) => ({
        key: duration.id,
        label: duration.label,
        icon: "clock",
        onPress: () =>
          timeout.mutate(
            { memberId: timeoutTarget.id, seconds: duration.seconds },
            {
              onSuccess: () => showToast(`${nameOf(timeoutTarget)} ${duration.label} boyunca susturuldu.`),
              onError: (error) => fail(error, "Zaman aşımı verilemedi."),
            }
          ),
      }))
    : [];

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Üyeler",
          headerRight: canBanAny
            ? () => (
                <Pressable onPress={() => (selectMode ? exitSelect() : setSelectMode(true))} accessibilityRole="button">
                  <Text style={{ ...typography.bodyStrong, color: colors.brand }}>{selectMode ? "İptal" : "Seç"}</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginHorizontal: spacing.lg,
          marginVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.full,
          backgroundColor: colors.panel,
        }}
      >
        <Icon name="search" size={16} color={colors.muted} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Üye ara"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          style={{ flex: 1, paddingVertical: spacing.sm, color: colors.bright, ...typography.body }}
          accessibilityLabel="Üye ara"
        />
      </View>

      {canPrune && !selectMode ? (
        <Pressable
          onPress={() => setPruneOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.lg,
            borderCurve: "continuous",
            backgroundColor: pressed ? colors.raised : colors.panel,
          })}
        >
          <Icon name="users" size={18} color={colors.muted} />
          <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>Üyeleri Temizle</Text>
          <Icon name="chevron-right" size={16} color={colors.muted} />
        </Pressable>
      ) : null}

      {pages.isLoading ? (
        <ListSkeleton rows={8} />
      ) : pages.error ? (
        <ErrorState
          message={pages.error instanceof ApiError ? pages.error.message : "Üyeler yüklenemedi."}
          onRetry={() => void pages.refetch()}
        />
      ) : members.length === 0 ? (
        <EmptyState icon="users" title="Üye bulunamadı" description={query ? `“${query}” ile eşleşen üye yok.` : undefined} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(member) => member.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
          onEndReached={() => {
            if (pages.hasNextPage && !pages.isFetchingNextPage) void pages.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            pages.isFetchingNextPage ? <ActivityIndicator color={colors.muted} style={{ margin: spacing.lg }} /> : null
          }
          renderItem={({ item }) => {
            const timedOut = isTimedOut(item.timedOutUntil, now);
            const topRole = [...item.roles].sort((a, b) => b.position - a.position)[0];
            const pickable = selectMode && permissionsFor(item).ban;
            const isPicked = picked.has(item.id);
            return (
              <Pressable
                onPress={() => (selectMode ? togglePick(item) : setSelected(item))}
                disabled={selectMode && !pickable}
                accessibilityRole={selectMode ? "checkbox" : "button"}
                accessibilityState={selectMode ? { checked: isPicked, disabled: !pickable } : undefined}
                accessibilityLabel={`${nameOf(item)}${timedOut ? ", zaman aşımında" : ""}`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  overflow: "hidden",
                  backgroundColor: pressed ? colors.raised : "transparent",
                  opacity: selectMode && !pickable ? 0.45 : 1,
                })}
              >
                {selectMode ? <PickMark checked={isPicked} /> : null}
                {/* İsim plakası (web üye satırı): sağa yaslı sahne + isme doğru sönen renk. */}
                <NameplateBackground id={item.profile.nameplateId} />
                <Avatar
                  profileId={item.profileId}
                  imageUrl={item.serverImageUrl ?? item.profile.imageUrl}
                  fallbackText={item.profile.username}
                  size={40}
                  showPresence
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <StyledName
                      profileId={item.profileId}
                      name={nameOf(item)}
                      textStyle={{ ...typography.body, ...fw(600), color: topRole?.color || colors.bright }}
                      containerStyle={{ alignSelf: "flex-start", flexShrink: 1 }}
                      numberOfLines={1}
                    />
                    {/* Rol simgesi (web üye satırı): en yüksek simgeli rol. */}
                    <RoleIconBadge icon={roleIconFromRoles(item.roles)} size={16} />
                    <ServerTagPill guild={item.profile.primaryGuild} size="sm" />
                  </View>
                  {timedOut ? (
                    <Text style={{ ...typography.caption, color: colors.danger }} numberOfLines={1}>
                      {`Zaman aşımında · ${timeoutRemainingLabel(item.timedOutUntil!, now)}`}
                    </Text>
                  ) : (
                    <MemberStatusLine profile={item.profile} />
                  )}
                </View>
                {item.profileId === ownerId ? (
                  <Tag label="Sahip" />
                ) : item.role === "ADMIN" ? (
                  <Tag label="Yönetici" />
                ) : item.role === "MODERATOR" ? (
                  <Tag label="Moderatör" />
                ) : item.profile.isBot ? (
                  <Tag label="Bot" />
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      <ActionSheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        header={
          selected ? (
            <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
              {nameOf(selected)}
            </Text>
          ) : undefined
        }
        items={menuItems}
      />
      <ActionSheet
        visible={timeoutTarget !== null}
        onClose={() => setTimeoutTarget(null)}
        header={
          timeoutTarget ? (
            <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
              {nameOf(timeoutTarget)} için zaman aşımı
            </Text>
          ) : undefined
        }
        items={durationItems}
      />

      {selectMode ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.panel,
          }}
        >
          <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }}>{`${picked.size} üye seçildi`}</Text>
          <Button label="Seçilenleri yasakla" variant="danger" disabled={picked.size === 0} onPress={() => setBanTarget("bulk")} />
        </View>
      ) : null}

      <BanSheet
        visible={banTarget !== null}
        title={
          banTarget === "bulk"
            ? `${picked.size} üye yasaklansın mı?`
            : banTarget
              ? `${nameOf(banTarget)} yasaklansın mı?`
              : ""
        }
        onClose={() => setBanTarget(null)}
        onSubmit={async (input, duration) => {
          if (banTarget === "bulk") {
            const result = await bulkBan.mutateAsync({ userIds: [...picked.values()], ...input });
            if (result.banned.length > 0) showToast(`${result.banned.length} üye yasaklandı.`);
            if (result.failed.length > 0) showToast(`${result.failed.length} üye yasaklanamadı.`, "error");
            exitSelect();
          } else if (banTarget) {
            const name = nameOf(banTarget);
            await ban.mutateAsync({ userId: banTarget.profileId, ...input });
            showToast(`${name} yasaklandı${duration.seconds ? ` (${duration.label})` : ""}.`);
          }
        }}
      />
      <PruneSheet serverId={serverId} visible={pruneOpen} onClose={() => setPruneOpen(false)} />
    </Screen>
  );
}

/** Seçim modunda satır başındaki onay dairesi. */
function PickMark({ checked }: { checked: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: radii.full,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: checked ? 0 : 2,
        borderColor: colors.muted,
        backgroundColor: checked ? colors.brand : "transparent",
      }}
    >
      {checked ? <Icon name="check" size={14} color={colors.onBrand} /> : null}
    </View>
  );
}

const VISIBLE_STATUSES: readonly PresenceStatus[] = [PresenceStatus.ONLINE, PresenceStatus.IDLE, PresenceStatus.DND];

/**
 * Adın altındaki tek satır (web server-member `MemberStatusLine`): şu anki
 * etkinlik (tanınan oyun/uygulama, telefon işareti), yoksa özel durum, o da
 * yoksa kullanıcı adı. Çevrimdışı/görünmez kişide etkinlik ve durum
 * gösterilmez. Yalnızca depo okuması — satır başına ağ isteği yok; seçici
 * kişinin kendi kaydını döndürür, başkasının değişimi satırı yeniden çizdirmez.
 */
function MemberStatusLine({ profile }: { profile: ServerMemberListItem["profile"] }) {
  const presence = usePresence(profile.id);
  const visible = VISIBLE_STATUSES.includes(presence.status);
  const activity = visible ? presence.activity : null;
  const activityText = formatActivity(activity);
  const custom = visible && !activityText ? customStatusOf(profile) : null;
  // Twitch/Kick yayını: "FC 27 yayını yapıyor" dokununca kanal tarayıcıda açılır.
  const watchUrl = streamWatchUrl(activity);

  if (activity && activityText) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        {isMobileActivity(activity) ? (
          <View accessible accessibilityLabel="Telefondan">
            <Icon name="smartphone" size={11} color={colors.accent} />
          </View>
        ) : null}
        <Text
          style={{ flexShrink: 1, ...typography.caption, color: colors.accent }}
          numberOfLines={1}
          onPress={watchUrl ? () => void Linking.openURL(watchUrl).catch(() => undefined) : undefined}
          accessibilityRole={watchUrl ? "link" : undefined}
        >
          {activityText}
        </Text>
      </View>
    );
  }
  return (
    <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
      {custom ? formatCustomStatus(custom) : `@${profile.username}`}
    </Text>
  );
}
