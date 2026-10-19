import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import {
  canActOnMember,
  isTimedOut,
  timeoutRemainingLabel,
  topRolePosition,
  TIMEOUT_DURATIONS,
  useKickMember,
  useMyPermissions,
  useServerMemberPages,
  useServerSummary,
  useTimeoutMember,
} from "@/api/hooks";
import type { ServerMemberListItem } from "@/api/types";
import {
  ActionSheet,
  Avatar,
  EmptyState,
  ErrorState,
  Icon,
  ListSkeleton,
  Pressable,
  Screen,
  Tag,
  showDialog,
  showToast,
  type ActionSheetItem,
} from "@/components/ui";
import { useNow } from "@/lib/use-now";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu üyeleri — web üye sağ tık menüsünün mobil karşılığı.
 *
 * Satıra dokununca eylem sayfası açılır. Moderasyon eylemleri (zaman aşımı
 * ver / kaldır, sunucudan at) `/my-permissions` bitleri ve rol hiyerarşisine
 * göre gösterilir (web `canActOn`); uçlar yine kendi denetimini yapar.
 */
export default function ServerMembersScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: server } = useServerSummary(serverId);
  const { data: actor } = useMyPermissions(serverId);
  const myId = useAuth((s) => s.profile?.id);
  const now = useNow(30_000);

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
  const [selected, setSelected] = useState<ServerMemberListItem | null>(null);
  const [timeoutTarget, setTimeoutTarget] = useState<ServerMemberListItem | null>(null);

  const ownerId = server?.profileId;
  const nameOf = (member: ServerMemberListItem) =>
    member.nickname?.trim() || member.profile.name?.trim() || member.profile.username;

  const permissionsFor = (member: ServerMemberListItem) => {
    const self = member.profileId === myId;
    const target = { isOwner: member.profileId === ownerId, role: member.role, topPosition: topRolePosition(member) };
    return {
      timeout: !self && !member.profile.isBot && canActOnMember(actor, target, "MODERATE_MEMBERS"),
      kick: !self && canActOnMember(actor, target, "KICK_MEMBERS"),
    };
  };

  const fail = (error: unknown, fallback: string) =>
    showToast(error instanceof ApiError ? error.message : fallback, "error");

  const menuItems: (ActionSheetItem | "separator")[] = [];
  if (selected) {
    const can = permissionsFor(selected);
    const name = nameOf(selected);
    menuItems.push({
      key: "profile",
      label: "Profili gör",
      icon: "user",
      onPress: () => router.push(`/profile/${selected.profileId}`),
    });
    if (can.timeout || can.kick) menuItems.push("separator");
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
      <Stack.Screen options={{ title: "Üyeler" }} />
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
            return (
              <Pressable
                onPress={() => setSelected(item)}
                accessibilityRole="button"
                accessibilityLabel={`${nameOf(item)}${timedOut ? ", zaman aşımında" : ""}`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  backgroundColor: pressed ? colors.raised : "transparent",
                })}
              >
                <Avatar
                  profileId={item.profileId}
                  imageUrl={item.serverImageUrl ?? item.profile.imageUrl}
                  fallbackText={item.profile.username}
                  size={40}
                  showPresence
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text
                    style={{ ...typography.body, ...fw(600), color: topRole?.color || colors.bright }}
                    numberOfLines={1}
                  >
                    {nameOf(item)}
                  </Text>
                  <Text style={{ ...typography.caption, color: timedOut ? colors.danger : colors.muted }} numberOfLines={1}>
                    {timedOut
                      ? `Zaman aşımında · ${timeoutRemainingLabel(item.timedOutUntil!, now)}`
                      : `@${item.profile.username}`}
                  </Text>
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
    </Screen>
  );
}
